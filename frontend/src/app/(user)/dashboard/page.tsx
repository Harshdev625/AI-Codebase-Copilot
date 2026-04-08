"use client";

import * as React from "react";
import { Activity, FolderGit2, Layers3 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { useToast } from "@/components/shared/toast-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type DashboardSummary, toApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function DashboardPage(): React.JSX.Element {
  const toast = useToast();
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setLoading] = React.useState(true);

  const loadSummary = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.dashboard.me();
      setSummary(data);
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error("Dashboard load failed", message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Track repository activity, indexing health, and workspace momentum."
        actions={
          <Button variant="secondary" onClick={() => void loadSummary()}>
            Refresh
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void loadSummary()} /> : null}

      <section className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <Card><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          </>
        ) : (
          <>
            <StatCard title="Projects" value={summary?.metrics.projects_count ?? 0} subtitle="All project spaces" />
            <StatCard title="Repositories" value={summary?.metrics.repositories_count ?? 0} subtitle="Linked sources" />
            <StatCard title="Indexed Chunks" value={summary?.metrics.indexed_chunks_count ?? 0} subtitle="Searchable context" />
          </>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-primary/15 p-2 text-primary"><Activity className="h-4 w-4" /></div>
            <p className="text-sm text-muted-foreground">Indexing jobs are tracked in real time from repository snapshots.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-primary/15 p-2 text-primary"><FolderGit2 className="h-4 w-4" /></div>
            <p className="text-sm text-muted-foreground">Repository cards expose branch, source, and latest index status.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-primary/15 p-2 text-primary"><Layers3 className="h-4 w-4" /></div>
            <p className="text-sm text-muted-foreground">Chat consumes indexed chunks to keep answers grounded.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent repositories</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            (summary?.recent_repositories ?? []).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repository</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary?.recent_repositories.map((repo) => (
                    <TableRow key={repo.id}>
                      <TableCell className="font-medium">{repo.repo_id}</TableCell>
                      <TableCell>{repo.default_branch}</TableCell>
                      <TableCell>
                        <Badge variant={repo.latest_index_status === "completed" ? "success" : "muted"}>
                          {repo.latest_index_status ?? "not indexed"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(repo.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No repository activity"
                description="Attach repositories to any project and run indexing to populate this feed."
              />
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
