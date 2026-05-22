import type { Config } from "tailwindcss";

/**
 * "Signal" design system — dark agentic / terminal-luxe.
 * Near-black canvas, acid-lime accent, grotesk display + mono labels.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0A0A0B", // page background
          900: "#101013", // raised surface
          850: "#16161A", // card
          800: "#1C1C21", // hover / inset
          700: "#26262C", // border
        },
        fog: {
          DEFAULT: "#EDEDED", // primary text
          muted: "#9A9AA2", // secondary text
          faint: "#65656E", // tertiary / labels
        },
        signal: {
          DEFAULT: "#C6F24E", // acid-lime accent
          dim: "#A8D637",
          glow: "rgba(198,242,78,0.15)",
        },
        hot: "#FF6B5E",
        warm: "#F5B544",
        cold: "#5E83FF",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        signal: "0 0 0 1px rgba(198,242,78,0.4), 0 8px 30px -10px rgba(198,242,78,0.25)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        blink: "blink 1.1s step-end infinite",
      },
    },
  },
  plugins: [],
};

export default config;
