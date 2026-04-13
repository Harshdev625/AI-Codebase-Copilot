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
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { clearSession, getStoredUser, type CurrentUser } from "@/lib/auth";

const navLinks = [
  { href: "/dashboard",    label: "Dashboard",     icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories",  icon: GitBranch },
  { href: "/chat",         label: "AI Chat",       icon: MessageSquare },
];

type SidebarProps = {
  onNavigate?: () => void;
  className?: string;
};

export default function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, [pathname]);

  function logout() {
    clearSession();
    router.push("/login");
  }

  const links =
    user?.role === "ADMIN"
      ? [...navLinks, { href: "/admin/dashboard", label: "Admin", icon: ShieldCheck }]
      : navLinks;

  const roleLabel = user?.role === "ADMIN" ? "Administrator" : "Developer";

  return (
    <aside className={`flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface ${className ?? ""}`}>
      <div className="border-b border-border px-5 py-5">
        <Link href="/dashboard" className="group flex items-center gap-3" onClick={onNavigate}>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-sm transition-transform group-hover:scale-105">
            <Code2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">AI Codebase Copilot</p>
            <p className="text-xs text-muted">Agentic repository assistant</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-surface3 text-text"
                  : "text-muted hover:bg-surface2 hover:text-text"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex flex-1 items-center justify-between">
                <span className="flex-1">{label}</span>
                {active ? <ChevronRight className="h-4 w-4 text-primary" /> : null}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 rounded-2xl border border-border bg-surface2 px-4 py-3">
        <p className="text-xs text-muted">Runtime</p>
        <div className="mt-1 flex items-center gap-2 text-sm font-medium text-text">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Local Ollama + RAG</span>
        </div>
      </div>

      <div className="mt-4 border-t border-border px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-surface2 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
            {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{user?.full_name || user?.email || "User"}</p>
            <p className="truncate text-xs text-muted">{roleLabel}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted transition-colors hover:text-text"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
