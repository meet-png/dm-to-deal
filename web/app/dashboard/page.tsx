"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { LeadDetail, LeadSummary, Metrics, Stage } from "@/lib/types";
import { SentimentDot, StageBadge } from "@/components/Badges";

const PIPELINE: Stage[] = ["New", "Engaged", "Qualifying", "Objection", "BookingSent", "Booked", "Won"];

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [selected, setSelected] = useState<LeadDetail | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let failures = 0;

    async function refresh(initial: boolean) {
      try {
        const [m, l] = await Promise.all([api.metrics(), api.leads()]);
        if (cancelled) return;
        setMetrics(m);
        setLeads(l);
        setOffline(false);
        failures = 0;
      } catch {
        // Only flip to offline on the initial load or after several misses —
        // one transient hiccup during polling shouldn't blank the dashboard.
        if (initial) setOffline(true);
        if (++failures >= 3) setOffline(true);
      }
    }

    void refresh(true);
    const id = setInterval(() => void refresh(false), 3_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function openLead(handle: string) {
    try {
      setSelected(await api.lead(handle));
    } catch {
      setOffline(true);
    }
  }

  // If a lead is selected, keep its transcript fresh — sim conversations
  // animate in there in real time too.
  useEffect(() => {
    if (!selected) return;
    const handle = selected.igHandle;
    const id = setInterval(async () => {
      try {
        const fresh = await api.lead(handle);
        setSelected(fresh);
      } catch {
        /* leave previous content; polling will retry */
      }
    }, 3_000);
    return () => clearInterval(id);
  }, [selected?.igHandle]);

  if (offline) return <Offline />;

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="mono-label">overview</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-fog">Pipeline & performance</h1>
        </div>
        <span className="mono-label flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-signal" /> live
        </span>
      </header>

      {/* metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total leads" value={metrics ? String(metrics.totalLeads) : "—"} />
        <Metric label="Booking rate" value={metrics ? `${metrics.bookingRate}%` : "—"} accent />
        <Metric label="Win rate" value={metrics ? `${metrics.winRate}%` : "—"} />
        <Metric label="Revenue" value={metrics ? `$${metrics.totalRevenue.toLocaleString()}` : "—"} accent />
      </div>

      {/* pipeline board */}
      <section>
        <p className="mono-label mb-3">pipeline</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {PIPELINE.map((stage) => {
            const inStage = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="card min-h-[120px] p-3">
                <div className="flex items-center justify-between">
                  <StageBadge stage={stage} />
                  <span className="font-mono text-xs text-fog-faint">{inStage.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {inStage.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => openLead(l.igHandle)}
                      className="w-full rounded-md border border-ink-700 bg-ink-900/60 px-2.5 py-2 text-left text-xs transition hover:border-signal/40"
                    >
                      <div className="truncate text-fog">@{l.igHandle}</div>
                      <div className="mt-1 flex items-center justify-between">
                        <SentimentDot sentiment={l.sentiment} />
                        {l.revenue ? <span className="font-mono text-signal">${l.revenue}</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* conversation viewer */}
      <section>
        <p className="mono-label mb-3">conversation viewer</p>
        {!selected ? (
          <div className="card p-6 text-sm text-fog-faint">Select a lead above to read the transcript.</div>
        ) : (
          <div className="card p-5">
            <div className="flex items-center justify-between border-b border-ink-700 pb-3">
              <div>
                <p className="font-display text-fog">@{selected.igHandle}</p>
                <p className="mono-label mt-0.5">{selected.sourceContent ?? "source unknown"}</p>
              </div>
              <div className="flex items-center gap-3">
                <SentimentDot sentiment={selected.sentiment} />
                <StageBadge stage={selected.stage} />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {selected.transcript.length === 0 && (
                <p className="text-sm text-fog-faint">No messages yet.</p>
              )}
              {selected.transcript.map((m, i) => (
                <div key={i} className={`flex ${m.role === "agent" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      m.role === "agent"
                        ? "rounded-tl-sm border border-ink-700 bg-ink-800 text-fog"
                        : "rounded-tr-sm bg-signal/15 text-fog"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-5">
      <p className="mono-label">{label}</p>
      <p className={`mt-2 font-mono text-3xl ${accent ? "text-signal" : "text-fog"}`}>{value}</p>
    </div>
  );
}

function Offline() {
  return (
    <div className="card mx-auto mt-20 max-w-lg p-8 text-center">
      <p className="mono-label text-warm">backend offline</p>
      <h2 className="mt-3 font-display text-xl text-fog">Start the API to load live data</h2>
      <p className="mt-3 text-sm text-fog-muted">
        Run <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-signal">npm run dev</code> in
        the project root (port 3000), then refresh. The dashboard reads leads, metrics, and transcripts
        from that API.
      </p>
    </div>
  );
}
