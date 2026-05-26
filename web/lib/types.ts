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

/** Granular lead state — used by the operator console to surface
 * "heating up / ghosted / stalled" cues alongside sentiment. */
export type Temperature =
  | "cold"
  | "cooling"
  | "warm"
  | "heating"
  | "hot"
  | "ghosted"
  | "stalled";

/** Short AI-system hint shown as a chip on lead cards.
 *  `tone` picks the chip color (signal = positive, warm = needs attention,
 *  fog = neutral/informational). */
export interface AIHint {
  label: string;
  tone: "signal" | "warm" | "fog";
}

/** AI deal-intelligence per lead. Renders as the dominant content on the
 *  kanban card — operator should grasp the lead's situation without
 *  opening the transcript.
 *
 *   - coreInsight: a specific behavioral observation in plain operator
 *     language ("mentioned cost twice", "ignored booking link"). Not
 *     abstract scores — concrete cause/effect.
 *   - recommendedAction: one short imperative — what the operator (or
 *     the agent on next turn) should do ("send testimonial", "wait 48h").
 *   - priority: visual intensity tier. Drives the card's left-edge accent.
 *       urgent → needs action now      (warm)
 *       active → progressing well      (signal-dim)
 *       watch  → monitoring, no rush   (neutral)
 *       cold   → stalled / disqualified (faint, dimmed) */
export interface LeadIntelligence {
  coreInsight: string;
  recommendedAction: string;
  priority: "urgent" | "active" | "watch" | "cold";
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
  /** Set only by the frontend demo fixture — never returned by the API. */
  isDemo?: boolean;
  /** AI-system inferred state ("high booking intent", "price objection
   *  detected"). Subtle by design — surfaces as a single chip. */
  aiHint?: AIHint;
  /** Deal-intelligence — the dominant content of the lead card. */
  intelligence?: LeadIntelligence;
  /** Granular state beyond sentiment — drives the avatar status ring. */
  temperature?: Temperature;
  /** Operator-side annotation ("follow-up due", "double-texted",
   *  "re-engaged after 5d"). Renders as a tiny mono label under the handle. */
  activityLabel?: string;
  /** Unread message count — drives the small lime dot on cards. */
  unread?: number;
  /** Pre-rendered relative time string ("4m ago", "ghosted 3d"). The
   *  fixture pre-computes this so demo timestamps stay stable. */
  relativeTime?: string;
}

export interface TranscriptMessage {
  role: "lead" | "agent";
  text: string;
  at: string;
  /** Optional inline annotation for the conversation viewer's left rail —
   *  highlights the message as an objection / booking moment / intent
   *  signal / ghost-gap with a small marker. */
  marker?: {
    kind: "objection" | "booking" | "intent" | "ghost" | "reEngage";
    label: string;
  };
}

export interface LeadDetail extends LeadSummary {
  transcript: TranscriptMessage[];
  firstContactAt: string;
  bookingLinkSentAt?: string;
  /** Operator/CRM notes shown in the side panel when the lead is open. */
  notes?: string[];
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
