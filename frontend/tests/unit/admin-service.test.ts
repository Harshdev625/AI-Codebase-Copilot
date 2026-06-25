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

  it('calls telemetry API', async () => {
    const mockResponse = { active_streams: 0, indexing_queue_depth: 0, indexing_running: 0 };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await adminService.telemetry();
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/telemetry', { method: 'GET' });
  });

  it('calls recentActivity API', async () => {
    const mockResponse = { indexing_jobs: { items: [], total: 0 }, recent_users: { items: [], total: 0 } };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockResponse);

    const result = await adminService.recentActivity();
    expect(result).toEqual(mockResponse);
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/recent-activity', { method: 'GET' });
  });

  it('calls invite APIs', async () => {
    const invite = { id: 'inv-1', email: 'a@b.com', status: 'pending' as const, expires_at: '', created_at: '', created_by_user_id: 'admin' };
    (apiClient as jest.Mock)
      .mockResolvedValueOnce([invite])
      .mockResolvedValueOnce(invite)
      .mockResolvedValueOnce({ revoked: true });

    expect(await adminService.listInvites()).toEqual([invite]);
    expect(await adminService.createInvite({ email: 'a@b.com', expires_in_hours: 24 })).toEqual(invite);
    expect(await adminService.revokeInvite('inv-1')).toEqual({ revoked: true });

    expect(apiClient).toHaveBeenCalledWith('/v1/admin/invites', { method: 'GET' });
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/invites', {
      method: 'POST',
      body: { email: 'a@b.com', expires_in_hours: 24 },
    });
    expect(apiClient).toHaveBeenCalledWith('/v1/admin/invites/inv-1', { method: 'DELETE' });
  });
});
