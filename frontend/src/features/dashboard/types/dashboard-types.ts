export type DashboardMetrics = {
  repositories_count?: number;
  chat_count?: number;
  indexed_chunks_count?: number;
  indexed_files_count?: number;
  active_indexing_jobs?: number;
  last_activity_at?: string | null;
};

export type IndexingSummary = {
  ready: number;
  indexing: number;
  failed: number;
  idle: number;
};

export type DashboardRecentSession = {
  id: string;
  session_title: string | null;
  session_mode: string;
  repository_id: string | null;
  updated_at: string | null;
  last_activity_at: string | null;
};

export type DashboardRecentRepository = {
  id: string;
  repo_id: string;
  default_branch: string;
  created_at: string | null;
  latest_job_status?: string | null;
  latest_index_status?: string | null;
  latest_job_message?: string | null;
  last_commit_sha?: string | null;
  indexed_files_count?: number;
  indexed_chunks_count?: number;
  last_indexed_at?: string | null;
};

export type DashboardActivityDay = {
  date: string;
  sessions: number;
  indexing_jobs_completed: number;
};

export type DashboardSummary = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    token_scopes: string[];
    is_active: boolean;
  };
  metrics: DashboardMetrics;
  indexing_summary?: IndexingSummary;
  recent_sessions?: DashboardRecentSession[];
  recent_repositories?: DashboardRecentRepository[];
};

export type DashboardActivityResponse = {
  days: DashboardActivityDay[];
};
