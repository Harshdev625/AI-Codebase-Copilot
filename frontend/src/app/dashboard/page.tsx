"use client";

import Link from "next/link";
import { useEffect, useState, type ElementType } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Code2,
  Database,
  FolderOpen,
  GitBranch,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clearSession, getStoredUser, type CurrentUser } from "@/lib/auth";
import { apiRequest, requireData } from "@/lib/http";

type Metrics = {
  users_count?: number;
  projects_count?: number;
  repositories_count?: number;
  indexed_chunks_count?: number;
};

type Project = {
  id: string;
  name: string;
  description?: string | null;
};

type DashboardMeResponse = {
  user: CurrentUser;
  metrics: Metrics;
  recent_repositories: Array<{
    id: string;
    repo_id: string;
    default_branch?: string;
    latest_index_status?: string | null;
    created_at?: string;
  }>;
};

const QUICK_ACTIONS = [
  {
    href: "/repositories",
    icon: GitBranch,
    label: "Index Repositories",
    desc: "Connect GitHub repos and make code searchable",
    color: "from-cyan-700 to-teal-700",
    badge: "Popular",
  },
  {
    href: "/chat",
    icon: Sparkles,
    label: "AI Code Chat",
    desc: "Ask questions about your codebase instantly",
    color: "from-amber-600 to-orange-700",
    badge: "New",
  },
  {
    href: "/admin",
    icon: ShieldCheck,
    label: "Admin Control",
    desc: "Manage users, system health, and settings",
    color: "from-emerald-600 to-emerald-700",
    badge: "Admin",
  },
];

const USER_QUICK_ACTIONS = QUICK_ACTIONS.filter((item) => item.href !== "/admin");

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: ElementType;
  color: string;
}) {
  return (
    <Card className="group relative overflow-hidden p-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8 opacity-0 transition-opacity group-hover:opacity-100" />
      <CardContent className="relative z-10 p-5">
        <div className="mb-3 flex items-start justify-between">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        <p className="text-3xl font-bold text-text">{value.toLocaleString()}</p>
        <p className="mt-2 text-xs text-muted">{label}</p>
      </CardContent>
    </Card>
  );
}

const ADMIN_METRIC_META = [
  { key: "projects_count" as keyof Metrics, label: "Projects", icon: FolderOpen, color: "bg-cyan-600" },
  { key: "users_count" as keyof Metrics, label: "Active Users", icon: Users, color: "bg-blue-600" },
  { key: "repositories_count" as keyof Metrics, label: "Repositories", icon: GitBranch, color: "bg-teal-700" },
  { key: "indexed_chunks_count" as keyof Metrics, label: "Indexed Chunks", icon: Database, color: "bg-emerald-600" },
];

