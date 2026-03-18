"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Code2,
  LayoutDashboard,
  GitBranch,
  MessageSquare,
  ShieldCheck,
  LogOut,
  User,
  ChevronRight,
  Activity,
  Zap,
  Settings,
} from "lucide-react";
import { clearSession, getStoredUser, type CurrentUser } from "@/lib/auth";

const navLinks = [
  { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories",  icon: GitBranch },
  { href: "/chat",         label: "AI Chat",        icon: MessageSquare },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, [pathname]);

  function logout() {
    clearSession();
    router.push("/login");
  }

  const links = user?.role === "admin"
    ? [...navLinks, { href: "/admin", label: "Admin Panel", icon: ShieldCheck }]
    : navLinks;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border/50 bg-gradient-to-b from-surface to-background">
      {/* ── Modern Brand Header ──────────────────────────────────────────────── */}
      <div className="p-5 border-b border-border/50 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
        <Link href="/dashboard" className="flex items-center gap-3 group cursor-pointer mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg group-hover:shadow-xl transition-all group-hover:scale-110">
            <Code2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-text group-hover:text-blue-600 transition-colors">AI Copilot</p>
            <p className="truncate text-xs text-muted group-hover:text-blue-500 transition-colors">Codebase Intelligence</p>
          </div>
        </Link>
      </div>

      {/* ── Modern Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all relative overflow-hidden ${
                active
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/20"
                  : "text-muted hover:text-text hover:bg-surface2/80"
              }`}
            >
              {active && <div className="absolute inset-0 bg-white/10 animate-pulse" />}
              
              <div className="relative z-10 flex items-center gap-3 flex-1">
                <Icon className={`h-5 w-5 shrink-0 transition-transform ${active ? "scale-110" : "group-hover:scale-110"}`} />
                <span className="flex-1">{label}</span>
              </div>
              
              {active && <ChevronRight className="h-4 w-4 opacity-80" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Status Indicator ─────────────────────────────────────────────── */}
      <div className="mx-3 mb-4 rounded-xl border border-green-500/20 bg-green-50/50 dark:bg-green-950/20 px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-400">
          <div className="relative">
            <Activity className="h-4 w-4" />
            <span className="absolute inset-0 animate-pulse opacity-50" />
          </div>
          <span>Backend Running</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>Active</span>
          </span>
        </div>
      </div>

      {/* ── User Profile Footer ─────────────────────────────────────────── */}
      <div className="border-t border-border/50 bg-surface2/50 p-4 space-y-3">
        <div className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-surface2/80 transition-colors group cursor-default">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold text-sm shadow-md">
            {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-text">{user?.full_name || user?.email || "User"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${user?.role === "admin" ? "bg-purple-500" : "bg-blue-500"}`} />
              <p className="truncate text-xs text-muted capitalize">{user?.role || "guest"}</p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="rounded-lg p-2 text-muted transition-all hover:bg-red-100/50 hover:text-red-600 dark:hover:bg-red-950/50"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Link 
            href="/admin" 
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted hover:text-text hover:bg-surface2/80 transition-all"
            title="Settings"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          <button
            onClick={() => window.location.href = "/"}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted hover:text-text hover:bg-surface2/80 transition-all"
            title="Help"
          >
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Help</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
