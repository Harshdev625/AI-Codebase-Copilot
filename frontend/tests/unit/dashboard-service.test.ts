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
    const mockResponse = { metrics: { repositories_count: 5 } };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await dashboardService.getSummary();
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/dashboard/me', {
      method: 'GET',
    });
  });

  it('calls getActivity API', async () => {
    const mockResponse = { days: [] };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await dashboardService.getActivity(7);
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/dashboard/activity', {
      method: 'GET',
      params: { days: 7 },
    });
  });
});
