'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DashboardSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function DashboardSection({
  title,
  description,
  children,
  className,
  action,
}: DashboardSectionProps) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground lg:text-sm">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground font-light lg:text-base">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
