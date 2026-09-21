import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/navigation";

type Props = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "white";
  external?: boolean;
  className?: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

const variants: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-brand-blue text-white hover:-translate-y-0.5 shadow-card",
  secondary: "bg-white text-brand-blue border border-brand-blue/30 hover:bg-brand-blue-light",
  ghost: "text-ink-900 border border-ink-100 hover:bg-ink-100",
  white: "bg-white text-brand-navy hover:-translate-y-0.5 shadow-card",
};

export default function Button({ href, children, variant = "primary", external, className, ...rest }: Props) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all",
    variants[variant],
    className
  );

  if (external || href.startsWith("http") || href.startsWith("tel:") || href.startsWith("mailto:")) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
