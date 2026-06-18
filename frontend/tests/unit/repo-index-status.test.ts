import { isRepositoryIndexed } from '@/features/dashboard/utils/repo-index-status';

describe('isRepositoryIndexed', () => {
  it('returns false for missing repo', () => {
    expect(isRepositoryIndexed(null)).toBe(false);
    expect(isRepositoryIndexed(undefined)).toBe(false);
  });

  it('returns true when latest job completed', () => {
    expect(isRepositoryIndexed({ latest_job_status: 'COMPLETED', indexed_chunks_count: 0 })).toBe(true);
  });

  it('returns true when chunk count is positive', () => {
    expect(isRepositoryIndexed({ latest_job_status: 'failed', indexed_chunks_count: 12 })).toBe(true);
    expect(isRepositoryIndexed({ latest_job_status: '', latest_indexed_chunks: 3 })).toBe(true);
  });

  it('returns false when not completed and no chunks', () => {
    expect(isRepositoryIndexed({ latest_job_status: 'running', indexed_chunks_count: 0 })).toBe(false);
  });
});
