import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { v4 as uuidv4 } from "uuid";

import { chatService } from "@/features/chat/services/chat-service";
import type { ChatMessage, ChatRequestPayload, ChatStreamEvent, ChatMode, Source } from "@/features/chat/types/chat-types";
import { normalizeChatMessage, normalizeMessageMetadata, stripPromptEchoFromAssistant } from "@/features/chat/utils/chat-message-utils";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { useStudioWorkbenchSessionOptional } from "@/features/studio/context/studio-workbench-context";

export const chatKeys = {
  sessions: (repositoryId?: string) => ["chat", "sessions", repositoryId] as const,
  session: (sessionId: string) => ["chat", "session", sessionId] as const,
  messages: (sessionId: string) => ["chat", "messages", sessionId] as const,
};

const HISTORY_SYNC_DEBOUNCE_MS = 500;

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
    mutationFn: ({ sessionId, payload }: { sessionId: string; payload: { session_title?: string; is_pinned?: boolean; is_archived?: boolean; session_mode?: string; metadata?: Record<string, any> } }) => 
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
  const isSendingRef = React.useRef(false);
  const skipHistorySyncUntilRef = React.useRef(0);
  const historySyncTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const messagesQuery = useChatMessages(currentSessionId, 100, 0);

  const setSessionIdSilent = React.useCallback((sessionId: string | null) => {
    setStoreSessionId(sessionId);
  }, [setStoreSessionId]);

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
    if (Date.now() < skipHistorySyncUntilRef.current) {
      return;
    }
    setMessages(items.map((item) => normalizeChatMessage(item)));
  }, [currentSessionId, messagesQuery.data?.items, isSending]);

  React.useEffect(() => {
    return () => {
      if (historySyncTimerRef.current) {
        clearTimeout(historySyncTimerRef.current);
      }
    };
  }, []);

  const clearMessages = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
      isSendingRef.current = false;
    }
    setCurrentSessionId(null);
    setMessages([]);
  }, [setCurrentSessionId]);

  const selectSession = React.useCallback((sessionId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
      isSendingRef.current = false;
    }
    setCurrentSessionId(sessionId);
    setMessages([]);
  }, [setCurrentSessionId]);

  const stopGeneration = React.useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
      isSendingRef.current = false;
    }
  }, []);

  const scheduleHistorySync = React.useCallback((sessionId: string) => {
    skipHistorySyncUntilRef.current = Date.now() + HISTORY_SYNC_DEBOUNCE_MS;
    if (historySyncTimerRef.current) {
      clearTimeout(historySyncTimerRef.current);
    }
    historySyncTimerRef.current = setTimeout(() => {
      skipHistorySyncUntilRef.current = 0;
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(sessionId) });
    }, HISTORY_SYNC_DEBOUNCE_MS);
  }, [queryClient]);

  const sendMessage = React.useCallback(
    async (
      content: string,
      mode: ChatMode = "ASK",
      scopePaths?: string[],
      options?: { displayContent?: string; attachedFiles?: string[] },
    ) => {
      if (isSendingRef.current) return;
      if (!content.trim()) return;

      const userMessageId = uuidv4();
      const assistantMessageId = uuidv4();
      let localSessionId = currentSessionId;
      const visibleContent = options?.displayContent?.trim() || content;
      const attachedFiles = options?.attachedFiles;

      const metadata: Record<string, unknown> = {};
      if (scopePaths?.length) metadata.scope_paths = scopePaths;
      if (attachedFiles?.length) metadata.attached_files = attachedFiles;

      const newUserMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: visibleContent,
        created_at: new Date().toISOString(),
        metadata,
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
      isSendingRef.current = true;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const payload: ChatRequestPayload = {
        query: content,
        mode,
        session_id: localSessionId || undefined,
        scope_paths: scopePaths,
        attached_files: attachedFiles,
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
                setSessionIdSilent(event.session_id);
                void queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
                void queryClient.invalidateQueries({ queryKey: chatKeys.session(event.session_id) });
                void queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
              }
            } else if ((event.type === 'chunk' && event.delta) || (event.type === 'answer' && event.text)) {
              const deltaStr = event.type === 'chunk' ? event.delta : event.text;
              setMessages((prev) => 
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    const nextContent = stripPromptEchoFromAssistant(msg.content + deltaStr);
                    return { ...msg, content: nextContent };
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
            } else if (event.type === 'done') {
              setMessages((prev) => 
                prev.map((msg) => {
                  if (msg.id === assistantMessageId) {
                    const newMetadata = normalizeMessageMetadata({
                      ...msg.metadata,
                      ...(event.intent ? { intent: event.intent } : {}),
                      ...(event.sources ? { sources: event.sources } : {}),
                      ...(event.proposal ? { patch_proposal: event.proposal } : {}),
                      ...(event.trace ? { trace: event.trace } : {}),
                      ...(event.usage ? { usage: event.usage } : {}),
                    });
                    return {
                      ...msg,
                      content: stripPromptEchoFromAssistant(msg.content),
                      metadata: newMetadata,
                    };
                  }
                  return msg;
                })
              );
              if (localSessionId) {
                void queryClient.invalidateQueries({ queryKey: chatKeys.session(localSessionId) });
              }
            }
          },
          controller.signal
        );
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== "AbortError") {
          const message = error.message || "Unable to send message.";
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id === assistantMessageId) {
                return { ...msg, content: msg.content + `\n\n**Error:** ${message}` };
              }
              return msg;
            })
          );
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setIsSending(false);
          isSendingRef.current = false;
          if (localSessionId) {
            scheduleHistorySync(localSessionId);
          }
        }
      }
    },
    [repositoryId, currentSessionId, queryClient, setSessionIdSilent, scheduleHistorySync]
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
    setSessionIdSilent,
  };
}
