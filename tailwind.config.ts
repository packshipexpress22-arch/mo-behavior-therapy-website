import type { Config } from "tailwindcss";

// Brand palette derived from the MO Behavior Therapy flyer.
// Swap these hex values once exact brand hex codes are confirmed from the
// final logo/brand-guide asset — everything in the UI reads from these
// tokens, so a palette update here propagates everywhere.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0B2A4A",
          blue: "#1F6FEB",
          "blue-light": "#E8F1FE",
          green: "#2FAE66",
          "green-light": "#E7F8EE",
          gold: "#F5B400",
          orange: "#F47C20",
          coral: "#F0554A",
          purple: "#7C5CFC",
        },
        ink: {
          900: "#0F1B2B",
          700: "#33465C",
          500: "#5B7086",
          300: "#A7B7C7",
          100: "#EEF3F8",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(15, 27, 43, 0.18)",
        card: "0 4px 18px -6px rgba(15, 27, 43, 0.12)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "wave-drift": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%": { transform: "translateX(-2%)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(-10px) translateX(4px)" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-4deg)" },
          "75%": { transform: "rotate(4deg)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.85) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        blink: {
          "0%, 92%, 100%": { transform: "scaleY(1)" },
          "96%": { transform: "scaleY(0.08)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
        "wave-drift": "wave-drift 12s ease-in-out infinite",
        "float-slow": "float-slow 7s ease-in-out infinite",
        "bounce-gentle": "bounce-gentle 2.4s ease-in-out infinite",
        wiggle: "wiggle 0.5s ease-in-out",
        "pop-in": "pop-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
        blink: "blink 4.5s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
