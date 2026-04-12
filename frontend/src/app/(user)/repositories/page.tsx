'use client';

import * as React from 'react';
import {
  LayoutGrid, List, RefreshCw, Plus, GitBranch,
  Database, FolderKanban, Calendar, Loader2, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RepositoryAddForm } from '@/features/repositories/components/repository-add-form';
import { RepositoryItemCard } from '@/features/repositories/components/repository-item-card';
import { useRepositories, useProjects, useCreateProject } from '@/features/repositories/hooks/use-repositories';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

/* ── Project tab pill ─────────────────────────────────── */
function ProjectTab({
  name,
  date,
  isActive,
  onClick,
}: {
  name: string;
  date: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-left transition-all duration-200 shrink-0',
        isActive
          ? 'bg-violet-500/10 border-violet-500/30 text-violet-300 shadow-[0_0_16px_-6px_hsl(265,80%,65%,0.4)]'
          : 'bg-[hsl(240,18%,8%)] border-white/6 text-zinc-500 hover:bg-[hsl(240,18%,10%)] hover:border-white/10 hover:text-zinc-300'
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-gradient-to-b from-violet-400 to-indigo-500 shadow-[0_0_6px_2px_hsl(265,80%,65%,0.5)]" />
      )}
      <FolderKanban className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-violet-400' : 'text-zinc-600')} />
      <div className="min-w-0">
        <p className="text-[12px] font-bold leading-none truncate max-w-[120px]">{name}</p>
        <p className="text-[9px] font-medium text-zinc-700 mt-0.5 flex items-center gap-1">
          <Calendar className="h-2 w-2" />
          {formatDate(date)}
        </p>
      </div>
      {isActive && <div className="ml-1 h-1.5 w-1.5 rounded-full bg-violet-400" />}
    </button>
  );
}

/* ── New project mini-form ─────────────────────────────── */
function NewProjectForm({ onCancel }: { onCancel: () => void }) {
  const createProjectMutation = useCreateProject();
  const [name, setName] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProjectMutation.mutate({ name: name.trim() }, {
      onSuccess: () => { setName(''); onCancel(); },
    });
  };

  return (
    <motion.form
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/6 px-3 py-2"
    >
      <FolderKanban className="h-3.5 w-3.5 text-violet-400 shrink-0" />
      <Input
        autoFocus
        placeholder="Project name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-7 text-[12px] border-none bg-transparent focus-visible:ring-0 p-0 text-zinc-200 placeholder:text-zinc-600"
      />
      <Button type="submit" size="icon-sm" disabled={createProjectMutation.isPending || !name.trim()}
        className="h-7 w-7 rounded-lg bg-violet-600 hover:bg-violet-500 border-0 shrink-0">
        {createProjectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
      </Button>
      <button type="button" onClick={onCancel}
        className="text-[9px] font-bold text-zinc-600 hover:text-zinc-400 uppercase tracking-wide shrink-0">
        cancel
      </button>
    </motion.form>
  );
}

/* ── Repositories page ────────────────────────────────── */
export default function RepositoriesPage() {
  const { projects, isLoading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [showNewProject, setShowNewProject] = React.useState(false);

  const { repositories, isLoading, refetch } = useRepositories(selectedProjectId);

  React.useEffect(() => {
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  return (
    <div className="flex flex-col gap-8 animate-fade-up">

      {/* ── Page header ──────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/6 bg-[hsl(240,18%,6%)] p-7 shadow-premium">
        {/* Mesh BG */}
        <div className="pointer-events-none absolute inset-0 mesh-gradient" />
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-10" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-[60px]" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative h-11 w-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center">
              <Database className="h-5 w-5 text-indigo-400" />
              <div className="absolute inset-0 rounded-2xl bg-indigo-500/10 blur-lg -z-10" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-indigo-400/70">Source Control</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white/90">Repositories</h1>
              <p className="text-[12px] text-zinc-500 mt-0.5 max-w-md">
                Connect, index, and manage code repositories for AI-powered analysis.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* View toggle */}
            <div className="flex items-center rounded-xl bg-white/3 p-1 border border-white/6">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7 rounded-lg"
                onClick={() => setViewMode('list')}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isLoading}
              className="h-9 border-white/8 bg-white/3 text-zinc-400 hover:text-white hover:bg-white/6 text-[11px] font-bold tracking-wide"
            >
              <RefreshCw className={cn('mr-2 h-3.5 w-3.5', isLoading && 'animate-spin')} />
              Sync
            </Button>
          </div>
        </div>
      </div>

      {/* ── Project selector bar ─────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-3.5 w-3.5 text-zinc-600" />
          <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-600">Projects</span>
          <div className="flex-1 h-px bg-gradient-to-r from-white/6 to-transparent" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNewProject(!showNewProject)}
            className="h-7 px-3 text-[10px] font-bold text-zinc-600 hover:text-violet-400 hover:bg-violet-500/8 rounded-lg gap-1.5"
          >
            <Plus className="h-3 w-3" />
            New Project
          </Button>
        </div>

        <div className="flex items-start gap-2 flex-wrap">
          <AnimatePresence>
            {showNewProject && (
              <NewProjectForm onCancel={() => setShowNewProject(false)} />
            )}
          </AnimatePresence>

          {projectsLoading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-36 rounded-xl bg-white/3 animate-pulse" />
            ))
          ) : projects.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-white/8 px-4 py-3 text-[11px] text-zinc-700">
              <FolderKanban className="h-4 w-4" />
              No projects yet — create your first one above
            </div>
          ) : (
            projects.map((project) => (
              <ProjectTab
                key={project.id}
                name={project.name}
                date={project.created_at}
                isActive={selectedProjectId === project.id}
                onClick={() => setSelectedProjectId(project.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Add repository form ──────────────────────────── */}
      <div>
        <RepositoryAddForm projectId={selectedProjectId} />
      </div>

      {/* ── Repository list / grid ───────────────────────── */}
      <div>
        {/* Section header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/30 to-transparent" />
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600">
            {isLoading
              ? 'Loading…'
              : `${repositories.length} ${repositories.length === 1 ? 'Repository' : 'Repositories'}`
            }
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-indigo-500/30 to-transparent" />
        </div>

        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-52 rounded-3xl bg-white/3" />
            ))}
          </div>
        ) : repositories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed border-white/6 bg-[hsl(240,18%,6%)] gap-5">
            <div className="relative">
              <div className="absolute inset-0 blur-2xl rounded-full bg-indigo-500/10 animate-glow-pulse" />
              <div className="relative h-14 w-14 rounded-2xl bg-[hsl(240,18%,9%)] border border-white/6 flex items-center justify-center">
                <GitBranch className="h-6 w-6 text-zinc-700" />
              </div>
            </div>
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-zinc-600">No repositories yet</p>
              <p className="text-[11px] text-zinc-800 mt-1">
                {selectedProjectId ? 'Connect a repository above to start indexing.' : 'Select a project first.'}
              </p>
            </div>
          </div>
        ) : (
          <div className={cn(
            viewMode === 'grid'
              ? 'grid gap-5 md:grid-cols-2 xl:grid-cols-3'
              : 'flex flex-col gap-4'
          )}>
            {repositories.map((repo, i) => (
              <motion.div
                key={repo.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <RepositoryItemCard repository={repo} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
