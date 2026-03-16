"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GitBranch, MessageSquare, ShieldCheck, Activity,
  Database, Users, Layers, ArrowRight, TrendingUp, Clock,
} from "lucide-react";

type Metrics = {
  users_count?: number;
  projects_count?: number;
  repositories_count?: number;
  conversations_count?: number;
  messages_count?: number;
  agent_runs_count?: number;
  indexed_chunks_count?: number;
};

const QUICK_LINKS = [
  { href: "/repositories", icon: GitBranch,   label: "Repositories", desc: "Index and manage GitHub repos for AI analysis.",              badge: "cyan",   badgeText: "Connect" },
  { href: "/chat",         icon: MessageSquare,label: "AI Chat",      desc: "Ask architecture, debugging, and refactoring questions.",    badge: "purple", badgeText: "Chat"    },
  { href: "/admin",        icon: ShieldCheck,  label: "Admin Panel",  desc: "System metrics, user management, and agent run logs.",       badge: "green",  badgeText: "Admin"   },
];

function MetricCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight text-text">{value.toLocaleString()}</p>
        <p className="mt-0.5 text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

const METRIC_META = [
  { key: "users_count"         as keyof Metrics, label: "Total Users",     icon: Users,        color: "bg-primary-dim text-primary"  },
  { key: "repositories_count"  as keyof Metrics, label: "Repositories",    icon: GitBranch,    color: "bg-accent-dim text-accent"    },
  { key: "indexed_chunks_count"as keyof Metrics, label: "Indexed Chunks",  icon: Database,     color: "bg-success-dim text-success"  },
  { key: "conversations_count" as keyof Metrics, label: "Conversations",   icon: MessageSquare,color: "bg-warning-dim text-warning"  },
  { key: "agent_runs_count"    as keyof Metrics, label: "Agent Runs",      icon: Activity,     color: "bg-danger-dim text-danger"    },
  { key: "messages_count"      as keyof Metrics, label: "Total Messages",  icon: Layers,       color: "bg-primary-dim text-primary"  },
];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({});

  useEffect(() => {
    const token = localStorage.getItem("aicc_token") || "";
    if (!token) { window.location.href = "/login"; return; }
    fetch("/api/admin/system-metrics", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then(setMetrics).catch(() => null);
  }, []);

  return (
    <div className="animate-fade-in space-y-8">
      {/* Welcome banner */}
      <div className="card relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-hero-glow opacity-60" />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-dim px-3 py-1 text-xs text-primary">
              <TrendingUp className="h-3.5 w-3.5" /> AI-Powered Code Intelligence
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-text">Welcome to AI Codebase Copilot</h2>
            <p className="mt-1 text-sm text-muted">Index repos, chat with your codebase, debug, refactor, and generate docs — all powered by local LLMs.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
            <Clock className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <section>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-subtle">System Overview</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {METRIC_META.map(({ key, label, icon, color }) => (
            <MetricCard key={key} label={label} value={metrics[key] ?? 0} icon={icon} color={color} />
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-subtle">Quick Actions</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {QUICK_LINKS.map(({ href, icon: Icon, label, desc, badge, badgeText }) => (
            <Link key={href} href={href} className="group card flex flex-col gap-4 transition-all hover:border-border-active hover:shadow-glow">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface2 ring-1 ring-border transition-all group-hover:bg-primary-dim group-hover:ring-primary/30">
                  <Icon className="h-5 w-5 text-muted transition-colors group-hover:text-primary" />
                </div>
                <span className={`badge badge-${badge}`}>{badgeText}</span>
              </div>
              <div>
                <p className="font-semibold text-text">{label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{desc}</p>
              </div>
              <div className="mt-auto flex items-center gap-1 text-xs text-subtle transition-colors group-hover:text-primary">
                Open <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
