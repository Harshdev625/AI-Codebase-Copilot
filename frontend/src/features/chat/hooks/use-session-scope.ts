import * as React from "react";

import { useChatSession, useUpdateSessionMutation } from "@/features/chat/hooks/use-chat";
import { useStudioStore } from "@/features/studio/store/studio-store";

export function useSessionScope(sessionId?: string | null) {
  const { activeSessionId } = useStudioStore();
  const resolvedSessionId = sessionId ?? activeSessionId;
  const sessionQuery = useChatSession(resolvedSessionId);
  const updateMutation = useUpdateSessionMutation();

  const scopePaths = React.useMemo(() => {
    const meta = sessionQuery.data?.metadata;
    if (meta && Array.isArray(meta.scope_paths)) {
      return meta.scope_paths as string[];
    }
    return [];
  }, [sessionQuery.data?.metadata]);

  const attachedFiles = React.useMemo(() => {
    const meta = sessionQuery.data?.metadata;
    if (meta && Array.isArray(meta.attached_files)) {
      return meta.attached_files as string[];
    }
    return [];
  }, [sessionQuery.data?.metadata]);

  const setScopePaths = React.useCallback(
    (paths: string[]) => {
      if (!resolvedSessionId) return;
      const meta = sessionQuery.data?.metadata ?? {};
      updateMutation.mutate({
        sessionId: resolvedSessionId,
        payload: {
          metadata: {
            ...meta,
            scope_paths: paths,
          },
        },
      });
    },
    [resolvedSessionId, updateMutation, sessionQuery.data?.metadata],
  );

  const setAttachedFiles = React.useCallback(
    (paths: string[]) => {
      if (!resolvedSessionId) return;
      const meta = sessionQuery.data?.metadata ?? {};
      updateMutation.mutate({
        sessionId: resolvedSessionId,
        payload: {
          metadata: {
            ...meta,
            attached_files: paths,
          },
        },
      });
    },
    [resolvedSessionId, updateMutation, sessionQuery.data?.metadata],
  );

  const updateScopeMetadata = React.useCallback(
    (scope: string[], attached: string[]) => {
      if (!resolvedSessionId) return;
      const meta = sessionQuery.data?.metadata ?? {};
      updateMutation.mutate({
        sessionId: resolvedSessionId,
        payload: {
          metadata: {
            ...meta,
            scope_paths: scope,
            attached_files: attached,
          },
        },
      });
    },
    [resolvedSessionId, updateMutation, sessionQuery.data?.metadata],
  );

  const toggleScopePath = React.useCallback(
    (path: string) => {
      const next = scopePaths.includes(path)
        ? scopePaths.filter((p) => p !== path)
        : [...scopePaths, path];
      setScopePaths(next);
    },
    [scopePaths, setScopePaths],
  );

  const toggleAttachedFile = React.useCallback(
    (path: string) => {
      const next = attachedFiles.includes(path)
        ? attachedFiles.filter((p) => p !== path)
        : [...attachedFiles, path];
      setAttachedFiles(next);
    },
    [attachedFiles, setAttachedFiles],
  );

  const addMentionPath = React.useCallback(
    (path: string, isFile: boolean) => {
      if (isFile) {
        const nextAttached = attachedFiles.includes(path)
          ? attachedFiles
          : [...attachedFiles, path];
        const nextScope = scopePaths.includes(path) ? scopePaths : [...scopePaths, path];
        updateScopeMetadata(nextScope, nextAttached);
      } else {
        const nextScope = scopePaths.includes(path) ? scopePaths : [...scopePaths, path];
        updateScopeMetadata(nextScope, attachedFiles);
      }
    },
    [scopePaths, attachedFiles, updateScopeMetadata],
  );

  return {
    scopePaths,
    attachedFiles,
    setScopePaths,
    setAttachedFiles,
    updateScopeMetadata,
    toggleScopePath,
    toggleAttachedFile,
    addMentionPath,
    isLoading: sessionQuery.isLoading,
    sessionId: resolvedSessionId,
  };
}
