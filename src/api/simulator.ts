import { randomBytes } from "node:crypto";
import type { LeadStore } from "../crm/types.js";
import type { Message } from "../domain/types.js";
import { log } from "../lib/logger.js";
import type { Bubble } from "./simulator/graph.js";
import { SimulatorEngine, SimulatorError } from "./simulator/engine.js";

/**
 * Public-facing simulator service.
 *
 * Two modes:
 * - **Sandboxed** (default, used by the marketing landing page) — the
 *   conversation lives entirely in the engine's in-memory session map. Lots
 *   of visitors can hammer it without polluting the real CRM.
 * - **Persisted** (opt-in, used by the operator dashboard) — every turn also
 *   writes the lead + transcript into the configured LeadStore (Sheets in
 *   prod) under a `sim_<short>` handle. The dashboard pipeline then animates
 *   in real time as the conversation advances — the "holy shit" demo moment.
 *
 * Persistence is rate-limited at the route layer (`api/routes.ts`).
 */

/** What the simulator API returns. Backwards-compatible with the old shape;
 *  new fields (`bursts`, `nodeId`, `terminal`, `intent`) are additive. */
export interface SimTurn {
  sessionId: string;
  transcript: Message[];
  stage: import("../domain/types.js").Stage;
  sentiment: import("../domain/types.js").Sentiment;
  /** New bubbles this turn, with per-bubble typing delays. The UI animates these. */
  bursts: Bubble[];
  /** Current conversation-graph node — useful for tests + UI debug overlays. */
  nodeId: string | null;
  /** Conversation has reached Booked / Lost. */
  terminal: boolean;
  /** Classified intent for the most recent lead message (null on session start). */
  intent: string | null;
  /** Echoed back so the dashboard can subscribe to this lead. */
  handle: string;
  /** Plausible quick replies the lead might send next — graph-driven and
   *  rotated per session so the rail stays fresh across runs. The UI binds
   *  directly to this; there are no hardcoded reply chips on the frontend. */
  suggestions: string[];
}

export interface SimulatorServiceOptions {
  bookingUrl: string;
  /** When provided, persisted sessions write to this store. */
  store?: LeadStore;
}

export interface StartOptions {
  /** When true, write the lead + transcript to the configured store. */
  persist?: boolean;
}

export class SimulatorService {
  private readonly engine: SimulatorEngine;
  /** sessionId → was this session persisted to the main store? */
  private readonly persisted = new Map<string, string>();

  constructor(private readonly opts: SimulatorServiceOptions) {
    this.engine = new SimulatorEngine({ bookingUrl: opts.bookingUrl });
  }

  async start(opts: StartOptions = {}): Promise<SimTurn> {
    const persist = !!(opts.persist && this.opts.store);
    const handle = persist ? makeSimHandle() : "sim_lead";
    const turn = this.engine.start(handle);

    if (persist && this.opts.store) {
      try {
        const lead = await this.opts.store.upsertCapture({
          igHandle: handle,
          sourceContent: "live simulator",
          name: undefined,
        });
        for (const m of turn.transcript) {
          await this.opts.store.append(handle, m);
        }
        lead.stage = turn.stage;
        lead.sentiment = turn.sentiment;
        await this.opts.store.update(lead);
        this.persisted.set(turn.sessionId, handle);
      } catch (err) {
        log.warn("simulator.persist.start.failed", {
          reason: err instanceof Error ? err.message : "?",
        });
      }
    }

    return toApi(turn, handle);
  }

  async send(sessionId: string, text: string): Promise<SimTurn> {
    const turn = this.engine.send(sessionId, text);
    const handle = this.persisted.get(sessionId);
    if (handle && this.opts.store) {
      try {
        // Append only the new messages this turn — lead reply + agent bubbles.
        const newMsgs = turn.transcript.slice(-(turn.bursts.length + 1));
        for (const m of newMsgs) {
          await this.opts.store.append(handle, m);
        }
        const lead = await this.opts.store.getByHandle(handle);
        if (lead) {
          lead.stage = turn.stage;
          lead.sentiment = turn.sentiment;
          await this.opts.store.update(lead);
        }
      } catch (err) {
        log.warn("simulator.persist.send.failed", {
          reason: err instanceof Error ? err.message : "?",
        });
      }
    }
    return toApi(turn, handle ?? "sim_lead");
  }
}

function toApi(
  turn: ReturnType<SimulatorEngine["start"]>,
  handle: string,
): SimTurn {
  return {
    sessionId: turn.sessionId,
    transcript: turn.transcript,
    stage: turn.stage,
    sentiment: turn.sentiment,
    bursts: turn.bursts,
    nodeId: turn.nodeId,
    terminal: turn.terminal,
    intent: turn.intent,
    handle,
    suggestions: turn.suggestions,
  };
}

/** Short, URL-safe handle for a persisted sim lead. e.g. `sim_a3b9c2` */
function makeSimHandle(): string {
  return "sim_" + randomBytes(3).toString("hex");
}

export { SimulatorError };
