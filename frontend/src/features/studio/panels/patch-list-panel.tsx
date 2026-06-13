import React from 'react';
import { useStudioStore } from '@/features/studio/store/studio-store';
import { usePatches, useDeletePatchMutation } from '@/features/repositories/hooks/use-repositories';
import { GitPullRequestDraft, Trash2, PlayCircle, CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PatchListPanelProps {
  /**
   * Optional click handler override.
   * When provided (e.g. in Studio canvas), called with the patch ID instead of
   * opening patch-review canvas mode via useStudioStore.
   */
  onPatchClick?: (patchId: string) => void;
}

export function PatchListPanel({ onPatchClick }: PatchListPanelProps = {}) {
  const { selectedRepositoryId, openPatchTab } = useStudioStore();
  const { data: patches, isLoading } = usePatches(selectedRepositoryId || '');

  if (!selectedRepositoryId) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-center">
        <p className="text-sm text-muted-foreground">Select a repository to view patches.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center h-full items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  if (!patches || patches.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
        <GitPullRequestDraft className="w-8 h-8 mb-3 opacity-20" />
        <p className="text-sm">No patches found for this repository.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {patches.map((patch) => (
        <PatchCard
          key={patch.id}
          patch={patch}
          onClick={() => {
            if (onPatchClick) {
              onPatchClick(patch.id);
            } else {
              openPatchTab(patch.id);
            }
          }}
        />
      ))}
    </div>
  );
}

function PatchCard({ patch, onClick }: { patch: any, onClick: () => void }) {
  const deleteMutation = useDeletePatchMutation(patch.repository_id);
  
  const isApplied = patch.status === 'APPLIED';
  const isFailed = patch.status === 'FAILED';
  const isReady = patch.status === 'READY';
  const isValidating = patch.status === 'VALIDATING' || patch.status === 'APPLYING';

  let Icon = GitPullRequestDraft;
  let iconClass = "text-muted-foreground";
  if (isApplied) {
    Icon = CheckCircle2;
    iconClass = "text-success";
  } else if (isFailed) {
    Icon = XCircle;
    iconClass = "text-destructive";
  } else if (isReady) {
    Icon = PlayCircle;
    iconClass = "text-primary";
  } else if (isValidating) {
    Icon = RefreshCw;
    iconClass = "text-blue-500 animate-spin";
  }

  return (
    <div 
      className="rounded-lg border bg-card p-4 shadow-sm space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconClass}`} />
          <h4 className="font-semibold text-sm truncate max-w-[150px]">
            {patch.id.split('-')[0]}
          </h4>
          <Badge variant={isApplied ? 'default' : isFailed ? 'destructive' : isReady ? 'secondary' : 'outline'} className="text-[10px] h-5 px-1.5 ml-2 uppercase">
            {patch.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {patch.created_at ? formatDistanceToNow(new Date(patch.created_at), { addSuffix: true }) : ''}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              deleteMutation.mutate(patch.id);
            }}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
