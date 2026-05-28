export type RepositoryRecord = {
  id: string;
  owner_user_id?: string | null;
  repo_id: string;
  remote_url: string | null;
  local_path: string | null;
  default_branch: string;
  created_at: string;
  latest_job_status?: string | null;
  latest_job_stats?: Record<string, unknown> | null;
  // Compatibility aliases consumed by older components.
  latest_index_status?: string | null;
  latest_index_stats?: Record<string, unknown> | null;
  latest_indexed_chunks?: number | null;
  updated_at?: string | null;
  indexing_version?: number | null;
};

export type Repository = RepositoryRecord;
export type Project = never;
export type ProjectRecord = never;
export type CreateProjectPayload = never;

export type AddRepositoryPayload = {
  repo_id: string;
  remote_url?: string | null;
  local_path?: string | null;
  default_branch?: string;
};

export type IndexRequestPayload = {
  repository_id?: string;
  repo_id?: string;
  repo_path?: string | null;
  repo_url?: string | null;
  repo_ref?: string | null;
  commit_sha?: string;
};

export type IndexResponse = {
  indexed_chunks: number;
  status: "ok";
  indexing_job_id?: string | null;
};

export type IndexProgress = {
  indexing_job_id: string;
  job_status: string;
  message: string;
  stats: {
    percentage?: number;
    eta_seconds?: number;
    total_files?: number;
    current_file?: string | null;
    total_chunks?: number;
    current_stage?: string;
    stored_chunks?: number;
    processed_files?: number;
    updated_at_epoch?: number;
    embeddings_skipped?: number;
    avg_seconds_per_file?: number;
    qdrant_chunks_queued?: number;
  } | null;
  total_files: number;
  processed_files: number;
  percentage: number;
  current_file?: string | null;
  eta_seconds?: number | null;
  started_at?: string | null;
};
