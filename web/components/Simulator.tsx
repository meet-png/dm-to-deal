"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { SimTurn, TranscriptMessage } from "@/lib/types";
import { StageBadge, SentimentDot } from "./Badges";

/**
 * Live, in-browser conversation with the agent. Type as a lead; watch it reply
 * in the influencer's voice and advance the pipeline. Talks to the backend's
 * /api/simulate endpoints (which run the scripted brain when no key is set).
 */
export function Simulator() {
  const [turn, setTurn] = useState<SimTurn | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      setTurn(await api.simulateStart());
    } catch {
      setError("Backend offline — run `npm run dev` in the project root to try the live agent.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void start();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turn]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !turn || busy) return;
    setInput("");
    setBusy(true);
    setError(null);
    // optimistic echo
    setTurn({ ...turn, transcript: [...turn.transcript, { role: "lead", text, at: new Date().toISOString() }] });
    try {
      setTurn(await api.simulateMessage(turn.sessionId, text));
    } catch {
      setError("Session expired or backend offline. Restarting…");
      await start();
    } finally {
      setBusy(false);
    }
  }

  const quickReplies = [
    "honestly I sit at a desk all day and feel awful",
    "I've tried programs before and quit",
    "how much does it cost?",
    "ok a free call sounds good",
  ];

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
        {turn && (
          <div className="flex items-center gap-3">
            <SentimentDot sentiment={turn.sentiment} />
            <StageBadge stage={turn.stage} />
          </div>
        )}
      </div>

      {/* transcript */}
      <div ref={scrollRef} className="h-[360px] space-y-3 overflow-y-auto px-4 py-4">
        {!turn && !error && <p className="mono-label">booting agent…</p>}
        {turn?.transcript.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}
        {busy && turn && <p className="mono-label animate-pulse">agent is typing…</p>}
        {error && <p className="font-mono text-xs text-warm">{error}</p>}
      </div>

      {/* quick replies */}
      <div className="flex flex-wrap gap-2 border-t border-ink-700 px-4 pt-3">
        {quickReplies.map((q) => (
          <button
            key={q}
            type="button"
            disabled={busy || !turn}
            onClick={() => setInput(q)}
            className="rounded-full border border-ink-700 px-3 py-1 text-xs text-fog-muted transition hover:border-signal/50 hover:text-fog disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {/* composer */}
      <form onSubmit={send} className="flex gap-2 px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Reply as the lead…"
          disabled={busy || !turn}
          className="flex-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-fog placeholder:text-fog-faint focus:border-signal/60 focus:outline-none"
        />
        <button type="submit" disabled={busy || !turn || !input.trim()} className="btn-signal disabled:opacity-40">
          Send
        </button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: TranscriptMessage }) {
  const isAgent = message.role === "agent";
  return (
    <div className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
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
