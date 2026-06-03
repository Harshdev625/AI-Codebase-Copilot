"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { LogOut, ChevronRight, Settings, Search } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";



interface TopNavbarProps {
  sectionTitle: string;
  userEmail?: string;
  onSignOut: () => void;
}

export function TopNavbar({ sectionTitle, userEmail, onSignOut }: TopNavbarProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-30 shrink-0">
      <div className="border-b border-border/60 bg-background/80 backdrop-blur-2xl">
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        <div className="flex h-10 w-full items-center justify-between px-3">
          {/* Left: Window Controls / Basic Nav */}
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
            >
              <div className="relative flex h-5 w-5 items-center justify-center rounded bg-primary/20">
                <div className="text-[8px] font-bold text-primary">AC</div>
              </div>
            </Link>
            
            {/* Breadcrumbs / Context */}
            <div className="hidden sm:flex items-center text-[11px] text-muted-foreground gap-1.5 font-medium">
              <Link href="/dashboard" className="hover:text-foreground transition-colors">Workspace</Link>
              <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
              <span className="text-foreground/90 font-semibold">{sectionTitle}</span>
            </div>
          </div>

          {/* Center: Command Palette Trigger (VSCode style) */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center w-full max-w-[350px]">
            <button className="flex flex-1 items-center justify-center gap-2 h-7 px-3 rounded-md border border-border/50 bg-background/50 hover:bg-accent/50 text-[11px] text-muted-foreground transition-colors shadow-sm cursor-text">
              <Search className="w-3 h-3" />
              <span>Search files, commands, or sessions</span>
              <kbd className="hidden sm:inline-flex items-center gap-1 font-mono text-[9px] bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 ml-2">Ctrl K</kbd>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 z-10">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent"
              title="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
              onClick={onSignOut}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
