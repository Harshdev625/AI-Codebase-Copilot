'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';

interface FileExplorerDialogProps {
  repositoryId?: string;
  scopePaths?: string[];
  onScopeChange?: (paths: string[]) => void;
}

export function FileExplorerDialog({ repositoryId, scopePaths = [], onScopeChange }: FileExplorerDialogProps) {
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="w-full justify-start text-[13px] font-medium h-8 px-3 border-border/60 bg-card/60 backdrop-blur-md hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all shadow-sm"
      onClick={() => console.log('FileExplorerDialog clicked for repo', repositoryId)}
    >
      <Settings2 className="w-3.5 h-3.5 mr-2" />
      File Explorer Scope ({scopePaths.length})
    </Button>
  );
}
