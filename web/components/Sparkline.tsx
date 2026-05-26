/**
 * Tiny inline SVG sparkline. Deterministic — no animation, no random fill.
 * `series` is a list of 4-12 numbers; renders to width/height in px.
 *
 * Styling intent: subtle, signal-dim stroke, no axes, no labels. Pairs
 * with a delta string below the big number in a MetricTile.
 */
export function Sparkline({
  series,
  width = 96,
  height = 24,
  className = "",
  stroke = "#A8D637",
}: {
  series: number[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
}) {
  if (series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = width / (series.length - 1);

  const points = series.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  // Area fill — same path closed back to baseline for a subtle wash.
  const area = `M0,${height} L${points.join(" L ")} L${width},${height} Z`;
  const line = `M${points.join(" L ")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-hidden="true"
    >
      <path d={area} fill={stroke} fillOpacity={0.08} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
      {/* Last-point dot for emphasis. */}
      <circle
        cx={(series.length - 1) * stepX}
        cy={height - ((series[series.length - 1] - min) / range) * height}
        r={1.6}
        fill={stroke}
      />
    </svg>
  );
}
