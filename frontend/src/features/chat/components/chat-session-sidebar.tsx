import * as React from "react";
import { format, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { MessageSquarePlus, Trash2, Pin, Search, Archive, Edit2, Database, PenTool, PlayCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/features/chat/types/chat-types";
import type { Repository } from "@/features/repositories/types/repository-types";

interface ChatSessionSidebarProps {
  sessions: ChatSession[];
  isLoading: boolean;
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  onTogglePin?: (id: string, isPinned: boolean) => void;
  isSending: boolean;
  repositoryId?: string;
  repositories?: Repository[];
  onRepositoryChange?: (id: string) => void;
  isRepositoriesLoading?: boolean;
}

function groupSessions(sessions: ChatSession[]) {
  const pinned: ChatSession[] = [];
  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const last7Days: ChatSession[] = [];
  const older: ChatSession[] = [];

  const sevenDaysAgo = subDays(new Date(), 7);

  sessions.forEach((session) => {
    if (session.is_pinned) {
      pinned.push(session);
      return;
    }
    const date = new Date(session.last_activity_at || session.updated_at);
    if (isToday(date)) today.push(session);
    else if (isYesterday(date)) yesterday.push(session);
    else if (isAfter(date, sevenDaysAgo)) last7Days.push(session);
    else older.push(session);
  });

  return { pinned, today, yesterday, last7Days, older };
}

export function ChatSessionSidebar({
  sessions,
  isLoading,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  onTogglePin,
  isSending,
  repositoryId,
  repositories = [],
  onRepositoryChange,
  isRepositoriesLoading,
}: ChatSessionSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [repoDropdownOpen, setRepoDropdownOpen] = React.useState(false);

  const filteredSessions = React.useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const lowerQuery = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        (s.session_title || s.summary || "Untitled session").toLowerCase().includes(lowerQuery) ||
        (s.session_mode || "").toLowerCase().includes(lowerQuery)
    );
  }, [sessions, searchQuery]);

  const { pinned, today, yesterday, last7Days, older } = React.useMemo(
    () => groupSessions(filteredSessions),
    [filteredSessions]
  );

  const renderSession = (session: ChatSession) => {
    const label = session.summary || session.session_title || "Untitled session";
    const active = session.id === currentSessionId;
    const mode = session.session_mode || "ASK";
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        key={session.id}
        className={cn(
          "group relative rounded-lg border px-2 py-1.5 transition-all duration-200 cursor-pointer overflow-hidden flex items-center gap-2",
          active
            ? "border-primary/30 bg-primary/10 shadow-[0_1px_8px_-2px] shadow-primary/20"
            : "border-transparent bg-transparent hover:bg-card hover:border-border/60"
        )}
        onClick={() => onSelectSession(session.id)}
      >
        {/* Mode Icon */}
        <div className={cn(
          "shrink-0 flex items-center justify-center rounded-md w-5 h-5",
          mode === "ASK" && "text-blue-500 bg-blue-500/10",
          mode === "PLAN" && "text-purple-500 bg-purple-500/10",
          mode === "ACT" && "text-amber-500 bg-amber-500/10"
        )}>
          {mode === "ASK" ? <Search className="w-3 h-3" /> : mode === "PLAN" ? <PenTool className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
        </div>
        
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex justify-between items-center gap-2">
            <p className={cn("truncate text-[12px] tracking-tight font-medium transition-colors", active ? "text-primary" : "text-foreground/90")}>{label}</p>
            <p className="text-[9px] text-muted-foreground/60 font-medium shrink-0 group-hover:opacity-0 transition-opacity">
              {format(new Date(session.last_activity_at || session.updated_at), "HH:mm")}
            </p>
          </div>
          {session.metadata?.repository && (
            <span className="text-[9px] text-muted-foreground/70 flex items-center gap-1 mt-0.5 truncate max-w-full">
              <Database className="w-2.5 h-2.5" />
              <span className="truncate">{session.metadata.repository.split('/').pop()}</span>
            </span>
          )}
        </div>
        
        <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-background/90 backdrop-blur-md rounded-md border border-border/40 shadow-sm p-0.5">
          {onTogglePin && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn("h-5 w-5 text-muted-foreground hover:text-primary hover:bg-primary/10", session.is_pinned && "text-primary opacity-100")}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(session.id, !session.is_pinned);
              }}
            >
              <Pin className="h-2.5 w-2.5" />
            </Button>
          )}
          <Button type="button" size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={(e) => { e.stopPropagation(); /* TODO rename */ }}>
            <Edit2 className="h-2.5 w-2.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => {
            e.stopPropagation();
            onDeleteSession(session.id);
          }}>
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      </motion.div>
    );
  };

  const renderGroup = (title: string, group: ChatSession[]) => {
    if (group.length === 0) return null;
    return (
      <div className="space-y-0.5 mb-4">
        <h4 className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground/50 px-2 mb-1">{title}</h4>
        <AnimatePresence>
          {group.map(renderSession)}
        </AnimatePresence>
      </div>
    );
  };

  const selectedRepo = repositories.find(r => r.id === repositoryId);

  return (
    <aside className="border-b border-border/60 bg-card/40 lg:border-b-0 lg:border-r backdrop-blur-md flex flex-col h-full w-full">
      
      {/* Search Bar - Unified */}
      <div className="p-2 border-b border-border/60 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search repo, session, files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-[11px] bg-background/50 focus-visible:ring-1 rounded-md"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* Repository Section */}
        <div className="p-2 border-b border-border/40">
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 px-1 mb-1.5">Repository</h4>
          <div className="relative">
            <button
              type="button"
              onClick={() => setRepoDropdownOpen(!repoDropdownOpen)}
              className="flex w-full items-center gap-2 rounded-md border border-border/50 bg-background/50 px-2 py-1.5 text-left text-[11px] hover:bg-accent transition-colors"
            >
              <Database className="h-3.5 w-3.5 text-primary" />
              <span className="truncate flex-1">{selectedRepo?.repo_id || (isRepositoriesLoading ? "Loading..." : "Select Repository")}</span>
              <span className="text-[9px] text-muted-foreground">▼</span>
            </button>
            {repoDropdownOpen && onRepositoryChange && (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                {repositories.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => {
                      onRepositoryChange(repo.id);
                      setRepoDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] hover:bg-accent"
                  >
                    <span className="truncate">{repo.repo_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-2 border-b border-border/40">
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 px-1 mb-1.5">Quick Actions</h4>
          <div className="grid grid-cols-1 gap-0.5">
            <Button size="sm" variant="ghost" className="h-6 px-2 justify-start text-[11px] font-medium text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2" /> New ASK Session
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 justify-start text-[11px] font-medium text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-2" /> New PLAN Session
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 justify-start text-[11px] font-medium text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2" /> New ACT Session
            </Button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="p-2">
          <h4 className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 px-1 mb-2">Sessions</h4>
          
          {isLoading && (
            <div className="rounded-xl border border-border/40 bg-background/50 px-3 py-3 text-xs text-muted-foreground text-center">
              Loading sessions...
            </div>
          )}

        {!isLoading && sessions.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-background/30 px-3 py-6 text-xs text-muted-foreground text-center">
            No saved sessions yet.
          </div>
        )}

        {!isLoading && filteredSessions.length === 0 && sessions.length > 0 && (
          <div className="rounded-xl border border-dashed border-border/60 bg-background/30 px-3 py-6 text-xs text-muted-foreground text-center">
            No matching sessions found.
          </div>
        )}

        {renderGroup("Pinned", pinned)}
        {renderGroup("Today", today)}
        {renderGroup("Yesterday", yesterday)}
        {renderGroup("Last 7 Days", last7Days)}
        {renderGroup("Older", older)}
        </div>
      </div>
    </aside>
  );
}
