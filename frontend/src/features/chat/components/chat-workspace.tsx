'use client';

import * as React from 'react';
import { useChat } from '../hooks/use-chat';
import { useAuthStore } from '@/store/auth-store';
import { chatService } from '../services/chat-service';
import { ChatMessageItemBubble } from './chat-message-item-bubble';
import {
  Send, Loader2, Sparkles, Plus, Bot,
  RefreshCw, Trash2, Brain, Cpu, History, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatWorkspaceProps {
  repositoryId: string;
}

const SUGGESTED_PROMPTS = [
  { text: 'Where is authentication implemented?', icon: '🔐' },
  { text: 'Explain the main data flow in this repo', icon: '🔄' },
  { text: 'Find all API endpoints and describe them', icon: '🌐' },
  { text: 'What are the most complex functions?', icon: '⚡' },
];

/* ── Wave loading animation ─────────────────────────────── */
function WaveLoader() {
  return (
    <div className="flex items-center gap-4 py-8 px-6 border-t border-white/5 mt-4 animate-fade-in">
      <div className="flex items-center gap-1.5">
        <div className="wave-dot" />
        <div className="wave-dot" />
        <div className="wave-dot" />
      </div>
      <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-violet-500/50">
        Synthesizing Reasoning Chain…
      </span>
    </div>
  );
}

/* ── Session history drawer (slide-in from left inside chat) */
function SessionHistoryDrawer({
  open,
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession,
  onClose,
}: {
  open: boolean;
  sessions: any[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewSession: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="absolute left-0 top-0 bottom-0 z-30 w-72 flex flex-col bg-[hsl(240,18%,5%)] border-r border-white/6 shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-400" />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500">Session History</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon-xs" onClick={onNewSession}
                  className="h-7 w-7 rounded-xl border border-white/6 text-zinc-600 hover:text-violet-400 hover:border-violet-500/30 hover:bg-violet-500/8">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-1">
              {sessions.length > 0 ? sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => { onSelectSession(s.id); onClose(); }}
                  className={cn(
                    'group relative flex flex-col gap-1 rounded-xl px-3.5 py-3 cursor-pointer border transition-all',
                    currentSessionId === s.id
                      ? 'bg-violet-500/8 border-violet-500/20'
                      : 'bg-transparent border-transparent hover:bg-white/3 hover:border-white/6'
                  )}
                >
                  {currentSessionId === s.id && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-gradient-to-b from-violet-400 to-indigo-500 shadow-[0_0_8px_2px_hsl(265,80%,65%,0.5)]" />
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('truncate flex-1 text-[12px] font-bold tracking-tight',
                      currentSessionId === s.id ? 'text-violet-300' : 'text-zinc-500 group-hover:text-zinc-300')}>
                      {s.summary || s.title || 'Analysis Session'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-zinc-600 rounded-lg hover:bg-red-500/8 transition-all">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-700">
                    {s.updated_at ? new Date(s.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Active'}
                  </span>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-[hsl(240,18%,9%)] border border-white/6 flex items-center justify-center">
                    <History className="h-5 w-5 text-zinc-700" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-700">No Sessions</p>
                    <p className="text-[9px] text-zinc-800 mt-0.5">Start chatting to create a log</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Main workspace (single-column, full-width) ─────────── */
export function ChatWorkspace({ repositoryId }: ChatWorkspaceProps) {
  const { messages, sendMessage, isSending, clearMessages, currentSessionId, setCurrentSessionId } = useChat(repositoryId);
  const [query, setQuery] = React.useState('');
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [mounted, setMounted] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => { setMounted(true); }, []);

  const fetchSessions = React.useCallback(async () => {
    if (!useAuthStore.getState().isAuthenticated) return;
    try {
      const res = await chatService.getSessions();
      if (res.success) setSessions(res.data || []);
    } catch (e) { console.error('Failed to fetch sessions', e); }
  }, []);

  React.useEffect(() => {
    if (mounted) fetchSessions();
  }, [currentSessionId, mounted, fetchSessions]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isSending || !repositoryId) return;
    sendMessage(query);
    setQuery('');
    textareaRef.current?.focus();
  };

  const handleDeleteSession = async (sid: string) => {
    try {
      await chatService.deleteSession(sid);
      if (currentSessionId === sid) clearMessages();
      fetchSessions();
    } catch (e) { console.error('Delete failed', e); }
  };

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">
      {/* Session History Slide-in Drawer */}
      <SessionHistoryDrawer
        open={historyOpen}
        sessions={sessions}
        currentSessionId={currentSessionId ?? ''}
        onSelectSession={setCurrentSessionId}
        onDeleteSession={handleDeleteSession}
        onNewSession={() => { clearMessages(); setHistoryOpen(false); }}
        onClose={() => setHistoryOpen(false)}
      />

      {/* ── Toolbar: history + new ──────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-white/5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHistoryOpen(true)}
          className="h-8 gap-2 text-[11px] font-bold text-zinc-600 hover:text-violet-300 hover:bg-violet-500/8 border border-transparent hover:border-violet-500/20 rounded-xl transition-all"
        >
          <History className="h-3.5 w-3.5" />
          History
          {sessions.length > 0 && (
            <span className="bg-violet-500/15 text-violet-400 text-[9px] font-bold rounded-full px-1.5 py-0.5 border border-violet-500/20">
              {sessions.length}
            </span>
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={clearMessages}
          className="h-8 gap-2 text-[11px] font-bold text-zinc-600 hover:text-zinc-300 hover:bg-white/5 border border-transparent hover:border-white/8 rounded-xl transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </Button>

        {/* Current session indicator */}
        {currentSessionId && sessions.length > 0 && (
          <div className="ml-2 px-3 py-1 rounded-lg bg-violet-500/8 border border-violet-500/15 text-[10px] font-bold text-violet-400/70 truncate max-w-xs">
            {sessions.find(s => s.id === currentSessionId)?.summary || 'Active Session'}
          </div>
        )}
      </div>

      {/* ── Messages area ─────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-10 py-20 animate-fade-in">
              {/* Multi-ring glow */}
              <div className="relative">
                <div className="absolute inset-0 rounded-[40px] bg-violet-500/20 blur-3xl animate-glow-pulse scale-150" />
                <div className="absolute inset-0 rounded-[40px] bg-indigo-500/10 blur-xl animate-glow-pulse delay-200 scale-125" />
                <div className="relative h-24 w-24 rounded-[32px] bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 flex items-center justify-center backdrop-blur-sm">
                  {repositoryId
                    ? <Brain className="h-12 w-12 text-violet-400" />
                    : <Sparkles className="h-12 w-12 text-violet-400" />
                  }
                </div>
              </div>

              <div className="space-y-3 max-w-lg">
                <h2 className="text-3xl font-bold tracking-tighter">
                  {repositoryId
                    ? <span className="gradient-text">Intelligence Active</span>
                    : <span className="gradient-text">Select a Repository</span>
                  }
                </h2>
                <p className="text-[15px] text-zinc-500 leading-relaxed font-medium">
                  {repositoryId
                    ? 'Ask about architecture, debug errors, or request refactors. I have the full codebase mapped.'
                    : 'Choose a repository from the panel above to start an AI-assisted session.'}
                </p>
              </div>

              {repositoryId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={prompt.text}
                      onClick={() => { setQuery(prompt.text); textareaRef.current?.focus(); }}
                      className="group flex items-center gap-4 rounded-2xl border border-white/6 bg-[hsl(240,18%,7%)] p-4 text-left hover:border-violet-500/30 hover:bg-violet-500/5 hover:shadow-[0_0_16px_-4px_hsl(265,80%,65%,0.3)] transition-all duration-300 animate-fade-up"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <span className="text-xl">{prompt.icon}</span>
                      <span className="text-[12px] font-bold tracking-tight text-zinc-500 group-hover:text-violet-300 transition-colors flex-1">
                        {prompt.text}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageItemBubble key={msg.id} message={msg} />
            ))
          )}

          {isSending && <WaveLoader />}
        </div>
      </div>

      {/* ── Input area ─────────────────────────────────── */}
      <div className="px-6 pb-5 pt-2 max-w-3xl w-full mx-auto shrink-0">
        <div className={cn(
          'relative rounded-3xl border border-white/6 bg-[hsl(240,18%,7%)] backdrop-blur-xl p-2 transition-all duration-500',
          'focus-within:border-violet-500/30 focus-within:shadow-[0_0_0_1px_hsl(265,80%,65%,0.1),0_0_32px_-8px_hsl(265,80%,65%,0.25)]',
          !repositoryId && 'opacity-40 grayscale pointer-events-none'
        )}>
          <div className="absolute left-5 top-5 pointer-events-none">
            <Bot className="h-4 w-4 text-zinc-700" />
          </div>
          <Textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={repositoryId ? 'Query architecture, request refactoring, diagnose bugs…' : 'Select a repository to begin'}
            className="min-h-[90px] max-h-[300px] w-full resize-none border-none bg-transparent pl-12 pr-4 py-4 text-[14px] font-medium focus-visible:ring-0 placeholder:text-zinc-700 leading-relaxed text-zinc-200"
          />
          <div className="flex items-center justify-between px-4 pb-2 pt-2 border-t border-white/5">
            <div className="flex items-center gap-5 text-[8px] font-bold text-zinc-700 uppercase tracking-[0.25em]">
              <span className="flex items-center gap-1.5"><RefreshCw className="h-2.5 w-2.5" />Context Sync</span>
              <span className="flex items-center gap-1.5"><Cpu className="h-2.5 w-2.5" />LangGraph v2.4</span>
            </div>
            <Button
              size="sm"
              onClick={() => handleSend()}
              disabled={isSending || !query.trim()}
              className="h-9 px-5 rounded-2xl font-bold text-[10px] uppercase tracking-[0.15em] gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 shadow-glow-sm hover:shadow-glow-md transition-all hover:scale-[1.02] active:scale-95"
            >
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><span>Send</span><Send className="h-3 w-3" /></>}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-center text-[9px] font-bold text-zinc-800 uppercase tracking-[0.3em]">
          AI Codebase Copilot · Agentic RAG Workspace
        </p>
      </div>
    </div>
  );
}
