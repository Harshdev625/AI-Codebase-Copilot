import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { repositoryService } from '../services/repository-service';
import { useToast } from '@/components/shared/toast-provider';
import { toApiError } from '@/core/api/errors';
import type { AddRepositoryPayload, IndexRequestPayload } from '@/features/repositories/types/repository-types';
import { isActiveIndexingStatus } from '@/features/dashboard/utils/indexing-status';


export function useRepositories(limit = 100, offset = 0) {
  const query = useQuery({
    queryKey: ['repositories', 'list', limit, offset],
    queryFn: () => repositoryService.listRepositories(limit, offset),
    staleTime: 20_000,
    refetchInterval: (query) => {
      const isAnyRunning = query.state.data?.items.some((r) =>
        isActiveIndexingStatus(r.latest_job_status),
      );
      return isAnyRunning ? 3000 : false;
    },
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
      void queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] });
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
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['repositories', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['indexing-jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['admin'] });

      const jobId = data.indexing_job_id;
      const repositoryId = variables.repository_id;
      if (jobId && repositoryId) {
        const optimisticJob = {
          id: jobId,
          repository_id: repositoryId,
          status: 'pending',
          message: 'Queued for indexing…',
          stats: { percentage: 0, current_stage: 'queued' },
          started_at: null,
          trigger_type: 'manual',
        };
        queryClient.setQueryData(['indexing-jobs', undefined], (old: unknown) => {
          const jobs = Array.isArray(old) ? old : [];
          if (jobs.some((job: { id?: string }) => job.id === jobId)) return jobs;
          return [optimisticJob, ...jobs];
        });
      }

      toast.info('Indexing Started', 'The repository is being processed.');
    },
    onError: (error) => {
      toast.error('Indexing Failed', toApiError(error));
    },
  });
}

export function useSnapshots(repositoryId: string) {
  return useQuery({
    queryKey: ['repositories', repositoryId, 'snapshots'],
    queryFn: () => repositoryService.listSnapshots(repositoryId),
    enabled: !!repositoryId,
    staleTime: 10_000,
  });
}

export function useUpdateSnapshotMutation(repositoryId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ snapshotId, payload }: { snapshotId: string; payload: any }) =>
      repositoryService.updateSnapshot(repositoryId, snapshotId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repositories', repositoryId, 'snapshots'] });
      toast.success('Snapshot Updated', 'The snapshot settings have been saved.');
    },
    onError: (error) => {
      toast.error('Failed to Update Snapshot', toApiError(error));
    },
  });
}

export function useSnapshotDiff(repositoryId: string, snapshotId: string, compareWithId: string) {
  return useQuery({
    queryKey: ['repositories', repositoryId, 'snapshots', snapshotId, 'diff', compareWithId],
    queryFn: () => repositoryService.getSnapshotDiff(repositoryId, snapshotId, compareWithId),
    enabled: !!repositoryId && !!snapshotId && !!compareWithId,
    staleTime: 30_000,
  });
}

export function useRepositoryTree(
  repositoryId: string,
  path?: string,
  snapshotId?: string,
  patchId?: string
) {
  return useQuery({
    queryKey: ['repositories', repositoryId, 'tree', path, snapshotId, patchId],
    queryFn: () => repositoryService.getTree(repositoryId, path, snapshotId, patchId),
    enabled: !!repositoryId,
    staleTime: 60_000,
  });
}

export function useRepositoryInsights(repositoryId: string) {
  return useQuery({
    queryKey: ['repositories', repositoryId, 'insights'],
    queryFn: () => repositoryService.getInsights(repositoryId),
    enabled: !!repositoryId,
    staleTime: 60_000,
  });
}

export function useContextTokens(repositoryId: string, payload: { scope_paths?: string[]; attached_files?: string[]; retrieval_query?: string }) {
  return useQuery({
    queryKey: ['repositories', repositoryId, 'context-tokens', payload.scope_paths, payload.attached_files, payload.retrieval_query],
    queryFn: () => repositoryService.getContextTokens(repositoryId, payload),
    enabled: !!repositoryId,
    staleTime: 60_000,
  });
}

export function useProjectRetrieveMutation(projectId: string) {
  return useMutation({
    mutationFn: (payload: { query: string; repository_ids: string[]; top_k?: number }) =>
      repositoryService.retrieveProject(projectId, payload),
  });
}

