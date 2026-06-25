"use client";

import * as React from "react";
import { Search, Settings, LogOut, ChevronDown, Home, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { useLogout } from "@/features/auth/hooks/use-auth";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { useStudioStore } from "@/features/studio/store/studio-store";

/** Studio title bar — fixed 48px (no xl growth). */
const STUDIO_TITLE_BAR_CLASS = "h-12";

export function GlobalTopBar() {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const { setSettingsOpen, focusSidebar, primarySidebar } = useStudioStore();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout("user");
  };

  const openCommandPalette = () => {
    window.dispatchEvent(new CustomEvent("studio:open-command-palette"));
  };

  React.useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const initials = (user?.full_name || user?.email || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        "flex shrink-0 select-none items-center justify-between border-b border-[#1E212B] bg-[#0F1117] px-3 sm:px-4 lg:px-6",
        STUDIO_TITLE_BAR_CLASS
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 transition-opacity hover:opacity-80"
          title="Back to Dashboard"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-[#58A6FF] to-[#3B82F6] shadow-sm lg:h-9 lg:w-9">
            <span className="text-[11px] font-bold text-white lg:text-xs">AI</span>
          </div>
          <span className="hidden text-sm font-semibold leading-none text-[#C9D1D9] sm:inline-block lg:text-base">
            Copilot
          </span>
        </Link>
        <span className="hidden text-[#2D313E] sm:inline-block">/</span>
        <span className="hidden text-xs font-medium text-[#8B949E] sm:inline-block lg:text-sm">
          Codebase
        </span>
      </div>

      <div className="mx-3 max-w-sm flex-1 sm:mx-6">
        <button
          type="button"
          onClick={openCommandPalette}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3",
            "h-8 lg:h-9",
            "border border-[#2D313E] bg-[#161B22] text-xs text-[#8B949E] transition-all duration-150 lg:text-sm",
            "hover:border-[#444D56] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#58A6FF]"
          )}
          aria-label="Search files and commands"
        >
          <Search className="h-4 w-4 shrink-0 lg:h-[18px] lg:w-[18px]" />
          <span className="hidden truncate sm:inline-block">Search files, symbols…</span>
          <span className="truncate sm:hidden">Search…</span>
          <kbd className="ml-auto hidden items-center rounded border border-[#2D313E] bg-[#0D1117] px-1 py-0.5 font-mono text-[10px] text-[#8B949E]/50 md:inline-flex">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="[&_button]:text-[#8B949E] [&_button:hover]:bg-[#1F242D] [&_button:hover]:text-[#C9D1D9]">
          <NotificationBell />
        </div>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-md lg:h-9 lg:w-9",
            primarySidebar === "sessions"
              ? "bg-[#1F242D] text-[#58A6FF]"
              : "text-[#8B949E] hover:bg-[#1F242D] hover:text-[#C9D1D9]",
          )}
          title="Chat & Sessions"
          aria-label="Open chat and sessions"
          onClick={() => focusSidebar("sessions")}
        >
          <MessageSquare className="h-4 w-4 lg:h-[18px] lg:w-[18px]" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-[#8B949E] hover:bg-[#1F242D] hover:text-[#C9D1D9] lg:h-9 lg:w-9"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-4 w-4 lg:h-[18px] lg:w-[18px]" />
        </Button>

        <div className="mx-0.5 h-5 w-px bg-[#2D313E]" />

        <div className="relative" ref={profileRef}>
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors",
              "text-[#8B949E] hover:bg-[#1F242D] hover:text-[#C9D1D9]",
              profileOpen && "bg-[#1F242D] text-[#C9D1D9]"
            )}
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Profile menu"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#58A6FF]/40 bg-[#58A6FF]/20 lg:h-7 lg:w-7">
              <span className="text-[10px] font-bold leading-none text-[#58A6FF] lg:text-[11px]">
                {initials}
              </span>
            </div>
            <span className="hidden max-w-[100px] truncate text-xs font-medium sm:inline-block lg:text-sm">
              {user?.full_name || user?.email?.split("@")[0] || "User"}
            </span>
            <ChevronDown
              className={cn(
                "hidden h-4 w-4 transition-transform sm:block",
                profileOpen && "rotate-180"
              )}
            />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-[#2D313E] bg-[#161B22] py-1 shadow-xl shadow-black/40">
              {user?.email && (
                <div className="border-b border-[#2D313E] px-3 py-2">
                  <p className="truncate text-xs text-[#8B949E]">{user.email}</p>
                  {user.role && (
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[#8B949E]/60">
                      {user.role}
                    </p>
                  )}
                </div>
              )}
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#C9D1D9] transition-colors hover:bg-[#1F242D]"
                onClick={() => setProfileOpen(false)}
              >
                <Home className="h-4 w-4 text-[#8B949E]" />
                Dashboard
              </Link>
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                onClick={() => {
                  setProfileOpen(false);
                  handleLogout();
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
