import { randomUUID } from "node:crypto";
import type { Brain } from "../agent/brain.js";
import { CalendlyLink } from "../booking/calendly.js";
import { MockChannel } from "../channels/mock.js";
import { Pacer } from "../compliance/pacing.js";
import { MemoryLeadStore } from "../crm/memory-store.js";
import type { Lead, Message } from "../domain/types.js";
import { Orchestrator } from "../orchestrator.js";

export interface SimTurn {
  sessionId: string;
  transcript: Message[];
  stage: Lead["stage"];
  sentiment: Lead["sentiment"];
}

/**
 * Drives the in-browser simulator. Each session is a throwaway in-memory
 * conversation (its own store + mock channel + zero-delay pacer) so a visitor
 * can chat with the agent and watch the pipeline advance in real time.
 *
 * SECURITY: sessions are capped and expire, so a public endpoint can't be used
 * to exhaust memory. The brain it uses is whatever the server injected —
 * scripted (free) when no API key is configured.
 */
export class SimulatorService {
  private readonly sessions = new Map<string, { lead: Lead; orch: Orchestrator; store: MemoryLeadStore; channel: MockChannel; createdAt: number }>();
  private readonly maxSessions = 200;
  private readonly handle = "sim_lead";

  constructor(
    private readonly brain: Brain,
    private readonly bookingUrl: string,
  ) {}

  /** Start a new conversation; the agent opens with the first DM. */
  async start(): Promise<SimTurn> {
    this.evictIfNeeded();
    const sessionId = randomUUID();
    const store = new MemoryLeadStore();
    const channel = new MockChannel();
    const pacer = new Pacer({ minDelaySeconds: 0, maxDelaySeconds: 0, maxMessagesPerDay: 1000 });
    const orch = new Orchestrator(this.brain, store, channel, new CalendlyLink(this.bookingUrl), pacer);

    const lead = await store.upsertCapture({ igHandle: this.handle, sourceContent: "Comment FIT reel" });
    await orch.onCapture(this.handle);

    this.sessions.set(sessionId, { lead, orch, store, channel, createdAt: Date.now() });
    return this.snapshot(sessionId, lead);
  }

  /** Send a lead message into an existing session and get the agent's reply. */
  async send(sessionId: string, text: string): Promise<SimTurn> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new SimulatorError("unknown or expired session");

    await session.orch.onLeadMessage(this.handle, text);
    const lead = (await session.store.getByHandle(this.handle))!;
    return this.snapshot(sessionId, lead);
  }

  private snapshot(sessionId: string, lead: Lead): SimTurn {
    return {
      sessionId,
      transcript: lead.transcript,
      stage: lead.stage,
      sentiment: lead.sentiment,
    };
  }

  /** Drop the oldest sessions once we hit the cap (anti-DoS). */
  private evictIfNeeded(): void {
    if (this.sessions.size < this.maxSessions) return;
    const oldest = [...this.sessions.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    )[0];
    if (oldest) this.sessions.delete(oldest[0]);
  }
}

export class SimulatorError extends Error {}
