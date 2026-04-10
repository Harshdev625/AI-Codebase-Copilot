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
  updated_at?: string;
  latest_snapshot_id?: string | null;
  latest_index_status?: string | null;
  latest_index_stats?: Record<string, unknown> | null;
  latest_indexed_chunks?: number | null;
  has_completed_index?: boolean;
  indexing_version?: number;
}

export interface AddRepositoryPayload {
  repo_id: string;
  remote_url?: string;
  local_path?: string;
  default_branch?: string;
}

export interface IndexRepositoryPayload {
  repository_id: string;
  commit_sha?: string;
  repo_ref?: string;
}

export interface IndexResponse {
  indexed_chunks: number;
  status: 'ok';
  snapshot_id?: string | null;
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
