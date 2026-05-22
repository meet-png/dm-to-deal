import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../config/env.js";
import type { Lead, Message } from "../domain/types.js";
import type { PersonalityProfile } from "../personality/profile.js";
import { log } from "../lib/logger.js";
import {
  AGENT_DECISION_JSON_SCHEMA,
  AgentDecisionSchema,
  type AgentDecision,
} from "./decision.schema.js";
import { buildLeadContext, buildSystemPrompt } from "./prompt.js";

/** Why the brain is being invoked this turn. */
export type Turn =
  | { kind: "open" } // generate the very first DM (lead just opted in)
  | { kind: "reply" } // respond to the lead's latest message
  | { kind: "nudge" }; // lead went quiet; send one soft follow-up

export interface BrainResult {
  decision: AgentDecision;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
}

/**
 * The reasoning core. Wraps one Claude call per turn and returns a validated,
 * structured decision. The influencer's personality is sent as a cacheable
 * system prefix; per-lead context + transcript are sent as the volatile suffix.
 */
export class AgentBrain {
  private readonly client: Anthropic;
  private readonly systemPrompt: string;

  constructor(
    private readonly env: Env,
    private readonly profile: PersonalityProfile,
    client?: Anthropic,
  ) {
    this.client = client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    // Built once and reused → identical bytes every request → cache hits.
    this.systemPrompt = buildSystemPrompt(profile);
  }

  async run(lead: Lead, turn: Turn): Promise<BrainResult> {
    const userContent = this.composeUserContent(lead, turn);

    const response = await this.client.messages.create({
      model: this.env.DM_MODEL,
      max_tokens: 1024,
      ...(this.env.DM_THINKING === "adaptive"
        ? { thinking: { type: "adaptive" as const } }
        : {}),
      // Stable, large personality prompt — cached across every turn & lead.
      system: [
        {
          type: "text",
          text: this.systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        effort: this.env.DM_EFFORT,
        format: { type: "json_schema", schema: AGENT_DECISION_JSON_SCHEMA },
      },
      messages: [{ role: "user", content: userContent }],
    });

    const decision = this.parseDecision(response);

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    };
    log.debug("brain.turn", { leadId: lead.id, turn: turn.kind, usage });

    return { decision, usage };
  }

  /** Builds the volatile user turn: lead context + a directive + transcript. */
  private composeUserContent(lead: Lead, turn: Turn): string {
    const context = buildLeadContext({
      name: lead.name,
      sourceContent: lead.sourceContent,
      stage: lead.stage,
      sentiment: lead.sentiment,
    });

    const directive = this.directiveFor(turn);
    const transcript = renderTranscript(lead.transcript);

    return [context, "", directive, "", "Transcript so far:", transcript].join("\n");
  }

  private directiveFor(turn: Turn): string {
    switch (turn.kind) {
      case "open":
        return `[Task] Send the FIRST DM. Deliver ${this.profile.leadMagnet} warmly and open a loop. There is no transcript yet.`;
      case "reply":
        return `[Task] Write the next reply to the lead's most recent message below.`;
      case "nudge":
        return `[Task] The lead went quiet. Send ONE short, friendly nudge that re-opens the conversation. Set action NUDGE.`;
    }
  }

  private parseDecision(response: Anthropic.Message): AgentDecision {
    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      throw new Error("Agent returned no text block to parse a decision from.");
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text.text);
    } catch {
      throw new Error(`Agent returned non-JSON output: ${text.text.slice(0, 200)}`);
    }
    return AgentDecisionSchema.parse(raw);
  }
}

function renderTranscript(transcript: Message[]): string {
  if (transcript.length === 0) return "(none yet)";
  return transcript
    .map((m) => `${m.role === "lead" ? "Lead" : "You"}: ${m.text}`)
    .join("\n");
}
