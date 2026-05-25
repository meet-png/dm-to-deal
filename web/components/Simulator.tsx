"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { SimBubble, SimTurn, TranscriptMessage } from "@/lib/types";
import { StageBadge, SentimentDot } from "./Badges";

/**
 * Cinematic live simulator.
 *
 * Reads bursts (1-3 agent bubbles with per-bubble typing delays) from the
 * backend and animates them in like a real human texting — "typing…" hovers
 * between bubbles, each lands at its own pace. Stage + sentiment badges
 * update the moment the server says so, so the lead visibly moves through
 * the pipeline as the conversation unfolds.
 *
 * `persist`: when true, the underlying session writes to the real LeadStore
 * (used by the operator dashboard). Default false — the public landing-page
 * simulator stays sandboxed.
 */
export interface SimulatorProps {
  persist?: boolean;
}

/**
 * Quick replies are NOT defined in this file anymore — they come from the
 * backend on every turn (`turn.suggestions`). The engine ties each set to the
 * current conversation-graph node, rotates variants for variety, and falls
 * back to stage-based defaults if a node ships without explicit copy.
 *
 * If you find yourself adding a hardcoded reply chip here: stop. Add it to
 * `src/api/simulator/graph.ts` under the relevant node's `suggestions`
 * field instead, so the rail stays in sync with the conversation state.
 */

