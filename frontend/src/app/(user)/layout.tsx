'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { PageTransition } from '@/components/layout/page-transition';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullViewportRoute = pathname.startsWith('/studio');

  const variant = isFullViewportRoute ? "studio" : "default";

  const pageContent = isFullViewportRoute ? (
    children
  ) : (
    <PageTransition>{children}</PageTransition>
  );

  return (
    <AppShell title="AI Codebase Copilot" variant={variant}>
      {pageContent}
    </AppShell>
  );
}
