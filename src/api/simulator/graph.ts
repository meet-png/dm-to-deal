import type { Sentiment, Stage } from "../../domain/types.js";
import type { LeadIntent } from "./intent.js";

/**
 * The conversation graph that drives the in-browser simulator.
 *
 * Why a graph (not a flat script):
 * - Branching objection handling without `if/else` soup.
 * - Memory: the engine can track which nodes / objections have been visited
 *   and avoid re-asking the same thing — the lead state is small enough that
 *   we don't need an LLM to keep it straight.
 * - Predictable demo: every quick reply leads somewhere meaningful, and every
 *   path terminates in 4–8 messages (validated by tests).
 * - Cheap to extend: add a node + a transition entry, done.
 *
 * Voice anchored to `EXAMPLE_PROFILE` (Alex Rivera, fitness coach for desk
 * workers). The copy reads as the influencer would actually text.
 */

export type NodeId =
  | "INTRO_RESPONSE"
  | "QUALIFYING_PAIN"
  | "QUALIFYING_DEEPER"
  | "QUALIFYING_GOAL"
  | "SOCIAL_PROOF"
  | "POSITIONING"
  | "ASKING_FOR_BOOKING"
  | "OBJ_PRICING"
  | "OBJ_TRUST"
  | "OBJ_HISTORY"
  | "OBJ_TIMING"
  | "OBJ_CURIOSITY"
  | "REPOSITION"
  | "SEND_BOOKING"
  | "BOOKED"
  | "GHOSTED"
  | "STOPPED";

/** A single bubble in an agent burst — one chat message + how long the
 * "typing…" indicator should hover before it lands. */
export interface Bubble {
  text: string;
  /** Milliseconds of "typing…" before this bubble appears. */
  typingMs: number;
}

/** All copy + behaviour for one node in the graph. */
export interface NodeDef {
  /** What the agent says when entering this node. Multiple variants → the
   *  engine rotates by session+visit count so it never feels canned. */
  bursts: Bubble[][];
  /**
   * Plausible quick replies the lead might send after seeing this node's
   * burst. Multiple variant sets (rotated per session) keep repeated runs
   * fresh. Each set carries a mix of *forward* progress chips, *objection*
   * chips, and *curiosity* chips so the rail captures real conversational
   * branching, not just the happy path.
   *
   * Empty for terminal nodes — the UI shows "start over" instead.
   *
   * Future LLM swap: replace the static variants here with a call to
   * `engine.composeSuggestions()` that hits the model conditioned on the
   * current session state. The graph stays as the deterministic fallback.
   */
  suggestions?: string[][];
  /** Where the conversation lives in the pipeline while in this node. */
  stage: Stage;
  /** The agent's read on the lead. */
  sentiment: Sentiment;
  /** Pacing hint — after this many turns we should already be at booking. */
  pushTowardsBooking?: boolean;
  /** Terminal node — no further input expected. */
  terminal?: boolean;
}

// ── Opening (used by the engine on session start) ─────────────────────────

export const OPENING: Bubble[][] = [
  [
    { text: "hey! just sent over the free 7-day desk-worker reset plan 🙌", typingMs: 1200 },
    {
      text: "what made you grab it — trying to get back into it or starting fresh?",
      typingMs: 1800,
    },
  ],
  [
    { text: "yo! glad you grabbed the plan 💪", typingMs: 900 },
    {
      text: "real quick — what's the part of your day that feels worst right now? back, energy, weight, mood?",
      typingMs: 2100,
    },
  ],
];

// ── Node definitions ──────────────────────────────────────────────────────

