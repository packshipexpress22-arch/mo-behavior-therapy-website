/**
 * Decorative blurred color blobs that drift slowly in the background — the
 * plain-CSS/Tailwind half of the site's motion (see Reveal.tsx for the
 * Framer Motion half). Pure decoration (aria-hidden), so it's a server
 * component: no "use client" needed, no JS cost, just Tailwind's
 * float-slow/wave-drift keyframes (see tailwind.config.ts).
 *
 * Used on PageHero (every secondary page gets this for free) and can be
 * dropped into any relatively-positioned, overflow-hidden section for the
 * same warm, kids-friendly "floating shapes" backdrop.
 */
export default function FloatingShapes({
  variant = "warm",
}: {
  variant?: "warm" | "cool";
}) {
  const palette =
    variant === "warm"
      ? ["bg-brand-gold/25", "bg-brand-coral/20", "bg-brand-orange/15"]
      : ["bg-brand-blue/15", "bg-brand-green/20", "bg-brand-purple/15"];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className={`absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl animate-float-slow ${palette[0]}`}
      />
      <div
        className={`absolute -left-10 top-1/3 h-48 w-48 rounded-full blur-3xl animate-wave-drift ${palette[1]}`}
      />
      <div
        className={`absolute bottom-[-3rem] right-1/4 h-40 w-40 rounded-full blur-2xl animate-float-slow [animation-delay:1.5s] ${palette[2]}`}
      />
    </div>
  );
}
