import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";
import { ManyChatChannel, WebhookError } from "../src/channels/manychat.js";

const SECRET = "test-webhook-secret";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

function channel(): ManyChatChannel {
  return new ManyChatChannel({ apiToken: "tok", webhookSecret: SECRET });
}

describe("ManyChatChannel.verifyAndParse (security boundary)", () => {
  it("accepts and normalizes a correctly-signed opt-in", () => {
    const body = JSON.stringify({
      event: "keyword_opt_in",
      ig_handle: "lead.user_1",
      source_content: "FIT reel",
    });
    const event = channel().verifyAndParse(body, { "x-manychat-signature": sign(body) });
    expect(event).toEqual({
      type: "capture",
      capture: { igHandle: "lead.user_1", sourceContent: "FIT reel", name: undefined },
    });
  });

  it("accepts a correctly-signed message", () => {
    const body = JSON.stringify({
      event: "message",
      ig_handle: "lead1",
      text: "hey is this for beginners?",
    });
    const event = channel().verifyAndParse(body, { "x-manychat-signature": sign(body) });
    expect(event).toEqual({
      type: "message",
      igHandle: "lead1",
      text: "hey is this for beginners?",
    });
  });

  it("rejects a missing signature with 401", () => {
    const body = JSON.stringify({ event: "message", ig_handle: "x", text: "hi" });
    expect(() => channel().verifyAndParse(body, {})).toThrowError(WebhookError);
  });

  it("rejects a tampered body (signature no longer matches)", () => {
    const body = JSON.stringify({ event: "message", ig_handle: "x", text: "hi" });
    const sig = sign(body);
    const tampered = JSON.stringify({ event: "message", ig_handle: "x", text: "EVIL" });
    expect(() => channel().verifyAndParse(tampered, { "x-manychat-signature": sig }))
      .toThrowError(/invalid signature/);
  });

  it("rejects a malicious handle that fails the schema regex", () => {
    const body = JSON.stringify({
      event: "message",
      ig_handle: "../../etc/passwd",
      text: "hi",
    });
    expect(() => channel().verifyAndParse(body, { "x-manychat-signature": sign(body) }))
      .toThrowError(/validation/);
  });

  it("rejects oversized text via the schema cap", () => {
    const body = JSON.stringify({
      event: "message",
      ig_handle: "lead1",
      text: "a".repeat(5000),
    });
    expect(() => channel().verifyAndParse(body, { "x-manychat-signature": sign(body) }))
      .toThrowError(/validation/);
  });
});
