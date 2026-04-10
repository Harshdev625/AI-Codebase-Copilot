'use client';

import * as React from 'react';
import { useChat } from '../hooks/use-chat';
import { useAuthStore } from '@/store/auth-store';
import { chatService } from '../services/chat-service';
import { ChatMessageItemBubble } from './chat-message-item-bubble';
import { Send, Loader2, Sparkles, History, Plus, Bot, RefreshCw, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ChatWorkspaceProps {
  repositoryId: string;
}

const SUGGESTED_PROMPTS = [
  'Where is authentication implemented?',
  'Explain the main data flow in this repo',
  'Find all API endpoints and describe them',
  'What are the most complex functions?',
];

export function ChatWorkspace({ repositoryId }: ChatWorkspaceProps) {
  const { messages, sendMessage, isSending, clearMessages, currentSessionId, setCurrentSessionId } = useChat(repositoryId);
  const [query, setQuery] = React.useState('');
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [mounted, setMounted] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch sessions on mount and when sent message (to update summary)
  const fetchSessions = React.useCallback(async () => {
    if (!useAuthStore.getState().isAuthenticated) return;
    try {
      const res = await chatService.getSessions();
      if (res.success) setSessions(res.data || []);
    } catch (e) {
      console.error('Failed to fetch sessions', e);
    }
  }, []);

  React.useEffect(() => {
    if (mounted) {
      fetchSessions();
    }
  }, [currentSessionId, mounted, fetchSessions]);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isSending]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isSending || !repositoryId) return;
    sendMessage(query);
    setQuery('');
    textareaRef.current?.focus();
  };

  const handleDeleteSession = async (e: React.MouseEvent, sid: string) => {
    e.stopPropagation();
    try {
      await chatService.deleteSession(sid);
      if (currentSessionId === sid) clearMessages();
      fetchSessions();
    } catch (e) {
       console.error('Delete failed', e);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Left: History sidebar - High-density & Integrated */}
      <div className="hidden lg:flex w-72 shrink-0 flex-col border-r border-border/20 bg-card/5">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/10">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/40">Log History</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={clearMessages}
            title="New session"
            className="h-7 w-7 rounded-lg border border-border/20 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 overflow-auto p-4 space-y-1.5 custom-scrollbar">
          {sessions.length > 0 ? (
            sessions.map((s) => (
              <motion.div
                key={s.id}
                whileHover={{ x: 4 }}
                onClick={() => setCurrentSessionId(s.id)}
                className={cn(
                  "group relative flex flex-col gap-1 rounded-xl px-4 py-3.5 transition-all cursor-pointer border",
                  currentSessionId === s.id 
                    ? "bg-primary/[0.03] border-primary/20 shadow-sm" 
                    : "bg-transparent border-transparent hover:bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={cn(
                    "truncate flex-1 text-[13px] font-bold tracking-tight transition-colors",
                    currentSessionId === s.id ? "text-primary" : "text-foreground/70 group-hover:text-foreground"
                  )}>
                    {s.summary || s.title || "Observation Run"}
                  </span>
                  <button 
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-error transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/25">
                      {s.updated_at ? new Date(s.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Active'}
                   </span>
                   {currentSessionId === s.id && (
                      <span className="h-1 w-1 rounded-full bg-primary" />
                   )}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center px-10 gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full animate-pulse" />
                <div className="relative h-14 w-14 rounded-2xl bg-muted/20 flex items-center justify-center border border-border/20">
                  <History className="h-6 w-6 text-muted-foreground/30" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-foreground/40 font-mono">
                  Vault Empty
                </p>
                <p className="text-[10px] text-muted-foreground/30 font-medium">
                  Local context indices only
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center: Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar bg-background/40">
          <div className="max-w-4xl mx-auto px-10 py-16 space-y-0">
          {messages.length === 0 ? (
            /* Empty / welcome state - Spotlight Style */
            <div className="flex h-full flex-col items-center justify-center text-center gap-12 max-w-2xl mx-auto py-32 animate-fade-in">
              <div className="relative p-10 rounded-[40px] border border-border/10 bg-card/10 backdrop-blur-sm shadow-AI w-full transition-all hover:bg-card/20 group">
                <div className="mx-auto h-20 w-20 rounded-[28px] bg-gradient-to-br from-primary/10 to-indigo-500/10 flex items-center justify-center border border-primary/20 shadow-ai-sm mb-8 transition-transform group-hover:scale-110 duration-500 group-hover:rotate-6">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h2 className="text-4xl font-bold tracking-tighter text-foreground/90 mb-4">
                  {repositoryId ? 'Intelligence Vector Active' : 'Select Origin Node'}
                </h2>
                <p className="text-[17px] text-muted-foreground leading-relaxed max-w-lg mx-auto font-medium opacity-80">
                  {repositoryId
                    ? 'State your technical objective. I have mapped the symbol graph and logic flows of this codebase.'
                    : 'Initialize a connection by selecting a repository from the registry.'}
                </p>
                {repositoryId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mt-12">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => { setQuery(prompt); textareaRef.current?.focus(); }}
                        className="group/btn flex items-center gap-4 rounded-2xl border border-border/10 bg-background/40 p-5 text-left text-sm hover:border-primary/40 hover:bg-primary/[0.05] hover:text-primary transition-all duration-300"
                      >
                        <div className="h-8 w-8 rounded-lg bg-muted/10 flex items-center justify-center group-hover/btn:bg-primary/10 transition-colors">
                          <Sparkles className="h-4 w-4 text-primary/30 group-hover/btn:text-primary transition-colors" />
                        </div>
                        <span className="font-bold tracking-tight text-foreground/70 group-hover/btn:text-primary transition-colors">{prompt}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageItemBubble key={msg.id} message={msg} />
            ))
          )}

          {/* Thinking indicator */}
          {isSending && (
            <div className="flex items-center gap-4 py-12 animate-pulse text-primary/40 border-t border-border/10 mt-8">
               <div className="h-2 w-2 rounded-full bg-primary" />
               <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Synthesizing Reasoning Chain...</span>
            </div>
          )}
          </div>
        </div>

        {/* Input area - Command Style */}
        <div className="max-w-4xl w-full mx-auto p-8 pt-0">
          <div className={cn(
             "relative rounded-3xl border border-border/10 bg-background/40 backdrop-blur-xl shadow-premium p-2 transition-all duration-700 focus-within:border-primary/40 focus-within:shadow-ai focus-within:bg-background/60",
             !repositoryId && "opacity-40 grayscale pointer-events-none"
          )}>
            <div className="absolute left-6 top-6 pointer-events-none">
               <Bot className="h-4 w-4 text-muted-foreground/30" />
            </div>
            <Textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder={repositoryId ? 'Query code architecture, request logic refactoring, or audit dependencies...' : 'Select a repository to begin'}
              className="min-h-[120px] max-h-[400px] w-full resize-none border-none bg-transparent pl-12 pr-6 py-4 text-[15px] font-medium focus-visible:ring-0 placeholder:text-muted-foreground/20 leading-relaxed text-foreground/80"
            />
            
            <div className="flex items-center justify-between px-4 pb-3 pt-2 border-t border-border/10 bg-muted/5">
                <div className="flex items-center gap-6 text-[9px] font-bold text-muted-foreground/30 uppercase tracking-[0.25em]">
                   <span className="flex items-center gap-2"><RefreshCw className="h-3 w-3" /> Context Sync</span>
                   <span className="flex items-center gap-2"><Sparkles className="h-3 w-3" /> Engine: v2.4</span>
                </div>
                <Button 
                   size="sm"
                   onClick={() => handleSend()}
                   disabled={isSending || !query.trim()}
                   className="h-9 px-5 rounded-xl font-bold text-[10px] uppercase tracking-[0.15em] gap-2.5 shadow-ai transition-all hover:scale-[1.02] active:scale-95"
                >
                  {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Execute <Send className="h-3 w-3" /></>}
                </Button>
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] font-bold text-muted-foreground/20 uppercase tracking-[0.3em]">
          AI Codebase Copilot v2.0 • Immersive Reasoning Workspace
        </p>
      </div>
    </div>
  );
}

