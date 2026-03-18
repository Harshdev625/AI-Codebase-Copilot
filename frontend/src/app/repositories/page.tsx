"use client";

import { FormEvent, useEffect, useState } from "react";
import { GitBranch, Plus, GitFork, Link2, Folder, RefreshCw, X, Zap, CheckCircle, AlertCircle, Loader2, ChevronRight } from "lucide-react";

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

type IndexState = "idle" | "running" | "done" | "failed";

type IndexProgress = {
  snapshotId?: string;
  message?: string;
  percentage?: number;
};

export default function RepositoriesPage() {
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [projectId,    setProjectId]    = useState("");
  const [projectName,  setProjectName]  = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [repoId,    setRepoId]    = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [branch,    setBranch]    = useState("main");
  const [items,     setItems]     = useState<Repo[]>([]);
  const [error,     setError]     = useState<string | null>(null);
  const [adding,    setAdding]    = useState(false);
  const [showRepoForm,    setShowRepoForm]    = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [indexStates,  setIndexStates]  = useState<Record<string, IndexState>>({});
  const [indexResults, setIndexResults] = useState<Record<string, { chunks?: number; error?: string }>>({});
  const [indexProgress, setIndexProgress] = useState<Record<string, IndexProgress>>({});

  const hasProject = !!projectId;

  // Poll for indexing progress
  useEffect(() => {
    const activeSnapshots = Object.entries(indexProgress)
      .filter(([_, p]) => p.snapshotId && indexStates[_] === "running")
      .map(([repoId, p]) => ({ repoId, snapshotId: p.snapshotId! }));

    if (activeSnapshots.length === 0) return;

    const interval = setInterval(async () => {
      const token = localStorage.getItem("aicc_token") || "";
      for (const { repoId, snapshotId } of activeSnapshots) {
        try {
          const res = await fetch(`/api/index/progress/${snapshotId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) continue;
          const data = await res.json();
          
          setIndexProgress((prev) => ({
            ...prev,
            [repoId]: {
              snapshotId,
              message: data.message,
              percentage: data.index_status === "completed" ? 100 : 
                         data.index_status === "failed" ? 0 :
                         50, // Show 50% while running
            },
          }));

          // Update final state when completed or failed
          if (data.index_status === "completed") {
            setIndexStates((prev) => ({ ...prev, [repoId]: "done" }));
            setIndexResults((prev) => ({
              ...prev,
              [repoId]: { chunks: data.stats?.indexed_chunks || 0 },
            }));
          } else if (data.index_status === "failed") {
            setIndexStates((prev) => ({ ...prev, [repoId]: "failed" }));
            setIndexResults((prev) => ({
              ...prev,
              [repoId]: { error: data.message || "Indexing failed" },
            }));
          }
        } catch (err) {
          console.error(`Failed to poll progress for ${snapshotId}:`, err);
        }
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [indexProgress, indexStates]);

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

  async function onAddRepo(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    const token = localStorage.getItem("aicc_token") || "";
    const pid = projectId;
    if (!pid) { setError("Select or create a project first."); setAdding(false); return; }
    if (!remoteUrl && !localPath) { setError("Provide either a Remote URL or a Local Path."); setAdding(false); return; }
    try {
      const res = await fetch(`/api/projects/${pid}/repositories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ repo_id: repoId, remote_url: remoteUrl || null, local_path: localPath || null, default_branch: branch }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.detail || "Failed to add repository"); return; }
      setRepoId(""); setRemoteUrl(""); setLocalPath(""); setBranch("main");
      setShowRepoForm(false);
      await fetchRepos(pid);
    } finally {
      setAdding(false);
    }
  }

  async function onIndex(repo: Repo) {
    if (!repo.remote_url && !repo.local_path) {
      setError(`"${repo.repo_id}" has no URL or local path configured.`);
      return;
    }
    setError(null);
    setIndexStates((prev) => ({ ...prev, [repo.repo_id]: "running" }));
    setIndexResults((prev) => { const next = { ...prev }; delete next[repo.repo_id]; return next; });
    const token = localStorage.getItem("aicc_token") || "";
    try {
      const body: Record<string, string | undefined> = { repo_id: repo.repo_id };
      if (repo.remote_url) body.repo_url = repo.remote_url;
      if (repo.local_path) body.repo_path = repo.local_path;
      const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setIndexStates((prev) => ({ ...prev, [repo.repo_id]: "failed" }));
        setIndexResults((prev) => ({ ...prev, [repo.repo_id]: { error: data?.detail || "Indexing failed" } }));
        return;
      }
      // Store snapshot_id for polling progress
      setIndexProgress((prev) => ({
        ...prev,
        [repo.repo_id]: {
          snapshotId: data.snapshot_id,
          message: "Starting indexing...",
          percentage: 0,
        },
      }));
    } catch {
      setIndexStates((prev) => ({ ...prev, [repo.repo_id]: "failed" }));
      setIndexResults((prev) => ({ ...prev, [repo.repo_id]: { error: "Network error. Is the backend running?" } }));
    }
  }

  return (
    <div className="animate-fade-in space-y-6">

      {/* Global error banner */}
      {error && !showRepoForm && !showProjectForm && (
        <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
          <button onClick={() => setError(null)} className="ml-4 shrink-0 text-danger/60 hover:text-danger">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Step 1: Project ──────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-background">1</span>
          <h3 className="text-sm font-semibold text-text">Select or create a project</h3>
          {hasProject && <ChevronRight className="h-4 w-4 text-success" />}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input-base max-w-xs"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              localStorage.setItem("aicc_project_id", e.target.value);
              setItems([]);
              if (e.target.value) fetchRepos(e.target.value);
            }}
          >
            <option value="">— Choose a project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => { setShowProjectForm((v) => !v); setShowRepoForm(false); setError(null); }}
            className="btn-secondary text-xs gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> New Project
          </button>
          {hasProject && (
            <button onClick={() => fetchRepos(projectId)} disabled={loading} className="btn-secondary text-xs gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          )}
        </div>

        {showProjectForm && (
          <form onSubmit={onCreateProject} className="grid gap-3 rounded-lg border border-border bg-surface2 p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Project name *</label>
              <input
                className="input-base"
                placeholder="My Project"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                minLength={2}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Description</label>
              <input
                className="input-base"
                placeholder="Optional description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
              />
            </div>
            {error && showProjectForm && (
              <div className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-xs text-danger">{error}</div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowProjectForm(false); setError(null); }} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Create Project</button>
            </div>
          </form>
        )}
      </div>

      {/* ── Step 2: Add repository ───────────────────────────────── */}
      <div className={`card space-y-4 transition-opacity ${hasProject ? "opacity-100" : "pointer-events-none opacity-40"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-background">2</span>
            <h3 className="text-sm font-semibold text-text">Add a repository</h3>
            {!hasProject && <span className="text-xs text-subtle">(complete step 1 first)</span>}
          </div>
          <button
            onClick={() => { setShowRepoForm((v) => !v); setShowProjectForm(false); setError(null); }}
            disabled={!hasProject}
            className="btn-primary text-xs gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Repository
          </button>
        </div>

        {showRepoForm && (
          <form onSubmit={onAddRepo} className="grid gap-3 rounded-lg border border-border bg-surface2 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs text-muted">
                Adding to project: <span className="font-medium text-text">{projects.find((p) => p.id === projectId)?.name}</span>
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Repository ID *
                <span className="ml-1 font-normal text-subtle">(short unique name, e.g. my-app)</span>
              </label>
              <input className="input-base" placeholder="my-app" value={repoId} onChange={(e) => setRepoId(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Default Branch</label>
              <input className="input-base" placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Remote URL
                <span className="ml-1 font-normal text-subtle">(GitHub / GitLab HTTPS)</span>
              </label>
              <input className="input-base" placeholder="https://github.com/user/repo.git" value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Local Path
                <span className="ml-1 font-normal text-subtle">(absolute path on server)</span>
              </label>
              <input className="input-base" placeholder="E:/Projects/my-app" value={localPath} onChange={(e) => setLocalPath(e.target.value)} />
            </div>
            <p className="sm:col-span-2 text-xs text-subtle">Provide at least one of Remote URL or Local Path.</p>
            {error && showRepoForm && (
              <div className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-xs text-danger">{error}</div>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowRepoForm(false); setError(null); }} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" disabled={adding} className="btn-primary text-xs">
                {adding ? "Adding…" : "Add Repository"}
              </button>
            </div>
          </form>
        )}

        {items.length > 0 && !showRepoForm && (
          <p className="text-xs text-subtle">
            ✓ {items.length} {items.length === 1 ? "repository" : "repositories"} connected.{" "}
            Click <span className="font-medium text-warning">⚡ Index</span> below to make them searchable in chat.
          </p>
        )}
      </div>

      {/* ── Step 3: Repository list with Index actions ───────────── */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-background">3</span>
            <h3 className="text-sm font-semibold text-text">Index repositories for chat</h3>
          </div>
          <span className="badge badge-cyan">{items.length} repos</span>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface2 ring-1 ring-border">
              <GitBranch className="h-6 w-6 text-muted" />
            </div>
            <p className="text-sm text-muted">{hasProject ? "No repositories connected yet." : "Select a project to see repositories."}</p>
            {hasProject && (
              <button onClick={() => setShowRepoForm(true)} className="btn-primary text-xs">
                <Plus className="h-3.5 w-3.5" /> Add your first repository
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2 text-left">
                <th className="px-5 py-3 text-xs font-medium text-muted">Repository</th>
                <th className="px-5 py-3 text-xs font-medium text-muted">Source</th>
                <th className="px-5 py-3 text-xs font-medium text-muted">Branch</th>
                <th className="px-5 py-3 text-xs font-medium text-muted">Index Status</th>
                <th className="px-5 py-3 text-xs font-medium text-muted">Actions</th>
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
                    {indexStates[repo.repo_id] === "running" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="badge badge-yellow gap-1 text-xs">
                            <Loader2 className="h-3 w-3 animate-spin" /> Indexing…
                          </span>
                          <span className="text-xs text-muted">{indexProgress[repo.repo_id]?.percentage || 50}%</span>
                        </div>
                        <div className="w-full bg-surface3 rounded-full h-1.5">
                          <div
                            className="bg-warning h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${indexProgress[repo.repo_id]?.percentage || 50}%` }}
                          />
                        </div>
                        {indexProgress[repo.repo_id]?.message && (
                          <p className="text-xs text-muted truncate">{indexProgress[repo.repo_id]!.message}</p>
                        )}
                      </div>
                    )}
                    {indexStates[repo.repo_id] === "done" && (
                      <span className="badge badge-green gap-1">
                        <CheckCircle className="h-3 w-3" /> Indexed
                        {indexResults[repo.repo_id]?.chunks !== undefined && (
                          <span className="opacity-70">· {indexResults[repo.repo_id]!.chunks} chunks</span>
                        )}
                      </span>
                    )}
                    {indexStates[repo.repo_id] === "failed" && (
                      <span
                        className="badge badge-red gap-1 cursor-help"
                        title={indexResults[repo.repo_id]?.error ?? "Indexing failed"}
                      >
                        <AlertCircle className="h-3 w-3" /> Failed
                      </span>
                    )}
                    {(!indexStates[repo.repo_id] || indexStates[repo.repo_id] === "idle") && (
                      <span className="badge badge-cyan">Not Indexed</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => onIndex(repo)}
                      disabled={indexStates[repo.repo_id] === "running"}
                      className="btn-secondary gap-1.5 py-1 px-3 text-xs"
                    >
                      {indexStates[repo.repo_id] === "running" ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Indexing…</>
                      ) : (
                        <><Zap className="h-3.5 w-3.5 text-warning" /> Index</>
                      )}
                    </button>
                    {indexStates[repo.repo_id] === "failed" && indexResults[repo.repo_id]?.error && (
                      <p className="mt-1 max-w-[180px] truncate text-[10px] text-danger" title={indexResults[repo.repo_id]!.error}>
                        {indexResults[repo.repo_id]!.error}
                      </p>
                    )}
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
