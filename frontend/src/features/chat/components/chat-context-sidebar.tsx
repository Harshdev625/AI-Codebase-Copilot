'use client';

import * as React from 'react';
import { Database, GitBranch, ShieldCheck, Zap, Layers, ChevronDown, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Repository } from '@/features/repositories/types/repository-types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatContextSidebarProps {
  repositories: Repository[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

function RepoStatusIcon({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return <CheckCircle className="h-3 w-3 text-success" />;
  if (s === 'failed') return <XCircle className="h-3 w-3 text-error" />;
  if (s === 'pending' || s === 'running') return <Clock className="h-3 w-3 text-warning animate-pulse" />;
  return <Clock className="h-3 w-3 text-muted-foreground/30" />;
}

function CustomSelect({
  repositories,
  selectedId,
  onSelect,
  isLoading,
}: Pick<ChatContextSidebarProps, 'repositories' | 'selectedId' | 'onSelect' | 'isLoading'>) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = repositories.find((r) => r.id === selectedId);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={isLoading}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/60 px-3.5 py-2.5 text-left',
          'text-sm font-medium transition-all hover:bg-background hover:border-primary/30 focus:outline-none',
          open && 'border-primary/40 ring-1 ring-primary/20'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <RepoStatusIcon status={selected.latest_index_status ?? undefined} />
              <span className="truncate text-sm font-semibold">{selected.repo_id}</span>
            </>
          ) : (
            <span className="text-muted-foreground/50">
              {repositories.length === 0 ? 'No sources available' : 'Select a repository'}
            </span>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground/40 transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 w-full z-50 rounded-xl border border-border/60 bg-card shadow-xl overflow-hidden"
          >
            {repositories.map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => { onSelect(repo.id); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-muted/40',
                  repo.id === selectedId && 'bg-primary/6 text-primary'
                )}
              >
                <RepoStatusIcon status={repo.latest_index_status ?? undefined} />
                <span className="flex-1 truncate font-medium">{repo.repo_id}</span>
                {repo.id === selectedId && (
                  <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const capabilities = [
  { label: 'Explain Architecture', shortcut: '/', description: 'Full system walkthrough' },
  { label: 'Security Audit', shortcut: '!', description: 'Identify vulnerabilities' },
  { label: 'Refactor Suggestion', shortcut: '@', description: 'Improve code structure' },
  { label: 'Fix Bugs', shortcut: '#', description: 'Diagnose & solve errors' },
];

export function ChatContextSidebar({ repositories, selectedId, onSelect, isLoading }: ChatContextSidebarProps) {
  const selectedRepo = repositories.find((r) => r.id === selectedId);
  const isReady = selectedRepo?.latest_index_status?.toLowerCase() === 'completed';

  return (
    <div className="hidden lg:flex flex-col gap-4 w-[280px] shrink-0">
      {/* Context config */}
      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-premium">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20 bg-primary/4">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Knowledge Base</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
              Active Repository
            </label>
            <CustomSelect
              repositories={repositories}
              selectedId={selectedId}
              onSelect={onSelect}
              isLoading={isLoading}
            />
          </div>

          {selectedRepo && (
            <div className="rounded-xl border border-border/30 bg-muted/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  Branch
                </div>
                <code className="text-[11px] font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/20">
                  {selectedRepo.default_branch}
                </code>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  Status
                </div>
                <Badge variant={isReady ? 'success' : 'warning'} className="h-5 text-[9px]">
                  {isReady ? 'READY' : selectedRepo.latest_index_status?.toUpperCase() || 'NOT INDEXED'}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  Engine
                </div>
                <span className="text-[10px] font-bold text-primary">RAG·LangGraph</span>
              </div>
            </div>
          )}

          {!selectedRepo && !isLoading && (
            <div className="rounded-xl border border-dashed border-border/30 bg-muted/10 p-4 text-center">
              <Layers className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground/50 font-medium">
                Select a repository to start chatting
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Capabilities */}
      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-premium flex-1">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold tracking-tight">Capabilities</span>
        </div>
        <div className="p-4 space-y-2">
          {capabilities.map((item) => (
            <div
              key={item.label}
              className="group flex items-center justify-between rounded-xl px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
            >
              <div>
                <p className="text-[12px] font-semibold text-foreground/90">{item.label}</p>
                <p className="text-[10px] text-muted-foreground/50">{item.description}</p>
              </div>
              <kbd className="rounded-lg border border-border/40 bg-muted/40 px-2 py-1 text-[11px] font-bold shadow-sm group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                {item.shortcut}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
