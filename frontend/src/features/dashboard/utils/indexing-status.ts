const ACTIVE_INDEXING_STATUSES = new Set(['running', 'in_progress', 'queued', 'pending']);

export function isActiveIndexingStatus(status?: string | null): boolean {
  return ACTIVE_INDEXING_STATUSES.has((status ?? '').toLowerCase());
}
