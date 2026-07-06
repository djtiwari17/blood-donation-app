import { create } from 'zustand';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../api/client';
import type { AdminUser } from '../api/admin.api';

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  login: (user: AdminUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  // Read synchronously so the router renders correctly on the first pass
  isAuthenticated: !!localStorage.getItem(ACCESS_TOKEN_KEY),

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ user: null, isAuthenticated: false });
  },
}));
