import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        slatebg: "#0B1220",
        panel: "#111A2B",
        accent: "#0EA5E9",
        success: "#22C55E",
        warning: "#F59E0B"
      }
    }
  },
  plugins: []
};

export default config;
