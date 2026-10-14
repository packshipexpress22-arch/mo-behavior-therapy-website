/**
 * Minimal CSS-only bar chart — no charting library (this project has no
 * network access in some environments to install one, and these simple
 * aggregate counts don't need anything heavier). Bars are plain divs
 * whose height is a percentage of the tallest value, animated in via a
 * CSS transition so they "grow" in on first paint rather than just
 * appearing — matches the global prefers-reduced-motion override in
 * globals.css automatically (transition-duration gets zeroed there).
 */
export default function BarChart({
  data,
  height = 160,
}: {
  data: { label: string; value: number; color: string }[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.every((d) => d.value === 0)) {
    return <p className="text-sm text-ink-500">No data yet.</p>;
  }

  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <div className="text-xs font-semibold text-ink-900">{d.value}</div>
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md transition-[height] duration-700 ease-out"
              style={{
                height: d.value > 0 ? `${Math.max((d.value / max) * 100, 4)}%` : "2px",
                backgroundColor: d.color,
              }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <div className="w-full truncate text-center text-[10px] leading-tight text-ink-500" title={d.label}>
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}
