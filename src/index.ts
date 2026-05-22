import { loadEnv } from "./config/env.js";
import { buildApp } from "./factory.js";
import { EXAMPLE_PROFILE } from "./personality/profile.js";
import { createServer } from "./server/app.js";
import { log } from "./lib/logger.js";

/**
 * Entrypoint. Loads + validates config, wires the app, and starts the server.
 *
 * The active personality profile is hard-coded to the example for now; in a
 * multi-tenant deployment this is loaded per connected account (see ROADMAP).
 */
function main(): void {
  const env = loadEnv();
  const profile = EXAMPLE_PROFILE;

  const { orchestrator, store, channel } = buildApp(env, profile);
  const app = createServer({ orchestrator, store, channel });

  app.listen(env.PORT, () => {
    log.info("server.started", {
      port: env.PORT,
      channel: channel.name,
      store: env.DM_STORE,
      model: env.DM_MODEL,
    });
  });
}

try {
  main();
} catch (err) {
  log.error("startup.failed", {
    reason: err instanceof Error ? err.message : "unknown error",
  });
  process.exit(1);
}
