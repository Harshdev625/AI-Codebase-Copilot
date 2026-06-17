'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Loader2, Play, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/shared/toast-provider';
import {
  useCreatePatchMutation,
  useValidatePatchMutation,
  useApplyPatchMutation,
  useCancelPatchMutation,
} from '@/features/chat/hooks/use-chat';
import { useIndexRepository } from '@/features/repositories/hooks/use-repositories';
import { repositoryService } from '@/features/repositories/services/repository-service';
import { applyUnifiedDiff, splitUnifiedDiff } from '@/features/chat/utils/apply-unified-diff';
import { cn } from '@/lib/utils';

const MonacoDiffViewer = dynamic(
  () =>
    import('@/features/studio/panels/monaco-diff-viewer').then((m) => m.MonacoDiffViewer),
  { ssr: false, loading: () => <div className="p-4 text-xs text-muted-foreground">Loading diff…</div> },
);

interface PatchDiffViewerProps {
  repositoryId: string;
  diff: string;
  summary?: string;
  files?: string[];
  baseCommitSha?: string;
}

export function PatchDiffViewer({
  repositoryId,
  diff,
  summary,
  files = [],
  baseCommitSha = 'HEAD',
}: PatchDiffViewerProps) {
  const toast = useToast();
  const createPatchMutation = useCreatePatchMutation();
  const validatePatchMutation = useValidatePatchMutation();
  const applyMutation = useApplyPatchMutation();
  const cancelPatchMutation = useCancelPatchMutation();
  const indexMutation = useIndexRepository();

  const [patchId, setPatchId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>('DRAFT');
  const [validationLogs, setValidationLogs] = React.useState<string>('');
  const [isConsoleOpen, setIsConsoleOpen] = React.useState(false);
  const [isConflictOpen, setIsConflictOpen] = React.useState(false);
  const [conflictDetails, setConflictDetails] = React.useState<Record<string, unknown> | undefined>();
  const [selectedPath, setSelectedPath] = React.useState<string>('');
  const [originalByPath, setOriginalByPath] = React.useState<Record<string, string>>({});
  const [loadingDiff, setLoadingDiff] = React.useState(false);

  const perFileDiffs = React.useMemo(() => splitUnifiedDiff(diff), [diff]);
  const filePaths = React.useMemo(() => {
    if (files.length > 0) return files;
    return Object.keys(perFileDiffs);
  }, [files, perFileDiffs]);

  React.useEffect(() => {
    if (filePaths.length > 0 && !selectedPath) {
      setSelectedPath(filePaths[0]);
    }
  }, [filePaths, selectedPath]);

  React.useEffect(() => {
    if (!repositoryId || filePaths.length === 0) return;
    let cancelled = false;
    setLoadingDiff(true);

    Promise.all(
      filePaths.map(async (path) => {
        try {
          const res = await repositoryService.getFileContent(
            repositoryId,
            path,
            baseCommitSha === 'HEAD' ? undefined : baseCommitSha,
          );
          return [path, res.content] as const;
        } catch {
          return [path, ''] as const;
        }
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setOriginalByPath(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!cancelled) setLoadingDiff(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repositoryId, filePaths, baseCommitSha]);

  const selectedDiff = selectedPath ? perFileDiffs[selectedPath] ?? diff : diff;
  const originalContent = selectedPath ? originalByPath[selectedPath] ?? '' : '';
  const modifiedContent = React.useMemo(() => {
    if (!selectedDiff) return '';
    if (!originalContent) return selectedDiff;
    try {
      return applyUnifiedDiff(originalContent, selectedDiff);
    } catch {
      return selectedDiff;
    }
  }, [originalContent, selectedDiff]);

  const ensurePatchRegistered = async (): Promise<string> => {
    if (patchId) return patchId;

    const payload = {
      base_commit_sha: baseCommitSha,
      patch_files: filePaths.map((file) => ({
        file_path: file,
        action: 'MODIFIED' as const,
        file_diff: perFileDiffs[file] ?? diff,
      })),
    };

    const result = await createPatchMutation.mutateAsync({ repositoryId, payload });
    setPatchId(result.patch_id);
    setStatus(result.status);
    return result.patch_id;
  };

  const handleValidate = async () => {
    try {
      const activePatchId = await ensurePatchRegistered();
      setStatus('REVIEW');
      setValidationLogs('Creating worktree sandbox and starting validations...\n');
      setIsConsoleOpen(true);

      const res = await validatePatchMutation.mutateAsync({ repositoryId, patchId: activePatchId });
      setStatus(res.status);
      setValidationLogs(res.validation_logs || 'Validation completed with no logs.');

      if (res.status === 'APPROVED') {
        toast.success('Validation Succeeded', 'All validation checks passed successfully!');
      } else {
        toast.error('Validation Failed', 'One or more validation checks failed.');
      }
    } catch (err: unknown) {
      setStatus('FAILED');
      const message = err instanceof Error ? err.message : String(err);
      setValidationLogs((prev) => `${prev}\n[ERROR] Validation failed: ${message}`);
      toast.error('Error', message || 'Failed to validate patch');
    }
  };

  const handleApply = async () => {
    try {
      const activePatchId = await ensurePatchRegistered();
      const res = await applyMutation.mutateAsync({ repositoryId, patchId: activePatchId });
      setStatus(res.status);
      toast.success('Success', 'Patch applied to repository cache successfully!');
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 409) {
        setStatus('CONFLICTED');
        setConflictDetails({
          detail: error.message || 'Conflict detected: Repository HEAD has moved.',
          expected_sha: baseCommitSha,
          actual_sha: 'Drifted HEAD',
          conflicting_files: filePaths,
        });
        setIsConflictOpen(true);
      } else {
        toast.error('Apply Failed', error.message || 'Failed to apply patch');
      }
    }
  };

  const handleCancelPatch = async () => {
    if (!patchId) return;
    try {
      await cancelPatchMutation.mutateAsync({ repositoryId, patchId });
      setPatchId(null);
      setStatus('DRAFT');
      setValidationLogs('');
      setIsConflictOpen(false);
      toast.info('Patch Cancelled', 'The patch draft has been deleted.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Error', message || 'Failed to cancel patch');
    }
  };

  const handleReindex = async () => {
    try {
      await indexMutation.mutateAsync({
        repository_id: repositoryId,
        commit_sha: 'local-working-copy',
        full_reindex: true,
      });
      setIsConflictOpen(false);
      toast.success('Reindex Triggered', 'Repository re-indexing job has started.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Error', message || 'Failed to trigger re-indexing');
    }
  };

  return (
    <div
      data-testid="act-proposal-card"
      className="my-4 w-full overflow-hidden rounded-xl border border-destructive/20 bg-card/60 shadow-sm backdrop-blur-md animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex flex-col items-start justify-between gap-3 border-b border-destructive/20 bg-destructive/10 px-4 py-3 md:flex-row md:items-center">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold uppercase tracking-wider text-destructive/90">
              ACT Mode Proposal
            </span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Review changes (green = added, red = removed) before applying.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            data-testid="trigger-validation-btn"
            onClick={handleValidate}
            disabled={
              createPatchMutation.isPending ||
              validatePatchMutation.isPending ||
              applyMutation.isPending ||
              status === 'APPLIED'
            }
            className="h-8 border-border/40 px-3 text-xs font-semibold hover:bg-card/25"
          >
            {validatePatchMutation.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Validate Patch
          </Button>

          <Button
            size="sm"
            variant="destructive"
            data-testid="apply-to-codebase-btn"
            onClick={handleApply}
            disabled={
              createPatchMutation.isPending ||
              validatePatchMutation.isPending ||
              applyMutation.isPending ||
              status === 'APPLIED'
            }
            className="h-8 gap-1 bg-destructive text-xs font-bold shadow-glow-sm hover:bg-destructive/90"
          >
            {applyMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
            Apply to Codebase
          </Button>
        </div>
      </div>

      {summary && (
        <div className="border-b border-border/50 bg-accent/10 px-4 py-3 text-xs font-medium text-foreground/80">
          {summary}
        </div>
      )}

      {filePaths.length > 1 && (
        <div className="flex flex-wrap gap-1 border-b border-border/30 bg-[#0A0A0C]/40 px-3 py-2">
          {filePaths.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => setSelectedPath(path)}
              className={cn(
                'rounded-md px-2 py-1 font-mono text-[10px] transition-colors',
                selectedPath === path
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-muted/30',
              )}
            >
              {path.split('/').pop() ?? path}
            </button>
          ))}
        </div>
      )}

      <div className="h-[360px] bg-[#0d1117]">
        {loadingDiff ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading file diff…
          </div>
        ) : (
          <MonacoDiffViewer
            originalContent={originalContent}
            modifiedContent={modifiedContent}
            filePath={selectedPath}
          />
        )}
      </div>

      {(status !== 'DRAFT' || validationLogs) && (
        <div className="flex flex-col gap-2 border-t border-border/30 bg-[#0A0A0C]/50 p-4">
          <h4 className="text-xs font-semibold text-foreground">Validation Logs</h4>
          <pre className="max-h-[200px] overflow-auto whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
            {validationLogs || 'Validation in progress...'}
          </pre>
        </div>
      )}

      {isConflictOpen && (
        <div className="flex flex-col gap-2 border-t border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <strong>Conflict Detected!</strong>
          <p>{String(conflictDetails?.detail ?? '')}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCancelPatch}>
              Cancel Patch
            </Button>
            <Button size="sm" onClick={handleReindex}>
              Re-index Repository
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
