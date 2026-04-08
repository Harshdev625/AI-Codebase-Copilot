import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <div className="mt-5">
          <Button variant="secondary" onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}
