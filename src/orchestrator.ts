import type { Brain, Turn } from "./agent/brain.js";
import type { AgentDecision } from "./agent/decision.schema.js";
import type { BookingProvider } from "./booking/calendly.js";
import type { Channel } from "./channels/types.js";
import type { Pacer } from "./compliance/pacing.js";
import type { LeadStore } from "./crm/types.js";
import type { Lead } from "./domain/types.js";
import { log } from "./lib/logger.js";

/**
 * The orchestrator runs the agent loop on a single inbound event:
 *   capture/reply  →  brain decides  →  pace  →  send  →  persist.
 *
 * It owns the policy glue (booking-link injection, STOP handling, stage
 * transitions) and keeps the brain, store, channel, and pacer decoupled.
 */
export class Orchestrator {
  constructor(
    private readonly brain: Brain,
    private readonly store: LeadStore,
    private readonly channel: Channel,
    private readonly booking: BookingProvider,
    private readonly pacer: Pacer,
  ) {}

  /** A brand-new lead opted in — generate and send the first DM. */
  async onCapture(igHandle: string): Promise<void> {
    const lead = await this.store.getByHandle(igHandle);
    if (!lead) throw new Error(`onCapture: unknown handle ${igHandle}`);
    if (lead.transcript.length > 0) return; // already engaged — idempotent
    await this.runTurn(lead, { kind: "open" });
  }

  /** The lead replied — record it, let the agent respond. */
  async onLeadMessage(igHandle: string, text: string): Promise<void> {
    const lead = await this.store.getByHandle(igHandle);
    if (!lead) {
      log.warn("orchestrator.message.unknownLead", { igHandle });
      return;
    }
    await this.store.append(igHandle, { role: "lead", text, at: nowIso() });
    if (lead.stage === "Lost" || lead.stage === "Won") return; // conversation closed
    await this.runTurn(lead, { kind: "reply" });
  }

  /** Re-engage a lead that went quiet (one soft nudge). */
  async onNudge(lead: Lead): Promise<void> {
    await this.runTurn(lead, { kind: "nudge" });
  }

  /** Shared pipeline for every agent turn. */
  private async runTurn(lead: Lead, turn: Turn): Promise<void> {
    if (!this.pacer.canSendToday()) {
      log.warn("orchestrator.dailyCapReached", { sent: this.pacer.sentToday() });
      return; // protect the account; reply later
    }

    const { decision } = await this.brain.run(lead, turn);

    // Build the outgoing text. The agent never pastes the link itself — we
    // append the verified booking URL, so a prompt-injected URL can't slip out.
    let text = decision.reply.trim();
    if (decision.action === "SEND_BOOKING" && !lead.bookingLinkSentAt) {
      text = `${text}\n\n${this.booking.bookingUrl()}`;
    }

    // Human-like delay before sending (skipped if delay is 0, e.g. in tests).
    const delay = this.pacer.nextDelayMs();
    if (delay > 0) await sleep(delay);

    await this.channel.send({ igHandle: lead.igHandle, text });
    this.pacer.recordSend();

    await this.store.append(lead.igHandle, { role: "agent", text, at: nowIso() });
    await this.applyDecision(lead, decision);

    log.info("orchestrator.turn", {
      leadId: lead.id,
      action: decision.action,
      stage: decision.stage,
      reasoning: decision.reasoning,
    });
  }

  /** Persist stage/sentiment changes, booking bookkeeping, and brain-derived
   *  deal intelligence (coreInsight / recommendedAction / priority) so the
   *  dashboard's lead cards reflect the latest read on the lead. */
  private async applyDecision(lead: Lead, decision: AgentDecision): Promise<void> {
    const { stage, action } = decision;
    lead.stage = action === "MARK_LOST" ? "Lost" : action === "STOP" ? "Lost" : stage;
    if (action === "SEND_BOOKING" && !lead.bookingLinkSentAt) {
      lead.bookingLinkSentAt = nowIso();
      if (lead.stage !== "Booked") lead.stage = "BookingSent";
    }
    // Only overwrite intelligence fields when the brain actually emitted them,
    // so scripted/older brains that omit them don't erase a prior turn's read.
    if (decision.coreInsight !== undefined) lead.coreInsight = decision.coreInsight;
    if (decision.recommendedAction !== undefined) lead.recommendedAction = decision.recommendedAction;
    if (decision.priority !== undefined) lead.priority = decision.priority;
    await this.store.update(lead);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
