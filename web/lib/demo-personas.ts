/**
 * Demo personas + fixture leads — purely frontend-side. Never touches the
 * real Sheet, never travels through the API. The dashboard merges the
 * active persona's leads on top of whatever the live API returns so the
 * pipeline always looks populated for visitors, while the real CRM data
 * stays sacred.
 *
 * Each persona is a scenario pack: profile (the moat), six leads (one
 * per pipeline stage minus Lost), and six baked transcripts that read in
 * that persona's voice.
 *
 * Demo handles are scoped `demo_<persona>_<name>` so they never collide
 * with real handles, and demo leads carry `isDemo: true` so the UI can
 * render the `simulated` chip and the metrics layer can keep revenue
 * honest.
 */

import type { AIHint, LeadDetail, LeadIntelligence, LeadSummary, Profile, Temperature, TranscriptMessage } from "./types";

/** 7-day sparkline + delta-vs-yesterday per KPI tile.
 *  Numbers are pre-rendered into the fixture so the demo stays deterministic
 *  across reloads — no live randomness, no fake metric drift. */
export interface PersonaKpiTrends {
  totalLeadsSpark: number[];
  bookingRateSpark: number[];
  winRateSpark: number[];
  revenueSpark: number[];
  totalLeadsDelta: string;
  bookingRateDelta: string;
  winRateDelta: string;
  revenueDelta: string;
}

