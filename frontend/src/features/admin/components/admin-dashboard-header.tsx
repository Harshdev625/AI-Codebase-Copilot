'use client';

import { RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminDashboardHeaderProps {
  onRefresh: () => void;
}

export function AdminDashboardHeader({ onRefresh }: AdminDashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-[0_0_30px_rgba(var(--primary),0.3)] lg:h-14 lg:w-14">
          <ShieldCheck className="h-6 w-6 lg:h-7 lg:w-7" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
            Admin Control
          </h1>
          <p className="text-sm font-medium text-muted-foreground lg:text-base">
            Platform telemetry, repositories, and user access.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        onClick={onRefresh}
        className="gap-2 border-border/40 bg-card/40 text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-muted/50"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh Data
      </Button>
    </header>
  );
}
