/**
 * The Personality Layer — "the moat" (PRD §6.3).
 *
 * Each influencer gets a master profile that makes the agent talk exactly
 * like them. It is built from two inputs:
 *   1. A questionnaire (tone, phrases, emoji habits, offer, objections)
 *   2. Content analysis (their recent captions, auto-learned voice)
 *
 * This profile is rendered into the agent's *system prompt*, which is the
 * stable, cacheable prefix of every Claude request for that influencer.
 */

export interface PersonalityProfile {
  /** Influencer display name, e.g. "Alex Rivera". */
  name: string;
  /** Their niche — fitness, finance, coaching, etc. */
  niche: string;
  /** The transformation they sell, in their words. */
  offer: string;
  /** 1-2 sentences describing their tone (e.g. "warm, no-BS, hype but real"). */
  tone: string;
  /** Phrases / slang they actually use, lifted from their content. */
  signaturePhrases: string[];
  /** How they use emoji: "sparingly", "lots of 🔥💪", "never", etc. */
  emojiHabits: string;
  /** The objections they hear most, so the agent can pre-empt them. */
  commonObjections: string[];
  /** Raw recent captions/stories — fed in for voice grounding. */
  recentCaptions: string[];
  /** The promised lead magnet / CTA payoff (e.g. "my free 7-day plan"). */
  leadMagnet: string;
}

/**
 * Inputs you typically have on day one (questionnaire only). Content
 * analysis (`recentCaptions`) can be empty and filled in later.
 */
export type ProfileDraft = Omit<PersonalityProfile, "recentCaptions"> &
  Partial<Pick<PersonalityProfile, "recentCaptions">>;

export function buildProfile(draft: ProfileDraft): PersonalityProfile {
  return { recentCaptions: [], ...draft };
}

/**
 * A worked example profile — also used by the local conversation simulator
 * and tests so the system is runnable with zero setup.
 */
export const EXAMPLE_PROFILE: PersonalityProfile = {
  name: "Alex Rivera",
  niche: "fitness (busy professionals)",
  offer:
    "a 12-week body recomposition coaching program for people who sit at a desk all day",
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
