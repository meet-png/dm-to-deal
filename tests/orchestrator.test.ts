import { describe, it, expect } from "vitest";
import type { Brain, BrainResult } from "../src/agent/brain.js";
import type { AgentDecision } from "../src/agent/decision.schema.js";
import { CalendlyLink } from "../src/booking/calendly.js";
import { MockChannel } from "../src/channels/mock.js";
import { Pacer } from "../src/compliance/pacing.js";
import { MemoryLeadStore } from "../src/crm/memory-store.js";
import { Orchestrator } from "../src/orchestrator.js";

const ZERO_DELAY = { minDelaySeconds: 0, maxDelaySeconds: 0, maxMessagesPerDay: 100 };

/** A scripted brain that returns the decisions you queue, in order. */
function scriptedBrain(decisions: AgentDecision[]): Brain {
  let i = 0;
  const run = async (): Promise<BrainResult> => {
    const decision = decisions[Math.min(i++, decisions.length - 1)]!;
    return {
      decision,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      },
    };
  };
  return { run };
}

function harness(decisions: AgentDecision[]) {
  const store = new MemoryLeadStore();
  const channel = new MockChannel();
  const booking = new CalendlyLink("https://calendly.com/alex/strategy-call");
  const pacer = new Pacer(ZERO_DELAY);
  const orchestrator = new Orchestrator(
    scriptedBrain(decisions),
    store,
    channel,
    booking,
    pacer,
  );
  return { store, channel, orchestrator };
}

describe("Orchestrator", () => {
  it("sends the first DM on capture", async () => {
    const { store, channel, orchestrator } = harness([
      { reply: "Hey! Here's the plan 💪", stage: "Engaged", sentiment: "warm", action: "CONTINUE", reasoning: "open" },
    ]);
    await store.upsertCapture({ igHandle: "lead1", sourceContent: "FIT" });
    await orchestrator.onCapture("lead1");

    expect(channel.sent).toHaveLength(1);
    expect(channel.sent[0]!.text).toContain("plan");
    const lead = await store.getByHandle("lead1");
    expect(lead!.transcript).toHaveLength(1);
    expect(lead!.stage).toBe("Engaged");
  });

  it("appends the verified booking link (not one the model paste) on SEND_BOOKING", async () => {
    const { store, channel, orchestrator } = harness([
      { reply: "Let's hop on a quick call — grab a time?", stage: "BookingSent", sentiment: "hot", action: "SEND_BOOKING", reasoning: "ready" },
    ]);
    await store.upsertCapture({ igHandle: "lead1" });
    await store.append("lead1", { role: "lead", text: "yes please!", at: new Date().toISOString() });
    await orchestrator.onLeadMessage("lead1", "actually yes, how do I start?");

    const sent = channel.sent.at(-1)!;
    expect(sent.text).toContain("https://calendly.com/alex/strategy-call");
    const lead = await store.getByHandle("lead1");
    expect(lead!.bookingLinkSentAt).toBeDefined();
    expect(lead!.stage).toBe("BookingSent");
  });

  it("does not double-send the booking link", async () => {
    const decision: AgentDecision = { reply: "grab a time", stage: "BookingSent", sentiment: "hot", action: "SEND_BOOKING", reasoning: "x" };
    const { store, channel, orchestrator } = harness([decision, decision]);
    await store.upsertCapture({ igHandle: "lead1" });
    await orchestrator.onLeadMessage("lead1", "yes");
    await orchestrator.onLeadMessage("lead1", "ok");

    const linkCount = channel.sent.filter((m) => m.text.includes("calendly.com")).length;
    expect(linkCount).toBe(1);
  });

  it("marks the lead Lost on STOP (compliance)", async () => {
    const { store, orchestrator } = harness([
      { reply: "No worries — take care!", stage: "Engaged", sentiment: "cold", action: "STOP", reasoning: "asked to stop" },
    ]);
    await store.upsertCapture({ igHandle: "lead1" });
    await orchestrator.onLeadMessage("lead1", "stop messaging me");

    const lead = await store.getByHandle("lead1");
    expect(lead!.stage).toBe("Lost");
  });

  it("respects the daily send cap", async () => {
    const store = new MemoryLeadStore();
    const channel = new MockChannel();
    const pacer = new Pacer({ minDelaySeconds: 0, maxDelaySeconds: 0, maxMessagesPerDay: 1 });
    const orchestrator = new Orchestrator(
      scriptedBrain([
        { reply: "hi", stage: "Engaged", sentiment: "warm", action: "CONTINUE", reasoning: "x" },
      ]),
      store,
      channel,
      new CalendlyLink("https://calendly.com/alex/strategy-call"),
      pacer,
    );
    await store.upsertCapture({ igHandle: "a" });
    await store.upsertCapture({ igHandle: "b" });
    await orchestrator.onLeadMessage("a", "hi");
    await orchestrator.onLeadMessage("b", "hi");
    expect(channel.sent).toHaveLength(1); // second blocked by cap
  });
});
