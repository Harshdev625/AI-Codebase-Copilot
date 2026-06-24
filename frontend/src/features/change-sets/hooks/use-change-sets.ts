import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { changeSetService } from "@/features/change-sets/services/change-set-service";
import type { PlanJson } from "@/features/change-sets/types/change-set-types";

export const changeSetKeys = {
  session: (sessionId: string) => ["change-sets", "session", sessionId] as const,
  detail: (id: string) => ["change-sets", id] as const,
};

export function useChangeSetForSession(sessionId: string | null) {
  return useQuery({
    queryKey: sessionId ? changeSetKeys.session(sessionId) : ["change-sets", "empty"],
    queryFn: () => changeSetService.getForSession(sessionId as string),
    enabled: Boolean(sessionId),
  });
}

export function useChangeSet(changeSetId: string | null) {
  return useQuery({
    queryKey: changeSetId ? changeSetKeys.detail(changeSetId) : ["change-sets", "empty"],
    queryFn: () => changeSetService.get(changeSetId as string),
    enabled: Boolean(changeSetId),
  });
}

export function useApprovePlanMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changeSetId: string) => changeSetService.approve(changeSetId),
    onSuccess: (data) => {
      qc.setQueryData(changeSetKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: changeSetKeys.session(data.chat_session_id) });
    },
  });
}

export function useRevisePlanMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ changeSetId, feedback }: { changeSetId: string; feedback: string }) =>
      changeSetService.revise(changeSetId, feedback),
    onSuccess: (data) => {
      qc.setQueryData(changeSetKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: changeSetKeys.session(data.chat_session_id) });
    },
  });
}

export function useStartActMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changeSetId: string) => changeSetService.startAct(changeSetId),
    onSuccess: (data) => {
      qc.setQueryData(changeSetKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: changeSetKeys.session(data.chat_session_id) });
    },
  });
}

export function useUpdatePlanMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      changeSetId,
      planJson,
      planMarkdown,
    }: {
      changeSetId: string;
      planJson: PlanJson;
      planMarkdown?: string;
    }) => changeSetService.updatePlan(changeSetId, planJson, planMarkdown),
    onSuccess: (data) => {
      qc.setQueryData(changeSetKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: changeSetKeys.session(data.chat_session_id) });
    },
  });
}

export function useRollbackChangeSetMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changeSetId: string) => changeSetService.rollback(changeSetId),
    onSuccess: (data) => {
      qc.setQueryData(changeSetKeys.detail(data.id), data);
      qc.invalidateQueries({ queryKey: changeSetKeys.session(data.chat_session_id) });
    },
  });
}

export function useCancelChangeSetMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changeSetId: string) => changeSetService.cancel(changeSetId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: changeSetKeys.session(data.chat_session_id) });
    },
  });
}
