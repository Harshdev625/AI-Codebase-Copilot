import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
    "./src/store/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        /* ── Semantic brand colours ── */
        success: {
          DEFAULT:    "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT:    "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        error: {
          DEFAULT:    "hsl(var(--error))",
          foreground: "hsl(var(--error-foreground))",
        },
        ai: {
          DEFAULT:    "hsl(var(--ai))",
          foreground: "hsl(var(--ai-foreground))",
        },
        plan: "hsl(var(--plan))",
        act: "hsl(var(--act))",
        glow: "hsl(var(--glow))",
        cyan: "hsl(var(--cyan))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "fade-up":      "fadeUp 260ms ease-out both",
        "fade-in":      "fadeIn 300ms ease-out both",
        "slide-up":     "slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "shimmer":      "shimmer 1.8s infinite linear",
        "float":        "float 6s ease-in-out infinite",
        "gradient-x":   "gradientX 4s ease infinite",
        "pulse-slow":   "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow":    "spin 3s linear infinite",
        "bounce-sm":    "bounceSm 1s infinite",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        gradientX: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
        bounceSm: {
          "0%, 100%": { transform: "translateY(0)",   animationTimingFunction: "cubic-bezier(0.8,0,1,1)" },
          "50%":      { transform: "translateY(-4px)", animationTimingFunction: "cubic-bezier(0,0,0.2,1)" },
        },
      },
      boxShadow: {
        premium: "0 1px 2px 0 rgb(0 0 0/0.04), 0 4px 6px -1px rgb(0 0 0/0.08)",
        ai:      "0 0 0 1px hsl(var(--primary)/0.2), 0 4px 24px -4px hsl(var(--primary)/0.3)",
        "glow-sm": "0 0 12px -2px hsl(var(--primary)/0.4)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
    },
  },
  plugins: [],
};

export default config;
