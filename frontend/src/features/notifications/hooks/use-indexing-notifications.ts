'use client';

import * as React from 'react';

import { notifyIndexingTerminal } from '@/features/notifications/utils/notify-indexing';
import { isActiveIndexingStatus } from '@/features/dashboard/utils/indexing-status';
import { useIndexingJobs } from '@/features/repositories/hooks/use-repositories';

type IndexingJobLike = {
  id?: string;
  status?: string;
  message?: string;
};

/**
 * Emits bell notifications when global indexing jobs reach terminal states.
 */
export function useIndexingNotifications(repositoryId?: string): void {
  const { data: jobs } = useIndexingJobs(repositoryId);
  const prevStatusesRef = React.useRef<Map<string, string>>(new Map());

  React.useEffect(() => {
    prevStatusesRef.current = new Map();
  }, [repositoryId]);

  React.useEffect(() => {
    if (!jobs?.length) return;

    for (const job of jobs as IndexingJobLike[]) {
      const jobId = job.id;
      if (!jobId) continue;

      const status = String(job.status ?? '').toLowerCase();
      const prev = prevStatusesRef.current.get(jobId);
      if (prev === status) continue;
      prevStatusesRef.current.set(jobId, status);

      if (!prev || isActiveIndexingStatus(prev)) {
        notifyIndexingTerminal(job);
      }
    }
  }, [jobs]);
}
