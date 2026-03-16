"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./sidebar";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":    "Dashboard",
  "/repositories": "Repositories",
  "/chat":         "AI Chat",
  "/admin":        "Admin",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic  = pathname === "/login" || pathname === "/";

  if (isPublic) return <>{children}</>;

  const title = Object.entries(PAGE_TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? "";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      {/* ── Main area ──────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
          <h1 className="text-sm font-semibold text-text">{title}</h1>
          <div className="flex items-center gap-2">
            <span className="badge badge-cyan">v0.1.0</span>
            <span className="badge badge-purple">Ollama</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
