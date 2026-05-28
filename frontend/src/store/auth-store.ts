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
    set({ user, token, isAuthenticated: Boolean(token && user), hydrated: true });
  },
  logout: () => {
    clearAuthSession();
    set({ user: null, token: null, isAuthenticated: false, hydrated: true });
  },
}));
