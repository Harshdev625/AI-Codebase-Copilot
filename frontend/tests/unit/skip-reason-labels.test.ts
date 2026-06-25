import { SKIP_REASON_LABELS, formatSkipReason } from '@/features/repositories/utils/skip-reason-labels';

describe('formatSkipReason', () => {
  it('maps known codes to labels', () => {
    expect(formatSkipReason('BINARY_FILE')).toBe(SKIP_REASON_LABELS.BINARY_FILE);
    expect(formatSkipReason('GENERATED_FILE')).toBe('Generated file');
  });

  it('returns unknown label for empty code', () => {
    expect(formatSkipReason(null)).toBe(SKIP_REASON_LABELS.UNKNOWN);
    expect(formatSkipReason(undefined)).toBe(SKIP_REASON_LABELS.UNKNOWN);
  });

  it('formats unknown codes from snake_case', () => {
    expect(formatSkipReason('CUSTOM_REASON_CODE')).toBe('custom reason code');
  });
});
