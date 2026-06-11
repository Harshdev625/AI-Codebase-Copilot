"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, ChevronRight, Settings, Search, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TopNavbarProps {
  sectionTitle: string;
  userEmail?: string;
  onSignOut: () => void;
}

export function TopNavbar({ sectionTitle, userEmail, onSignOut }: TopNavbarProps): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 shrink-0 w-full">
        <div className="relative border-b border-border/40 bg-card/70 backdrop-blur-2xl transition-colors duration-300">
          {/* Top highlight */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none" />

          <div className="flex h-12 w-full items-center justify-between px-3 sm:px-4 gap-2">
            {/* Left: Logo + breadcrumbs */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile hamburger */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 md:hidden text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle navigation"
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>

              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 shrink-0 group transition-all"
              >
                <div className="relative flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 border border-primary/20 group-hover:bg-primary/20 group-hover:scale-105 transition-all duration-200">
                  <span className="text-[9px] font-bold text-primary select-none">AC</span>
                </div>
                <span className="hidden sm:inline-block text-[12px] font-semibold text-foreground/80 group-hover:text-foreground transition-colors">
                  Copilot
                </span>
              </Link>

              {/* Breadcrumbs — hidden on mobile */}
              <div className="hidden sm:flex items-center text-[11px] text-muted-foreground gap-1 font-medium min-w-0">
                <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                <Link href="/dashboard" className="hover:text-foreground transition-colors shrink-0">
                  Dashboard
                </Link>
                <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                <Link href="/studio" className="hover:text-foreground transition-colors shrink-0">
                  Studio
                </Link>
                <ChevronRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                <span className="text-foreground/80 font-semibold truncate max-w-[100px] sm:max-w-[180px] lg:max-w-[280px]">
                  {sectionTitle}
                </span>
              </div>

              {/* Mobile: just show section title */}
              <span className="sm:hidden text-[13px] font-semibold text-foreground/80 truncate max-w-[140px]">
                {sectionTitle}
              </span>
            </div>

            {/* Center: Command Palette Trigger */}
            <div className="flex-1 flex justify-center px-2 max-w-xs lg:max-w-md xl:max-w-lg">
              <button
                className="group flex w-full items-center justify-between gap-2 h-7 px-2.5 rounded-md border border-border/40 bg-background/40 hover:bg-card/80 hover:border-primary/30 text-[11px] text-muted-foreground transition-all duration-200 shadow-sm"
                aria-label="Open command palette"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <Search className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  <span className="truncate hidden md:inline-block">Search or run command…</span>
                  <span className="truncate md:hidden text-[10px]">Search…</span>
                </div>
                <kbd className="hidden lg:inline-flex items-center gap-0.5 font-mono text-[9px] font-bold text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded border border-border/40 shrink-0">
                  ⌃K
                </kbd>
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-0.5 shrink-0">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors hidden sm:flex"
                title="Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile slide-down nav */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-x-0 top-12 z-20 border-b border-border/40 bg-card/95 backdrop-blur-xl shadow-xl">
          <nav className="flex flex-col gap-1 p-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/studio"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Studio
            </Link>
            {userEmail && (
              <div className="px-3 py-2 mt-1 border-t border-border/40">
                <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
              </div>
            )}
            <button
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-medium",
                "text-destructive hover:bg-destructive/10 transition-colors"
              )}
              onClick={() => { setMobileOpen(false); onSignOut(); }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
