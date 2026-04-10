'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Bot, FolderGit2, LayoutDashboard } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageTransition } from '@/components/layout/page-transition';

const userNavItems = [
  { label: 'Dashboard',    href: '/dashboard',    icon: LayoutDashboard },
  { label: 'Repositories', href: '/repositories', icon: FolderGit2 },
  { label: 'Chat',         href: '/chat',         icon: Bot },
];

/** Chat page needs full-viewport layout — no padding wrapper */
const FULL_BLEED_ROUTES = ['/chat'];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = FULL_BLEED_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <AppShell
      title="AI Codebase Copilot"
      items={userNavItems}
      variant={isFullBleed ? 'fullBleed' : 'default'}
    >
      <PageTransition>
        {children}
      </PageTransition>
    </AppShell>
  );
}
