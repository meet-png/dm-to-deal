import type { Sentiment, Stage } from "@/lib/types";

const STAGE_STYLES: Record<Stage, string> = {
  New: "text-fog-muted",
  Engaged: "text-cold",
  Qualifying: "text-cold",
  Objection: "text-warm",
  BookingSent: "text-signal",
  Booked: "text-signal",
  Won: "text-signal",
  Lost: "text-fog-faint",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      className={`inline-flex items-center font-mono text-[10px] uppercase tracking-wider ${STAGE_STYLES[stage]}`}
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
