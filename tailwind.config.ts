import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0B",
        charcoal: "#151515",
        ramen: "#E9551D",
        gold: "#D8A64B",
      },
      boxShadow: {
        warm: "0 16px 42px rgba(0, 0, 0, .28)",
      },
    },
  },
  plugins: [],
};

export default config;
