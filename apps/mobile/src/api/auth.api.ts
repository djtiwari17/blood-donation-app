import { apiClient } from './client';
import { BloodGroup, Gender, UserDto } from '@blood-donation/types';

export interface SendOtpResponse {
  success: boolean;
}

export interface VerifyOtpResponse {
  success: boolean;
  data: NewUserResult | ExistingUserResult;
}

export interface NewUserResult {
  isNewUser: true;
  otpSession: string;
}

export interface ExistingUserResult {
  isNewUser: false;
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface RegisterPayload {
  otpSession: string;
  name: string;
  bloodGroup: BloodGroup;
  gender?: Gender;
  role?: 'DONOR' | 'RECEIVER' | 'DONOR_RECEIVER';
  dateOfBirth?: string;
  city?: string;
}

export interface RegisterResponse {
  success: boolean;
  data: { accessToken: string; refreshToken: string; user: UserDto };
}

export const authApi = {
  sendOtp: (phone: string) =>
    apiClient.post<SendOtpResponse>('/auth/send-otp', { phone }),

  verifyOtp: (phone: string, code: string) =>
    apiClient.post<VerifyOtpResponse>('/auth/verify-otp', { phone, code }),

  register: (payload: RegisterPayload) =>
    apiClient.post<RegisterResponse>('/auth/register', payload),

  refresh: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }),

  logout: () =>
    apiClient.post('/auth/logout'),
};
