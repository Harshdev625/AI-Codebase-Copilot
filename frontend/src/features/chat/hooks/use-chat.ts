import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { v4 as uuidv4 } from "uuid";

import { chatService } from "@/features/chat/services/chat-service";
import type { ChatMessage, ChatRequestPayload, ChatStreamEvent, ChatMode, Source, TraceStep } from "@/features/chat/types/chat-types";
import { normalizeChatMessage, normalizeMessageMetadata, stripPromptEchoFromAssistant, getDisplayContent } from "@/features/chat/utils/chat-message-utils";
import {
  ensureLlmStep,
  finalizeTraceSteps,
  inferNodeFromLabel,
  markPreviousStepsDone,
  mergeTraceFromDone,
  normalizeTraceStep,
  upsertTraceStep,
} from "@/features/chat/utils/trace-utils";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { useStudioWorkbenchSessionOptional } from "@/features/studio/context/studio-workbench-context";
import { changeSetKeys } from "@/features/change-sets/hooks/use-change-sets";
import { planSavedMessage } from "@/features/change-sets/utils/plan-display-utils";

export const chatKeys = {
  sessions: (repositoryId?: string) => ["chat", "sessions", repositoryId] as const,
  session: (sessionId: string) => ["chat", "session", sessionId] as const,
  messages: (sessionId: string) => ["chat", "messages", sessionId] as const,
};

const HISTORY_SYNC_DEBOUNCE_MS = 500;

function localUserText(msg: ChatMessage): string {
  const meta = msg.metadata ?? {};
  if (typeof meta.display_content === "string" && meta.display_content.trim()) {
    return meta.display_content.trim();
  }
  return getDisplayContent(msg.content, msg.role, meta);
}

function serverUserText(msg: ChatMessage): string {
  const meta = msg.metadata ?? {};
  if (typeof meta.display_content === "string" && meta.display_content.trim()) {
    return meta.display_content.trim();
  }
  return getDisplayContent(msg.content, msg.role, meta);
}

function usersMatch(local: ChatMessage, server: ChatMessage): boolean {
  const localText = localUserText(local);
  const serverText = serverUserText(server);
  return (
    localText === serverText ||
    local.content.trim() === server.content.trim() ||
    local.content.trim() === serverText
  );
}

