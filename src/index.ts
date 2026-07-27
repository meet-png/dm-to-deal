// Load `.env` before any module that touches `process.env`. The side-effect
// import is intentional — it must run first.
import "dotenv/config";

import { seedDemoLeads } from "./api/seed.js";
import { loadEnv } from "./config/env.js";
import { buildApp } from "./factory.js";
import { loadProfile } from "./personality/loader.js";
import { startNudgeJob } from "./scheduler/nudge-job.js";
import { createServer } from "./server/app.js";
import { log } from "./lib/logger.js";

/**
 * Entrypoint. Loads + validates config, wires the app, optionally seeds demo
 * leads, and starts the server.
 *
 * The active PersonalityProfile is loaded from `DM_PROFILE_PATH` (a JSON
 * file). When unset, the loader falls back to the built-in EXAMPLE_PROFILE
 * so the demo runs with no setup. Per-influencer deploys point this at their
 * own profile file (see `profiles/example.json` as a template).
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const profile = loadProfile(env.DM_PROFILE_PATH);

  const { orchestrator, store, channel, simulator } = buildApp(env, profile);

  if (env.DM_SEED_DEMO && env.DM_STORE === "memory") {
    await seedDemoLeads(store);
    log.info("demo.seeded");
  }

  const app = createServer({
    orchestrator,
    channel,
    store,
    profile,
    simulator,
    corsOrigins: env.DM_CORS_ORIGINS.split(",").map((s) => s.trim()),
  });

  app.listen(env.PORT, () => {
    log.info("server.started", {
      port: env.PORT,
      channel: channel.name,
      store: env.DM_STORE,
      model: env.DM_MODEL,
      brain: env.ANTHROPIC_API_KEY ? "claude" : "scripted-demo",
    });
  });

  if (env.DM_NUDGE_ENABLED) {
    startNudgeJob({
      store,
      orchestrator,
      afterHours: env.DM_NUDGE_AFTER_HOURS,
      intervalMinutes: env.DM_NUDGE_INTERVAL_MINUTES,
    });
    log.info("nudge.scheduled", {
      intervalMinutes: env.DM_NUDGE_INTERVAL_MINUTES,
      afterHours: env.DM_NUDGE_AFTER_HOURS,
    });
  }
}

main().catch((err) => {
  log.error("startup.failed", {
    reason: err instanceof Error ? err.message : "unknown error",
  });
  process.exit(1);
});
