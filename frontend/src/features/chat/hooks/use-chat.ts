import * as React from 'react';
import { chatService } from '../services/chat-service';
import { ChatMessage } from '../types/chat-types';
import { useToast } from '@/components/shared/toast-provider';

interface UseChatOptions {
  projectId?: string;
  repositoryId?: string;
  mode: 'project' | 'repository';
  initialSessionId?: string;
}

type StreamDoneEvent = {
  type: 'done';
  intent?: string;
  sources?: Array<Record<string, unknown>>;
  answer?: string;
  proposal?: {
    title?: string;
    summary?: string;
    diff?: string;
    files?: string[];
    intent?: string;
  };
};

function extractProposal(sources: Array<Record<string, unknown>> | undefined, directProposal: StreamDoneEvent['proposal']) {
  if (directProposal?.diff) {
    return directProposal;
  }

  const proposalSource = sources?.find((source) => {
    const kind = typeof source.kind === 'string' ? source.kind : '';
    return kind === 'patch_proposal';
  });

  const proposal = proposalSource?.proposal;
  if (proposal && typeof proposal === 'object') {
    const typed = proposal as Record<string, unknown>;
    return {
      title: typeof typed.title === 'string' ? typed.title : undefined,
      summary: typeof typed.summary === 'string' ? typed.summary : undefined,
      diff: typeof typed.diff === 'string' ? typed.diff : undefined,
      files: Array.isArray(typed.files) ? typed.files.filter((file): file is string => typeof file === 'string') : undefined,
      intent: typeof typed.intent === 'string' ? typed.intent : undefined,
    };
  }

  return undefined;
}

export function useChat({ projectId, repositoryId, mode, initialSessionId }: UseChatOptions) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);
  const [currentSessionId, setCurrentSessionId] = React.useState<string | undefined>(initialSessionId);
  const historyRequestIdRef = React.useRef(0);
  const { warning, error } = useToast();

  const mapHistoryMessage = React.useCallback((message: any): ChatMessage => {
    return {
      id: String(message.id),
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content ?? ''),
      created_at: message.created_at,
      metadata: message.metadata,
    };
  }, []);

  const hasValidScope = React.useMemo(() => {
    if (mode === 'project') {
      return !!projectId;
    }
    return !!repositoryId;
  }, [mode, projectId, repositoryId]);

  const loadSessionHistory = React.useCallback(async (sessionId: string) => {
    const requestId = ++historyRequestIdRef.current;
    setCurrentSessionId(sessionId);
    setMessages([]);
    setIsHistoryLoading(true);

    try {
      const response = await chatService.getSessionMessages(sessionId);
      if (requestId !== historyRequestIdRef.current) {
        return;
      }
      setMessages(response.map(mapHistoryMessage));
    } catch (err: any) {
      if (requestId !== historyRequestIdRef.current) {
        return;
      }
      setMessages([]);
      error('History Load Failed', err?.message || 'Unable to load session history.');
    } finally {
      if (requestId === historyRequestIdRef.current) {
        setIsHistoryLoading(false);
      }
    }
  }, [error, mapHistoryMessage]);

  React.useEffect(() => {
    if (initialSessionId) {
      void loadSessionHistory(initialSessionId);
    }
  }, [initialSessionId, loadSessionHistory]);

  const selectSession = React.useCallback((sessionId: string) => {
    if (!sessionId) {
      return;
    }
    void loadSessionHistory(sessionId);
  }, [loadSessionHistory]);

  const clearMessages = React.useCallback(() => {
    historyRequestIdRef.current += 1;
    setMessages([]);
    setCurrentSessionId(undefined);
    setIsHistoryLoading(false);
  }, []);

  const sendMessage = React.useCallback(async (query: string) => {
    if (!hasValidScope) {
      warning(
        'Selection Required',
        mode === 'project'
          ? 'Choose a project to run a federated query.'
          : 'Choose a repository to start analyzing.'
      );
      return;
    }
    if (isHistoryLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: query,
    };

    const assistantId = Math.random().toString(36).substring(7);
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      metadata: { intent: 'thinking...' },
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsSending(true);

    try {
      let fullContent = '';
      await chatService.streamChat(
        {
          query,
          session_id: currentSessionId,
          ...(mode === 'project' ? { project_id: projectId } : { repository_id: repositoryId }),
        },
        (event) => {
          if (event.type === 'start' && event.session_id) {
            setCurrentSessionId(String(event.session_id));
          }
          if (event.type === 'chunk' && event.delta) {
            fullContent += event.delta;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId ? { ...msg, content: fullContent } : msg
              )
            );
          }
          if (event.type === 'done') {
            const doneEvent = event as StreamDoneEvent;
            const proposal = extractProposal(doneEvent.sources, doneEvent.proposal);
            const finalContent = fullContent || String(doneEvent.answer || '');

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantId
                  ? {
                      ...msg,
                      content: finalContent,
                      metadata: {
                        intent: doneEvent.intent,
                        sources: doneEvent.sources,
                        proposal,
                      },
                    }
                  : msg
              )
            );
          }
        }
      );
    } catch (err: any) {
      error('Message Failed', err.message || 'The AI service encountered an error.');
      setMessages((prev) => prev.filter((msg) => msg.id !== assistantId));
    } finally {
      setIsSending(false);
    }
  }, [hasValidScope, mode, warning, isHistoryLoading, currentSessionId, projectId, repositoryId, error]);

  return {
    messages,
    sendMessage,
    isSending,
    isHistoryLoading,
    clearMessages,
    currentSessionId,
    selectSession,
  };
}
