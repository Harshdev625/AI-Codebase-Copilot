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
    color: 'text-violet-400',
    gradient: 'from-violet-500/15 to-violet-600/5',
    borderColor: 'border-violet-500/15 hover:border-violet-500/40',
    glow: 'hover:shadow-[0_0_20px_-8px_hsl(265,80%,65%,0.6)]',
  },
  {
    id: 'repos',
    icon: <FolderGit2 className="h-5 w-5" />,
    label: 'Add Repository',
    description: 'Connect a new codebase to index',
    href: '/repositories',
    color: 'text-indigo-400',
    gradient: 'from-indigo-500/15 to-indigo-600/5',
    borderColor: 'border-indigo-500/15 hover:border-indigo-500/40',
    glow: 'hover:shadow-[0_0_20px_-8px_hsl(240,80%,65%,0.6)]',
  },
  {
    id: 'search',
    icon: <Search className="h-5 w-5" />,
    label: 'Search Code',
    description: 'Semantic search across files',
    href: '/chat',
    color: 'text-emerald-400',
    gradient: 'from-emerald-500/15 to-emerald-600/5',
    borderColor: 'border-emerald-500/15 hover:border-emerald-500/40',
    glow: 'hover:shadow-[0_0_20px_-8px_hsl(142,65%,45%,0.6)]',
  },
  {
    id: 'index',
    icon: <Zap className="h-5 w-5" />,
    label: 'Re-Index Repos',
    description: 'Sync changes to vector store',
    href: '/repositories',
    color: 'text-amber-400',
    gradient: 'from-amber-500/15 to-amber-600/5',
    borderColor: 'border-amber-500/15 hover:border-amber-500/40',
    glow: 'hover:shadow-[0_0_20px_-8px_hsl(38,92%,50%,0.6)]',
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
            'bg-[hsl(240,18%,7%)] hover:bg-[hsl(240,18%,8%)] hover:-translate-y-0.5',
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
            <p className="text-[11px] text-zinc-600 leading-snug mt-0.5 group-hover:text-zinc-500 transition-colors">
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
