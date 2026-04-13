'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '../hooks/use-chat';
import { chatService } from '../services/chat-service';
import { ChatMessage } from '../types/chat-types';
import { useAuthStore } from '@/store/auth-store';
import { useToast } from '@/components/shared/toast-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  Menu,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

interface ChatWorkspaceProps {
  repositoryId: string;
}

interface ChatSession {
  id: string;
  title?: string | null;
  summary?: string | null;
  updated_at?: string | null;
}

const QUICK_PROMPTS = [
  'Summarize this repository architecture.',
  'Find the highest-risk modules in this codebase.',
  'Explain auth and role checks end-to-end.',
  'List dead code and modernization opportunities.',
];

function SessionItem({
  session,
  selected,
  compact,
  onSelect,
  onDelete,
}: {
  session: ChatSession;
  selected: boolean;
  compact: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const label = session.summary || session.title || 'Untitled session';

  return (
    <div
      className={cn(
        'group w-full rounded-xl border px-3 py-2 transition-colors',
        selected
          ? 'border-cyan-400/40 bg-cyan-500/10'
          : 'border-transparent bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/70'
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-1 shrink-0 text-zinc-500">
          <History className="h-3.5 w-3.5" />
        </div>
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-zinc-100">{compact ? label.slice(0, 1).toUpperCase() : label}</p>
          {!compact && (
            <p className="mt-1 text-[11px] text-zinc-400">
              {session.updated_at
                ? new Date(session.updated_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Active'}
            </p>
          )}
        </button>
        {!compact && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onDelete();
            }}
            className="shrink-0 rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100"
            aria-label="Delete session"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('w-full', isUser ? 'flex justify-end' : 'block')}>
      {isUser ? (
        <p className="max-w-[78%] whitespace-pre-wrap rounded-2xl bg-zinc-800/50 px-4 py-2 text-sm leading-7 text-zinc-100">
          {message.content}
        </p>
      ) : (
        <div
          className="prose prose-sm max-w-none prose-invert
          prose-headings:text-zinc-100 prose-p:text-zinc-200
          prose-a:text-cyan-300 prose-strong:text-zinc-50
          prose-code:text-cyan-200 prose-code:before:content-none prose-code:after:content-none"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      )}
      
      {isUser && (
        <div className="mt-1 text-right text-[11px] text-zinc-500">You</div>
      )}
      {!isUser && (
        <div className="mt-1 text-[11px] text-zinc-500">Copilot</div>
      )}
    </div>
  );
}

export function ChatWorkspace({ repositoryId }: ChatWorkspaceProps) {
  const {
    messages,
    sendMessage,
    isSending,
    isHistoryLoading,
    clearMessages,
    currentSessionId,
    selectSession,
  } = useChat(repositoryId);

  const [query, setQuery] = React.useState('');
  const [sessions, setSessions] = React.useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const messageListRef = React.useRef<HTMLDivElement>(null);

  const toast = useToast();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const fetchSessions = React.useCallback(async () => {
    if (!isAuthenticated) {
      setSessions([]);
      setSessionsLoading(false);
      return;
    }

    setSessionsLoading(true);
    try {
      const response = await chatService.getSessions();
      setSessions(response as ChatSession[]);
    } catch (err: any) {
      toast.warning('History Refresh Failed', err?.message || 'Unable to load conversation history.');
    } finally {
      setSessionsLoading(false);
    }
  }, [isAuthenticated, toast]);

  React.useEffect(() => {
    void fetchSessions();
  }, [fetchSessions, currentSessionId]);

  React.useEffect(() => {
    const element = textareaRef.current;
    if (!element) {
      return;
    }

    element.style.height = '0px';
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`;
  }, [query]);

  React.useEffect(() => {
    const container = messageListRef.current;
    if (!container) {
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending, isHistoryLoading]);

  const handleSend = async () => {
    const trimmed = query.trim();
    if (!trimmed || isSending || isHistoryLoading || !repositoryId) {
      return;
    }

    setQuery('');
    await sendMessage(trimmed);
    textareaRef.current?.focus();
    void fetchSessions();
  };

  const handleSelectSession = (sessionId: string) => {
    if (isSending) {
      toast.info('Wait for Response', 'Finish the current response before switching sessions.');
      return;
    }
    selectSession(sessionId);
    setMobileSidebarOpen(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await chatService.deleteSession(sessionId);
      setSessions((previous) => previous.filter((session) => session.id !== sessionId));
      if (currentSessionId === sessionId) {
        clearMessages();
      }
      toast.success('Conversation Deleted', 'Session history removed.');
    } catch (err: any) {
      toast.error('Delete Failed', err?.message || 'Unable to delete this session.');
    }
  };

  const startNewChat = () => {
    if (isSending) {
      toast.info('Wait for Response', 'Finish the current response before starting a new chat.');
      return;
    }
    clearMessages();
    setQuery('');
    setMobileSidebarOpen(false);
    textareaRef.current?.focus();
  };

  const canSend = !!query.trim() && !isSending && !isHistoryLoading && !!repositoryId;

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-3 py-3">
        {!sidebarCollapsed && <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Chat History</p>}
        <button
          type="button"
          onClick={() => setSidebarCollapsed((previous) => !previous)}
          className="hidden rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 md:inline-flex"
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 md:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-zinc-800/70 p-3">
        <Button
          onClick={startNewChat}
          className={cn(
            'h-10 w-full gap-2 rounded-xl bg-cyan-400/90 text-zinc-950 hover:bg-cyan-300',
            sidebarCollapsed && 'justify-center px-0 md:w-10'
          )}
        >
          <MessageSquarePlus className="h-4 w-4" />
          {!sidebarCollapsed && <span>New chat</span>}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessionsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl bg-zinc-800/70" />
            <Skeleton className="h-14 w-full rounded-xl bg-zinc-800/70" />
            <Skeleton className="h-14 w-full rounded-xl bg-zinc-800/70" />
          </div>
        ) : sessions.length === 0 ? (
          <div className={cn('rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 px-3 py-4 text-xs text-zinc-500', sidebarCollapsed && 'hidden md:block md:px-2 md:text-center')}>
            {sidebarCollapsed ? 'No history' : 'No prior sessions yet.'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                selected={session.id === currentSessionId}
                compact={sidebarCollapsed}
                onSelect={() => handleSelectSession(session.id)}
                onDelete={() => void handleDeleteSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#0a0d14] text-zinc-100">
      <aside
        className={cn(
          'hidden border-r border-zinc-800/80 bg-zinc-950/75 backdrop-blur md:flex md:flex-col',
          sidebarCollapsed ? 'md:w-16' : 'md:w-72'
        )}
      >
        {sidebarContent}
      </aside>

      <div className="relative flex flex-1 min-w-0 flex-col">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
              aria-label="Open history"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Sparkles className="h-4 w-4 text-cyan-300" />
            <p className="text-sm font-semibold text-zinc-100">AI Chat</p>
          </div>
          {currentSessionId && <p className="truncate text-xs text-zinc-400">Session: {currentSessionId.slice(0, 8)}...</p>}
        </div>

        <div ref={messageListRef} className="flex-1 overflow-y-auto px-4 pb-44 pt-4 sm:px-8">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
            {isHistoryLoading ? (
              <div className="space-y-3 pt-2">
                <Skeleton className="h-20 w-[70%] rounded-2xl bg-zinc-800/70" />
                <Skeleton className="ml-auto h-16 w-[55%] rounded-2xl bg-cyan-500/20" />
                <Skeleton className="h-24 w-[80%] rounded-2xl bg-zinc-800/70" />
              </div>
            ) : messages.length === 0 ? (
              <div className="mt-10">
                <p className="text-lg font-semibold text-zinc-100">Ask anything about this repository</p>
                <p className="mt-2 text-sm text-zinc-400">
                  Session history is now synchronized per thread. Pick an old conversation from the sidebar or start a new one.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setQuery(prompt)}
                      className="rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-100"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}

            {isSending && (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                Generating response...
              </div>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#0a0d14] via-[#0a0d14]/95 to-transparent px-4 pb-4 pt-20 sm:px-6">
          <div className="pointer-events-auto mx-auto w-full max-w-3xl">
            <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/85 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_20px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur">
              <Textarea
                ref={textareaRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder={repositoryId ? 'Message Copilot about this codebase...' : 'Choose a repository first...'}
                className="max-h-[220px] min-h-[52px] resize-none border-0 bg-transparent px-3 py-2 text-sm leading-6 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-0"
              />

              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-[11px] text-zinc-500">Shift+Enter for newline</p>
                <Button
                  onClick={() => void handleSend()}
                  disabled={!canSend}
                  className="h-9 rounded-xl bg-cyan-400 px-4 text-zinc-950 hover:bg-cyan-300 disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden">
          <aside className="h-full w-72 border-r border-zinc-800 bg-zinc-950/95">
            {sidebarContent}
          </aside>
        </div>
      )}
    </div>
  );
}
