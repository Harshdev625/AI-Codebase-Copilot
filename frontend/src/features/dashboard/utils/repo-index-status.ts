type RepoIndexFields = {
  latest_job_status?: string | null;
  indexed_chunks_count?: number | null;
  latest_indexed_chunks?: number | null;
};

export function isRepositoryIndexed(repo?: RepoIndexFields | null): boolean {
  if (!repo) return false;
  const status = (repo.latest_job_status ?? '').toLowerCase();
  const chunks = repo.indexed_chunks_count ?? repo.latest_indexed_chunks ?? 0;
  return status === 'completed' || chunks > 0;
}
