import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboard-service';

export const dashboardKeys = {
  summary: ['dashboard', 'summary'] as const,
  activity: (days: number) => ['dashboard', 'activity', days] as const,
};

export function useDashboard() {
  const query = useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: dashboardService.getSummary,
    staleTime: 30000,
  });

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useDashboardActivity(days = 7) {
  return useQuery({
    queryKey: dashboardKeys.activity(days),
    queryFn: () => dashboardService.getActivity(days),
    staleTime: 60000,
  });
}
