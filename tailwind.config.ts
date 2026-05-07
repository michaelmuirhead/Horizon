import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Solid CSS-variable tokens — values flip with [data-theme="..."].
        page: "var(--page)",
        card: "var(--card)",
        "card-elevated": "var(--card-elevated)",
        "list-row": "var(--list-row)",
        pill: "var(--pill)",
        "pill-text": "var(--pill-text)",
        "accent-soft": "var(--accent-soft)",
        "gradient-from": "var(--gradient-from)",
        "gradient-to": "var(--gradient-to)",
        // RGB-triple tokens so Tailwind's alpha-modifier syntax keeps
        // working ("text-fg/70", "bg-accent/15", etc).
        fg: "rgb(var(--fg-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        mint: "rgb(var(--mint-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
