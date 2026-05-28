import { apiClient } from "@/core/api/client";
import { PaginatedData as PaginatedPayload } from "@/core/api/types";
import type {
  AddRepositoryPayload,
  IndexProgress,
  IndexRequestPayload,
  IndexResponse,
  RepositoryRecord,
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
};
