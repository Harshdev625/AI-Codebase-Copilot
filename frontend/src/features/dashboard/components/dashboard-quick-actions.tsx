'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bot, FolderGit2, Search, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  color: string;
  gradient: string;
  borderColor: string;
  glow: string;
}

const ACTIONS: QuickAction[] = [
  {
    id: 'chat',
    icon: <Bot className="h-5 w-5" />,
    label: 'Start AI Chat',
    description: 'Ask questions about your codebase',
    href: '/chat',
    color: 'text-primary',
    gradient: 'from-primary/15 to-primary/5',
    borderColor: 'border-primary/20 hover:border-primary/40',
    glow: 'hover:shadow-glow-sm',
  },
  {
    id: 'repos',
    icon: <FolderGit2 className="h-5 w-5" />,
    label: 'Add Repository',
    description: 'Connect a new codebase to index',
    href: '/repositories',
    color: 'text-warning',
    gradient: 'from-warning/15 to-warning/5',
    borderColor: 'border-warning/20 hover:border-warning/40',
    glow: 'hover:shadow-[0_0_20px_-8px_hsl(var(--warning)/0.45)]',
  },
  {
    id: 'search',
    icon: <Search className="h-5 w-5" />,
    label: 'Search Code',
    description: 'Semantic search across files',
    href: '/chat',
    color: 'text-success',
    gradient: 'from-success/15 to-success/5',
    borderColor: 'border-success/20 hover:border-success/40',
    glow: 'hover:shadow-[0_0_20px_-8px_hsl(var(--success)/0.4)]',
  },
  {
    id: 'index',
    icon: <Zap className="h-5 w-5" />,
    label: 'Re-Index Repos',
    description: 'Sync changes to vector store',
    href: '/repositories',
    color: 'text-ai',
    gradient: 'from-ai/15 to-ai/5',
    borderColor: 'border-ai/20 hover:border-ai/40',
    glow: 'hover:shadow-[0_0_20px_-8px_hsl(var(--ai)/0.4)]',
  },
];

export function DashboardQuickActions() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-2.5">
      {ACTIONS.map((action, i) => (
        <button
          key={action.id}
          id={`quick-action-${action.id}`}
          onClick={() => router.push(action.href)}
          className={cn(
            'group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-300',
            'bg-card/80 hover:bg-card hover:-translate-y-0.5',
            action.borderColor,
            action.glow,
            'animate-fade-up'
          )}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Icon */}
          <div className={cn(
            'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br border border-white/6 transition-all duration-300 group-hover:scale-110',
            action.gradient,
            action.color
          )}>
            {action.icon}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className={cn('text-[13px] font-bold transition-colors', action.color)}>
              {action.label}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 group-hover:text-foreground/70 transition-colors">
              {action.description}
            </p>
          </div>

          {/* Arrow */}
          <ArrowRight className={cn(
            'h-3.5 w-3.5 shrink-0 transition-all duration-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1',
            action.color
          )} />
        </button>
      ))}
    </div>
  );
}
