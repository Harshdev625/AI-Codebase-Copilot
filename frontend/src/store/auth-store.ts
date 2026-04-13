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
  full_name?: string;
  role: 'USER' | 'ADMIN';
  is_active: boolean;
  created_at?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  hydrateFromStorage: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  setAuth: (user, token) => {
    setAuthSession(token, user);
    set({ user, token, isAuthenticated: true });
  },
  hydrateFromStorage: () => {
    const user = getStoredUser() as User | null;
    const token = getAccessToken() ?? null;
    set({ user, token, isAuthenticated: Boolean(token && user) });
  },
  logout: () => {
    clearAuthSession();
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
