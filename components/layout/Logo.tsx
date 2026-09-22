import { cn } from "@/lib/utils";

export default function Logo({ className, variant = "color" }: { className?: string; variant?: "color" | "white" }) {
  const isWhite = variant === "white";
  return (
    <span className={cn("inline-flex items-center gap-2 font-display font-bold", className)}>
      <img
        src="/logo.png"
        alt="MO Behavior Therapy"
        width={34}
        height={34}
        className="h-[34px] w-[34px] shrink-0 object-contain"
      />
      <span className={cn("leading-tight text-[15px] sm:text-base", isWhite ? "text-white" : "text-brand-navy")}>
        MO Behavior
        <br className="hidden sm:block" /> Therapy
      </span>
    </span>
  );
}
