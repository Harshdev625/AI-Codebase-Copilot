"use client";

import * as React from "react";
import { Activity, ShieldCheck, UsersRound } from "lucide-react";

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
import { api, type IndexingJob, type ServiceHealth, type SystemMetrics, toApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function AdminDashboardPage(): React.JSX.Element {
  const toast = useToast();
  const [metrics, setMetrics] = React.useState<SystemMetrics | null>(null);
  const [health, setHealth] = React.useState<ServiceHealth[]>([]);
  const [jobs, setJobs] = React.useState<IndexingJob[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsData, healthData, jobsData] = await Promise.all([
        api.admin.metrics(),
        api.admin.health(),
        api.admin.indexingStatus(),
      ]);
      setMetrics(metricsData);
      setHealth(healthData);
      setJobs(jobsData.slice(0, 8));
    } catch (requestError) {
      const message = toApiError(requestError);
      setError(message);
      toast.error("Admin dashboard load failed", message);
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
        title="Admin Dashboard"
        description="Global system visibility and operational status."
        actions={
          <Button variant="secondary" onClick={() => void loadData()} disabled={isLoading}>
            Refresh
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => void loadData()} /> : null}

      <section className="grid gap-4 md:grid-cols-4">
        {isLoading ? (
          <>
            <Card><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          </>
        ) : (
          <>
            <StatCard title="Users" value={metrics?.users_count ?? 0} />
            <StatCard title="Projects" value={metrics?.projects_count ?? 0} />
            <StatCard title="Repositories" value={metrics?.repositories_count ?? 0} />
            <StatCard title="Indexed Chunks" value={metrics?.indexed_chunks_count ?? 0} />
          </>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <UsersRound className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">User governance and role controls are exposed in Admin Users.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">Indexing status updates are streamed via snapshot progress APIs.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm text-muted-foreground">Health checks keep backend, embeddings, and retrieval visible.</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Service Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : health.length > 0 ? (
              health.map((service) => (
                <div key={service.name} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="font-semibold text-foreground">{service.name}</p>
                    {service.detail ? (
                      <p className="text-xs text-muted-foreground">{service.detail}</p>
                    ) : null}
                  </div>
                  <Badge variant={service.status === "online" ? "success" : "error"}>
                    {service.status}
                  </Badge>
                </div>
              ))
            ) : (
              <EmptyState
                title="No health records"
                description="Service health responses are currently unavailable."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Indexing Jobs</CardTitle>
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
                    <TableHead>Repository</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Badge
                          variant={
                            job.status === "completed"
                              ? "success"
                              : job.status === "failed"
                                ? "error"
                                : "warning"
                          }
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{job.repository_id}</TableCell>
                      <TableCell>{formatDate(job.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState title="No indexing jobs" description="No indexing jobs have been created yet." />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

