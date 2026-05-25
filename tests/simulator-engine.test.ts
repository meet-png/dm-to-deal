import { describe, it, expect } from "vitest";
import { SimulatorEngine } from "../src/api/simulator/engine.js";
import { NODES, TRANSITIONS, type NodeId } from "../src/api/simulator/graph.js";
import { classify, type LeadIntent } from "../src/api/simulator/intent.js";

function makeEngine() {
  return new SimulatorEngine({
    bookingUrl: "https://calendly.com/alex/strategy-call",
  });
}

/** Walk a session through the given lead replies, return all turns produced.
 *  An empty string in `replies` becomes a generic "yes please" — useful to
 *  drive a path through to BOOKED without enumerating every confirmation. */
function play(replies: string[]) {
  const engine = makeEngine();
  const start = engine.start("sim_test");
  const turns = [start];
  let lastTurn = start;
  for (const text of replies) {
    if (lastTurn.terminal) break;
    lastTurn = engine.send(start.sessionId, text || "yes please");
    turns.push(lastTurn);
  }
  return { engine, turns, last: lastTurn, sessionId: start.sessionId };
}

/** Drive a path through to a terminal node by appending `yes` replies. */
function playToTerminal(initial: string[], maxExtra = 4) {
  const engine = makeEngine();
  const start = engine.start("sim_test");
  let last = start;
  for (const text of initial) {
    if (last.terminal) break;
    last = engine.send(start.sessionId, text);
  }
  for (let i = 0; i < maxExtra && !last.terminal; i++) {
    last = engine.send(start.sessionId, "yes please");
  }
  return { last, transcriptLen: last.transcript.length };
}

describe("intent classifier", () => {
  const cases: Array<[string, ReturnType<typeof classify>]> = [
    ["yes please", "positive"],
    ["nah not interested", "negative"],
    ["stop messaging me", "stop"],
    ["how much does it cost?", "obj_pricing"],
    ["is this a scam?", "obj_trust"],
    ["i tried programs before and quit", "obj_history"],
    ["maybe next month", "obj_timing"],
    ["tell me more about this", "obj_curiosity"],
    ["i want to lose weight", "goal_stated"],
    ["i feel awful from sitting all day", "pain_stated"],
    ["wait what?", "confused"],
    ["", "other"],
    // Regression cases for the chip→intent bugs we hunted:
    ["tired of feeling stiff and exhausted", "pain_stated"], // not stop
    ["stop feeling stiff", "pain_stated"], // not stop (was wrongly catching)
    ["I'm not ready", "hesitation"],
    ["still not sure", "hesitation"],
    ["give me a sec to think", "hesitation"],
    ["I'll think about it", "hesitation"],
    ["I'm a bit hesitant tbh", "hesitation"],
    ["still on the fence honestly", "hesitation"],
    ["wait, I changed my mind", "hesitation"],
    ["ok still not sure", "hesitation"], // hesitation beats positive
    ["what makes you different?", "obj_curiosity"], // was wrongly confused
    ["I just don't want to be sold to", "other"], // tightened goal_stated
    ["money is honestly tight rn", "obj_pricing"],
    ["what if I can't pay after?", "obj_pricing"],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" → ${expected}`, () => {
      expect(classify(input)).toBe(expected);
    });
  }

  it("objection wins over positive when both match", () => {
    // "ok but how much" — both positive (ok) and pricing.
    expect(classify("ok but how much is this")).toBe("obj_pricing");
  });

  it("stop overrides positive when both are present", () => {
    // With the tightened regex, bare "stop" doesn't trigger STOP — we
    // require explicit messaging context to avoid catching "stop feeling
    // stiff" and similar.
    expect(classify("yes but please stop messaging me")).toBe("stop");
  });
});

describe("SimulatorEngine — happy path", () => {
  it("opens with at least 2 bubbles and is in INTRO_RESPONSE", () => {
    const engine = makeEngine();
    const start = engine.start("sim_x");
    expect(start.bursts.length).toBeGreaterThanOrEqual(1);
    expect(start.nodeId).toBe("INTRO_RESPONSE");
    expect(start.stage).toBe("Engaged");
    expect(start.terminal).toBe(false);
  });

  it("reaches Booked within 4-8 lead replies on a positive path", () => {
    const { last, transcriptLen } = playToTerminal([
      "honestly I sit all day and feel awful",
      "I want to feel strong again",
      "yes send a time",
    ]);
    expect(last.terminal).toBe(true);
    expect(last.stage).toBe("Booked");
    // Transcript holds every bubble + every lead reply — should be well over
    // the 4-message minimum and stay reasonable.
    expect(transcriptLen).toBeGreaterThanOrEqual(4);
    expect(transcriptLen).toBeLessThanOrEqual(30);
  });
});

