"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, GitBranch, Database,
  Activity, FolderOpen, RefreshCw,
  ShieldCheck, CheckCircle, AlertCircle, Server,
  Shield, ShieldOff, Trash2, Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableContainer, TBody, THead } from "@/components/ui/table";
import { clearSession, getStoredUser } from "@/lib/auth";
import { apiRequest, requireData } from "@/lib/http";

type Metrics = {
  users_count?:         number;
  projects_count?:      number;
  repositories_count?:  number;
  indexed_chunks_count?: number;
};

type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at?: string;
};

type ServiceHealth = {
  name: string;
  status: "online" | "offline";
  detail?: string | null;
};

type RecentIndexingJob = {
  id: string;
  status: string;
  message?: string | null;
  created_at?: string;
};

type RecentActivityPayload = {
  indexing_jobs: RecentIndexingJob[];
  recent_users: User[];
};

const METRIC_CARDS = [
  { key: "users_count"          as keyof Metrics, label: "Total Users",      icon: Users,        color: "bg-primary-dim text-primary" },
  { key: "projects_count"       as keyof Metrics, label: "Projects",         icon: FolderOpen,   color: "bg-accent-dim text-accent"   },
  { key: "repositories_count"   as keyof Metrics, label: "Repositories",     icon: GitBranch,    color: "bg-success-dim text-success" },
  { key: "indexed_chunks_count" as keyof Metrics, label: "Indexed Chunks",   icon: Database,     color: "bg-warning-dim text-warning" },
];

