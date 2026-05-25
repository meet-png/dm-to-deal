import { AgentBrain, type Brain } from "./agent/brain.js";
import { ScriptedBrain } from "./agent/scripted-brain.js";
import { CalendlyLink } from "./booking/calendly.js";
import { log } from "./lib/logger.js";
import { ManyChatChannel } from "./channels/manychat.js";
import { MockChannel } from "./channels/mock.js";
import type { Channel } from "./channels/types.js";
import { Pacer } from "./compliance/pacing.js";
import type { Env } from "./config/env.js";
import { MemoryLeadStore } from "./crm/memory-store.js";
import { SheetsLeadStore } from "./crm/sheets-store.js";
import type { LeadStore } from "./crm/types.js";
import { Orchestrator } from "./orchestrator.js";
import { SimulatorService } from "./api/simulator.js";
import type { PersonalityProfile } from "./personality/profile.js";

/** Build a channel from config. Validates required secrets per provider. */
export function makeChannel(env: Env): Channel {
  if (env.DM_CHANNEL === "manychat") {
    if (!env.MANYCHAT_API_TOKEN || !env.MANYCHAT_WEBHOOK_SECRET) {
      throw new Error(
        "DM_CHANNEL=manychat requires MANYCHAT_API_TOKEN and MANYCHAT_WEBHOOK_SECRET",
      );
    }
    return new ManyChatChannel({
      apiToken: env.MANYCHAT_API_TOKEN,
      webhookSecret: env.MANYCHAT_WEBHOOK_SECRET,
    });
  }
  return new MockChannel();
}

/** Build a lead store from config. */
export function makeStore(env: Env): LeadStore {
  if (env.DM_STORE === "sheets") {
    if (!env.GOOGLE_SHEETS_ID || !env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error(
        "DM_STORE=sheets requires GOOGLE_SHEETS_ID and GOOGLE_SERVICE_ACCOUNT_JSON",
      );
    }
    return new SheetsLeadStore({
      spreadsheetId: env.GOOGLE_SHEETS_ID,
      serviceAccountSource: env.GOOGLE_SERVICE_ACCOUNT_JSON,
    });
  }
  return new MemoryLeadStore();
}

/**
 * Build the reasoning brain. With an API key → the real Claude brain.
 * Without one → the scripted demo brain (no calls, no cost) so the simulator
 * is safe to deploy publicly.
 */
export function makeBrain(env: Env, profile: PersonalityProfile): Brain {
  if (env.ANTHROPIC_API_KEY) return new AgentBrain(env, profile);
  log.warn("brain.demoMode", {
    reason: "ANTHROPIC_API_KEY not set — using scripted demo brain",
  });
  return new ScriptedBrain();
}

/** Assemble a fully-wired orchestrator + the store/channel/simulator it uses. */
export function buildApp(env: Env, profile: PersonalityProfile) {
  const store = makeStore(env);
  const channel = makeChannel(env);
  const brain = makeBrain(env, profile);
  const booking = new CalendlyLink(env.CALENDLY_BOOKING_URL);
  const pacer = new Pacer({
    minDelaySeconds: env.DM_MIN_REPLY_DELAY_SECONDS,
    maxDelaySeconds: env.DM_MAX_REPLY_DELAY_SECONDS,
    maxMessagesPerDay: env.DM_MAX_MESSAGES_PER_DAY,
  });
  const orchestrator = new Orchestrator(brain, store, channel, booking, pacer);
  // The simulator runs its own graph-based engine (deterministic, key-less) —
  // it doesn't share the brain. Passing `store` here lets the operator
  // dashboard's "live conversation" feature persist sim leads in real time.
  const simulator = new SimulatorService({
    bookingUrl: env.CALENDLY_BOOKING_URL,
    store,
  });
  return { orchestrator, store, channel, simulator };
}
