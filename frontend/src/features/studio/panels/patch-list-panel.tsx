import React from 'react';
import { useStudioStore } from '@/features/studio/store/studio-store';
import { usePatches, useDeletePatchMutation } from '@/features/repositories/hooks/use-repositories';
import { GitPullRequestDraft, Trash2, PlayCircle, CheckCircle2, XCircle, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PatchListPanelProps {
  onPatchClick?: (patchId: string) => void;
}

function normalisePatchStatus(status: string) {
  return {
    isDraft: status === 'DRAFT',
    isReview: status === 'REVIEW' || status === 'VALIDATING',
    isApproved: status === 'APPROVED' || status === 'READY',
    isRejected: status === 'REJECTED',
    isApplying: status === 'APPLYING',
    isApplied: status === 'APPLIED',
    isFailed: status === 'FAILED',
    isConflicted: status === 'CONFLICTED',
  };
}

function patchStatusLabel(status: string): string {
  const n = normalisePatchStatus(status);
  if (n.isReview) return 'Validating';
  if (n.isApproved) return 'Ready';
  if (n.isApplying) return 'Applying';
  if (n.isApplied) return 'Applied';
  if (n.isFailed) return 'Failed';
  if (n.isRejected) return 'Rejected';
  if (n.isConflicted) return 'Conflicted';
  if (n.isDraft) return 'Draft';
  return status;
}

function patchStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const n = normalisePatchStatus(status);
  if (n.isApplied) return 'default';
  if (n.isFailed || n.isRejected || n.isConflicted) return 'destructive';
  if (n.isApproved) return 'secondary';
  return 'outline';
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
              openPatchTab(patch.id, patch.title || patch.summary);
            }
          }}
        />
      ))}
    </div>
  );
}

function PatchCard({ patch, onClick }: { patch: any, onClick: () => void }) {
  const deleteMutation = useDeletePatchMutation(patch.repository_id);
  const n = normalisePatchStatus(patch.status);

  let Icon = GitPullRequestDraft;
  let iconClass = "text-muted-foreground";
  if (n.isApplied) {
    Icon = CheckCircle2;
    iconClass = "text-success";
  } else if (n.isFailed || n.isRejected || n.isConflicted) {
    Icon = n.isConflicted ? AlertTriangle : XCircle;
    iconClass = "text-destructive";
  } else if (n.isApproved) {
    Icon = PlayCircle;
    iconClass = "text-primary";
  } else if (n.isReview || n.isApplying) {
    Icon = RefreshCw;
    iconClass = "text-blue-500 animate-spin";
  }

  const title = patch.title || patch.summary || `Patch ${patch.id.split('-')[0]}`;

  return (
    <div
      className="rounded-lg border bg-card p-4 shadow-sm space-y-3 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${iconClass}`} />
          <h4 className="font-semibold text-sm truncate" title={title}>
            {title}
          </h4>
          <Badge
            variant={patchStatusVariant(patch.status)}
            className="text-[10px] h-5 px-1.5 ml-1 uppercase shrink-0"
          >
            {patchStatusLabel(patch.status)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
      {patch.summary && patch.title && (
        <p className="text-xs text-muted-foreground line-clamp-2">{patch.summary}</p>
      )}
    </div>
  );
}
