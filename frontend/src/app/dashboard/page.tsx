"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GitBranch, MessageSquare, ShieldCheck, Activity,
  Database, Users, Layers, ArrowRight, TrendingUp, Star, Zap, Sparkles,
  Code2, BarChart3, Rocket,
} from "lucide-react";
import { clearSession, getStoredUser, type CurrentUser } from "@/lib/auth";

type Metrics = {
  users_count?: number;
  projects_count?: number;
  repositories_count?: number;
  conversations_count?: number;
  messages_count?: number;
  agent_runs_count?: number;
  indexed_chunks_count?: number;
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
};

// Modern quick action cards - inspired by GitHub, Vercel, Figma
const QUICK_ACTIONS = [
  {
    href: "/repositories",
    icon: GitBranch,
    label: "Index Repositories",
    desc: "Connect GitHub repos and make code searchable",
    color: "from-blue-600 to-blue-700",
    badge: "Popular",
    stats: "1K+ indexed",
  },
  {
    href: "/chat",
    icon: Sparkles,
    label: "AI Code Chat",
    desc: "Ask questions about your codebase instantly",
    color: "from-purple-600 to-purple-700",
    badge: "New",
    stats: "Real-time answers",
  },
  {
    href: "/admin",
    icon: ShieldCheck,
    label: "Admin Control",
    desc: "Manage users, system health, and settings",
    color: "from-emerald-600 to-emerald-700",
    badge: "Admin",
    stats: "Full control",
  },
];

// Modern metric card with better visualization
function MetricCard({
  label,
  value,
  icon: Icon,
  trend,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  trend?: number;
  color: string;
}) {
  return (
    <div className="card group relative overflow-hidden p-6 transition-all hover:shadow-lg hover:scale-105">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-5 bg-gradient-to-br transition-opacity" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${trend > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
              <TrendingUp className="h-3 w-3" />
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <p className="text-3xl font-bold text-text">{value.toLocaleString()}</p>
        <p className="text-xs text-muted mt-2">{label}</p>
      </div>
    </div>
  );
}

