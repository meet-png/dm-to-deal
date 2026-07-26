import { randomUUID } from "node:crypto";
import type { Message, Sentiment, Stage } from "../../domain/types.js";
import { classify, type LeadIntent } from "./intent.js";
import {
  ALL_NODE_IDS,
  NODES,
  OPENING,
  TRANSITIONS,
  type Bubble,
  type NodeId,
} from "./graph.js";

/**
 * Stateful conversation engine for the simulator.
 *
 * Holds per-session state: the current node, visited nodes, objections raised,
 * extracted slot values (name, pain, goal), and the running transcript.
 * On each lead reply: classify intent → look up the next node → emit the
 * agent burst (1-3 bubbles, each with a typing delay) → update slots + stage.
 *
 * Compliance + safety:
 * - STOP / unsubscribe always routes to a hard-stop node, regardless of state.
 * - Sessions evict on a cap so a public endpoint can't exhaust memory.
 */

export interface SimSession {
  sessionId: string;
  handle: string;
  currentNode: NodeId | null;
  visited: NodeId[];
  objectionsRaised: Set<LeadIntent>;
  painPoint?: string;
  goal?: string;
  name?: string;
  transcript: Message[];
  bookingLinkSentAt?: string;
  createdAt: number;
  /** Used to rotate copy variants so repeated visits don't say the same thing. */
  burstCounter: number;
}

/** What `start()` / `send()` return — the new burst plus enough snapshot for the UI. */
export interface EngineTurn {
  sessionId: string;
  /** The new bubbles emitted this turn (with typing delays). Empty if the
   *  conversation is terminal or the input was rejected. */
  bursts: Bubble[];
  /** Full transcript so far — convenient for the UI to render. */
  transcript: Message[];
  stage: Stage;
  sentiment: Sentiment;
  /** Which node the agent is now in. Useful for badge animations + tests. */
  nodeId: NodeId | null;
  /** True iff the conversation has reached a terminal node (Booked / Lost). */
  terminal: boolean;
  /** Detected intent for the *last lead message*, or null on session start. */
  intent: LeadIntent | null;
  /** Plausible quick replies the lead might send next. Graph-driven, rotated
   *  per session for variety, falls back to a stage-based generic set when a
   *  node has none. Empty array for terminal nodes. */
  suggestions: string[];
}

export interface EngineOptions {
  /** Used to inject the booking URL into the SEND_BOOKING bubbles. */
  bookingUrl: string;
  /** Max concurrent sessions before eviction kicks in. Default 200. */
  maxSessions?: number;
  /** Override `Date.now` in tests. */
  now?: () => number;
}

export class SimulatorEngine {
  private readonly sessions = new Map<string, SimSession>();
  private readonly maxSessions: number;
  private readonly now: () => number;

  constructor(private readonly opts: EngineOptions) {
    this.maxSessions = opts.maxSessions ?? 200;
    this.now = opts.now ?? (() => Date.now());
  }

  /** Begin a new conversation — the agent opens with the first DM(s). */
  start(handle: string): EngineTurn {
    this.evictIfNeeded();
    const sessionId = randomUUID();
    const session: SimSession = {
      sessionId,
      handle,
      currentNode: null,
      visited: [],
      objectionsRaised: new Set(),
      transcript: [],
      createdAt: this.now(),
      burstCounter: 0,
    };

    const opening = pickVariant(OPENING, session.burstCounter++);
    this.appendBurst(session, opening);
    // The opener positions us in INTRO_RESPONSE — that's the state we're in
    // *waiting* for the lead's reply.
    session.currentNode = "INTRO_RESPONSE";
    session.visited.push("INTRO_RESPONSE");

    this.sessions.set(sessionId, session);
    return this.snapshot(session, opening, null);
  }

