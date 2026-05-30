import { dashboardService } from '@/features/dashboard/services/dashboard-service';
import { apiClient } from '@/core/api/client';

jest.mock('@/core/api/client', () => ({
  apiClient: jest.fn(),
}));

describe('dashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls getSummary API', async () => {
    const mockResponse = { total_users: 10, total_repositories: 5 };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await dashboardService.getSummary();
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/dashboard/me', {
      method: 'GET',
    });
  });
});
