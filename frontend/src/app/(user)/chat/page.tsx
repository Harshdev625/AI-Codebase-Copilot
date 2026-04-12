'use client';

import * as React from 'react';
import {
  BrainCircuit, Database, GitBranch, ShieldCheck, Zap, Layers,
  ChevronDown, CheckCircle, Clock, XCircle, Sparkles,
} from 'lucide-react';
import { ChatWorkspace } from '@/features/chat/components/chat-workspace';
import { useProjects, useRepositories } from '@/features/repositories/hooks/use-repositories';
import { Badge } from '@/components/ui/badge';
import { Repository } from '@/features/repositories/types/repository-types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Status icon ──────────────────────────────────────── */
function RepoStatusIcon({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return <CheckCircle className="h-3 w-3 text-emerald-400" />;
  if (s === 'failed')    return <XCircle className="h-3 w-3 text-red-400" />;
  if (s === 'pending' || s === 'running') return <Clock className="h-3 w-3 text-amber-400 animate-pulse" />;
  return <Clock className="h-3 w-3 text-zinc-700" />;
}

/* ── Compact repo dropdown for the top command bar ─────── */
function RepoSelector({
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
          'flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-[12px] font-semibold transition-all',
          'bg-[hsl(240,18%,8%)] hover:bg-[hsl(240,18%,10%)]',
          open
            ? 'border-violet-500/40 shadow-[0_0_0_1px_hsl(265,80%,65%,0.12),0_0_20px_-8px_hsl(265,80%,65%,0.3)]'
            : 'border-white/8 hover:border-violet-500/25',
          (isLoading || repositories.length === 0) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Database className="h-3.5 w-3.5 text-violet-400 shrink-0" />
        {selected ? (
          <>
            <RepoStatusIcon status={selected.latest_index_status ?? undefined} />
            <span className="text-zinc-300 max-w-[160px] truncate">{selected.repo_id}</span>
          </>
        ) : (
          <span className="text-zinc-600">
            {isLoading ? 'Loading…' : repositories.length === 0 ? 'No sources' : 'Select repository…'}
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 text-zinc-600 transition-transform ml-0.5', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 z-50 min-w-[260px] rounded-2xl border border-white/8 bg-[hsl(240,18%,7%)] shadow-2xl overflow-hidden"
          >
            {repositories.map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => { onSelect(repo.id); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-4 py-3 text-left text-[12px] font-medium transition-all',
                  repo.id === selectedId
                    ? 'bg-violet-500/10 text-violet-300'
                    : 'text-zinc-500 hover:bg-white/3 hover:text-zinc-300'
                )}
              >
                <RepoStatusIcon status={repo.latest_index_status ?? undefined} />
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

/* ── Repo metadata strip ──────────────────────────────── */
function RepoMetaStrip({ repo }: { repo: Repository | undefined }) {
  if (!repo) return null;
  const isReady = repo.latest_index_status?.toLowerCase() === 'completed';

  return (
    <div className="flex items-center gap-3 text-[10px]">
      <div className="flex items-center gap-1.5 text-zinc-600">
        <GitBranch className="h-3 w-3" />
        <code className="text-zinc-500 font-mono">{repo.default_branch}</code>
      </div>
      <div className="h-3 w-px bg-white/8" />
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3 w-3 text-zinc-600" />
        <Badge variant={isReady ? 'success' : 'warning'} className="h-4 text-[8px] font-bold uppercase">
          {isReady ? 'READY' : repo.latest_index_status?.toUpperCase() || 'NOT INDEXED'}
        </Badge>
      </div>
      <div className="h-3 w-px bg-white/8" />
      <div className="flex items-center gap-1.5 text-violet-500/60 font-bold">
        <Zap className="h-3 w-3" />
        RAG · LangGraph
      </div>
    </div>
  );
}

/* ── Capabilities quick-reference bar ─────────────────── */
const CAPABILITIES = [
  { label: 'Architecture', shortcut: '/' },
  { label: 'Security Audit', shortcut: '!' },
  { label: 'Refactor', shortcut: '@' },
  { label: 'Debug', shortcut: '#' },
];

/* ── Main Chat Page ───────────────────────────────────── */
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

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] w-full overflow-hidden">

      {/* ── Top Command Bar ─────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-4 px-6 py-3 border-b border-white/6 bg-[hsl(240,18%,4%)/80] backdrop-blur-xl">
        {/* Left: page identity */}
        <div className="flex items-center gap-3 mr-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20">
            <BrainCircuit className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-white/90 leading-none">AI Workspace</p>
            <p className="text-[9px] text-zinc-600 mt-0.5">Agentic RAG · LangGraph</p>
          </div>
        </div>

        <div className="h-6 w-px bg-white/6 shrink-0" />

        {/* Center: repo selector + meta */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <RepoSelector
            repositories={repositories}
            selectedId={selectedRepositoryId}
            onSelect={setSelectedRepositoryId}
            isLoading={isLoading}
          />
          <RepoMetaStrip repo={selectedRepo} />
        </div>

        {/* Right: capabilities strip + status */}
        <div className="hidden xl:flex items-center gap-2 shrink-0">
          {CAPABILITIES.map((cap) => (
            <div key={cap.label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/6 bg-white/2 text-[9px] font-bold text-zinc-700 hover:text-zinc-400 hover:border-white/10 transition-all cursor-default">
              <kbd className="text-violet-500/60">{cap.shortcut}</kbd>
              {cap.label}
            </div>
          ))}
        </div>

        {/* RAG live badge */}
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/6 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide text-emerald-400 shrink-0">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          Real-time RAG
        </div>
      </div>

      {/* ── Chat Workspace (full width) ─────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <ChatWorkspace repositoryId={selectedRepositoryId} />
      </div>
    </div>
  );
}
