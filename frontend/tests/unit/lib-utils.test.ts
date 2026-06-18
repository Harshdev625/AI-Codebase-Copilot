import { cn, formatDate, truncate } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves tailwind conflicts', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('formatDate', () => {
  it('formats valid ISO strings', () => {
    const formatted = formatDate('2024-01-15T12:30:00.000Z');
    expect(formatted).toMatch(/Jan/);
    expect(formatted).not.toBe('-');
  });

  it('returns dash for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });
});

describe('truncate', () => {
  it('returns short text unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long text with ellipsis', () => {
    expect(truncate('abcdefghijklmnop', 8)).toBe('abcdefg...');
  });
});
