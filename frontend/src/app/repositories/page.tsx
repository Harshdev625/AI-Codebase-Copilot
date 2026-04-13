"use client";

import { FormEvent, useEffect, useState } from "react";
import { GitBranch, Plus, GitFork, Link2, Folder, RefreshCw, X, Zap, CheckCircle, AlertCircle, Loader2, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, TableContainer, TBody, THead } from "@/components/ui/table";
import { apiRequest } from "@/lib/http";

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
  latest_snapshot_id?: string | null;
  latest_index_status?: string | null;
  latest_index_stats?: {
    indexed_chunks?: number;
    total_files?: number;
    processed_files?: number;
    percentage?: number;
    current_file?: string | null;
    eta_seconds?: number | null;
  } | null;
  latest_indexed_chunks?: number | null;
  has_completed_index?: boolean;
  latest_completed_index_stats?: { indexed_chunks?: number } | null;
  latest_completed_indexed_chunks?: number | null;
};

type IndexState = "idle" | "running" | "done" | "failed";

type IndexProgress = {
  snapshotId?: string;
  message?: string;
  percentage?: number;
  totalFiles?: number;
  processedFiles?: number;
  currentFile?: string | null;
  etaSeconds?: number | null;
  status?: "pending" | "running" | "completed" | "failed";
};

type IndexStepId = "queued" | "discover" | "chunk" | "store" | "done";
type IndexStepStatus = "pending" | "active" | "done" | "failed";

const STEP_ORDER: IndexStepId[] = ["queued", "discover", "chunk", "store", "done"];

const STEP_LABELS: Record<IndexStepId, { title: string; detail: string }> = {
  queued: {
    title: "Job queued",
    detail: "Waiting for worker start.",
  },
  discover: {
    title: "Scanning repository",
    detail: "Discovering indexable files.",
  },
  chunk: {
    title: "Chunking source",
    detail: "Generating semantic chunks.",
  },
  store: {
    title: "Storing vectors",
    detail: "Persisting chunks and embeddings.",
  },
  done: {
    title: "Ready for chat",
    detail: "Index completed successfully.",
  },
};

function formatEta(seconds?: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return "calculating...";
  if (seconds <= 0) return "< 1 min";
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `~${mins} min remaining`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `~${hours}h ${rem}m remaining`;
}

function resolveActiveStep(progress: IndexProgress | undefined, state: IndexState | undefined): IndexStepId {
  if (state === "done" || progress?.status === "completed") {
    return "done";
  }

  const message = (progress?.message || "").toLowerCase();
  if (message.includes("storing")) {
    return "store";
  }
  if (message.includes("indexed") || (progress?.processedFiles ?? 0) > 0 || (progress?.totalFiles ?? 0) > 0) {
    return "chunk";
  }
  if (message.includes("discover") || message.includes("found")) {
    return "discover";
  }
  return "queued";
}

