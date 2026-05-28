'use client';

import * as React from 'react';
import {
  Database, GitBranch, ShieldCheck, Zap, Layers,
  ChevronDown, CheckCircle, Clock, XCircle,
} from 'lucide-react';
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

/* ── Repo status icon ─────────────────────────────────── */
function RepoStatusIcon({ status }: { status?: string }) {
  const s = (status ?? '').toLowerCase();
  if (s === 'completed') return <CheckCircle className="h-4 w-4 text-success" />;
  if (s === 'failed')    return <XCircle className="h-4 w-4 text-destructive" />;
  if (s === 'pending' || s === 'running')
    return <Clock className="h-4 w-4 text-warning animate-pulse" />;
  return <Clock className="h-4 w-4 text-muted-foreground/40" />;
}

/* ── Custom animated dropdown ─────────────────────────── */
function RepositoryDropdown({
  repositories, selectedId, onSelect, isLoading,
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
          'flex w-full items-center justify-between gap-2 rounded-xl border bg-input px-3.5 py-2.5 text-left transition-all',
          'text-[13px] font-medium focus:outline-none',
          open
            ? 'border-primary/40 shadow-[0_0_0_1px_primary/15,0_0_20px_-8px_primary/30]'
            : 'border-border/50 hover:border-primary/25 hover:shadow-[0_0_16px_-8px_primary/20]'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <RepoStatusIcon status={selected.latest_index_status ?? undefined} />
              <span className="truncate text-[13px] font-semibold text-foreground">{selected.repo_id}</span>
            </>
          ) : (
            <span className="text-muted-foreground/60 text-[12px]">
              {repositories.length === 0 ? 'No sources available' : 'Select a repository…'}
            </span>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-1 w-full z-50 rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden"
          >
            {repositories.map((repo) => (
              <button
                key={repo.id}
                type="button"
                onClick={() => { onSelect(repo.id); setOpen(false); }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[12px] font-medium transition-all',
                  repo.id === selectedId
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <RepoStatusIcon status={repo.latest_index_status ?? undefined} />
                <span className="flex-1 truncate">{repo.repo_id}</span>
                {repo.id === selectedId && <CheckCircle className="h-4 w-4 text-primary shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Capability shortcuts ─────────────────────────────── */
const CAPABILITIES = [
  { label: 'Explain Architecture', shortcut: '/', description: 'Full system walkthrough', color: 'text-primary bg-primary/8 border-primary/15 hover:bg-primary/15 hover:border-primary/40 hover:shadow-[0_0_12px_-4px_hsl(var(--primary)/0.4)]' },
  { label: 'Security Audit',       shortcut: '!', description: 'Identify vulnerabilities',  color: 'text-error bg-error/8 border-error/15 hover:bg-error/15 hover:border-error/40 hover:shadow-[0_0_12px_-4px_hsl(var(--error)/0.4)]' },
  { label: 'Refactor Suggestion',  shortcut: '@', description: 'Improve code structure',    color: 'text-ai bg-ai/8 border-ai/15 hover:bg-ai/15 hover:border-ai/40 hover:shadow-[0_0_12px_-4px_hsl(var(--ai)/0.4)]' },
  { label: 'Fix Bugs',             shortcut: '#', description: 'Diagnose & solve errors',   color: 'text-success bg-success/8 border-success/15 hover:bg-success/15 hover:border-success/40 hover:shadow-[0_0_12px_-4px_hsl(var(--success)/0.4)]' },
];

/* ── Main sidebar ─────────────────────────────────────── */
export function ChatContextSidebar({ repositories, selectedId, onSelect, isLoading }: ChatContextSidebarProps) {
  const selectedRepo = repositories.find((r) => r.id === selectedId);
  const isReady = selectedRepo?.latest_index_status?.toLowerCase() === 'completed';

  return (
    <div className="hidden lg:flex flex-col gap-4 w-[280px] shrink-0">

      {/* Knowledge Base card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-premium">
        {/* Gradient header */}
        <div className="relative flex items-center gap-2.5 px-4 py-3.5 border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/8 to-transparent" />
          <div className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 border border-primary/20">
            <Database className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Knowledge Base</span>

          {/* Shimmer line */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-px shimmer opacity-40" />
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Active Repository
            </label>
            <RepositoryDropdown
              repositories={repositories}
              selectedId={selectedId}
              onSelect={onSelect}
              isLoading={isLoading}
            />
          </div>

          {selectedRepo && (
            <div className="rounded-2xl border border-border/60 bg-background/70 p-3.5 space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  Branch
                </div>
                <code className="text-[10px] font-semibold text-muted-foreground bg-background/70 px-2 py-0.5 rounded-lg border border-border/60">
                  {selectedRepo.default_branch}
                </code>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <ShieldCheck className="h-3 w-3" />
                  Status
                </div>
                <Badge variant={isReady ? 'success' : 'warning'} className="h-5 text-[8px] font-bold uppercase tracking-wider">
                  {isReady ? 'READY' : selectedRepo.latest_index_status?.toUpperCase() || 'NOT INDEXED'}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  Engine
                </div>
                <span className="text-[10px] font-semibold text-primary">RAG · LangGraph</span>
              </div>
            </div>
          )}

          {!selectedRepo && !isLoading && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/50 p-5 text-center">
              <Layers className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-[10px] text-muted-foreground font-medium">
                Select a repository to start chatting
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Capabilities card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-premium flex-1">
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border/50">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-background/70 border border-border/60">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Capabilities</span>
        </div>

        <div className="p-3 space-y-1.5">
          {CAPABILITIES.map((item) => (
            <div
              key={item.label}
              className={cn(
                'group flex items-center justify-between rounded-xl border px-3 py-2.5 cursor-pointer transition-all duration-250',
                item.color
              )}
            >
              <div>
                <p className="text-[11px] font-semibold text-foreground/90">{item.label}</p>
                <p className="text-[9px] text-muted-foreground">{item.description}</p>
              </div>
              <kbd className={cn(
                'rounded-lg border px-2 py-1 text-[11px] font-bold shadow-sm transition-all duration-250',
                item.color
              )}>
                {item.shortcut}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
