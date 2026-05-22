import { AgentBrain } from "./agent/brain.js";
import { CalendlyLink } from "./booking/calendly.js";
import { ManyChatChannel } from "./channels/manychat.js";
import { MockChannel } from "./channels/mock.js";
import type { Channel } from "./channels/types.js";
import { Pacer } from "./compliance/pacing.js";
import type { Env } from "./config/env.js";
import { MemoryLeadStore } from "./crm/memory-store.js";
import { SheetsLeadStore } from "./crm/sheets-store.js";
import type { LeadStore } from "./crm/types.js";
import { Orchestrator } from "./orchestrator.js";
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
      serviceAccountJsonPath: env.GOOGLE_SERVICE_ACCOUNT_JSON,
    });
  }
  return new MemoryLeadStore();
}

/** Assemble a fully-wired orchestrator + the store/channel it uses. */
export function buildApp(env: Env, profile: PersonalityProfile) {
  const store = makeStore(env);
  const channel = makeChannel(env);
  const brain = new AgentBrain(env, profile);
  const booking = new CalendlyLink(env.CALENDLY_BOOKING_URL);
  const pacer = new Pacer({
    minDelaySeconds: env.DM_MIN_REPLY_DELAY_SECONDS,
    maxDelaySeconds: env.DM_MAX_REPLY_DELAY_SECONDS,
    maxMessagesPerDay: env.DM_MAX_MESSAGES_PER_DAY,
  });
  const orchestrator = new Orchestrator(brain, store, channel, booking, pacer);
  return { orchestrator, store, channel };
}
