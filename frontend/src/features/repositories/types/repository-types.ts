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

export interface RepositorySnapshot {
  id: string;
  repository_id: string;
  commit_sha: string;
  indexed_at: string;
  files_count: number;
  chunks_count: number;
  files_skipped: number;
  is_pinned: boolean;
  is_release: boolean;
  status: "ACTIVE" | "ARCHIVED";
  index_status: "PENDING" | "RUNNING" | "COMPLETE" | "FAILED";
  indexer_version?: string;
  last_indexed_at?: string;
}

export interface SnapshotUpdateRequest {
  is_pinned?: boolean;
  is_release?: boolean;
  status?: "ACTIVE" | "ARCHIVED";
}

export interface SnapshotDiffResponse {
  added: string[];
  removed: string[];
  modified: string[];
  renamed: Array<{ from: string; to: string }>;
}

export interface TreeItem {
  id: string;
  path: string;
  type: "FILE" | "DIRECTORY";
  extension?: string;
  size_bytes?: number;
  status?: "INDEXED" | "ADDED" | "MODIFIED" | "DELETED";
}

export interface TreeResponse {
  items: TreeItem[];
  next_cursor?: string;
}

export interface RetrievalItem {
  id: string;
  repository_id: string;
  path: string;
  symbol: string;
  language: string;
  content: string;
  score: number;
  rerank_score?: number;
  start_line: number;
  end_line: number;
}