function mergeServerMessages(local: ChatMessage[], server: ChatMessage[]): ChatMessage[] {
  const normalized = server.map((item) => normalizeChatMessage(item));
  if (normalized.length === 0) return local;
  if (local.length === 0) return normalized;

  const localUsers = local.filter((msg) => msg.role === "user");
  const serverUsers = normalized.filter((msg) => msg.role === "user");
  const serverAssistants = normalized.filter((msg) => msg.role === "assistant");
  const orphanUsers = localUsers.filter((lu) => !serverUsers.some((su) => usersMatch(lu, su)));

  if (orphanUsers.length === 0 && normalized.length >= local.length) {
    return normalized;
  }

  const merged: ChatMessage[] = [];
  let assistantIdx = 0;

  for (const localMsg of local) {
    if (localMsg.role === "user") {
      const serverMatch = serverUsers.find((su) => usersMatch(localMsg, su));
      if (serverMatch && !merged.some((msg) => msg.id === serverMatch.id)) {
        merged.push(serverMatch);
      } else {
        merged.push(localMsg);
      }
      continue;
    }

    if (localMsg.role === "assistant") {
      const serverAssistant = serverAssistants[assistantIdx];
      if (serverAssistant && !merged.some((msg) => msg.id === serverAssistant.id)) {
        merged.push(serverAssistant);
        assistantIdx += 1;
      } else if (!localMsg.metadata?.isStreaming) {
        merged.push(localMsg);
      }
    }
  }

  for (const serverMsg of normalized) {
    if (!merged.some((msg) => msg.id === serverMsg.id)) {
      merged.push(serverMsg);
    }
  }

  return merged;
}

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
  const setActiveChangeSetId = useStudioStore((s) => s.setActiveChangeSetId);
  const openFileTab = useStudioStore((s) => s.openFileTab);
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
    setMessages((prev) => mergeServerMessages(prev, items));
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
    if (sessionId === currentSessionId) {
      void queryClient.invalidateQueries({ queryKey: chatKeys.messages(sessionId) });
      return;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsSending(false);
      isSendingRef.current = false;
    }
    setCurrentSessionId(sessionId);
    setMessages([]);
  }, [setCurrentSessionId, currentSessionId, queryClient]);

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

      const metadata: Record<string, unknown> = { display_content: visibleContent };
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
        metadata: {
          isStreaming: true,
          traceSteps: [],
          statuses: [],
          sources: [],
        },
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
      if (visibleContent !== content) {
        payload.display_query = visibleContent;
      }

      if (repositoryId) {
        payload.repository_id = repositoryId;
      }

      try {
        await chatService.stream(
          payload,
          (event: ChatStreamEvent) => {
            const updateAssistant = (
              updater: (metadata: Record<string, unknown>, content: string) => Record<string, unknown> | void,
              contentUpdater?: (content: string) => string,
            ) => {
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;
                  const nextMetadata = { ...msg.metadata };
                  const metadataResult = updater(nextMetadata, msg.content);
                  const mergedMetadata =
                    metadataResult && typeof metadataResult === "object"
                      ? metadataResult
                      : nextMetadata;
                  return {
                    ...msg,
                    content: contentUpdater ? contentUpdater(msg.content) : msg.content,
                    metadata: mergedMetadata,
                  };
                }),
              );
            };

            if (event.type === "start") {
              if (event.session_id) {
                if (localSessionId !== event.session_id) {
                  localSessionId = event.session_id;
                  setSessionIdSilent(event.session_id);
                  void queryClient.invalidateQueries({ queryKey: ["chat", "sessions"] });
                  void queryClient.invalidateQueries({ queryKey: chatKeys.session(event.session_id) });
                  void queryClient.invalidateQueries({ queryKey: ["admin", "metrics"] });
                }
              }
              if (event.intent && event.intent !== "unknown") {
                updateAssistant((metadata) => {
                  metadata.intent = event.intent;
                  return metadata;
                });
              }
            } else if ((event.type === "chunk" && event.delta) || (event.type === "answer" && event.text)) {
              const deltaStr = event.type === "chunk" ? event.delta : event.text;
              updateAssistant(
                (metadata) => {
                  const traceSteps = ensureLlmStep(
                    (metadata.traceSteps as TraceStep[]) ?? [],
                    "running",
                  );
                  metadata.traceSteps = traceSteps;
                  metadata.isStreaming = true;
                  return metadata;
                },
                (content) => stripPromptEchoFromAssistant(content + deltaStr),
              );
            } else if (event.type === "trace_step") {
              const normalized = normalizeTraceStep(event.step);
              if (!normalized) return;
              updateAssistant((metadata) => {
                const traceSteps = markPreviousStepsDone(
                  upsertTraceStep((metadata.traceSteps as TraceStep[]) ?? [], {
                    ...normalized,
                    status: normalized.status ?? "done",
                  }),
                  normalized.node,
                );
                const statuses = (metadata.statuses as string[]) ?? [];
                metadata.traceSteps = traceSteps;
                metadata.statuses = statuses.includes(normalized.label)
                  ? statuses
                  : [...statuses, normalized.label];
                if (normalized.detail?.intent) {
                  metadata.intent = normalized.detail.intent;
                }
                metadata.isStreaming = true;
                return metadata;
              });
            } else if (event.type === "status") {
              updateAssistant((metadata) => {
                const statuses = (metadata.statuses as string[]) ?? [];
                const nextStatuses = statuses.includes(event.step)
                  ? statuses
                  : [...statuses, event.step];
                metadata.statuses = nextStatuses;

                const existingSteps = (metadata.traceSteps as TraceStep[]) ?? [];
                const node =
                  event.stage === "llm"
                    ? "llm"
                    : inferNodeFromLabel(event.step, existingSteps.length);
                metadata.traceSteps = upsertTraceStep(existingSteps, {
                  node,
                  label: event.step,
                  stage: event.stage === "llm" ? "llm" : "pipeline",
                  status: event.stage === "llm" ? "running" : "done",
                });
                metadata.isStreaming = true;
                return metadata;
              });
            } else if (event.type === "source") {
              updateAssistant((metadata) => {
                const sources = (metadata.sources as Source[]) ?? [];
                metadata.sources = [...sources, event.source];
                metadata.isStreaming = true;
                return metadata;
              });
            } else if (event.type === "patch") {
              updateAssistant((metadata) => {
                const patches = (metadata.patches as string[]) ?? [];
                metadata.patches = [...patches, event.diff];
                return metadata;
              });
            } else if (event.type === "plan_ready") {
              setActiveChangeSetId(event.change_set_id);
              void queryClient.invalidateQueries({
                queryKey: ["change-sets", "session", localSessionId ?? ""],
              });
              updateAssistant(
                (metadata) => {
                  metadata.change_set_id = event.change_set_id;
                  metadata.plan_version = event.plan_version;
                  metadata.plan_status = event.status;
                  if (event.plan_file_path) metadata.plan_file_path = event.plan_file_path;
                  const summary = event.plan?.summary?.trim();
                  if (summary) metadata.plan_summary = summary;
                  const stepCount = event.plan?.steps?.length;
                  if (stepCount != null) metadata.plan_step_count = stepCount;
                  return metadata;
                },
                () => planSavedMessage(event.plan_file_path),
              );
            } else if (event.type === "plan_error") {
              updateAssistant((metadata) => {
                metadata.plan_error = event.error;
                return metadata;
              });
            } else if (event.type === "done") {
              if (event.change_set?.id) {
                setActiveChangeSetId(event.change_set.id);
                void queryClient.invalidateQueries({
                  queryKey: changeSetKeys.session(localSessionId ?? ""),
                });
              } else if (mode === "PLAN" && localSessionId) {
                void queryClient.invalidateQueries({
                  queryKey: changeSetKeys.session(localSessionId),
                });
              }
              setMessages((prev) =>
                prev.map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;
                  const mergedTrace = mergeTraceFromDone(
                    finalizeTraceSteps((msg.metadata.traceSteps as TraceStep[]) ?? []),
                    event.trace,
                  );
                  const newMetadata = normalizeMessageMetadata({
                    ...msg.metadata,
                    ...(event.intent ? { intent: event.intent } : {}),
                    ...(event.sources ? { sources: event.sources } : {}),
                    ...(event.proposal ? { patch_proposal: event.proposal } : {}),
                    trace: mergedTrace,
                    traceSteps: mergedTrace,
                    ...(event.usage ? { usage: event.usage } : {}),
                    ...(event.session_usage ? { session_usage: event.session_usage } : {}),
                    ...(event.change_set?.id ? { change_set_id: event.change_set.id } : {}),
                    ...(event.change_set?.status ? { plan_status: event.change_set.status } : {}),
                    ...(event.change_set?.plan_json?.summary
                      ? { plan_summary: event.change_set.plan_json.summary }
                      : {}),
                    ...(event.change_set?.plan_json?.steps
                      ? { plan_step_count: event.change_set.plan_json.steps.length }
                      : {}),
                    isStreaming: false,
                  });
                  return {
                    ...msg,
                    content: stripPromptEchoFromAssistant(msg.content),
                    metadata: newMetadata,
                  };
                }),
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
    [repositoryId, currentSessionId, queryClient, setSessionIdSilent, scheduleHistorySync, setActiveChangeSetId, openFileTab]
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
