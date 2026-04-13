'use client';

import * as React from 'react';
import {
  BrainCircuit, Database, GitBranch, ShieldCheck, Zap,
  ChevronDown, CheckCircle, Clock, XCircle, History,
  Plus, MessageSquare,
} from 'lucide-react';
import { ChatWorkspace } from '@/features/chat/components/chat-workspace';
import { useProjects, useRepositories } from '@/features/repositories/hooks/use-repositories';
import { Badge } from '@/components/ui/badge';
import { Repository } from '@/features/repositories/types/repository-types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Status icon ─────────────────────────────────────── */
function RepoStatusDot({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
    </span>
  );
  if (s === 'failed') return <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />;
  if (s === 'pending' || s === 'running') return <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />;
  return <span className="h-2 w-2 rounded-full bg-zinc-600 shrink-0" />;
}

/* ── Compact repo dropdown ───────────────────────────── */
function RepoDropdown({
  repositories,
  selectedId,
  onSelect,
  isLoading,
}: {
  repositories: Repository[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = repositories.find((r) => r.id === selectedId);

  React.useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={isLoading || repositories.length === 0}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all min-w-0 max-w-[220px]',
          'bg-white/4 hover:bg-white/6',
          open
            ? 'border-violet-500/50 shadow-[0_0_0_2px_hsl(265,80%,65%,0.15)]'
            : 'border-white/10 hover:border-white/20',
          (isLoading || repositories.length === 0) && 'opacity-40 cursor-not-allowed'
        )}
      >
        <Database className="h-3.5 w-3.5 text-violet-400 shrink-0" />
        {selected ? (
          <>
            <RepoStatusDot status={selected.latest_index_status ?? undefined} />
            <span className="text-zinc-200 truncate">{selected.repo_id}</span>
          </>
        ) : (
          <span className="text-zinc-600 truncate">
            {isLoading ? 'Loading…' : 'Select repository'}
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-500 shrink-0 transition-transform ml-auto', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-1.5 left-0 z-50 min-w-[220px] rounded-2xl border border-white/10 bg-[hsl(240,18%,8%)] shadow-2xl shadow-black/50 overflow-hidden"
          >
            {repositories.map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => { onSelect(repo.id); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12px] font-medium transition-colors',
                  repo.id === selectedId
                    ? 'bg-violet-500/12 text-violet-300'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                )}
              >
                <RepoStatusDot status={repo.latest_index_status ?? undefined} />
                <span className="flex-1 truncate">{repo.repo_id}</span>
                {repo.id === selectedId && <CheckCircle className="h-3.5 w-3.5 text-violet-400 shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Chat Page ────────────────────────────────────────── */
export default function ChatPage() {
  const { projects } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('');
  const [selectedRepositoryId, setSelectedRepositoryId] = React.useState<string>('');

  const { repositories, isLoading } = useRepositories(selectedProjectId);

  React.useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  React.useEffect(() => {
    if (!selectedRepositoryId && repositories.length > 0) {
      const indexed = repositories.find((r) => r.latest_index_status?.toLowerCase() === 'completed');
      setSelectedRepositoryId(indexed?.id ?? repositories[0].id);
    }
  }, [repositories, selectedRepositoryId]);

  const selectedRepo = repositories.find((r) => r.id === selectedRepositoryId);
  const isReady = selectedRepo?.latest_index_status?.toLowerCase() === 'completed';

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full overflow-hidden bg-[hsl(240,18%,4%)]">

      {/* ── Slim, clean top bar (responsive) ──────────────── */}
      <div className="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 md:px-5 h-11 sm:h-12 border-b border-white/6 bg-[hsl(240,18%,5%)] overflow-x-auto">

        {/* Page identity */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/20">
            <MessageSquare className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <span className="text-[11px] sm:text-[12px] font-bold text-white/70 hidden sm:block">AI Workspace</span>
        </div>

        <div className="h-4 w-px bg-white/8 shrink-0 hidden sm:block" />

        {/* Repo selector */}
        <div className="flex-shrink-0">
          <RepoDropdown
            repositories={repositories}
            selectedId={selectedRepositoryId}
            onSelect={setSelectedRepositoryId}
            isLoading={isLoading}
          />
        </div>

        {/* Branch badge — only when selected (hidden on mobile) */}
        {selectedRepo && (
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/3 border border-white/8 text-[10px] font-bold text-zinc-500 flex-shrink-0">
            <GitBranch className="h-3 w-3" />
            {selectedRepo.default_branch}
          </div>
        )}

        {/* Status badge (hidden on small screens for space) */}
        {selectedRepo && (
          <div className={cn(
            'hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider border flex-shrink-0',
            isReady
              ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/8 border-amber-500/20 text-amber-400'
          )}>
            {isReady ? <CheckCircle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5 animate-pulse" />}
            <span className="hidden md:inline">{selectedRepo.latest_index_status?.toUpperCase() || 'NOT INDEXED'}</span>
            <span className="md:hidden">{isReady ? 'Ready' : 'Indexing'}</span>
          </div>
        )}

        <div className="flex-1 min-w-0 hidden md:block" />

        {/* RAG engine indicator */}
        <div className="hidden xl:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-emerald-400 border border-emerald-500/15 bg-emerald-500/6 flex-shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          RAG Active
        </div>
      </div>

      {/* ── Chat workspace (full height, full width) ─────── */}
      <div className="flex flex-1 overflow-hidden">
        <ChatWorkspace repositoryId={selectedRepositoryId} />
      </div>
    </div>
  );
}
