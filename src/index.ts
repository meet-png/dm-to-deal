// Load `.env` before any module that touches `process.env`. The side-effect
// import is intentional — it must run first.
import "dotenv/config";

import { seedDemoLeads } from "./api/seed.js";
import { loadEnv } from "./config/env.js";
import { buildApp } from "./factory.js";
import { EXAMPLE_PROFILE } from "./personality/profile.js";
import { createServer } from "./server/app.js";
import { log } from "./lib/logger.js";

/**
 * Entrypoint. Loads + validates config, wires the app, optionally seeds demo
 * leads, and starts the server.
 *
 * The active personality profile is the example for now; in a multi-tenant
 * deployment this is loaded per connected account (see docs/ROADMAP.md).
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const profile = EXAMPLE_PROFILE;

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
}

main().catch((err) => {
  log.error("startup.failed", {
    reason: err instanceof Error ? err.message : "unknown error",
  });
  process.exit(1);
});
