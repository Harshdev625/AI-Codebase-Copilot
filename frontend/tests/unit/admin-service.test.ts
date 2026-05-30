import { adminService } from '@/features/admin/services/admin-service';
import { apiClient } from '@/core/api/client';

jest.mock('@/core/api/client', () => ({
  apiClient: jest.fn(),
}));

describe('adminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls metrics API', async () => {
    const mockResponse = { users_count: 5 };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await adminService.metrics();
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/system-metrics', { method: 'GET' });
  });

  it('calls health API', async () => {
    const mockResponse = [{ name: 'db', status: 'healthy' }];
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await adminService.health();
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/service-health', { method: 'GET' });
  });

  it('calls users API', async () => {
    const mockResponse = { items: [], total: 0 };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await adminService.users();
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/users', { method: 'GET' });
  });

  it('calls repositories API', async () => {
    const mockResponse = { items: [], total: 0 };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await adminService.repositories();
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/repositories', { method: 'GET' });
  });

  it('calls indexingStatus API', async () => {
    const mockResponse = { items: [], total: 0 };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await adminService.indexingStatus();
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/indexing-status', { method: 'GET' });
  });

  it('calls updateUserRole API', async () => {
    const mockResponse = { id: 'u1', email: 'a@a', role: 'ADMIN', is_active: true };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await adminService.updateUserRole('u1', 'ADMIN');
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/users/u1/role', { 
      method: 'POST',
      body: { role: 'ADMIN' }
    });
  });

  it('calls updateUserStatus API', async () => {
    const mockResponse = { id: 'u1', email: 'a@a', role: 'USER', is_active: false };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await adminService.updateUserStatus('u1', false);
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/users/u1/status', { 
      method: 'POST',
      body: { is_active: false }
    });
  });

  it('calls deleteUser API', async () => {
    const mockResponse = { deleted: true };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await adminService.deleteUser('u1');
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/users/u1', { method: 'DELETE' });
  });
});
