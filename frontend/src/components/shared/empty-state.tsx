import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-muted/10 p-12 text-center animate-fade-in',
      className
    )}>
      {Icon && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40 border border-border/40 shadow-inner">
          <Icon className="h-6 w-6 text-muted-foreground/50" />
        </div>
      )}
      <h3 className="text-base font-bold tracking-tight text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>

      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <div className="mt-6 flex items-center gap-3">
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="outline" onClick={onSecondaryAction} size="sm">
              {secondaryActionLabel}
            </Button>
          )}
          {actionLabel && onAction && (
            <Button onClick={onAction} size="sm" className="shadow-sm shadow-primary/20">
              {actionLabel}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
