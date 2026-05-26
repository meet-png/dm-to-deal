import { Sparkline } from "./Sparkline";

/**
 * KPI tile. Calm by default: label, value, optional faded delta, optional
 * low-opacity sparkline. No borders inside, no chips.
 */
export function MetricTile({
  label,
  value,
  delta,
  spark,
  accent,
  dominant,
}: {
  label: string;
  value: string;
  delta?: string;
  spark?: number[];
  accent?: boolean;
  dominant?: boolean;
}) {
  const valueClass = `${dominant ? "text-4xl" : "text-3xl"} ${accent ? "text-signal" : "text-fog"}`;
  return (
    <div className={`card ${dominant ? "p-6" : "p-5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono-label">{label}</p>
          <p className={`mt-2 font-mono ${valueClass}`}>{value}</p>
          {delta && <p className="mt-1 font-mono text-[10.5px] text-fog-faint">{delta}</p>}
        </div>
        {spark && spark.length >= 2 && (
          <div className="shrink-0 self-end opacity-60">
            <Sparkline series={spark} width={dominant ? 110 : 80} height={dominant ? 28 : 22} />
          </div>
        )}
      </div>
    </div>
  );
}
