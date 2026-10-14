/**
 * Minimal SVG line/area chart for a daily count series, same no-library
 * reasoning as the other charts in this folder. Uses a percentage-based
 * viewBox so it scales responsively, and `vectorEffect="non-scaling-stroke"`
 * so the line stays a consistent visual width regardless of how much the
 * viewBox gets stretched.
 */
export default function TrendChart({
  data,
  color = "#1F6FEB",
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  if (data.length === 0) return <p className="text-sm text-ink-500">No data yet.</p>;

  const w = 100;
  const h = 36;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? w / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = i * stepX;
    const y = h - (d.value / max) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const linePoints = points.join(" ");
  const areaPoints = `0,${h} ${linePoints} ${w},${h}`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-28 w-full overflow-visible">
        <polyline points={areaPoints} fill={color} fillOpacity="0.1" stroke="none" />
        <polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth="1.75"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => (
          <circle key={d.label} cx={i * stepX} cy={h - (d.value / max) * (h - 4) - 2} r="1.6" fill={color} vectorEffect="non-scaling-stroke">
            <title>
              {d.label}: {d.value}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-500">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
