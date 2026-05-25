/** Shapes returned by the DM-to-Deal backend API. */

export type Stage =
  | "New"
  | "Engaged"
  | "Qualifying"
  | "Objection"
  | "BookingSent"
  | "Booked"
  | "Won"
  | "Lost";

export type Sentiment = "hot" | "warm" | "cold";
export type Action = "CONTINUE" | "SEND_BOOKING" | "NUDGE" | "MARK_LOST" | "STOP";

export interface Metrics {
  totalLeads: number;
  byStage: Record<Stage, number>;
  replyRate: number;
  bookingRate: number;
  winRate: number;
  totalRevenue: number;
  revenuePerLead: number;
}

export interface LeadSummary {
  id: string;
  igHandle: string;
  name: string | null;
  sourceContent: string | null;
  stage: Stage;
  sentiment: Sentiment;
  lastMessageAt: string;
  messageCount: number;
  revenue: number | null;
}

export interface TranscriptMessage {
  role: "lead" | "agent";
  text: string;
  at: string;
}

export interface LeadDetail extends LeadSummary {
  transcript: TranscriptMessage[];
  firstContactAt: string;
  bookingLinkSentAt?: string;
}

export interface Profile {
  name: string;
  niche: string;
  offer: string;
  tone: string;
  signaturePhrases: string[];
  emojiHabits: string;
  commonObjections: string[];
  recentCaptions: string[];
  leadMagnet: string;
}

/** A single agent bubble — text + how long "typing…" should hover before it. */
export interface SimBubble {
  text: string;
  typingMs: number;
}

export interface SimTurn {
  sessionId: string;
  transcript: TranscriptMessage[];
  stage: Stage;
  sentiment: Sentiment;
  /** New bubbles emitted this turn — the UI animates these in. */
  bursts: SimBubble[];
  /** Current conversation-graph node id (e.g. "OBJ_PRICING"). */
  nodeId: string | null;
  /** Conversation reached Booked / Lost. */
  terminal: boolean;
  /** Classified intent for the last lead reply, or null on session start. */
  intent: string | null;
  /** Handle for this lead — equals "sim_lead" for sandboxed, "sim_<hex>" for persisted. */
  handle: string;
  /** Plausible quick replies the lead might send next. Comes from the engine,
   *  changes after every assistant turn. UI must NOT hardcode these. */
  suggestions: string[];
}
