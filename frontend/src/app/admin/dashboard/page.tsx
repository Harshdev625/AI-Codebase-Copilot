'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, Server, Users, Database, ShieldCheck, AlertTriangle,
  FileText, Camera, MessageSquare, GitPullRequestDraft, 
  RefreshCw, PlayCircle, XCircle, CheckCircle2, Clock, LayoutGrid
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminDashboard } from '@/features/admin/hooks/use-admin-dashboard';
import { useIndexRepository } from '@/features/repositories/hooks/use-repositories';
import { formatDate } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import type { IndexingJob } from '@/features/admin/services/admin-service';

function StatCard({ label, value, icon, description }: { label: string; value: number | string; icon: React.ReactNode; description?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/60 backdrop-blur-xl p-4 shadow-2xl transition-all hover:border-primary/50 flex flex-col justify-between">
      {/* Glow Effect */}
      <div className="absolute inset-x-0 -bottom-px h-px w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.15)] group-hover:scale-110 transition-transform duration-500">
          {icon}
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
      {description && (
        <div className="mt-1 text-[10px] text-muted-foreground">{description}</div>
      )}
    </div>
  );
}

type TabType = 'overview' | 'repositories' | 'users';

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<TabType>('overview');
  
  const { metricsQuery, healthQuery, usersQuery, repositoriesQuery, indexingQuery, telemetryQuery, recentActivityQuery } = useAdminDashboard();
  const indexMutation = useIndexRepository();

  const metrics = metricsQuery.data;
  const health = healthQuery.data ?? [];
  const telemetry = telemetryQuery.data;
  const recentActivity = recentActivityQuery.data;

  const repositories = repositoriesQuery.data ?? [];
  const indexingJobs: IndexingJob[] = recentActivity?.indexing_jobs?.items ?? indexingQuery.data ?? [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  const handleReindex = (repoId: string) => {
    indexMutation.mutate({ repository_id: repoId });
  };

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'repositories', label: 'Repositories', icon: Database },
    { id: 'users', label: 'Users & Access', icon: Users },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 animate-in fade-in duration-500 h-[calc(100vh-4rem)] flex flex-col gap-4">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-[0_0_30px_rgba(var(--primary),0.3)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Control</h1>
            <p className="text-sm font-medium text-muted-foreground">
              Real-time telemetry and platform management.
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefresh} 
          className="gap-2 border-border/40 bg-card/40 backdrop-blur-md hover:bg-muted/50 text-foreground transition-all shadow-lg"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </Button>
      </header>

      {/* Modern Tab Bar */}
      <div className="flex space-x-1 rounded-xl bg-card/60 backdrop-blur-md p-1 border border-border/40 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="admin-active-tab"
                className="absolute inset-0 rounded-lg bg-muted border border-border/50 shadow-sm"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <tab.icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content Area - Strict Height with Internal Scroll */}
      <div className="relative flex-1 overflow-hidden border border-border/40 rounded-2xl bg-background/40 backdrop-blur-sm shadow-inner">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="h-full overflow-y-auto custom-scrollbar p-6"
        >
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Metrics Section */}
              <section>
                <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-2">Platform Metrics</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <StatCard label="Repositories" value={metrics?.repositories_count ?? 0} icon={<Database className="h-4 w-4" />} />
                  <StatCard label="Indexed Files" value={metrics?.indexed_files_count ?? 0} icon={<FileText className="h-4 w-4" />} />
                  <StatCard label="Chunks" value={metrics?.indexed_chunks_count ?? 0} icon={<Activity className="h-4 w-4" />} />
                  <StatCard label="Sessions" value={metrics?.active_sessions ?? 0} icon={<MessageSquare className="h-4 w-4" />} />
                  <StatCard label="Patches" value={metrics?.patch_count ?? 0} icon={<GitPullRequestDraft className="h-4 w-4" />} />
                  <StatCard label="Snapshots" value={metrics?.snapshot_count ?? 0} icon={<Camera className="h-4 w-4" />} />
                </div>
              </section>

              {/* Worker Visibility & System Health */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-xl p-4 shadow-2xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" /> Worker Visibility
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div className="p-3 rounded-lg border border-border/40 bg-muted/30">
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Streams</div>
                      <div className="text-xl font-bold text-foreground">{telemetry?.active_streams ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-primary/20 bg-primary/10">
                      <div className="text-[9px] font-bold text-primary/80 uppercase tracking-widest mb-1">Workers</div>
                      <div className="text-xl font-bold text-primary">{telemetry?.indexing_running ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-warning/20 bg-warning/10">
                      <div className="text-[9px] font-bold text-warning/80 uppercase tracking-widest mb-1">Queue</div>
                      <div className="text-xl font-bold text-warning">{telemetry?.indexing_queue_depth ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10">
                      <div className="text-[9px] font-bold text-destructive/80 uppercase tracking-widest mb-1">Failures</div>
                      <div className="text-xl font-bold text-destructive">{telemetry?.queue_health?.failed_jobs ?? 0}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-border/40 bg-muted/30 col-span-2 md:col-span-1">
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1">P95 Latency</div>
                      <div className="text-xl font-bold text-foreground">{telemetry?.model_latency?.p95_ms ?? 0}ms</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/40 bg-card/60 backdrop-blur-xl p-4 shadow-2xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold text-foreground flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary" /> System Health
                    </h2>
                    <Badge variant={health.every((item) => item.status === 'online') ? 'success' : 'warning'} className="shadow-lg">
                      {health.every((item) => item.status === 'online') ? 'All Systems Go' : 'Degraded'}
                    </Badge>
                  </div>
                  <div className="space-y-2 mt-1">
                    {health.map((item) => (
                      <div key={item.name} className="group flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
                        <div className="flex items-center gap-3">
                          <span className="relative flex h-2 w-2">
                            {item.status === 'online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${item.status === 'online' ? 'bg-success' : 'bg-destructive'}`}></span>
                          </span>
                          <span className="text-sm font-medium text-foreground">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">{item.detail || 'Healthy'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'repositories' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full min-h-0">
              {/* Repository Operations */}
              <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-6 shadow-2xl flex flex-col h-full">
                <div className="flex items-center gap-2 mb-5">
                  <Database className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Repository Operations</h2>
                </div>
                <div className="space-y-3">
                  {repositories.slice(0, 10).map((repo) => (
                    <div key={repo.id} className="group flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{repo.repo_id}</p>
                        <p className="text-xs text-muted-foreground">{repo.default_branch}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant={repo.latest_job_status === 'completed' ? 'success' : repo.latest_job_status === 'failed' ? 'error' : repo.latest_job_status ? 'warning' : 'muted'} className="text-[10px]">
                          {repo.latest_job_status || 'idle'}
                        </Badge>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] border-border/40 bg-transparent hover:bg-muted text-foreground" onClick={() => handleReindex(repo.id)} disabled={indexMutation.isPending}>
                          Reindex
                        </Button>
                      </div>
                    </div>
                  ))}
                  {repositories.length === 0 && !repositoriesQuery.isLoading && (
                    <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-xl border-border/40">
                      No repositories indexed yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Indexing Job History */}
              <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-6 shadow-2xl flex flex-col h-full">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Indexing Job History
                  </h2>
                </div>
                <div className="space-y-3 overflow-y-auto custom-scrollbar pr-2 flex-1 max-h-[600px]">
                  {indexingJobs.map((job) => {
                    const repoName = repositories.find((r) => r.id === job.repository_id)?.repo_id || job.repository_id;
                    return (
                      <div key={job.id} className="flex flex-col rounded-xl border border-border/40 bg-muted/30 px-4 py-3 gap-2 transition-colors hover:bg-muted/50">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID: {job.id.substring(0,8)}</span>
                              {job.status === 'failed' && <AlertTriangle className="h-3 w-3 text-destructive" />}
                            </div>
                            <p className="text-sm font-medium text-foreground truncate">{repoName}</p>
                          </div>
                          <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'warning'} className="text-[10px] shrink-0 ml-2">
                            {job.status}
                          </Badge>
                        </div>
                        {(job.message || job.status === 'failed') && (
                          <div className="text-[10px] text-muted-foreground bg-background/50 p-2.5 rounded-lg font-mono border border-border/20 mt-1 overflow-x-auto whitespace-pre-wrap">
                            {job.message || 'Job execution failed unexpectedly.'}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground text-right mt-1 font-medium">
                          {formatDate(job.created_at)}
                        </div>
                      </div>
                    );
                  })}
                  {indexingJobs.length === 0 && !recentActivityQuery.isLoading && (
                    <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-xl border-border/40 flex-1 flex items-center justify-center">
                      No recent indexing jobs.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="h-full min-h-0">
              <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-6 shadow-2xl h-full flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <Users className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Access & User Management</h2>
                </div>
                
                <div className="overflow-x-auto rounded-xl border border-border/40 bg-muted/20">
                  <table className="w-full text-left text-sm text-foreground/80">
                    <thead className="bg-muted/40 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/40">
                      <tr>
                        <th className="px-6 py-4 font-medium">User Details</th>
                        <th className="px-6 py-4 font-medium">Role</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {(recentActivity?.recent_users?.items ?? usersQuery.data ?? []).map((user: any) => (
                        <tr key={user.id} className="transition-colors hover:bg-muted/40">
                          <td className="px-6 py-4">
                            <div className="font-medium text-foreground">{user.full_name || 'Anonymous User'}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className="text-[10px]">
                              {user.role}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-success' : 'bg-destructive'}`} />
                              <span className="text-xs font-medium">{user.is_active ? 'Active' : 'Disabled'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button size="sm" variant="ghost" className="h-8 text-xs hover:bg-muted hover:text-foreground">
                              Manage
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {(recentActivity?.recent_users?.items ?? usersQuery.data ?? []).length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground border-dashed">
                            No users found in the system.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
