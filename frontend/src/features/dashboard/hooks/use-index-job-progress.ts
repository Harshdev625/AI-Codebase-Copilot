import { useQuery } from '@tanstack/react-query';

import { repositoryService } from '@/features/repositories/services/repository-service';
import { isActiveIndexingStatus } from '@/features/dashboard/utils/indexing-status';
import type { IndexProgress } from '@/features/repositories/types/repository-types';

const PROGRESS_POLL_MS = 3000;

function mergeJobProgress<T extends Record<string, unknown>>(
  fallbackJob: T,
  data: IndexProgress | undefined,
): T {
  if (!data) return fallbackJob;

  const fallbackStats =
    typeof fallbackJob.stats === 'object' && fallbackJob.stats
      ? (fallbackJob.stats as Record<string, unknown>)
      : {};

  const mergedStats = {
    ...fallbackStats,
    ...(data.stats ?? {}),
    percentage: data.percentage ?? data.stats?.percentage ?? fallbackStats.percentage ?? 0,
    eta_seconds: data.eta_seconds ?? data.stats?.eta_seconds ?? fallbackStats.eta_seconds,
    processed_files:
      data.processed_files ?? data.stats?.processed_files ?? fallbackStats.processed_files,
    total_files: data.total_files ?? data.stats?.total_files ?? fallbackStats.total_files,
    current_file: data.current_file ?? data.stats?.current_file ?? fallbackStats.current_file,
    current_stage:
      data.current_stage ?? data.stats?.current_stage ?? fallbackStats.current_stage,
    stage_timings:
      data.stage_timings ?? data.stats?.stage_timings ?? fallbackStats.stage_timings,
  };

  return {
    ...fallbackJob,
    status: data.job_status ?? fallbackJob.status,
    message: data.message ?? fallbackJob.message,
    started_at: data.started_at ?? fallbackJob.started_at,
    stats: mergedStats,
  } as T;
}

export function useIndexJobProgress<T extends Record<string, unknown>>(
  jobId: string,
  fallbackJob: T,
  enabled = true,
) {
  const query = useQuery({
    queryKey: ['index-progress', jobId],
    queryFn: () => repositoryService.getIndexProgress(jobId),
    enabled: enabled && Boolean(jobId),
    placeholderData: (previous) => previous,
    refetchInterval: (q) => {
      const status = q.state.data?.job_status;
      if (!status) return PROGRESS_POLL_MS;
      return isActiveIndexingStatus(status) ? PROGRESS_POLL_MS : false;
    },
  });

  const job = mergeJobProgress(fallbackJob, query.data);

  return {
    job,
    isInitialLoad: query.isLoading && !query.data,
    isFetching: query.isFetching,
  };
}

export { mergeJobProgress, PROGRESS_POLL_MS };
