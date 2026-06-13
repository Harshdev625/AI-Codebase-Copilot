'use client';

import * as React from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { PageTransition } from '@/components/layout/page-transition';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell title="Admin Control">
      <PageTransition>{children}</PageTransition>
    </AppShell>
  );
}
