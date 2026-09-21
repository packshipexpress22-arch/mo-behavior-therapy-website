import { cn } from "@/lib/utils";

export default function Logo({ className, variant = "color" }: { className?: string; variant?: "color" | "white" }) {
  const isWhite = variant === "white";
  return (
    <span className={cn("inline-flex items-center gap-2 font-display font-bold", className)}>
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <circle cx="17" cy="17" r="16" fill={isWhite ? "#ffffff" : "#1F6FEB"} />
        <path
          d="M9 21c2-6 5-9 8-9s6 3 8 9"
          stroke={isWhite ? "#1F6FEB" : "#ffffff"}
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="12.5" cy="14.5" r="1.8" fill={isWhite ? "#1F6FEB" : "#F5B400"} />
        <circle cx="21.5" cy="14.5" r="1.8" fill={isWhite ? "#1F6FEB" : "#2FAE66"} />
      </svg>
      <span className={cn("leading-tight text-[15px] sm:text-base", isWhite ? "text-white" : "text-brand-navy")}>
        MO Behavior
        <br className="hidden sm:block" /> Therapy
      </span>
    </span>
  );
}
