import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const ACCESS_TOKEN_KEY = 'admin_access_token';
export const REFRESH_TOKEN_KEY = 'admin_refresh_token';

export const apiClient = axios.create({
  baseURL: '/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      if (error.response?.status === 401) {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post('/v1/auth/refresh', { refreshToken });
      const newAccess: string = data.data.accessToken;
      const newRefresh: string = data.data.refreshToken;

      localStorage.setItem(ACCESS_TOKEN_KEY, newAccess);
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);

      original.headers.Authorization = `Bearer ${newAccess}`;
      return apiClient(original);
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.location.href = '/login';
      return Promise.reject(error);
    }
  },
);
