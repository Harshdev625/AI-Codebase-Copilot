'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { repositoryService } from '../services/repository-service';
import { Repository } from '../types/repository-types';
import { useIndexRepository } from '../hooks/use-repositories';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Globe, HardDrive, RefreshCw, Loader2, GitBranch,
  Zap, Bot, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { cn, formatDate, truncate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface RepositoryCardProps {
  repository: Repository;
}

function StatusBadge({ status, isIndexing }: { status: string; isIndexing: boolean }) {
  if (isIndexing) {
    return (
      <Badge variant="warning" className="gap-1">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Indexing
      </Badge>
    );
  }
  const s = status.toLowerCase();
  if (s === 'completed') return <Badge variant="success" className="gap-1"><CheckCircle className="h-2.5 w-2.5" />Ready</Badge>;
  if (s === 'failed')    return <Badge variant="error"   className="gap-1"><XCircle   className="h-2.5 w-2.5" />Failed</Badge>;
  return <Badge variant="muted" className="gap-1"><Clock className="h-2.5 w-2.5" />{status || 'Not indexed'}</Badge>;
}

export function RepositoryItemCard({ repository }: RepositoryCardProps) {
  const indexMutation = useIndexRepository();
  const router = useRouter();
  const [progress, setProgress] = React.useState<{
    status: string; percentage: number; message: string; snapshotId?: string;
  } | null>(null);

  React.useEffect(() => {
    if (!progress?.snapshotId || ['completed', 'failed'].includes(progress.status.toLowerCase())) return;
    const interval = setInterval(async () => {
      try {
        const data = await repositoryService.getIndexProgress(progress.snapshotId!);
        setProgress({ status: data.index_status, percentage: data.percentage, message: data.message, snapshotId: progress.snapshotId });
      } catch { clearInterval(interval); }
    }, 2000);
    return () => clearInterval(interval);
  }, [progress?.snapshotId, progress?.status]);

  const handleIndex = () => {
    indexMutation.mutate({ repository_id: repository.id }, {
      onSuccess: (data) => {
        if (data.snapshot_id) {
          setProgress({ status: 'pending', percentage: 0, message: 'Queuing for indexing…', snapshotId: data.snapshot_id });
        }
      },
    });
  };

  const status = progress?.status || repository.latest_index_status || 'not indexed';
  const isIndexing = (progress && !['completed', 'failed'].includes(status.toLowerCase())) || indexMutation.isPending;
  const isReady = status.toLowerCase() === 'completed';

  return (
    <div className={cn(
      'group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-300',
      'bg-[hsl(240,18%,7%)] glow-border',
      isIndexing
        ? 'border-amber-500/20 shadow-[0_0_20px_-8px_hsl(38,92%,50%,0.3)]'
        : isReady
        ? 'border-white/6 hover:border-emerald-500/20 hover:shadow-[0_0_20px_-8px_hsl(142,65%,45%,0.25)]'
        : 'border-white/6 hover:border-violet-500/15 hover:shadow-[0_0_20px_-8px_hsl(265,80%,65%,0.2)]',
      'hover:-translate-y-0.5'
    )}>
      {/* Top gradient accent line */}
      <div className={cn(
        'h-px w-full',
        isIndexing ? 'bg-gradient-to-r from-transparent via-amber-500/60 to-transparent'
        : isReady   ? 'bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent'
                    : 'bg-gradient-to-r from-transparent via-violet-500/20 to-transparent'
      )} />

      {/* Ambient glow orb */}
      <div className={cn(
        'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500',
        isReady ? 'bg-emerald-500/10' : 'bg-violet-500/10'
      )} />

      {/* Content */}
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-all duration-300',
              isReady
                ? 'bg-emerald-500/8 border-emerald-500/20 group-hover:border-emerald-500/40 group-hover:shadow-[0_0_12px_-4px_hsl(142,65%,45%,0.4)]'
                : 'bg-white/3 border-white/8 group-hover:bg-violet-500/6 group-hover:border-violet-500/20'
            )}>
              {repository.remote_url
                ? <Globe className={cn('h-4.5 w-4.5 transition-colors', isReady ? 'text-emerald-400' : 'text-zinc-600 group-hover:text-violet-400')} />
                : <HardDrive className={cn('h-4.5 w-4.5 transition-colors', isReady ? 'text-emerald-400' : 'text-zinc-600 group-hover:text-violet-400')} />
              }
            </div>
            <div className="min-w-0">
              <h3 className={cn('text-[14px] font-bold tracking-tight truncate transition-colors',
                isReady ? 'text-zinc-200 group-hover:text-emerald-300' : 'text-zinc-200 group-hover:text-violet-300')}>
                {repository.repo_id}
              </h3>
              <p className="text-[10px] text-zinc-700 font-medium truncate mt-0.5 font-mono">
                {truncate(repository.remote_url || repository.local_path || '—', 38)}
              </p>
            </div>
          </div>
          <StatusBadge status={status} isIndexing={!!isIndexing} />
        </div>

        {/* Branch + version */}
        <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-700">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/3 border border-white/5">
            <GitBranch className="h-2.5 w-2.5" />
            {repository.default_branch}
          </span>
          <span className="flex items-center gap-1.5">
            <RefreshCw className="h-2.5 w-2.5" />
            v{repository.indexing_version || 1}
          </span>
        </div>
      </div>

      {/* Bottom: progress or actions */}
      <div className="mt-auto px-5 pb-5 pt-1">
        <AnimatePresence mode="wait">
          {isIndexing ? (
            <motion.div
              key="indexing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-2.5 pt-4 border-t border-white/5"
            >
              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-[0.2em]">
                <span className="flex items-center gap-2 text-amber-400 animate-pulse">
                  {progress?.message || 'In-Synchronization'}
                </span>
                <span className="text-zinc-600">{Math.round(progress?.percentage || 0)}%</span>
              </div>
              <Progress value={progress?.percentage || 0} variant="ai" size="sm" animated />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between pt-4 border-t border-white/5"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-700">
                {repository.updated_at || repository.created_at
                  ? formatDate(repository.updated_at || repository.created_at)
                  : 'No snapshots'}
              </p>
              <div className="flex items-center gap-2">
                {isReady && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-zinc-700 hover:text-violet-400 hover:bg-violet-500/8 border border-transparent hover:border-violet-500/20 transition-all"
                    onClick={() => router.push('/chat')}
                  >
                    <Bot className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border',
                    isReady
                      ? 'border-white/8 bg-transparent text-zinc-500 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30'
                      : 'border-violet-500/20 bg-violet-500/8 text-violet-400 hover:bg-violet-500/15 hover:border-violet-500/40 hover:shadow-[0_0_12px_-4px_hsl(265,80%,65%,0.4)]'
                  )}
                  onClick={handleIndex}
                  disabled={!!isIndexing}
                >
                  <Zap className="h-3 w-3 mr-2" />
                  {isReady ? 'Refresh' : 'Initialize'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Indexing amber overlay */}
      {isIndexing && (
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-amber-500/[0.03] to-transparent rounded-3xl" />
      )}
    </div>
  );
}
