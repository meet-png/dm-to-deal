import type { LeadDetail, TranscriptMessage } from "@/lib/types";
import { StageBadge } from "@/components/Badges";

/**
 * Calm conversation view. Wide transcript, narrow notes column. The
 * transcript is the focus — timestamps, markers and meta sit quietly so
 * they don't compete with the message text.
 */

const MARKER_COLORS: Record<NonNullable<TranscriptMessage["marker"]>["kind"], string> = {
  objection: "bg-warm",
  booking: "bg-signal",
  intent: "bg-signal-dim",
  ghost: "bg-fog-faint/60",
  reEngage: "bg-signal",
};

export function ConversationView({ lead }: { lead: LeadDetail }) {
  const hasSide = (lead.notes && lead.notes.length > 0) || !!lead.aiHint || !!lead.intelligence;
  return (
    <div className="relative overflow-hidden rounded-lg bg-ink-850 p-7 ring-1 ring-ink-700/60">
      {/* faint top-edge highlight — marks this as the active workspace */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/25 to-transparent" />
      <Header lead={lead} />

      <div className={`mt-6 grid gap-8 ${hasSide ? "lg:grid-cols-[1fr_200px]" : ""}`}>
        <TranscriptColumn lead={lead} />
        {hasSide && <SideColumn lead={lead} />}
      </div>
    </div>
  );
}

function Header({ lead }: { lead: LeadDetail }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-700/70 pb-4">
      <div className="min-w-0">
        <p className="font-display text-fog">
          @{lead.igHandle}
          {lead.isDemo && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-fog-faint/70">
              sim
            </span>
          )}
        </p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-fog-faint">
          {lead.sourceContent ?? "source unknown"}
        </p>
      </div>
      <StageBadge stage={lead.stage} />
    </div>
  );
}

function TranscriptColumn({ lead }: { lead: LeadDetail }) {
  return (
    <div className="relative pl-5">
      <div className="absolute left-1.5 bottom-2 top-2 w-px bg-ink-700/50" />
      <div className="space-y-5">
        {lead.transcript.length === 0 && (
          <p className="text-sm text-fog-faint">No messages yet.</p>
        )}
        {lead.transcript.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: TranscriptMessage }) {
  const isAgent = m.role === "agent";
  const markerColor = m.marker ? MARKER_COLORS[m.marker.kind] : null;
  return (
    <div className="relative">
      <div
        className={`absolute -left-[15px] top-[12px] h-1.5 w-1.5 rounded-full ${
          markerColor ?? (isAgent ? "bg-ink-700" : "bg-fog-faint/30")
        }`}
      />
      {m.marker && (
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-fog-faint">
          {m.marker.label}
        </div>
      )}
      <div className={`flex ${isAgent ? "justify-start" : "justify-end"}`}>
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isAgent
              ? "rounded-tl-sm bg-ink-800/70 text-fog"
              : "rounded-tr-sm bg-signal/10 text-fog"
          }`}
        >
          {m.text}
        </div>
      </div>
      <div className={`mt-1 font-mono text-[10px] text-fog-faint/70 ${isAgent ? "ml-1" : "mr-1 text-right"}`}>
        {formatTime(m.at)}
      </div>
    </div>
  );
}

function SideColumn({ lead }: { lead: LeadDetail }) {
  const intel = lead.intelligence;
  const priorityColor =
    intel?.priority === "urgent"
      ? "text-warm"
      : intel?.priority === "active"
        ? "text-fog"
        : "text-fog-muted";
  return (
    <aside className="space-y-5 text-[12px]">
      {intel && (
        <section>
          <p className="mono-label">insight</p>
          <p className={`mt-1.5 text-[12px] leading-snug ${priorityColor}`}>{intel.coreInsight}</p>
          <p className="mt-2 font-mono text-[11px] italic text-fog-faint">
            <span className="not-italic text-fog-faint/70">›</span> {intel.recommendedAction}
          </p>
        </section>
      )}
      {!intel && lead.aiHint && (
        <section>
          <p className="mono-label">signal</p>
          <p className="mt-1.5 font-mono text-[11.5px] text-fog-muted">{lead.aiHint.label}</p>
        </section>
      )}
      {lead.notes && lead.notes.length > 0 && (
        <section>
          <p className="mono-label">notes</p>
          <ul className="mt-1.5 space-y-1.5">
            {lead.notes.map((n, i) => (
              <li key={i} className="text-fog-muted">
                {n}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <p className="mono-label">meta</p>
        <dl className="mt-1.5 space-y-1 font-mono text-[10.5px] text-fog-muted">
          <Row k="first" v={formatDate(lead.firstContactAt)} />
          {lead.bookingLinkSentAt && <Row k="link" v={formatDate(lead.bookingLinkSentAt)} />}
          <Row k="msgs" v={String(lead.transcript.length)} />
          {lead.revenue ? <Row k="rev" v={`$${lead.revenue.toLocaleString()}`} accent /> : null}
        </dl>
      </section>
    </aside>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-fog-faint/80">{k}</dt>
      <dd className={accent ? "text-signal" : "text-fog"}>{v}</dd>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}
