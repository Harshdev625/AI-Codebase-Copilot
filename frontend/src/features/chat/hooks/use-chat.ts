import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { v4 as uuidv4 } from "uuid";

import { chatService } from "@/features/chat/services/chat-service";
import type { ChatMessage, ChatRequestPayload, ChatStreamEvent } from "@/features/chat/types/chat-types";

export const chatKeys = {
  sessions: (repositoryId?: string) => ["chat", "sessions", repositoryId] as const,
  messages: (sessionId: string) => ["chat", "messages", sessionId] as const,
};

export function useChatSessions(limit = 20, offset = 0, repositoryId?: string) {
  return useQuery({
    queryKey: [...chatKeys.sessions(repositoryId), limit, offset],
    queryFn: () => chatService.listSessions(limit, offset, repositoryId),
  });
}

export function useApplyPatchMutation() {
  return useMutation({
    mutationFn: ({ repositoryId, diff }: { repositoryId: string; diff: string }) =>
      chatService.applyPatch(repositoryId, diff),
  });
}

export function useChatMessages(sessionId: string | null, limit = 100, offset = 0) {
  return useQuery({
    queryKey: sessionId ? [...chatKeys.messages(sessionId), limit, offset] : ["chat", "messages", "empty"],
    queryFn: () => chatService.listMessages(sessionId as string, limit, offset),
    enabled: Boolean(sessionId),
  });
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => chatService.deleteSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
    },
  });
}

type UseChatOptions = {
  repositoryId?: string;
  mode: "repository" | "project";
};

export function useChat({ repositoryId, mode }: UseChatOptions) {
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const messagesQuery = useChatMessages(currentSessionId, 100, 0);

  React.useEffect(() => {
    if (!currentSessionId) {
      return;
    }
    const items = messagesQuery.data?.items;
    if (Array.isArray(items) && !isSending) {
      setMessages(items);
    }
  }, [currentSessionId, messagesQuery.data?.items, isSending]);

  const clearMessages = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCurrentSessionId(null);
    setMessages([]);
  }, []);

  const selectSession = React.useCallback((sessionId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCurrentSessionId(sessionId);
    setMessages([]);
  }, []);

  const stopGeneration = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
    }
  }, []);

  const sendMessage = React.useCallback(
    async (content: string) => {
      if (!content.trim() || isSending) return;

      const userMessageId = uuidv4();
      const assistantMessageId = uuidv4();
      let localSessionId = currentSessionId;

      const newUserMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
        metadata: {},
      };

      const placeholderAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        metadata: {},
      };

      setMessages((prev) => [...prev, newUserMessage, placeholderAssistantMessage]);
      setIsSending(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const payload: ChatRequestPayload = {
        query: content,
        mode: "question",
        session_id: localSessionId || undefined,
      };

      if (mode === "repository" && repositoryId) {
        payload.repository_id = repositoryId;
      }

      try {
        await chatService.stream(
          payload,
          (event: ChatStreamEvent) => {
            if (event.type === 'start' && event.session_id) {
              if (localSessionId !== event.session_id) {
                localSessionId = event.session_id;
                setCurrentSessionId(event.session_id);
                void queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
              }
            } else if (event.type === 'chunk' && event.delta) {
              setMessages((prev) => 
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    return { ...msg, content: msg.content + event.delta! };
                  }
                  return msg;
                })
              );
            } else if (event.type === 'done' && event.sources) {
              // H6 FIX: Ensure patch_proposal is also stored in frontend metadata
              setMessages((prev) => 
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    const newMetadata = { ...msg.metadata, sources: event.sources };
                    if (event.proposal) {
                      newMetadata.sources = [
                        ...(newMetadata.sources || []),
                        { kind: 'patch_proposal', proposal: event.proposal }
                      ];
                    }
                    return { ...msg, metadata: newMetadata };
                  }
                  return msg;
                })
              );
            }
          },
          controller.signal
        );
      } catch (error: any) {
        if (error.name !== "AbortError") {
          const message = error instanceof Error ? error.message : "Unable to send message.";
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                return { ...msg, content: msg.content + `\n\n**Error:** ${message}` };
              }
              return msg;
            })
          );
          throw error;
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setIsSending(false);
          // Invalidate messages list to ensure backend sync
          if (localSessionId) {
            void queryClient.invalidateQueries({ queryKey: chatKeys.messages(localSessionId) });
          }
        }
      }
    },
    [mode, repositoryId, currentSessionId, queryClient]
  );

  return {
    messages,
    sendMessage,
    stopGeneration,
    isSending,
    isHistoryLoading: Boolean(currentSessionId) && messagesQuery.isFetching,
    historyError: messagesQuery.isError ? messagesQuery.error : null,
    clearMessages,
    currentSessionId,
    selectSession,
  };
}
