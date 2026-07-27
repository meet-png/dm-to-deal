import { describe, it, expect } from "vitest";
import type { Brain, BrainResult } from "../src/agent/brain.js";
import type { AgentDecision } from "../src/agent/decision.schema.js";
import { CalendlyLink } from "../src/booking/calendly.js";
import { MockChannel } from "../src/channels/mock.js";
import { Pacer } from "../src/compliance/pacing.js";
import { MemoryLeadStore } from "../src/crm/memory-store.js";
import { Orchestrator } from "../src/orchestrator.js";
import { nudgePass } from "../src/scheduler/nudge-job.js";

const NUDGE_DECISION: AgentDecision = {
  reply: "hey — still around? no rush at all 🙂",
  stage: "Engaged",
  sentiment: "warm",
  action: "NUDGE",
  reasoning: "quiet",
};

function scriptedBrain(decisions: AgentDecision[]): Brain {
  let i = 0;
  const run = async (): Promise<BrainResult> => ({
    decision: decisions[Math.min(i++, decisions.length - 1)]!,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    },
  });
  return { run };
}

function harness() {
  const store = new MemoryLeadStore();
  const channel = new MockChannel();
  const booking = new CalendlyLink("https://calendly.com/alex/strategy-call");
  const pacer = new Pacer({ minDelaySeconds: 0, maxDelaySeconds: 0, maxMessagesPerDay: 100 });
  const orchestrator = new Orchestrator(
    scriptedBrain([NUDGE_DECISION]),
    store,
    channel,
    booking,
    pacer,
  );
  return { store, channel, orchestrator };
}

async function seedStaleLead(
  store: MemoryLeadStore,
  igHandle: string,
  hoursAgo: number,
): Promise<void> {
  await store.upsertCapture({ igHandle });
  const past = new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();
  const lead = (await store.getByHandle(igHandle))!;
  lead.stage = "Engaged";
  lead.firstContactAt = past;
  lead.lastMessageAt = past;
  await store.update(lead);
}

describe("nudgePass", () => {
  it("nudges an engaged lead that went quiet past the cutoff", async () => {
    const { store, channel, orchestrator } = harness();
    await seedStaleLead(store, "quiet_lead", 48);

    const sent = await nudgePass({ store, orchestrator, afterHours: 24, intervalMinutes: 30 });

    expect(sent).toBe(1);
    expect(channel.sent).toHaveLength(1);
    expect(channel.sent[0]!.igHandle).toBe("quiet_lead");
    const lead = await store.getByHandle("quiet_lead");
    expect(lead!.nudgedAt).toBeDefined();
  });

  it("does not re-nudge a lead that was already nudged", async () => {
    const { store, channel, orchestrator } = harness();
    await seedStaleLead(store, "quiet_lead", 48);
    const lead = (await store.getByHandle("quiet_lead"))!;
    lead.nudgedAt = new Date().toISOString();
    // Roll lastMessageAt back so staleLeads still returns it — proves the
    // dedupe uses nudgedAt, not just the staleness window.
    lead.lastMessageAt = new Date(Date.now() - 72 * 3600 * 1000).toISOString();
    await store.update(lead);

    const sent = await nudgePass({ store, orchestrator, afterHours: 24, intervalMinutes: 30 });

    expect(sent).toBe(0);
    expect(channel.sent).toHaveLength(0);
  });

  it("skips leads whose last message is inside the cutoff window", async () => {
    const { store, channel, orchestrator } = harness();
    await seedStaleLead(store, "recent_lead", 2); // 2h ago — inside 24h window

    const sent = await nudgePass({ store, orchestrator, afterHours: 24, intervalMinutes: 30 });

    expect(sent).toBe(0);
    expect(channel.sent).toHaveLength(0);
  });

  it("skips leads in closed stages (Won, Lost)", async () => {
    const { store, channel, orchestrator } = harness();
    await seedStaleLead(store, "won_lead", 100);
    const lead = (await store.getByHandle("won_lead"))!;
    lead.stage = "Won";
    await store.update(lead);

    const sent = await nudgePass({ store, orchestrator, afterHours: 24, intervalMinutes: 30 });

    expect(sent).toBe(0);
    expect(channel.sent).toHaveLength(0);
  });

  it("sets nudgedAt BEFORE the nudge fires (at-most-once semantics on crash)", async () => {
    // If orchestrator.onNudge throws, nudgedAt should still be set — so the
    // next pass doesn't retry and spam the lead.
    const store = new MemoryLeadStore();
    await seedStaleLead(store, "quiet_lead", 48);

    const crashingOrchestrator = {
      onNudge: async () => {
        throw new Error("channel timeout");
      },
    } as unknown as Orchestrator;

    const sent = await nudgePass({
      store,
      orchestrator: crashingOrchestrator,
      afterHours: 24,
      intervalMinutes: 30,
    });

    expect(sent).toBe(0);
    const lead = await store.getByHandle("quiet_lead");
    expect(lead!.nudgedAt).toBeDefined();
  });

  it("nudges multiple stale leads in a single pass", async () => {
    const { store, channel, orchestrator } = harness();
    await seedStaleLead(store, "lead_a", 30);
    await seedStaleLead(store, "lead_b", 48);
    await seedStaleLead(store, "lead_c", 72);

    const sent = await nudgePass({ store, orchestrator, afterHours: 24, intervalMinutes: 30 });

    expect(sent).toBe(3);
    expect(channel.sent).toHaveLength(3);
  });
});
