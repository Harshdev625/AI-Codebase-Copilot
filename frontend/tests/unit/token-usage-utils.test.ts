import {
  formatTokenCount,
  getMessageUsage,
  getSessionDisplayTitle,
  getSessionUsageTotals,
  TOKEN_CALCULATION_HELP,
} from '@/features/chat/utils/token-usage-utils';

describe('formatTokenCount', () => {
  it('formats numbers with locale separators', () => {
    expect(formatTokenCount(1200)).toBe('1,200');
  });

  it('returns em dash for missing values', () => {
    expect(formatTokenCount(undefined)).toBe('—');
    expect(formatTokenCount(Number.NaN)).toBe('—');
  });
});

describe('getSessionDisplayTitle', () => {
  it('prefers session_title', () => {
    expect(getSessionDisplayTitle({ session_title: '  My chat ', summary: 'x', metadata: {} })).toBe('My chat');
  });

  it('falls back to summary then preview', () => {
    expect(getSessionDisplayTitle({ session_title: '', summary: 'Summary', metadata: {} })).toBe('Summary');
    expect(
      getSessionDisplayTitle({
        session_title: '',
        summary: '',
        metadata: { title_preview: 'Preview title' },
      }),
    ).toBe('Preview title');
  });

  it('truncates long preview and defaults to new conversation', () => {
    const long = 'a'.repeat(80);
    expect(getSessionDisplayTitle({ session_title: '', summary: '', metadata: { title_preview: long } })).toMatch(/…$/);
    expect(getSessionDisplayTitle({ session_title: '', summary: '', metadata: {} })).toBe('New conversation');
  });
});

describe('getSessionUsageTotals', () => {
  it('returns totals when present', () => {
    const totals = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
    expect(getSessionUsageTotals({ metadata: { usage_totals: totals } })).toEqual(totals);
  });

  it('returns null for missing metadata', () => {
    expect(getSessionUsageTotals({ metadata: {} })).toBeNull();
  });
});

describe('getMessageUsage', () => {
  it('reads usage from metadata', () => {
    const usage = { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 };
    expect(getMessageUsage({ usage })).toEqual(usage);
  });

  it('reads nested stats.usage', () => {
    const usage = { total_tokens: 9 };
    expect(getMessageUsage({ stats: { usage } })).toEqual(usage);
  });

  it('returns null when absent', () => {
    expect(getMessageUsage({})).toBeNull();
  });
});

describe('TOKEN_CALCULATION_HELP', () => {
  it('documents token sources', () => {
    expect(TOKEN_CALCULATION_HELP.llm).toContain('Ollama');
    expect(TOKEN_CALCULATION_HELP.context).toContain('Context budget');
  });
});
