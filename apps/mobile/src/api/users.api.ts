import { apiClient } from './client';

export interface UpdateUserPayload {
  name?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  city?: string;
  area?: string;
  fcmToken?: string;
}

export const usersApi = {
  getMe: () => apiClient.get('/users/me'),
  updateMe: (payload: UpdateUserPayload) => apiClient.patch('/users/me', payload),
};
