'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { useIndexingJobs, useRepositories } from '@/features/repositories/hooks/use-repositories';
import { repositoryService } from '@/features/repositories/services/repository-service';
import { TaskCard } from '@/features/studio/panels/background-tasks-panel';
import { isActiveIndexingStatus } from '@/features/dashboard/utils/indexing-status';

function LiveIndexingJobCard({ job }: { job: Record<string, unknown> }) {
  const jobId = String(job.id);
  const isActive = isActiveIndexingStatus(String(job.status ?? ''));

  const { data } = useQuery({
    queryKey: ['index-progress', jobId],
    queryFn: () => repositoryService.getIndexProgress(jobId),
    enabled: isActive,
    refetchInterval: (query) => {
      const status = query.state.data?.job_status;
      if (!status) return 2000;
      return isActiveIndexingStatus(status) ? 2000 : false;
    },
  });

  const mergedJob = React.useMemo(() => {
    if (!data) return job;
    return {
      ...job,
      status: data.job_status ?? job.status,
      message: data.message ?? job.message,
      started_at: data.started_at ?? job.started_at,
      stats: {
        ...(typeof job.stats === 'object' && job.stats ? job.stats : {}),
        ...(data.stats ?? {}),
        percentage: data.percentage ?? data.stats?.percentage,
        eta_seconds: data.eta_seconds ?? data.stats?.eta_seconds,
        current_stage: data.current_stage ?? data.stats?.current_stage,
        stage_timings: data.stage_timings ?? data.stats?.stage_timings,
        processed_files: data.processed_files ?? data.stats?.processed_files,
        total_files: data.total_files ?? data.stats?.total_files,
        current_file: data.current_file ?? data.stats?.current_file,
      },
    };
  }, [job, data]);

  return <TaskCard job={mergedJob} />;
}

export function DashboardIndexingPanel() {
  const { data: jobs, isLoading } = useIndexingJobs();
  const { repositories } = useRepositories(100, 0);

  const repoNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const repo of repositories ?? []) {
      map.set(repo.id, repo.repo_id);
    }
    return map;
  }, [repositories]);

  const activeJobs = React.useMemo(
    () => (jobs ?? []).filter((job) => isActiveIndexingStatus(String(job.status ?? ''))),
    [jobs],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-border/40 bg-card/40 px-4 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading indexing jobs…
      </div>
    );
  }

  if (activeJobs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground xl:text-lg">Indexing in progress</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Live progress, ETA, and per-step timings for active jobs
        </p>
      </div>
      <div className="space-y-4">
        {activeJobs.map((job) => (
          <div key={String(job.id)} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {repoNameById.get(String(job.repository_id)) ?? 'Repository'}
            </p>
            <LiveIndexingJobCard job={job} />
          </div>
        ))}
      </div>
    </div>
  );
}
