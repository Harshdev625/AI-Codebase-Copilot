"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Plus, MessageSquare, Trash2, Menu, X, Search, Pin, Archive, Edit2, Check, MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatSessions, useUpdateSessionMutation, useDeleteSessionMutation } from "@/features/chat/hooks/use-chat";
import { ChatSession } from "@/features/chat/types/chat-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
  selectedSessionId: string | undefined;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function ChatSidebar({
  selectedSessionId,
  onSelectSession,
  onNewSession,
  isOpen = true,
  onClose,
}: ChatSidebarProps): React.JSX.Element {
  const [search, setSearch] = React.useState("");
  const { data: sessionsData, isLoading } = useChatSessions(40, 0, undefined, search, false);
  const updateMutation = useUpdateSessionMutation();
  const deleteMutation = useDeleteSessionMutation();
  
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");

  const sessions = React.useMemo(
    () => (sessionsData?.pagination ? sessionsData.items : []),
    [sessionsData]
  );

  const pinnedSessions = sessions.filter(s => s.is_pinned);
  const unpinnedSessions = sessions.filter(s => !s.is_pinned);

  const handleRename = async (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      await updateMutation.mutateAsync({ sessionId: id, payload: { session_title: editTitle } });
    }
    setEditingId(null);
  };

  const SessionItem = ({ session }: { session: ChatSession }) => {
    const isEditing = editingId === session.id;

    return (
      <div
        className={cn(
          "group w-full flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
          selectedSessionId === session.id
            ? "bg-primary/12 text-primary border border-primary/20"
            : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent"
        )}
        onClick={() => {
           if (!isEditing) {
             onSelectSession(session.id);
             setIsMobileOpen(false);
           }
        }}
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && (
          <>
            {isEditing ? (
              <div className="flex-1 flex items-center gap-1 min-w-0" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  autoFocus
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") void handleRename(e, session.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 min-w-0 h-6 px-1.5 text-xs bg-background border border-border/60 rounded"
                />
                <button onClick={e => void handleRename(e, session.id)} className="p-1 hover:text-primary">
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <span className="flex-1 truncate">{session.session_title || "Untitled"}</span>
            )}
            
            {!isEditing && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); void updateMutation.mutateAsync({ sessionId: session.id, payload: { is_pinned: !session.is_pinned } }); }}
                  className={cn("p-1 hover:text-primary transition-colors", session.is_pinned && "text-primary opacity-100")}
                  title={session.is_pinned ? "Unpin" : "Pin"}
                >
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditTitle(session.session_title || ""); setEditingId(session.id); }}
                  className="p-1 hover:text-primary transition-colors"
                  title="Rename"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void updateMutation.mutateAsync({ sessionId: session.id, payload: { is_archived: true } }); }}
                  className="p-1 hover:text-warning transition-colors"
                  title="Archive"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <div
      className={cn(
        "flex h-full flex-col bg-card/50 border-r border-border/60 backdrop-blur-sm",
        collapsed ? "w-16" : "w-56 sm:w-[280px]"
      )}
    >
      {/* Header */}
      <div className={cn("flex items-center gap-2 p-3 sm:p-4 border-b border-border/40 shrink-0", collapsed && "justify-center")}>
        {!collapsed && (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <MessageSquare className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
              Sessions
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted-foreground hover:text-foreground hidden md:flex"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      {/* New session button and Search */}
      {!collapsed && (
        <div className="p-2 sm:p-3 border-b border-border/40 shrink-0 flex flex-col gap-2">
          <Button onClick={onNewSession} size="sm" className="w-full h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input 
               type="text"
               value={search}
               onChange={e => setSearch(e.target.value)}
               placeholder="Search sessions..." 
               className="w-full h-8 pl-8 pr-3 text-xs bg-background/50 border border-border/60 rounded-md focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Sessions list */}
      <nav className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-4 custom-scrollbar">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {pinnedSessions.length > 0 && (
              <div className="space-y-1">
                {!collapsed && <p className="text-[10px] font-semibold text-muted-foreground uppercase px-2 mb-2">Pinned</p>}
                {pinnedSessions.map(session => <SessionItem key={session.id} session={session} />)}
              </div>
            )}
            {unpinnedSessions.length > 0 && (
              <div className="space-y-1">
                {!collapsed && pinnedSessions.length > 0 && <p className="text-[10px] font-semibold text-muted-foreground uppercase px-2 mb-2 mt-4">Recent</p>}
                {unpinnedSessions.map(session => <SessionItem key={session.id} session={session} />)}
              </div>
            )}
            {sessions.length === 0 && !collapsed && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <MessageSquare className="h-6 w-6 text-muted-foreground/40 mb-2" />
                <p className="text-[10px] text-muted-foreground">{search ? "No matches found" : "No sessions yet"}</p>
              </div>
            )}
          </>
        )}
      </nav>
    </div>
  );

  return (
    <>
      <div className="md:hidden fixed bottom-4 left-4 z-40">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="rounded-full shadow-lg"
        >
          {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      <div className="hidden md:block h-full z-20">{sidebarContent}</div>

      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-30 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          >
            <motion.div
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-y-0 left-0 w-64 z-40"
            >
              {sidebarContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
