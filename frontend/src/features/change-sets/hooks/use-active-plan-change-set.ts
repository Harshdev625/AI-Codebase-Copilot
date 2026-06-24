import { useChangeSet, useChangeSetForSession } from "@/features/change-sets/hooks/use-change-sets";
import type { ChangeSet } from "@/features/change-sets/types/change-set-types";
import { useStudioWorkbenchSessionOptional } from "@/features/studio/context/studio-workbench-context";
import { useStudioStore } from "@/features/studio/store/studio-store";

export function useActivePlanChangeSet(): {
  changeSet: ChangeSet | null | undefined;
  isLoading: boolean;
  sessionId: string | null;
} {
  const workbench = useStudioWorkbenchSessionOptional();
  const storeSessionId = useStudioStore((s) => s.activeSessionId);
  const activeChangeSetId = useStudioStore((s) => s.activeChangeSetId);
  const sessionId = workbench?.activeSessionId ?? storeSessionId;

  const bySession = useChangeSetForSession(sessionId);
  const byId = useChangeSet(activeChangeSetId);

  const changeSet = bySession.data ?? byId.data;
  const isLoading =
    bySession.isLoading || (Boolean(activeChangeSetId) && byId.isLoading && !bySession.data);

  return { changeSet, isLoading, sessionId };
}
