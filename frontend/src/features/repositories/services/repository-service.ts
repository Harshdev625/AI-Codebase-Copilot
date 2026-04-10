import { apiClient } from '@/api/api-client';
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

const unwrap = <T>(response: { data: ApiEnvelope<T> }): T => {
  if (!response.data.success) {
    throw new Error(response.data.error || 'Request failed');
  }
  return response.data.data;
};

export const repositoryService = {
  // Projects
  listProjects: async (): Promise<Project[]> => {
    const response = await apiClient.get<ApiEnvelope<Project[]>>('/projects');
    return unwrap(response);
  },
  createProject: async (payload: { name: string; description?: string }): Promise<Project> => {
    const response = await apiClient.post<ApiEnvelope<Project>>('/projects', payload);
    return unwrap(response);
  },

  // Repositories
  listByProject: async (projectId: string): Promise<Repository[]> => {
    const response = await apiClient.get<ApiEnvelope<Repository[]>>(`/projects/${projectId}/repositories`);
    return unwrap(response);
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
