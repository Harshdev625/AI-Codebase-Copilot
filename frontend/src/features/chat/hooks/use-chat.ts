import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { v4 as uuidv4 } from "uuid";

import { chatService } from "@/features/chat/services/chat-service";
import type { ChatMessage, ChatRequestPayload, ChatStreamEvent, ChatMode, Source } from "@/features/chat/types/chat-types";
import { normalizeChatMessage, normalizeMessageMetadata } from "@/features/chat/utils/chat-message-utils";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { useStudioWorkbenchSessionOptional } from "@/features/studio/context/studio-workbench-context";

export const chatKeys = {
  sessions: (repositoryId?: string) => ["chat", "sessions", repositoryId] as const,
  session: (sessionId: string) => ["chat", "session", sessionId] as const,
  messages: (sessionId: string) => ["chat", "messages", sessionId] as const,
};

export function useChatSessions(limit = 20, offset = 0, repositoryId?: string, search?: string, isArchived?: boolean) {
  return useQuery({
    queryKey: [...chatKeys.sessions(repositoryId), limit, offset, search, isArchived],
    queryFn: () => chatService.listSessions(limit, offset, repositoryId, search, isArchived),
  });
}

export function useChatSession(sessionId: string | null) {
  return useQuery({
    queryKey: sessionId ? chatKeys.session(sessionId) : ["chat", "session", "empty"],
    queryFn: () => chatService.getSession(sessionId as string),
    enabled: Boolean(sessionId),
  });
}

export function useCreatePatchMutation() {
  return useMutation({
    mutationFn: ({
      repositoryId,
      payload,
    }: {
      repositoryId: string;
      payload: {
        base_commit_sha: string;
        patch_files: Array<{
          file_path: string;
          action: string;
          file_diff: string;
          content_hash_before?: string;
          content_hash_after?: string;
        }>;
      };
    }) => chatService.createPatchDraft(repositoryId, payload),
  });
}

export function useValidatePatchMutation() {
  return useMutation({
    mutationFn: ({ repositoryId, patchId }: { repositoryId: string; patchId: string }) =>
      chatService.validatePatch(repositoryId, patchId),
  });
}

export function useApplyPatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ repositoryId, patchId }: { repositoryId: string; patchId: string }) =>
      chatService.applyPatch(repositoryId, patchId),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["repositories"] });
      void queryClient.invalidateQueries({ queryKey: ["chat"] });
    },
  });
}

export function useCancelPatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ repositoryId, patchId }: { repositoryId: string; patchId: string }) =>
      chatService.cancelPatchDraft(repositoryId, patchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat"] });
    },
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

export function useUpdateSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, payload }: { sessionId: string; payload: { session_title?: string; is_pinned?: boolean; is_archived?: boolean; metadata?: Record<string, any> } }) => 
      chatService.updateSession(sessionId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
      void queryClient.invalidateQueries({ queryKey: chatKeys.session(variables.sessionId) });
    },
  });
}


export function useChat({ repositoryId }: { repositoryId?: string } = {}) {
  const workbench = useStudioWorkbenchSessionOptional();
  const storeSessionId = useStudioStore((s) => s.activeSessionId);
  const setStoreSessionId = useStudioStore((s) => s.setActiveSessionId);
  const currentSessionId = workbench?.activeSessionId ?? storeSessionId;
  const setCurrentSessionId = workbench?.setActiveSessionId ?? setStoreSessionId;
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const messagesQuery = useChatMessages(currentSessionId, 100, 0);

  React.useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
    }
  }, [currentSessionId]);

  React.useEffect(() => {
    if (!currentSessionId) {
      return;
    }
    const items = messagesQuery.data?.items;
    if (!Array.isArray(items) || items.length === 0 || isSending) {
      return;
    }
    setMessages(items.map((item) => normalizeChatMessage(item)));
  }, [currentSessionId, messagesQuery.data?.items, isSending]);

  const clearMessages = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
    }
    setCurrentSessionId(null);
    setMessages([]);
  }, [setCurrentSessionId]);

  const selectSession = React.useCallback((sessionId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
    }
    setCurrentSessionId(sessionId);
    setMessages([]);
  }, [setCurrentSessionId]);

  const stopGeneration = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
    }
  }, []);

  const sendMessage = React.useCallback(
    async (
      content: string,
      mode: ChatMode = "ASK",
      scopePaths?: string[],
      options?: { displayContent?: string },
    ) => {
      if (isSending) return;
      if (!content.trim()) return;

      const userMessageId = uuidv4();
      const assistantMessageId = uuidv4();
      let localSessionId = currentSessionId;
      const visibleContent = options?.displayContent?.trim() || content;

      const newUserMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: visibleContent,
        created_at: new Date().toISOString(),
        metadata: scopePaths?.length ? { scope_paths: scopePaths } : {},
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
        mode,
        session_id: localSessionId || undefined,
        scope_paths: scopePaths,
      };

      if (repositoryId) {
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
                void queryClient.invalidateQueries({ queryKey: chatKeys.session(event.session_id) });
                void queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
              }
            } else if ((event.type === 'chunk' && event.delta) || (event.type === 'answer' && event.text)) {
              const deltaStr = event.type === 'chunk' ? event.delta : event.text;
              setMessages((prev) => 
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    return { ...msg, content: msg.content + deltaStr };
                  }
                  return msg;
                })
              );
            } else if (event.type === 'status') {
              setMessages((prev) => 
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    const statuses = (msg.metadata.statuses as string[]) || [];
                    return { ...msg, metadata: { ...msg.metadata, statuses: [...statuses, event.step] } };
                  }
                  return msg;
                })
              );
            } else if (event.type === 'source') {
              setMessages((prev) => 
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    const sources = (msg.metadata.sources as Source[]) || [];
                    return { ...msg, metadata: { ...msg.metadata, sources: [...sources, event.source] } };
                  }
                  return msg;
                })
              );
            } else if (event.type === 'patch') {
              setMessages((prev) => 
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    const patches = (msg.metadata.patches as string[]) || [];
                    return { ...msg, metadata: { ...msg.metadata, patches: [...patches, event.diff] } };
                  }
                  return msg;
                })
              );
            } else if (event.type === 'done' && event.sources) {
              setMessages((prev) => 
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    const newMetadata = normalizeMessageMetadata({
                      ...msg.metadata,
                      sources: event.sources,
                      ...(event.proposal ? { patch_proposal: event.proposal } : {}),
                    });
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
          if (localSessionId) {
            void queryClient.invalidateQueries({ queryKey: chatKeys.messages(localSessionId) });
          }
        }
      }
    },
    [repositoryId, currentSessionId, queryClient, isSending, setCurrentSessionId]
  );

  return {
    messages,
    sendMessage,
    stopGeneration,
    isSending,
    isHistoryLoading: Boolean(currentSessionId) && messagesQuery.isLoading && messages.length === 0,
    historyError: messagesQuery.isError ? messagesQuery.error : null,
    clearMessages,
    currentSessionId,
    selectSession,
  };
}
