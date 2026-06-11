'use client';

import * as React from 'react';
import { Loader2, Play, AlertTriangle } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/shared/toast-provider';
import { 
  useCreatePatchMutation, 
  useValidatePatchMutation, 
  useApplyPatchMutation,
  useCancelPatchMutation 
} from '@/features/chat/hooks/use-chat';
import { useIndexRepository } from '@/features/repositories/hooks/use-repositories';

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
  baseCommitSha = "HEAD" 
}: PatchDiffViewerProps) {
  const toast = useToast();

  // Mutations
  const createPatchMutation = useCreatePatchMutation();
  const validatePatchMutation = useValidatePatchMutation();
  const applyMutation = useApplyPatchMutation();
  const cancelPatchMutation = useCancelPatchMutation();
  const indexMutation = useIndexRepository();

  // State
  const [patchId, setPatchId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("DRAFT");
  const [validationLogs, setValidationLogs] = React.useState<string>("");
  const [isConsoleOpen, setIsConsoleOpen] = React.useState(false);
  const [isConflictOpen, setIsConflictOpen] = React.useState(false);
  const [conflictDetails, setConflictDetails] = React.useState<any>(undefined);

  // Parse files from diff if not provided
  const parsedFiles = React.useMemo(() => {
    if (files && files.length > 0) return files;
    
    const list: string[] = [];
    const blocks = diff.split(/^diff --git\s+/m);
    for (const block of blocks) {
      if (!block.trim()) continue;
      let path = "";
      const lines = block.split("\n");
      for (const line of lines) {
        if (line.startsWith("--- a/")) {
          path = line.substring(6).trim();
        } else if (line.startsWith("+++ b/") && !path) {
          path = line.substring(6).trim();
        }
      }
      if (path) list.push(path);
    }
    return list.length > 0 ? list : ["src/main.py"];
  }, [diff, files]);

  // Helper to ensure a patch draft is registered
  const ensurePatchRegistered = async (): Promise<string> => {
    if (patchId) return patchId;

    const payload = {
      base_commit_sha: baseCommitSha,
      patch_files: parsedFiles.map(file => ({
        file_path: file,
        action: "MODIFIED" as const,
        file_diff: diff
      }))
    };

    const result = await createPatchMutation.mutateAsync({ repositoryId, payload });
    setPatchId(result.patch_id);
    setStatus(result.status);
    return result.patch_id;
  };

  const handleValidate = async () => {
    try {
      const activePatchId = await ensurePatchRegistered();
      setStatus("REVIEW");
      setValidationLogs("Creating worktree sandbox and starting validations...\n");
      setIsConsoleOpen(true);

      const res = await validatePatchMutation.mutateAsync({ repositoryId, patchId: activePatchId });
      setStatus(res.status);
      setValidationLogs(res.validation_logs || "Validation completed with no logs.");
      
      if (res.status === "APPROVED") {
        toast.success("Validation Succeeded", "All validation checks passed successfully!");
      } else {
        toast.error("Validation Failed", "One or more validation checks failed.");
      }
    } catch (err: any) {
      setStatus("FAILED");
      setValidationLogs(prev => prev + `\n[ERROR] Validation failed: ${err.message || err}`);
      toast.error("Error", err.message || "Failed to validate patch");
    }
  };

  const handleApply = async () => {
    try {
      const activePatchId = await ensurePatchRegistered();
      const res = await applyMutation.mutateAsync({ repositoryId, patchId: activePatchId });
      setStatus(res.status);
      toast.success("Success", "Patch applied to repository cache successfully!");
    } catch (err: any) {
      if (err.status === 409) {
        setStatus("CONFLICTED");
        setConflictDetails({
          detail: err.message || "Conflict detected: Repository HEAD has moved.",
          expected_sha: baseCommitSha,
          actual_sha: "Drifted HEAD",
          conflicting_files: parsedFiles
        });
        setIsConflictOpen(true);
      } else {
        toast.error("Apply Failed", err.message || "Failed to apply patch");
      }
    }
  };

  const handleCancelPatch = async () => {
    if (!patchId) return;
    try {
      await cancelPatchMutation.mutateAsync({ repositoryId, patchId });
      setPatchId(null);
      setStatus("DRAFT");
      setValidationLogs("");
      setIsConflictOpen(false);
      toast.info("Patch Cancelled", "The patch draft has been deleted.");
    } catch (err: any) {
      toast.error("Error", err.message || "Failed to cancel patch");
    }
  };

  const handleReindex = async () => {
    try {
      await indexMutation.mutateAsync({
        repository_id: repositoryId,
        commit_sha: "local-working-copy"
      });
      setIsConflictOpen(false);
      toast.success("Reindex Triggered", "Repository re-indexing job has started.");
    } catch (err: any) {
      toast.error("Error", err.message || "Failed to trigger re-indexing");
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div 
      data-testid="act-proposal-card"
      className="my-4 rounded-xl border border-destructive/20 bg-card/60 backdrop-blur-md overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2 w-full"
    >
      {/* Card Header Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-destructive/10 px-4 py-3 border-b border-destructive/20 gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive/90 uppercase tracking-wider">ACT Mode Proposal</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Review the proposed changes carefully before applying.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Validate Button */}
          <Button
            size="sm"
            variant="outline"
            data-testid="trigger-validation-btn"
            onClick={handleValidate}
            disabled={createPatchMutation.isPending || validatePatchMutation.isPending || applyMutation.isPending || status === "APPLIED"}
            className="h-8 text-xs font-semibold px-3 border-border/40 hover:bg-card/25"
          >
            {validatePatchMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Validate Patch
          </Button>

          {/* Apply Button */}
          <Button 
            size="sm" 
            variant="destructive"
            data-testid="apply-to-codebase-btn"
            onClick={handleApply}
            disabled={createPatchMutation.isPending || validatePatchMutation.isPending || applyMutation.isPending || status === "APPLIED"}
            className="h-8 text-xs font-bold gap-1 shadow-glow-sm bg-destructive hover:bg-destructive/90"
          >
            {applyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
            Apply to Codebase
          </Button>
        </div>
      </div>
      
      {summary && (
        <div className="px-4 py-3 text-xs text-foreground/80 border-b border-border/50 bg-accent/10 font-medium">
          {summary}
        </div>
      )}

      {/* Unified Diff View */}
      <div className="bg-[#0d1117] max-h-[400px] overflow-auto custom-scrollbar">
        <ReactDiffViewer
          oldValue={""}
          newValue={diff.trim()}
          splitView={!isMobile}
          useDarkTheme={true}
          leftTitle="Original"
          rightTitle="Modified"
          styles={{
             variables: {
                dark: {
                   diffViewerBackground: 'transparent',
                   diffViewerTitleBackground: '#161b22',
                   diffViewerTitleColor: '#c9d1d9',
                   diffViewerTitleBorderColor: '#30363d',
                }
             }
          }}
        />
      </div>

      {/* Validation Pipeline section */}
      {(status !== "DRAFT" || validationLogs) && (
        <div className="p-4 border-t border-border/30 bg-[#0A0A0C]/50 flex flex-col gap-2">
          <h4 className="text-xs font-semibold text-foreground">Validation Logs</h4>
          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono max-h-[200px] overflow-auto">
             {validationLogs || "Validation in progress..."}
          </pre>
        </div>
      )}

      {/* Conflict Resolution Modal */}
      {isConflictOpen && (
        <div className="p-4 border-t border-destructive/30 bg-destructive/10 text-destructive text-sm flex flex-col gap-2">
           <strong>Conflict Detected!</strong>
           <p>{conflictDetails?.detail}</p>
           <div className="flex gap-2 mt-2">
             <Button size="sm" variant="outline" onClick={handleCancelPatch}>Cancel Patch</Button>
             <Button size="sm" onClick={handleReindex}>Re-index Repository</Button>
           </div>
        </div>
      )}
    </div>
  );
}
