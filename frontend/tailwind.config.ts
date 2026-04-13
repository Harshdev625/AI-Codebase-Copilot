import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Core backgrounds
        background: "#070d1a",
        surface:    "#0d1526",
        surface2:   "#141e35",
        surface3:   "#1a2540",
        // Borders
        border:     "#1e2d4a",
        "border-active": "#2d4070",
        // Brand
        primary:    "#38bdf8",
        "primary-hover": "#0ea5e9",
        "primary-dim":   "rgba(56,189,248,0.12)",
        accent:     "#818cf8",
        "accent-dim":    "rgba(129,140,248,0.12)",
        // Status
        success:    "#22c55e",
        warning:    "#f59e0b",
        danger:     "#ef4444",
        "success-dim":  "rgba(34,197,94,0.12)",
        "warning-dim":  "rgba(245,158,11,0.12)",
        "danger-dim":   "rgba(239,68,68,0.12)",
        // Text
        text:       "#e2e8f0",
        muted:      "#94a3b8",
        subtle:     "#64748b",
        // Legacy aliases (keeps existing pages compiling)
        bg:    "#070d1a",
        panel: "#0d1526",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      boxShadow: {
        glow:  "0 0 20px rgba(56,189,248,0.15)",
        card:  "0 4px 24px rgba(0,0,0,0.4)",
        inner: "inset 0 1px 0 rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "hero-glow": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.15), transparent)",
        "card-shine": "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 60%)",
      },
      animation: {
        "fade-in":    "fadeIn 0.3s ease-out",
        "slide-up":   "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow":  "spin 3s linear infinite",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    }
  },
  plugins: []
};

export default config;
