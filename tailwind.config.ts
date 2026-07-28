import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#202123",
        charcoal: "#f7f7f8",
        ramen: "#c2413b",
        gold: "#b7791f",
        accent: "#10a37f",
        "accent-hover": "#0d8f70",
        "accent-light": "#e8f7f2",
        "background-subtle": "#f7f7f8",
        "text-secondary": "#5f6368",
        "text-muted": "#8a8f98",
        danger: "#c2413b",
        "danger-light": "#fff0ef",
        success: "#16803c",
        "warning-light": "#fff7e6",
        warning: "#b45309",
        rating: "#b7791f",
        surface: "#ffffff",
        border: "#e5e7eb",
      },
      boxShadow: {
        warm: "0 1px 2px rgba(0, 0, 0, .04)",
      },
    },
  },
  plugins: [],
};

export default config;
