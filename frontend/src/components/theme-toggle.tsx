"use client";

import { useEffect, useMemo, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type ThemeMode = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "aicc_theme_mode";
const ORDERED_MODES: ThemeMode[] = ["system", "light", "dark"];

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(STORAGE_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === "system" ? getSystemTheme() : mode;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
};

export default function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const [mode, setMode] = useState<ThemeMode>("system");
  const resolved = useMemo<ResolvedTheme>(() => (mode === "system" ? getSystemTheme() : mode), [mode]);

  useEffect(() => {
    const initialMode = readStoredMode();
    setMode(initialMode);
    applyTheme(initialMode);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);

    if (typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (mode === "system") {
        applyTheme("system");
      }
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    const legacyMedia = media as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };

    legacyMedia.addListener?.(onChange);
    return () => legacyMedia.removeListener?.(onChange);
  }, [mode]);

  const icon =
    mode === "system" ? (
      <Monitor className="h-4 w-4" />
    ) : resolved === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Sun className="h-4 w-4" />
    );

  const nextMode = () => {
    const index = ORDERED_MODES.indexOf(mode);
    return ORDERED_MODES[(index + 1) % ORDERED_MODES.length];
  };

  return (
    <button
      onClick={() => setMode(nextMode())}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-muted transition-colors hover:text-text",
        compact ? "h-9 w-9 px-0" : "",
        className,
      )}
      aria-label="Toggle theme"
      title={`Theme: ${mode}`}
    >
      {icon}
      {compact ? null : <span className="uppercase tracking-[0.08em]">{mode}</span>}
    </button>
  );
}
