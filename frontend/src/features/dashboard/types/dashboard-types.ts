export type DashboardMetrics = {

  repositories_count?: number;
  chat_count?: number;
  indexed_chunks_count?: number;
};

export type DashboardUsage = {
  [key: string]: unknown;
};

export type RecentRepository = {
  id: string;
  repo_id: string;
  default_branch: string;
  created_at: string;
  latest_index_status?: string | null;
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
  recent_repositories: RecentRepository[];
};
