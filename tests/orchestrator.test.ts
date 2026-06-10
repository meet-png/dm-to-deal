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

  it("persists brain-derived intelligence (coreInsight / recommendedAction / priority) via store.update", async () => {
    const decision: AgentDecision = {
      reply: "totally hear you — the call is free either way",
      stage: "Objection",
      sentiment: "warm",
      action: "CONTINUE",
      reasoning: "soften pricing concern",
      coreInsight: "mentioned cost twice in 60s",
      recommendedAction: "send case study, skip pitch",
      priority: "high",
    };

    const store = new MemoryLeadStore();
    const channel = new MockChannel();
    const booking = new CalendlyLink("https://calendly.com/alex/strategy-call");
    const pacer = new Pacer(ZERO_DELAY);

    // Spy on update — assert the lead handed to the store carries the brain's
    // intelligence verbatim by the time it lands.
    const realUpdate = store.update.bind(store);
    const calls: Array<{
      coreInsight: string | undefined;
      recommendedAction: string | undefined;
      priority: string | undefined;
    }> = [];
    store.update = async (lead) => {
      calls.push({
        coreInsight: lead.coreInsight,
        recommendedAction: lead.recommendedAction,
        priority: lead.priority,
      });
      return realUpdate(lead);
    };

    const orchestrator = new Orchestrator(scriptedBrain([decision]), store, channel, booking, pacer);
    await store.upsertCapture({ igHandle: "lead1" });
    await orchestrator.onLeadMessage("lead1", "I'm interested but coaching is way out of my budget rn");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      coreInsight: "mentioned cost twice in 60s",
      recommendedAction: "send case study, skip pitch",
      priority: "high",
    });

    // And the persisted lead reflects the same — i.e. the store round-trip works.
    const persisted = await store.getByHandle("lead1");
    expect(persisted?.coreInsight).toBe("mentioned cost twice in 60s");
    expect(persisted?.recommendedAction).toBe("send case study, skip pitch");
    expect(persisted?.priority).toBe("high");
  });

  it("leaves prior intelligence intact when a brain turn omits the new fields", async () => {
    // Scripted brains (no API key) don't emit intelligence — make sure the
    // orchestrator doesn't blow away a previous turn's read in that case.
    const decision: AgentDecision = {
      reply: "got it!",
      stage: "Engaged",
      sentiment: "warm",
      action: "CONTINUE",
      reasoning: "x",
    };
    const { store, orchestrator } = harness([decision]);
    await store.upsertCapture({ igHandle: "lead1" });
    const lead = (await store.getByHandle("lead1"))!;
    lead.coreInsight = "previous read";
    lead.recommendedAction = "previous action";
    lead.priority = "medium";
    await store.update(lead);

    await orchestrator.onLeadMessage("lead1", "ok");

    const after = await store.getByHandle("lead1");
    expect(after?.coreInsight).toBe("previous read");
    expect(after?.recommendedAction).toBe("previous action");
    expect(after?.priority).toBe("medium");
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
