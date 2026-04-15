"use client";

import * as React from "react";

type Project = {
  id: string;
  name: string;
};

type Repository = {
  id: string;
  repo_id: string;
  remote_url?: string | null;
  local_path?: string | null;
  default_branch?: string;
};

type IndexingStatus = "idle" | "indexing" | "failed";

export default function RepositoriesPage(): React.JSX.Element {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState("");
  const [repositories, setRepositories] = React.useState<Repository[]>([]);
  const [showCreateProject, setShowCreateProject] = React.useState(false);
  const [projectName, setProjectName] = React.useState("");
  const [projectDescription, setProjectDescription] = React.useState("");
  const [error, setError] = React.useState("");
  const [indexStatus, setIndexStatus] = React.useState<Record<string, IndexingStatus>>({});

  const token = typeof window === "undefined" ? "" : window.localStorage.getItem("aicc_token") || "";
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders.Authorization = `Bearer ${token}`;
  }

  const loadProjects = React.useCallback(async () => {
    const response = await fetch("/api/projects", { headers: authHeaders });
    if (!response.ok) {
      setProjects([]);
      return [] as Project[];
    }

    const payload = (await response.json()) as Project[];
    setProjects(payload);
    return payload;
  }, [token]);

  const loadRepositories = React.useCallback(async (projectId: string) => {
    if (!projectId) {
      setRepositories([]);
      return;
    }

    const response = await fetch(`/api/projects/${projectId}/repositories`, { headers: authHeaders });
    if (!response.ok) {
      setRepositories([]);
      return;
    }

    const payload = (await response.json()) as Repository[];
    setRepositories(payload);
  }, [token]);

  React.useEffect(() => {
    const bootstrap = async () => {
      const loadedProjects = await loadProjects();
      const storedProjectId = window.localStorage.getItem("aicc_project_id") || "";
      const preferredProjectId = loadedProjects.some((project) => project.id === storedProjectId)
        ? storedProjectId
        : loadedProjects[0]?.id || "";

      if (preferredProjectId) {
        setSelectedProjectId(preferredProjectId);
        window.localStorage.setItem("aicc_project_id", preferredProjectId);
        await loadRepositories(preferredProjectId);
      }
    };

    void bootstrap();
  }, [loadProjects, loadRepositories]);

  const createProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ name: projectName, description: projectDescription }),
    });

    const payload = (await response.json().catch(() => ({}))) as { id?: string; detail?: string };
    if (!response.ok) {
      setError(payload.detail || "Failed to create project");
      return;
    }

    const loadedProjects = await loadProjects();
    const nextProjectId = payload.id || loadedProjects[0]?.id || "";
    setSelectedProjectId(nextProjectId);
    if (nextProjectId) {
      window.localStorage.setItem("aicc_project_id", nextProjectId);
      await loadRepositories(nextProjectId);
    }

    setProjectName("");
    setProjectDescription("");
    setShowCreateProject(false);
  };

  const indexRepository = async (repository: Repository) => {
    if (!repository.remote_url && !repository.local_path) {
      setError(`${repository.repo_id} has no URL or local path configured`);
      return;
    }

    setError("");

    const response = await fetch("/api/index", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ repository_id: repository.id }),
    });

    if (!response.ok) {
      setIndexStatus((current) => ({ ...current, [repository.id]: "failed" }));
      return;
    }

    setIndexStatus((current) => ({ ...current, [repository.id]: "indexing" }));
  };

  return (
    <section>
      <h1>Index repositories for chat</h1>

      <button type="button" onClick={() => setShowCreateProject((current) => !current)}>
        New Project
      </button>

      {showCreateProject ? (
        <form onSubmit={createProject}>
          <input
            placeholder="My Project"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
          />
          <input
            placeholder="Optional description"
            value={projectDescription}
            onChange={(event) => setProjectDescription(event.target.value)}
          />
          <button type="submit">Create Project</button>
        </form>
      ) : null}

      {projects.length > 0 ? (
        <p>Selected project: {selectedProjectId || projects[0].id}</p>
      ) : null}

      <ul>
        {repositories.map((repository) => {
          const status = indexStatus[repository.id] || "idle";
          return (
            <li key={repository.id}>
              <span>{repository.repo_id}</span>
              <button type="button" onClick={() => void indexRepository(repository)}>
                Index
              </button>
              {status === "indexing" ? <span>{"Indexing\u2026"}</span> : null}
              {status === "failed" ? <span>Failed</span> : null}
            </li>
          );
        })}
      </ul>

      {error ? <p>{error}</p> : null}
    </section>
  );
}
