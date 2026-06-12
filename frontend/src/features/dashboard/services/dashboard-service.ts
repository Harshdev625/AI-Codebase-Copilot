import { apiClient } from '@/core/api/client';
import type { DashboardActivityResponse, DashboardSummary } from '@/features/dashboard/types/dashboard-types';

export const dashboardService = {
  getSummary(): Promise<DashboardSummary> {
    return apiClient<DashboardSummary>('/v1/dashboard/me', {
      method: 'GET',
    });
  },
  getActivity(days = 7): Promise<DashboardActivityResponse> {
    return apiClient<DashboardActivityResponse>('/v1/dashboard/activity', {
      method: 'GET',
      params: { days },
    });
  },
};
