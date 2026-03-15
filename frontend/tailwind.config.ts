import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b1020",
        panel: "#151b2f",
        primary: "#5eead4",
        text: "#e2e8f0",
        muted: "#94a3b8"
      }
    }
  },
  plugins: []
};

export default config;
