import { apiClient } from "@/core/api/client";
import { PaginatedData as PaginatedPayload } from "@/core/api/types";
import type {
  AddRepositoryPayload,
  IndexProgress,
  IndexRequestPayload,
  IndexResponse,
  RepositoryRecord,
  RepositorySnapshot,
  SnapshotUpdateRequest,
  SnapshotDiffResponse,
  TreeResponse,
  RetrievalItem,
  WorkspaceSearchPayload,
  WorkspaceSearchResponse,
} from "@/features/repositories/types/repository-types";

export const repositoryService = {
  listRepositories(limit = 100, offset = 0): Promise<PaginatedPayload<RepositoryRecord>> {
    return apiClient<PaginatedPayload<RepositoryRecord>>("/v1/repositories", {
      method: "GET",
      params: { limit, offset },
    });
  },

  addRepository(payload: AddRepositoryPayload): Promise<RepositoryRecord> {
    return apiClient<RepositoryRecord>("/v1/repositories", {
      method: "POST",
      body: payload,
    });
  },

  deleteRepository(repositoryId: string): Promise<{ deleted: boolean }> {
    return apiClient<{ deleted: boolean }>(`/v1/repositories/${repositoryId}`, {
      method: "DELETE",
    });
  },

  startIndex(payload: IndexRequestPayload): Promise<IndexResponse> {
    return apiClient<IndexResponse>("/v1/index", {
      method: "POST",
      body: {
        commit_sha: "local-working-copy",
        ...payload,
      },
    });
  },

  getIndexProgress(indexingJobId: string): Promise<IndexProgress> {
    return apiClient<IndexProgress>("/v1/index/progress/" + indexingJobId, {
      method: "GET",
    });
  },

  listSnapshots(repositoryId: string): Promise<{ snapshots: RepositorySnapshot[]; total: number }> {
    return apiClient<{ snapshots: RepositorySnapshot[]; total: number }>(`/v1/repositories/${repositoryId}/snapshots`, {
      method: "GET",
    });
  },

  updateSnapshot(
    repositoryId: string,
    snapshotId: string,
    payload: SnapshotUpdateRequest
  ): Promise<{ updated: boolean }> {
    return apiClient<{ updated: boolean }>(`/v1/repositories/${repositoryId}/snapshots/${snapshotId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  getSnapshotDiff(
    repositoryId: string,
    snapshotId: string,
    compareWith: string
  ): Promise<SnapshotDiffResponse> {
    return apiClient<SnapshotDiffResponse>(`/v1/repositories/${repositoryId}/snapshots/${snapshotId}/diff`, {
      method: "GET",
      params: { compare_with: compareWith },
    });
  },

  getTree(
    repositoryId: string,
    path?: string,
    snapshotId?: string,
    patchId?: string,
    cursor?: string,
    limit = 100,
  ): Promise<TreeResponse> {
    const params: Record<string, string> = { limit: String(limit) };
    if (path) params.path = path;
    if (snapshotId) params.snapshot_id = snapshotId;
    if (patchId) params.patch_id = patchId;
    if (cursor) params.cursor = cursor;

    return apiClient<TreeResponse>(`/v1/repositories/${repositoryId}/tree`, {
      method: "GET",
      params,
    });
  },

  getFileContent(
    repositoryId: string,
    path: string,
    commitSha?: string
  ): Promise<{ path: string; content: string; language: string; size_bytes: number }> {
    const params: Record<string, string> = { path };
    if (commitSha) params.commit_sha = commitSha;

    return apiClient<{ path: string; content: string; language: string; size_bytes: number }>(
      `/v1/repositories/${repositoryId}/file`,
      {
        method: "GET",
        params,
      }
    );
  },

  listIndexingJobs(repositoryId?: string): Promise<any[]> {
    const params: Record<string, string> = {};
    if (repositoryId) params.repository_id = repositoryId;
    return apiClient<any[]>('/v1/indexing-jobs', {
      method: "GET",
      params,
    });
  },

  retrieveRepository(
    repositoryId: string,
    payload: { query: string; top_k?: number }
  ): Promise<{ items: RetrievalItem[] }> {
    return apiClient<{ items: RetrievalItem[] }>(`/v1/repositories/${repositoryId}/retrieve`, {
      method: "POST",
      body: payload,
    });
  },

  searchWorkspace(
    repositoryId: string,
    payload: WorkspaceSearchPayload,
  ): Promise<WorkspaceSearchResponse> {
    return apiClient<WorkspaceSearchResponse>(`/v1/repositories/${repositoryId}/search`, {
      method: "POST",
      body: payload,
    });
  },

  searchFiles(
    repositoryId: string,
    q: string,
    limit = 20,
  ): Promise<{ items: Array<{ path: string; type: string; extension?: string | null }> }> {
    return apiClient<{ items: Array<{ path: string; type: string; extension?: string | null }> }>(
      `/v1/repositories/${repositoryId}/files/search`,
      {
        method: "GET",
        params: { q, limit: String(limit) },
      },
    );
  },

  getContextTokens(repositoryId: string, payload: { scope_paths?: string[]; attached_files?: string[]; retrieval_query?: string }): Promise<{ attached_tokens: number; scope_tokens: number; retrieval_tokens: number; total_tokens: number; repository_total_tokens: number; max_tokens: number }> {
    return apiClient<{ attached_tokens: number; scope_tokens: number; retrieval_tokens: number; total_tokens: number; repository_total_tokens: number; max_tokens: number }>(`/v1/repositories/${repositoryId}/context-tokens`, {
      method: "POST",
      body: payload,
    });
  },

  getInsights(repositoryId: string): Promise<any> {
    return apiClient<any>(`/v1/repositories/${repositoryId}/insights`, {
      method: "GET",
    });
  },

  listSkippedFiles(
    repositoryId: string,
    params?: { limit?: number; offset?: number; reason?: string },
  ): Promise<{
    items: Array<{ path: string; skip_reason: string; size_bytes?: number | null; extension?: string | null }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const query: Record<string, string> = {};
    if (params?.limit != null) query.limit = String(params.limit);
    if (params?.offset != null) query.offset = String(params.offset);
    if (params?.reason) query.reason = params.reason;
    return apiClient(`/v1/repositories/${repositoryId}/files/skipped`, {
      method: "GET",
      params: query,
    });
  },

  listPatches(repositoryId: string): Promise<any[]> {
    return apiClient<any[]>(`/v1/repositories/${repositoryId}/patches`, {
      method: "GET",
    });
  },

  getPatch(repositoryId: string, patchId: string): Promise<any> {
    return apiClient<any>(`/v1/repositories/${repositoryId}/patches/${patchId}`, {
      method: "GET",
    });
  },

  deletePatch(repositoryId: string, patchId: string): Promise<any> {
    return apiClient<any>(`/v1/repositories/${repositoryId}/patches/${patchId}`, {
      method: "DELETE",
    });
  },

  validatePatch(repositoryId: string, patchId: string): Promise<any> {
    return apiClient<any>(`/v1/repositories/${repositoryId}/patches/${patchId}/validate`, {
      method: "POST",
    });
  },

  applyPatch(repositoryId: string, patchId: string): Promise<any> {
    return apiClient<any>(`/v1/repositories/${repositoryId}/patches/${patchId}/apply`, {
      method: "POST",
    });
  },
};
