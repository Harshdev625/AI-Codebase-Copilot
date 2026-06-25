import { apiClient } from "@/core/api/client";
import type { ChangeSet, PlanJson } from "@/features/change-sets/types/change-set-types";

export const changeSetService = {
  getForSession(sessionId: string): Promise<ChangeSet | null> {
    return apiClient<ChangeSet | null>("/v1/change-sets", {
      params: { session_id: sessionId },
    });
  },

  get(changeSetId: string): Promise<ChangeSet> {
    return apiClient<ChangeSet>(`/v1/change-sets/${changeSetId}`);
  },

  updatePlan(changeSetId: string, planJson: PlanJson, planMarkdown?: string): Promise<ChangeSet> {
    return apiClient<ChangeSet>(`/v1/change-sets/${changeSetId}/plan`, {
      method: "PATCH",
      body: { plan_json: planJson, plan_markdown: planMarkdown },
    });
  },

  revise(changeSetId: string, feedback: string): Promise<ChangeSet> {
    return apiClient<ChangeSet>(`/v1/change-sets/${changeSetId}/revise`, {
      method: "POST",
      body: { feedback },
    });
  },

  approve(changeSetId: string): Promise<ChangeSet> {
    return apiClient<ChangeSet>(`/v1/change-sets/${changeSetId}/approve`, {
      method: "POST",
    });
  },

  startAct(changeSetId: string): Promise<ChangeSet> {
    return apiClient<ChangeSet>(`/v1/change-sets/${changeSetId}/act`, {
      method: "POST",
    });
  },

  cancel(changeSetId: string): Promise<ChangeSet> {
    return apiClient<ChangeSet>(`/v1/change-sets/${changeSetId}/cancel`, {
      method: "POST",
    });
  },

  rollback(changeSetId: string): Promise<ChangeSet> {
    return apiClient<ChangeSet>(`/v1/change-sets/${changeSetId}/rollback`, {
      method: "POST",
    });
  },
};