export const NODES: Record<NodeId, NodeDef> = {
  INTRO_RESPONSE: {
    stage: "Engaged",
    sentiment: "warm",
    bursts: [
      [
        { text: "okay yeah I hear that a lot", typingMs: 900 },
        {
          text: "be honest with me — is it more the energy crash, the weight creep, or just feeling stiff and slow?",
          typingMs: 2400,
        },
      ],
      [
        { text: "got it.", typingMs: 700 },
        {
          text: "is this a 'I used to be fit and let it slip' situation or more 'never really had a real plan'?",
          typingMs: 2300,
        },
      ],
    ],
    suggestions: [
      [
        "honestly I sit at a desk all day and feel awful",
        "I used to be fit, just let it slip",
        "how much does this cost?",
      ],
      [
        "my back kills me by 3pm every day",
        "I've never really had a real plan",
        "what is this exactly?",
      ],
      [
        "I just feel stiff and slow all the time",
        "energy crash is the worst part",
        "is this expensive?",
      ],
      [
        "weight creep, definitely",
        "I'm just curious tbh",
        "what's the catch?",
      ],
    ],
  },

  QUALIFYING_PAIN: {
    stage: "Qualifying",
    sentiment: "warm",
    bursts: [
      [
        {
          text: "yeah desk life is brutal — sitting 8 hrs literally rewires posture, mood, the whole thing.",
          typingMs: 2600,
        },
        {
          text: "what does a normal weekday actually look like? like wake → work → night routine?",
          typingMs: 2200,
        },
      ],
      [
        { text: "totally fair. that's the most common thing I hear actually.", typingMs: 1800 },
        { text: "where's your headspace at — frustrated? burnt out? somewhere else?", typingMs: 2000 },
      ],
    ],
    suggestions: [
      [
        "wake → meetings → crash on couch, on repeat",
        "burnt out honestly",
        "I've tried programs before and quit",
      ],
      [
        "9-6 desk, dead by evening",
        "frustrated more than anything",
        "is this expensive?",
      ],
      [
        "nonstop meetings, then I'm too tired to do anything",
        "I just want to feel like myself",
        "how much is it though?",
      ],
    ],
  },

  QUALIFYING_DEEPER: {
    stage: "Qualifying",
    sentiment: "warm",
    bursts: [
      [
        {
          text: "okay that tracks. small wins compound — you don't need more time, you need a system.",
          typingMs: 2300,
        },
        {
          text: "if we fast-forward 12 weeks and this is actually working… what would change for you most?",
          typingMs: 2700,
        },
      ],
      [
        { text: "right. and that's exactly why willpower-based programs fail desk folks.", typingMs: 2200 },
        {
          text: "what would 'this is working' look like for you concretely — body, energy, both?",
          typingMs: 2400,
        },
      ],
    ],
    suggestions: [
      [
        "I want to lose 20 lbs and feel strong again",
        "just energy past 3pm honestly",
        "how much is this going to cost me?",
      ],
      [
        "be lean, sleep well, not feel old",
        "look like I actually lift",
        "tell me more about the program",
      ],
      [
        "tired of feeling stiff and exhausted",
        "I want to gain muscle and lose fat",
        "is this realistic in 12 weeks?",
      ],
    ],
  },

  QUALIFYING_GOAL: {
    stage: "Qualifying",
    sentiment: "hot",
    bursts: [
      [
        {
          text: "that's a real outcome — and honestly very doable in 12 weeks with the right structure.",
          typingMs: 2400,
        },
        {
          text: "I've put a few people exactly like you through this. 4 sessions a week, 30 min each, no gym needed.",
          typingMs: 2900,
        },
      ],
    ],
    suggestions: [
      ["okay I'm interested", "but how much is it?", "is this legit?"],
      ["sounds good actually", "what does it cost?", "I'm a bit hesitant tbh"],
      ["yeah I'm down to learn more", "expensive?", "I've tried stuff before and burned out"],
    ],
  },

  SOCIAL_PROOF: {
    stage: "Engaged",
    sentiment: "warm",
    bursts: [
      [
        {
          text: "so the way it usually works — most clients are exactly like you. sit all day, tried a few things, never stuck.",
          typingMs: 2800,
        },
        {
          text: "the difference isn't motivation. it's the system. 30 min, 4x a week, no gym. that's it.",
          typingMs: 2600,
        },
      ],
    ],
    suggestions: [
      ["alright, let's do it", "how much though?", "do you have actual proof?"],
      ["sounds promising honestly", "but is it expensive?", "I want to see results first"],
      ["okay I'm sold on the idea", "what's the cost?", "any testimonials?"],
    ],
  },

  POSITIONING: {
    stage: "Engaged",
    sentiment: "hot",
    pushTowardsBooking: true,
    bursts: [
      [
        {
          text: "so here's my honest take — the fastest way to know if this actually fits your life is a 20-min call. free, zero pitch.",
          typingMs: 2400,
        },
        {
          text: "we map your first 2 weeks together and you keep the plan whether we ever work together or not.",
          typingMs: 2600,
        },
      ],
      [
        {
          text: "here's what I'd genuinely suggest — hop on a free 20 min call with me.",
          typingMs: 2000,
        },
        {
          text: "no pitch, promise. we map out what your next 2 weeks should look like, and you leave with a real plan either way.",
          typingMs: 2600,
        },
      ],
    ],
    suggestions: [
      [
        "yes send me a time",
        "but how much is the program?",
        "I'm honestly too busy right now",
        "how do I know this is real?",
      ],
      [
        "okay sure book me in",
        "wait, is the call really free?",
        "next month maybe — not this week",
        "what's different about this?",
      ],
      [
        "let's go, send the link",
        "actually how much is it?",
        "I've burned out on stuff like this before",
        "tell me more first",
      ],
    ],
  },

  ASKING_FOR_BOOKING: {
    stage: "BookingSent",
    sentiment: "hot",
    pushTowardsBooking: true,
    bursts: [
      [
        { text: "want me to send over a time?", typingMs: 1200 },
      ],
      [
        { text: "open to jumping on a quick call this week?", typingMs: 1500 },
      ],
    ],
    suggestions: [
      ["yes please", "wait, actually how much?", "ugh next month maybe"],
      ["sure, send it", "is this even legit?", "I'm not ready"],
      ["okay let's do it", "actually I can't afford coaching", "give me a sec to think"],
    ],
  },

  OBJ_PRICING: {
    stage: "Objection",
    sentiment: "warm",
    bursts: [
      [
        { text: "totally fair — the call itself is 100% free.", typingMs: 1500 },
        {
          text: "no pitch on it, just a plan mapped to your life. no one's asking you to commit to anything. wanna hop on?",
          typingMs: 2500,
        },
      ],
      [
        { text: "yeah honest answer — the call is free, that's kind of the whole point of it.", typingMs: 1900 },
        {
          text: "we see if the coaching's a fit, either way you leave with a plan. zero commitment. wanna grab a time?",
          typingMs: 2500,
        },
      ],
    ],
    suggestions: [
      ["okay yeah let's hop on", "I really can't afford anything though", "is the call genuinely free?"],
      ["alright, send me a time", "still thinking honestly", "okay but no pressure right?"],
      ["sounds reasonable, let's go", "money is honestly tight rn", "hold on, let me think"],
    ],
  },

  OBJ_TRUST: {
    stage: "Objection",
    sentiment: "cold",
    bursts: [
      [
        { text: "100% fair to ask.", typingMs: 900 },
        {
          text: "easiest way — hop on the call, ask me anything. if it doesn't feel right you ghost me, zero hard feelings 🙌",
          typingMs: 2800,
        },
      ],
      [
        { text: "yeah totally reasonable — hard to tell online who's real.", typingMs: 1800 },
        {
          text: "20 min call, ask whatever you want. no offer if you don't want one — you just walk away with a plan. easy.",
          typingMs: 2600,
        },
      ],
    ],
    suggestions: [
      ["alright fine, let's hop on", "show me real client results first", "how do I know you're not a bot?"],
      ["okay I'll trust it for now", "hold on, thinking", "I've been scammed before"],
      ["sure, book me in", "send me before/afters first", "give me a sec to think"],
    ],
  },

  OBJ_HISTORY: {
    stage: "Objection",
    sentiment: "warm",
    bursts: [
      [
        { text: "yeah — that's honestly the most common story I hear.", typingMs: 1800 },
        {
          text: "desk life isn't a willpower problem, it's a structure problem. every client who 'didn't have time' found it once we made the plan stupid-simple. wanna see if this is different?",
          typingMs: 2900,
        },
      ],
      [
        { text: "yep, super common — and usually it's the plan, not the person.", typingMs: 1800 },
        {
          text: "programs built for gym rats don't survive desk life. small wins compound if the structure is right. wanna see what different looks like?",
          typingMs: 2700,
        },
      ],
    ],
    suggestions: [
      ["okay, I'll try one more time", "but I always quit", "what makes you different?"],
      ["alright I'm in", "I just can't stick to anything", "hold on, let me think"],
      ["fine, let's do it", "I'll commit this time, promise", "give me a sec"],
    ],
  },

  OBJ_TIMING: {
    stage: "Objection",
    sentiment: "warm",
    bursts: [
      [
        { text: "I get it — 'better time' usually never shows up though.", typingMs: 1800 },
        {
          text: "the call's 20 min, do it on a walk. and the plan itself is built for someone with zero extra time. that's literally the whole design.",
          typingMs: 2900,
        },
      ],
      [
        { text: "totally hear you — schedule is real.", typingMs: 1200 },
        {
          text: "quick truth: 20 min call, and the plan is designed for zero-extra-time weeks. built for exactly this scenario.",
          typingMs: 2700,
        },
      ],
    ],
    suggestions: [
      ["alright let's just do this week", "I'm dead serious busy though", "fine I'll find 20 min"],
      ["okay, send a time", "no really 10-hour days", "next week could work actually"],
      ["fair enough, book me", "I'll get back to you next month", "hold on, thinking"],
    ],
  },

  OBJ_CURIOSITY: {
    stage: "Engaged",
    sentiment: "warm",
    bursts: [
      [
        {
          text: "so the plan I just sent is a 7-day desk-worker reset — walks, mobility, one short lift a day. built to be doable when you're slammed.",
          typingMs: 2600,
        },
        {
          text: "the coaching side is separate — 1-on-1 if the plan clicks. no rush on that. what's actually not working for you rn — energy, back, weight?",
          typingMs: 2900,
        },
      ],
      [
        {
          text: "quick version: the 7-day plan = short daily reset built specifically for desk life. that's what I sent.",
          typingMs: 2400,
        },
        {
          text: "I also coach people 1-on-1 if it's a fit, but let's start with what YOU need. what's the part of your day that feels worst?",
          typingMs: 2700,
        },
      ],
    ],
    suggestions: [
      [
        "honestly I sit all day and feel awful",
        "my back kills me by 3pm",
        "how much does the coaching cost?",
      ],
      [
        "energy crash is the worst part",
        "I've tried programs before and quit",
        "sounds interesting, tell me more",
      ],
      [
        "just feel stiff and slow all the time",
        "weight creep honestly",
        "is the coaching expensive?",
      ],
    ],
  },

  REPOSITION: {
    stage: "BookingSent",
    sentiment: "hot",
    pushTowardsBooking: true,
    bursts: [
      [
        { text: "okay perfect.", typingMs: 800 },
        { text: "let's just lock in a time then. I'll send the link 👇", typingMs: 1800 },
      ],
      [
        { text: "love it.", typingMs: 600 },
        { text: "grabbing a slot now — pick whatever works:", typingMs: 1400 },
      ],
    ],
    suggestions: [
      ["let's do it", "actually hold on", "send it"],
      ["yes book me", "wait, I changed my mind", "okay perfect"],
      ["sure, link me", "nah maybe later", "appreciate it"],
    ],
  },

  SEND_BOOKING: {
    stage: "BookingSent",
    sentiment: "hot",
    bursts: [
      [
        { text: "boom — here you go 💪", typingMs: 700 },
        { text: "{{BOOKING_URL}}", typingMs: 600 },
        {
          text: "grab whatever time works. it's just a real conversation, that's it.",
          typingMs: 2200,
        },
      ],
    ],
    suggestions: [
      ["booked it ✓", "thanks!", "see you then 🙌"],
      ["got a slot, thanks", "talk soon!", "appreciate it"],
      ["all set, see ya", "thanks for the link", "looking forward"],
    ],
  },

  BOOKED: {
    stage: "Booked",
    sentiment: "hot",
    terminal: true,
    bursts: [
      [
        { text: "boom — see you then 🙌", typingMs: 700 },
        {
          text: "come ready with one honest question and we'll make it count. talk soon!",
          typingMs: 2200,
        },
      ],
    ],
  },

  GHOSTED: {
    stage: "Lost",
    sentiment: "cold",
    terminal: true,
    bursts: [
      [
        { text: "no worries at all — appreciate you being straight with me.", typingMs: 1800 },
        {
          text: "if anything changes you know where to find me. take care 🙌",
          typingMs: 1900,
        },
      ],
    ],
  },

  STOPPED: {
    stage: "Lost",
    sentiment: "cold",
    terminal: true,
    bursts: [
      [{ text: "totally understand — I'll leave it there. take care! 🙌", typingMs: 1500 }],
    ],
  },
};

