import { apiClient } from "@/core/api/client";
import type {
  AuthTokenResponse,
  LoginPayload,
  RegisterPayload,
  UserProfile,
  AdminRegisterPayload,
} from "@/features/auth/types/auth-types";

export const authService = {
  register(payload: RegisterPayload): Promise<UserProfile> {
    return apiClient<UserProfile>("/v1/auth/register", { method: "POST", body: payload });
  },

  adminRegister(payload: AdminRegisterPayload): Promise<UserProfile> {
    return apiClient<UserProfile>("/v1/auth/admin/register", { method: "POST", body: payload });
  },

  login(payload: LoginPayload): Promise<AuthTokenResponse> {
    return apiClient<AuthTokenResponse>("/v1/auth/login", { method: "POST", body: payload });
  },

  adminLogin(payload: LoginPayload): Promise<AuthTokenResponse> {
    return apiClient<AuthTokenResponse>("/v1/auth/admin/login", { method: "POST", body: payload });
  },

  me(token?: string): Promise<UserProfile> {
    return apiClient<UserProfile>("/v1/auth/me", {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  },
};
