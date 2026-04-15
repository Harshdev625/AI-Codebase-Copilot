"use client";

import * as React from "react";

type User = {
  full_name?: string;
  email?: string;
  role?: string;
};

type Project = {
  id: string;
  name: string;
  description?: string;
};

type DashboardMetricsResponse = {
  metrics?: {
    projects_count?: number;
    repositories_count?: number;
  };
};

type AdminMetricsResponse = {
  users_count?: number;
  projects_count?: number;
  repositories_count?: number;
  indexed_chunks_count?: number;
};

function readUser(): User | null {
  try {
    const raw = window.localStorage.getItem("aicc_user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export default function DashboardPage(): React.JSX.Element {
  const [user, setUser] = React.useState<User | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [adminMetrics, setAdminMetrics] = React.useState<AdminMetricsResponse | null>(null);

  React.useEffect(() => {
    const sessionUser = readUser();
    setUser(sessionUser);

    const token = window.localStorage.getItem("aicc_token") || "";
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const role = String(sessionUser?.role || "").toUpperCase();

    const load = async () => {
      if (role === "ADMIN") {
        await fetch("/api/dashboard", { headers }).catch(() => null);
        const adminResponse = await fetch("/api/admin/system-metrics", { headers });
        if (adminResponse.ok) {
          const payload = (await adminResponse.json()) as AdminMetricsResponse;
          setAdminMetrics(payload);
        }
        return;
      }

      await fetch("/api/dashboard", { headers }).catch(() => null);
      const projectsResponse = await fetch("/api/projects", { headers });
      if (projectsResponse.ok) {
        const projectPayload = (await projectsResponse.json()) as Project[];
        setProjects(projectPayload);
      }
    };

    void load();
  }, []);

  const role = String(user?.role || "").toUpperCase();
  const name = user?.full_name || "User";

  return (
    <section>
      <h1>Welcome back, {name}!</h1>

      {role === "ADMIN" ? (
        <div>
          <h2>Admin Control</h2>
          <p>Users: {adminMetrics?.users_count ?? 0}</p>
          <p>Projects: {adminMetrics?.projects_count ?? 0}</p>
        </div>
      ) : (
        <div>
          <h2>Your Projects</h2>
          <ul>
            {projects.map((project) => (
              <li key={project.id}>{project.name}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
