import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboard-service';

export function useDashboard() {
  const query = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardService.getSummary,
    staleTime: 30000, // 30 seconds
  });

  return {
    summary: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
