"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Milo's face — a small friendly "buddy" mascot, drawn as plain SVG (no
 * image asset, so it can actually blink) rather than the static logo.png
 * the launcher button used before.
 *
 * The blink + gentle bounce/wiggle is a deliberate "greeting" animation,
 * replayed by remounting the animated groups whenever `blinkNonce`
 * changes (the `key` prop forces Framer Motion to restart from `initial`
 * each time) — this is the Framer Motion half of the user's chosen "mix"
 * of CSS + Framer Motion, reserved for this one key moment rather than
 * used everywhere. It's deliberately NOT layered with a CSS keyframe
 * animation on the same element — Framer Motion and a CSS `animation`
 * would both fight to control the same `transform` property and produce
 * a jittery result, so this component owns `transform` exclusively via
 * Framer Motion.
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

  const eyeBlink = reduceMotion
    ? {}
    : {
        initial: { scaleY: 1 },
        animate: { scaleY: [1, 0.08, 1] },
        transition: { duration: 0.42, ease: "easeInOut" as const, times: [0, 0.5, 1] },
      };

  return (
    <motion.svg
      key={`milo-body-${blinkNonce}`}
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      {...bounce}
    >
      {/* Two little antenna bobbles — reads as a friendly creature rather
          than a plain logo mark. */}
      <circle cx="20" cy="10" r="3" fill="#F5B400" />
      <path d="M20 13v6" stroke="#0B2A4A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="44" cy="10" r="3" fill="#F5B400" />
      <path d="M44 13v6" stroke="#0B2A4A" strokeWidth="2" strokeLinecap="round" />

      {/* Body */}
      <rect x="6" y="16" width="52" height="42" rx="21" fill="#1F6FEB" />
      <rect x="6" y="16" width="52" height="42" rx="21" fill="url(#milo-sheen)" fillOpacity="0.25" />

      {/* Cheeks */}
      <circle cx="17" cy="42" r="4.2" fill="#F0554A" opacity="0.45" />
      <circle cx="47" cy="42" r="4.2" fill="#F0554A" opacity="0.45" />

      {/* Eyes — each eye group scales on the Y axis to "close". Keyed on
          blinkNonce so the greeting blink replays every time it's
          triggered (first visit, then every tap). */}
      <motion.g key={`milo-eye-left-${blinkNonce}`} style={{ transformOrigin: "22px 34px" }} {...eyeBlink}>
        <circle cx="22" cy="34" r="7" fill="white" />
        <circle cx="22" cy="34" r="3.4" fill="#0B2A4A" />
      </motion.g>
      <motion.g key={`milo-eye-right-${blinkNonce}`} style={{ transformOrigin: "42px 34px" }} {...eyeBlink}>
        <circle cx="42" cy="34" r="7" fill="white" />
        <circle cx="42" cy="34" r="3.4" fill="#0B2A4A" />
      </motion.g>

      {/* Smile */}
      <path
        d="M24 46c2.5 3 5.3 4.4 8 4.4s5.5-1.4 8-4.4"
        stroke="#0B2A4A"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />

      <defs>
        <linearGradient id="milo-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
    </motion.svg>
  );
}
