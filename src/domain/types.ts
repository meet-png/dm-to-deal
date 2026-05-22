/**
 * Core domain vocabulary for DM-to-Deal.
 *
 * Every layer — agent, CRM, channel, compliance — speaks in these types.
 * Keep this file free of dependencies on any concrete implementation so it
 * can be imported anywhere without creating cycles.
 */

/** Where a lead sits in the pipeline. Mirrors the PRD's Leads tab "Stage" field. */
export const STAGES = [
  "New",
  "Engaged",
  "Qualifying",
  "Objection",
  "BookingSent",
  "Booked",
  "Won",
  "Lost",
] as const;
export type Stage = (typeof STAGES)[number];

/** The agent's read on how hot a lead is. */
export const SENTIMENTS = ["hot", "warm", "cold"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

/**
 * The action the agent decides to take after composing a reply.
 * This is the "DECIDE" step of the thinking loop in the PRD.
 */
export const ACTIONS = [
  "CONTINUE", // keep the conversation going normally
  "SEND_BOOKING", // attach the Calendly link to the reply
  "NUDGE", // lead went quiet; this is a soft follow-up
  "MARK_LOST", // lead is uninterested / hostile; stop nurturing
  "STOP", // hard stop (e.g. user asked to stop — compliance)
] as const;
export type Action = (typeof ACTIONS)[number];

/** Who authored a message in the transcript. */
export type Role = "lead" | "agent";

export interface Message {
  role: Role;
  text: string;
  /** ISO-8601 timestamp. */
  at: string;
}

/**
 * A single lead and the full state the agent needs to act on them.
 * This is the CRM record (PRD §7.1 "Leads" tab), modeled in code.
 */
export interface Lead {
  id: string;
  igHandle: string;
  name?: string;
  /** Which post/keyword brought them in (PRD: "Source Content"). */
  sourceContent?: string;
  stage: Stage;
  sentiment: Sentiment;
  /** Full running transcript — the agent's memory. */
  transcript: Message[];
  firstContactAt: string;
  lastMessageAt: string;
  /** Set once the agent sends a booking link, so we don't double-send. */
  bookingLinkSentAt?: string;
}

/** A brand-new lead captured from a comment/keyword, before the first DM. */
export interface LeadCapture {
  igHandle: string;
  sourceContent?: string;
  name?: string;
}
