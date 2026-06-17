import React from 'react';
import { useStudioStore } from '@/features/studio/store/studio-store';
import { usePatch, useValidatePatchMutation, useApplyPatchMutation, useDeletePatchMutation } from '@/features/repositories/hooks/use-repositories';
import { Button } from '@/components/ui/button';
import { Loader2, PlayCircle, CheckCircle2, XCircle, AlertCircle, RefreshCw, Trash2, GitCommit, FileCode2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MonacoDiffViewer } from './monaco-diff-viewer';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Backend status vocabulary (what the server actually stores and returns):
//   DRAFT       - patch created, not yet validated
//   REVIEW      - validation in progress (synchronous, brief)
//   APPROVED    - validation passed, ready to apply
//   REJECTED    - validation failed
//   APPLYING    - apply in progress (if async)
//   APPLIED     - successfully applied to the codebase
//   FAILED      - apply step failed (unexpected error during apply)
//   CONFLICTED  - apply blocked because HEAD drifted since the patch was created
//
// Legacy frontend-only status names that may appear in older persisted rows:
//   VALIDATING → treated as REVIEW
//   READY      → treated as APPROVED
//
// This component normalises all statuses into the display booleans below so
// that none of the JSX needs to reason about raw status strings.
// ---------------------------------------------------------------------------

function normalise(status: string) {
  return {
    isDraft:      status === 'DRAFT',
    isReview:     status === 'REVIEW'      || status === 'VALIDATING',
    isApproved:   status === 'APPROVED'    || status === 'READY',
    isRejected:   status === 'REJECTED',
    isApplying:   status === 'APPLYING',
    isApplied:    status === 'APPLIED',
    isFailed:     status === 'FAILED',
    isConflicted: status === 'CONFLICTED',
  };
}

