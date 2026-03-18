"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, GitBranch, Database, MessageSquare,
  Activity, Layers, FolderOpen, RefreshCw,
  ShieldCheck, CheckCircle, AlertCircle, Server,
  Shield, ShieldOff, ChevronDown, Trash2,
} from "lucide-react";
import { clearSession, getStoredUser } from "@/lib/auth";

type Metrics = {
  users_count?:         number;
  projects_count?:      number;
  repositories_count?:  number;
  conversations_count?: number;
  messages_count?:      number;
  agent_runs_count?:    number;
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

const METRIC_CARDS = [
  { key: "users_count"          as keyof Metrics, label: "Total Users",      icon: Users,        color: "bg-primary-dim text-primary" },
  { key: "projects_count"       as keyof Metrics, label: "Projects",         icon: FolderOpen,   color: "bg-accent-dim text-accent"   },
  { key: "repositories_count"   as keyof Metrics, label: "Repositories",     icon: GitBranch,    color: "bg-success-dim text-success" },
  { key: "indexed_chunks_count" as keyof Metrics, label: "Indexed Chunks",   icon: Database,     color: "bg-warning-dim text-warning" },
  { key: "conversations_count"  as keyof Metrics, label: "Conversations",    icon: MessageSquare,color: "bg-primary-dim text-primary" },
  { key: "messages_count"       as keyof Metrics, label: "Messages",         icon: Layers,       color: "bg-accent-dim text-accent"   },
  { key: "agent_runs_count"     as keyof Metrics, label: "Agent Runs",       icon: Activity,     color: "bg-danger-dim text-danger"   },
];

const SERVICES = [
  { name: "Backend API",  port: "8000", status: "online"  },
  { name: "PostgreSQL",   port: "5432", status: "online"  },
  { name: "Qdrant",       port: "6333", status: "online"  },
  { name: "Redis",        port: "6379", status: "online"  },
  { name: "Ollama",       port: "11434",status: "online"  },
];

export default function AdminPage() {
  const router = useRouter();
  const [metrics,  setMetrics]  = useState<Metrics>({});
  const [users,    setUsers]    = useState<User[]>([]);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<"metrics" | "users" | "services">("metrics");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

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
    if (user.role !== "admin") {
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
      const [mRes, uRes] = await Promise.all([
        fetch("/api/admin/system-metrics", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/admin/users",          { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!mRes.ok) {
        const data = await mRes.json();
        throw new Error(data?.detail || "Failed to load admin metrics");
      }
      if (!uRes.ok) {
        const data = await uRes.json();
        throw new Error(data?.detail || "Failed to load users");
      }
      setMetrics(await mRes.json());
      setUsers(await uRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId: string, newRole: string) {
    const token = localStorage.getItem("aicc_token") || "";
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.detail || "Failed to update user role");
      }
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
    
    const token = localStorage.getItem("aicc_token") || "";
    setUpdatingUserId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.detail || "Failed to delete user");
      }
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
    { id: "services" as const, label: "Services",  icon: Server     },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Admin header */}
      <div className="card flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-dim ring-1 ring-primary/30">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-text">Admin Control Panel</p>
            <p className="text-xs text-muted">System health, users, and platform metrics</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === id ? "bg-primary-dim text-primary shadow-inner" : "text-muted hover:text-text"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {/* Metrics tab */}
      {tab === "metrics" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
          {METRIC_CARDS.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="card flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold text-text">{(metrics[key] ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users tab */}
      {tab === "users" && (
        <div className="card overflow-hidden p-0 animate-fade-in">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h3 className="text-sm font-semibold text-text">Manage Users</h3>
            <span className="badge badge-cyan">{users.length} total</span>
          </div>
          <p className="px-5 pt-3 text-xs text-muted">Promoted admins from this panel. Only admins can access system controls.</p>
          {users.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted">No users found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-muted">User</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted">Role</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted">Status</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted">Joined</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-surface2">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-dim text-xs font-bold text-primary">
                          {(u.full_name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-text">{u.full_name || "—"} {u.id === currentUser?.id && <span className="text-xs text-muted">(you)</span>}</p>
                          <p className="text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${u.role === "admin" ? "badge-purple" : "badge-cyan"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${u.is_active ? "badge-green" : "badge-red"}`}>
                        {u.is_active
                          ? <><CheckCircle className="h-2.5 w-2.5 inline mr-1" />Active</>
                          : <><AlertCircle className="h-2.5 w-2.5 inline mr-1" />Inactive</>
                        }
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {u.id !== currentUser?.id && (
                          <>
                            <button
                              onClick={() => updateUserRole(u.id, u.role === "admin" ? "developer" : "admin")}
                              disabled={updatingUserId === u.id}
                              className="btn-secondary gap-1 py-1 px-2 text-xs"
                              title={u.role === "admin" ? "Demote to developer" : "Promote to admin"}
                            >
                              {u.role === "admin" ? (
                                <ShieldOff className="h-3 w-3" />
                              ) : (
                                <Shield className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteUser(u.id, u.email)}
                              disabled={updatingUserId === u.id}
                              className="btn-secondary gap-1 py-1 px-2 text-xs"
                              title="Delete user"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Services tab */}
      {tab === "services" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in">
          {SERVICES.map((svc) => (
            <div key={svc.name} className="card flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-dim ring-1 ring-success/30">
                <Server className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text">{svc.name}</p>
                <p className="text-xs text-muted">Port {svc.port}</p>
              </div>
              <span className="badge badge-green">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> Online
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
