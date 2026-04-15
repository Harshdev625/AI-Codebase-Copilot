import { User } from '@/store/auth-store';

export type { User };

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  full_name?: string;
  admin_secret_key?: string;
}
