export type UserRole = "USER" | "ADMIN" | string;

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  full_name?: string | null;
};

export type AdminRegisterPayload = {
  email: string;
  password: string;
  full_name?: string | null;
  admin_secret_key: string;
};

export type AuthTokenResponse = {
  access_token: string;
  token_type: "bearer";
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  token_scopes: string[];
  is_active: boolean;
};
