'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bot, FolderGit2, Search, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardQuickActionsProps {
  onAddRepository?: () => void;
}

const ACTIONS = [
  {
    id: 'chat',
    icon: Bot,
    label: 'Start AI Chat',
    description: 'Interrogate your indexed repositories',
    color: 'text-primary',
    gradient: 'from-primary/15 to-primary/5',
    borderColor: 'border-primary/20 hover:border-primary/40',
    glow: 'hover:shadow-glow-sm',
  },
  {
    id: 'repos',
    icon: FolderGit2,
    label: 'Add Repository',
    description: 'Connect a new codebase to index',
    color: 'text-warning',
    gradient: 'from-warning/15 to-warning/5',
    borderColor: 'border-warning/20 hover:border-warning/40',
    glow: 'hover:shadow-[0_0_20px_-8px_hsl(var(--warning)/0.45)]',
  },
  {
    id: 'search',
    icon: Search,
    label: 'Semantic Search',
    description: 'Hybrid search across your project',
    color: 'text-success',
    gradient: 'from-success/15 to-success/5',
    borderColor: 'border-success/20 hover:border-success/40',
    glow: 'hover:shadow-[0_0_20px_-8px_hsl(var(--success)/0.4)]',
  },
  {
    id: 'index',
    icon: Zap,
    label: 'Open Codebase',
    description: 'Launch the engineering workspace',
    color: 'text-ai',
    gradient: 'from-ai/15 to-ai/5',
    borderColor: 'border-ai/20 hover:border-ai/40',
    glow: 'hover:shadow-[0_0_20px_-8px_hsl(var(--ai)/0.4)]',
  },
] as const;

export function DashboardQuickActions({ onAddRepository }: DashboardQuickActionsProps) {
  const router = useRouter();

  const handleAction = (id: string) => {
    switch (id) {
      case 'chat':
        router.push('/studio');
        break;
      case 'repos':
        onAddRepository?.();
        break;
      case 'search':
        router.push('/studio?panel=search');
        break;
      case 'index':
        router.push('/studio');
        break;
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ACTIONS.map((action, i) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            id={`quick-action-${action.id}`}
            type="button"
            onClick={() => handleAction(action.id)}
            className={cn(
              'group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-300',
              'bg-card/60 backdrop-blur-xl hover:-translate-y-0.5 hover:bg-card/80',
              action.borderColor,
              action.glow,
              'animate-fade-up'
            )}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className={cn(
                'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/6 bg-gradient-to-br transition-all duration-300 group-hover:scale-110 lg:h-12 lg:w-12',
                action.gradient,
                action.color
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={cn('text-sm font-bold transition-colors lg:text-base', action.color)}>
                {action.label}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground transition-colors group-hover:text-foreground/70 lg:text-sm">
                {action.description}
              </p>
            </div>
            <ArrowRight
              className={cn(
                'h-4 w-4 shrink-0 opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100',
                action.color
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
