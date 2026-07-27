import { timingSafeEqual } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import type { Channel, WebhookChannel } from "../channels/types.js";
import { InboundSchema, WebhookError } from "../channels/manychat.js";
import type { Orchestrator } from "../orchestrator.js";
import type { LeadStore } from "../crm/types.js";
import type { PersonalityProfile } from "../personality/profile.js";
import { createApiRouter } from "../api/routes.js";
import type { SimulatorService } from "../api/simulator.js";
import { log } from "../lib/logger.js";

/**
 * The HTTP server. SECURITY posture:
 *  - Webhook body parsed as RAW bytes (for HMAC) with a hard 64KB cap.
 *  - JSON body parser scoped to the /api routes only (so it can't interfere
 *    with signature verification on the webhook).
 *  - CORS restricted to an explicit allow-list of dashboard origins.
 *  - In-memory IP rate limits on webhook + simulate routes (anti-DoS).
 *  - Hardened headers; framework fingerprint removed.
 *  - Errors return minimal status codes; details are logged, never leaked.
 */
export interface ServerDeps {
  orchestrator: Orchestrator;
  channel: Channel;
  store: LeadStore;
  profile: PersonalityProfile;
  simulator: SimulatorService;
  /** Comma-separated allow-list of origins permitted to call the API. */
  corsOrigins: string[];
  /** Enables POST /webhooks/debug/manychat when set (requires ?token=<same>). */
  manychatDebugToken?: string;
}

function isWebhookChannel(c: Channel): c is WebhookChannel {
  return typeof (c as WebhookChannel).verifyAndParse === "function";
}

export function createServer(deps: ServerDeps): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.use(cors(deps.corsOrigins));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // Read + simulate API for the dashboard. JSON body parser scoped here.
  app.use(
    "/api",
    express.json({ limit: "64kb" }),
    createApiRouter({
      store: deps.store,
      profile: deps.profile,
      simulator: deps.simulator,
      listLeads: () => deps.store.all(),
    }),
  );

  // Inbound webhook: RAW body for signature verification, capped at 64KB.
  const webhookLimiter = makeRateLimiter({ windowMs: 60_000, max: 120 });
  app.post(
    "/webhooks/inbound",
    webhookLimiter,
    express.text({ type: "*/*", limit: "64kb" }),
    async (req: Request, res: Response) => {
      if (!isWebhookChannel(deps.channel)) {
        return res.status(404).json({ error: "no inbound webhook for this channel" });
      }
      const rawBody = typeof req.body === "string" ? req.body : "";
      try {
        const event = deps.channel.verifyAndParse(rawBody, req.headers);
        res.status(202).json({ accepted: true });
        if (event) void handleEvent(deps, event);
      } catch (err) {
        const status = err instanceof WebhookError ? err.status : 400;
        log.warn("webhook.rejected", { status, reason: redact(err) });
        if (!res.headersSent) res.status(status).json({ error: "rejected" });
      }
    },
  );

  // Diagnostic route for reconciling a live ManyChat webhook payload against
  // our InboundSchema. Enabled only when a token is configured; requests must
  // supply the same value as ?token=<...>. Never touches the orchestrator or
  // the store — pure echo + parse-report. Rate limited like the real webhook.
  if (deps.manychatDebugToken) {
    const debugLimiter = makeRateLimiter({ windowMs: 60_000, max: 30 });
    app.post(
      "/webhooks/debug/manychat",
      debugLimiter,
      express.text({ type: "*/*", limit: "64kb" }),
      (req: Request, res: Response) => {
        if (!verifyDebugToken(req, deps.manychatDebugToken!)) {
          return res.status(404).json({ error: "not found" });
        }
        const rawBody = typeof req.body === "string" ? req.body : "";
        let parsedBody: unknown = rawBody;
        let jsonOk = true;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          jsonOk = false;
        }
        const schema = jsonOk ? InboundSchema.safeParse(parsedBody) : undefined;
        const issues = !jsonOk
          ? [{ path: "", message: "malformed JSON body" }]
          : schema!.success
            ? []
            : schema!.error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              }));

        res.status(200).json({
          receivedBody: parsedBody,
          jsonOk,
          headers: safeHeaderInventory(req.headers),
          schemaValidation: {
            success: Boolean(schema?.success),
            issues,
            parsed: schema?.success ? schema.data : null,
          },
          signatureCheck: {
            headerPresent: Boolean(req.headers["x-manychat-signature"]),
            note: "signature NOT verified in debug mode; production route enforces HMAC",
          },
        });
      },
    );
    log.info("manychat.debug.enabled");
  }

  return app;
}

/** Constant-time token comparison so the token can't be brute-forced by timing. */
function verifyDebugToken(req: Request, expected: string): boolean {
  const raw = req.query.token;
  const provided = typeof raw === "string" ? raw : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Echo back non-sensitive headers only. Never surface Authorization/Cookie. */
function safeHeaderInventory(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[]> {
  const allowPrefixes = ["content-", "x-manychat-", "user-agent", "accept"];
  const denyExact = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue;
    const key = k.toLowerCase();
    if (denyExact.has(key)) continue;
    if (!allowPrefixes.some((p) => key === p || key.startsWith(p))) continue;
    // Mask the signature value — presence is useful; content is not.
    out[key] = key === "x-manychat-signature" ? "[redacted]" : v;
  }
  return out;
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

/** Strict CORS: only the configured dashboard origins, no wildcard. */
function cors(allowed: string[]) {
  const allow = new Set(allowed);
  return (req: Request, res: Response, next: () => void) => {
    const origin = req.headers.origin;
    if (origin && allow.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    if (req.method === "OPTIONS") return void res.sendStatus(204);
    next();
  };
}

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
    if (entry.count >= max) return void res.status(429).json({ error: "rate limited" });
    entry.count += 1;
    next();
  };
}

function redact(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}
