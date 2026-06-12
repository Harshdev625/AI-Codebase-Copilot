'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type AdminTabId = 'overview' | 'repositories' | 'users';

interface AdminTab {
  id: AdminTabId;
  label: string;
  icon: LucideIcon;
}

interface AdminTabBarProps {
  tabs: AdminTab[];
  activeTab: AdminTabId;
  onChange: (tab: AdminTabId) => void;
}

export function AdminTabBar({ tabs, activeTab, onChange }: AdminTabBarProps) {
  return (
    <div className="w-full overflow-x-auto pb-1 snap-x snap-mandatory">
      <div className="flex w-max min-w-full gap-1 rounded-xl border border-border/40 bg-card/60 p-1 backdrop-blur-md sm:w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex shrink-0 snap-start items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="admin-active-tab"
                className="absolute inset-0 rounded-lg border border-border/50 bg-muted shadow-sm"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <tab.icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10 whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