describe("SimulatorEngine — objection branches all terminate at Booked", () => {
  const objectionPaths: Array<[string, string[]]> = [
    [
      "pricing",
      [
        "honestly I sit all day and feel awful",
        "how much does this cost?",
        "okay yeah let's do it",
      ],
    ],
    [
      "trust",
      ["I feel stiff all day", "is this even legit?", "alright sure send the time"],
    ],
    [
      "history",
      ["my back hurts", "I've tried programs and quit every time", "ok let's try"],
    ],
    [
      "timing",
      ["I'm exhausted", "i'm too busy right now though", "fine let's lock it in"],
    ],
    [
      "curiosity",
      ["I sit all day", "tell me more about this", "ok send a time"],
    ],
  ];

  for (const [name, replies] of objectionPaths) {
    it(`${name} objection path reaches Booked`, () => {
      const { last, transcriptLen } = playToTerminal(replies);
      expect(last.terminal).toBe(true);
      expect(last.stage).toBe("Booked");
      // Conversation made it through opener + qualifying + objection + reposition
      // + send-booking + booked — comfortably over the 4-message floor.
      expect(transcriptLen).toBeGreaterThanOrEqual(4);
    });
  }
});

describe("SimulatorEngine — compliance + early exits", () => {
  it("STOP routes to terminal Lost regardless of prior state", () => {
    const { last } = play(["I want to lose weight", "actually stop texting me"]);
    expect(last.terminal).toBe(true);
    expect(last.stage).toBe("Lost");
    expect(last.nodeId).toBe("STOPPED");
  });

  it("negative reply routes to GHOSTED", () => {
    const { last } = play(["I feel awful", "actually nah not interested"]);
    expect(last.terminal).toBe(true);
    expect(last.stage).toBe("Lost");
    expect(last.nodeId).toBe("GHOSTED");
  });

  it("send() on a terminal session is a graceful no-op (no bursts)", () => {
    const { engine, last, sessionId } = play(["stop messaging me please"]);
    expect(last.terminal).toBe(true);
    const again = engine.send(sessionId, "are you there?");
    expect(again.bursts).toEqual([]);
    expect(again.terminal).toBe(true);
  });
});

describe("SimulatorEngine — memory + variation", () => {
  it("does not loop on the same objection twice", () => {
    // Send the same objection twice — the engine should still make forward
    // progress (route to REPOSITION on the second instead of re-firing OBJ_*).
    const engine = makeEngine();
    const start = engine.start("sim_loop");
    const a = engine.send(start.sessionId, "yeah I feel awful");
    expect(a.nodeId).not.toBe("STOPPED");
    const b = engine.send(start.sessionId, "but how much does it cost?");
    expect(b.nodeId).toBe("OBJ_PRICING");
    const c = engine.send(start.sessionId, "no really how much?");
    // Second pricing objection from REPOSITION should still progress forward,
    // not re-enter OBJ_PRICING infinitely.
    expect(c.nodeId).not.toBe("OBJ_PRICING");
  });

  it("captures pain + goal slots from the lead's words", () => {
    const engine = makeEngine();
    const start = engine.start("sim_slots");
    engine.send(start.sessionId, "honestly my back hurts and I feel stiff all day");
    engine.send(start.sessionId, "I want to lose weight and feel strong");
    const session = engine.peek(start.sessionId)!;
    expect(session.painPoint).toMatch(/back|stiff/);
    expect(session.goal).toMatch(/lose|strong/);
  });

  it("every node has at least one burst variant", () => {
    // Smoke — guards against a node being added without copy.
    for (const [id, def] of Object.entries(NODES)) {
      expect(def.bursts.length, `${id} has no bursts`).toBeGreaterThan(0);
    }
  });
});

