import { authService } from '@/features/auth/services/auth-service';
import { apiClient } from '@/core/api/client';

jest.mock('@/core/api/client', () => ({
  apiClient: jest.fn(),
}));

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls register API', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockUser);

    const payload = {
      full_name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    };

    const result = await authService.register(payload);
    expect(result).toEqual(mockUser);
    expect(apiClient).toHaveBeenCalledWith('/v1/auth/register', {
      method: 'POST',
      body: payload,
    });
  });

  it('calls adminRegister API', async () => {
    const mockUser = { id: 'admin1', email: 'admin@example.com' };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockUser);

    const payload = {
      full_name: 'Admin',
      email: 'admin@example.com',
      password: 'password123',
      admin_secret: 'secret',
    };

    const result = await authService.adminRegister(payload);
    expect(result).toEqual(mockUser);
    expect(apiClient).toHaveBeenCalledWith('/v1/auth/admin/register', {
      method: 'POST',
      body: payload,
    });
  });

  it('calls login API', async () => {
    const mockToken = { access_token: 'token', token_type: 'bearer' };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockToken);

    const payload = {
      email: 'test@example.com',
      password: 'password123',
    };

    const result = await authService.login(payload);
    expect(result).toEqual(mockToken);
    expect(apiClient).toHaveBeenCalledWith('/v1/auth/login', {
      method: 'POST',
      body: payload,
    });
  });

  it('calls adminLogin API', async () => {
    const mockToken = { access_token: 'admin-token', token_type: 'bearer' };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockToken);

    const payload = {
      email: 'admin@example.com',
      password: 'password123',
    };

    const result = await authService.adminLogin(payload);
    expect(result).toEqual(mockToken);
    expect(apiClient).toHaveBeenCalledWith('/v1/auth/admin/login', {
      method: 'POST',
      body: payload,
    });
  });

  it('calls me API with token', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockUser);

    const result = await authService.me('mock-token');
    expect(result).toEqual(mockUser);
    expect(apiClient).toHaveBeenCalledWith('/v1/auth/me', {
      method: 'GET',
      headers: { Authorization: 'Bearer mock-token' },
    });
  });

  it('calls me API without token', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    (apiClient as jest.Mock).mockResolvedValueOnce(mockUser);

    const result = await authService.me();
    expect(result).toEqual(mockUser);
    expect(apiClient).toHaveBeenCalledWith('/v1/auth/me', {
      method: 'GET',
      headers: undefined,
    });
  });
});
