import type { LeadSummary, Temperature } from "@/lib/types";

/**
 * Deal-intelligence card. Four layers:
 *
 *   ┌─┬─────────────────────────────┐
 *   │ │ @handle              2m  ●  │  HEADER  (handle · time · temp dot)
 *   │ ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
 *   │ │ replied in 7m ·             │  INSIGHT (the core behavioral
 *   │ │ home-equipment match        │           observation — text-fog)
 *   │ │                             │
 *   │ │ › send 7-day plan now       │  ACTION  (operator recommendation —
 *   │ └─────────────────────────────┘           faded, italicized chevron)
 *   └─ priority accent (left edge):
 *      urgent → warm   · active → signal-dim
 *      watch  → ink    · cold   → ink + opacity drop
 *
 * The accent strip is the only color the card carries at rest. Selected
 * state adds a signal ring across the whole card so it's findable from
 * the conversation viewer.
 */

const TEMP_DOT: Record<Temperature, string> = {
  cold: "bg-cold/70",
  cooling: "bg-cold/60",
  warm: "bg-warm/70",
  heating: "bg-signal/80",
  hot: "bg-signal",
  ghosted: "bg-fog-faint/60",
  stalled: "bg-warm/60",
};

const PRIORITY_ACCENT: Record<NonNullable<LeadSummary["intelligence"]>["priority"], string> = {
  urgent: "border-l-2 border-warm/70",
  active: "border-l-2 border-signal/40",
  watch: "border-l-2 border-ink-700/60",
  cold: "border-l-2 border-ink-700/40",
};

export function LeadCard({
  lead,
  selected,
  onClick,
}: {
  lead: LeadSummary;
  selected?: boolean;
  onClick: () => void;
}) {
  const dot = lead.temperature ? TEMP_DOT[lead.temperature] : "bg-fog-faint/40";
  const shortHandle = lead.igHandle.replace(/^demo_[^_]+_/, "");
  const intel = lead.intelligence;
  const isCold = intel?.priority === "cold";

  const accent = intel ? PRIORITY_ACCENT[intel.priority] : "border-l-2 border-ink-700/40";
  const ringClasses = selected
    ? "bg-signal/[0.04] ring-1 ring-signal/30"
    : "bg-ink-900/40 hover:bg-ink-800/60 ring-1 ring-ink-700/30 hover:ring-ink-700/60";

  return (
    <button
      onClick={onClick}
      className={`group block w-full rounded-md ${accent} ${ringClasses} ${isCold ? "opacity-75" : ""} px-2.5 py-2 pl-3 text-left transition-colors`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-fog">@{shortHandle}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {lead.relativeTime && (
            <span className="font-mono text-[10px] text-fog-faint">{lead.relativeTime}</span>
          )}
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        </div>
      </div>

      {/* Intelligence */}
      {intel ? (
        <>
          <div className="mt-2 h-px bg-ink-700/40" />
          <p className="mt-2 text-[11.5px] leading-snug text-fog">{intel.coreInsight}</p>
          <p className="mt-1.5 truncate font-mono text-[10.5px] italic text-fog-faint group-hover:text-fog-muted">
            <span className="not-italic text-fog-faint/70">›</span> {intel.recommendedAction}
          </p>
        </>
      ) : lead.aiHint ? (
        <>
          <div className="mt-2 h-px bg-ink-700/40" />
          <p className="mt-2 truncate font-mono text-[10.5px] text-fog-muted group-hover:text-fog">
            {lead.aiHint.label}
          </p>
        </>
      ) : null}

      {/* Revenue, only for closed deals */}
      {lead.stage === "Won" && lead.revenue ? (
        <p className="mt-2 font-mono text-[10.5px] text-signal-dim">${lead.revenue.toLocaleString()}</p>
      ) : null}
    </button>
  );
}
