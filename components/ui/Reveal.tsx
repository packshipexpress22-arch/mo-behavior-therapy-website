"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Site-wide scroll-reveal wrapper — the Framer Motion half of the "mezcla
 * de ambos" (CSS + Framer Motion) animation approach the user chose. Most
 * of the site's motion stays plain Tailwind (fade-up/wave-drift keyframes,
 * hover transitions); this wrapper is for the handful of moments where a
 * true "animate once it scrolls into view" effect reads better than a
 * fixed-delay CSS entrance, and it's cheap enough to use broadly (see
 * Section.tsx, which wraps every section's content in this by default).
 *
 * Respects prefers-reduced-motion itself (the global CSS override in
 * globals.css only neutralizes CSS animations/transitions, not Framer
 * Motion's transform/opacity animations) by collapsing to an instant,
 * no-motion appearance.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
