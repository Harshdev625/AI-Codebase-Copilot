"use client";

import * as React from "react";
import { DatabaseZap } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { useToast } from "@/components/shared/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type IndexingJob, type Repository, toApiError } from "@/lib/api";
import { formatDate, truncate } from "@/lib/utils";

export default function AdminRepositoriesPage(): React.JSX.Element {
  const toast = useToast();
  const [repositories, setRepositories] = React.useState<Repository[]>([]);
  const [jobs, setJobs] = React.useState<IndexingJob[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setLoading] = React.useState(true);

  const loadData = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [repositoriesData, jobsData] = await Promise.all([
        api.admin.repositories(),
        api.admin.indexingStatus(),
      ]);
      setRepositories(repositoriesData);
      setJobs(jobsData);
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error("Admin repositories load failed", message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Repositories"
        description="Inspect repository inventory and indexing activity."
        actions={
          <Button variant="secondary" onClick={() => void loadData()} disabled={isLoading}>
            Refresh
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void loadData()} /> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Repositories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : repositories.length > 0 ? (
              repositories.map((repository) => (
                <div key={repository.id} className="rounded-xl border border-border bg-card/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{repository.repo_id}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {truncate(repository.remote_url || repository.local_path || "No source", 80)}
                      </p>
                    </div>
                    <Badge variant={repository.latest_index_status === "completed" ? "success" : "muted"}>
                      {repository.latest_index_status || "not indexed"}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{repository.default_branch}</span>
                    <span>{formatDate(repository.created_at)}</span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No repositories" description="No repositories have been attached yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indexing Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : jobs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Repository ID</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.slice(0, 25).map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "success"
                              : job.status === "failed"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{truncate(job.repository_id, 24)}</TableCell>
                      <TableCell>{truncate(job.message || "-")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No indexing jobs"
                description="Start indexing from user repositories to populate this operational feed."
              />
            )}

            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <DatabaseZap className="h-4 w-4 text-primary" />
                Indexing uses queued jobs with progress snapshots and failure diagnostics.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
