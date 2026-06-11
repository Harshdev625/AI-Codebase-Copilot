import { apiClient } from "@/core/api/client";
import type {
  AuthTokenResponse,
  LoginPayload,
  RegisterPayload,
  UserProfile,
  AdminRegisterPayload,
} from "@/features/auth/types/auth-types";

export const authService = {
  register: async (payload: RegisterPayload): Promise<UserProfile> => {
    return apiClient<UserProfile>("/v1/auth/register", { method: "POST", body: payload });
  },

  adminRegister: async (payload: AdminRegisterPayload): Promise<UserProfile> => {
    return apiClient<UserProfile>("/v1/auth/admin/register", { method: "POST", body: payload });
  },

  login: async (payload: LoginPayload): Promise<AuthTokenResponse> => {
    return apiClient<AuthTokenResponse>("/v1/auth/login", { method: "POST", body: payload });
  },

  adminLogin: async (payload: LoginPayload): Promise<AuthTokenResponse> => {
    return apiClient<AuthTokenResponse>("/v1/auth/admin/login", { method: "POST", body: payload });
  },

  me: async (token?: string): Promise<UserProfile> => {
    return apiClient<UserProfile>("/v1/auth/me", {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  },
};
