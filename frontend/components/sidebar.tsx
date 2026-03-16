"use client";

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
  Cpu,
} from "lucide-react";

const navLinks = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories", icon: GitBranch      },
  { href: "/chat",         label: "AI Chat",       icon: MessageSquare  },
  { href: "/admin",        label: "Admin",         icon: ShieldCheck    },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  function logout() {
    localStorage.removeItem("aicc_token");
    localStorage.removeItem("aicc_project_id");
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface">
      {/* ── Brand ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-dim ring-1 ring-primary/30">
          <Code2 className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">AI Copilot</p>
          <p className="truncate text-xs text-subtle">Codebase Intelligence</p>
        </div>
      </div>

      {/* ── Nav ────────────────────────────────────────────────── */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={[
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary-dim text-primary shadow-inner"
                  : "text-muted hover:bg-surface2 hover:text-text",
              ].join(" ")}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* ── Status indicator ───────────────────────────────────── */}
      <div className="mx-3 mb-3 rounded-lg border border-border bg-surface2 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Cpu className="h-3.5 w-3.5 text-success" />
          <span>Backend</span>
          <span className="ml-auto flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-success">Active</span>
          </span>
        </div>
      </div>

      {/* ── User footer ────────────────────────────────────────── */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-dim ring-1 ring-primary/30">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-text">Admin User</p>
            <p className="truncate text-xs text-subtle">admin@aicc.dev</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-danger-dim hover:text-danger"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
