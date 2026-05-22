import type { LeadCapture } from "../domain/types.js";

/**
 * A messaging channel is the pluggable boundary between the agent and the
 * outside world (Instagram, via ManyChat today, Meta Graph API later).
 *
 * Keeping this an interface means the brain/CRM/compliance core never depends
 * on a specific provider — swapping channels is a one-file change, and the
 * untrusted-input parsing/verification is isolated here.
 */
export interface OutboundMessage {
  igHandle: string;
  text: string;
}

/** A normalized inbound event after the adapter has verified + parsed it. */
export type InboundEvent =
  | { type: "capture"; capture: LeadCapture } // opted in via keyword/comment
  | { type: "message"; igHandle: string; text: string }; // replied in DMs

export interface Channel {
  readonly name: string;
  /** Send a DM to a lead. Implementations must treat `text` as already-composed. */
  send(message: OutboundMessage): Promise<void>;
}

/**
 * Channels that receive webhooks implement this to (1) verify authenticity and
 * (2) parse the raw body into a normalized event. Returning `null` means
 * "ignore" (unrecognized but harmless). Throwing means "reject" (untrusted).
 */
export interface WebhookChannel extends Channel {
  /**
   * @param rawBody  the EXACT raw request bytes (needed for signature checks)
   * @param headers  incoming request headers
   * @returns a normalized event, or null to ignore
   * @throws if the request fails authenticity verification
   */
  verifyAndParse(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
  ): InboundEvent | null;
}