const USER_METRIC_META = [
  { key: "projects_count" as keyof Metrics, label: "My Projects", icon: FolderOpen, color: "bg-cyan-600" },
  { key: "repositories_count" as keyof Metrics, label: "My Repositories", icon: GitBranch, color: "bg-teal-700" },
  { key: "indexed_chunks_count" as keyof Metrics, label: "Indexed Chunks", icon: Database, color: "bg-emerald-600" },
];

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [recentRepositories, setRecentRepositories] = useState<DashboardMeResponse["recent_repositories"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("aicc_token") || "";
    if (!token) {
      window.location.href = "/login";
      return;
    }
    const stored = getStoredUser();
    if (!stored) {
      clearSession();
      window.location.href = "/login";
      return;
    }
    setUser(stored);

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        let hasDashboardSummary = false;
        const dashboardResult = await apiRequest<DashboardMeResponse>("/api/dashboard/me");
        if (dashboardResult.success && dashboardResult.data) {
          const dashboardData = dashboardResult.data;
          setMetrics(dashboardData.metrics || {});
          setRecentRepositories(dashboardData.recent_repositories || []);
          hasDashboardSummary = true;
        }

        if (stored.role === "ADMIN") {
          const adminMetricsResult = await apiRequest<Metrics>("/api/admin/system-metrics");
          setMetrics(requireData(adminMetricsResult, "Failed to load admin metrics"));
        } else {
          const projectsResult = await apiRequest<Project[]>("/api/projects");
          if (projectsResult.success && projectsResult.data) {
            const projectList = projectsResult.data;
            const normalizedProjects = Array.isArray(projectList) ? projectList : [];
            setProjects(normalizedProjects);
            if (!hasDashboardSummary) {
              setMetrics((prev) => ({ ...prev, projects_count: normalizedProjects.length }));
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const quickActions = user?.role === "ADMIN" ? QUICK_ACTIONS : USER_QUICK_ACTIONS;

  const metricMeta = user?.role === "ADMIN" ? ADMIN_METRIC_META : USER_METRIC_META;

  return (
    <div className="animate-fade-in space-y-8">
      <Card className="relative overflow-hidden border border-primary/25 bg-gradient-to-br from-primary/20 via-surface to-accent/10 p-0">
        <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
        <CardContent className="relative z-10 p-6 sm:p-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-dim px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            <Rocket className="h-4 w-4" />
            AI-Powered Code Intelligence
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Welcome back, {user?.full_name || "Developer"}!
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
            Index repositories, ask questions about your codebase, and get instant AI-powered insights powered by local LLMs.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
            <Link
              href="/repositories"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              <Code2 className="h-5 w-5" />
              Index Repository
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/70 px-5 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface"
            >
              <Sparkles className="h-5 w-5" />
              Start Chat
            </Link>
          </div>
        </CardContent>
      </Card>

      <section>
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-xl font-bold text-text">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            {user?.role === "ADMIN" ? "Platform Insights" : "My Workspace Insights"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {user?.role === "ADMIN"
              ? "System-wide analytics for all users and projects"
              : "Your own projects and repositories summary"}
          </p>
        </div>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {loading ? (
          <Card>
            <CardContent className="p-5 text-sm text-muted">Loading dashboard data...</CardContent>
          </Card>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metricMeta.map(({ key, label, icon: Icon, color }) => (
            <MetricCard key={key} label={label} value={metrics[key] ?? 0} icon={Icon} color={color} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-xl font-bold text-text">
            <Zap className="h-6 w-6 text-amber-600" />
            Quick Actions
          </h2>
          <p className="mt-1 text-sm text-muted">Get started in seconds</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map(({ href, icon: Icon, label, desc, color, badge }) => (
            <Link
              key={href}
              href={href}
              className="group"
            >
              <Card className="relative h-full overflow-hidden p-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-xl">
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${color} opacity-0 transition-opacity group-hover:opacity-10`} />

                <CardContent className="relative z-10 p-5">
                  <div className="mb-4 flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-lg`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="badge badge-cyan gap-1">
                      <Star className="h-3 w-3" />
                      {badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-text">{label}</h3>
                  <p className="mt-2 text-sm text-muted">{desc}</p>

                  <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs font-semibold text-primary">Open {label}</span>
                    <ArrowRight className="h-4 w-4 text-muted transition-colors group-hover:text-primary" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <Card>
          <CardHeader className="mb-0">
            <CardTitle>Recent Repositories</CardTitle>
            <CardDescription>Most recent repositories in your accessible projects</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentRepositories.length === 0 ? <p className="text-xs text-muted">No recent repositories.</p> : null}
            {recentRepositories.map((repo) => (
              <div key={repo.id} className="rounded-xl border border-border bg-surface2/70 p-3">
                <p className="text-sm font-medium text-text">{repo.repo_id}</p>
                <p className="mt-1 text-xs text-muted">
                  Branch: {repo.default_branch || "main"} · Status: {(repo.latest_index_status || "pending").toUpperCase()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {user?.role !== "ADMIN" && projects.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-text">Your Projects</h2>
            <p className="mt-1 text-sm text-muted">
              {projects.length} active {projects.length === 1 ? "project" : "projects"}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="group transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
                <CardContent>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-text transition-colors group-hover:text-primary">{project.name}</h3>
                      <p className="mt-2 text-sm text-muted">{project.description || "No description added yet"}</p>
                    </div>
                    <Star className="h-4 w-4 text-muted transition-colors group-hover:text-accent" />
                  </div>
                  <Link
                    href={`/repositories?project=${project.id}`}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover"
                  >
                    View Project
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {user?.role !== "ADMIN" && projects.length === 0 && (
        <Card className="border-dashed bg-surface2/50 p-0 text-center">
          <CardContent className="p-10">
            <Code2 className="mx-auto mb-4 h-14 w-14 text-muted/60" />
            <h3 className="text-lg font-semibold text-text">No projects yet</h3>
            <p className="mt-2 text-sm text-muted">Create your first project and start indexing repositories.</p>
            <div className="mt-5">
              <Link href="/repositories">
                <Button className="gap-2">
                  <Code2 className="h-4 w-4" />
                  Create First Project
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
