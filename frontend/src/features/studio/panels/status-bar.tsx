'use client';

import React from 'react';
import { useStudioStore } from '@/features/studio/store/studio-store';
import { Activity, CheckCircle, FileCode2, Blocks, GitBranch, GitCommit, Loader2 } from 'lucide-react';
import { useRepositoryInsights, useIndexingJobs, useRepositories } from '@/features/repositories/hooks/use-repositories';
import { cn } from '@/lib/utils';

export function StatusBar() {
  const { selectedRepositoryId } = useStudioStore();
  const { repositories } = useRepositories();
  const selectedRepository = repositories.find(r => r.id === selectedRepositoryId);

  const { data: insights } = useRepositoryInsights(selectedRepository?.id || '');
  const { data: jobs } = useIndexingJobs(selectedRepository?.id);

  const latestJob = jobs?.[0];
  const isRunning = latestJob?.status === 'running' || latestJob?.status === 'in_progress' || latestJob?.status === 'queued';
  const progress = latestJob?.stats?.percentage || 0;
  const eta = latestJob?.stats?.eta_seconds;

  const systemStatus = !selectedRepository
    ? 'Ready'
    : isRunning
      ? 'Indexing'
      : latestJob?.status === 'failed'
        ? 'Failed'
        : 'Ready';

  return (
    <div className="h-7 w-full bg-[#13151A] text-[#C9D1D9] border-t border-[#1E212B] flex items-center px-3 text-[11px] font-medium justify-between z-20 select-none overflow-hidden">
      {/* Left side */}
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

      {/* Right side */}
      <div className="flex items-center gap-3 shrink-0">
        {selectedRepository && !isRunning && insights && (
          <>
            <div className="hidden sm:flex items-center gap-1" title="Files indexed">
              <FileCode2 className="w-3 h-3 opacity-70" />
              <span>{insights.files_indexed}/{insights.files_total}</span>
            </div>
            {typeof selectedRepository.latest_job_stats?.chunks_created === 'number' && (
              <div className="hidden md:flex items-center gap-1" title="Chunks">
                <Blocks className="w-3 h-3 opacity-70" />
                <span>{selectedRepository.latest_job_stats.chunks_created.toLocaleString()}</span>
              </div>
            )}
          </>
        )}
        {isRunning && (
          <div className="flex items-center gap-1.5 bg-primary-foreground/15 rounded px-2 py-0.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Indexing {progress}%</span>
            {eta !== undefined && eta !== null && (
              <span className="opacity-70 hidden sm:inline-block">
                · {eta > 60 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : `${eta}s`}
              </span>
            )}
          </div>
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
