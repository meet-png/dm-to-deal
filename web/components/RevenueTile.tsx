import { Sparkline } from "./Sparkline";

/**
 * Revenue tile — the headline KPI. Real revenue dominates; the simulated
 * line is a quiet footnote, no chip. Sparkline is dimmed so the number
 * remains the focal point.
 */
export function RevenueTile({
  real,
  simulated,
  spark,
  delta,
  dominant,
}: {
  real: number | null;
  simulated: number;
  spark?: number[];
  delta?: string;
  dominant?: boolean;
}) {
  const realDisplay = real === null ? "—" : `$${real.toLocaleString()}`;
  return (
    <div className={`card ${dominant ? "p-6" : "p-5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono-label">Revenue</p>
          <p className={`mt-2 font-mono ${dominant ? "text-4xl" : "text-3xl"} text-signal`}>
            {realDisplay}
          </p>
          {simulated > 0 && (
            <p className="mt-1 font-mono text-[10.5px] text-fog-faint">
              + ${simulated.toLocaleString()} simulated
            </p>
          )}
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
