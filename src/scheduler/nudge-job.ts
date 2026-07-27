import type { LeadStore } from "../crm/types.js";
import type { Orchestrator } from "../orchestrator.js";
import { log } from "../lib/logger.js";

export interface NudgeJobDeps {
  store: LeadStore;
  orchestrator: Orchestrator;
  /** How stale a lead must be (in hours) before it gets a nudge. */
  afterHours: number;
  /** How often the job wakes up to scan for stale leads (in minutes). */
  intervalMinutes: number;
  /** Injectable clock for tests. */
  now?: () => Date;
}

/**
 * A single scan pass — nudges every stale, not-yet-nudged lead exactly once.
 *
 * `nudgedAt` is written BEFORE `orchestrator.onNudge` so a mid-nudge crash
 * (channel timeout, brain error) cannot cause the same lead to be nudged
 * twice on the next tick. This gives us at-most-once semantics, which is
 * what we want for account reputation.
 */
export async function nudgePass(deps: NudgeJobDeps): Promise<number> {
  const now = deps.now ?? (() => new Date());
  const cutoff = new Date(now().getTime() - deps.afterHours * 3600 * 1000);
  const stale = await deps.store.staleLeads(cutoff);

  let sent = 0;
  for (const lead of stale) {
    if (lead.nudgedAt) continue;

    lead.nudgedAt = now().toISOString();
    await deps.store.update(lead);

    try {
      await deps.orchestrator.onNudge(lead);
      sent += 1;
    } catch (err) {
      log.error("nudge.failed", {
        leadId: lead.id,
        reason: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  return sent;
}

/**
 * Start the recurring nudge scheduler. Returns a `stop()` handle that clears
 * the interval — call it during graceful shutdown or in tests.
 *
 * The first pass fires one interval tick after boot, not immediately, so the
 * server has a chance to accept traffic before any outbound sends happen.
 */
export function startNudgeJob(deps: NudgeJobDeps): () => void {
  const intervalMs = deps.intervalMinutes * 60 * 1000;
  const handle = setInterval(() => {
    nudgePass(deps).then(
      (sent) => {
        if (sent > 0) log.info("nudge.pass", { sent });
      },
      (err: unknown) => {
        log.error("nudge.pass.failed", {
          reason: err instanceof Error ? err.message : "unknown",
        });
      },
    );
  }, intervalMs);
  // Don't keep the event loop alive for the timer alone (matters for tests
  // and clean shutdowns).
  handle.unref?.();
  return () => clearInterval(handle);
}
