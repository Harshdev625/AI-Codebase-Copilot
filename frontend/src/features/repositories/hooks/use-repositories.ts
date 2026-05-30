import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repositoryService } from '../services/repository-service';
import { useToast } from '@/components/shared/toast-provider';
import { toApiError } from '@/core/api/errors';
import type { AddRepositoryPayload, IndexRequestPayload } from '@/features/repositories/types/repository-types';


export function useRepositories(limit = 100, offset = 0) {
  const query = useQuery({
    queryKey: ['repositories', 'list', limit, offset],
    queryFn: () => repositoryService.listRepositories(limit, offset),
    staleTime: 20_000,
  });

  return {
    repositories: query.data?.items ?? [],
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

export function useAddRepository() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: AddRepositoryPayload) => repositoryService.addRepository(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repositories', 'list'] });
      toast.success('Repository Added', 'Source has been linked successfully.');
    },
    onError: (error) => {
      toast.error('Failed to Add Repository', toApiError(error));
    },
  });
}

export function useIndexRepository() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: IndexRequestPayload) => repositoryService.startIndex(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repositories', 'list'] });
      toast.info('Indexing Started', 'The repository is being processed.');
    },
    onError: (error) => {
      toast.error('Indexing Failed', toApiError(error));
    },
  });
}
