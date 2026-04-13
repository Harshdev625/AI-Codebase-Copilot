import { apiClient } from '@/lib/api';
import { 
  Project, 
  Repository, 
  AddRepositoryPayload, 
  IndexResponse, 
  IndexRepositoryPayload, 
  IndexProgressResponse 
} from '../types/repository-types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

interface PaginatedData<T> {
  items: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

const unwrap = <T>(response: { data: ApiEnvelope<T> }): T => {
  if (!response.data.success) {
    throw new Error(response.data.error || 'Request failed');
  }
  return response.data.data;
};

const unwrapItems = <T>(response: { data: ApiEnvelope<PaginatedData<T>> }): T[] => {
  const data = unwrap(response);
  if (data && typeof data === 'object' && Array.isArray((data as PaginatedData<T>).items)) {
    return (data as PaginatedData<T>).items;
  }
  throw new Error('Invalid paginated response payload');
};

export const repositoryService = {
  // Projects
  listProjects: async (): Promise<Project[]> => {
    const response = await apiClient.get<ApiEnvelope<PaginatedData<Project>>>('/projects');
    return unwrapItems(response);
  },
  createProject: async (payload: { name: string; description?: string }): Promise<Project> => {
    const response = await apiClient.post<ApiEnvelope<Project>>('/projects', payload);
    return unwrap(response);
  },

  // Repositories
  listByProject: async (projectId: string): Promise<Repository[]> => {
    const response = await apiClient.get<ApiEnvelope<PaginatedData<Repository>>>(`/projects/${projectId}/repositories`);
    return unwrapItems(response);
  },
  add: async (projectId: string, payload: AddRepositoryPayload): Promise<Repository> => {
    const response = await apiClient.post<ApiEnvelope<Repository>>(`/projects/${projectId}/repositories`, payload);
    return unwrap(response);
  },
  index: async (payload: IndexRepositoryPayload): Promise<IndexResponse> => {
    const response = await apiClient.post<ApiEnvelope<IndexResponse>>('/index', payload);
    return unwrap(response);
  },
  getIndexProgress: async (snapshotId: string): Promise<IndexProgressResponse> => {
    const response = await apiClient.get<ApiEnvelope<IndexProgressResponse>>(`/index/progress/${snapshotId}`);
    return unwrap(response);
  },
};
