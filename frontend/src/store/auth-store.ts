import { create } from 'zustand';
import {
  clearAuthSession,
  getAccessToken,
  getStoredUser,
  setAuthSession,
} from '@/lib/auth';

export interface User {
  id: string;
  email: string;
  full_name?: string | null;
  role: 'USER' | 'ADMIN';
  token_scopes?: string[];
  is_active: boolean;
  created_at?: string;
}

/** Decode JWT payload and check if it is expired (client-side, no crypto needed). */
function isJwtExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (typeof payload?.exp !== 'number') return true;
    return Date.now() / 1000 >= payload.exp;
  } catch {
    return true;
  }
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  setAuth: (user: User, token: string) => void;
  hydrateFromStorage: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  hydrated: false,
  setAuth: (user, token) => {
    setAuthSession(token, user);
    set({ user, token, isAuthenticated: true });
  },
  hydrateFromStorage: () => {
    const user = getStoredUser() as User | null;
    const token = getAccessToken() ?? null;

    // If the stored token is expired, wipe the session before any queries run
    if (isJwtExpired(token)) {
      clearAuthSession();
      set({ user: null, token: null, isAuthenticated: false, hydrated: true });
      return;
    }

    set({ user, token, isAuthenticated: Boolean(token && user), hydrated: true });
  },
  logout: () => {
    clearAuthSession();
    set({ user: null, token: null, isAuthenticated: false, hydrated: true });
  },
}));

