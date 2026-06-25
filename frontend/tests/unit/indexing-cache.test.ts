import { QueryClient } from '@tanstack/react-query';

import { invalidateIndexingCaches, isTerminalIndexingStatus } from '@/features/repositories/utils/indexing-cache';

describe('isTerminalIndexingStatus', () => {
  it('recognizes terminal statuses case-insensitively', () => {
    expect(isTerminalIndexingStatus('COMPLETED')).toBe(true);
    expect(isTerminalIndexingStatus('complete')).toBe(true);
    expect(isTerminalIndexingStatus('Success')).toBe(true);
    expect(isTerminalIndexingStatus('FAILED')).toBe(true);
    expect(isTerminalIndexingStatus('error')).toBe(true);
  });

  it('returns false for in-progress statuses', () => {
    expect(isTerminalIndexingStatus('running')).toBe(false);
    expect(isTerminalIndexingStatus('queued')).toBe(false);
    expect(isTerminalIndexingStatus(null)).toBe(false);
  });
});

describe('invalidateIndexingCaches', () => {
  it('invalidates repository and dashboard query keys', () => {
    const invalidateQueries = jest.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateIndexingCaches(queryClient);

    const keys = invalidateQueries.mock.calls.map((call) => call[0].queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['repositories', 'list'],
        ['indexing-jobs'],
        ['index-progress'],
        ['dashboard'],
        ['admin'],
      ]),
    );
  });
});
