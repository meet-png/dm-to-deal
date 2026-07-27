import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { CalendlyLink } from "../src/booking/calendly.js";
import { MockChannel } from "../src/channels/mock.js";
import { Pacer } from "../src/compliance/pacing.js";
import { MemoryLeadStore } from "../src/crm/memory-store.js";
import { Orchestrator } from "../src/orchestrator.js";
import { SimulatorService } from "../src/api/simulator.js";
import { EXAMPLE_PROFILE } from "../src/personality/profile.js";
import { createServer, type ServerDeps } from "../src/server/app.js";

const TOKEN = "abcdefghij1234567890";

function deps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  const store = new MemoryLeadStore();
  const channel = new MockChannel();
  const booking = new CalendlyLink("https://calendly.com/alex/strategy-call");
  const pacer = new Pacer({ minDelaySeconds: 0, maxDelaySeconds: 0, maxMessagesPerDay: 100 });
  const brain = { run: async () => ({ decision: {} as never, usage: {} as never }) };
  const orchestrator = new Orchestrator(brain, store, channel, booking, pacer);
  const simulator = new SimulatorService({
    bookingUrl: "https://calendly.com/alex/strategy-call",
    store,
  });
  return {
    orchestrator,
    channel,
    store,
    profile: EXAMPLE_PROFILE,
    simulator,
    corsOrigins: [],
    ...overrides,
  };
}

async function startServer(d: ServerDeps): Promise<{ url: string; close: () => Promise<void> }> {
  const app = createServer(d);
  return await new Promise((resolve) => {
    const server: Server = app.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

describe("POST /webhooks/debug/manychat", () => {
  let handle: { url: string; close: () => Promise<void> } | undefined;

  afterEach(async () => {
    if (handle) await handle.close();
    handle = undefined;
  });

  it("returns 404 when no debug token is configured", async () => {
    handle = await startServer(deps());
    const res = await fetch(`${handle.url}/webhooks/debug/manychat?token=${TOKEN}`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when the token is wrong (masquerades as disabled)", async () => {
    handle = await startServer(deps({ manychatDebugToken: TOKEN }));
    const res = await fetch(`${handle.url}/webhooks/debug/manychat?token=wrongtoken1234567`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(404);
  });

  it("reports a valid payload as schema-passing", async () => {
    handle = await startServer(deps({ manychatDebugToken: TOKEN }));
    const body = JSON.stringify({
      event: "message",
      ig_handle: "lead1",
      text: "hey is this for beginners?",
    });
    const res = await fetch(`${handle.url}/webhooks/debug/manychat?token=${TOKEN}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      jsonOk: boolean;
      schemaValidation: { success: boolean; issues: unknown[] };
    };
    expect(json.jsonOk).toBe(true);
    expect(json.schemaValidation.success).toBe(true);
    expect(json.schemaValidation.issues).toEqual([]);
  });

  it("reports schema issues on a payload with a bad IG handle", async () => {
    handle = await startServer(deps({ manychatDebugToken: TOKEN }));
    const body = JSON.stringify({
      event: "message",
      ig_handle: "has spaces and !!",
      text: "hi",
    });
    const res = await fetch(`${handle.url}/webhooks/debug/manychat?token=${TOKEN}`, {
      method: "POST",
      body,
    });
    const json = (await res.json()) as {
      schemaValidation: { success: boolean; issues: { path: string; message: string }[] };
    };
    expect(json.schemaValidation.success).toBe(false);
    expect(json.schemaValidation.issues.some((i) => i.path === "ig_handle")).toBe(true);
  });

  it("reports malformed JSON without crashing", async () => {
    handle = await startServer(deps({ manychatDebugToken: TOKEN }));
    const res = await fetch(`${handle.url}/webhooks/debug/manychat?token=${TOKEN}`, {
      method: "POST",
      body: "{ not valid json",
    });
    const json = (await res.json()) as {
      jsonOk: boolean;
      schemaValidation: { success: boolean; issues: { path: string; message: string }[] };
    };
    expect(json.jsonOk).toBe(false);
    expect(json.schemaValidation.success).toBe(false);
    expect(json.schemaValidation.issues[0]!.message).toContain("malformed JSON");
  });

  it("redacts the signature header value and drops Authorization from the echo", async () => {
    handle = await startServer(deps({ manychatDebugToken: TOKEN }));
    const res = await fetch(`${handle.url}/webhooks/debug/manychat?token=${TOKEN}`, {
      method: "POST",
      headers: {
        "x-manychat-signature": "sha256=secret_signature_value",
        authorization: "Bearer super-secret",
      },
      body: "{}",
    });
    const json = (await res.json()) as {
      headers: Record<string, string>;
      signatureCheck: { headerPresent: boolean };
    };
    expect(json.headers["x-manychat-signature"]).toBe("[redacted]");
    expect(json.headers.authorization).toBeUndefined();
    expect(json.signatureCheck.headerPresent).toBe(true);
  });
});
