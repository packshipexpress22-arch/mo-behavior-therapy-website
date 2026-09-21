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
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
        "wave-drift": "wave-drift 12s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
