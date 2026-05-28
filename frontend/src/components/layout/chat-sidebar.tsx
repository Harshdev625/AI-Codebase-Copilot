"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Plus, MessageSquare, Trash2, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useChatSessions } from "@/features/chat/hooks/use-chat";
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
  const { data: sessionsData, isLoading } = useChatSessions();
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  const sessions = React.useMemo(
    () => (sessionsData?.pagination ? sessionsData.items : []),
    [sessionsData]
  );

  const sidebarContent = (
    <div
      className={cn(
        "flex h-full flex-col bg-card/50 border-r border-border/60 backdrop-blur-sm",
        collapsed ? "w-16" : "w-56 sm:w-64"
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

      {/* New session button */}
      {!collapsed && (
        <div className="p-2 sm:p-3 border-b border-border/40 shrink-0">
          <Button
            onClick={onNewSession}
            size="sm"
            className="w-full h-8 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>
      )}

      {/* Sessions list */}
      <nav className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          sessions.map((session: ChatSession) => (
            <button
              key={session.id}
              onClick={() => {
                onSelectSession(session.id);
                setIsMobileOpen(false);
              }}
              className={cn(
                "w-full text-left flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                selectedSessionId === session.id
                  ? "bg-primary/12 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              title={session.title || "Untitled"}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              {!collapsed && (
                <span className="truncate">{session.title || "Untitled"}</span>
              )}
            </button>
          ))
        ) : !collapsed ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground/40 mb-2" />
            <p className="text-[10px] text-muted-foreground">No sessions yet</p>
          </div>
        ) : null}
      </nav>

      {/* Footer info */}
      {!collapsed && (
        <div className="p-2 sm:p-3 border-t border-border/40 shrink-0">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Select a repository to start
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="md:hidden fixed bottom-4 left-4 z-40">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="rounded-full shadow-lg"
        >
          {isMobileOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block">{sidebarContent}</div>

      {/* Mobile drawer */}
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
