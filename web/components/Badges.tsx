import type { Sentiment, Stage } from "@/lib/types";

const STAGE_STYLES: Record<Stage, string> = {
  New: "border-ink-700 text-fog-muted",
  Engaged: "border-cold/40 text-cold",
  Qualifying: "border-cold/40 text-cold",
  Objection: "border-warm/40 text-warm",
  BookingSent: "border-signal/40 text-signal",
  Booked: "border-signal/50 text-signal",
  Won: "border-signal bg-signal/10 text-signal",
  Lost: "border-ink-700 text-fog-faint",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STAGE_STYLES[stage]}`}
    >
      {stage}
    </span>
  );
}

const SENTIMENT_COLOR: Record<Sentiment, string> = {
  hot: "bg-hot",
  warm: "bg-warm",
  cold: "bg-cold",
};

export function SentimentDot({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-fog-muted">
      <span className={`h-2 w-2 rounded-full ${SENTIMENT_COLOR[sentiment]}`} />
      {sentiment}
    </span>
  );
}
