'use client';

import React from 'react';
import Link from 'next/link';
import { useStudioStore } from '@/features/studio/store/studio-store';
import { Activity, CheckCircle, FileCode2, Blocks, GitBranch, GitCommit, Loader2 } from 'lucide-react';
import { useRepositoryInsights, useIndexingJobs, useRepositories } from '@/features/repositories/hooks/use-repositories';
import { cn } from '@/lib/utils';
import { isActiveIndexingStatus } from '@/features/dashboard/utils/indexing-status';

export function StatusBar() {
  const { selectedRepositoryId, primarySidebar, focusSidebar } = useStudioStore();
  const { repositories } = useRepositories();
  const selectedRepository = repositories.find(r => r.id === selectedRepositoryId);

  const { data: insights } = useRepositoryInsights(selectedRepository?.id || '');
  const { data: jobs } = useIndexingJobs(selectedRepository?.id);

  const latestJob = jobs?.[0];
  const isRunning = latestJob?.status
    ? isActiveIndexingStatus(String(latestJob.status))
    : false;
  const progress = latestJob?.stats?.percentage || 0;
  const eta = latestJob?.stats?.eta_seconds;
  const tasksPanelOpen = primarySidebar === 'tasks';

  const systemStatus = !selectedRepository
    ? 'Ready'
    : isRunning
      ? 'Indexing'
      : latestJob?.status === 'failed'
        ? 'Failed'
        : 'Ready';

  return (
    <div className="h-7 w-full bg-[#13151A] text-[#C9D1D9] border-t border-[#1E212B] flex items-center px-3 text-[11px] font-medium justify-between z-20 select-none overflow-hidden">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1 shrink-0" title="System status">
          <Activity className={cn("w-3 h-3 opacity-70", isRunning && "animate-pulse")} />
          <span className={cn(
            "hidden sm:inline-block capitalize",
            systemStatus === 'Failed' && 'text-red-200',
            systemStatus === 'Indexing' && 'text-yellow-100',
          )}>
            {systemStatus}
          </span>
        </div>
        {selectedRepository && (
          <>
            <div className="flex items-center gap-1 truncate max-w-[120px] sm:max-w-none" title={selectedRepository.repo_id}>
              <CheckCircle className="w-3 h-3 shrink-0 opacity-80" />
              <span className="truncate">{selectedRepository.repo_id.split('/').pop()}</span>
            </div>
            {selectedRepository.default_branch && (
              <div className="hidden sm:flex items-center gap-1" title="Branch">
                <GitBranch className="w-3 h-3 opacity-70" />
                <span>{selectedRepository.default_branch}</span>
              </div>
            )}
            {typeof selectedRepository.latest_job_stats?.commit_sha === 'string' && (
              <div className="hidden md:flex items-center gap-1 font-mono opacity-80" title="Commit SHA">
                <GitCommit className="w-3 h-3" />
                <span>{selectedRepository.latest_job_stats.commit_sha.substring(0, 7)}</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {selectedRepository && !isRunning && insights && (
          <>
            <div className="hidden sm:flex items-center gap-1" title={`${insights.files_indexed} indexed, ${insights.files_skipped ?? 0} excluded, ${insights.files_total} total`}>
              <FileCode2 className="w-3 h-3 opacity-70" />
              <span>{insights.files_indexed}/{insights.files_total}</span>
              {(insights.files_skipped ?? 0) > 0 && (
                <span className="text-amber-400/90">· {insights.files_skipped} excl.</span>
              )}
            </div>
            {typeof selectedRepository.latest_indexed_chunks === 'number' && (
              <div className="hidden md:flex items-center gap-1" title="Chunks">
                <Blocks className="w-3 h-3 opacity-70" />
                <span>{selectedRepository.latest_indexed_chunks.toLocaleString()}</span>
              </div>
            )}
          </>
        )}
        {isRunning && !tasksPanelOpen && (
          <button
            type="button"
            className="flex items-center gap-1.5 bg-primary-foreground/15 rounded px-2 py-0.5 hover:bg-primary-foreground/25 transition-colors"
            onClick={() => focusSidebar('tasks')}
            title="Open background tasks for details"
          >
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Indexing {progress}%</span>
            {eta !== undefined && eta !== null && (
              <span className="opacity-70 hidden sm:inline-block">
                · {eta > 60 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : `${eta}s`}
              </span>
            )}
          </button>
        )}
        {isRunning && tasksPanelOpen && (
          <Link
            href="/dashboard"
            className="text-[10px] text-[#58A6FF] hover:underline hidden sm:inline"
          >
            Dashboard →
          </Link>
        )}
        {latestJob && !isRunning && (
          <span className={cn(
            "capitalize opacity-80",
            latestJob.status === 'completed' ? 'text-green-200' :
            latestJob.status === 'failed' ? 'text-red-300' : 'opacity-70'
          )}>
            {latestJob.status}
          </span>
        )}
      </div>
    </div>
  );
}
