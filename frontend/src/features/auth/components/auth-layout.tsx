'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Command, Menu } from 'lucide-react';
import { motion } from 'framer-motion';

import { ThemeToggle } from '@/components/shared/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { pathnameToAuthPage } from '@/features/auth/content/auth-copy';
import { AuthFooter } from './auth-footer';
import { AuthMarketing } from './auth-marketing';

interface AuthLayoutProps {
  children: React.ReactNode;
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/80 via-violet-50/50 to-sky-50/60 dark:from-[#111318] dark:via-[#0f1117] dark:to-[#131620]" />
      <motion.div
        className="absolute -left-[8%] top-[10%] h-[min(420px,50vh)] w-[min(420px,50vh)] rounded-full bg-indigo-400/15 blur-[120px] dark:bg-indigo-500/12"
        animate={{ x: [0, 30, 0], y: [0, 18, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-[8%] top-[18%] h-[min(320px,40vh)] w-[min(320px,40vh)] rounded-full bg-violet-400/12 blur-[100px] dark:bg-primary/10"
        animate={{ x: [0, -24, 0], y: [0, 14, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute bottom-[15%] left-[40%] h-[min(280px,35vh)] w-[min(280px,35vh)] rounded-full bg-sky-300/10 blur-[100px] dark:bg-cyan-500/8"
        animate={{ x: [0, -18, 0], y: [0, -12, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />
      <div className="noise-overlay absolute inset-0 opacity-50 dark:opacity-35" />
    </div>
  );
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const pathname = usePathname();
  const page = pathnameToAuthPage(pathname);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden text-foreground selection:bg-primary/30">
      <AmbientBackground />

      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-indigo-200/30 bg-white/70 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02] sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open product features"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-lg shadow-primary/20">
            <Command className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">
              AI Codebase Copilot
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              Developer Edition
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6 sm:px-6 lg:py-10">
        <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14 xl:max-w-7xl xl:gap-20">
          <AuthMarketing page={page} className="hidden lg:flex" />
          <div className="w-full max-w-[480px] justify-self-center sm:max-w-[520px] lg:max-w-[520px] lg:justify-self-end">
            <React.Suspense
              fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted/20" />}
            >
              {children}
            </React.Suspense>
          </div>
        </div>
      </main>

      <AuthFooter />

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent
          showCloseButton
          className="left-0 top-0 h-[100dvh] max-h-[100dvh] w-[min(100vw,22rem)] max-w-[min(100vw,22rem)] translate-x-0 translate-y-0 rounded-none border-r border-white/10 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:rounded-none"
        >
          <DialogHeader>
            <DialogTitle className="text-left font-display text-lg">Platform Features</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto pr-1">
            <AuthMarketing page={page} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
