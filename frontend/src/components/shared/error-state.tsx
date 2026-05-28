import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-6">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 text-rose-500" />
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          {onRetry ? (
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
