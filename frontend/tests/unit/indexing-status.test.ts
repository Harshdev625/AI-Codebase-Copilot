import { isActiveIndexingStatus } from '@/features/dashboard/utils/indexing-status';

describe('isActiveIndexingStatus', () => {
  it('recognizes active statuses case-insensitively', () => {
    expect(isActiveIndexingStatus('RUNNING')).toBe(true);
    expect(isActiveIndexingStatus('in_progress')).toBe(true);
    expect(isActiveIndexingStatus('Queued')).toBe(true);
    expect(isActiveIndexingStatus('PENDING')).toBe(true);
  });

  it('returns false for terminal or unknown statuses', () => {
    expect(isActiveIndexingStatus('completed')).toBe(false);
    expect(isActiveIndexingStatus('failed')).toBe(false);
    expect(isActiveIndexingStatus(null)).toBe(false);
    expect(isActiveIndexingStatus(undefined)).toBe(false);
  });
});
