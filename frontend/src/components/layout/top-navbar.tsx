"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, LogOut, ChevronRight, Zap } from "lucide-react";
import { NotificationDropdown } from "@/components/navbar/NotificationDropdown";

import { Button } from "@/components/ui/button";

/* Route → display name map */
const PAGE_LABELS: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/repositories": "Repositories",
  "/chat":         "TimeMachine Chat",
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

export function TopNavbar({ userEmail, onMenuClick, onSignOut }: TopNavbarProps): React.JSX.Element {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const currentPageLabel = PAGE_LABELS[`/${segments[0] ?? ""}`] ?? segments[0] ?? "Workspace";

  return (
    <header className="sticky top-0 z-20 shrink-0">
      {/* Glass surface */}
      <div className="border-b border-white/6 bg-[hsl(240,18%,4%)/80] backdrop-blur-2xl">
        {/* Gradient accent line at very top */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

        <div className="flex h-14 w-full items-center justify-between px-5 lg:px-6">

          {/* Left: Mobile hamburger + breadcrumb */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden text-zinc-500 hover:text-white hover:bg-white/5"
              onClick={onMenuClick}
            >
              <Menu className="h-4 w-4" />
            </Button>

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-[12px]" aria-label="Breadcrumb">
              <span className="text-zinc-600 font-medium">Workspace</span>
              <ChevronRight className="h-3 w-3 text-zinc-700" />
              <div className="relative">
                <span className="font-bold text-white/90 tracking-tight">{currentPageLabel}</span>
                {/* Gradient underline accent */}
                <div className="absolute -bottom-0.5 left-0 right-0 h-px bg-gradient-to-r from-violet-500/60 to-transparent" />
              </div>
              {segments.length > 1 && (
                <>
                  <ChevronRight className="h-3 w-3 text-zinc-700" />
                  <span className="font-semibold text-zinc-500 truncate max-w-[140px]">
                    {segments.slice(1).join(" / ")}
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* AI engine badge */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-violet-500/15 bg-violet-500/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-violet-500/70">
              <Zap className="h-2.5 w-2.5" />
              LangGraph Active
            </div>

            <div className="h-4 w-px bg-white/6 mx-0.5" />

            {/* Notification dropdown */}
            <NotificationDropdown />

            <div className="h-4 w-px bg-white/6 mx-0.5" />

            {/* User email */}
            {userEmail && (
              <span className="hidden lg:block text-[11px] font-medium text-zinc-600 max-w-[140px] truncate">
                {userEmail}
              </span>
            )}

            {/* Sign out */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-zinc-600 hover:text-red-400 hover:bg-red-500/8 transition-colors"
              onClick={onSignOut}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
