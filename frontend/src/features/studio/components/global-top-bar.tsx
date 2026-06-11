"use client";

import * as React from "react";
import { Search, User, Settings, LogOut, ChevronDown, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function GlobalTopBar() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Close profile dropdown when clicking outside
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
    <div className="h-11 border-b border-[#1E212B] bg-[#0F1117] flex items-center justify-between px-3 shrink-0 select-none">
      {/* Left: Logo + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 group transition-opacity hover:opacity-80"
          title="Back to Dashboard"
        >
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#58A6FF] to-[#3B82F6] flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-[11px]">AI</span>
          </div>
          <span className="hidden sm:inline-block text-[#C9D1D9] font-semibold text-[13px] leading-none">
            Copilot
          </span>
        </Link>
        <span className="text-[#2D313E] hidden sm:inline-block">/</span>
        <span className="hidden sm:inline-block text-[#8B949E] text-[12px] font-medium">Studio</span>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-sm mx-3 sm:mx-6">
        <button
          className={cn(
            "w-full h-7 flex items-center gap-2 px-2.5 rounded-md",
            "bg-[#161B22] border border-[#2D313E] hover:border-[#444D56]",
            "text-[#8B949E] text-[12px] transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#58A6FF]"
          )}
          aria-label="Search files and commands"
        >
          <Search className="w-3 h-3 shrink-0" />
          <span className="truncate hidden sm:inline-block">Search files, symbols…</span>
          <span className="truncate sm:hidden">Search…</span>
          <kbd className="ml-auto hidden md:inline-flex items-center text-[9px] font-mono text-[#8B949E]/50 bg-[#0D1117] border border-[#2D313E] px-1 py-0.5 rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Settings + Profile */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1F242D] rounded-md"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-4 bg-[#2D313E] mx-0.5" />

        {/* Profile dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            className={cn(
              "flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-colors",
              "text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#1F242D]",
              profileOpen && "bg-[#1F242D] text-[#C9D1D9]"
            )}
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Profile menu"
          >
            <div className="w-5 h-5 rounded-full bg-[#58A6FF]/20 border border-[#58A6FF]/40 flex items-center justify-center">
              <span className="text-[#58A6FF] text-[9px] font-bold leading-none">{initials}</span>
            </div>
            <span className="hidden sm:inline-block text-[12px] font-medium max-w-[80px] truncate">
              {user?.full_name || user?.email?.split("@")[0] || "User"}
            </span>
            <ChevronDown className={cn("w-3 h-3 transition-transform hidden sm:block", profileOpen && "rotate-180")} />
          </button>

          {/* Dropdown */}
          {profileOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-[#2D313E] bg-[#161B22] shadow-xl shadow-black/40 py-1 z-50">
              {user?.email && (
                <div className="px-3 py-2 border-b border-[#2D313E]">
                  <p className="text-[11px] text-[#8B949E] truncate">{user.email}</p>
                  {user.role && (
                    <p className="text-[10px] text-[#8B949E]/60 mt-0.5 uppercase tracking-wide">{user.role}</p>
                  )}
                </div>
              )}
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#C9D1D9] hover:bg-[#1F242D] transition-colors"
                onClick={() => setProfileOpen(false)}
              >
                <Home className="w-3.5 h-3.5 text-[#8B949E]" />
                Dashboard
              </Link>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 transition-colors"
                onClick={() => { setProfileOpen(false); handleLogout(); }}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
