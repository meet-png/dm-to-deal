import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { computeMetrics } from "../analytics/metrics.js";
import type { LeadStore } from "../crm/types.js";
import type { PersonalityProfile } from "../personality/profile.js";
import { log } from "../lib/logger.js";
import { SimulatorError, type SimulatorService } from "./simulator.js";

export interface ApiDeps {
  store: LeadStore;
  profile: PersonalityProfile;
  simulator: SimulatorService;
  /** All leads for metrics/list — memory store exposes them via staleLeads trick;
   * we pass a snapshot getter so the API never reaches into store internals. */
  listLeads: () => Promise<import("../domain/types.js").Lead[]>;
}

const SimMessageSchema = z.object({
  sessionId: z.string().uuid(),
  text: z.string().min(1).max(2000),
});

/**
 * Read + simulate API consumed by the dashboard. Read endpoints are safe to
 * expose; the simulate endpoints are validated and rate-limited (anti-abuse).
 */
export function createApiRouter(deps: ApiDeps): Router {
  const router = Router();
  const simLimiter = makeRateLimiter({ windowMs: 60_000, max: 30 });

  router.get("/metrics", async (_req, res) => {
    const leads = await deps.listLeads();
    res.json(computeMetrics(leads));
  });

  router.get("/leads", async (_req, res) => {
    const leads = await deps.listLeads();
    res.json(
      leads
        .map((l) => ({
          id: l.id,
          igHandle: l.igHandle,
          name: l.name ?? null,
          sourceContent: l.sourceContent ?? null,
          stage: l.stage,
          sentiment: l.sentiment,
          lastMessageAt: l.lastMessageAt,
          messageCount: l.transcript.length,
          revenue: l.revenue ?? null,
        }))
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)),
    );
  });

  router.get("/leads/:handle", async (req: Request, res: Response) => {
    const lead = await deps.store.getByHandle(String(req.params.handle));
    if (!lead) return res.status(404).json({ error: "not found" });
    res.json(lead);
  });

  router.get("/profile", (_req, res) => {
    res.json(deps.profile);
  });

  router.post("/simulate/start", simLimiter, async (_req, res) => {
    const turn = await deps.simulator.start();
    res.json(turn);
  });

  router.post("/simulate/message", simLimiter, async (req: Request, res: Response) => {
    const parsed = SimMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid request" });
    try {
      const turn = await deps.simulator.send(parsed.data.sessionId, parsed.data.text);
      res.json(turn);
    } catch (err) {
      if (err instanceof SimulatorError) {
        return res.status(404).json({ error: "session expired — start a new one" });
      }
      log.error("simulate.failed", { reason: err instanceof Error ? err.message : "?" });
      res.status(500).json({ error: "simulation failed" });
    }
  });

  return router;
}

/** Fixed-window per-IP limiter (shared shape with the webhook route). */
function makeRateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: () => void) => {
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= max) return void res.status(429).json({ error: "rate limited" });
    entry.count += 1;
    next();
  };
}
