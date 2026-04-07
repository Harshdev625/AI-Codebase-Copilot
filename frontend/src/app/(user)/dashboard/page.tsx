"use client";

import * as React from "react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type DashboardSummary, toApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function DashboardPage(): React.JSX.Element {
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
      setError(toApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Track repository activity, indexing status, and account health."
        actions={
          <Button variant="secondary" onClick={() => void loadSummary()}>
            Refresh
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard title="Projects" value={summary?.metrics.projects_count ?? 0} />
        <StatCard title="Repositories" value={summary?.metrics.repositories_count ?? 0} />
        <StatCard title="Indexed Chunks" value={summary?.metrics.indexed_chunks_count ?? 0} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent repositories</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading dashboard data...</p>
          ) : (
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
                {(summary?.recent_repositories ?? []).length > 0 ? (
                  summary?.recent_repositories.map((repo) => (
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No repositories found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