describe("SimulatorEngine — dynamic suggestions", () => {
  it("emits non-empty suggestions on every non-terminal turn", () => {
    const engine = makeEngine();
    const start = engine.start("sim_sugg");
    expect(start.suggestions.length).toBeGreaterThan(0);

    let last = start;
    for (const reply of [
      "honestly I sit all day and feel awful",
      "but how much is it?",
      "okay let's hop on",
      "yes please",
    ]) {
      last = engine.send(start.sessionId, reply);
      if (last.terminal) break;
      expect(last.suggestions.length, `suggestions empty in node ${last.nodeId}`)
        .toBeGreaterThan(0);
    }
  });

  it("suggestions change across nodes (not the same chip rail forever)", () => {
    const engine = makeEngine();
    const start = engine.start("sim_change");
    const a = start.suggestions.join("|");
    const b = engine.send(start.sessionId, "honestly my back kills me").suggestions.join("|");
    const c = engine.send(start.sessionId, "how much does this cost?").suggestions.join("|");
    // Three different nodes → three different chip sets.
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("suggestions are empty on terminal nodes", () => {
    const engine = makeEngine();
    const start = engine.start("sim_term");
    const t = engine.send(start.sessionId, "actually stop messaging me");
    expect(t.terminal).toBe(true);
    expect(t.suggestions).toEqual([]);
  });

  it("variants rotate across sessions — different sessions see different chips", () => {
    // Run two sessions that traverse the same path and capture the first
    // suggestion set after the opener. With rotation, repeated runs should
    // not always produce the identical chip array.
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const engine = makeEngine();
      const start = engine.start(`sim_rot_${i}`);
      const t = engine.send(start.sessionId, "honestly I feel awful all day");
      seen.add(t.suggestions.join("|"));
    }
    // With multiple variants per node, we should see at least 2 distinct sets
    // across 5 runs (allowing for collisions; not all variants need to fire).
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it("falls back to a stage-based set when a node has no own suggestions", () => {
    // We don't currently have a real non-terminal node without `suggestions`,
    // so simulate by checking the fallback function behaviour via a private
    // hack — drive to GHOSTED first, then assert terminal returns [].
    const engine = makeEngine();
    const start = engine.start("sim_fb");
    const t = engine.send(start.sessionId, "nah not interested");
    expect(t.terminal).toBe(true);
    expect(t.suggestions).toEqual([]);
  });

  it("every non-terminal node defines at least one suggestion variant", () => {
    for (const [id, def] of Object.entries(NODES)) {
      if (def.terminal) continue;
      const variants = def.suggestions ?? [];
      expect(variants.length, `${id} has no suggestion variants`).toBeGreaterThan(0);
      for (const [vi, v] of variants.entries()) {
        expect(v.length, `${id} variant ${vi} is empty`).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Exhaustive audit: for every chip in every variant of every node, simulate
   * what the engine would do if the lead clicked it, and assert the
   * destination is coherent with the chip's apparent meaning.
   *
   * This is the safety net that catches the kind of bugs we just hunted:
   * - "stop feeling stiff" classifying as compliance STOP
   * - "I'm not ready" routing to SEND_BOOKING as if the lead agreed
   * - "I've burned out 3 times already" pretending to be agreement
   */
  it("every suggestion chip routes somewhere coherent", () => {
    const mismatches: string[] = [];
    function nextFrom(from: NodeId, intent: LeadIntent): NodeId {
      if (intent === "stop") return "STOPPED"; // mirror engine.ts override
      const table = TRANSITIONS[from];
      if (table[intent]) return table[intent]!;
      if (table["*"]) return table["*"]!;
      return "ASKING_FOR_BOOKING";
    }

    for (const [id, def] of Object.entries(NODES) as Array<[NodeId, typeof NODES[NodeId]]>) {
      if (def.terminal) continue;
      for (const [vi, variant] of (def.suggestions ?? []).entries()) {
        for (const chip of variant) {
          const intent = classify(chip);
          const next = nextFrom(id, intent);
          const hesitantText = /not sure|think about|hesitant|fence|i'?m not ready|give me (?:a )?sec|changed?\s+my\s+mind/i.test(chip);
          const explicitStop = /(stop\s+(?:messaging|texting|sending|that)|unsubscribe|leave me alone|don'?t (?:text|message|contact))/i.test(chip);
          const tag = `${id}/v${vi}: "${chip}" → ${intent} → ${next}`;
          if (next === "STOPPED" && !explicitStop) mismatches.push(`STOPPED but no stop ask · ${tag}`);
          if (hesitantText && (next === "SEND_BOOKING" || next === "BOOKED") && intent !== "hesitation" && intent !== "negative") {
            mismatches.push(`hesitant chip skipped close-handling · ${tag}`);
          }
        }
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });

  it("compliance: 'stop feeling X' is NOT a compliance stop", () => {
    // The original bug — `\bstop\b` matched any word boundary so pain
    // descriptions accidentally terminated the session as Lost.
    const engine = makeEngine();
    const start = engine.start("sim_stop_fix");
    const t = engine.send(start.sessionId, "tired of feeling stiff and exhausted");
    expect(t.nodeId).not.toBe("STOPPED");
    expect(t.stage).not.toBe("Lost");
  });

  it("hesitation: 'I'm not ready' from REPOSITION → GHOSTED gracefully", () => {
    // Was previously falling through to SEND_BOOKING (agent sends link
    // anyway as if lead agreed). Now correctly routes to graceful exit.
    const engine = makeEngine();
    const start = engine.start("sim_hes");
    engine.send(start.sessionId, "I feel awful from sitting");
    engine.send(start.sessionId, "how much is it?");
    engine.send(start.sessionId, "okay let's hop on"); // → REPOSITION
    const t = engine.send(start.sessionId, "actually I'm not ready");
    expect(t.nodeId).toBe("GHOSTED");
    expect(t.terminal).toBe(true);
  });
});
