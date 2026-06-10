import { z } from "zod";
import { ACTIONS, PRIORITIES, SENTIMENTS, STAGES } from "../domain/types.js";

/**
 * The structured output the agent must return for every turn.
 *
 * We force Claude to emit exactly this shape via `output_config.format`
 * (structured outputs), so the orchestrator never has to parse free text.
 * The `reply` is what the lead sees; everything else drives the pipeline.
 */
export const AgentDecisionSchema = z.object({
  /** The message to send to the lead, in the influencer's voice (2-3 lines). */
  reply: z.string(),
  /** Updated pipeline stage after this turn. */
  stage: z.enum(STAGES),
  /** The agent's read on the lead right now. */
  sentiment: z.enum(SENTIMENTS),
  /** What the system should do with this turn. */
  action: z.enum(ACTIONS),
  /** One short line of private reasoning (logged, never sent to the lead). */
  reasoning: z.string(),
  /** A specific behavioral observation in plain operator language. Optional —
   *  older brains or scripted brains may omit it. */
  coreInsight: z.string().optional(),
  /** One short imperative for the operator's next action. Optional. */
  recommendedAction: z.string().optional(),
  /** Coarse priority tier. Optional. */
  priority: z.enum(PRIORITIES).optional(),
});

export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

/**
 * The same contract as a raw JSON Schema for the Anthropic
 * `output_config.format`. Kept in sync with the zod schema above.
 * Note: structured outputs require `additionalProperties: false`.
 */
export const AGENT_DECISION_JSON_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "The message to send to the lead, in the influencer's voice.",
    },
    stage: { type: "string", enum: [...STAGES] },
    sentiment: { type: "string", enum: [...SENTIMENTS] },
    action: { type: "string", enum: [...ACTIONS] },
    reasoning: {
      type: "string",
      description: "One short line of private reasoning. Never shown to the lead.",
    },
    coreInsight: {
      type: "string",
      description:
        "A specific behavioral observation in plain operator language — e.g. 'mentioned cost twice', 'asked for link · 18h no click'. Concrete, never abstract scores.",
    },
    recommendedAction: {
      type: "string",
      description:
        "One short imperative for the operator — e.g. 'send testimonial', 'wait 24h then send proof'.",
    },
    priority: { type: "string", enum: [...PRIORITIES] },
  },
  required: ["reply", "stage", "sentiment", "action", "reasoning"],
  additionalProperties: false,
} as const;
