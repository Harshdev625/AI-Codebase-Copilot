import { useQuery } from "@tanstack/react-query";

import { adminService } from "../services/admin-service";

export const adminKeys = {
  metrics: ["admin", "metrics"] as const,
  health: ["admin", "health"] as const,
  users: ["admin", "users"] as const,
  repositories: ["admin", "repositories"] as const,
  indexing: ["admin", "indexing"] as const,
};

export function useAdminDashboard() {
  const metricsQuery = useQuery({
    queryKey: adminKeys.metrics,
    queryFn: () => adminService.metrics(),
  });

  const healthQuery = useQuery({
    queryKey: adminKeys.health,
    queryFn: () => adminService.health(),
  });

  const usersQuery = useQuery({
    queryKey: adminKeys.users,
    queryFn: async () => {
      const data = await adminService.users();
      return data.items;
    },
  });

  const repositoriesQuery = useQuery({
    queryKey: adminKeys.repositories,
    queryFn: async () => {
      const data = await adminService.repositories();
      return data.items;
    },
  });

  const indexingQuery = useQuery({
    queryKey: adminKeys.indexing,
    queryFn: async () => {
      const data = await adminService.indexingStatus();
      return data.items;
    },
  });

  return {
    metricsQuery,
    healthQuery,
    usersQuery,
    repositoriesQuery,
    indexingQuery,
  };
}
