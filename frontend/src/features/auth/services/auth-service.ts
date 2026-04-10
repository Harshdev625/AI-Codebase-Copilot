import { apiClient } from '@/api/api-client';
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
  login: async (payload: LoginPayload): Promise<AuthTokenResponse> => {
    const response = await apiClient.post<ApiEnvelope<AuthTokenResponse>>('/auth/login', payload);
    return unwrap(response);
  },

  register: async (payload: RegisterPayload): Promise<User> => {
    const response = await apiClient.post<ApiEnvelope<User>>('/auth/register', payload);
    return unwrap(response);
  },

  me: async (): Promise<User> => {
    const response = await apiClient.get<ApiEnvelope<User>>('/auth/me');
    return unwrap(response);
  },
};
