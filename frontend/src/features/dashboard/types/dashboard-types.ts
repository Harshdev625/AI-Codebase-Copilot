import { User } from '@/store/auth-store';

export interface DashboardMetrics {
  projects_count: number;
  repositories_count: number;
  indexed_chunks_count: number;
  chat_count: number;
}

export interface DashboardUsage {
  plan_tier: 'free' | 'pro' | 'enterprise';
  limits: {
    requests_per_day: number;
    queries_per_day: number;
    queries_per_project_per_day: number;
    index_jobs_per_day: number;
    index_jobs_per_project_per_day: number;
    indexing_volume_chunks_per_day: number;
    max_projects: number;
    max_repositories_per_project: number;
  };
  usage_today: {
    requests: number;
    queries: number;
    index_jobs: number;
    indexing_volume_chunks: number;
    tokens_in: number;
    tokens_out: number;
  };
}

export interface RecentRepository {
  id: string;
  repo_id: string;
  default_branch: string;
  created_at: string;
  latest_index_status: string | null;
}

export interface DashboardSummary {
  user: User;
  metrics: DashboardMetrics;
  usage: DashboardUsage;
  recent_repositories: RecentRepository[];
}
