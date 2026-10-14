/**
 * Minimal SVG donut chart, same reasoning as BarChart.tsx — no charting
 * library dependency. Built with the standard stroke-dasharray trick:
 * one background circle plus one stroked circle per segment, each offset
 * by the cumulative length of the segments before it.
 */
export default function DonutChart({
  segments,
  size = 148,
  thickness = 20,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF3F8" strokeWidth={thickness} />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const dash = (s.value / total) * circumference;
              const el = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-cumulative}
                  className="transition-all duration-700 ease-out"
                >
                  <title>
                    {s.label}: {s.value}
                  </title>
                </circle>
              );
              cumulative += dash;
              return el;
            })}
      </svg>
      <ul className="min-w-[140px] flex-1 space-y-1.5 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate text-ink-700">{s.label}</span>
            <span className="ml-auto font-semibold text-ink-900">{s.value}</span>
          </li>
        ))}
        {total === 0 && <li className="text-ink-500">No data yet.</li>}
      </ul>
    </div>
  );
}
