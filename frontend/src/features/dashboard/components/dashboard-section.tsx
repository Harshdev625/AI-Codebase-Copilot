'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { DASHBOARD_SECTION_TITLE } from '@/components/layout/nav-tokens';

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
          <h2 className={DASHBOARD_SECTION_TITLE}>{title}</h2>
          {description && (
            <p className="text-sm font-light text-muted-foreground xl:text-base">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
