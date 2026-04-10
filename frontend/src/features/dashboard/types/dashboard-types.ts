import { User } from '@/store/auth-store';

export interface DashboardMetrics {
  projects_count: number;
  repositories_count: number;
  indexed_chunks_count: number;
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
  recent_repositories: RecentRepository[];
}
