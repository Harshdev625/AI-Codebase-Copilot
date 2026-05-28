'use client';

import * as React from 'react';
import { Activity, Server, Users, Database, ShieldCheck, AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminDashboard } from '@/features/admin/hooks/use-admin-dashboard';
import { formatDate } from '@/lib/utils';

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          {label}
        </p>
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className="mt-4 text-3xl font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { metricsQuery, healthQuery, usersQuery, repositoriesQuery, indexingQuery } = useAdminDashboard();

  const metrics = metricsQuery.data;
  const health = healthQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const repositories = repositoriesQuery.data ?? [];
  const indexingJobs = indexingQuery.data ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor service health, indexing throughput, and platform users.
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh data
        </Button>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Active Users" value={metrics?.users_count ?? 0} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Repositories" value={metrics?.repositories_count ?? 0} icon={<Database className="h-4 w-4" />} />
        <StatCard label="Indexed Chunks" value={metrics?.indexed_chunks_count ?? 0} icon={<Activity className="h-4 w-4" />} />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Service Health</h2>
            <Badge variant={health.every((item) => item.status === 'healthy') ? 'success' : 'warning'}>
              {health.every((item) => item.status === 'healthy') ? 'All clear' : 'Attention'}
            </Badge>
          </div>
          <div className="space-y-3">
            {healthQuery.isLoading && (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                Loading service status...
              </div>
            )}
            {!healthQuery.isLoading && health.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                No health data available yet.
              </div>
            )}
            {health.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.detail || 'Operational'}</p>
                  </div>
                </div>
                <Badge variant={item.status === 'healthy' ? 'success' : 'warning'}>
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Latest Indexing Jobs</h2>
            <Badge variant="muted">{indexingJobs.length}</Badge>
          </div>
          <div className="space-y-3">
            {indexingQuery.isLoading && (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                Loading indexing jobs...
              </div>
            )}
            {!indexingQuery.isLoading && indexingJobs.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                No indexing jobs found.
              </div>
            )}
            {indexingJobs.slice(0, 5).map((job) => (
              <div key={job.id} className="flex items-start justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Repository {job.repository_id}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(job.created_at)}</p>
                </div>
                <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'warning'}>
                  {job.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Recent Users</h2>
          </div>
          <div className="space-y-3">
            {usersQuery.isLoading && (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                Loading users...
              </div>
            )}
            {!usersQuery.isLoading && users.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                No users yet.
              </div>
            )}
            {users.slice(0, 5).map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{user.full_name || user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant={user.role === 'ADMIN' ? 'ai' : 'muted'}>{user.role}</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Recent Repositories</h2>
          </div>
          <div className="space-y-3">
            {repositoriesQuery.isLoading && (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                Loading repositories...
              </div>
            )}
            {!repositoriesQuery.isLoading && repositories.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/50 px-4 py-4 text-sm text-muted-foreground">
                No repositories tracked yet.
              </div>
            )}
            {repositories.slice(0, 5).map((repo) => (
              <div key={repo.id} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{repo.repo_id}</p>
                  <p className="text-xs text-muted-foreground">{repo.default_branch || 'main'}</p>
                </div>
                <Badge variant={repo.latest_job_status === 'completed' ? 'success' : repo.latest_job_status ? 'warning' : 'muted'}>
                  {repo.latest_job_status || 'idle'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {(metricsQuery.isError || healthQuery.isError || usersQuery.isError || repositoriesQuery.isError || indexingQuery.isError) && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Some admin data failed to load. Refresh or check the backend logs.
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Admin operations are audited by the backend role system.
      </div>
    </div>
  );
}
