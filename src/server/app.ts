import express, { type Express, type Request, type Response } from "express";
import type { Channel, WebhookChannel } from "../channels/types.js";
import { WebhookError } from "../channels/manychat.js";
import type { Orchestrator } from "../orchestrator.js";
import type { LeadStore } from "../crm/types.js";
import { log } from "../lib/logger.js";

/**
 * The webhook server. SECURITY posture:
 *  - Body size capped (anti-DoS) and captured as RAW bytes for HMAC checks.
 *  - In-memory IP rate limit on the webhook route.
 *  - Hardened response headers; framework fingerprint removed.
 *  - The channel verifies signature + schema BEFORE the orchestrator runs.
 *  - Errors return minimal status codes; details are logged, never leaked.
 */
export interface ServerDeps {
  orchestrator: Orchestrator;
  channel: Channel;
  store: LeadStore;
}

function isWebhookChannel(c: Channel): c is WebhookChannel {
  return typeof (c as WebhookChannel).verifyAndParse === "function";
}

export function createServer(deps: ServerDeps): Express {
  const app = express();
  app.disable("x-powered-by");

  // Capture the raw body (needed for signature verification) with a hard cap.
  app.use(
    express.text({ type: "*/*", limit: "64kb" }),
  );

  // Minimal hardening headers (avoids a heavyweight dependency).
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  const limiter = makeRateLimiter({ windowMs: 60_000, max: 120 });

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  app.post("/webhooks/inbound", limiter, async (req: Request, res: Response) => {
    if (!isWebhookChannel(deps.channel)) {
      // Mock channel has no inbound webhook; refuse rather than pretend.
      return res.status(404).json({ error: "no inbound webhook for this channel" });
    }

    const rawBody = typeof req.body === "string" ? req.body : "";
    try {
      const event = deps.channel.verifyAndParse(rawBody, req.headers);
      // Acknowledge fast (Meta/ManyChat expect a quick 200), process async.
      res.status(202).json({ accepted: true });
      if (event) void handleEvent(deps, event);
    } catch (err) {
      const status = err instanceof WebhookError ? err.status : 400;
      log.warn("webhook.rejected", { status, reason: redact(err) });
      if (!res.headersSent) res.status(status).json({ error: "rejected" });
    }
  });

  return app;
}

async function handleEvent(
  deps: ServerDeps,
  event: ReturnType<WebhookChannel["verifyAndParse"]>,
): Promise<void> {
  try {
    if (!event) return;
    if (event.type === "capture") {
      const lead = await deps.store.upsertCapture(event.capture);
      await deps.orchestrator.onCapture(lead.igHandle);
    } else {
      await deps.orchestrator.onLeadMessage(event.igHandle, event.text);
    }
  } catch (err) {
    log.error("webhook.processing.failed", { reason: redact(err) });
  }
}

/** Bare-bones fixed-window IP rate limiter. Good enough behind one instance. */
function makeRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: () => void) => {
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= max) {
      res.status(429).json({ error: "rate limited" });
      return;
    }
    entry.count += 1;
    next();
  };
}

/** Reduce an error to a safe string — never leak stack traces or secrets. */
function redact(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}
