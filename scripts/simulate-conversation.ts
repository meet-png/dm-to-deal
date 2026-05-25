/**
 * Local end-to-end simulator. Runs a full lead conversation through the real
 * agent brain (live Claude call) but with the Mock channel + in-memory store,
 * so you can watch DM-to-Deal work without ManyChat/Sheets.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run simulate
 *
 * The "lead" replies are scripted to mimic a warm fitness prospect.
 */
import "dotenv/config";

import { AgentBrain } from "../src/agent/brain.js";
import { CalendlyLink } from "../src/booking/calendly.js";
import { MockChannel } from "../src/channels/mock.js";
import { Pacer } from "../src/compliance/pacing.js";
import { loadEnv } from "../src/config/env.js";
import { MemoryLeadStore } from "../src/crm/memory-store.js";
import { Orchestrator } from "../src/orchestrator.js";
import { EXAMPLE_PROFILE } from "../src/personality/profile.js";

const SCRIPTED_LEAD_REPLIES = [
  "hey yeah I commented FIT",
  "honestly I sit at a desk 10 hrs a day and I'm so out of shape",
  "I've tried programs before but I always quit after 2 weeks",
  "how much does the coaching cost though?",
  "ok yeah a free call sounds good actually",
];

async function main(): Promise<void> {
  // No-delay pacer so the demo runs instantly (production uses 2-8 min delays).
  const env = { ...loadEnv(), DM_MIN_REPLY_DELAY_SECONDS: 0, DM_MAX_REPLY_DELAY_SECONDS: 0 };

  const store = new MemoryLeadStore();
  const channel = new MockChannel();
  const brain = new AgentBrain(env, EXAMPLE_PROFILE);
  const pacer = new Pacer({ minDelaySeconds: 0, maxDelaySeconds: 0, maxMessagesPerDay: 100 });
  const orchestrator = new Orchestrator(
    brain,
    store,
    channel,
    new CalendlyLink(env.CALENDLY_BOOKING_URL),
    pacer,
  );

  const handle = "demo_lead";
  await store.upsertCapture({ igHandle: handle, sourceContent: "Comment FIT reel" });

  console.log("\n=== DM-to-Deal conversation simulation ===\n");
  await orchestrator.onCapture(handle);
  printLast(channel, "AGENT");

  for (const reply of SCRIPTED_LEAD_REPLIES) {
    console.log(`LEAD:  ${reply}`);
    await orchestrator.onLeadMessage(handle, reply);
    printLast(channel, "AGENT");
  }

  const lead = await store.getByHandle(handle);
  console.log(`\n=== Final stage: ${lead?.stage} | sentiment: ${lead?.sentiment} ===\n`);
}

function printLast(channel: MockChannel, label: string): void {
  const last = channel.sent.at(-1);
  if (last) console.log(`${label}: ${last.text}\n`);
}

main().catch((err) => {
  console.error("Simulation failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
