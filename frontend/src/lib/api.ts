import axios, { AxiosError, type AxiosResponse } from "axios";

import { getAccessToken, type AuthUser } from "@/lib/auth";
import { useAuthStore } from "@/store/auth-store";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:8000/v1";

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface DashboardSummary {
  user: AuthUser;
  metrics: {
    projects_count?: number;
    repositories_count?: number;
    indexed_chunks_count?: number;
  };
  recent_repositories: Array<{
    id: string;
    repo_id: string;
    default_branch: string;
    created_at: string;
    latest_index_status?: string | null;
  }>;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  created_by: string;
  created_at: string;
}

export interface Repository {
  id: string;
  project_id: string;
  repo_id: string;
  remote_url?: string | null;
  local_path?: string | null;
  default_branch: string;
  created_at: string;
  latest_snapshot_id?: string | null;
  latest_index_status?: string | null;
  latest_index_stats?: Record<string, unknown> | null;
  latest_indexed_chunks?: number | null;
  has_completed_index?: boolean;
}

export interface IndexResponse {
  indexed_chunks: number;
  status: "ok";
  snapshot_id?: string | null;
}

export interface ChatResponse {
  answer: string;
  intent: string;
  sources: Array<Record<string, unknown>>;
}

export interface IndexProgressResponse {
  snapshot_id: string;
  index_status: string;
  job_status: string;
  message: string;
  total_files: number;
  processed_files: number;
  percentage: number;
  current_file?: string | null;
  eta_seconds?: number | null;
  stats?: Record<string, unknown>;
}

export interface AdminUser extends AuthUser {
  created_at?: string;
}

export interface SystemMetrics {
  users_count?: number;
  projects_count?: number;
  repositories_count?: number;
  indexed_chunks_count?: number;
}

export interface ServiceHealth {
  name: string;
  status: string;
  detail?: string | null;
}

export interface IndexingJob {
  id: string;
  repository_id: string;
  snapshot_id: string;
  status: string;
  message?: string;
  created_at: string;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token ?? getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/register")
      ) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>): T {
  if (!response.data.success) {
    throw new Error(response.data.error ?? "Request failed");
  }
  return response.data.data;
}

function unwrapItems<T>(response: AxiosResponse<ApiEnvelope<PaginatedData<T>>>): T[] {
  const data = unwrap(response);
  if (data && typeof data === "object" && Array.isArray((data as PaginatedData<T>).items)) {
    return (data as PaginatedData<T>).items;
  }
  throw new Error("Invalid paginated response payload");
}

export function toApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;

    if (payload && typeof payload === "object") {
      const envelope = payload as ApiEnvelope<unknown>;
      if (typeof envelope.error === "string" && envelope.error) {
        return envelope.error;
      }

      const shaped = payload as { message?: string; error?: string | { message?: string } };
      if (typeof shaped.message === "string" && shaped.message) {
        return shaped.message;
      }
      if (typeof shaped.error === "string" && shaped.error) {
        return shaped.error;
      }
      if (shaped.error && typeof shaped.error === "object" && typeof shaped.error.message === "string") {
        return shaped.error.message;
      }
    }

    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    if (detail) {
      return detail;
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error. Please try again.";
}

