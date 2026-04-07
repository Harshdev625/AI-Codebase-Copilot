"use client";

import * as React from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type IndexingJob, type Repository, toApiError } from "@/lib/api";
import { formatDate, truncate } from "@/lib/utils";

export default function AdminRepositoriesPage(): React.JSX.Element {
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
        title="Manage Repositories"
        description="Inspect repository inventory and indexing activity."
        actions={
          <Button variant="secondary" onClick={() => void loadData()} disabled={isLoading}>
            Refresh
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repositories.length > 0 ? (
                  repositories.map((repository) => (
                    <TableRow key={repository.id}>
                      <TableCell className="font-medium">{repository.repo_id}</TableCell>
                      <TableCell>{repository.default_branch}</TableCell>
                      <TableCell>{truncate(repository.remote_url || repository.local_path || "-")}</TableCell>
                      <TableCell>{formatDate(repository.created_at)}</TableCell>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indexing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Repository ID</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.length > 0 ? (
                  jobs.slice(0, 25).map((job) => (
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No indexing jobs found.
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