export function PatchReviewEditor({
  patchId,
  onClose,
}: {
  patchId: string;
  /** Optional close handler. When provided, used instead of default canvas navigation. */
  onClose?: () => void;
}) {
  const { selectedRepositoryId, closeTab, activeTabId, openWelcomeTab } = useStudioStore();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (activeTabId) {
      closeTab(activeTabId);
    } else {
      openWelcomeTab();
    }
  };
  const repoId = selectedRepositoryId || '';
  const { data: patch, isLoading } = usePatch(repoId, patchId);
  const validateMutation = useValidatePatchMutation(repoId);
  const applyMutation = useApplyPatchMutation(repoId);
  const deleteMutation = useDeletePatchMutation(repoId);

  const [selectedFileIndex, setSelectedFileIndex] = React.useState(0);

  if (isLoading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!patch) {
    return (
      <div className="flex-1 h-full flex items-center justify-center p-8">
        <p className="text-muted-foreground">Patch not found.</p>
      </div>
    );
  }

  const {
    isDraft, isReview, isApproved, isRejected,
    isApplying, isApplied, isFailed, isConflicted,
  } = normalise(patch.status);

  const files = patch.patch_files || [];
  const selectedFile = files[selectedFileIndex];

  const handleValidate = () => validateMutation.mutate(patchId);
  const handleApply   = () => applyMutation.mutate(patchId);
  const handleDelete  = () => {
    deleteMutation.mutate(patchId, {
      onSuccess: () => {
        handleClose();
      },
    });
  };

  // Badge variant for the status pill in the header
  const badgeVariant = isApplied
    ? 'default'
    : (isRejected || isFailed || isConflicted)
    ? 'destructive'
    : isApproved
    ? 'secondary'
    : 'outline';

  // Displayed status label — maps backend names to user-friendly text
  const statusLabel: Record<string, string> = {
    DRAFT:      'Draft',
    REVIEW:     'Validating',
    VALIDATING: 'Validating',
    APPROVED:   'Ready',
    READY:      'Ready',
    REJECTED:   'Rejected',
    APPLYING:   'Applying',
    APPLIED:    'Applied',
    FAILED:     'Failed',
    CONFLICTED: 'Conflicted',
  };

  return (
    <div className="flex-1 h-full flex flex-col min-w-0 bg-background">
      {/* ------------------------------------------------------------------ */}
      {/* Header: title + status badge + action buttons                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between p-4 border-b bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Patch Review</h2>
          <Badge
            variant={badgeVariant}
            className={cn(
              "uppercase",
              isConflicted && "bg-yellow-500/15 text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/20"
            )}
          >
            {statusLabel[patch.status] ?? patch.status}
          </Badge>
          <span className="text-sm text-muted-foreground font-mono">{patch.id.split('-')[0]}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Validate — available from DRAFT, REJECTED, FAILED, or CONFLICTED */}
          {(isDraft || isRejected || isFailed || isConflicted) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleValidate}
              disabled={validateMutation.isPending || applyMutation.isPending}
            >
              {validateMutation.isPending
                ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                : <PlayCircle className="w-4 h-4 mr-2" />}
              {isConflicted ? 'Re-validate' : 'Validate'}
            </Button>
          )}

          {/* Apply — available when validation passed (APPROVED / READY) */}
          {isApproved && (
            <Button
              variant="default"
              size="sm"
              onClick={handleApply}
              disabled={applyMutation.isPending}
            >
              {applyMutation.isPending
                ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Apply Patch
            </Button>
          )}

          {/* Validation / apply in progress — show spinner, no action */}
          {(isReview || isApplying) && (
            <Button variant="outline" size="sm" disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isReview ? 'Validating…' : 'Applying…'}
            </Button>
          )}

          {/* Delete — available for any non-applied, non-in-progress state */}
          {!isApplied && !isApplying && !isReview && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CONFLICTED banner                                                    */}
      {/* ------------------------------------------------------------------ */}
      {isConflicted && (
        <div className="flex items-start gap-3 px-5 py-3 bg-yellow-500/10 border-b border-yellow-500/30 shrink-0">
          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-yellow-400">Patch conflict detected.</span>
            <span className="text-muted-foreground ml-1">
              The repository has changed since this patch was created. Click{' '}
              <strong className="text-foreground">Re-validate</strong> to re-run the validation against
              the current HEAD, or <strong className="text-foreground">Delete</strong> and ask the AI to
              regenerate the patch.
            </span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Lifecycle stepper                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-muted/5 border-b border-border/50 px-6 py-3 flex items-center justify-between overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider min-w-max">

          {/* Step 1: Draft */}
          <div className={cn(
            "flex items-center gap-1.5",
            isDraft ? "text-primary" : "text-muted-foreground"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isDraft ? "bg-primary animate-pulse" : "bg-success"
            )} />
            Draft
          </div>

          <div className="w-8 h-px bg-border/50 mx-1" />

          {/* Step 2: Validating */}
          <div className={cn(
            "flex items-center gap-1.5",
            isReview
              ? "text-primary"
              : (isApproved || isRejected || isApplying || isApplied || isFailed || isConflicted)
              ? "text-muted-foreground"
              : "text-muted-foreground/30"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isReview
                ? "bg-primary animate-pulse"
                : isRejected
                ? "bg-destructive"
                : (isApproved || isApplying || isApplied || isFailed || isConflicted)
                ? "bg-success"
                : "bg-muted"
            )} />
            Validating
          </div>

          <div className="w-8 h-px bg-border/50 mx-1" />

          {/* Step 3: Ready / Rejected */}
          <div className={cn(
            "flex items-center gap-1.5",
            isApproved
              ? "text-primary"
              : isRejected
              ? "text-destructive"
              : (isApplying || isApplied || isFailed || isConflicted)
              ? "text-muted-foreground"
              : "text-muted-foreground/30"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isApproved
                ? "bg-primary"
                : isRejected
                ? "bg-destructive"
                : (isApplying || isApplied || isFailed || isConflicted)
                ? "bg-success"
                : "bg-muted"
            )} />
            {isRejected ? 'Rejected' : 'Ready'}
          </div>

          <div className="w-8 h-px bg-border/50 mx-1" />

          {/* Step 4: Applying / Conflicted */}
          <div className={cn(
            "flex items-center gap-1.5",
            isApplying
              ? "text-primary"
              : isConflicted
              ? "text-yellow-400"
              : (isApplied || isFailed)
              ? "text-muted-foreground"
              : "text-muted-foreground/30"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isApplying  ? "bg-primary animate-pulse"
                : isConflicted ? "bg-yellow-400"
                : isApplied ? "bg-success"
                : isFailed  ? "bg-destructive"
                : "bg-muted"
            )} />
            {isConflicted ? 'Conflicted' : 'Applying'}
          </div>

          <div className="w-8 h-px bg-border/50 mx-1" />

          {/* Step 5: Applied / Failed */}
          <div className={cn(
            "flex items-center gap-1.5",
            isApplied ? "text-success" : isFailed ? "text-destructive" : "text-muted-foreground/30"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isApplied ? "bg-success" : isFailed ? "bg-destructive" : "bg-muted"
            )} />
            {isFailed ? 'Failed' : 'Applied'}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main body: file list + diff viewer                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — file list + validation logs */}
        <div className="w-[300px] border-r bg-surface flex flex-col shrink-0">
          <div className="p-4 border-b bg-muted/10 flex flex-col gap-2">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Files Changed ({files.length})
            </div>
            {patch.metadata && (patch.metadata.additions !== undefined || patch.metadata.deletions !== undefined) && (
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-success flex items-center gap-1"><span className="text-[14px] leading-none">+</span>{patch.metadata.additions || 0}</span>
                <span className="text-destructive flex items-center gap-1"><span className="text-[14px] leading-none">-</span>{patch.metadata.deletions || 0}</span>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {files.map((file: any, idx: number) => {
              const isSelected = idx === selectedFileIndex;
              return (
                <div
                  key={file.id || file.path}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer border-l-[3px] transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                      : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                  onClick={() => setSelectedFileIndex(idx)}
                  title={file.path}
                >
                  <FileCode2 className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground/70")} />
                  <span className="truncate">{file.path.split('/').pop()}</span>
                </div>
              );
            })}
          </div>

          {patch.validation_logs && (
            <div className="h-48 border-t bg-muted/10 flex flex-col">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b flex items-center justify-between">
                <span>Validation Logs</span>
                {(isRejected || isFailed || isConflicted)
                  ? <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  : isApproved || isApplied
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  : null}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {patch.validation_logs}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right — diff viewer */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedFile ? (
            <div className="flex-1 relative">
              <div className="absolute inset-0">
                <MonacoDiffViewer
                  originalContent={selectedFile.original_content || ''}
                  modifiedContent={
                    selectedFile.modified_content || selectedFile.file_diff || ''
                  }
                  filePath={selectedFile.path}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              No files to display.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
