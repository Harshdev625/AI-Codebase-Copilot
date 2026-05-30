import { toApiError } from '@/core/api/errors';
import { ApiError } from '@/core/api/types';

describe('toApiError', () => {
  it('handles ApiError', () => {
    expect(toApiError(new ApiError('test api error'))).toBe('test api error');
  });

  it('handles Error', () => {
    expect(toApiError(new Error('test error'))).toBe('test error');
  });

  it('handles string', () => {
    expect(toApiError('string error')).toBe('string error');
  });

  it('handles object with message', () => {
    expect(toApiError({ message: 'object message' })).toBe('object message');
  });

  it('handles object with error string', () => {
    expect(toApiError({ error: 'object error' })).toBe('object error');
  });

  it('handles object with error object message', () => {
    expect(toApiError({ error: { message: 'nested message' } })).toBe('nested message');
  });

  it('handles unknown', () => {
    expect(toApiError(null)).toBe('An unexpected error occurred.');
    expect(toApiError(undefined)).toBe('An unexpected error occurred.');
    expect(toApiError(123)).toBe('An unexpected error occurred.');
    expect(toApiError({})).toBe('An unexpected error occurred.');
  });
});
