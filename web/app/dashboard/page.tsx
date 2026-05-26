"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { LeadDetail, LeadSummary, Metrics, Stage } from "@/lib/types";
import { StageBadge } from "@/components/Badges";
import { PersonaSwitcher } from "@/components/PersonaSwitcher";
import { useActivePersona } from "@/lib/use-active-persona";
import { LeadCard } from "@/components/LeadCard";
import { MetricTile } from "@/components/MetricTile";
import { RevenueTile } from "@/components/RevenueTile";
import { ConversationView } from "@/components/ConversationView";

const PIPELINE: Stage[] = ["New", "Engaged", "Qualifying", "Objection", "BookingSent", "Booked", "Won"];

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [realLeads, setRealLeads] = useState<LeadSummary[]>([]);
  const [selected, setSelected] = useState<LeadDetail | null>(null);
  const [offline, setOffline] = useState(false);
  const [lastTickAt, setLastTickAt] = useState<Date | null>(null);
  const { persona, enabled: demoEnabled } = useActivePersona();

  useEffect(() => {
    let cancelled = false;
    let failures = 0;

    async function refresh(initial: boolean) {
      try {
        const [m, l] = await Promise.all([api.metrics(), api.leads()]);
        if (cancelled) return;
        setMetrics(m);
        setRealLeads(l);
        setOffline(false);
        setLastTickAt(new Date());
        failures = 0;
      } catch {
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

  const leads = useMemo<LeadSummary[]>(() => {
    if (!demoEnabled) return realLeads;
    const realHandles = new Set(realLeads.map((l) => l.igHandle));
    const demos = persona.leads.filter((l) => !realHandles.has(l.igHandle));
    return [...demos, ...realLeads].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  }, [demoEnabled, persona, realLeads]);

  const view = useMemo(() => {
    const base = metrics ?? (demoEnabled ? zeroMetrics() : null);
    if (!base) return null;
    const demoLeadsCount = demoEnabled ? persona.leads.length : 0;
    const totalLeads = base.totalLeads + demoLeadsCount;
    const byStage: Record<Stage, number> = { ...base.byStage };
    if (demoEnabled) {
      for (const l of persona.leads) byStage[l.stage] += 1;
    }
    const booked = byStage.BookingSent + byStage.Booked + byStage.Won;
    const won = byStage.Won;
    return {
      totalLeads,
      bookingRate: pct(booked, totalLeads),
      winRate: pct(won, booked),
      realRevenue: base.totalRevenue,
      simulatedRevenue: demoEnabled
        ? persona.leads.reduce((sum, l) => sum + (l.revenue ?? 0), 0)
        : 0,
    };
  }, [metrics, demoEnabled, persona]);

  async function openLead(handle: string) {
    if (handle.startsWith("demo_")) {
      const detail = persona.transcripts[handle];
      if (detail) {
        setSelected(detail);
        return;
      }
    }
    try {
      setSelected(await api.lead(handle));
    } catch {
      setOffline(true);
    }
  }

  useEffect(() => {
    if (!selected) return;
    if (selected.igHandle.startsWith("demo_")) return;
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

  useEffect(() => {
    if (selected?.igHandle.startsWith("demo_") && !persona.transcripts[selected.igHandle]) {
      setSelected(null);
    }
  }, [persona, selected?.igHandle]);

  if (offline && !demoEnabled) return <Offline />;

  const trends = demoEnabled ? persona.trends : null;
  const activeStage = selected?.stage ?? null;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono-label">overview</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-fog">
            Pipeline & performance
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <PersonaSwitcher />
          <LiveIndicator lastTickAt={lastTickAt} offline={offline} />
        </div>
      </header>

      {/* KPI tiles — revenue dominant (col-span-2 on lg) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <RevenueTile
            real={view?.realRevenue ?? null}
            simulated={view?.simulatedRevenue ?? 0}
            spark={trends?.revenueSpark}
            delta={trends?.revenueDelta}
            dominant
          />
        </div>
        <MetricTile
          label="Total leads"
          value={view ? String(view.totalLeads) : "—"}
          delta={trends?.totalLeadsDelta}
          spark={trends?.totalLeadsSpark}
        />
        <MetricTile
          label="Booking rate"
          value={view ? `${view.bookingRate}%` : "—"}
          delta={trends?.bookingRateDelta}
          spark={trends?.bookingRateSpark}
          accent
        />
        <MetricTile
          label="Win rate"
          value={view ? `${view.winRate}%` : "—"}
          delta={trends?.winRateDelta}
          spark={trends?.winRateSpark}
        />
      </div>

      <section>
        <p className="mono-label mb-4">pipeline</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {PIPELINE.map((stage) => {
            const inStage = leads.filter((l) => l.stage === stage);
            const active = stage === activeStage;
            const laneClass = active
              ? "bg-ink-900/70 ring-1 ring-signal/15"
              : "bg-ink-900/40 ring-1 ring-ink-700/30";
            return (
              <div key={stage} className={`rounded-lg p-2.5 ${laneClass}`}>
                <div className="mb-2.5 flex items-baseline justify-between px-0.5">
                  <StageBadge stage={stage} />
                  {inStage.length > 0 && (
                    <span className="font-mono text-[10px] text-fog-faint/70">
                      {inStage.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {inStage.map((l) => (
                    <LeadCard
                      key={l.id}
                      lead={l}
                      selected={selected?.igHandle === l.igHandle}
                      onClick={() => openLead(l.igHandle)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <p className="mono-label">conversation</p>
          {selected && (
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-fog-faint">
              inspecting
            </span>
          )}
        </div>
        {!selected ? (
          <div className="rounded-lg bg-ink-900/40 px-6 py-10 text-center text-sm text-fog-faint ring-1 ring-ink-700/30">
            Select a lead above to read the transcript.
          </div>
        ) : (
          <ConversationView lead={selected} />
        )}
      </section>
    </div>
  );
}

function LiveIndicator({ lastTickAt, offline }: { lastTickAt: Date | null; offline: boolean }) {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  const ago = lastTickAt ? Math.max(0, Math.round((now.getTime() - lastTickAt.getTime()) / 1000)) : null;
  const stale = ago !== null && ago > 8;
  const color = offline || stale ? "bg-warm" : "bg-signal";
  const label = offline
    ? "offline"
    : ago === null
      ? "connecting"
      : ago <= 3
        ? "live"
        : `${ago}s`;

  return (
    <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wider text-fog-faint">
      <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${color}`} />
      {label}
    </span>
  );
}

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

function zeroMetrics(): Metrics {
  return {
    totalLeads: 0,
    byStage: {
      New: 0,
      Engaged: 0,
      Qualifying: 0,
      Objection: 0,
      BookingSent: 0,
      Booked: 0,
      Won: 0,
      Lost: 0,
    },
    replyRate: 0,
    bookingRate: 0,
    winRate: 0,
    totalRevenue: 0,
    revenuePerLead: 0,
  };
}

function Offline() {
  return (
    <div className="card mx-auto mt-20 max-w-lg p-8 text-center">
      <p className="mono-label text-warm">backend offline</p>
      <h2 className="mt-3 font-display text-xl text-fog">Start the API to load live data</h2>
      <p className="mt-3 text-sm text-fog-muted">
        Run <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-signal">npm run dev</code> in
        the project root (port 3000), then refresh.
      </p>
    </div>
  );
}
