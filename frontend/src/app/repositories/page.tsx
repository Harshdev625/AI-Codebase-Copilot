"use client";

import { FormEvent, useEffect, useState } from "react";
import { GitBranch, Plus, GitFork, Link2, Folder, RefreshCw, X } from "lucide-react";

type Project = {
  id: string;
  name: string;
  description?: string | null;
};

type Repo = {
  id: string;
  repo_id: string;
  remote_url?: string;
  local_path?: string;
  default_branch: string;
};

export default function RepositoriesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [repoId,    setRepoId]    = useState("");
  const [remoteUrl, setRemoteUrl] = useState("https://github.com/");
  const [localPath, setLocalPath] = useState("");
  const [branch,    setBranch]    = useState("main");
  const [items,     setItems]     = useState<Repo[]>([]);
  const [error,     setError]     = useState<string | null>(null);
  const [adding,    setAdding]    = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [loading,   setLoading]   = useState(false);

  async function fetchProjects() {
    const token = localStorage.getItem("aicc_token") || "";
    const res = await fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.detail || "Failed to load projects");
      return [];
    }
    setProjects(data);
    return data as Project[];
  }

  async function fetchRepos(pid: string) {
    if (!pid) return;
    setLoading(true);
    const token = localStorage.getItem("aicc_token") || "";
    try {
      const res  = await fetch(`/api/projects/${pid}/repositories`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects().then((data) => {
      const saved = localStorage.getItem("aicc_project_id") || "";
      const selected = saved || data[0]?.id || "";
      setProjectId(selected);
      if (selected) {
        localStorage.setItem("aicc_project_id", selected);
        fetchRepos(selected);
      }
    }).catch(() => null);
  }, []);

  async function onCreateProject(e: FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("aicc_token") || "";
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: projectName, description: projectDescription || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.detail || "Failed to create project");
      return;
    }

    const nextProjects = await fetchProjects();
    setProjectId(data.id);
    localStorage.setItem("aicc_project_id", data.id);
    setProjects(nextProjects);
    setProjectName("");
    setProjectDescription("");
    setShowProjectForm(false);
    await fetchRepos(data.id);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    const token = localStorage.getItem("aicc_token") || "";
    const pid   = projectId || localStorage.getItem("aicc_project_id") || "";
    if (!pid) { setError("Enter a Project ID first."); setAdding(false); return; }
    try {
      const res  = await fetch(`/api/projects/${pid}/repositories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ repo_id: repoId, remote_url: remoteUrl || null, local_path: localPath || null, default_branch: branch }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.detail || "Failed to add repository"); return; }
      setRepoId(""); setRemoteUrl("https://github.com/"); setLocalPath(""); setBranch("main");
      setShowForm(false);
      await fetchRepos(pid);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Manage connected repositories and index them for AI analysis.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchRepos(projectId)} disabled={loading} className="btn-secondary gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
            <Plus className="h-4 w-4" /> Add Repository
          </button>
          <button onClick={() => setShowProjectForm((v) => !v)} className="btn-secondary">
            <Plus className="h-4 w-4" /> New Project
          </button>
        </div>
      </div>

      {/* Project selector */}
      <div className="card flex items-center gap-3 py-3">
        <span className="text-xs font-medium text-muted">Project</span>
        <select
          className="input-base max-w-xs"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            localStorage.setItem("aicc_project_id", e.target.value);
            fetchRepos(e.target.value);
          }}
        >
          <option value="">Select a project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <button onClick={() => fetchRepos(projectId)} className="btn-secondary text-xs">Load</button>
      </div>

      {showProjectForm && (
        <div className="card animate-slide-up">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Create Project</h3>
            <button onClick={() => setShowProjectForm(false)} className="text-subtle hover:text-text"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={onCreateProject} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Project name *</label>
              <input className="input-base" value={projectName} onChange={(e) => setProjectName(e.target.value)} required minLength={2} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Description</label>
              <input className="input-base" value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowProjectForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create Project</button>
            </div>
          </form>
        </div>
      )}

      {/* Add form (collapsible) */}
      {showForm && (
        <div className="card animate-slide-up">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text">Add New Repository</h3>
            <button onClick={() => setShowForm(false)} className="text-subtle hover:text-text"><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Repository ID *</label>
              <input className="input-base" placeholder="my-repo" value={repoId} onChange={(e) => setRepoId(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Default Branch</label>
              <input className="input-base" placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Remote URL</label>
              <input className="input-base" placeholder="https://github.com/user/repo" value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Local Path</label>
              <input className="input-base" placeholder="/path/to/repo" value={localPath} onChange={(e) => setLocalPath(e.target.value)} />
            </div>
            {error && (
              <div className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-xs text-danger">{error}</div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={adding} className="btn-primary">
                {adding ? "Adding…" : "Add Repository"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Repository table */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-text">Connected Repositories</h3>
          <span className="badge badge-cyan">{items.length} repos</span>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface2 ring-1 ring-border">
              <GitBranch className="h-6 w-6 text-muted" />
            </div>
            <p className="text-sm text-muted">No repositories connected yet.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-xs">
              <Plus className="h-3.5 w-3.5" /> Add your first repository
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2 text-left">
                <th className="px-5 py-3 text-xs font-medium text-muted">Repository</th>
                <th className="px-5 py-3 text-xs font-medium text-muted">Source</th>
                <th className="px-5 py-3 text-xs font-medium text-muted">Branch</th>
                <th className="px-5 py-3 text-xs font-medium text-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((repo) => (
                <tr key={repo.id} className="transition-colors hover:bg-surface2">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface3 ring-1 ring-border">
                        <GitFork className="h-3.5 w-3.5 text-muted" />
                      </div>
                      <span className="font-medium text-text">{repo.repo_id}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      {repo.remote_url ? <Link2 className="h-3 w-3 shrink-0" /> : <Folder className="h-3 w-3 shrink-0" />}
                      <span className="truncate max-w-[200px]">{repo.remote_url || repo.local_path || "N/A"}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="badge badge-purple">{repo.default_branch}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="badge badge-green">Connected</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