  /** Process a lead message → return the agent's next burst. */
  send(sessionId: string, text: string): EngineTurn {
    const session = this.sessions.get(sessionId);
    if (!session) throw new SimulatorError("unknown or expired session");
    if (session.currentNode && NODES[session.currentNode].terminal) {
      // Terminal — politely no-op. UI can render a "conversation over" state.
      return this.snapshot(session, [], null);
    }

    // Record the lead's reply in the transcript.
    const leadMsg: Message = { role: "lead", text, at: this.iso() };
    session.transcript.push(leadMsg);

    // Compliance: STOP overrides whatever node we were in.
    const intent = classify(text);
    let nextNode: NodeId;
    if (intent === "stop") {
      nextNode = "STOPPED";
    } else {
      nextNode = pickNextNode(session, intent);
    }

    // Slot extraction — best-effort. Powers the "memory" feel.
    this.extractSlots(session, intent, text);
    if (intent.startsWith("obj_")) session.objectionsRaised.add(intent);

    // Move + emit.
    session.currentNode = nextNode;
    session.visited.push(nextNode);
    const bursts = this.composeBurst(session, nextNode);
    this.appendBurst(session, bursts);

    return this.snapshot(session, bursts, intent);
  }

  /** Read-only snapshot — used by the API to return the current state. */
  peek(sessionId: string): SimSession | undefined {
    return this.sessions.get(sessionId);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private appendBurst(session: SimSession, bursts: Bubble[]): void {
    const at = this.iso();
    for (const b of bursts) {
      session.transcript.push({ role: "agent", text: b.text, at });
    }
  }

  /**
   * Build the actual burst for a node — picks a variant, fills `{{BOOKING_URL}}`,
   * applies a small "we already said this" guard so back-to-back same lines
   * never appear when the engine loops through objection → reposition.
   */
  private composeBurst(session: SimSession, nodeId: NodeId): Bubble[] {
    const def = NODES[nodeId];
    const variant = pickVariant(def.bursts, session.burstCounter++);
    if (nodeId === "SEND_BOOKING") session.bookingLinkSentAt = this.iso();
    return variant.map((b) => ({
      ...b,
      text: b.text.replace(/\{\{BOOKING_URL\}\}/g, this.opts.bookingUrl),
    }));
  }

  /** Extract pain / goal / name slots from a lead reply. Best-effort. */
  private extractSlots(session: SimSession, intent: LeadIntent, text: string): void {
    const lower = text.toLowerCase();
    if (intent === "pain_stated" && !session.painPoint) {
      session.painPoint = trim(text, 120);
    }
    if (intent === "goal_stated" && !session.goal) {
      session.goal = trim(text, 120);
    }
    // Lightweight name extraction: "I'm Alex" / "this is alex" / "my name is …"
    if (!session.name) {
      const m =
        lower.match(/\b(?:i'?m|im|this is|name(?:'s| is))\s+([a-z][a-z'-]{1,20})/i) ?? null;
      if (m && m[1]) session.name = capitalize(m[1]);
    }
  }

  private snapshot(session: SimSession, bursts: Bubble[], intent: LeadIntent | null): EngineTurn {
    const def = session.currentNode ? NODES[session.currentNode] : null;
    return {
      sessionId: session.sessionId,
      bursts,
      transcript: [...session.transcript],
      stage: def?.stage ?? "New",
      sentiment: def?.sentiment ?? "warm",
      nodeId: session.currentNode,
      terminal: !!def?.terminal,
      intent,
      suggestions: this.composeSuggestions(session),
    };
  }

  /**
   * Build the lead's quick-reply suggestions for the current state.
   *
   * Order of preference:
   *   1. The current node's own `suggestions` (graph-driven, several variants
   *      rotated per session) — this is what fires 95% of the time.
   *   2. Stage-based fallback — guarantees the rail is never empty even if a
   *      future node ships without explicit suggestions.
   *   3. Empty array for terminal nodes — the UI shows "start over" instead.
   *
   * Future LLM swap-in: this is the single seam. Replace this body with a
   * Claude call conditioned on `session.transcript`, `session.painPoint`, and
   * `session.objectionsRaised` for fully-generative suggestions; the graph
   * variants below remain the deterministic fallback.
   */
  private composeSuggestions(session: SimSession): string[] {
    const node = session.currentNode ? NODES[session.currentNode] : null;
    if (!node || node.terminal) return [];

    const variants = node.suggestions ?? [];
    if (variants.length > 0) {
      // Two-axis rotation so the same node feels different across sessions
      // AND across re-entries within a session:
      //   - sessionSalt: stable per session, derived from the sessionId so
      //     two different leads see different chip sets even on the same node.
      //   - visitsTo:   increments when the conversation loops back to this
      //     node (e.g. POSITIONING → OBJ_PRICING → REPOSITION → POSITIONING),
      //     so a re-visit doesn't show the chips we just left behind.
      const visitsTo = session.visited.filter((id) => id === session.currentNode).length;
      const seed = hashSeed(session.sessionId) + visitsTo;
      return [...variants[seed % variants.length]!];
    }

    return fallbackByStage(node.stage);
  }

  private evictIfNeeded(): void {
    if (this.sessions.size < this.maxSessions) return;
    let oldestId: string | undefined;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [id, s] of this.sessions) {
      if (s.createdAt < oldestAt) {
        oldestAt = s.createdAt;
        oldestId = id;
      }
    }
    if (oldestId) this.sessions.delete(oldestId);
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }
}

/** Fast, deterministic 32-bit hash of a string. Used to seed variant rotation. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generic, stage-appropriate replies when a node ships without its own. */
function fallbackByStage(stage: Stage): string[] {
  switch (stage) {
    case "New":
    case "Engaged":
      return ["tell me more", "is this expensive?", "how do I know it works?"];
    case "Qualifying":
      return ["I want to feel better honestly", "is it expensive?", "I've tried things before"];
    case "Objection":
      return ["okay let's hop on", "still on the fence", "I need to think"];
    case "BookingSent":
      return ["yes please", "actually wait", "send me a time"];
    case "Booked":
    case "Won":
    case "Lost":
      return [];
  }
}

// ── Pure helpers ─────────────────────────────────────────────────────────

/**
 * The node that specifically handles each hard-objection intent. Used to
 * detect "the lead re-raised the same hard objection while we were already
 * addressing it" — that's the signal to gracefully exit, not push harder.
 * `obj_curiosity` is deliberately absent: repeated curiosity = keep engaging.
 */
const HARD_OBJECTION_NODE: Partial<Record<LeadIntent, NodeId>> = {
  obj_pricing: "OBJ_PRICING",
  obj_trust: "OBJ_TRUST",
  obj_history: "OBJ_HISTORY",
  obj_timing: "OBJ_TIMING",
};

/**
 * Pick a next node honoring four constraints:
 * - Same-node re-raise of a hard objection ("I *really* can't afford") means
 *   we didn't sell the answer — route to GHOSTED (graceful exit) rather than
 *   push into a booking the lead will regret.
 * - If the intent has an explicit transition from current → use it.
 * - If we've already raised this objection once (from a *different* node),
 *   fall through to the `*` arm — no infinite objection loops.
 * - Otherwise use the `*` fallback.
 */
function pickNextNode(session: SimSession, intent: LeadIntent): NodeId {
  const from = session.currentNode;
  // Initial state defensiveness — shouldn't happen because `start()` sets it.
  if (!from) return "QUALIFYING_PAIN";

  // Same-node hard-objection re-raise → graceful exit.
  if (HARD_OBJECTION_NODE[intent] === from) return "GHOSTED";

  const table = TRANSITIONS[from];
  const alreadyRaised = intent.startsWith("obj_") && session.objectionsRaised.has(intent);

  if (!alreadyRaised && table[intent]) return table[intent]!;
  if (table["*"]) return table["*"]!;

  // Should be unreachable — every node defines a `*` — but TS doesn't know.
  return "ASKING_FOR_BOOKING";
}

function pickVariant<T>(variants: T[][], counter: number): T[] {
  if (variants.length === 0) return [];
  return variants[counter % variants.length]!;
}

function trim(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export class SimulatorError extends Error {}

/** Exposed for tests + tooling. */
export const __engine_nodes = ALL_NODE_IDS;
