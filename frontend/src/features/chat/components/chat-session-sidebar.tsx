import * as React from "react";
import { format } from "date-fns";
import { MessageSquare, Folder, Settings, Search, Edit, PenTool, Database } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  onRenameSession?: (id: string, title: string) => any;
  onTogglePin?: (id: string, isPinned: boolean) => any;
  onArchiveSession?: (id: string, isArchived: boolean) => any;
  isSending?: boolean;
  repositoryId?: string;
  repositories?: Repository[];
}

function groupSessionsByRepo(sessions: ChatSession[], repositories: Repository[]) {
  const grouped: Record<string, ChatSession[]> = {};
  const noRepo: ChatSession[] = [];

  sessions.forEach((session) => {
    let repoName = 'Unassigned';
    if (session.metadata?.repository) {
       repoName = session.metadata.repository.split('/').pop() || 'Unknown';
    } else if (session.repository_id) {
       const r = repositories.find(r => r.id === session.repository_id);
       repoName = r ? (r.repo_id.split('/').pop() || r.repo_id) : 'Unknown';
    }

    if (repoName === 'Unassigned') {
      noRepo.push(session);
    } else {
      if (!grouped[repoName]) grouped[repoName] = [];
      grouped[repoName].push(session);
    }
  });

  return { grouped, noRepo };
}

export function ChatSessionSidebar({
  sessions,
  isLoading,
  currentSessionId,
  onSelectSession,
  repositories = [],
}: ChatSessionSidebarProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  
  // Collapse state for folders
  const [collapsedFolders, setCollapsedFolders] = React.useState<Record<string, boolean>>({});

  const toggleFolder = (folderName: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  const filteredSessions = React.useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const lowerQuery = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        (s.session_title || s.summary || "Untitled session").toLowerCase().includes(lowerQuery)
    );
  }, [sessions, searchQuery]);

  const { grouped: groupedByRepo, noRepo } = React.useMemo(
    () => groupSessionsByRepo(filteredSessions, repositories),
    [filteredSessions, repositories]
  );

  const renderSession = (session: ChatSession) => {
    const label = session.summary || session.session_title || "Untitled session";
    const active = session.id === currentSessionId;
    const mode = session.session_mode || "ASK";
    
    // Determine icon based on mode
    let Icon = MessageSquare;
    if (mode === "PLAN") Icon = Edit;
    if (mode === "ACT") Icon = PenTool;
    
    return (
      <div
        key={session.id}
        onClick={() => onSelectSession(session.id)}
        className={cn(
          "group flex items-start gap-3 rounded-lg p-2.5 cursor-pointer transition-colors border",
          active 
            ? "bg-[#252833] border-[#3B4050]" 
            : "bg-transparent border-transparent hover:bg-[#1A1C23]"
        )}
      >
        <div className="shrink-0 pt-0.5">
          <div className="w-8 h-8 rounded-lg bg-[#1F222C] border border-[#2D313E] flex items-center justify-center text-[#8B949E]">
             <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-[#C9D1D9] text-[13px] font-medium leading-snug truncate">
            {label}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[#8B949E] text-[11px]">
              {format(new Date(session.last_activity_at || session.updated_at), "MMM d, h:mm a")}
            </span>
            <span className="text-[#8B949E] text-[11px]">Status</span>
          </div>
        </div>
      </div>
    );
  };

  const renderFolder = (title: string, group: ChatSession[]) => {
    if (group.length === 0) return null;
    const isCollapsed = collapsedFolders[title] || false;
    
    return (
      <div className="mb-4" key={title}>
        <div 
          className="flex items-center gap-2 px-1 mb-2 cursor-pointer group"
          onClick={() => toggleFolder(title)}
        >
          <svg 
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
            className={cn("text-[#8B949E] transition-transform", isCollapsed ? "-rotate-90" : "rotate-0")}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span className="text-[#8B949E] text-[12px] font-semibold tracking-wide">
            {title}
          </span>
        </div>
        
        {!isCollapsed && (
          <div className="space-y-1 pl-1">
            {group.map(renderSession)}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-[280px] shrink-0 h-full flex flex-col bg-[#13151A] border-r border-[#1E212B]">
      
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
        <h3 className="text-[#C9D1D9] text-[11px] font-bold tracking-wider">
          SESSION SIDEBAR
        </h3>
        <div className="flex items-center gap-3 text-[#8B949E]">
          <Folder className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
          <Settings className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-4 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8B949E]" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-9 pr-9 text-[13px] bg-[#1A1C23] border-[#2D313E] text-[#C9D1D9] focus-visible:ring-1 focus-visible:ring-[#3B82F6] rounded-md placeholder:text-[#8B949E]"
          />
          <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-[#8B949E] hover:text-white">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 4.5H12.5M4.5 7.5H10.5M6.5 10.5H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Button>
        </div>
      </div>

      {/* Folders & Sessions */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
        
        {isLoading && (
          <div className="text-center text-[#8B949E] text-xs py-4">
            Loading sessions...
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="text-center text-[#8B949E] text-xs py-4">
            No saved sessions yet.
          </div>
        )}

        {Object.entries(groupedByRepo).map(([repoName, repoSessions]) => (
          renderFolder(repoName, repoSessions)
        ))}
        {renderFolder("Folders", noRepo)}

      </div>
    </aside>
  );
}

