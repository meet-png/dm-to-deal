/**
 * Lightweight intent classifier for the demo simulator.
 *
 * Real production would use the LLM with a structured-output intent field, but
 * for the public, key-less demo this needs to be deterministic and cheap.
 * Keyword + regex with a priority order is good enough to cover the paths the
 * conversation graph actually branches on.
 *
 * Priority matters:
 * - `stop` requires explicit messaging context (so `"stop feeling stiff"` is
 *   NOT a compliance stop — it's pain_stated).
 * - Objections beat positives, so `"ok but how much"` is `obj_pricing`.
 * - `hesitation` beats `positive` (so `"ok still not sure"` is hesitation).
 * - `confused` requires a clear cue (a `?` or a known phrase) so the open-
 *   ended `"what makes you different"` isn't misclassified.
 */

export type LeadIntent =
  | "stop" // hard compliance stop
  | "negative" // not interested / leave me alone
  | "obj_pricing"
  | "obj_trust"
  | "obj_history" // tried things, didn't work
  | "obj_timing"
  | "obj_curiosity" // wants more info first
  | "hesitation" // uncertain — "still not sure", "give me a sec", "I'm not ready"
  | "goal_stated"
  | "pain_stated"
  | "positive"
  | "confused"
  | "other";

interface Rule {
  intent: LeadIntent;
  re: RegExp;
}

/**
 * Order = priority. First non-positive match wins; positive is matched last
 * so it never overrides an objection or hesitation that appears in the same
 * sentence.
 */
const RULES: Rule[] = [
  // 1. Hard compliance — require explicit "stop ME" / "stop messaging" wording
  //    so `"stop feeling stiff"` doesn't accidentally terminate the session.
  {
    intent: "stop",
    re: /(?:\bstop\s+(?:messaging|texting|sending|contact(?:ing)?|dm(?:ing)?\s+me|that)|\bunsubscribe\b|\bleave\s+me\s+alone\b|\bdon'?t\s+(?:text|message|contact)(?:\s+me)?\b)/i,
  },
  // 2. Hard no.
  {
    intent: "negative",
    re: /\b(not\s+interested|no\s+thanks?|nah|fuck\s+off|piss\s+off|never\s+mind|nevermind|bye)\b/i,
  },
  // 3. Objections — most specific first.
  {
    intent: "obj_pricing",
    re: /(how\s+much|what(?:'?s| is)?\s+the\s+(?:cost|price)|cost|price|expensive|cant\s+afford|can'?t\s+afford|too\s+pricey|\$|\bmoney\s+(?:is|gets?)\s+(?:\w+\s+)?(?:tight|short|low)|tight\s+(?:on|with)\s+(?:money|cash|budget)|what\s+if\s+i\s+can'?t\s+pay)/i,
  },
  {
    intent: "obj_trust",
    re: /\b(scam|legit|real\s+(deal|thing)|fake|sketchy|are\s+you\s+(real|a\s+bot|human)|proof|guarantee|results.*real|case\s+stud(?:y|ies)|testimonials?|before[/-]?after|scammed)\b/i,
  },
  {
    intent: "obj_history",
    re: /\b(tried\s+(?:it|before|programs?|stuff)|didn'?t\s+work|never\s+worked|wasted|burned\s+out|burnt\s+out|burned?\s+\d+\s+times?|quit|gave\s+up|fell\s+off|let\s+me\s+down)\b/i,
  },
  {
    intent: "obj_timing",
    re: /\b(later|next\s+(week|month|year)|not\s+(?:right\s+)?now|busy|swamped|holidays|maybe\s+in|too\s+busy|no\s+time|10\s*-?\s*hour|10\s+hr)\b/i,
  },
  {
    intent: "obj_curiosity",
    re: /\b(what\s+(is|do|does|exactly|makes)|how\s+(do|does|will|exactly)\s+(it|this)\s+work|tell\s+me\s+more|more\s+info|explain|what'?s\s+(the|in)|what'?s\s+different|how'?s\s+it\s+work)\b/i,
  },
  // 4. Hesitation — uncertain, not "no". Must come BEFORE positive so
  //    `"ok still not sure"` doesn't get marked as agreement.
  {
    intent: "hesitation",
    re: /\b(still\s+not\s+sure|need\s+to\s+think|i'?ll\s+think(?:\s+about\s+it)?|think\s+about\s+it|give\s+me\s+(?:a\s+)?(?:sec(?:ond)?|min(?:ute)?)|i'?m\s+not\s+ready|not\s+sure\s+(?:yet|honestly|tbh|rn)|let\s+me\s+think|hesitant|on\s+the\s+fence|change(?:d)?\s+my\s+mind|just\s+thinking)\b/i,
  },
  // 5. Volunteered goal — require an outcome verb to avoid matching the
  //    standalone "want to" in negatives like "don't want to be sold to".
  {
    intent: "goal_stated",
    re: /\b(lose\s+(?:weight|fat|\d+\s*lbs?|kg)|get\s+(?:fit|in\s+shape|stronger|leaner|lean)|put\s+on\s+muscle|gain\s+muscle|feel\s+better|more\s+energy|tone\s+up|want\s+to\s+(?:lose|gain|get|feel|build|look|be\s+(?:lean|fit|strong|stronger)|reach))\b/i,
  },
  // 6. Volunteered pain.
  {
    intent: "pain_stated",
    re: /\b(stuck|struggling|struggle|exhausted|tired\s+of|burnt\s+out|burned\s+out|feel\s+(?:awful|terrible|like\s+(?:crap|shit))|hate\s+(?:my|how)|stiff|sore|out\s+of\s+shape|gained|skinny\s+fat|sit\s+all\s+day|desk\s+all\s+day|back\s+(?:hurts|kills)|kills\s+me)\b/i,
  },
  // 7. Generic positive — last so anything more specific wins.
  {
    intent: "positive",
    re: /\b(yes|yeah|yep|yup|sure|ok|okay|sounds\s+good|let'?s\s+do\s+it|i'?m\s+in|down|alright|cool|fine|works\s+for\s+me|sign\s+me\s+up|sure\s+thing|ya|book\s+me|send\s+(?:it|me|the))\b/i,
  },
  // 8. Confused — require a clear cue, not bare "what".
  {
    intent: "confused",
    re: /(?:\bhuh\??\b|what\?{1,3}(?!\s+\w)|\bwait,?\s+what\b|\bi\s+don'?t\s+(?:get|understand)|\bhmm+\??\b)/i,
  },
];

/**
 * Classify a lead's reply. Returns the single most relevant intent.
 *
 * Strategy:
 * 1. Walk the rules in priority order.
 * 2. The first match wins, except `positive` which is overridden by anything
 *    later (so a sentence that's both "ok" and "still not sure" is hesitation,
 *    not positive).
 * 3. Empty / whitespace-only input → `other`.
 */
export function classify(text: string): LeadIntent {
  const cleaned = text.trim();
  if (!cleaned) return "other";

  // First pass — find the highest-priority non-positive match.
  let positiveMatch = false;
  for (const r of RULES) {
    if (!r.re.test(cleaned)) continue;
    if (r.intent === "positive") {
      positiveMatch = true;
      continue;
    }
    return r.intent;
  }
  return positiveMatch ? "positive" : "other";
}