export function useRepositoryRetrieveMutation(repositoryId: string) {
  return useMutation({
    mutationFn: (payload: { query: string; top_k?: number }) =>
      repositoryService.retrieveRepository(repositoryId, payload),
  });
}

export function useIndexingJobs(repositoryId?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['indexing-jobs', repositoryId],
    queryFn: () => repositoryService.listIndexingJobs(repositoryId),
    refetchInterval: (query) => {
      const isAnyRunning = query.state.data?.some((job: { status?: string }) =>
        isActiveIndexingStatus(job.status),
      );
      return isAnyRunning ? 3000 : false;
    },
  });

  const prevData = React.useRef(query.data);
  React.useEffect(() => {
    if (prevData.current && query.data) {
      const prevRunning = prevData.current.some((job: { status?: string }) =>
        isActiveIndexingStatus(job.status),
      );
      const nowRunning = query.data.some((job: { status?: string }) =>
        isActiveIndexingStatus(job.status),
      );
      if (prevRunning && !nowRunning && repositoryId) {
        void queryClient.invalidateQueries({ queryKey: ['repositories', repositoryId, 'insights'] });
      }
    }
    prevData.current = query.data;
  }, [query.data, queryClient, repositoryId]);

  return query;
}

export function usePatches(repositoryId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['patches', repositoryId],
    queryFn: () => repositoryService.listPatches(repositoryId),
    enabled: !!repositoryId,
    refetchInterval: (query) => {
      const isAnyRunning = query.state.data?.some(
        (patch: any) =>
          patch.status === 'VALIDATING' ||
          patch.status === 'REVIEW' ||   // backend in-progress validation
          patch.status === 'APPLYING'
      );
      return isAnyRunning ? 2000 : false;
    },
  });

  const prevData = React.useRef(query.data);
  React.useEffect(() => {
    if (prevData.current && query.data) {
      const prevApplying = prevData.current.some((patch: any) => patch.status === 'APPLYING');
      const nowApplying = query.data.some((patch: any) => patch.status === 'APPLYING');
      if (prevApplying && !nowApplying && repositoryId) {
        void queryClient.invalidateQueries({ queryKey: ['repositories', repositoryId, 'tree'] });
        void queryClient.invalidateQueries({ queryKey: ['repositories', repositoryId, 'insights'] });
      }
    }
    prevData.current = query.data;
  }, [query.data, queryClient, repositoryId]);

  return query;
}

export function usePatch(repositoryId: string, patchId: string | null) {
  return useQuery({
    queryKey: ['patches', repositoryId, patchId],
    queryFn: () => repositoryService.getPatch(repositoryId, patchId!),
    enabled: !!repositoryId && !!patchId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'VALIDATING' ||
             status === 'REVIEW' || // backend in-progress validation
             status === 'APPLYING'
        ? 2000
        : false;
    },
  });
}

export function useDeletePatchMutation(repositoryId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (patchId: string) => repositoryService.deletePatch(repositoryId, patchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patches', repositoryId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] });
      toast.success('Patch Deleted', 'The patch has been removed successfully.');
    },
    onError: (error) => {
      toast.error('Failed to delete patch', toApiError(error));
    },
  });
}

export function useValidatePatchMutation(repositoryId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (patchId: string) => repositoryService.validatePatch(repositoryId, patchId),
    onSuccess: (_, patchId) => {
      void queryClient.invalidateQueries({ queryKey: ['patches', repositoryId] });
      void queryClient.invalidateQueries({ queryKey: ['patches', repositoryId, patchId] });
      toast.info('Validation Started', 'The patch validation is in progress.');
    },
    onError: (error) => {
      toast.error('Validation Error', toApiError(error));
    },
  });
}

export function useApplyPatchMutation(repositoryId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (patchId: string) => repositoryService.applyPatch(repositoryId, patchId),
    onSuccess: (_, patchId) => {
      void queryClient.invalidateQueries({ queryKey: ['patches', repositoryId] });
      void queryClient.invalidateQueries({ queryKey: ['patches', repositoryId, patchId] });
      void queryClient.invalidateQueries({ queryKey: ['repositories'] });
      void queryClient.invalidateQueries({ queryKey: ['indexing-jobs', repositoryId] });
      void queryClient.invalidateQueries({ queryKey: ['chat'] });
      void queryClient.invalidateQueries({ queryKey: ['snapshots'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'metrics'] });
      toast.success('Patch Applied', 'The patch has been successfully applied to the repository.');
    },
    onError: (error) => {
      toast.error('Apply Error', toApiError(error));
    },
  });
}
