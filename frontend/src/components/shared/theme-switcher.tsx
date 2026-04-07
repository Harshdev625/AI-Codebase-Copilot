"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

export function ThemeSwitcher({ className }: { className?: string }): React.JSX.Element {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("relative inline-flex items-center rounded-lg border border-border bg-background", className)}>
      <select
        aria-label="Theme"
        value={theme}
        onChange={(event) => setTheme(event.target.value)}
        className="h-9 rounded-lg bg-transparent px-3 text-sm text-foreground outline-none"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="hacker">Hacker</option>
      </select>
    </div>
  );
}
