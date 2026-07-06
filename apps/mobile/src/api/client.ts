import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/api';

export const ACCESS_TOKEN_KEY = 'accessToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token to every request
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Silent token refresh on 401
let isRefreshing = false;
let queue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error);

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        queue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(original));
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      const newAccess: string = data.data.accessToken;
      const newRefresh: string = data.data.refreshToken;

      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, newAccess);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, newRefresh);

      queue.forEach((cb) => cb(newAccess));
      queue = [];

      original.headers.Authorization = `Bearer ${newAccess}`;
      return apiClient(original);
    } catch {
      // Refresh failed — clear tokens so the app redirects to login
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      queue = [];
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);
