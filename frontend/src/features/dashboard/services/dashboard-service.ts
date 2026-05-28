import { apiClient } from "@/core/api/client";
import type { DashboardSummary } from "@/features/dashboard/types/dashboard-types";

export const dashboardService = {
  getSummary(): Promise<DashboardSummary> {
    return apiClient<DashboardSummary>("/v1/dashboard/me", {
      method: "GET",
    });
  },
};