// ── Transitions ───────────────────────────────────────────────────────────

/**
 * For a given `from` node, which intent → which next node.
 * `"*"` is the default fallback when no specific intent matches.
 *
 * Objection nodes self-route to REPOSITION on any reply, so the loop always
 * makes forward progress (no two consecutive objections of the same type).
 */
export const TRANSITIONS: Record<NodeId, Partial<Record<LeadIntent | "*", NodeId>>> = {
  INTRO_RESPONSE: {
    pain_stated: "QUALIFYING_DEEPER",
    goal_stated: "QUALIFYING_GOAL",
    obj_pricing: "OBJ_PRICING",
    obj_trust: "OBJ_TRUST",
    obj_history: "OBJ_HISTORY",
    obj_timing: "OBJ_TIMING",
    obj_curiosity: "OBJ_CURIOSITY",
    hesitation: "QUALIFYING_PAIN",
    negative: "GHOSTED",
    "*": "QUALIFYING_PAIN",
  },
  QUALIFYING_PAIN: {
    pain_stated: "QUALIFYING_DEEPER",
    goal_stated: "QUALIFYING_GOAL",
    obj_pricing: "OBJ_PRICING",
    obj_curiosity: "OBJ_CURIOSITY",
    obj_history: "OBJ_HISTORY",
    obj_timing: "OBJ_TIMING",
    hesitation: "QUALIFYING_DEEPER",
    negative: "GHOSTED",
    "*": "QUALIFYING_DEEPER",
  },
  QUALIFYING_DEEPER: {
    goal_stated: "QUALIFYING_GOAL",
    obj_pricing: "OBJ_PRICING",
    obj_history: "OBJ_HISTORY",
    obj_timing: "OBJ_TIMING",
    obj_curiosity: "OBJ_CURIOSITY",
    obj_trust: "OBJ_TRUST",
    hesitation: "SOCIAL_PROOF",
    negative: "GHOSTED",
    "*": "POSITIONING",
  },
  QUALIFYING_GOAL: {
    obj_pricing: "OBJ_PRICING",
    obj_trust: "OBJ_TRUST",
    obj_history: "OBJ_HISTORY",
    obj_timing: "OBJ_TIMING",
    hesitation: "SOCIAL_PROOF",
    negative: "GHOSTED",
    "*": "POSITIONING",
  },
  SOCIAL_PROOF: {
    positive: "ASKING_FOR_BOOKING",
    obj_pricing: "OBJ_PRICING",
    obj_trust: "OBJ_TRUST",
    hesitation: "REPOSITION",
    negative: "GHOSTED",
    "*": "POSITIONING",
  },
  POSITIONING: {
    // POSITIONING has already explicitly proposed the call — a positive reply
    // is agreement to the call itself, so skip ASKING_FOR_BOOKING (redundant
    // "want me to send over a time?" when they already said yes).
    positive: "SEND_BOOKING",
    obj_pricing: "OBJ_PRICING",
    obj_trust: "OBJ_TRUST",
    obj_history: "OBJ_HISTORY",
    obj_timing: "OBJ_TIMING",
    obj_curiosity: "OBJ_CURIOSITY",
    hesitation: "SOCIAL_PROOF",
    negative: "GHOSTED",
    // Ambiguous replies still get an explicit ask — they haven't clearly agreed.
    "*": "ASKING_FOR_BOOKING",
  },
  ASKING_FOR_BOOKING: {
    positive: "SEND_BOOKING",
    obj_pricing: "OBJ_PRICING",
    obj_trust: "OBJ_TRUST",
    obj_history: "OBJ_HISTORY",
    obj_timing: "OBJ_TIMING",
    obj_curiosity: "OBJ_CURIOSITY",
    hesitation: "SOCIAL_PROOF",
    negative: "GHOSTED",
    "*": "SEND_BOOKING",
  },
  OBJ_PRICING: {
    positive: "REPOSITION",
    // Hesitation after objection-handling ≠ agreement. Re-anchor with proof
    // instead of the tone-deaf REPOSITION "okay perfect, let's book!".
    hesitation: "SOCIAL_PROOF",
    // "Tell me more" mid-objection = wants to understand the system, not the
    // free plan. SOCIAL_PROOF describes exactly that.
    obj_curiosity: "SOCIAL_PROOF",
    obj_trust: "OBJ_TRUST",
    negative: "GHOSTED",
    "*": "REPOSITION",
  },
  OBJ_TRUST: {
    positive: "REPOSITION",
    hesitation: "SOCIAL_PROOF",
    obj_curiosity: "SOCIAL_PROOF",
    negative: "GHOSTED",
    "*": "REPOSITION",
  },
  OBJ_HISTORY: {
    positive: "REPOSITION",
    hesitation: "SOCIAL_PROOF",
    obj_curiosity: "SOCIAL_PROOF",
    negative: "GHOSTED",
    "*": "REPOSITION",
  },
  OBJ_TIMING: {
    positive: "REPOSITION",
    hesitation: "SOCIAL_PROOF",
    obj_curiosity: "SOCIAL_PROOF",
    negative: "GHOSTED",
    "*": "REPOSITION",
  },
  OBJ_CURIOSITY: {
    // Now that OBJ_CURIOSITY ends with a qualifying question, route the reply
    // through the qualifying flow instead of jumping straight to booking.
    pain_stated: "QUALIFYING_DEEPER",
    goal_stated: "QUALIFYING_GOAL",
    obj_pricing: "OBJ_PRICING",
    obj_trust: "OBJ_TRUST",
    obj_history: "OBJ_HISTORY",
    obj_timing: "OBJ_TIMING",
    hesitation: "SOCIAL_PROOF",
    positive: "POSITIONING",
    negative: "GHOSTED",
    "*": "QUALIFYING_DEEPER",
  },
  REPOSITION: {
    positive: "SEND_BOOKING",
    hesitation: "GHOSTED", // lead truly backed out at the close — graceful exit
    negative: "GHOSTED",
    // Any NEW objection at the close = they're stalling, not resolving.
    // Sending the link on top of "actually maybe later" is tone-deaf; ghost
    // gracefully so we don't chase them into a booking they'll no-show.
    obj_pricing: "GHOSTED",
    obj_trust: "GHOSTED",
    obj_history: "GHOSTED",
    obj_timing: "GHOSTED",
    "*": "SEND_BOOKING",
  },
  SEND_BOOKING: { "*": "BOOKED" },
  BOOKED: {},
  GHOSTED: {},
  STOPPED: {},
};

/** Every node id, for tests + tooling. */
export const ALL_NODE_IDS: NodeId[] = Object.keys(NODES) as NodeId[];
