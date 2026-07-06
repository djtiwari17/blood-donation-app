import { apiClient } from './client';

export interface AdminStats {
  totalUsers: number;
  totalDonors: number;
  activeRequests: number;
  pendingVerifications: number;
  openReports: number;
  totalDonations: number;
}

export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  bloodGroup: string;
  role: string;
  verifStatus: string;
  isBlocked: boolean;
  reportCount: number;
  city: string | null;
  createdAt: string;
  donorProfile: { totalDonations: number; isAvailable: boolean } | null;
}

export interface AdminRequest {
  id: string;
  requestCode: string;
  patientName: string;
  hospitalName: string;
  bloodGroup: string;
  urgency: string;
  status: string;
  unitsNeeded: number;
  unitsFulfilled: number;
  requiredBy: string;
  createdAt: string;
  totalMatches: number;
  receiver: { id: string; name: string; phone: string };
}

export interface AdminReport {
  id: string;
  reason: string;
  details: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  reporter: { id: string; name: string; phone: string };
  reported: { id: string; name: string; phone: string; verifStatus: string; reportCount: number };
}

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export const adminApi = {
  getStats: () => apiClient.get('/admin/stats').then(unwrap<AdminStats>),

  getUsers: (page = 1, search?: string, role?: string, verifStatus?: string) =>
    apiClient.get('/admin/users', {
      params: { page, limit: 20, search: search || undefined, role: role || undefined, verifStatus: verifStatus || undefined },
    }).then(unwrap<{ users: AdminUser[]; total: number; page: number; totalPages: number }>),

  updateUserStatus: (userId: string, body: { verifStatus?: string; isBlocked?: boolean }) =>
    apiClient.patch(`/admin/users/${userId}/status`, body).then(unwrap<AdminUser>),

  getRequests: (page = 1, status?: string) =>
    apiClient.get('/admin/requests', {
      params: { page, limit: 20, status: status || undefined },
    }).then(unwrap<{ requests: AdminRequest[]; total: number; page: number; totalPages: number }>),

  getReports: (page = 1, unresolved = true) =>
    apiClient.get('/admin/reports', {
      params: { page, limit: 20, unresolved },
    }).then(unwrap<{ reports: AdminReport[]; total: number; page: number; totalPages: number }>),

  resolveReport: (reportId: string, resolution: string) =>
    apiClient.patch(`/admin/reports/${reportId}/resolve`, { resolution }).then(unwrap),
};

export const authApi = {
  sendOtp: (phone: string) =>
    apiClient.post('/auth/send-otp', { phone }).then(unwrap),

  verifyOtp: (phone: string, otp: string) =>
    apiClient.post('/auth/verify-otp', { phone, otp }).then(
      unwrap<{ isNewUser: boolean; accessToken?: string; refreshToken?: string; user?: AdminUser }>
    ),
};