function buildSteps(progress: IndexProgress | undefined, state: IndexState | undefined): Array<{ id: IndexStepId; status: IndexStepStatus }> {
  const active = resolveActiveStep(progress, state);
  const activeIndex = STEP_ORDER.indexOf(active);

  return STEP_ORDER.map((id, index) => {
    if (state === "done") {
      return { id, status: "done" };
    }
    if (state === "failed") {
      if (index < activeIndex) return { id, status: "done" };
      if (index === activeIndex) return { id, status: "failed" };
      return { id, status: "pending" };
    }
    if (index < activeIndex) return { id, status: "done" };
    if (index === activeIndex) return { id, status: "active" };
    return { id, status: "pending" };
  });
}

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
  const [activeProgressRepoId, setActiveProgressRepoId] = useState<string | null>(null);
  const [dismissedProgressRepoIds, setDismissedProgressRepoIds] = useState<Record<string, boolean>>({});

  const hasProject = !!projectId;
  const activeRepo = activeProgressRepoId ? items.find((repo) => repo.repo_id === activeProgressRepoId) : undefined;
  const activeState = activeProgressRepoId ? indexStates[activeProgressRepoId] : undefined;
  const activeProgress = activeProgressRepoId ? indexProgress[activeProgressRepoId] : undefined;
  const activeResult = activeProgressRepoId ? indexResults[activeProgressRepoId] : undefined;
  const activeSteps = buildSteps(activeProgress, activeState);

  // Poll for indexing progress
  useEffect(() => {
    const activeSnapshots = Object.entries(indexProgress)
      .filter(([_, p]) => p.snapshotId && indexStates[_] === "running")
      .map(([repoId, p]) => ({ repoId, snapshotId: p.snapshotId! }));

    if (activeSnapshots.length === 0) return;

    const interval = setInterval(async () => {
      for (const { repoId, snapshotId } of activeSnapshots) {
        try {
          const result = await apiRequest<Record<string, unknown>>(`/api/index/progress/${snapshotId}`);
          if (!result.success || !result.data) continue;
          const data = result.data;
          
          const status = (data.index_status || data.job_status || "pending") as "pending" | "running" | "completed" | "failed";
          setIndexProgress((prev) => ({
            ...prev,
            [repoId]: {
              snapshotId,
              message: data.message as string,
              percentage: typeof data.percentage === "number" ? data.percentage : 0,
              totalFiles: data.total_files as number,
              processedFiles: data.processed_files as number,
              currentFile: data.current_file as string,
              etaSeconds: data.eta_seconds as number,
              status,
            },
          }));

          // Update final state when completed or failed
          if (status === "completed") {
            setIndexStates((prev) => ({ ...prev, [repoId]: "done" }));
            setIndexResults((prev) => ({
              ...prev,
              [repoId]: { chunks: (data.stats as { indexed_chunks?: number })?.indexed_chunks || 0 },
            }));
          } else if (status === "failed") {
            setIndexStates((prev) => ({ ...prev, [repoId]: "failed" }));
            setIndexResults((prev) => ({
              ...prev,
              [repoId]: { error: (data.message as string) || "Indexing failed" },
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
    const result = await apiRequest<Project[]>("/api/projects");
    if (!result.success || !result.data) {
      setError(result.error || "Failed to load projects");
      return [] as Project[];
    }
    setProjects(result.data);
    return result.data;
  }

  async function fetchRepos(pid: string) {
    if (!pid) return;
    setLoading(true);
    try {
      const result = await apiRequest<Repo[]>(`/api/projects/${pid}/repositories`);
      if (result.success && result.data) {
        const data = result.data;
        setItems(data);

        const nextStates: Record<string, IndexState> = {};
        const nextResults: Record<string, { chunks?: number; error?: string }> = {};
        const nextProgress: Record<string, IndexProgress> = {};

        for (const repo of data) {
          const status = repo.latest_index_status;
          if (status === "running" || status === "pending") {
            nextStates[repo.repo_id] = "running";
            if (repo.latest_snapshot_id) {
              nextProgress[repo.repo_id] = {
                snapshotId: repo.latest_snapshot_id,
                message: "Resuming indexing progress...",
                percentage: repo.latest_index_stats?.percentage ?? 0,
                totalFiles: repo.latest_index_stats?.total_files ?? 0,
                processedFiles: repo.latest_index_stats?.processed_files ?? 0,
                currentFile: repo.latest_index_stats?.current_file ?? null,
                etaSeconds: repo.latest_index_stats?.eta_seconds ?? null,
                status: status,
              };
            }
          } else if (status === "failed") {
            nextStates[repo.repo_id] = "failed";
            nextResults[repo.repo_id] = { error: "Last indexing attempt failed" };
          } else if (status === "completed" || repo.has_completed_index) {
            nextStates[repo.repo_id] = "done";
            const chunks =
              repo.latest_completed_indexed_chunks ??
              repo.latest_completed_index_stats?.indexed_chunks ??
              repo.latest_indexed_chunks ??
              repo.latest_index_stats?.indexed_chunks;
            if (typeof chunks === "number") {
              nextResults[repo.repo_id] = { chunks };
            }
          } else {
            nextStates[repo.repo_id] = "idle";
          }
        }

        setIndexStates(nextStates);
        setIndexResults(nextResults);
        setIndexProgress(nextProgress);
      } else {
        setError(result.error || "Failed to load repositories");
      }
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

  useEffect(() => {
    if (activeProgressRepoId && dismissedProgressRepoIds[activeProgressRepoId]) {
      return;
    }
    if (activeProgressRepoId && indexStates[activeProgressRepoId] === "running") {
      return;
    }

    const nextRunning = items.find(
      (repo) => indexStates[repo.repo_id] === "running" && !dismissedProgressRepoIds[repo.repo_id]
    );
    if (nextRunning) {
      setActiveProgressRepoId(nextRunning.repo_id);
    }
  }, [items, indexStates, activeProgressRepoId, dismissedProgressRepoIds]);

  function openProgress(repoKey: string) {
    setDismissedProgressRepoIds((prev) => {
      const next = { ...prev };
      delete next[repoKey];
      return next;
    });
    setActiveProgressRepoId(repoKey);
  }

  function closeProgress(repoKey: string, persistHidden: boolean) {
    if (persistHidden) {
      setDismissedProgressRepoIds((prev) => ({ ...prev, [repoKey]: true }));
    }
    if (activeProgressRepoId === repoKey) {
      setActiveProgressRepoId(null);
    }
  }

  async function onCreateProject(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await apiRequest<Project>("/api/projects", {
      method: "POST",
      body: { name: projectName, description: projectDescription || null },
    });
    if (!result.success || !result.data) {
      setError(result.error || "Failed to create project");
      return;
    }
    const data = result.data;

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
    const pid = projectId;
    if (!pid) { setError("Select or create a project first."); setAdding(false); return; }
    if (!remoteUrl && !localPath) { setError("Provide either a Remote URL or a Local Path."); setAdding(false); return; }
    try {
      const result = await apiRequest<Repo>(`/api/projects/${pid}/repositories`, {
        method: "POST",
        body: { repo_id: repoId, remote_url: remoteUrl || null, local_path: localPath || null, default_branch: branch },
      });
      if (!result.success || !result.data) {
        setError(result.error || "Failed to add repository");
        return;
      }
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
    openProgress(repo.repo_id);
    setIndexStates((prev) => ({ ...prev, [repo.repo_id]: "running" }));
    setIndexResults((prev) => { const next = { ...prev }; delete next[repo.repo_id]; return next; });
    try {
      const body: Record<string, string | undefined> = { repo_id: repo.repo_id };
      if (repo.remote_url) body.repo_url = repo.remote_url;
      if (repo.local_path) body.repo_path = repo.local_path;
      const result = await apiRequest<{ snapshot_id?: string }>("/api/index", {
        method: "POST",
        body,
      });
      if (!result.success || !result.data) {
        setIndexStates((prev) => ({ ...prev, [repo.repo_id]: "failed" }));
        setIndexResults((prev) => ({ ...prev, [repo.repo_id]: { error: result.error || "Indexing failed" } }));
        return;
      }
      const data = result.data;
      // Store snapshot_id for polling progress
      setIndexProgress((prev) => ({
        ...prev,
        [repo.repo_id]: {
          snapshotId: data.snapshot_id,
          message: "Starting indexing...",
          percentage: 0,
          totalFiles: 0,
          processedFiles: 0,
          currentFile: null,
          etaSeconds: null,
          status: "pending",
        },
      }));
    } catch {
      setIndexStates((prev) => ({ ...prev, [repo.repo_id]: "failed" }));
      setIndexResults((prev) => ({ ...prev, [repo.repo_id]: { error: "Network error. Is the backend running?" } }));
    }
  }

  const isProgressOpen =
    !!activeProgressRepoId &&
    !!activeRepo &&
    !dismissedProgressRepoIds[activeProgressRepoId];

  return (
    <div className="animate-fade-in space-y-6">
      <Card className="relative overflow-hidden border border-primary/30 bg-gradient-to-br from-primary/20 via-surface to-accent/10 p-0">
        <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
        <div className="relative z-10 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.09em] text-primary">Repository Pipeline</p>
          <h1 className="mt-2 text-2xl font-semibold text-text">Connect, Index, and Chat with Your Code</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Follow the guided steps below to select a project, connect repositories, and build a searchable index for AI chat.
          </p>
        </div>
      </Card>

      {error && !showRepoForm && !showProjectForm && (
        <div className="flex items-center justify-between rounded-xl border border-danger/30 bg-danger-dim px-4 py-3 text-sm text-danger">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
          <Button onClick={() => setError(null)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger hover:bg-danger/10 hover:text-danger">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-background">1</span>
          <h3 className="text-sm font-semibold text-text">Select or create a project</h3>
          {hasProject ? <ChevronRight className="h-4 w-4 text-success" /> : null}
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
            <option value="">- Choose a project -</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <Button
            onClick={() => { setShowProjectForm((v) => !v); setShowRepoForm(false); setError(null); }}
            variant="secondary"
            size="sm"
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> New Project
          </Button>
          {hasProject ? (
            <Button onClick={() => fetchRepos(projectId)} disabled={loading} variant="secondary" size="sm" className="gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          ) : null}
        </div>

        {showProjectForm ? (
          <form onSubmit={onCreateProject} className="grid gap-3 rounded-xl border border-border bg-surface2 p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Project name *</label>
              <Input
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
              <Input
                placeholder="Optional description"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
              />
            </div>
            {error ? (
              <div className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-xs text-danger">{error}</div>
            ) : null}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => { setShowProjectForm(false); setError(null); }}>Cancel</Button>
              <Button type="submit" size="sm">Create Project</Button>
            </div>
          </form>
        ) : null}
      </Card>

      <Card className={`space-y-4 transition-opacity ${hasProject ? "opacity-100" : "pointer-events-none opacity-40"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-background">2</span>
            <h3 className="text-sm font-semibold text-text">Add a repository</h3>
            {!hasProject ? <span className="text-xs text-subtle">(complete step 1 first)</span> : null}
          </div>
          <Button
            onClick={() => { setShowRepoForm((v) => !v); setShowProjectForm(false); setError(null); }}
            disabled={!hasProject}
            size="sm"
            className="gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Repository
          </Button>
        </div>

        {showRepoForm ? (
          <form onSubmit={onAddRepo} className="grid gap-3 rounded-xl border border-border bg-surface2 p-4 sm:grid-cols-2">
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
              <Input placeholder="my-app" value={repoId} onChange={(e) => setRepoId(e.target.value)} required autoFocus />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Default Branch</label>
              <Input placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Remote URL
                <span className="ml-1 font-normal text-subtle">(GitHub / GitLab HTTPS)</span>
              </label>
              <Input placeholder="https://github.com/user/repo.git" value={remoteUrl} onChange={(e) => setRemoteUrl(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Local Path
                <span className="ml-1 font-normal text-subtle">(absolute path on server)</span>
              </label>
              <Input placeholder="E:/Projects/my-app" value={localPath} onChange={(e) => setLocalPath(e.target.value)} />
            </div>
            <p className="sm:col-span-2 text-xs text-subtle">Provide at least one of Remote URL or Local Path.</p>
            {error ? (
              <div className="sm:col-span-2 rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-xs text-danger">{error}</div>
            ) : null}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => { setShowRepoForm(false); setError(null); }}>Cancel</Button>
              <Button type="submit" size="sm" disabled={adding}>
                {adding ? "Adding..." : "Add Repository"}
              </Button>
            </div>
          </form>
        ) : null}

        {items.length > 0 && !showRepoForm ? (
          <p className="text-xs text-subtle">
            {items.length} {items.length === 1 ? "repository" : "repositories"} connected. Click <span className="font-medium text-warning">Index</span> below to make them searchable in chat.
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
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
            {hasProject ? (
              <Button onClick={() => setShowRepoForm(true)} size="sm" className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add your first repository
              </Button>
            ) : null}
          </div>
        ) : (
          <TableContainer>
            <Table className="min-w-[960px]">
              <THead>
                <tr>
                  <th className="px-5 py-3 text-xs font-medium text-muted">Repository</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted">Source</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted">Branch</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted">Index Status</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted">Actions</th>
                </tr>
              </THead>
              <TBody>
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
                        <span className="max-w-[220px] truncate">{repo.remote_url || repo.local_path || "N/A"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="badge badge-purple">{repo.default_branch}</span>
                    </td>
                    <td className="px-5 py-3">
                      {indexStates[repo.repo_id] === "running" ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="badge badge-yellow gap-1 text-xs">
                              <Loader2 className="h-3 w-3 animate-spin" /> Indexing…
                            </span>
                            <span className="text-xs text-muted">{indexProgress[repo.repo_id]?.percentage || 0}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-surface3">
                            <div
                              className="h-1.5 rounded-full bg-warning transition-all duration-300"
                              style={{ width: `${indexProgress[repo.repo_id]?.percentage || 0}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted">
                            <span>{indexProgress[repo.repo_id]?.processedFiles || 0}/{indexProgress[repo.repo_id]?.totalFiles || 0} files</span>
                            <span>{formatEta(indexProgress[repo.repo_id]?.etaSeconds)}</span>
                          </div>
                          {indexProgress[repo.repo_id]?.currentFile ? (
                            <p className="truncate text-[10px] text-muted" title={indexProgress[repo.repo_id]?.currentFile || ""}>
                              {indexProgress[repo.repo_id]?.currentFile}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {indexStates[repo.repo_id] === "done" ? (
                        <span className="badge badge-green gap-1">
                          <CheckCircle className="h-3 w-3" /> Indexed
                          {indexResults[repo.repo_id]?.chunks !== undefined ? (
                            <span className="opacity-70">· {indexResults[repo.repo_id]!.chunks} chunks</span>
                          ) : null}
                        </span>
                      ) : null}
                      {indexStates[repo.repo_id] === "failed" ? (
                        <span
                          className="badge badge-red gap-1 cursor-help"
                          title={indexResults[repo.repo_id]?.error ?? "Indexing failed"}
                        >
                          <AlertCircle className="h-3 w-3" /> Failed
                        </span>
                      ) : null}
                      {!indexStates[repo.repo_id] || indexStates[repo.repo_id] === "idle" ? (
                        <span className="badge badge-cyan">Not Indexed</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => onIndex(repo)}
                          disabled={indexStates[repo.repo_id] === "running"}
                          variant="secondary"
                          size="sm"
                          className="gap-1.5"
                        >
                          {indexStates[repo.repo_id] === "running" ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Indexing…</>
                          ) : (
                            <><Zap className="h-3.5 w-3.5 text-warning" /> Index</>
                          )}
                        </Button>
                        {indexStates[repo.repo_id] === "running" || indexStates[repo.repo_id] === "done" || indexStates[repo.repo_id] === "failed" ? (
                          <Button onClick={() => openProgress(repo.repo_id)} variant="secondary" size="sm" className="gap-1.5">
                            <Eye className="h-3.5 w-3.5" /> Details
                          </Button>
                        ) : null}
                      </div>
                      {indexStates[repo.repo_id] === "failed" && indexResults[repo.repo_id]?.error ? (
                        <p className="mt-1 max-w-[220px] truncate text-[10px] text-danger" title={indexResults[repo.repo_id]!.error}>
                          {indexResults[repo.repo_id]!.error}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Modal
        open={isProgressOpen}
        onClose={() => {
          if (!activeProgressRepoId) return;
          closeProgress(activeProgressRepoId, activeState === "running");
        }}
        title={activeRepo?.repo_id}
        description={activeProgress?.message || "Preparing indexing workflow..."}
        footer={
          <div className="flex justify-end gap-2">
            {activeState === "running" ? (
              <Button
                onClick={() => activeProgressRepoId && closeProgress(activeProgressRepoId, true)}
                variant="secondary"
                size="sm"
              >
                Hide for now
              </Button>
            ) : (
              <Button onClick={() => activeProgressRepoId && closeProgress(activeProgressRepoId, false)} size="sm">
                Close
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface2 px-3 py-2">
            <div className="flex items-center gap-2">
              {activeState === "running" ? (
                <span className="badge badge-yellow gap-1 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" /> Running
                </span>
              ) : null}
              {activeState === "done" ? (
                <span className="badge badge-green gap-1 text-xs">
                  <CheckCircle className="h-3 w-3" /> Completed
                </span>
              ) : null}
              {activeState === "failed" ? (
                <span className="badge badge-red gap-1 text-xs">
                  <AlertCircle className="h-3 w-3" /> Run failed
                </span>
              ) : null}
            </div>
            <div className="text-xs text-muted">{activeProgress?.percentage ?? 0}%</div>
          </div>

          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-surface3">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${activeProgress?.percentage ?? 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{activeProgress?.processedFiles ?? 0}/{activeProgress?.totalFiles ?? 0} files</span>
              <span>{formatEta(activeProgress?.etaSeconds)}</span>
            </div>
            {activeProgress?.currentFile ? (
              <p className="truncate text-[11px] text-subtle" title={activeProgress.currentFile}>{activeProgress.currentFile}</p>
            ) : null}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-surface2 p-3">
            {activeSteps.map((step) => (
              <div key={step.id} className="flex items-start gap-2">
                <div className="pt-0.5">
                  {step.status === "done" ? <CheckCircle className="h-4 w-4 text-success" /> : null}
                  {step.status === "active" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                  {step.status === "failed" ? <AlertCircle className="h-4 w-4 text-danger" /> : null}
                  {step.status === "pending" ? <span className="block h-3.5 w-3.5 rounded-full border border-border bg-surface3" /> : null}
                </div>
                <div>
                  <p className="text-sm font-medium text-text">{STEP_LABELS[step.id].title}</p>
                  <p className="text-[11px] text-muted">{STEP_LABELS[step.id].detail}</p>
                </div>
              </div>
            ))}
          </div>

          {activeState === "done" ? (
            <div className="rounded-lg border border-success/30 bg-success-dim px-3 py-2 text-sm text-success">
              Index completed. {activeResult?.chunks !== undefined ? `${activeResult.chunks} chunks are ready for chat.` : "You can now use chat against this repository."}
            </div>
          ) : null}
          {activeState === "failed" ? (
            <div className="rounded-lg border border-danger/30 bg-danger-dim px-3 py-2 text-sm text-danger">
              {activeResult?.error || "Indexing failed. Check backend logs for details."}
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