export interface DemoPersona {
  id: string;
  label: string;
  /** One-line description shown under the switcher chip on hover. */
  summary: string;
  /** Single-glyph icon shown on the persona chip. Keep it ASCII/unicode-safe. */
  icon: string;
  profile: Profile;
  leads: LeadSummary[];
  /** Keyed by igHandle. */
  transcripts: Record<string, LeadDetail>;
  trends: PersonaKpiTrends;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let idCounter = 0;
function leadId(personaId: string): string {
  idCounter += 1;
  return `demo_${personaId}_${idCounter.toString().padStart(4, "0")}`;
}

/** A transcript row can optionally carry a marker for the rail view. */
type TranscriptRow =
  | readonly [TranscriptMessage["role"], string, string]
  | readonly [TranscriptMessage["role"], string, string, TranscriptMessage["marker"]];

function transcript(rows: ReadonlyArray<TranscriptRow>): TranscriptMessage[] {
  return rows.map(([role, text, at, marker]) =>
    marker ? { role, text, at, marker } : { role, text, at },
  );
}

interface LeadBuild {
  personaId: string;
  igHandle: string;
  name: string | null;
  sourceContent: string | null;
  stage: LeadSummary["stage"];
  sentiment: LeadSummary["sentiment"];
  revenue: number | null;
  firstContactAt: string;
  bookingLinkSentAt?: string;
  messages: ReadonlyArray<TranscriptRow>;
  aiHint?: AIHint;
  intelligence?: LeadIntelligence;
  temperature?: Temperature;
  activityLabel?: string;
  unread?: number;
  relativeTime?: string;
  notes?: string[];
}

function makeLead(b: LeadBuild): { summary: LeadSummary; detail: LeadDetail } {
  const id = leadId(b.personaId);
  const tx = transcript(b.messages);
  const lastMessageAt = tx[tx.length - 1]?.at ?? b.firstContactAt;
  const summary: LeadSummary = {
    id,
    igHandle: b.igHandle,
    name: b.name,
    sourceContent: b.sourceContent,
    stage: b.stage,
    sentiment: b.sentiment,
    lastMessageAt,
    messageCount: tx.length,
    revenue: b.revenue,
    isDemo: true,
    aiHint: b.aiHint,
    intelligence: b.intelligence,
    temperature: b.temperature,
    activityLabel: b.activityLabel,
    unread: b.unread,
    relativeTime: b.relativeTime,
  };
  const detail: LeadDetail = {
    ...summary,
    transcript: tx,
    firstContactAt: b.firstContactAt,
    bookingLinkSentAt: b.bookingLinkSentAt,
    notes: b.notes,
  };
  return { summary, detail };
}

function pack(
  personaId: string,
  builds: LeadBuild[],
): { leads: LeadSummary[]; transcripts: Record<string, LeadDetail> } {
  const leads: LeadSummary[] = [];
  const transcripts: Record<string, LeadDetail> = {};
  for (const b of builds) {
    const { summary, detail } = makeLead({ ...b, personaId });
    leads.push(summary);
    transcripts[summary.igHandle] = detail;
  }
  // Sort newest first to match the API's behavior.
  leads.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  return { leads, transcripts };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Fitness coach — Alex Rivera
// ─────────────────────────────────────────────────────────────────────────────
//
// VOICE CONTRACT (hold every agent message to this — must be recognizable
// in 2-3 lines vs. the other four packs):
//   sentence length:    short bursts, 5-15 words, frequent fragments
//   emoji:              max 1 per message, only 💪 or 🙌, never adjacent
//   pacing:             fast, casual, "quick —" interrupts to soften asks
//   confidence:         warm-confident, never assertive
//   slang:              light gym-casual ("sweet", "got it", "rn")
//   objection handling: reframe + reassure ("totally hear you, and just so it's clear...")
//   CTA style:          low-friction — "want me to send X?", "open to a quick chat?"
//   warmth:             high; uses first name often, "love that"
//   qualification:      one open question at a time
//   follow-up:          anchors to a future moment ("see you Thursday — bring...")

const fitnessProfile: Profile = {
  name: "Alex Rivera",
  niche: "fitness (busy professionals)",
  offer: "a 12-week body recomposition coaching program for people who sit at a desk all day",
  tone: "warm, direct, encouraging — talks like a friend who happens to be a coach, never salesy",
  signaturePhrases: [
    "let's get after it",
    "small wins compound",
    "you don't need more time, you need a system",
  ],
  emojiHabits: "uses 1-2 emoji max, usually 💪 or 🙌, never spammy",
  commonObjections: [
    "I don't have time to train",
    "I've tried programs before and quit",
    "I can't afford coaching right now",
  ],
  recentCaptions: [
    "Stop chasing motivation. Build the system and motivation shows up later. 💪",
    "You don't need 2 hours in the gym. You need 30 honest minutes, 4x a week.",
    "Every client who 'didn't have time' found it once we made the plan stupid-simple.",
  ],
  leadMagnet: "my free 7-day desk-worker reset plan",
};

const fitnessPack = pack("fit", [
  {
    personaId: "fit",
    igHandle: "demo_fit_sarah.codes",
    intelligence: { coreInsight: "replied in 7m · home-equipment match", recommendedAction: "send 7-day plan now", priority: "active" },
    name: "Sarah",
    sourceContent: "Reel: 'why your 7pm energy is shot'",
    stage: "Engaged",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T15:30:00Z",
    temperature: "heating",
    aiHint: { label: "high response speed", tone: "signal" },
    activityLabel: "replied 2m ago",
    relativeTime: "2m ago",
    unread: 1,
    messages: [
      ["agent", "hey Sarah! saw you commented FIT on the desk-worker reset reel — want me to send the 7-day plan?", "2026-05-26T15:31:00Z"],
      ["lead", "yes please, been needing something like this", "2026-05-26T15:38:00Z", { kind: "intent", label: "buying signal · explicit yes" }],
      ["agent", "got it. quick — training situation right now? full gym, home stuff, or pretty much zero equipment?", "2026-05-26T15:40:00Z"],
      ["lead", "home, just dumbbells and a mat", "2026-05-26T15:42:00Z"],
    ],
    notes: [
      "Came in from desk-worker reset reel — strong content-fit.",
      "Replied within 7 min — response-speed signal is high.",
    ],
  },
  {
    personaId: "fit",
    igHandle: "demo_fit_mike_d_eng",
    intelligence: { coreInsight: "softness self-image · fat-loss intent", recommendedAction: "ask about evening energy", priority: "active" },
    name: "Mike",
    sourceContent: "Reel: '30-min workouts that actually work'",
    stage: "Qualifying",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T13:00:00Z",
    temperature: "warm",
    aiHint: { label: "ICP match: strong", tone: "signal" },
    activityLabel: "deep qual · 3 turns",
    relativeTime: "1h ago",
    messages: [
      ["agent", "hey Mike! you commented FIT — want me to send the 7-day desk-worker reset?", "2026-05-26T13:02:00Z"],
      ["lead", "yeah send it", "2026-05-26T13:08:00Z"],
      ["agent", "sweet. before I do — what does your week actually look like? how many days can you realistically train, how much time per session?", "2026-05-26T13:10:00Z"],
      ["lead", "honestly maybe 3 days, 30 min each is realistic", "2026-05-26T14:00:00Z"],
      ["agent", "perfect, that's exactly what the plan is built for. main goal — drop body fat, build a bit of muscle, or just feel less wrecked at 5pm?", "2026-05-26T14:05:00Z"],
      ["lead", "drop fat mostly, started feeling soft sitting at the desk all day", "2026-05-26T14:18:00Z"],
    ],
  },
  {
    personaId: "fit",
    igHandle: "demo_fit_dev.dani",
    intelligence: { coreInsight: "budget flagged once · accepted free-call frame", recommendedAction: "send case study, skip pitch", priority: "active" },
    name: "Dani",
    sourceContent: "Reel: 'why most coaching programs fail'",
    stage: "Objection",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T09:15:00Z",
    temperature: "warm",
    aiHint: { label: "price objection · reframed", tone: "warm" },
    activityLabel: "reframe accepted",
    relativeTime: "4h ago",
    messages: [
      ["agent", "appreciate you opening this Dani! the deeper version is a 12-week coaching program — if it's a fit I'd love to chat for 20 min, no pitch, just see if the system makes sense for you", "2026-05-26T09:30:00Z"],
      ["lead", "I'm interested but coaching is way out of my budget rn ngl", "2026-05-26T10:42:00Z", { kind: "objection", label: "price objection" }],
      ["agent", "totally hear you — and just so it's clear, the 20-min chat is free either way. worst case you leave with a sharper plan and we never talk about money. only if it's a fit do we even get into program stuff.", "2026-05-26T10:48:00Z"],
      ["lead", "ok yeah that's fair. what's the format", "2026-05-26T11:00:00Z"],
      ["agent", "just a quick zoom, super casual. you tell me where you are, I tell you what'd actually move the needle for someone in your spot. no slides or anything 🙌", "2026-05-26T11:05:00Z"],
    ],
    notes: [
      "Price-sensitive — flagged 'out of budget' on turn 2.",
      "Reframe ('the call is free either way') landed; momentum recoverable.",
    ],
  },
  {
    personaId: "fit",
    igHandle: "demo_fit_kai.fit",
    intelligence: { coreInsight: "link sent · no click for 22h", recommendedAction: "voice-note nudge", priority: "urgent" },
    name: "Kai",
    sourceContent: "Reel: 'the 4-week strength reset'",
    stage: "BookingSent",
    sentiment: "hot",
    revenue: null,
    firstContactAt: "2026-05-25T18:00:00Z",
    bookingLinkSentAt: "2026-05-25T19:20:00Z",
    temperature: "hot",
    aiHint: { label: "follow-up window optimal", tone: "signal" },
    activityLabel: "link sent 22h ago",
    relativeTime: "yesterday",
    messages: [
      ["agent", "you in for a 20-min chat? no pitch, just see if the program fits your week", "2026-05-25T19:10:00Z"],
      ["lead", "yeah send the link", "2026-05-25T19:18:00Z", { kind: "intent", label: "asked for link" }],
      ["agent", "here you go — pick whatever works: [calendly link]. and if nothing on there fits, just send me your top 2 windows and I'll make it happen 🙌", "2026-05-25T19:22:00Z", { kind: "booking", label: "booking link sent" }],
    ],
    notes: [
      "Calendly sent yesterday — no booking yet. Optimal nudge window opens 24h after send.",
    ],
  },
  {
    personaId: "fit",
    igHandle: "demo_fit_jenna.dx",
    intelligence: { coreInsight: "booked within 80s of link · high commit", recommendedAction: "send pre-call prep doc", priority: "active" },
    name: "Jenna",
    sourceContent: "Reel: 'desk job, sore back, what to do'",
    stage: "Booked",
    sentiment: "hot",
    revenue: null,
    firstContactAt: "2026-05-25T14:00:00Z",
    bookingLinkSentAt: "2026-05-25T15:30:00Z",
    temperature: "hot",
    aiHint: { label: "low show-up risk", tone: "signal" },
    activityLabel: "booked Thu 4pm",
    relativeTime: "yesterday",
    messages: [
      ["agent", "want to grab a quick chat? 20 min, no pitch, just see if the system makes sense", "2026-05-25T15:20:00Z"],
      ["lead", "yes please", "2026-05-25T15:28:00Z"],
      ["agent", "here's my calendar: [calendly link]", "2026-05-25T15:30:00Z", { kind: "booking", label: "booking link sent" }],
      ["lead", "booked Thursday 4pm", "2026-05-25T16:45:00Z", { kind: "booking", label: "slot confirmed · Thu 4pm" }],
      ["agent", "perfect. see you Thursday — bring the questions you've been holding onto, that's where the good stuff comes out 💪", "2026-05-25T16:50:00Z"],
    ],
  },
  {
    personaId: "fit",
    igHandle: "demo_fit_marcus.lifts",
    intelligence: { coreInsight: "3-month restart spiral · finally committed", recommendedAction: "weekly accountability check", priority: "active" },
    name: "Marcus",
    sourceContent: "Reel: 'first 4 weeks of recomp'",
    stage: "Won",
    sentiment: "hot",
    revenue: 1500,
    firstContactAt: "2026-05-15T11:00:00Z",
    bookingLinkSentAt: "2026-05-18T09:00:00Z",
    temperature: "hot",
    aiHint: { label: "closed · onboarded", tone: "signal" },
    activityLabel: "$1,500 closed · 3d ago",
    relativeTime: "3d ago",
    messages: [
      ["agent", "hey Marcus! glad you reached out. quick — what's pulled you back to thinking about coaching now vs 3 months ago?", "2026-05-15T11:30:00Z"],
      ["lead", "honestly just realized I keep restarting alone and nothing sticks. ready to commit", "2026-05-15T13:00:00Z", { kind: "intent", label: "commitment signal" }],
      ["agent", "love that. and the timeline — you trying to feel different by summer, or longer arc?", "2026-05-15T13:05:00Z"],
      ["lead", "by summer would be amazing", "2026-05-16T08:30:00Z"],
      ["agent", "doable. let's do a 20-min chat and I'll show you how the 12 weeks shake out. [calendly link]", "2026-05-18T09:00:00Z", { kind: "booking", label: "booking link sent" }],
      ["lead", "just booked!", "2026-05-18T09:45:00Z", { kind: "booking", label: "slot confirmed" }],
      ["agent", "see you then 🙌", "2026-05-18T09:50:00Z"],
      ["agent", "hey — that chat was great. ready to make it official? I'll send the onboarding link", "2026-05-23T15:00:00Z"],
      ["lead", "yes let's do it", "2026-05-23T19:30:00Z", { kind: "intent", label: "explicit close" }],
      ["agent", "you're in. let's get after it 💪", "2026-05-23T20:10:00Z"],
    ],
    notes: [
      "Returning lead — pitched coaching twice before in past 12 months, finally committed.",
      "Onboarded into 12-wk recomp, $1.5k retainer.",
    ],
  },
  // Behavioral variance: a ghosted Qualifying lead — went silent mid-conversation.
  {
    personaId: "fit",
    igHandle: "demo_fit_riley.run",
    intelligence: { coreInsight: "answered '2 days/wk' · silent since", recommendedAction: "soft re-engage, no link", priority: "cold" },
    name: "Riley",
    sourceContent: "Reel: 'the 30-min strength template'",
    stage: "Qualifying",
    sentiment: "cold",
    revenue: null,
    firstContactAt: "2026-05-22T09:00:00Z",
    temperature: "ghosted",
    aiHint: { label: "ghosted 4d · nudge ready", tone: "warm" },
    activityLabel: "silent 4d",
    relativeTime: "4d ago",
    messages: [
      ["agent", "Riley — saw the FIT comment. want the 7-day plan?", "2026-05-22T09:05:00Z"],
      ["lead", "yes pls", "2026-05-22T11:30:00Z"],
      ["agent", "before I send — training days per week realistically?", "2026-05-22T11:32:00Z"],
      ["lead", "uhh maybe 2", "2026-05-22T17:00:00Z"],
      ["agent", "perfect — 2-day version of the plan is actually the highest-completion one we have. and goal — fat loss, strength, or both?", "2026-05-22T17:05:00Z", { kind: "ghost", label: "no reply since" }],
    ],
    notes: [
      "Engaged for two turns then went quiet — life-event ghost is most likely.",
      "Soft re-engagement scheduled for day-5 if no reply.",
    ],
  },
  // Behavioral variance: a double-texter with high anxiety.
  {
    personaId: "fit",
    igHandle: "demo_fit_jordan.flex",
    intelligence: { coreInsight: "3 self-trust messages back-to-back", recommendedAction: "address identity, not program", priority: "urgent" },
    name: "Jordan",
    sourceContent: "Reel: 'why I gave up macros'",
    stage: "Objection",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T10:00:00Z",
    temperature: "warm",
    aiHint: { label: "high anxiety · double-text", tone: "warm" },
    activityLabel: "double-texted today",
    relativeTime: "30m ago",
    unread: 2,
    messages: [
      ["agent", "Jordan — want the 7-day plan?", "2026-05-26T10:02:00Z"],
      ["lead", "yes but I have to be honest", "2026-05-26T12:30:00Z"],
      ["lead", "I've tried so many programs and quit every single one. like literally every one", "2026-05-26T12:31:00Z", { kind: "objection", label: "low self-trust" }],
      ["lead", "I don't want to waste your time if I'm just gonna do it again", "2026-05-26T12:31:30Z"],
      ["agent", "appreciate the honesty. that's actually the most important data point — most people pretend it'll be different this time. the plan is built around making quitting hard, not motivation easy. and if you're worried about wasting time, the call is free and 20 min. worst case you leave with a sharper read on what specifically tanks you each restart.", "2026-05-26T12:40:00Z"],
      ["lead", "ok yeah that hit. ngl", "2026-05-26T13:30:00Z"],
    ],
    notes: [
      "Identity-level objection (self-trust), not price. Reframe focused on system over willpower.",
    ],
  },
]);

const fitnessPersona: DemoPersona = {
  id: "fit",
  label: "Fitness coach",
  summary: "Busy-professional recomp coaching",
  icon: "◆",
  profile: fitnessProfile,
  leads: fitnessPack.leads,
  transcripts: fitnessPack.transcripts,
  trends: {
    totalLeadsSpark: [4, 6, 5, 7, 6, 8, 9],
    bookingRateSpark: [18, 22, 21, 24, 23, 27, 29],
    winRateSpark: [38, 41, 42, 44, 43, 47, 50],
    revenueSpark: [0, 0, 1500, 1500, 3000, 3000, 4500],
    totalLeadsDelta: "+2 today",
    bookingRateDelta: "+2.0pp vs 7d",
    winRateDelta: "+3.0pp vs 7d",
    revenueDelta: "+$1.5k this week",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Agency owner — Jordan Cole
// ─────────────────────────────────────────────────────────────────────────────
//
// VOICE CONTRACT:
//   sentence length:    medium 10-25 words; punctuated by short one-liner verdicts
//   emoji:              ⚡ or 📈 only, max 1 across an entire transcript
//   pacing:             deliberate, brief pauses — "right.", "fair."
//   confidence:         assertive consultant; names the problem before consoling
//   slang:              zero; uses sales/agency vocabulary (SQL, SDR, ICP, loop)
//   objection handling: confront with structure ("that usually means: X, Y, no loop")
//   CTA style:          framed as a free audit; instructs which artifact to bring
//   warmth:             low — no first-name greeting, no "love that", no exclamations
//   qualification:      rapid quantitative — SQL count, channel mix, agency size
//   follow-up:          names the highest-signal artifact the prospect should bring

const agencyProfile: Profile = {
  name: "Jordan Cole",
  niche: "B2B agency growth (lead-gen for service businesses)",
  offer: "a 90-day cold-outbound system that books 8-12 qualified calls per month for B2B agencies",
  tone: "sharp, transparent, no fluff — like a senior consultant who got tired of agencies cargo-culting hacks",
  signaturePhrases: [
    "the data doesn't care what you think",
    "you don't have a lead problem, you have a system problem",
    "tighten the loop",
  ],
  emojiHabits: "rare — only ⚡ or 📈 for big wins",
  commonObjections: [
    "we already do outbound",
    "we're booked through Q3 anyway",
    "tried this with another consultant, didn't work",
  ],
  recentCaptions: [
    "Most agencies aren't 'in a slow month' — they're in a feedback loop they never closed.",
    "If your outbound depends on one rep being on, that's not a system. That's a personality.",
    "Spent 3 hrs auditing a $40k/mo agency's CRM yesterday. They were losing 60% of qualified leads in the handoff. ⚡",
  ],
  leadMagnet: "my 1-page outbound audit checklist",
};

const agencyPack = pack("ag", [
  {
    personaId: "ag",
    igHandle: "demo_ag_max.thompson",
    intelligence: { coreInsight: "shared model + niche in 2 turns", recommendedAction: "send 1-page audit checklist", priority: "active" },
    name: "Max",
    sourceContent: "Reel: 'why your outbound is dying'",
    stage: "Engaged",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T15:00:00Z",
    temperature: "heating",
    aiHint: { label: "ICP match: tier-1", tone: "signal" },
    activityLabel: "audit context · gathered",
    relativeTime: "12m ago",
    unread: 1,
    messages: [
      ["agent", "Max — saw the AUDIT comment on the teardown. want the 1-page checklist?", "2026-05-26T15:02:00Z"],
      ["lead", "yeah please", "2026-05-26T15:14:00Z"],
      ["agent", "context first — agency model? lead-gen, retainer, productized service?", "2026-05-26T15:16:00Z"],
      ["lead", "retainer, social ads for home services", "2026-05-26T15:35:00Z"],
    ],
  },
  {
    personaId: "ag",
    igHandle: "demo_ag_priya.runs.ads",
    intelligence: { coreInsight: "70% referral skew · admits streaky", recommendedAction: "frame audit as floor-control", priority: "active" },
    name: "Priya",
    sourceContent: "Reel: 'the CRM handoff bleed'",
    stage: "Qualifying",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T12:00:00Z",
    messages: [
      ["agent", "Priya — how many SQLs is the team booking per month right now?", "2026-05-26T12:03:00Z"],
      ["lead", "maybe 6-8 a month, depending. very streaky", "2026-05-26T12:30:00Z"],
      ["agent", "and what's the channel mix on those — pure outbound, referral, paid, mix?", "2026-05-26T12:32:00Z"],
      ["lead", "70% referral, 20% outbound, 10% inbound from content", "2026-05-26T13:50:00Z"],
      ["agent", "got it. the streakiness is almost always the referral skew. tighten the loop on the 20% and the floor stops moving.", "2026-05-26T13:55:00Z"],
      ["lead", "makes sense. that's the part we suck at", "2026-05-26T14:10:00Z"],
    ],
  },
  {
    personaId: "ag",
    igHandle: "demo_ag_steve.b2b",
    intelligence: { coreInsight: "challenged differentiation · conceded gap", recommendedAction: "send mini teardown sample", priority: "active" },
    name: "Steve",
    sourceContent: "Reel: 'most outbound is a personality, not a system'",
    stage: "Objection",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T08:30:00Z",
    temperature: "warm",
    aiHint: { label: "skeptic · reframe landed", tone: "warm" },
    activityLabel: "challenged with data",
    relativeTime: "5h ago",
    messages: [
      ["agent", "the 90-day system is for agencies booking under 15 SQLs/mo — open to a 20-min call to see if it's a fit?", "2026-05-26T08:45:00Z"],
      ["lead", "we already do outbound, what's different here", "2026-05-26T10:00:00Z", { kind: "objection", label: "differentiation challenge" }],
      ["agent", "fair pushback. 'doing outbound' usually means: one SDR, one channel, no feedback loop on what's failing. the system is the loop — reply-rate triage, ICP pruning weekly, message versioning. less new activity, more learning per message.", "2026-05-26T10:08:00Z"],
      ["lead", "ok the message versioning is something we definitely don't do", "2026-05-26T10:50:00Z"],
      ["agent", "right. that's where 40-60% of agency outbound dies, quietly. the data doesn't care what you think the message is doing.", "2026-05-26T11:00:00Z"],
    ],
  },
  {
    personaId: "ag",
    igHandle: "demo_ag_lena.growth",
    intelligence: { coreInsight: "asked for link · 18h no click", recommendedAction: "wait 24h, then send proof", priority: "watch" },
    name: "Lena",
    sourceContent: "Reel: 'audit a $40k agency'",
    stage: "BookingSent",
    sentiment: "hot",
    revenue: null,
    firstContactAt: "2026-05-25T17:00:00Z",
    bookingLinkSentAt: "2026-05-25T18:40:00Z",
    messages: [
      ["agent", "open to a 20-min audit call? bring 1-2 weeks of outbound data and I'll show you where the bleed is, no pitch.", "2026-05-25T18:30:00Z"],
      ["lead", "yes send the link", "2026-05-25T18:38:00Z"],
      ["agent", "[calendly link]. if nothing fits, send 2 windows.", "2026-05-25T18:40:00Z"],
    ],
  },
  {
    personaId: "ag",
    igHandle: "demo_ag_omar.scales",
    intelligence: { coreInsight: "auto-booked Tue · brought 30d data", recommendedAction: "prep SQL-leak analysis", priority: "active" },
    name: "Omar",
    sourceContent: "Reel: 'the SQL definition test'",
    stage: "Booked",
    sentiment: "hot",
    revenue: null,
    firstContactAt: "2026-05-24T11:00:00Z",
    bookingLinkSentAt: "2026-05-25T09:00:00Z",
    messages: [
      ["agent", "open to a 20-min call? I'll do a quick read on where the next 5 SQLs are leaking from.", "2026-05-25T08:50:00Z"],
      ["lead", "yeah let's do it", "2026-05-25T09:00:00Z"],
      ["agent", "[calendly link]", "2026-05-25T09:00:00Z"],
      ["lead", "booked for Tuesday 11am", "2026-05-25T14:45:00Z"],
      ["agent", "see you then. bring last 30 days of outbound stats and one rejected proposal — that's the highest-signal combo.", "2026-05-25T16:30:00Z"],
    ],
  },
  {
    personaId: "ag",
    igHandle: "demo_ag_rachel.closed",
    intelligence: { coreInsight: "5 FTE · 10 SQL/mo · 90d retainer", recommendedAction: "schedule first weekly call", priority: "active" },
    name: "Rachel",
    sourceContent: "Reel: 'feedback loops > activity'",
    stage: "Won",
    sentiment: "hot",
    revenue: 4500,
    firstContactAt: "2026-05-10T10:00:00Z",
    bookingLinkSentAt: "2026-05-14T09:00:00Z",
    temperature: "hot",
    aiHint: { label: "closed · 90d retainer", tone: "signal" },
    activityLabel: "$4,500 closed · 3d ago",
    relativeTime: "3d ago",
    messages: [
      ["agent", "Rachel — good comment. agency size and current SQL count?", "2026-05-10T10:30:00Z"],
      ["lead", "5 people, ~10 SQLs/mo", "2026-05-10T15:00:00Z"],
      ["agent", "right in the band the system is built for. open to a 20-min call to look at the loop?", "2026-05-10T15:05:00Z"],
      ["lead", "yes", "2026-05-11T09:30:00Z"],
      ["agent", "[calendly link]", "2026-05-14T09:00:00Z", { kind: "booking", label: "booking link sent" }],
      ["lead", "booked Monday 2pm", "2026-05-14T09:45:00Z", { kind: "booking", label: "slot confirmed · Mon 2pm" }],
      ["agent", "great call. ready to start the 90 days? I'll send onboarding.", "2026-05-22T11:00:00Z"],
      ["lead", "yep, send it", "2026-05-22T14:20:00Z", { kind: "intent", label: "explicit close" }],
      ["agent", "in. let's tighten the loop. ⚡", "2026-05-23T19:00:00Z"],
    ],
    notes: [
      "Agency at 5 FTEs · 10 SQLs/mo — ideal ICP center.",
      "Onboarded into 90-day retainer at $4.5k/mo.",
    ],
  },
  // Behavioral variance: agency owner who re-engaged after going silent for a week.
  {
    personaId: "ag",
    igHandle: "demo_ag_tom.reset",
    intelligence: { coreInsight: "silent 7d, returned with churn data", recommendedAction: "move fast · book this week", priority: "urgent" },
    name: "Tom",
    sourceContent: "Reel: 'feedback loop diagnostic'",
    stage: "Qualifying",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-18T10:00:00Z",
    temperature: "heating",
    aiHint: { label: "re-engaged · 7d gap", tone: "signal" },
    activityLabel: "re-opened after 7d",
    relativeTime: "1h ago",
    unread: 1,
    messages: [
      ["agent", "Tom — checklist done. team size and channel mix?", "2026-05-18T10:30:00Z"],
      ["lead", "11 ppl, 80% outbound 20% referral", "2026-05-18T16:00:00Z"],
      ["agent", "and current SQLs/mo on the outbound side?", "2026-05-18T16:05:00Z", { kind: "ghost", label: "no reply for 7d" }],
      ["lead", "sorry, swamped last week. ~14 SQLs but feels random", "2026-05-25T20:00:00Z", { kind: "reEngage", label: "lead re-engaged" }],
      ["agent", "no worries — 14 with no consistency is the exact shape the loop fixes. the random part is the bleed, not the volume.", "2026-05-26T14:30:00Z"],
    ],
    notes: [
      "Went silent 7 days mid-qualification; came back unprompted — high-quality re-engage.",
    ],
  },
]);

const agencyPersona: DemoPersona = {
  id: "ag",
  label: "Agency owner",
  summary: "B2B outbound system for service agencies",
  icon: "▲",
  profile: agencyProfile,
  leads: agencyPack.leads,
  transcripts: agencyPack.transcripts,
  trends: {
    totalLeadsSpark: [3, 4, 5, 5, 7, 6, 8],
    bookingRateSpark: [22, 24, 28, 30, 31, 33, 36],
    winRateSpark: [40, 44, 45, 48, 50, 52, 55],
    revenueSpark: [0, 0, 0, 4500, 4500, 4500, 4500],
    totalLeadsDelta: "+1 today",
    bookingRateDelta: "+3.0pp vs 7d",
    winRateDelta: "+2.0pp vs 7d",
    revenueDelta: "+$4.5k this week",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Creator monetization — Mira Park
// ─────────────────────────────────────────────────────────────────────────────
//
// VOICE CONTRACT:
//   sentence length:    medium-long 12-30 words; often a self-contained insight
//   emoji:              ✨ only, ~once per Won outcome, never elsewhere
//   pacing:             slower, considered; frequent em-dash brackets
//   confidence:         quietly confident, never assertive — teaches, doesn't sell
//   slang:              zero; treats reader as peer/equal
//   objection handling: reframe as a data question ("most 'I don't know what to sell'
//                       is actually 'I've never let myself look at the data'")
//   CTA style:          gentle — "I'll pull your numbers and we map it live"
//   warmth:             peer-respectful; first name in opening, no nicknames
//   qualification:      three explicit numbers — list size, open rate, prior product
//   follow-up:          anchors to artifacts (last 5 topics + reader replies)

const creatorProfile: Profile = {
  name: "Mira Park",
  niche: "newsletter monetization for solo creators",
  offer: "a 6-week sprint to turn a newsletter under 5k subscribers into $3k+/mo of digital-product revenue",
  tone: "thoughtful, slightly nerdy, treats audience like equals — high signal, no influencer-isms",
  signaturePhrases: [
    "audience size is a vanity metric, revenue-per-subscriber isn't",
    "the second product is the unlock",
    "ship before you're ready",
  ],
  emojiHabits: "almost never; occasional ✨ for a milestone",
  commonObjections: [
    "my list is too small",
    "I don't know what to sell",
    "I tried a course, no one bought",
  ],
  recentCaptions: [
    "You don't need 50k subscribers. You need 500 people who buy from you twice.",
    "The 'I'll launch the course when I have 10k subs' trap is real and it cost me 18 months.",
    "Reread my last 6 posts that hit. They were all answers to a question someone DM'd me. Coincidence.",
  ],
  leadMagnet: "my newsletter monetization audit (free, 24hr turnaround)",
};

const creatorPack = pack("cr", [
  {
    personaId: "cr",
    igHandle: "demo_cr_jamie.writes",
    intelligence: { coreInsight: "1.8k subs · 7mo · zero monetization", recommendedAction: "ask which posts hit hardest", priority: "active" },
    name: "Jamie",
    sourceContent: "Post: 'revenue per subscriber matters'",
    stage: "Engaged",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T15:10:00Z",
    temperature: "heating",
    aiHint: { label: "niche match · ADHD/founders", tone: "signal" },
    activityLabel: "audit context · gathered",
    relativeTime: "10m ago",
    unread: 1,
    messages: [
      ["agent", "hi Jamie — you asked for the monetization audit. want to send over the niche and list size and I'll take a look this week?", "2026-05-26T15:12:00Z"],
      ["lead", "yes! productivity for ADHD founders, ~1,800 subs", "2026-05-26T15:22:00Z"],
      ["agent", "great niche, the buyers are paying. one more — what have you sold to the list so far, if anything?", "2026-05-26T15:25:00Z"],
      ["lead", "nothing yet, just been writing for 7 months", "2026-05-26T15:38:00Z"],
    ],
  },
  {
    personaId: "cr",
    igHandle: "demo_cr_sasha.thinks",
    intelligence: { coreInsight: "42% open · 800 free-figma downloads", recommendedAction: "propose $39 paid v2", priority: "active" },
    name: "Sasha",
    sourceContent: "Post: 'the 500 buyers idea'",
    stage: "Qualifying",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T11:00:00Z",
    messages: [
      ["agent", "open rate, list size, niche — the three numbers I'd want for an audit. mind sharing?", "2026-05-26T11:05:00Z"],
      ["lead", "42% open, 2,300 subs, design systems for product teams", "2026-05-26T12:30:00Z"],
      ["agent", "good open rate, healthy niche. what's the closest thing to a product you've already shipped — even a notion doc, a template, anything paid?", "2026-05-26T12:33:00Z"],
      ["lead", "I had a free figma file that got 800 downloads", "2026-05-26T13:40:00Z"],
      ["agent", "that's the seed for a paid v2. people who downloaded a free figma file have already self-selected on what they want. shipping a $39 follow-up is usually the fastest first revenue.", "2026-05-26T13:55:00Z"],
    ],
  },
  {
    personaId: "cr",
    igHandle: "demo_cr_dee.posts",
    intelligence: { coreInsight: "'don't know what to sell' · imposter pattern", recommendedAction: "reframe via reader-DM data", priority: "active" },
    name: "Dee",
    sourceContent: "Post: 'why launches flop'",
    stage: "Objection",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T09:00:00Z",
    temperature: "warm",
    aiHint: { label: "clarity objection · reframed", tone: "warm" },
    activityLabel: "reframe accepted",
    relativeTime: "5h ago",
    messages: [
      ["agent", "the 6-week sprint walks you through the first paid product end-to-end. would you be open to a 20-min call to see if it fits?", "2026-05-26T09:30:00Z"],
      ["lead", "honestly I don't even know what I'd sell. that's the blocker", "2026-05-26T10:45:00Z", { kind: "objection", label: "clarity objection" }],
      ["agent", "that's actually the most common starting point and the easiest one to fix on a call — most 'I don't know what to sell' is actually 'I've never let myself look at the data of what my readers already ask for'. that takes ~15 min to surface.", "2026-05-26T10:50:00Z"],
      ["lead", "ok that's a fair reframe", "2026-05-26T11:02:00Z"],
    ],
  },
  {
    personaId: "cr",
    igHandle: "demo_cr_arun.notes",
    intelligence: { coreInsight: "self-booked after reading 3 posts", recommendedAction: "no nudge · let momentum sit", priority: "watch" },
    name: "Arun",
    sourceContent: "Post: 'launch before you're ready'",
    stage: "BookingSent",
    sentiment: "hot",
    revenue: null,
    firstContactAt: "2026-05-25T16:00:00Z",
    bookingLinkSentAt: "2026-05-25T18:00:00Z",
    messages: [
      ["agent", "want to grab 20 min? I'll pull your numbers and we map the first product live.", "2026-05-25T17:50:00Z"],
      ["lead", "yes please", "2026-05-25T17:58:00Z"],
      ["agent", "[calendly link]", "2026-05-25T18:00:00Z"],
    ],
  },
  {
    personaId: "cr",
    igHandle: "demo_cr_imani.wrote",
    intelligence: { coreInsight: "booked Wed 9am · used ✨ in reply", recommendedAction: "request last 5 topics + replies", priority: "active" },
    name: "Imani",
    sourceContent: "Post: '500 paying readers'",
    stage: "Booked",
    sentiment: "hot",
    revenue: null,
    firstContactAt: "2026-05-24T14:00:00Z",
    bookingLinkSentAt: "2026-05-25T10:00:00Z",
    messages: [
      ["agent", "open to a quick call?", "2026-05-25T09:55:00Z"],
      ["lead", "yes", "2026-05-25T10:00:00Z"],
      ["agent", "[calendly link]", "2026-05-25T10:00:00Z"],
      ["lead", "booked Wednesday 9am ✨", "2026-05-25T14:15:00Z"],
      ["agent", "perfect. bring your last 5 newsletter topics and any reader replies, that's the highest-signal artifact.", "2026-05-25T16:40:00Z"],
    ],
  },
  {
    personaId: "cr",
    igHandle: "demo_cr_taylor.subs",
    intelligence: { coreInsight: "3.1k subs · $0 prior · sprint started", recommendedAction: "first audit call this week", priority: "active" },
    name: "Taylor",
    sourceContent: "Post: 'second product is the unlock'",
    stage: "Won",
    sentiment: "hot",
    revenue: 1200,
    firstContactAt: "2026-05-12T10:00:00Z",
    bookingLinkSentAt: "2026-05-16T11:00:00Z",
    temperature: "hot",
    aiHint: { label: "closed · sprint", tone: "signal" },
    activityLabel: "$1,200 closed · 4d ago",
    relativeTime: "4d ago",
    messages: [
      ["agent", "Taylor — what's the list size and current revenue, if any?", "2026-05-12T10:30:00Z"],
      ["lead", "3,100 subs, $0 so far", "2026-05-12T16:00:00Z"],
      ["agent", "great spot — that's the size where the first $1k/mo is the easiest. open to a 20-min call?", "2026-05-12T16:05:00Z"],
      ["lead", "yes", "2026-05-15T08:30:00Z"],
      ["agent", "[calendly link]", "2026-05-16T11:00:00Z", { kind: "booking", label: "booking link sent" }],
      ["lead", "booked!", "2026-05-16T11:30:00Z", { kind: "booking", label: "slot confirmed" }],
      ["agent", "ready for the 6-week sprint? I'll send onboarding.", "2026-05-22T09:00:00Z"],
      ["lead", "yes please", "2026-05-22T12:00:00Z", { kind: "intent", label: "explicit close" }],
      ["agent", "in. ✨", "2026-05-22T20:00:00Z"],
    ],
    notes: ["3.1k list · $0 prior revenue — textbook first-product sprint candidate."],
  },
  // Behavioral variance: a small-list creator with self-trust issue (skeptical).
  {
    personaId: "cr",
    igHandle: "demo_cr_robin.draft",
    intelligence: { coreInsight: "740 subs · 'is that enough?' self-doubt", recommendedAction: "share rev-per-sub proof", priority: "urgent" },
    name: "Robin",
    sourceContent: "Post: '500 buyers > 50k subs'",
    stage: "Qualifying",
    sentiment: "cold",
    revenue: null,
    firstContactAt: "2026-05-24T11:00:00Z",
    temperature: "cooling",
    aiHint: { label: "list size objection · pending", tone: "warm" },
    activityLabel: "size-doubt · 1d quiet",
    relativeTime: "1d ago",
    messages: [
      ["agent", "Robin — niche and list size?", "2026-05-24T11:05:00Z"],
      ["lead", "indie game dev marketing, 740 subs", "2026-05-24T13:30:00Z"],
      ["agent", "small lists in narrow niches actually convert higher per-sub than big-tent ones. what have those 740 subs been most engaged with?", "2026-05-24T13:35:00Z"],
      ["lead", "honestly idk if 740 is enough to do anything with", "2026-05-25T16:00:00Z", { kind: "objection", label: "list-size objection" }],
    ],
    notes: ["List-size objection is the central blocker — needs concrete revenue-per-sub example."],
  },
]);

const creatorPersona: DemoPersona = {
  id: "cr",
  label: "Creator monetization",
  summary: "Newsletter → paid product, sub-5k subs",
  icon: "✦",
  profile: creatorProfile,
  leads: creatorPack.leads,
  transcripts: creatorPack.transcripts,
  trends: {
    totalLeadsSpark: [3, 3, 4, 5, 5, 6, 7],
    bookingRateSpark: [15, 18, 19, 21, 22, 24, 25],
    winRateSpark: [33, 35, 38, 40, 42, 44, 46],
    revenueSpark: [0, 0, 0, 1200, 1200, 1200, 1200],
    totalLeadsDelta: "+1 today",
    bookingRateDelta: "+1.0pp vs 7d",
    winRateDelta: "+2.0pp vs 7d",
    revenueDelta: "+$1.2k this week",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Info product funnel — Ethan Vale
// ─────────────────────────────────────────────────────────────────────────────
//
// VOICE CONTRACT:
//   sentence length:    variable — short hits + one mid-length reframe per turn
//   emoji:              🚀 or 🔥 strategically, never adjacent, max 1 per message
//   pacing:             energetic, italicized emphasis (*signal*, not *flop*)
//   confidence:         persuasive — names the lever, asserts the math
//   slang:              light internet-marketer ("rn", "pulls", "the band")
//   objection handling: reframe as positioning ("3 buyers is a *signal*, not a flop")
//   CTA style:          "want to grab 20 min? I'll pull your funnel apart live"
//   warmth:             medium — energetic but transactional, not personal
//   qualification:      offer + price + traffic channel + last launch numbers
//   follow-up:          anchors to artifacts (DM screenshots + sales page)

const infoProductProfile: Profile = {
  name: "Ethan Vale",
  niche: "high-ticket info products (selling $1k-5k courses via DM funnels)",
  offer: "a done-with-you DM funnel that turns one viral hook into 5-10 high-ticket calls per week",
  tone: "energetic, persuasive, casually direct — talks like someone who's read every clip and evolved past them",
  signaturePhrases: [
    "the offer is the lever, the funnel is the fulcrum",
    "you don't need traffic, you need throughput",
    "one good hook is a quarter of revenue",
  ],
  emojiHabits: "moderate — 🚀 🔥 for impact, never strung together",
  commonObjections: [
    "my niche is too small",
    "DM funnels feel salesy",
    "I've already tried a launch and it flopped",
  ],
  recentCaptions: [
    "Most courses fail because the offer is mid, not because the marketing is bad.",
    "If your DMs sound like a website headline, that's the problem. Sound like a friend who happens to sell something. 🔥",
    "Watched a creator drop a $97 course do $40k. Same creator's $2k version did $0. Price is positioning.",
  ],
  leadMagnet: "my 4-page DM funnel teardown",
};

const infoProductPack = pack("ip", [
  {
    personaId: "ip",
    igHandle: "demo_ip_kris.launches",
    intelligence: { coreInsight: "$1.5k course · IG-only · 8k followers", recommendedAction: "audit current funnel math", priority: "active" },
    name: "Kris",
    sourceContent: "Reel: 'why your launch flopped'",
    stage: "Engaged",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T15:00:00Z",
    temperature: "heating",
    aiHint: { label: "offer surfaced · $1.5k", tone: "signal" },
    activityLabel: "offer captured",
    relativeTime: "8m ago",
    unread: 1,
    messages: [
      ["agent", "Kris — you grabbed the teardown. quick — what are you selling rn? course, cohort, or coaching?", "2026-05-26T15:02:00Z"],
      ["lead", "trying to launch a $1.5k course, copywriting", "2026-05-26T15:20:00Z"],
      ["agent", "and where's the traffic coming from? IG, twitter, paid?", "2026-05-26T15:22:00Z"],
      ["lead", "IG mostly, ~8k followers", "2026-05-26T15:34:00Z"],
    ],
  },
  {
    personaId: "ip",
    igHandle: "demo_ip_nia.builds",
    intelligence: { coreInsight: "3 sales last launch · tight UGC niche", recommendedAction: "reframe: throughput, not traffic", priority: "active" },
    name: "Nia",
    sourceContent: "Reel: 'price is positioning'",
    stage: "Qualifying",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T11:30:00Z",
    messages: [
      ["agent", "Nia — current offer and price point?", "2026-05-26T11:33:00Z"],
      ["lead", "$997 self-paced course on UGC content for brands", "2026-05-26T12:40:00Z"],
      ["agent", "tight niche, that pulls. how many sales last launch?", "2026-05-26T12:45:00Z"],
      ["lead", "3. felt like a flop", "2026-05-26T13:35:00Z"],
      ["agent", "3 buyers is a *signal*, not a flop. it means the offer pulls — the throughput is the bottleneck. with a DM funnel and the same audience you're looking at 15-25 with no new content. 🚀", "2026-05-26T13:42:00Z"],
    ],
  },
  {
    personaId: "ip",
    igHandle: "demo_ip_chris.flopped",
    intelligence: { coreInsight: "last launch flopped · effort-skeptical", recommendedAction: "diagnostic call, not pitch", priority: "active" },
    name: "Chris",
    sourceContent: "Reel: 'why most courses fail'",
    stage: "Objection",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T08:00:00Z",
    temperature: "warm",
    aiHint: { label: "burned-once objection · reframed", tone: "warm" },
    activityLabel: "reframed past-failure",
    relativeTime: "6h ago",
    messages: [
      ["agent", "the DM funnel is plug-and-play once we get the offer right — open to a 20-min call to see if it's a fit?", "2026-05-26T08:20:00Z"],
      ["lead", "tried a launch already, was a disaster. not sure I want to throw more time at it", "2026-05-26T10:30:00Z", { kind: "objection", label: "burned-once objection" }],
      ["agent", "that's actually the strongest position to fix from — most flops are offer/positioning, not effort. the call is 20 min, free, and worst case you leave knowing exactly which one tanked the last launch.", "2026-05-26T10:38:00Z"],
      ["lead", "ok yeah that I'd take", "2026-05-26T11:00:00Z"],
    ],
  },
  {
    personaId: "ip",
    igHandle: "demo_ip_lola.scales",
    intelligence: { coreInsight: "🔥 reply · link sent 22h ago", recommendedAction: "wait full 24h before nudge", priority: "watch" },
    name: "Lola",
    sourceContent: "Reel: '$40k vs $0'",
    stage: "BookingSent",
    sentiment: "hot",
    revenue: null,
    firstContactAt: "2026-05-25T16:30:00Z",
    bookingLinkSentAt: "2026-05-25T18:30:00Z",
    messages: [
      ["agent", "want to grab 20 min? I'll pull your funnel apart live and you can decide if the system fits.", "2026-05-25T18:20:00Z"],
      ["lead", "yes 🔥", "2026-05-25T18:28:00Z"],
      ["agent", "[calendly link]", "2026-05-25T18:30:00Z"],
    ],
  },
  {
    personaId: "ip",
    igHandle: "demo_ip_zane.viral",
    intelligence: { coreInsight: "Thu 2pm locked · asked specific Qs", recommendedAction: "request DM screenshots + page", priority: "active" },
    name: "Zane",
    sourceContent: "Reel: 'one hook = quarter of revenue'",
    stage: "Booked",
    sentiment: "hot",
    revenue: null,
    firstContactAt: "2026-05-24T15:00:00Z",
    bookingLinkSentAt: "2026-05-25T09:30:00Z",
    messages: [
      ["agent", "open to a 20-min call this week?", "2026-05-25T09:25:00Z"],
      ["lead", "yeah", "2026-05-25T09:30:00Z"],
      ["agent", "[calendly link]", "2026-05-25T09:30:00Z"],
      ["lead", "Thursday 2pm — locked in", "2026-05-25T13:50:00Z"],
      ["agent", "see you Thursday. bring last 30 days of DM screenshots + your last sales page. that's the gold.", "2026-05-25T16:20:00Z"],
    ],
  },
  {
    personaId: "ip",
    igHandle: "demo_ip_brooke.5fig",
    intelligence: { coreInsight: "$2k course · 12 sales/q · DWY upsell", recommendedAction: "kickoff: funnel rewrite", priority: "active" },
    name: "Brooke",
    sourceContent: "Reel: 'throughput beats traffic'",
    stage: "Won",
    sentiment: "hot",
    revenue: 2500,
    firstContactAt: "2026-05-08T11:00:00Z",
    bookingLinkSentAt: "2026-05-12T09:00:00Z",
    temperature: "hot",
    aiHint: { label: "closed · DWY funnel", tone: "signal" },
    activityLabel: "$2,500 closed · 2d ago",
    relativeTime: "2d ago",
    messages: [
      ["agent", "Brooke — current offer, price, niche?", "2026-05-08T11:30:00Z"],
      ["lead", "$2k course, sales coaching for B2B reps. 12 sales last quarter", "2026-05-08T18:00:00Z"],
      ["agent", "good band. open to a 20-min call to pull the funnel apart?", "2026-05-09T09:30:00Z"],
      ["lead", "yes", "2026-05-11T14:00:00Z"],
      ["agent", "[calendly link]", "2026-05-12T09:00:00Z", { kind: "booking", label: "booking link sent" }],
      ["lead", "booked", "2026-05-12T09:30:00Z", { kind: "booking", label: "slot confirmed" }],
      ["agent", "great call. ready to roll? sending onboarding.", "2026-05-20T15:00:00Z"],
      ["lead", "in. let's go", "2026-05-21T10:00:00Z", { kind: "intent", label: "explicit close" }],
      ["agent", "🚀", "2026-05-23T11:00:00Z"],
    ],
    notes: [
      "Existing $2k course doing 12 sales/q · DWY funnel uplift target = 30+ sales/q.",
    ],
  },
  // Behavioral variance: hesitant booker — link sent but no click for 2 days.
  {
    personaId: "ip",
    igHandle: "demo_ip_sam.tier",
    intelligence: { coreInsight: "'will look later' · 2d silent since", recommendedAction: "switch to voice note", priority: "urgent" },
    name: "Sam",
    sourceContent: "Reel: 'price is positioning'",
    stage: "BookingSent",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-24T10:00:00Z",
    bookingLinkSentAt: "2026-05-24T18:00:00Z",
    temperature: "cooling",
    aiHint: { label: "hesitant · 2d no-click", tone: "warm" },
    activityLabel: "link sent 2d · no click",
    relativeTime: "2d ago",
    messages: [
      ["agent", "Sam — current offer + price?", "2026-05-24T10:05:00Z"],
      ["lead", "$3k course on AI prompts for marketers, 4 sales last month", "2026-05-24T15:30:00Z"],
      ["agent", "the math is the funnel. open to a 20-min call to look at it?", "2026-05-24T15:35:00Z"],
      ["lead", "yeah I think so", "2026-05-24T17:50:00Z"],
      ["agent", "[calendly link]", "2026-05-24T18:00:00Z", { kind: "booking", label: "booking link sent" }],
      ["lead", "ok will look later tonight", "2026-05-24T18:30:00Z", { kind: "ghost", label: "soft commitment · 2d gap" }],
    ],
    notes: [
      "Sent calendly 2d ago, soft 'will look later tonight' — followed by silence.",
      "Past optimal nudge window (24h) — needs a different angle than another link.",
    ],
  },
]);

const infoProductPersona: DemoPersona = {
  id: "ip",
  label: "Info product funnel",
  summary: "$1-5k courses via DM funnels",
  icon: "❖",
  profile: infoProductProfile,
  leads: infoProductPack.leads,
  transcripts: infoProductPack.transcripts,
  trends: {
    totalLeadsSpark: [5, 6, 7, 7, 8, 9, 10],
    bookingRateSpark: [24, 26, 28, 30, 32, 34, 35],
    winRateSpark: [42, 44, 46, 48, 49, 51, 52],
    revenueSpark: [0, 0, 0, 0, 2500, 2500, 2500],
    totalLeadsDelta: "+1 today",
    bookingRateDelta: "+1.0pp vs 7d",
    winRateDelta: "+1.0pp vs 7d",
    revenueDelta: "+$2.5k this week",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. SaaS closer — Devon Hayes
// ─────────────────────────────────────────────────────────────────────────────
//
// VOICE CONTRACT:
//   sentence length:    short-medium; declarative, often clipped
//   emoji:              none, ever
//   pacing:             tight, no warmth padding ("Name — ARPU, MRR, GTM?")
//   confidence:         contrarian-flat — states the principle, doesn't soften it
//   slang:              technical only (ICP, ARPU, MRR, SQL, GTM, closed-lost)
//   objection handling: reframe via principle ("engineers run the best discovery —
//                       you ask 'why' until something is true")
//   CTA style:          minimal — "open to 20 min?" — no embellishment
//   warmth:             low — first-name-only, no exclamations, no "love that"
//   qualification:      rapid quantitative — ARPU, MRR, channel mix, GTM motion
//   follow-up:          "bring your last 10 closed-lost reasons + ICP definition"

const saasProfile: Profile = {
  name: "Devon Hayes",
  niche: "B2B SaaS founder-led sales (sub-$200 ARPU SaaS)",
  offer: "a 45-day founder-led-sales playbook to get a B2B SaaS from $0 to $20k MRR without a sales hire",
  tone: "matter-of-fact, slightly contrarian, technically literate — talks shop, never hypes",
  signaturePhrases: [
    "sales is just discovery at scale",
    "ICP first, channel second, message third",
    "founders sell better than reps do — for the first $1M",
  ],
  emojiHabits: "none, ever",
  commonObjections: [
    "I'm an engineer, not a salesperson",
    "I don't have product-market fit yet",
    "outbound is dead for SaaS",
  ],
  recentCaptions: [
    "The founders complaining outbound is dead are the same ones whose ICP is 'anyone with money'.",
    "If your discovery call sounds like a demo, you're not doing discovery.",
    "The cheapest way to disqualify a bad ICP is to ask the next 10 prospects what tools they actually pay for. Most don't pay for anything close to yours.",
  ],
  leadMagnet: "my 60-min founder-led-sales playbook (Notion doc)",
};

const saasPack = pack("sa", [
  {
    personaId: "sa",
    igHandle: "demo_sa_dan.builds",
    intelligence: { coreInsight: "$99 ARPU · legal-ops · referral-only 24 cust", recommendedAction: "ask closed-lost reasons", priority: "active" },
    name: "Dan",
    sourceContent: "Post: 'most outbound is bad ICP'",
    stage: "Engaged",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T15:00:00Z",
    temperature: "heating",
    aiHint: { label: "ICP narrow · legal-ops", tone: "signal" },
    activityLabel: "qualifying · ARPU/MRR",
    relativeTime: "5m ago",
    unread: 1,
    messages: [
      ["agent", "Dan — you asked for the playbook. context first: what's the product, ARPU, current MRR?", "2026-05-26T15:02:00Z"],
      ["lead", "AI doc tool for legal ops teams. $99/mo ARPU. $2.4k MRR", "2026-05-26T15:20:00Z"],
      ["agent", "ICP is actually narrow which is good. how are the first 24 customers reaching you?", "2026-05-26T15:23:00Z"],
      ["lead", "all referrals from my last company", "2026-05-26T15:40:00Z"],
    ],
  },
  {
    personaId: "sa",
    igHandle: "demo_sa_pri.ships",
    intelligence: { coreInsight: "$8k MRR · 90% SEO · flat 2 months", recommendedAction: "frame outbound as ICP refresh", priority: "active" },
    name: "Pri",
    sourceContent: "Post: 'discovery vs demo'",
    stage: "Qualifying",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T11:00:00Z",
    messages: [
      ["agent", "Pri — current MRR, ARPU, and what % of pipeline is outbound vs inbound?", "2026-05-26T11:05:00Z"],
      ["lead", "$8k MRR, $149 ARPU, like 90% inbound through SEO", "2026-05-26T12:00:00Z"],
      ["agent", "fine spot. why are you adding outbound — saturating SEO or just want a second engine?", "2026-05-26T12:05:00Z"],
      ["lead", "the inbound flattened the last 2 months", "2026-05-26T13:20:00Z"],
      ["agent", "that's the right reason. the playbook is built for exactly that handoff — the first 30 conversations are also the cleanest ICP refresh you'll do all year.", "2026-05-26T13:30:00Z"],
    ],
  },
  {
    personaId: "sa",
    igHandle: "demo_sa_eng.ali",
    intelligence: { coreInsight: "'engineer not seller' identity block", recommendedAction: "preview script + scoring sheet", priority: "active" },
    name: "Ali",
    sourceContent: "Post: 'founders > reps for first $1M'",
    stage: "Objection",
    sentiment: "warm",
    revenue: null,
    firstContactAt: "2026-05-26T08:00:00Z",
    temperature: "warm",
    aiHint: { label: "identity objection · reframed", tone: "warm" },
    activityLabel: "engineer-not-seller · landed",
    relativeTime: "6h ago",
    messages: [
      ["agent", "the playbook is most useful pre-$50k MRR. if that's you, the 45-day version is built for the exact ramp.", "2026-05-26T08:20:00Z"],
      ["lead", "I'm an engineer though, not a salesperson. doing this myself sounds painful", "2026-05-26T10:00:00Z", { kind: "objection", label: "identity objection" }],
      ["agent", "engineers actually run the best discovery calls — you ask 'why' until something is true. the playbook isn't about being charming, it's a script and a scoring sheet. you'll feel mechanical for 2 weeks then it becomes intuitive.", "2026-05-26T10:10:00Z"],
      ["lead", "that's a different framing than I expected", "2026-05-26T10:45:00Z"],
    ],
  },
  {
    personaId: "sa",
    igHandle: "demo_sa_yusuf.mrr",
    intelligence: { coreInsight: "asked for link · quiet since", recommendedAction: "wait 24h, then ICP-data nudge", priority: "watch" },
    name: "Yusuf",
    sourceContent: "Post: 'bad ICP test'",
    stage: "BookingSent",
    sentiment: "hot",
    revenue: null,
    firstContactAt: "2026-05-25T17:00:00Z",
    bookingLinkSentAt: "2026-05-25T18:30:00Z",
    messages: [
      ["agent", "20-min call this week? I'll look at your ICP and outbound stats and tell you what the next 30 days should look like.", "2026-05-25T18:20:00Z"],
      ["lead", "yes", "2026-05-25T18:28:00Z"],
      ["agent", "[calendly link]", "2026-05-25T18:30:00Z"],
    ],
  },
  {
    personaId: "sa",
    igHandle: "demo_sa_kai.churn",
    intelligence: { coreInsight: "Tue 10am · asked for prep checklist", recommendedAction: "send closed-lost template", priority: "active" },
    name: "Kai",
    sourceContent: "Post: 'ICP first, channel second'",
    stage: "Booked",
    sentiment: "hot",
    revenue: null,
    firstContactAt: "2026-05-24T13:00:00Z",
    bookingLinkSentAt: "2026-05-25T09:00:00Z",
    messages: [
      ["agent", "open to a call?", "2026-05-25T08:50:00Z"],
      ["lead", "yeah", "2026-05-25T09:00:00Z"],
      ["agent", "[calendly link]", "2026-05-25T09:00:00Z"],
      ["lead", "booked for Tuesday 10am", "2026-05-25T13:30:00Z"],
      ["agent", "bring your last 10 closed-lost reasons + your current ICP definition. that's the highest-leverage artifact for the conversation.", "2026-05-25T16:15:00Z"],
    ],
  },
  {
    personaId: "sa",
    igHandle: "demo_sa_pat.closed",
    intelligence: { coreInsight: "$11k MRR · wants podcast-floor control", recommendedAction: "kickoff: 45-day playbook", priority: "active" },
    name: "Pat",
    sourceContent: "Post: 'sales is discovery at scale'",
    stage: "Won",
    sentiment: "hot",
    revenue: 3000,
    firstContactAt: "2026-05-09T10:00:00Z",
    bookingLinkSentAt: "2026-05-13T09:00:00Z",
    temperature: "hot",
    aiHint: { label: "closed · 45d playbook", tone: "signal" },
    activityLabel: "$3,000 closed · 4d ago",
    relativeTime: "4d ago",
    messages: [
      ["agent", "Pat — ARPU, MRR, current GTM?", "2026-05-09T10:20:00Z"],
      ["lead", "$179 ARPU, $11k MRR, all inbound from a podcast", "2026-05-09T19:00:00Z"],
      ["agent", "good cohort. why outbound now?", "2026-05-10T08:00:00Z"],
      ["lead", "the podcast inbound is unpredictable and I want to control the floor", "2026-05-10T11:30:00Z", { kind: "intent", label: "compelling reason · floor control" }],
      ["agent", "exactly the right reason. open to 20 min?", "2026-05-10T11:40:00Z"],
      ["lead", "yes", "2026-05-13T08:30:00Z"],
      ["agent", "[calendly link]", "2026-05-13T09:00:00Z", { kind: "booking", label: "booking link sent" }],
      ["lead", "booked", "2026-05-13T09:20:00Z", { kind: "booking", label: "slot confirmed" }],
      ["agent", "ready to run the 45-day playbook? sending onboarding.", "2026-05-21T14:00:00Z"],
      ["lead", "in", "2026-05-22T11:00:00Z", { kind: "intent", label: "explicit close" }],
    ],
    notes: ["$11k MRR · $179 ARPU · podcast-inbound dependency = ideal floor-control buyer."],
  },
  // Behavioral variance: stalled lead — no-PMF objection, conversation paused.
  {
    personaId: "sa",
    igHandle: "demo_sa_mei.protoype",
    intelligence: { coreInsight: "14% churn @ $49 ARPU · honest disqualify", recommendedAction: "hold 14d · monitor MRR", priority: "cold" },
    name: "Mei",
    sourceContent: "Post: 'discovery vs demo'",
    stage: "Objection",
    sentiment: "cold",
    revenue: null,
    firstContactAt: "2026-05-21T12:00:00Z",
    temperature: "stalled",
    aiHint: { label: "PMF objection · stalled 5d", tone: "warm" },
    activityLabel: "stalled · 5d silent",
    relativeTime: "5d ago",
    messages: [
      ["agent", "Mei — ARPU, MRR, current GTM?", "2026-05-21T12:05:00Z"],
      ["lead", "$49 ARPU, $1.2k MRR, mostly cold email + 1 referral", "2026-05-21T14:00:00Z"],
      ["agent", "what's churn looking like in the last 30 days?", "2026-05-21T14:05:00Z"],
      ["lead", "honestly bad. ~14%", "2026-05-21T17:30:00Z", { kind: "objection", label: "PMF objection · churn 14%" }],
      ["agent", "fair flag — 14% logo at sub-$50 ARPU usually means the ICP is off, not the message. the playbook front-loads ICP work for exactly this reason. open to a call to look at your last 10 closed-lost reasons?", "2026-05-21T17:35:00Z", { kind: "ghost", label: "no reply since" }],
    ],
    notes: [
      "Churn-driven PMF concern surfaced honestly — disqualified pre-call by design.",
      "Hold for 14d, re-engage if MRR/churn improves.",
    ],
  },
]);

const saasPersona: DemoPersona = {
  id: "sa",
  label: "SaaS closer",
  summary: "$0 → $20k MRR via founder-led sales",
  icon: "▣",
  profile: saasProfile,
  leads: saasPack.leads,
  transcripts: saasPack.transcripts,
  trends: {
    totalLeadsSpark: [2, 3, 4, 5, 5, 6, 7],
    bookingRateSpark: [18, 20, 23, 25, 27, 28, 30],
    winRateSpark: [33, 36, 38, 40, 42, 44, 45],
    revenueSpark: [0, 0, 0, 3000, 3000, 3000, 3000],
    totalLeadsDelta: "+1 today",
    bookingRateDelta: "+2.0pp vs 7d",
    winRateDelta: "+1.0pp vs 7d",
    revenueDelta: "+$3.0k this week",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const DEMO_PERSONAS: DemoPersona[] = [
  fitnessPersona,
  agencyPersona,
  creatorPersona,
  infoProductPersona,
  saasPersona,
];

export const DEFAULT_PERSONA_ID = "fit";

export function getPersona(id: string | null | undefined): DemoPersona {
  return DEMO_PERSONAS.find((p) => p.id === id) ?? DEMO_PERSONAS[0];
}

/** Sum of all simulated revenue across the active persona's Won leads. */
export function personaSimulatedRevenue(persona: DemoPersona): number {
  return persona.leads.reduce((sum, l) => sum + (l.revenue ?? 0), 0);
}

/** Per-stage demo counts — used to merge into the live byStage map. */
export function personaStageCounts(persona: DemoPersona): Record<LeadSummary["stage"], number> {
  const counts: Record<LeadSummary["stage"], number> = {
    New: 0,
    Engaged: 0,
    Qualifying: 0,
    Objection: 0,
    BookingSent: 0,
    Booked: 0,
    Won: 0,
    Lost: 0,
  };
  for (const l of persona.leads) counts[l.stage] += 1;
  return counts;
}