export default function AdminPage() {
  const router = useRouter();
  const [metrics,  setMetrics]  = useState<Metrics>({});
  const [users,    setUsers]    = useState<User[]>([]);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<"metrics" | "users" | "services" | "activity">("metrics");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityPayload>({ indexing_jobs: [], recent_users: [] });

  async function load() {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("aicc_token") || "";
    const user = getStoredUser();
    if (!token || !user) {
      clearSession();
      router.replace("/login");
      return;
    }
    if (user.role !== "ADMIN") {
      router.replace("/dashboard");
      return;
    }
    setCurrentUser({
      id: user.id,
      email: user.email,
      full_name: user.full_name || "",
      role: user.role,
      is_active: true,
    });
    try {
      const [metricsResult, usersResult] = await Promise.all([
        apiRequest<Metrics>("/api/admin/system-metrics"),
        apiRequest<User[]>("/api/admin/users"),
      ]);
      setMetrics(requireData(metricsResult, "Failed to load admin metrics"));
      setUsers(requireData(usersResult, "Failed to load users"));

      // Optional dashboard panels should not block primary admin data.
      const [serviceResult, activityResult] = await Promise.all([
        apiRequest<ServiceHealth[]>("/api/admin/service-health"),
        apiRequest<RecentActivityPayload>("/api/admin/recent-activity"),
      ]);

      if (serviceResult.success && serviceResult.data) {
        setServices(serviceResult.data);
      } else {
        setServices([]);
      }

      if (activityResult.success && activityResult.data) {
        setRecentActivity(activityResult.data);
      } else {
        setRecentActivity({ indexing_jobs: [], recent_users: [] });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    setUpdatingUserId(userId);
    try {
      const result = await apiRequest<User>(`/api/admin/users/${userId}/role`, {
        method: "POST",
        body: { role: newRole },
      });
      requireData(result, "Failed to update user role");
      // Refresh users list
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user role");
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function deleteUser(userId: string, userEmail: string) {
    if (!confirm(`Delete user ${userEmail}? This cannot be undone.`)) return;

    setUpdatingUserId(userId);
    try {
      const result = await apiRequest<{ deleted: boolean }>(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      requireData(result, "Failed to delete user");
      // Refresh users list
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setUpdatingUserId(null);
    }
  }

  useEffect(() => { load(); }, []);

  const tabs = [
    { id: "metrics"  as const, label: "Metrics",  icon: Activity   },
    { id: "users"    as const, label: "Users",     icon: Users      },
    { id: "activity" as const, label: "Activity",  icon: Users2 },
    { id: "services" as const, label: "Services",  icon: Server     },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <Card className="relative overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/20 via-surface to-accent/10 py-4">
        <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-dim ring-1 ring-primary/30">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-text">Admin Control Panel</p>
              <p className="text-xs text-muted">System health, users, and platform metrics</p>
            </div>
          </div>
          <Button onClick={load} disabled={loading} variant="secondary" size="sm">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex min-w-[120px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === id ? "bg-primary-dim text-primary shadow-inner" : "text-muted hover:text-text"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "metrics" && (
        <div className="grid animate-fade-in gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METRIC_CARDS.map(({ key, label, icon: Icon, color }) => (
            <Card key={key} className="flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-text">{(metrics[key] ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "users" && (
        <Card className="animate-fade-in overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold text-text">Manage Users</h3>
            <span className="badge badge-cyan">{users.length} total</span>
          </div>
          <p className="px-5 pt-3 text-xs text-muted">Promoted admins from this panel. Only admins can access system controls.</p>
          {users.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">No users found.</div>
          ) : (
            <TableContainer>
              <Table className="min-w-[760px]">
                <THead>
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium text-muted">User</th>
                    <th className="px-5 py-3 text-xs font-medium text-muted">Role</th>
                    <th className="px-5 py-3 text-xs font-medium text-muted">Status</th>
                    <th className="px-5 py-3 text-xs font-medium text-muted">Joined</th>
                    <th className="px-5 py-3 text-xs font-medium text-muted">Actions</th>
                  </tr>
                </THead>
                <TBody>
                  {users.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-surface2">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-dim text-xs font-bold text-primary">
                            {(u.full_name || u.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-text">{u.full_name || "-"} {u.id === currentUser?.id ? <span className="text-xs text-muted">(you)</span> : null}</p>
                            <p className="text-xs text-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${u.role === "ADMIN" ? "badge-purple" : "badge-cyan"}`}>{u.role}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`badge ${u.is_active ? "badge-green" : "badge-red"}`}>
                          {u.is_active ? (
                            <><CheckCircle className="mr-1 inline h-2.5 w-2.5" />Active</>
                          ) : (
                            <><AlertCircle className="mr-1 inline h-2.5 w-2.5" />Inactive</>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {u.id !== currentUser?.id ? (
                            <>
                              <Button
                                onClick={() => updateUserRole(u.id, u.role === "ADMIN" ? "USER" : "ADMIN")}
                                disabled={updatingUserId === u.id}
                                variant="secondary"
                                size="sm"
                                className="gap-1 px-2 py-1 text-xs"
                                title={u.role === "ADMIN" ? "Demote to user" : "Promote to admin"}
                              >
                                {u.role === "ADMIN" ? <ShieldOff className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                              </Button>
                              <Button
                                onClick={() => deleteUser(u.id, u.email)}
                                disabled={updatingUserId === u.id}
                                variant="secondary"
                                size="sm"
                                className="gap-1 px-2 py-1 text-xs"
                                title="Delete user"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      )}

      {tab === "services" && (
        <div className="grid animate-fade-in gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.length === 0 ? <p className="text-xs text-muted">No service data available.</p> : null}
          {services.map((svc) => (
            <Card key={svc.name} className="flex items-center gap-4 py-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${svc.status === "online" ? "bg-success-dim ring-success/30" : "bg-danger-dim ring-danger/30"} ring-1`}>
                <Server className={`h-5 w-5 ${svc.status === "online" ? "text-success" : "text-danger"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text">{svc.name}</p>
                <p className="text-xs text-muted">{svc.detail || "Healthy"}</p>
              </div>
              <span className={`badge ${svc.status === "online" ? "badge-green" : "badge-red"}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${svc.status === "online" ? "bg-success" : "bg-danger"}`} /> {svc.status}
              </span>
            </Card>
          ))}
        </div>
      )}

      {tab === "activity" && (
        <div className="grid animate-fade-in gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="text-sm font-semibold text-text">Recent Indexing Jobs</h3>
            <div className="mt-3 space-y-2">
              {recentActivity.indexing_jobs.length === 0 ? <p className="text-xs text-muted">No indexing activity yet.</p> : null}
              {recentActivity.indexing_jobs.map((job) => (
                <div key={job.id} className="rounded-md border border-border p-3">
                  <p className="text-xs font-medium text-text">{job.status.toUpperCase()}</p>
                  <p className="mt-1 text-xs text-muted">{job.message || "No message"}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-text">Recent Users</h3>
            <div className="mt-3 space-y-2">
              {recentActivity.recent_users.length === 0 ? <p className="text-xs text-muted">No recent users yet.</p> : null}
              {recentActivity.recent_users.map((u) => (
                <div key={u.id} className="rounded-md border border-border p-3">
                  <p className="text-xs font-medium text-text">{u.email}</p>
                  <p className="mt-1 text-xs text-muted">{u.role}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
