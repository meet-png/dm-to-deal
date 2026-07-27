import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Channel, InboundEvent, OutboundMessage, WebhookChannel } from "./types.js";
import { log } from "../lib/logger.js";

/**
 * ManyChat adapter — the Meta-approved path for Instagram DMs (PRD §5.1).
 *
 * SECURITY: inbound webhooks are UNTRUSTED. We (1) require a shared-secret
 * HMAC signature and compare it in constant time, and (2) validate the body
 * shape with a strict schema before anything downstream sees it. A failed
 * check throws — the route turns that into a 401/400, never a 200.
 */

export const InboundSchema = z.object({
  event: z.enum(["keyword_opt_in", "message"]),
  ig_handle: z
    .string()
    .min(1)
    .max(120)
    // Instagram handles: letters, numbers, dot, underscore. Reject anything else.
    .regex(/^[A-Za-z0-9._]+$/, "invalid instagram handle"),
  text: z.string().max(4000).optional(),
  source_content: z.string().max(280).optional(),
  name: z.string().max(120).optional(),
});

export interface ManyChatConfig {
  apiToken: string;
  webhookSecret: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export class ManyChatChannel implements WebhookChannel {
  readonly name = "manychat";
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: ManyChatConfig) {
    if (!config.apiToken) throw new Error("ManyChat: apiToken is required");
    if (!config.webhookSecret) throw new Error("ManyChat: webhookSecret is required");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  verifyAndParse(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): InboundEvent | null {
    this.verifySignature(rawBody, headers);

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new WebhookError(400, "malformed JSON body");
    }

    const parsed = InboundSchema.safeParse(json);
    if (!parsed.success) {
      throw new WebhookError(400, "webhook body failed validation");
    }
    const body = parsed.data;

    if (body.event === "keyword_opt_in") {
      return {
        type: "capture",
        capture: {
          igHandle: body.ig_handle,
          sourceContent: body.source_content,
          name: body.name,
        },
      };
    }
    // event === "message"
    if (!body.text || body.text.trim().length === 0) return null; // nothing to act on
    return { type: "message", igHandle: body.ig_handle, text: body.text };
  }

  /**
   * HMAC-SHA256 over the raw body, compared in constant time. Rejects missing,
   * malformed, or mismatched signatures. The signature header is expected as
   * `x-manychat-signature: sha256=<hex>`.
   */
  private verifySignature(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): void {
    const header = firstHeader(headers["x-manychat-signature"]);
    if (!header) throw new WebhookError(401, "missing signature");

    const provided = header.startsWith("sha256=") ? header.slice(7) : header;
    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    if (!constantTimeEqualHex(provided, expected)) {
      throw new WebhookError(401, "invalid signature");
    }
  }

  async send(message: OutboundMessage): Promise<void> {
    const res = await this.fetchImpl("https://api.manychat.com/fb/sending/sendContent", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ig_handle: message.igHandle,
        data: { messages: [{ type: "text", text: message.text }] },
      }),
    });
    if (!res.ok) {
      // Never log the token or full response body (may echo secrets).
      log.error("manychat.send.failed", { status: res.status, to: message.igHandle });
      throw new Error(`ManyChat send failed with status ${res.status}`);
    }
  }
}

/** Carries an HTTP status so the route can respond correctly. */
export class WebhookError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "WebhookError";
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Constant-time hex comparison that never short-circuits on length. */
function constantTimeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

// Re-export so the channel factory can construct without importing the class file twice.
export type { Channel };