export function Simulator({ persist = false }: SimulatorProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [displayed, setDisplayed] = useState<TranscriptMessage[]>([]);
  const [stage, setStage] = useState<SimTurn["stage"]>("New");
  const [sentiment, setSentiment] = useState<SimTurn["sentiment"]>("warm");
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [terminal, setTerminal] = useState(false);
  const [typing, setTyping] = useState(false);
  const [composerLocked, setComposerLocked] = useState(true);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Graph-driven contextual replies, refreshed on every turn from the API. */
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Guard against double-mount in React strict mode kicking off two sessions.
  const startedRef = useRef(false);

  /** Animate a burst: show typing → land bubble → repeat. */
  const playBurst = useCallback(async (bursts: SimBubble[]) => {
    setComposerLocked(true);
    for (const bubble of bursts) {
      setTyping(true);
      await sleep(bubble.typingMs);
      setTyping(false);
      setDisplayed((prev) => [
        ...prev,
        { role: "agent", text: bubble.text, at: new Date().toISOString() },
      ]);
      // Tiny breath between bubbles so they don't feel machine-gun fast.
      await sleep(180);
    }
    setComposerLocked(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setComposerLocked(true);
    setDisplayed([]);
    setTerminal(false);
    try {
      const turn = await api.simulateStart({ persist });
      setSessionId(turn.sessionId);
      setStage(turn.stage);
      setSentiment(turn.sentiment);
      setNodeId(turn.nodeId);
      setTerminal(turn.terminal);
      // Hide the rail while the agent is mid-burst — feels wrong to show
      // chips before the assistant has finished talking. Reveal after.
      setSuggestions([]);
      await playBurst(turn.bursts);
      setSuggestions(turn.suggestions);
    } catch {
      setError("Backend offline — run `npm run dev` in the project root.");
      setComposerLocked(false);
    }
  }, [persist, playBurst]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
  }, [start]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [displayed, typing]);

  async function send(text: string) {
    if (!sessionId || composerLocked || terminal) return;
    const t = text.trim();
    if (!t) return;
    setInput("");
    setError(null);
    // Optimistic echo of the lead's message.
    setDisplayed((prev) => [...prev, { role: "lead", text: t, at: new Date().toISOString() }]);
    setComposerLocked(true);
    setSuggestions([]); // dim the rail while the agent thinks/types
    try {
      const turn = await api.simulateMessage(sessionId, t);
      setStage(turn.stage);
      setSentiment(turn.sentiment);
      setNodeId(turn.nodeId);
      setTerminal(turn.terminal);
      await playBurst(turn.bursts);
      // Refresh the rail with the new node's suggestions only after the
      // agent has finished typing — keeps focus on the message, not the chips.
      setSuggestions(turn.suggestions);
    } catch {
      setError("Session expired — restarting…");
      startedRef.current = false;
      await start();
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="card overflow-hidden">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-ink-700 bg-ink-900/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-hot/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warm/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-signal/70" />
          <span className="mono-label ml-2">live agent · @alex.rivera</span>
        </div>
        <div
          key={`${stage}-${sentiment}`}
          className="flex items-center gap-3 animate-fade-up"
        >
          <SentimentDot sentiment={sentiment} />
          <StageBadge stage={stage} />
        </div>
      </div>

      {/* transcript */}
      <div ref={scrollRef} className="h-[380px] space-y-3 overflow-y-auto px-4 py-4">
        {displayed.length === 0 && !error && !typing && (
          <p className="mono-label">booting agent…</p>
        )}
        {displayed.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {typing && <TypingIndicator />}
        {error && <p className="font-mono text-xs text-warm">{error}</p>}
        {terminal && !typing && (
          <div className="mt-4 flex items-center justify-between rounded-md border border-ink-700 bg-ink-900/60 px-3 py-2">
            <span className="mono-label">
              conversation over — {stage === "Booked" ? "booked ✓" : "lost"}
            </span>
            <button
              onClick={() => {
                startedRef.current = false;
                void start();
              }}
              className="rounded-md border border-signal/40 px-2.5 py-1 font-mono text-xs text-signal transition hover:bg-signal/10"
            >
              start over →
            </button>
          </div>
        )}
      </div>

      {/* Graph-driven quick replies — refresh after every assistant burst.
          `key` on the wrapper triggers the fade-up animation when the set
          changes, so the swap feels intentional, not jarring. */}
      {!terminal && (
        <div
          key={suggestions.join("|") || "empty"}
          className="flex min-h-[40px] flex-wrap gap-2 border-t border-ink-700 px-4 pt-3 animate-fade-up"
        >
          {suggestions.length === 0 && (
            <span className="font-mono text-[10px] text-fog-faint/60">
              {composerLocked ? "… preparing reply options …" : "type freely or wait for suggestions"}
            </span>
          )}
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              disabled={composerLocked}
              onClick={() => void send(q)}
              className="rounded-full border border-ink-700 px-3 py-1 text-xs text-fog-muted transition hover:border-signal/50 hover:text-fog disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* composer */}
      <form onSubmit={onSubmit} className="flex gap-2 px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={terminal ? "conversation ended" : "Reply as the lead…"}
          disabled={composerLocked || terminal}
          className="flex-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-fog placeholder:text-fog-faint focus:border-signal/60 focus:outline-none"
        />
        <button
          type="submit"
          disabled={composerLocked || terminal || !input.trim()}
          className="btn-signal disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: TranscriptMessage }) {
  const isAgent = message.role === "agent";
  // If the bubble text is a bare booking URL, render it as a hyperlink chip
  // so it visually pops and the cursor changes — closer-style "tap to book".
  const isUrl = isAgent && /^https?:\/\/\S+$/.test(message.text);
  if (isUrl) {
    return (
      <div className="flex justify-start animate-fade-up">
        <a
          href={message.text}
          target="_blank"
          rel="noreferrer"
          className="max-w-[80%] rounded-2xl rounded-tl-sm border border-signal/60 bg-signal/10 px-3.5 py-2 text-sm font-mono text-signal transition hover:bg-signal/15"
        >
          📅 {message.text}
        </a>
      </div>
    );
  }
  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"} animate-fade-up`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          isAgent
            ? "rounded-tl-sm border border-ink-700 bg-ink-800 text-fog"
            : "rounded-tr-sm bg-signal/15 text-fog"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm border border-ink-700 bg-ink-800 px-3 py-2.5">
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-pulse rounded-full bg-fog-muted"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
