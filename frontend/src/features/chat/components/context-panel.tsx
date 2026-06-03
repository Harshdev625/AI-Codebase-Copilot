import * as React from "react";
import { 
  Database, 
  GitBranch, 
  FileText, 
  Share2, 
  Layers, 
  RefreshCw, 
  FolderSearch, 
  BarChart, 
  Settings2,
  CheckCircle2,
  Clock,
  Activity
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileExplorerDialog } from "@/features/explorer/components/file-explorer-dialog";

interface ContextPanelProps {
  repositoryId?: string;
  scopePaths?: string[];
}

export function ContextPanel({ repositoryId, scopePaths }: ContextPanelProps) {
  // Functional placeholders for the engineering workspace UI
  const repoName = repositoryId || "No Repository Selected";
  const branchName = "main";
  const lastCommit = "fc9b2a1 - Update auth flow";
  const indexStatus = "Healthy";
  const retrievalHealth = "98% (Optimal)";
  const filesIndexed = 1245;
  const chunks = 8420;
  const graphNodes = 312;
  const lastIndexed = "2 hours ago";

  return (
    <div className="flex h-full flex-col bg-card/10 border-l border-border/30 backdrop-blur-3xl">
      <div className="p-4 border-b border-border/30 bg-card/40 shadow-sm z-10">
        <h3 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80 mb-2">Context</h3>
        <div className="flex items-center gap-2.5 text-[13px] font-bold text-foreground">
          <div className="bg-primary/10 p-1 rounded-md border border-primary/20 shadow-glow-sm">
            <Database className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="truncate">{repoName}</span>
        </div>
        <div className="flex items-center gap-2 mt-2.5 text-[11px] text-muted-foreground font-medium">
          <GitBranch className="w-3 h-3" />
          <span>{branchName}</span>
          <span className="text-muted-foreground/50 mx-1">•</span>
          <Clock className="w-3 h-3" />
          <span className="truncate">{lastCommit}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        
        {/* System Health Card */}
        <div className="rounded-lg bg-card/60 backdrop-blur border border-border/50 shadow-sm p-2.5 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success/40 to-primary/40 opacity-50" />
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2">System Health</h4>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-success drop-shadow-sm" />
                <span className="text-muted-foreground">Index Status</span>
              </div>
              <span className="font-semibold text-foreground/90">{indexStatus}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-muted-foreground/70" />
                <span className="text-muted-foreground">Last Indexed</span>
              </div>
              <span className="tabular-nums text-foreground/80">{lastIndexed}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary drop-shadow-sm" />
                <span className="text-muted-foreground">Retrieval</span>
              </div>
              <span className="font-semibold text-foreground/90">{retrievalHealth}</span>
            </div>
          </div>
        </div>

        {/* Knowledge Scale Card */}
        <div className="rounded-lg bg-card/60 backdrop-blur border border-border/50 shadow-sm p-2.5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 blur-2xl rounded-full" />
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2">Knowledge Scale</h4>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between p-1.5 rounded bg-background/40 border border-border/30 hover:border-primary/30 transition-colors group">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 group-hover:text-primary/70 transition-colors"><FileText className="w-3 h-3"/> Files</span>
              <span className="text-[11px] font-mono font-bold text-foreground/90 tabular-nums">{filesIndexed.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-background/40 border border-border/30 hover:border-primary/30 transition-colors group">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 group-hover:text-primary/70 transition-colors"><Layers className="w-3 h-3"/> Chunks</span>
              <span className="text-[11px] font-mono font-bold text-foreground/90 tabular-nums">{chunks.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-background/40 border border-border/30 hover:border-primary/30 transition-colors group">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 group-hover:text-primary/70 transition-colors"><Share2 className="w-3 h-3"/> Graph Nodes</span>
              <span className="text-[11px] font-mono font-bold text-foreground/90 tabular-nums">{graphNodes.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Active Scope Card */}
        <div className="rounded-xl bg-card/60 backdrop-blur border border-border/50 shadow-sm p-3.5">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">Active Scope</h4>
          {scopePaths && scopePaths.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {scopePaths.map(path => (
                <Badge key={path} variant="secondary" className="text-[10.5px] font-mono px-2 py-0.5 rounded-md bg-secondary/60 border-secondary-foreground/10 text-secondary-foreground/80">
                  {path}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-background/40 border border-border/30">
              <FolderSearch className="w-4 h-4 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground/80 italic font-medium">Entire repository</p>
            </div>
          )}
        </div>

      </div>

      {/* Quick Actions Footer Card */}
      <div className="p-4 border-t border-border/30 bg-card/40 shrink-0 z-10 space-y-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3 px-1">Quick Actions</h4>
        <Button variant="outline" size="sm" className="w-full justify-start text-[13px] font-medium h-8 px-3 border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all shadow-sm">
          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Reindex Repository
        </Button>
        <Button variant="outline" size="sm" className="w-full justify-start text-[13px] font-medium h-8 px-3 border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all shadow-sm">
          <BarChart className="w-3.5 h-3.5 mr-2" /> Repository Insights
        </Button>
        <FileExplorerDialog repositoryId={repositoryId} />
        <Button variant="outline" size="sm" className="w-full justify-start text-[13px] font-medium h-8 px-3 border-border/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all shadow-sm">
          <Settings2 className="w-3.5 h-3.5 mr-2" /> Change Scope
        </Button>
      </div>
    </div>
  );
}
