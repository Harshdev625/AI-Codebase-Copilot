import type { QueryClient } from "@tanstack/react-query";

import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";

/** Invalidate all client caches that reflect indexing / repository stats. */
export function invalidateIndexingCaches(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["repositories", "list"] });
  void queryClient.invalidateQueries({ queryKey: ["indexing-jobs"] });
  void queryClient.invalidateQueries({ queryKey: ["index-progress"] });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.summary });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["admin"] });
}

export function isTerminalIndexingStatus(status?: string | null): boolean {
  const normalized = (status ?? "").toLowerCase();
  return (
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "success" ||
    normalized === "failed" ||
    normalized === "error"
  );
}
