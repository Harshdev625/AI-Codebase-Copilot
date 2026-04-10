'use client';

import * as React from 'react';
import { useProjects, useCreateProject } from '../hooks/use-repositories';
import { Plus, FolderKanban, Loader2, Calendar, FolderGit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatDate } from '@/lib/utils';

interface ProjectSidebarProps {
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
}

export function RepositoryProjectSidebar({ selectedProjectId, onSelectProject }: ProjectSidebarProps) {
  const { projects, isLoading } = useProjects();
  const createProjectMutation = useCreateProject();
  const [newProjectName, setNewProjectName] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    createProjectMutation.mutate({ name: newProjectName.trim() }, {
      onSuccess: () => {
        setNewProjectName('');
        setIsCreating(false);
      },
    });
  };

  return (
    <aside className="space-y-4 w-full lg:w-[280px] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <FolderKanban className="h-3.5 w-3.5 text-primary" />
          Projects
        </h4>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsCreating(!isCreating)}
          className="text-muted-foreground hover:text-primary"
          title="New project"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Project list */}
      <div className="space-y-1">
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/20 animate-pulse" />
          ))
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-border/40 bg-muted/10">
            <FolderGit2 className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs font-semibold text-muted-foreground/60">No projects yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-2 text-[10px] font-bold text-primary hover:underline"
            >
              Create your first project
            </button>
          </div>
        ) : (
          projects.map((project) => {
            const isActive = selectedProjectId === project.id;
            return (
              <button
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className={cn(
                  'w-full flex flex-col items-start px-4 py-3 rounded-xl transition-all duration-200 border text-left group',
                  isActive
                    ? 'bg-primary/8 border-primary/20 text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:border-border/30'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={cn('text-sm font-bold', isActive ? 'text-primary' : '')}>
                    {project.name}
                  </span>
                  {isActive && (
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-[9px] opacity-50 flex items-center gap-1 mt-1 font-semibold uppercase tracking-wider">
                  <Calendar className="h-2.5 w-2.5" />
                  {formatDate(project.created_at)}
                </span>
              </button>
            );
          })
        )}

        {/* New project form */}
        {isCreating && (
          <form onSubmit={handleCreateProject} className="mt-3 animate-fade-in">
            <div className="rounded-xl border border-primary/20 bg-primary/4 p-3 space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-widest text-primary/70">New Project Name</label>
              <div className="flex items-center gap-2">
                <Input
                  autoFocus
                  placeholder="e.g. Backend Services"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="h-8 text-xs bg-background/60 border-border/50 focus:border-primary/50"
                />
                <Button
                  type="submit"
                  size="icon-sm"
                  disabled={createProjectMutation.isPending || !newProjectName.trim()}
                  className="shrink-0"
                >
                  {createProjectMutation.isPending
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Plus className="h-3.5 w-3.5" />
                  }
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-[9px] text-muted-foreground hover:text-foreground font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
