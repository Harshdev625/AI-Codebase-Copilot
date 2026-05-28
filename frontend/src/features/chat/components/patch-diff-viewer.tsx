import * as React from 'react';
import { FileEdit, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApplyPatchMutation } from '@/features/chat/hooks/use-chat';
import { cn } from '@/lib/utils';
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

  return (
    <div className="my-4 rounded-xl border border-primary/20 bg-card overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between bg-primary/10 px-4 py-2 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <FileEdit className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-primary/90">Proposed Code Change</span>
        </div>
        <Button 
          size="sm" 
          variant="default"
          className="h-7 text-xs font-bold gap-1"
          onClick={handleApply}
          disabled={applyMutation.isPending}
        >
          {applyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Apply to Codebase
        </Button>
      </div>
      
      {summary && (
        <div className="px-4 py-3 text-sm text-foreground/80 border-b border-border/50 bg-accent/20 font-medium">
          {summary}
        </div>
      )}

      <div className="bg-[#0d1117] p-4 overflow-x-auto text-[13px] font-mono leading-relaxed max-h-[400px] overflow-y-auto">
        {diff.split('\n').map((line, idx) => {
          let colorClass = 'text-gray-300';
          let bgColor = 'bg-transparent';
          
          if (line.startsWith('+') && !line.startsWith('+++')) {
            colorClass = 'text-emerald-400';
            bgColor = 'bg-emerald-950/40 w-full inline-block';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            colorClass = 'text-rose-400';
            bgColor = 'bg-rose-950/40 w-full inline-block';
          } else if (line.startsWith('@@')) {
            colorClass = 'text-blue-400/80';
            bgColor = 'bg-blue-950/10 w-full inline-block mt-2';
          } else if (line.startsWith('---') || line.startsWith('+++')) {
            colorClass = 'text-gray-400 font-bold';
            bgColor = 'bg-gray-900/50 w-full inline-block';
          }

          return (
            <div key={idx} className={cn('px-2 py-0.5 whitespace-pre', colorClass, bgColor)}>
              {line || ' '}
            </div>
          );
        })}
      </div>
    </div>
  );
}
