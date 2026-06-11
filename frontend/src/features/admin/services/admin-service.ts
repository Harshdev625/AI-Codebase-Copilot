import { apiClient } from "@/core/api/client";
import { PaginatedData } from "@/core/api/types";
import type { Repository } from "@/features/repositories/types/repository-types";

export interface SystemMetrics {
  users_count?: number;
  repositories_count?: number;
  indexed_chunks_count?: number;
  indexed_files_count?: number;
  patch_count?: number;
  snapshot_count?: number;
  active_sessions?: number;
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

export interface TelemetryResponse {
  active_streams: number;
  indexing_queue_depth: number;
  indexing_running: number;
  queue_health: {
    total_jobs: number;
    failed_jobs: number;
    failure_rate_pct: number;
  };
  retrieval_hit_profile: {
    sample_size: number;
    top1_hit_rate_pct: number;
    top3_hit_rate_pct: number;
    zero_hit_rate_pct: number;
  };
  model_latency: {
    avg_ms: number;
    p50_ms: number;
    p95_ms: number;
    samples_ms: number[];
  };
}

export interface RecentActivityResponse {
  indexing_jobs: PaginatedData<IndexingJob>;
  recent_users: PaginatedData<AdminUser>;
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
  telemetry: async (): Promise<TelemetryResponse> => {
    return apiClient<TelemetryResponse>("/v1/admin/telemetry", { method: "GET" });
  },
  recentActivity: async (): Promise<RecentActivityResponse> => {
    return apiClient<RecentActivityResponse>("/v1/admin/recent-activity", { method: "GET" });
  },
};
