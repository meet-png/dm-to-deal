import type { Brain, BrainResult, Turn } from "./brain.js";
import type { AgentDecision } from "./decision.schema.js";
import type { Lead } from "../domain/types.js";

/**
 * A deterministic, no-API brain for the public demo + tests.
 *
 * When DM-to-Deal is deployed without an ANTHROPIC_API_KEY (so the simulator
 * is safe and free to expose publicly), this stands in for AgentBrain. It
 * walks a believable top-closer script that advances the pipeline turn by turn.
 * It never calls Claude and costs nothing.
 */
export class ScriptedBrain implements Brain {
  async run(lead: Lead, turn: Turn): Promise<BrainResult> {
    const decision = this.decide(lead, turn);
    return {
      decision,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      },
    };
  }

  private decide(lead: Lead, turn: Turn): AgentDecision {
    if (turn.kind === "open") {
      return {
        reply:
          "Hey! Just sent over the free 7-day desk-worker reset plan 🙌 What made you grab it — trying to get back on track?",
        stage: "Engaged",
        sentiment: "warm",
        action: "CONTINUE",
        reasoning: "Opening DM: deliver value + open a loop.",
      };
    }

    const last = lead.transcript.at(-1)?.text.toLowerCase() ?? "";

    if (/stop|unsubscribe|leave me/.test(last)) {
      return {
        reply: "Totally understand — I'll leave it there. Take care! 🙌",
        stage: "Lost",
        sentiment: "cold",
        action: "STOP",
        reasoning: "Lead asked to stop — honor immediately.",
      };
    }

    if (/cost|price|how much|afford/.test(last)) {
      return {
        reply:
          "Great question — it depends on what you actually need, which is exactly what the free call is for. No pitch, just a plan. Want me to send a time?",
        stage: "Objection",
        sentiment: "warm",
        action: "CONTINUE",
        reasoning: "Price objection: reframe toward the free call.",
      };
    }

    // Count agent turns so far to pace toward the booking.
    const agentTurns = lead.transcript.filter((m) => m.role === "agent").length;
    if (agentTurns >= 3 || /yes|sure|ok|sounds good|let'?s do it/.test(last)) {
      return {
        reply:
          "Love it. Let's hop on a quick 1-on-1 and map out your first 2 weeks — grab whatever time works:",
        stage: "BookingSent",
        sentiment: "hot",
        action: "SEND_BOOKING",
        reasoning: "Lead is warm and we're ~5 messages in — send the booking link.",
      };
    }

    return {
      reply:
        "Totally hear you — that's super common for desk folks. What's the part you struggle with most: time, consistency, or knowing what to do?",
      stage: "Qualifying",
      sentiment: "warm",
      action: "CONTINUE",
      reasoning: "Qualify: surface the real pain before positioning the call.",
    };
  }
}
