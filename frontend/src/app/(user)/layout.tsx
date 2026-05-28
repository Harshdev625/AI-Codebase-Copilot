'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { PageTransition } from '@/components/layout/page-transition';

/** Chat page needs full-viewport layout — no padding wrapper */
const FULL_BLEED_ROUTES = ['/chat'];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullBleed = FULL_BLEED_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <AppShell title="AI Codebase Copilot" variant={isFullBleed ? 'fullBleed' : 'default'}>
      <PageTransition>
        {children}
      </PageTransition>
    </AppShell>
  );
}
