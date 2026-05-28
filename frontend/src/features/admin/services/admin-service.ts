import { apiClient } from "@/core/api/client";
import { PaginatedData } from "@/core/api/types";
import type { Repository } from "@/features/repositories/types/repository-types";

export interface SystemMetrics {
  users_count?: number;
  repositories_count?: number;
  indexed_chunks_count?: number;
}

export interface ServiceHealth {
  name: string;
  status: string;
  detail?: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  created_at?: string;
}

export interface IndexingJob {
  id: string;
  repository_id: string;
  status: string;
  message?: string;
  created_at: string;
}

export const adminService = {
  metrics: async (): Promise<SystemMetrics> => {
    return apiClient<SystemMetrics>("/v1/admin/system-metrics", { method: "GET" });
  },
  health: async (): Promise<ServiceHealth[]> => {
    return apiClient<ServiceHealth[]>("/v1/admin/service-health", { method: "GET" });
  },
  users: async (): Promise<PaginatedData<AdminUser>> => {
    return apiClient<PaginatedData<AdminUser>>("/v1/admin/users", { method: "GET" });
  },
  repositories: async (): Promise<PaginatedData<Repository>> => {
    return apiClient<PaginatedData<Repository>>("/v1/admin/repositories", { method: "GET" });
  },
  indexingStatus: async (): Promise<PaginatedData<IndexingJob>> => {
    return apiClient<PaginatedData<IndexingJob>>("/v1/admin/indexing-status", { method: "GET" });
  },
  updateUserRole: async (userId: string, role: "USER" | "ADMIN"): Promise<AdminUser> => {
    return apiClient<AdminUser>(`/v1/admin/users/${userId}/role`, {
      method: "POST",
      body: { role },
    });
  },
  updateUserStatus: async (userId: string, is_active: boolean): Promise<AdminUser> => {
    return apiClient<AdminUser>(`/v1/admin/users/${userId}/status`, {
      method: "POST",
      body: { is_active },
    });
  },
  deleteUser: async (userId: string): Promise<{ deleted: boolean }> => {
    return apiClient<{ deleted: boolean }>(`/v1/admin/users/${userId}`, {
      method: "DELETE",
    });
  },
};
