import * as React from 'react';
import { FileEdit, Loader2, Play, AlertTriangle } from 'lucide-react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { Button } from '@/components/ui/button';
import { useApplyPatchMutation } from '@/features/chat/hooks/use-chat';
import { useToast } from '@/components/shared/toast-provider';

interface PatchDiffViewerProps {
  repositoryId: string;
  diff: string;
  summary?: string;
}

export function PatchDiffViewer({ repositoryId, diff, summary }: PatchDiffViewerProps) {
  const applyMutation = useApplyPatchMutation();
  const toast = useToast();

  const handleApply = async () => {
    try {
      await applyMutation.mutateAsync({ repositoryId, diff });
      toast.success('Success', 'Patch applied successfully!');
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to apply patch');
    }
  };

  // Basic diff format heuristic for react-diff-viewer-continued
  const formattedDiff = diff.trim();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="my-4 rounded-xl border border-destructive/20 bg-card overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-destructive/10 px-4 py-3 border-b border-destructive/20 gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive/90 uppercase tracking-wider">ACT Mode Proposal</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Review the proposed changes carefully before applying.</p>
        </div>
        <Button 
          size="sm" 
          variant="destructive"
          className="h-8 text-xs font-bold gap-1 shadow-glow-sm"
          onClick={handleApply}
          disabled={applyMutation.isPending}
        >
          {applyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 fill-current" />}
          Apply to Codebase
        </Button>
      </div>
      
      {summary && (
        <div className="px-4 py-3 text-xs text-foreground/80 border-b border-border/50 bg-accent/10 font-medium">
          {summary}
        </div>
      )}

      <div className="bg-[#0d1117] max-h-[500px] overflow-auto custom-scrollbar">
        <ReactDiffViewer
          oldValue={""}
          newValue={formattedDiff}
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
    </div>
  );
}
