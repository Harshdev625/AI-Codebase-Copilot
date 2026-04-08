"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Terminal } from "lucide-react";

import { cn } from "@/lib/utils";

export function ThemeSwitcher({ className }: { className?: string }): React.JSX.Element {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn("inline-flex h-9 items-center rounded-md border border-input bg-background p-1", className)}>
        <div className="h-full w-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const items = [
    { key: "light", icon: Sun, label: "Light" },
    { key: "dark", icon: Moon, label: "Dark" },
    { key: "hacker", icon: Terminal, label: "Hacker" },
  ] as const;

  return (
    <div className={cn("inline-flex items-center rounded-md border border-input bg-background/50 p-1", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = theme === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setTheme(item.key)}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-sm transition-ui",
              active
                ? "bg-secondary text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            title={item.label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
