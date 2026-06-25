'use client';

import { Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { ServiceHealth } from '@/features/admin/services/admin-service';

interface AdminHealthListProps {
  health: ServiceHealth[];
  isLoading?: boolean;
}

export function AdminHealthList({ health, isLoading }: AdminHealthListProps) {
  if (isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  const allOnline = health.every((item) => item.status === 'online');

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/60 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-semibold text-foreground lg:text-sm">
          <Server className="h-4 w-4 text-primary" />
          System Health
        </h2>
        <Badge variant={allOnline ? 'success' : 'warning'} className="shadow-lg">
          {allOnline ? 'All Systems Go' : 'Degraded'}
        </Badge>
      </div>
      <div className="mt-1 space-y-2">
        {health.map((item) => (
          <div
            key={item.name}
            className="group flex items-center justify-between rounded-xl border border-border/40 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2">
                {item.status === 'online' && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${item.status === 'online' ? 'bg-success' : 'bg-destructive'}`}
                />
              </span>
              <span className="text-sm font-medium text-foreground">{item.name}</span>
            </div>
            <span className="text-xs text-muted-foreground transition-colors group-hover:text-foreground/80">
              {item.detail || 'Healthy'}
            </span>
          </div>
        ))}
        {health.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No health data available.</p>
        )}
      </div>
    </div>
  );
}
