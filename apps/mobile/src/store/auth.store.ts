import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../api/client';

export interface StoredUser {
  id: string;
  phone: string;
  name: string;
  bloodGroup: string;
  role: 'DONOR' | 'RECEIVER' | 'DONOR_RECEIVER' | 'ADMIN' | 'SUPER_ADMIN';
  verifStatus: string;
  city?: string;
  area?: string;
  [key: string]: unknown;
}

interface RegistrationTokens {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
}

interface AuthState {
  user: StoredUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  otpSession: string | null;
  // Tokens held during donor profile setup (user not yet "in" the app)
  registrationTokens: RegistrationTokens | null;

  setAuth: (user: StoredUser, accessToken: string, refreshToken: string) => Promise<void>;
  setOtpSession: (session: string) => void;
  clearOtpSession: () => void;
  setRegistrationTokens: (tokens: RegistrationTokens) => void;
  clearRegistrationTokens: () => void;
  loadTokens: () => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  otpSession: null,
  registrationTokens: null,

  setAuth: async (user, accessToken, refreshToken) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    set({ user, isAuthenticated: true, isLoading: false, registrationTokens: null });
  },

  setOtpSession: (session) => set({ otpSession: session }),
  clearOtpSession: () => set({ otpSession: null }),

  setRegistrationTokens: (tokens) => set({ registrationTokens: tokens }),
  clearRegistrationTokens: () => set({ registrationTokens: null }),

  loadTokens: async () => {
    try {
      const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
      if (token) {
        // Tokens exist — mark authenticated; user data will be fetched by app
        set({ isAuthenticated: true, isLoading: false });
        return true;
      }
      set({ isLoading: false });
      return false;
    } catch {
      set({ isLoading: false });
      return false;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    set({ user: null, isAuthenticated: false, otpSession: null, registrationTokens: null });
  },
}));
