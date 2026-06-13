'use client';

import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { IndexingJob } from '@/features/admin/services/admin-service';
import type { Repository } from '@/features/repositories/types/repository-types';

interface AdminRecentJobsStripProps {
  jobs: IndexingJob[];
  repositories: Repository[];
}

export function AdminRecentJobsStrip({ jobs, repositories }: AdminRecentJobsStripProps) {
  const recent = jobs.slice(0, 5);

  if (recent.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary xl:h-5 xl:w-5" />
        <h2 className="text-sm font-semibold text-foreground lg:text-base xl:text-lg">Recent indexing jobs</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {recent.map((job) => {
          const repoName =
            repositories.find((r) => r.id === job.repository_id)?.repo_id ?? job.repository_id;
          return (
            <div
              key={job.id}
              className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur-xl xl:p-5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-foreground xl:text-base">{repoName}</span>
                <Badge
                  variant={
                    job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'warning'
                  }
                  className="shrink-0 text-xs"
                >
                  {job.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground xl:text-sm">{formatDate(job.created_at)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
