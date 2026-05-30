import { getFrontendApiBase, resolveApiUrl } from '@/lib/api-proxy';

describe('api-proxy', () => {
  const originalEnv = process.env;
  let originalWindow: any;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    originalWindow = global.window;
  });

  afterAll(() => {
    process.env = originalEnv;
    global.window = originalWindow;
  });

  describe('getFrontendApiBase', () => {
    it('returns default base', () => {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      delete process.env.NEXT_PUBLIC_API_URL;
      expect(getFrontendApiBase()).toBe('/api/v1');
    });

    it('returns base from env', () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8000';
      expect(getFrontendApiBase()).toBe('http://localhost:8000');
    });

    it('trims trailing slash', () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8000/';
      expect(getFrontendApiBase()).toBe('http://localhost:8000');
    });
  });

  describe('resolveApiUrl', () => {
    it('prepends slash to path', () => {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      delete process.env.NEXT_PUBLIC_API_URL;
      
      expect(resolveApiUrl('test')).toBe('/test');
    });

    it('returns full url if base is absolute', () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8000';
      expect(resolveApiUrl('/test')).toBe('http://localhost:8000/test');
    });
  });
});
