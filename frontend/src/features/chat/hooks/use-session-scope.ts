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

  const setScopePaths = React.useCallback(
    (paths: string[]) => {
      if (!resolvedSessionId) return;
      updateMutation.mutate({
        sessionId: resolvedSessionId,
        payload: { metadata: { scope_paths: paths } },
      });
    },
    [resolvedSessionId, updateMutation],
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

  return {
    scopePaths,
    setScopePaths,
    toggleScopePath,
    isLoading: sessionQuery.isLoading,
    sessionId: resolvedSessionId,
  };
}
