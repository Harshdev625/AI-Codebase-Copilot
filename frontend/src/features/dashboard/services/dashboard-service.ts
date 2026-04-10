import { apiClient } from '@/api/api-client';
import { DashboardSummary } from '../types/dashboard-types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

const unwrap = <T>(response: { data: ApiEnvelope<T> }): T => {
  if (!response.data.success) {
    throw new Error(response.data.error || 'Request failed');
  }
  return response.data.data;
};

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    const response = await apiClient.get<ApiEnvelope<DashboardSummary>>('/dashboard/me');
    return unwrap(response);
  },
};
