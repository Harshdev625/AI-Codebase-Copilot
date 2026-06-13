"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ChevronRight, Settings, Search, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NAV_BAR_CLASS, NAV_MOBILE_MENU_TOP } from "./nav-tokens";

interface TopNavbarProps {
  sectionTitle: string;
  userEmail?: string;
  onSignOut: () => void;
  variant?: "user" | "admin";
}

export function TopNavbar({
  sectionTitle,
  userEmail,
  onSignOut,
  variant = "user",
}: TopNavbarProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isAdmin = variant === "admin";
  const isDashboardHome = pathname === "/dashboard";
  const showCodebaseCrumb = !isAdmin && !isDashboardHome;

  const openCommandPalette = () => {
    window.dispatchEvent(new CustomEvent("studio:open-command-palette"));
  };

  return (
    <>
      <header className="sticky top-0 z-30 shrink-0 w-full">
        <div className="relative border-b border-border/40 bg-card/70 backdrop-blur-2xl transition-colors duration-300">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none" />

          <div
            className={cn(
              "flex w-full items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 xl:px-8",
              NAV_BAR_CLASS
            )}
          >
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 touch-target-sm md:hidden text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle navigation"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>

              <Link
                href={isAdmin ? "/admin/dashboard" : "/dashboard"}
                className="group flex shrink-0 items-center gap-2 transition-all"
              >
                <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 transition-all duration-200 group-hover:scale-105 group-hover:bg-primary/20 xl:h-10 xl:w-10">
                  <span className="select-none text-xs font-bold text-primary xl:text-sm">AC</span>
                </div>
                <span className="hidden text-sm font-semibold text-foreground/80 transition-colors group-hover:text-foreground sm:inline-block xl:text-base">
                  Copilot
                </span>
              </Link>

              <div className="hidden min-w-0 items-center gap-1 font-medium text-muted-foreground sm:flex text-sm xl:text-base">
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                {isAdmin ? (
                  <>
                    <span className="shrink-0 text-muted-foreground">Admin</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                    <span className="truncate font-semibold text-foreground/80 max-w-[180px] lg:max-w-[280px] xl:max-w-[360px]">
                      {sectionTitle}
                    </span>
                  </>
                ) : isDashboardHome ? (
                  <>
                    <span className="shrink-0 text-muted-foreground">Dashboard</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                    <span className="truncate font-semibold text-foreground/80 max-w-[180px] lg:max-w-[280px] xl:max-w-[360px]">
                      {sectionTitle}
                    </span>
                  </>
                ) : (
                  <>
                    <Link href="/dashboard" className="shrink-0 transition-colors hover:text-foreground">
                      Dashboard
                    </Link>
                    {showCodebaseCrumb && (
                      <>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                        <Link href="/studio" className="shrink-0 transition-colors hover:text-foreground">
                          Codebase
                        </Link>
                      </>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30" />
                    <span className="truncate font-semibold text-foreground/80 max-w-[100px] sm:max-w-[180px] lg:max-w-[280px] xl:max-w-[360px]">
                      {sectionTitle}
                    </span>
                  </>
                )}
              </div>

              <span className="truncate text-sm font-semibold text-foreground/80 sm:hidden max-w-[140px]">
                {sectionTitle}
              </span>
            </div>

            <div className="flex max-w-sm flex-1 justify-center px-2 lg:max-w-xl xl:max-w-2xl">
              <button
                type="button"
                onClick={openCommandPalette}
                className="group flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-3 text-xs text-muted-foreground shadow-sm transition-all duration-200 hover:border-primary/30 hover:bg-card/80 xl:h-10 xl:text-sm"
                aria-label="Open command palette"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary xl:h-5 xl:w-5" />
                  <span className="hidden truncate md:inline-block">Search or run command…</span>
                  <span className="truncate text-xs md:hidden">Search…</span>
                </div>
                <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-border/40 bg-muted/50 px-1.5 py-0.5 font-mono text-xs font-bold text-muted-foreground/60 lg:inline-flex">
                  ⌃K
                </kbd>
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-1 xl:gap-2">
              {userEmail && (
                <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground lg:inline-block xl:max-w-[180px] xl:text-sm">
                  {userEmail}
                </span>
              )}
              <ThemeToggle />
              {!isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden h-9 w-9 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex xl:h-10 xl:w-10"
                  title="Settings"
                  onClick={() => router.push("/studio?panel=settings")}
                >
                  <Settings className="h-4 w-4 xl:h-5 xl:w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive xl:h-10 xl:w-10"
                onClick={onSignOut}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4 xl:h-5 xl:w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div
          className={cn(
            "fixed inset-x-0 z-20 border-b border-border/40 bg-card/95 shadow-xl backdrop-blur-xl md:hidden",
            NAV_MOBILE_MENU_TOP
          )}
        >
          <nav className="flex flex-col gap-1 p-3">
            {isAdmin ? (
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                Admin Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/studio"
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                >
                  Codebase
                </Link>
              </>
            )}
            {userEmail && (
              <div className="mt-1 border-t border-border/40 px-3 py-2">
                <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
              </div>
            )}
            <button
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                "text-destructive transition-colors hover:bg-destructive/10"
              )}
              onClick={() => {
                setMobileOpen(false);
                onSignOut();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </nav>
        </div>
      )}
    </>
  );
}
