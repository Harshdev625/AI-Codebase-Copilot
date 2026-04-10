import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repositoryService } from '../services/repository-service';
import { useToast } from '@/components/shared/toast-provider';
import { getApiErrorMessage } from '@/api/api-client';

export function useProjects() {
  const query = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: repositoryService.listProjects,
  });

  return {
    projects: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: repositoryService.createProject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
      toast.success('Project Created', `"${data.name}" has been established.`);
    },
    onError: (error) => {
      toast.error('Project Creation Failed', getApiErrorMessage(error));
    },
  });
}

export function useRepositories(projectId: string) {
  const query = useQuery({
    queryKey: ['repositories', 'list', projectId],
    queryFn: () => repositoryService.listByProject(projectId),
    enabled: !!projectId,
  });

  return {
    repositories: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useAddRepository() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ projectId, payload }: { projectId: string; payload: any }) => 
      repositoryService.add(projectId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['repositories', 'list', variables.projectId] });
      toast.success('Repository Added', 'Source has been linked to the project.');
    },
    onError: (error) => {
      toast.error('Failed to Add Repository', getApiErrorMessage(error));
    },
  });
}

export function useIndexRepository() {
  const toast = useToast();

  return useMutation({
    mutationFn: repositoryService.index,
    onSuccess: () => {
      toast.info('Indexing Started', 'The repository is being processed.');
    },
    onError: (error) => {
      toast.error('Indexing Failed', getApiErrorMessage(error));
    },
  });
}
