import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { contextEntryService } from "@/features/chat/services/context-entry-service";

export const contextEntryKeys = {
  all: (sessionId: string | null) => ["context-entries", sessionId] as const,
};

export function useContextEntries(sessionId: string | null) {
  return useQuery({
    queryKey: contextEntryKeys.all(sessionId),
    queryFn: () => contextEntryService.list(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000,
    select: (data) => data.entries ?? [],
  });
}

export function useRemoveContextEntryMutation(sessionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: number) => contextEntryService.remove(sessionId!, entryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contextEntryKeys.all(sessionId) });
    },
  });
}
