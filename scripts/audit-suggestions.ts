/**
 * One-shot diagnostic: for every node, for every variant set, for every chip,
 * print  chip → classified intent → next node from that chip.
 *
 * Used to catch mismatches like "I genuinely can't afford anything" on the
 * OBJ_PRICING node routing to REPOSITION (i.e., the agent confidently sends
 * the booking link as if the lead agreed).
 *
 * Run with: tsx scripts/audit-suggestions.ts
 */
import { NODES, TRANSITIONS, type NodeId } from "../src/api/simulator/graph.js";
import { classify, type LeadIntent } from "../src/api/simulator/intent.js";

function nextFrom(from: NodeId, intent: LeadIntent): NodeId {
  // Mirror the engine's hard STOP override (see engine.ts:send()).
  if (intent === "stop") return "STOPPED";
  const table = TRANSITIONS[from];
  if (table[intent]) return table[intent]!;
  if (table["*"]) return table["*"]!;
  return "ASKING_FOR_BOOKING";
}

const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

let mismatches = 0;
for (const [id, def] of Object.entries(NODES) as Array<[NodeId, (typeof NODES)[NodeId]]>) {
  if (def.terminal) continue;
  const variants = def.suggestions ?? [];
  console.log(`\n${DIM}── ${id} (${def.stage}/${def.sentiment}) ──${RESET}`);
  for (const [vi, variant] of variants.entries()) {
    console.log(`  variant ${vi}:`);
    for (const chip of variant) {
      const intent = classify(chip);
      const next = nextFrom(id, intent);
      // Flag awkward routes:
      //   - chip implies hesitation but the engine treats it as agreement
      //     (lands on SEND_BOOKING with no closing context).
      //   - chip routes to STOPPED but didn't actually ask to stop.
      //   - chip raises an objection the engine already handled (re-loop).
      const looksLikeHesitation =
        /not sure|think about|hesitant|fence|i'?m not ready|give me (?:a )?sec|changed?\s+my\s+mind/i.test(chip);
      const stoppedWithoutAsking =
        next === "STOPPED" &&
        !/(stop\s+(?:messaging|texting|sending|that)|unsubscribe|leave me alone|don'?t (?:text|message|contact))/i.test(
          chip,
        );
      const hesitationRoutesToWrongPlace =
        looksLikeHesitation &&
        (intent !== "hesitation" && intent !== "negative") &&
        (next === "SEND_BOOKING" || next === "BOOKED");
      const awkward = stoppedWithoutAsking || hesitationRoutesToWrongPlace;
      const color = awkward ? RED : intent === "other" ? YELLOW : GREEN;
      const flag = awkward ? "  ← MISMATCH" : "";
      if (awkward) mismatches++;
      console.log(
        `    ${color}"${chip}"${RESET}  ${DIM}→${RESET} ${intent}  ${DIM}→${RESET} ${next}${flag}`,
      );
    }
  }
}

console.log(
  `\n${mismatches === 0 ? GREEN : RED}${mismatches} mismatches${RESET}`,
);
process.exit(mismatches > 0 ? 1 : 0);
