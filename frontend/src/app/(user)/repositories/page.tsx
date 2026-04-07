"use client";

import * as React from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  api,
  type Project,
  type Repository,
  toApiError,
} from "@/lib/api";
import { formatDate, truncate } from "@/lib/utils";

export default function RepositoriesPage(): React.JSX.Element {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [repositories, setRepositories] = React.useState<Repository[]>([]);
  const [projectName, setProjectName] = React.useState("");
  const [projectDescription, setProjectDescription] = React.useState("");
  const [repoId, setRepoId] = React.useState("");
  const [remoteUrl, setRemoteUrl] = React.useState("");
  const [localPath, setLocalPath] = React.useState("");
  const [defaultBranch, setDefaultBranch] = React.useState("main");
  const [isBusy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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

  const refresh = React.useCallback(async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const loadedProjects = await loadProjects();
      const projectId = selectedProjectId || loadedProjects[0]?.id;
      if (projectId) {
        await loadRepositories(projectId);
      }
    } catch (requestError) {
      setError(toApiError(requestError));
    } finally {
      setBusy(false);
    }
  }, [loadProjects, loadRepositories, selectedProjectId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    if (selectedProjectId) {
      void loadRepositories(selectedProjectId).catch((requestError) => {
        setError(toApiError(requestError));
      });
    }
  }, [selectedProjectId, loadRepositories]);

  const onCreateProject = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await api.projects.create({
        name: projectName,
        description: projectDescription || undefined,
      });
      setProjectName("");
      setProjectDescription("");
      await loadProjects();
      setSelectedProjectId(created.id);
      await loadRepositories(created.id);
    } catch (requestError) {
      setError(toApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const onAddRepository = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedProjectId) {
      setError("Create or select a project first.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await api.repositories.add(selectedProjectId, {
        repo_id: repoId,
        remote_url: remoteUrl || undefined,
        local_path: localPath || undefined,
        default_branch: defaultBranch || "main",
      });
      setRepoId("");
      setRemoteUrl("");
      setLocalPath("");
      setDefaultBranch("main");
      await loadRepositories(selectedProjectId);
    } catch (requestError) {
      setError(toApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const onIndexRepository = async (repositoryId: string): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await api.repositories.index({ repository_id: repositoryId });
      await loadRepositories(selectedProjectId);
    } catch (requestError) {
      setError(toApiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repositories"
        description="Organize projects, attach repositories, and start indexing."
        actions={
          <Button variant="secondary" onClick={() => void refresh()} disabled={isBusy}>
            Refresh
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="grid gap-6 xl:grid-cols-[350px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Create and select project containers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={onCreateProject} className="space-y-3">
              <Input
                placeholder="Project name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                required
              />
              <Input
                placeholder="Description"
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
              />
              <Button type="submit" className="w-full" disabled={isBusy}>
                Add project
              </Button>
            </form>

            <div className="space-y-2">
              {projects.length > 0 ? (
                projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      selectedProjectId === project.id
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setSelectedProjectId(project.id)}
                  >
                    <p className="font-semibold text-foreground">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.description || "No description"}</p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No projects yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repository list</CardTitle>
            <CardDescription>Attach repositories and trigger indexing jobs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={onAddRepository} className="grid gap-3 md:grid-cols-2">
              <Input
                placeholder="repo_id (owner/repo)"
                value={repoId}
                onChange={(event) => setRepoId(event.target.value)}
                required
              />
              <Input
                placeholder="Default branch"
                value={defaultBranch}
                onChange={(event) => setDefaultBranch(event.target.value)}
              />
              <Input
                placeholder="Remote URL (optional)"
                value={remoteUrl}
                onChange={(event) => setRemoteUrl(event.target.value)}
              />
              <Input
                placeholder="Local path (optional)"
                value={localPath}
                onChange={(event) => setLocalPath(event.target.value)}
              />
              <div className="md:col-span-2">
                <Button type="submit" disabled={isBusy || !selectedProjectId}>
                  Add repository
                </Button>
              </div>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repositories.length > 0 ? (
                  repositories.map((repository) => (
                    <TableRow key={repository.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-foreground">{repository.repo_id}</p>
                          <p className="text-xs text-muted-foreground">
                            {truncate(repository.remote_url || repository.local_path || "No source")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{repository.default_branch}</TableCell>
                      <TableCell>
                        <Badge variant={repository.latest_index_status === "completed" ? "success" : "muted"}>
                          {repository.latest_index_status || "not indexed"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(repository.created_at)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void onIndexRepository(repository.id)}
                          disabled={isBusy}
                        >
                          Index
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No repositories found for this project.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
