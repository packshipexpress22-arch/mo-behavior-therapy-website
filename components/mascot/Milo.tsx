"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Milo — the launcher icon, using the real brand logo (public/logo.png,
 * the same image Logo.tsx renders in the header) rather than a drawn
 * character. An earlier version of this component drew its own abstract
 * "buddy" mascot in SVG specifically so it could blink — the user saw it
 * live and asked for the actual logo back, keeping the greeting bounce
 * but dropping the eye-blink (the logo has no eyes to animate).
 *
 * The gentle bounce/wiggle is the "greeting" animation, replayed by
 * remounting the motion element whenever `blinkNonce` changes (the `key`
 * prop forces Framer Motion to restart from `initial` each time) — this
 * is the Framer Motion half of the user's chosen "mix" of CSS + Framer
 * Motion, reserved for this one key moment rather than used everywhere.
 *
 * `useReducedMotion` disables the animation (state still changes
 * instantly, just without the motion) for visitors who've asked for
 * less motion.
 */
export default function Milo({
  size = 44,
  blinkNonce = 0,
  className,
}: {
  size?: number;
  blinkNonce?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  const bounce = reduceMotion
    ? {}
    : {
        initial: { rotate: 0, scale: 1 },
        animate: { rotate: [0, -6, 6, -3, 0], scale: [1, 1.08, 1.08, 1.03, 1] },
        transition: { duration: 0.6, ease: "easeInOut" as const },
      };

  return (
    <motion.img
      key={`milo-body-${blinkNonce}`}
      src="/logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={className}
      {...bounce}
    />
  );
}
