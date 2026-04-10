'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0-100
  variant?: 'default' | 'success' | 'warning' | 'error' | 'ai';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showLabel?: boolean;
  label?: string;
}

export function Progress({
  value = 0,
  variant = 'default',
  size = 'md',
  animated = true,
  showLabel = false,
  label,
  className,
  ...props
}: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn('w-full space-y-1', className)} {...props}>
      {(showLabel || label) && (
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <span>{label ?? 'Progress'}</span>
          <span>{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-muted/40',
          size === 'sm' && 'h-1',
          size === 'md' && 'h-1.5',
          size === 'lg' && 'h-2.5',
        )}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            variant === 'default' && 'bg-primary',
            variant === 'success' && 'bg-success',
            variant === 'warning' && 'bg-warning',
            variant === 'error'   && 'bg-error',
            variant === 'ai'      && 'bg-gradient-to-r from-primary via-blue-400 to-indigo-500',
            animated && clampedValue < 100 && 'after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent after:animate-shimmer',
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