const METRIC_META = [
  { key: "users_count" as keyof Metrics, label: "Active Users", icon: Users, color: "bg-blue-600", trend: 12 },
  { key: "repositories_count" as keyof Metrics, label: "Repositories", icon: GitBranch, color: "bg-purple-600", trend: 8 },
  { key: "indexed_chunks_count" as keyof Metrics, label: "Indexed Chunks", icon: Database, color: "bg-emerald-600", trend: 24 },
  { key: "conversations_count" as keyof Metrics, label: "Conversations", icon: MessageSquare, color: "bg-orange-600", trend: 5 },
  { key: "agent_runs_count" as keyof Metrics, label: "Agent Runs", icon: Activity, color: "bg-pink-600", trend: 18 },
  { key: "messages_count" as keyof Metrics, label: "Messages", icon: Layers, color: "bg-indigo-600", trend: 32 },
];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("aicc_token") || "";
    if (!token) { window.location.href = "/login"; return; }
    const stored = getStoredUser();
    if (!stored) {
      clearSession();
      window.location.href = "/login";
      return;
    }
    setUser(stored);

    fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const projectList = Array.isArray(data) ? data : [];
        setProjects(projectList);
        if (stored.role !== "admin") {
          setMetrics({
            projects_count: projectList.length,
            repositories_count: 0,
          });
          // Fetch repos for all projects and sum them
          Promise.all(
            projectList.map((p: Project) =>
              fetch(`/api/projects/${p.id}/repositories`, { headers: { Authorization: `Bearer ${token}` } })
                .then((r) => (r.ok ? r.json() : []))
                .then((repos: unknown[]) => (Array.isArray(repos) ? repos.length : 0))
                .catch(() => 0)
            )
          ).then((counts) => {
            const total = counts.reduce((a: number, b: number) => a + b, 0);
            setMetrics((prev) => ({ ...prev, repositories_count: total }));
          });
        }
      })
      .catch(() => null);

    if (stored.role === "admin") {
      fetch("/api/admin/system-metrics", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then(setMetrics).catch(() => null);
      return;
    }
  }, []);

  const quickActions = user?.role === "admin"
    ? QUICK_ACTIONS
    : QUICK_ACTIONS.filter((item) => item.href !== "/admin");

  const metricMeta = user?.role === "admin"
    ? METRIC_META
    : METRIC_META.filter((item) => item.key !== "users_count");

  return (
    <div className="animate-fade-in space-y-12">
      {/* Modern Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-8 text-white sm:p-12">
        <div className="absolute inset-0 opacity-20 bg-grid-white/25" />
        <div className="absolute -right-40 -top-40 h-80 w-80 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -left-40 -bottom-40 h-80 w-80 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-medium">
            <Rocket className="h-4 w-4" />
            AI-Powered Code Intelligence
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Welcome back, {user?.full_name || "Developer"}! 👋</h1>
          <p className="text-lg text-white/90 max-w-2xl">Index repositories, ask questions about your codebase, and get instant AI-powered insights powered by local LLMs.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/repositories" className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 px-6 py-3 rounded-lg font-semibold transition-all">
              <Code2 className="h-5 w-5" />
              Index Repository
            </Link>
            <Link href="/chat" className="inline-flex items-center gap-2 bg-white/20 text-white hover:bg-white/30 px-6 py-3 rounded-lg font-semibold backdrop-blur-sm transition-all border border-white/30">
              <Sparkles className="h-5 w-5" />
              Start Chat
            </Link>
          </div>
        </div>
      </div>

      {/* Modern Metrics Grid */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            System Metrics
          </h2>
          <p className="text-sm text-muted mt-1">Real-time analytics of your AI Copilot platform</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {metricMeta.map(({ key, label, icon: Icon, color, trend }) => (
            <MetricCard key={key} label={label} value={metrics[key] ?? 0} icon={Icon} color={color} trend={trend} />
          ))}
        </div>
      </section>

      {/* Modern Quick Actions */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-text flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-600" />
            Quick Actions
          </h2>
          <p className="text-sm text-muted mt-1">Get started in seconds</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map(({ href, icon: Icon, label, desc, color, badge, stats }) => (
            <Link
              key={href}
              href={href}
              className="group card relative overflow-hidden p-6 hover:shadow-xl transition-all hover:scale-105 cursor-pointer"
            >
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 bg-gradient-to-br ${color} transition-opacity`} />
              
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-lg`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    <Star className="h-3 w-3" />
                    {badge}
                  </span>
                </div>
                
                <h3 className="font-bold text-lg text-text mb-2">{label}</h3>
                <p className="text-sm text-muted mb-4">{desc}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-xs font-medium text-blue-600">{stats}</span>
                  <ArrowRight className="h-4 w-4 text-muted group-hover:text-blue-600 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Your Projects */}
      {user?.role !== "admin" && projects.length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-text">Your Projects</h2>
            <p className="text-sm text-muted mt-1">{projects.length} active {projects.length === 1 ? "project" : "projects"}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="card hover:shadow-md transition-all group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-text group-hover:text-blue-600 transition-colors">{project.name}</h3>
                    <p className="mt-2 text-sm text-muted">{project.description || "No description added yet"}</p>
                  </div>
                  <Star className="h-5 w-5 text-muted group-hover:text-amber-500 transition-colors" />
                </div>
                <Link href={`/repositories?project=${project.id}`} className="mt-4 inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700">
                  View Project <ArrowRight className="h-3 w-3 ml-1" />
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {user?.role !== "admin" && projects.length === 0 && (
        <section className="rounded-2xl border-2 border-dashed border-border bg-surface2/50 p-12 text-center">
          <Code2 className="mx-auto h-16 w-16 text-muted opacity-40 mb-4" />
          <h3 className="text-lg font-semibold text-text mb-2">No projects yet</h3>
          <p className="text-muted mb-6">Create your first project and start indexing repositories</p>
          <Link href="/repositories" className="inline-flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-all">
            <Code2 className="h-5 w-5" />
            Create First Project
          </Link>
        </section>
      )}
    </div>
  );
}
