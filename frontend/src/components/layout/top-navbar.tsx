"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, Bell, LogOut, ChevronRight } from "lucide-react";

import { ThemeSwitcher } from "@/components/shared/theme-switcher";
import { Button } from "@/components/ui/button";

/* Map routes to human-readable page names */
const PAGE_LABELS: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/repositories": "Repositories",
  "/chat":         "AI Workspace",
  "/admin":        "Admin Panel",
};

interface TopNavbarProps {
  sectionTitle: string;
  userEmail?: string;
  onMenuClick: () => void;
  onSidebarToggle: () => void;
  isSidebarCollapsed: boolean;
  onSignOut: () => void;
}

export function TopNavbar({
  userEmail,
  onMenuClick,
  onSignOut,
}: TopNavbarProps): React.JSX.Element {
  const pathname = usePathname();

  // Build breadcrumb segments from pathname
  const segments = pathname.split("/").filter(Boolean);
  const currentPageLabel =
    PAGE_LABELS[`/${segments[0] ?? ""}`] ?? segments[0] ?? "Workspace";

  return (
    <header className="sticky top-0 z-20 border-b border-border/40 bg-background/70 backdrop-blur-xl shrink-0">
      <div className="flex h-14 w-full items-center justify-between px-5 lg:px-6">
        {/* Left: Mobile menu + breadcrumb */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden text-muted-foreground"
            onClick={onMenuClick}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <nav className="flex items-center gap-1.5 text-[12px]" aria-label="Breadcrumb">
            <span className="text-muted-foreground/50 font-medium">Workspace</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
            <span className="font-bold text-foreground tracking-tight">{currentPageLabel}</span>
            {segments.length > 1 && (
              <>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                <span className="font-semibold text-muted-foreground/60 truncate max-w-[120px]">
                  {segments.slice(1).join(" / ")}
                </span>
              </>
            )}
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground relative"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {/* Notification dot */}
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
          </Button>

          <div className="h-4 w-px bg-border/40 mx-0.5" />

          <ThemeSwitcher />

          <div className="h-4 w-px bg-border/40 mx-0.5" />

          {/* User email (truncated) + signout */}
          {userEmail && (
            <span className="hidden lg:block text-[11px] font-medium text-muted-foreground/60 max-w-[140px] truncate">
              {userEmail}
            </span>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive transition-colors"
            onClick={onSignOut}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
