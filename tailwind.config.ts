import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#211d1a",
        charcoal: "#f6eedf",
        ramen: "#c93324",
        gold: "#c88924",
        accent: "#c93324",
        "accent-hover": "#9f271c",
        "accent-light": "#fff1ee",
        "background-subtle": "#fffdf8",
        "text-secondary": "#716a64",
        "text-muted": "#918980",
        danger: "#c93324",
        "danger-light": "#fff1ee",
        success: "#5f8f45",
        "warning-light": "#fbf2df",
        warning: "#9a6514",
        rating: "#b7791f",
        surface: "#ffffff",
        border: "#eae2d8",
      },
      boxShadow: {
        warm: "0 1px 2px rgba(0, 0, 0, .04)",
      },
    },
  },
  plugins: [],
};

export default config;
