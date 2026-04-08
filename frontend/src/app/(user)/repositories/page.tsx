"use client";

import * as React from "react";
import { FolderGit2, LoaderCircle, Plus, RefreshCw, GitBranch, Globe, HardDrive, LayoutGrid, List } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useToast } from "@/components/shared/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Project, type Repository, toApiError } from "@/lib/api";
import { formatDate, truncate, cn } from "@/lib/utils";

interface ProgressByRepo {
  [repositoryId: string]: {
    snapshotId: string;
    status: string;
    percentage: number;
    message: string;
  };
}

export default function RepositoriesPage(): React.JSX.Element {
  const toast = useToast();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [repositories, setRepositories] = React.useState<Repository[]>([]);
  const [progressByRepo, setProgressByRepo] = React.useState<ProgressByRepo>({});
  
  const [projectName, setProjectName] = React.useState("");
  const [repoId, setRepoId] = React.useState("");
  const [remoteUrl, setRemoteUrl] = React.useState("");
  const [localPath, setLocalPath] = React.useState("");
  const [defaultBranch, setDefaultBranch] = React.useState("main");
  
  const [isLoading, setLoading] = React.useState(true);
  const [isRefreshing, setRefreshing] = React.useState(false);
  const [isSubmittingProject, setSubmittingProject] = React.useState(false);
  const [isSubmittingRepository, setSubmittingRepository] = React.useState(false);
  const [indexingRepositoryId, setIndexingRepositoryId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");

  const loadProjects = React.useCallback(async (): Promise<Project[]> => {
    const data = await api.projects.list();
    setProjects(data);
    if (!selectedProjectId && data[0]) {
      setSelectedProjectId(data[0].id);
    }
    return data;
  }, [selectedProjectId]);

  const loadRepositories = React.useCallback(async (projectId: string): Promise<void> => {
    if (!projectId) {
      setRepositories([]);
      return;
    }
    const data = await api.repositories.listByProject(projectId);
    setRepositories(data);
  }, []);

  const refresh = React.useCallback(async (showRefreshing = true): Promise<void> => {
    if (showRefreshing) setRefreshing(true);
    try {
      const loadedProjects = await loadProjects();
      const projectId = selectedProjectId || loadedProjects[0]?.id;
      if (projectId) {
        await loadRepositories(projectId);
      }
    } catch (requestError) {
      toast.error("Failed to refresh", toApiError(requestError));
    } finally {
      if (showRefreshing) setRefreshing(false);
      setLoading(false);
    }
  }, [loadProjects, loadRepositories, selectedProjectId, toast]);

  React.useEffect(() => {
    void refresh(false);
  }, [refresh]);

  React.useEffect(() => {
    if (selectedProjectId) {
      void loadRepositories(selectedProjectId);
    }
  }, [selectedProjectId, loadRepositories]);

  React.useEffect(() => {
    const activeEntries = Object.entries(progressByRepo);
    if (!activeEntries.length) return;

    const timer = window.setInterval(() => {
      void Promise.all(
        activeEntries.map(async ([repositoryId, progress]) => {
          try {
            const nextProgress = await api.repositories.indexProgress(progress.snapshotId);
            setProgressByRepo((prev) => ({
              ...prev,
              [repositoryId]: { ...progress, status: nextProgress.index_status, percentage: nextProgress.percentage, message: nextProgress.message },
            }));

            if (["completed", "failed"].includes(String(nextProgress.index_status).toLowerCase())) {
              setProgressByRepo((prev) => {
                const clone = { ...prev };
                delete clone[repositoryId];
                return clone;
              });
              void refresh(false);
            }
          } catch {
             setProgressByRepo((prev) => {
                const clone = { ...prev };
                delete clone[repositoryId];
                return clone;
              });
          }
        })
      );
    }, 3000);

    return () => window.clearInterval(timer);
  }, [progressByRepo, refresh]);

  const onCreateProject = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!projectName.trim()) return;
    setSubmittingProject(true);
    try {
      const created = await api.projects.create({ name: projectName.trim() });
      setProjectName("");
      await loadProjects();
      setSelectedProjectId(created.id);
      toast.success("Project created", `${created.name} is ready.`);
    } catch (err) {
      toast.error("Creation failed", toApiError(err));
    } finally {
      setSubmittingProject(false);
    }
  };

  const onAddRepository = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setSubmittingRepository(true);
    try {
      await api.repositories.add(selectedProjectId, {
        repo_id: repoId.trim(),
        remote_url: remoteUrl.trim() || undefined,
        local_path: localPath.trim() || undefined,
        default_branch: defaultBranch.trim() || "main",
      });
      setRepoId(""); setRemoteUrl(""); setLocalPath(""); setDefaultBranch("main");
      await loadRepositories(selectedProjectId);
      toast.success("Repository added");
    } catch (err) {
      toast.error("Add failed", toApiError(err));
    } finally {
      setSubmittingRepository(false);
    }
  };

  const onIndexRepository = async (repositoryId: string): Promise<void> => {
    setIndexingRepositoryId(repositoryId);
    try {
      const result = await api.repositories.index({ repository_id: repositoryId });
      if (result.snapshot_id) {
        setProgressByRepo((prev) => ({
          ...prev,
          [repositoryId]: { snapshotId: result.snapshot_id!, status: "pending", percentage: 0, message: "Queuing..." },
        }));
      }
      toast.info("Indexing started");
    } catch (err) {
      toast.error("Indexing failed", toApiError(err));
    } finally {
      setIndexingRepositoryId(null);
    }
  };

  return (
    <div className="flex h-full flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <PageHeader
          title="Repository Management"
          description="Organize your codebases into projects and manage indexing status."
        />
        <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-input p-1">
                <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("grid")}>
                    <LayoutGrid className="h-3.5 w-3.5" />
                </Button>
                <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("list")}>
                    <List className="h-3.5 w-3.5" />
                </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isRefreshing}>
                <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isRefreshing && "animate-spin")} />
                Refresh
            </Button>
        </div>
      </div>

      <div className="grid flex-1 gap-8 lg:grid-cols-[280px_1fr]">
        {/* Project Navigation */}
        <aside className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">Projects</h4>
            <div className="space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={cn(
                    "w-full flex flex-col items-start px-3 py-2 rounded-md transition-ui text-sm",
                    selectedProjectId === project.id 
                    ? "bg-secondary text-foreground shadow-sm" 
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <span className="font-semibold">{project.name}</span>
                  <span className="text-[10px] opacity-70">Updated {formatDate(project.created_at)}</span>
                </button>
              ))}
              <form onSubmit={onCreateProject} className="mt-4 px-2">
                <div className="relative">
                  <Input 
                     placeholder="New project..." 
                     value={projectName}
                     onChange={(e) => setProjectName(e.target.value)}
                     className="h-8 pr-10 text-xs bg-muted/20 border-border/50"
                  />
                  <Button type="submit" size="icon" variant="ghost" className="absolute right-0 top-0 h-8 w-8 text-primary" disabled={isSubmittingProject || !projectName.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </aside>

        {/* Repository Grid/List */}
        <div className="space-y-6">
          {/* Add Repo Inline Card */}
          <Card className="border-border/50 bg-background/50 shadow-sm overflow-hidden">
            <CardContent className="p-0">
                <form onSubmit={onAddRepository} className="grid grid-cols-1 md:grid-cols-4 items-center">
                    <div className="p-4 border-r border-border/50 col-span-1">
                        <Input 
                            placeholder="repo-id (owner/repo)" 
                            value={repoId} 
                            onChange={(e) => setRepoId(e.target.value)}
                            className="h-9 text-xs border-none shadow-none focus-visible:ring-0 px-0"
                            required
                        />
                    </div>
                    <div className="p-4 border-r border-border/50 col-span-1">
                        <Input 
                            placeholder="Remote URL / Path" 
                            value={remoteUrl || localPath} 
                            onChange={(e) => { 
                                const val = e.target.value;
                                if (val.includes("/") || val.includes("\\")) {
                                    setLocalPath(val); setRemoteUrl("");
                                } else {
                                    setRemoteUrl(val); setLocalPath("");
                                }
                            }}
                            className="h-9 text-xs border-none shadow-none focus-visible:ring-0 px-0"
                        />
                    </div>
                    <div className="p-4 border-r border-border/50 col-span-1">
                         <div className="flex items-center gap-2">
                            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                            <Input 
                                placeholder="main" 
                                value={defaultBranch} 
                                onChange={(e) => setDefaultBranch(e.target.value)}
                                className="h-9 text-xs border-none shadow-none focus-visible:ring-0 px-0"
                            />
                         </div>
                    </div>
                    <div className="p-4 flex justify-end">
                        <Button type="submit" size="sm" disabled={isSubmittingRepository || !selectedProjectId} className="h-8 px-6 transition-ui">
                            {isSubmittingRepository ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Add Repo"}
                        </Button>
                    </div>
                </form>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
          ) : repositories.length === 0 ? (
            <EmptyState
              icon={FolderGit2}
              title="No repositories yet"
              description="Start by adding your first repository to this project space."
              className="py-20"
            />
          ) : (
            <div className={cn(
                viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"
            )}>
              {repositories.map((repo) => {
                const progress = progressByRepo[repo.id];
                const status = progress?.status || repo.latest_index_status || "not indexed";
                const isIndexing = !!progress || indexingRepositoryId === repo.id;

                return (
                  <Card key={repo.id} className="group relative border-border/50 bg-background/50 transition-ui hover:shadow-md overflow-hidden">
                    <CardHeader className="p-4 space-y-1">
                       <div className="flex items-start justify-between">
                          <CardTitle className="text-sm font-bold truncate pr-16">{repo.repo_id}</CardTitle>
                          <Badge 
                            variant="outline" 
                            className={cn(
                                "text-[9px] uppercase font-bold tracking-tighter h-5 border-none",
                                status === "completed" ? "bg-green-500/10 text-green-500" :
                                status === "failed" ? "bg-red-500/10 text-red-500" :
                                isIndexing ? "bg-yellow-500/10 text-yellow-500" : "bg-muted text-muted-foreground"
                            )}
                          >
                             {isIndexing ? "Indexing" : status}
                          </Badge>
                       </div>
                       <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          {repo.remote_url ? <Globe className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
                          <span className="truncate">{truncate(repo.remote_url || repo.local_path || "", 30)}</span>
                       </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                       {progress && (
                         <div className="space-y-1.5">
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div 
                                    className="h-full bg-primary transition-all duration-300"
                                    style={{ width: `${progress.percentage}%` }}
                                />
                            </div>
                            <p className="text-[9px] text-muted-foreground truncate">{progress.message}</p>
                         </div>
                       )}
                       <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">Added {formatDate(repo.created_at)}</span>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[10px] px-3 font-semibold transition-ui opacity-0 group-hover:opacity-100"
                                onClick={() => onIndexRepository(repo.id)}
                                disabled={isIndexing}
                            >
                                {isIndexing ? <LoaderCircle className="h-3 w-3 animate-spin mr-1.5" /> : <RefreshCw className="h-3 w-3 mr-1.5" />}
                                {isIndexing ? "Running" : "Index"}
                            </Button>
                       </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
