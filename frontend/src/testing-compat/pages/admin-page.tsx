"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type StoredUser = {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  is_active?: boolean;
};

type Service = {
  name: string;
  status: string;
  detail?: string | null;
};

type Metrics = {
  detail?: string;
  users_count?: number;
  projects_count?: number;
};

function parseStoredUser(): StoredUser | null {
  try {
    const raw = window.localStorage.getItem("aicc_user");
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

export default function AdminPage(): React.JSX.Element {
  const { replace } = useRouter();
  const [currentUser, setCurrentUser] = React.useState<StoredUser | null>(null);
  const [metrics, setMetrics] = React.useState<Metrics | null>(null);
  const [users, setUsers] = React.useState<StoredUser[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [error, setError] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"overview" | "users" | "services">("overview");

  const token = typeof window === "undefined" ? "" : window.localStorage.getItem("aicc_token") || "";

  const loadData = React.useCallback(async () => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const metricsResponse = await fetch("/api/admin/system-metrics", { headers });
    const metricsPayload = (await metricsResponse.json().catch(() => ({}))) as Metrics;
    if (!metricsResponse.ok) {
      setError(metricsPayload.detail || "Failed to load admin metrics");
      return;
    }

    setError("");
    setMetrics(metricsPayload);

    const usersResponse = await fetch("/api/admin/users", { headers });
    if (usersResponse.ok) {
      setUsers((await usersResponse.json()) as StoredUser[]);
    }

    const servicesResponse = await fetch("/api/health", { headers });
    if (servicesResponse.ok) {
      setServices((await servicesResponse.json()) as Service[]);
    }

    await fetch("/api/admin/indexing-status", { headers }).catch(() => null);
  }, [token]);

  React.useEffect(() => {
    const user = parseStoredUser();
    setCurrentUser(user);

    if (!token || !user) {
      replace("/login");
      return;
    }

    if (String(user.role || "").toUpperCase() !== "ADMIN") {
      replace("/dashboard");
      return;
    }

    void loadData();
  }, [loadData, replace, token]);

  const updateRole = async (user: StoredUser) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    await fetch(`/api/admin/users/${user.id}/role`, {
      method: "POST",
      headers,
      body: JSON.stringify({ role: String(user.role || "").toUpperCase() === "ADMIN" ? "USER" : "ADMIN" }),
    });

    await loadData();
  };

  const deleteUser = async (user: StoredUser) => {
    if (!globalThis.confirm("Delete user?")) {
      return;
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
      headers,
    });

    await loadData();
  };

  return (
    <section>
      <h1>Admin Control Panel</h1>
      {error ? <p>{error}</p> : null}

      <nav>
        <button type="button" onClick={() => setActiveTab("users")}>Users</button>
        <button type="button" onClick={() => setActiveTab("services")}>Services</button>
      </nav>

      {activeTab === "overview" ? (
        <div>
          <p>Users: {metrics?.users_count ?? 0}</p>
          <p>Projects: {metrics?.projects_count ?? 0}</p>
        </div>
      ) : null}

      {activeTab === "users" ? (
        <div>
          <h2>Manage Users</h2>
          <ul>
            {users.filter((user) => user.id !== currentUser?.id).map((user) => {
              const isAdminUser = String(user.role || "").toUpperCase() === "ADMIN";
              return (
                <li key={user.id}>
                  <span>{user.email}</span>
                  <button
                    type="button"
                    title={isAdminUser ? "Demote to user" : "Promote to admin"}
                    onClick={() => void updateRole(user)}
                  >
                    {isAdminUser ? "Demote" : "Promote"}
                  </button>
                  <button type="button" title="Delete user" onClick={() => void deleteUser(user)}>
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {activeTab === "services" ? (
        <ul>
          {services.map((service) => (
            <li key={service.name}>{service.name}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
