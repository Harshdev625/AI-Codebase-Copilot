"use client";

import * as React from "react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type IndexingJob, type ServiceHealth, type SystemMetrics, toApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";

export default function AdminDashboardPage(): React.JSX.Element {
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
      setError(toApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard title="Users" value={metrics?.users_count ?? 0} />
        <StatCard title="Projects" value={metrics?.projects_count ?? 0} />
        <StatCard title="Repositories" value={metrics?.repositories_count ?? 0} />
        <StatCard title="Indexed Chunks" value={metrics?.indexed_chunks_count ?? 0} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Service Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {health.map((service) => (
              <div key={service.name} className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="font-semibold text-foreground">{service.name}</p>
                  {service.detail ? (
                    <p className="text-xs text-muted-foreground">{service.detail}</p>
                  ) : null}
                </div>
                <Badge variant={service.status === "online" ? "success" : "danger"}>
                  {service.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Indexing Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length > 0 ? (
                  jobs.map((job) => (
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
                      <TableCell className="font-medium">{job.repository_id}</TableCell>
                      <TableCell>{formatDate(job.created_at)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No jobs found.
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
