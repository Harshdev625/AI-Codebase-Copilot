'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Database, LayoutGrid, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { AdminDashboardHeader } from '@/features/admin/components/admin-dashboard-header';
import { AdminHealthList } from '@/features/admin/components/admin-health-list';
import { AdminMetricsGrid } from '@/features/admin/components/admin-metrics-grid';
import { AdminRepositoriesPanel } from '@/features/admin/components/admin-repositories-panel';
import { AdminTabBar, type AdminTabId } from '@/features/admin/components/admin-tab-bar';
import { AdminTelemetryPanel } from '@/features/admin/components/admin-telemetry-panel';
import { AdminUsersTable } from '@/features/admin/components/admin-users-table';
import { AdminRecentJobsStrip } from '@/features/admin/components/admin-recent-jobs-strip';
import { useAdminDashboard } from '@/features/admin/hooks/use-admin-dashboard';
import { useIndexRepository } from '@/features/repositories/hooks/use-repositories';
import type { IndexingJob } from '@/features/admin/services/admin-service';

const TABS = [
  { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
  { id: 'repositories' as const, label: 'Repositories', icon: Database },
  { id: 'users' as const, label: 'Users & Access', icon: Users },
];

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = React.useState<AdminTabId>('overview');

  const {
    metricsQuery,
    healthQuery,
    repositoriesQuery,
    indexingQuery,
    telemetryQuery,
    recentActivityQuery,
  } = useAdminDashboard();
  const indexMutation = useIndexRepository();

  const repositories = repositoriesQuery.data ?? [];
  const indexingJobs: IndexingJob[] =
    recentActivityQuery.data?.indexing_jobs?.items ?? indexingQuery.data ?? [];
  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  const handleReindex = (repoId: string) => {
    indexMutation.mutate({ repository_id: repoId });
  };

  const anyError =
    metricsQuery.isError ||
    healthQuery.isError ||
    telemetryQuery.isError;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <AdminDashboardHeader onRefresh={handleRefresh} />

      {anyError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Some admin data failed to load.{' '}
          <button type="button" onClick={handleRefresh} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <AdminTabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        {activeTab === 'overview' && (
          <>
            <section className="space-y-3">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground lg:text-xs">
                Platform Metrics
              </h2>
              <AdminMetricsGrid
                metrics={metricsQuery.data}
                isLoading={metricsQuery.isLoading}
                isError={metricsQuery.isError}
                onRetry={handleRefresh}
              />
            </section>
            <section className="grid grid-cols-1 gap-4 2xl:grid-cols-12">
              <AdminTelemetryPanel
                telemetry={telemetryQuery.data}
                isLoading={telemetryQuery.isLoading}
                lastRefreshedAt={telemetryQuery.dataUpdatedAt}
                onFailedJobsClick={() => setActiveTab('repositories')}
              />
              <div className="2xl:col-span-4">
                <AdminHealthList health={healthQuery.data ?? []} isLoading={healthQuery.isLoading} />
              </div>
            </section>
            <AdminRecentJobsStrip jobs={indexingJobs} repositories={repositories} />
          </>
        )}

        {activeTab === 'repositories' && (
          <AdminRepositoriesPanel
            repositories={repositories}
            indexingJobs={indexingJobs}
            isLoadingRepos={repositoriesQuery.isLoading}
            isLoadingJobs={recentActivityQuery.isLoading || indexingQuery.isLoading}
            onReindex={handleReindex}
            isReindexing={indexMutation.isPending}
          />
        )}

        {activeTab === 'users' && <AdminUsersTable />}
      </motion.div>
    </div>
  );
}