export const api = {
  auth: {
    register: async (payload: {
      email: string;
      password: string;
      full_name?: string;
    }): Promise<AuthUser> => {
      const response = await apiClient.post<ApiEnvelope<AuthUser>>("/auth/register", payload);
      return unwrap(response);
    },
    login: async (payload: {
      email: string;
      password: string;
    }): Promise<AuthTokenResponse> => {
      const response = await apiClient.post<ApiEnvelope<AuthTokenResponse>>("/auth/login", payload);
      return unwrap(response);
    },
    me: async (): Promise<AuthUser> => {
      const response = await apiClient.get<ApiEnvelope<AuthUser>>("/auth/me");
      return unwrap(response);
    },
  },
  dashboard: {
    me: async (): Promise<DashboardSummary> => {
      const response = await apiClient.get<ApiEnvelope<DashboardSummary>>("/dashboard/me");
      return unwrap(response);
    },
  },
  projects: {
    list: async (): Promise<Project[]> => {
      const response = await apiClient.get<ApiEnvelope<PaginatedData<Project>>>("/projects");
      return unwrapItems(response);
    },
    create: async (payload: {
      name: string;
      description?: string;
    }): Promise<Project> => {
      const response = await apiClient.post<ApiEnvelope<Project>>("/projects", payload);
      return unwrap(response);
    },
  },
  repositories: {
    listByProject: async (projectId: string): Promise<Repository[]> => {
      const response = await apiClient.get<ApiEnvelope<PaginatedData<Repository>>>(
        `/projects/${projectId}/repositories`
      );
      return unwrapItems(response);
    },
    add: async (
      projectId: string,
      payload: {
        repo_id: string;
        remote_url?: string;
        local_path?: string;
        default_branch?: string;
      }
    ): Promise<Repository> => {
      const response = await apiClient.post<ApiEnvelope<Repository>>(
        `/projects/${projectId}/repositories`,
        payload
      );
      return unwrap(response);
    },
    index: async (payload: {
      repository_id: string;
      commit_sha?: string;
      repo_ref?: string;
    }): Promise<IndexResponse> => {
      const response = await apiClient.post<ApiEnvelope<IndexResponse>>("/index", payload);
      return unwrap(response);
    },
    indexProgress: async (snapshotId: string): Promise<IndexProgressResponse> => {
      const response = await apiClient.get<ApiEnvelope<IndexProgressResponse>>(
        `/index/progress/${snapshotId}`
      );
      return unwrap(response);
    },
  },
  chat: {
    ask: async (payload: {
      repository_id: string;
      query: string;
    }): Promise<ChatResponse> => {
      const response = await apiClient.post<ApiEnvelope<ChatResponse>>("/chat", payload);
      return unwrap(response);
    },
  },
  admin: {
    metrics: async (): Promise<SystemMetrics> => {
      const response = await apiClient.get<ApiEnvelope<SystemMetrics>>("/admin/system-metrics");
      return unwrap(response);
    },
    health: async (): Promise<ServiceHealth[]> => {
      const response = await apiClient.get<ApiEnvelope<ServiceHealth[]>>("/admin/service-health");
      return unwrap(response);
    },
    users: async (): Promise<AdminUser[]> => {
      const response = await apiClient.get<ApiEnvelope<PaginatedData<AdminUser>>>("/admin/users");
      return unwrapItems(response);
    },
    repositories: async (): Promise<Repository[]> => {
      const response = await apiClient.get<ApiEnvelope<PaginatedData<Repository>>>("/admin/repositories");
      return unwrapItems(response);
    },
    indexingStatus: async (): Promise<IndexingJob[]> => {
      const response = await apiClient.get<ApiEnvelope<PaginatedData<IndexingJob>>>("/admin/indexing-status");
      return unwrapItems(response);
    },
    updateUserRole: async (userId: string, role: "USER" | "ADMIN"): Promise<AdminUser> => {
      const response = await apiClient.post<ApiEnvelope<AdminUser>>(`/admin/users/${userId}/role`, {
        role,
      });
      return unwrap(response);
    },
    updateUserStatus: async (userId: string, is_active: boolean): Promise<AdminUser> => {
      const response = await apiClient.post<ApiEnvelope<AdminUser>>(
        `/admin/users/${userId}/status`,
        { is_active }
      );
      return unwrap(response);
    },
    deleteUser: async (userId: string): Promise<{ deleted: boolean }> => {
      const response = await apiClient.delete<ApiEnvelope<{ deleted: boolean }>>(
        `/admin/users/${userId}`
      );
      return unwrap(response);
    },
  },
};
