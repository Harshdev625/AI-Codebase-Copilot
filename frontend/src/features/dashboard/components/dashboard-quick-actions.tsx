'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bot, FolderGit2, Search, Zap, ArrowRight } from 'lucide-react';
import { Surface } from '@/components/ui/surface';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const actions: QuickAction[] = [
  {
    id: 'chat',
    icon: <Bot className="h-5 w-5" />,
    label: 'Start AI Chat',
    description: 'Ask questions about your codebase',
    href: '/chat',
    color: 'text-primary',
    bgColor: 'bg-primary/8',
    borderColor: 'border-primary/20 hover:border-primary/40',
  },
  {
    id: 'repos',
    icon: <FolderGit2 className="h-5 w-5" />,
    label: 'Add Repository',
    description: 'Connect a new codebase to index',
    href: '/repositories',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/8',
    borderColor: 'border-indigo-500/20 hover:border-indigo-500/40',
  },
  {
    id: 'search',
    icon: <Search className="h-5 w-5" />,
    label: 'Search Code',
    description: 'Semantic search across all files',
    href: '/chat',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/8',
    borderColor: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
  {
    id: 'index',
    icon: <Zap className="h-5 w-5" />,
    label: 'Re-Index Repos',
    description: 'Sync latest changes to vector store',
    href: '/repositories',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/8',
    borderColor: 'border-amber-500/20 hover:border-amber-500/40',
  },
];

export function DashboardQuickActions() {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold tracking-tight">Quick Actions</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => router.push(action.href)}
            className={cn(
              'group flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5',
              action.borderColor,
              'bg-card hover:bg-card/80'
            )}
          >
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', action.bgColor, action.color)}>
              {action.icon}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {action.label}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60 leading-snug">
                {action.description}
              </p>
            </div>
            <ArrowRight className={cn('h-3.5 w-3.5 transition-all opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5', action.color)} />
          </button>
        ))}
      </div>
    </div>
  );
}
