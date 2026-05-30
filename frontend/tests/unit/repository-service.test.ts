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
});
