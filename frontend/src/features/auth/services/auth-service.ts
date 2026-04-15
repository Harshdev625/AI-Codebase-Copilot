import { apiClient } from '@/lib/api';
import { AuthTokenResponse, LoginPayload, RegisterPayload, User } from '../types/auth-types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

const unwrap = <T>(response: { data: ApiEnvelope<T> }): T => {
  if (!response.data.success) {
    throw new Error(response.data.error || 'Request failed');
  }
  return response.data.data;
};

export const authService = {
  login: async (payload: LoginPayload, endpoint = '/auth/login'): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<ApiEnvelope<AuthTokenResponse>>(endpoint, payload);
    return unwrap(response);
  },

  register: async (payload: RegisterPayload, endpoint = '/auth/register'): Promise<User> => {
    const response = await apiClient.post<ApiEnvelope<User>>(endpoint, payload);
    return unwrap(response);
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get<ApiEnvelope<User>>('/auth/me');
    return unwrap(response);
  },
};
