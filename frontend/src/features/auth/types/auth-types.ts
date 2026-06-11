export type UserRole = "USER" | "ADMIN";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name?: string | null;
}

export interface AdminRegisterPayload extends RegisterPayload {
  admin_secret_key: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: "bearer";
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  token_scopes: string[];
  is_active: boolean;
}
