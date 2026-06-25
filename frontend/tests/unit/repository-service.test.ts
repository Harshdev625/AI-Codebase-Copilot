import { repositoryService } from '@/features/repositories/services/repository-service';
import { apiClient } from '@/core/api/client';

jest.mock('@/core/api/client', () => ({
  apiClient: jest.fn(),
}));

describe('repositoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls listRepositories API', async () => {
    const mockResponse = { items: [], total: 0 };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await repositoryService.listRepositories(50, 10);
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/repositories', {
      method: 'GET',
      params: { limit: 50, offset: 10 },
    });
  });

  it('calls addRepository API', async () => {
    const mockResponse = { id: 'repo-1' };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const payload = { repo_url: 'http://test.git' };
    const result = await repositoryService.addRepository(payload);
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/repositories', {
      method: 'POST',
      body: payload,
    });
  });

  it('calls startIndex API', async () => {
    const mockResponse = { job_id: 'job-1' };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const payload = { repository_id: 'repo-1' };
    const result = await repositoryService.startIndex(payload);
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/index', {
      method: 'POST',
      body: {
        commit_sha: 'local-working-copy',
        ...payload,
      },
    });
  });

  it('calls getIndexProgress API', async () => {
    const mockResponse = { status: 'completed' };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await repositoryService.getIndexProgress('job-1');
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/index/progress/job-1', {
      method: 'GET',
    });
  });

  it('calls deleteRepository API', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({ deleted: true });
    const result = await repositoryService.deleteRepository('repo-1');
    expect(result).toEqual({ deleted: true });
    expect(apiClient).toHaveBeenCalledWith('/v1/repositories/repo-1', { method: 'DELETE' });
  });

  it('calls getTree with optional params', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({ items: [], next_cursor: null });
    await repositoryService.getTree('repo-1', 'src', 'snap-1', 'patch-1', 'cursor-1', 50);
    expect(apiClient).toHaveBeenCalledWith('/v1/repositories/repo-1/tree', {
      method: 'GET',
      params: {
        limit: '50',
        path: 'src',
        snapshot_id: 'snap-1',
        patch_id: 'patch-1',
        cursor: 'cursor-1',
      },
    });
  });

  it('calls searchWorkspace API', async () => {
    const payload = { query: 'foo', case_sensitive: false };
    (apiClient as jest.Mock).mockResolvedValueOnce({ matches: [] });
    await repositoryService.searchWorkspace('repo-1', payload);
    expect(apiClient).toHaveBeenCalledWith('/v1/repositories/repo-1/search', {
      method: 'POST',
      body: payload,
    });
  });

  it('calls listSkippedFiles with filters', async () => {
    (apiClient as jest.Mock).mockResolvedValueOnce({ items: [], total: 0, limit: 10, offset: 0 });
    await repositoryService.listSkippedFiles('repo-1', { limit: 10, offset: 5, reason: 'BINARY_FILE' });
    expect(apiClient).toHaveBeenCalledWith('/v1/repositories/repo-1/files/skipped', {
      method: 'GET',
      params: { limit: '10', offset: '5', reason: 'BINARY_FILE' },
    });
  });
});
