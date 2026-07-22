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
  moderationStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  isVerified: boolean;
  isFake: boolean;
  rejectionReason: string | null;
  suspicious: boolean;
  unitsNeeded: number;
  unitsFulfilled: number;
  requiredBy: string;
  createdAt: string;
  totalMatches: number;
  receiver: { id: string; name: string; phone: string; strikeCount: number; isFlagged: boolean };
}

export interface RequesterHistory {
  totalRequests: number;
  fulfilledRequests: number;
  rejectedRequests: number;
  fakeRequests: number;
  strikeCount: number;
  isFlagged: boolean;
  recentRequests: number;
  recentWindowHours: number;
}

export interface AdminRequestDetail extends Omit<AdminRequest, 'suspicious'> {
  requiredBy: string;
  requesterHistory: RequesterHistory;
}

export type ModerationAction = 'APPROVE' | 'REJECT' | 'VERIFY' | 'MARK_FAKE';

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

export interface AdminCamp {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  venue: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  startTime: string;
  endTime: string;
  organizer: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
  attendeeCount: number;
}

export interface CampInput {
  name: string;
  tagline?: string;
  description?: string;
  venue: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  startTime: string;
  endTime: string;
  organizer?: string;
  contactPhone?: string;
  isActive?: boolean;
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

  getRequests: (page = 1, status?: string, moderationStatus?: string) =>
    apiClient.get('/admin/requests', {
      params: { page, limit: 20, status: status || undefined, moderationStatus: moderationStatus || undefined },
    }).then(unwrap<{ requests: AdminRequest[]; total: number; page: number; totalPages: number }>),

  getRequestDetail: (id: string) =>
    apiClient.get(`/admin/requests/${id}`).then(unwrap<AdminRequestDetail>),

  moderateRequest: (id: string, action: ModerationAction, reason?: string) =>
    apiClient.patch(`/admin/requests/${id}/moderate`, { action, reason })
      .then(unwrap<{ success: boolean; action: string; flaggedUser: boolean }>),

  getReports: (page = 1, unresolved = true) =>
    apiClient.get('/admin/reports', {
      params: { page, limit: 20, unresolved },
    }).then(unwrap<{ reports: AdminReport[]; total: number; page: number; totalPages: number }>),

  resolveReport: (reportId: string, resolution: string) =>
    apiClient.patch(`/admin/reports/${reportId}/resolve`, { resolution }).then(unwrap),

  getCamps: (page = 1) =>
    apiClient.get('/admin/camps', { params: { page, limit: 20 } })
      .then(unwrap<{ camps: AdminCamp[]; total: number; page: number; totalPages: number }>),

  createCamp: (body: CampInput) =>
    apiClient.post('/admin/camps', body).then(unwrap<AdminCamp>),

  updateCamp: (id: string, body: Partial<CampInput>) =>
    apiClient.patch(`/admin/camps/${id}`, body).then(unwrap<AdminCamp>),

  deleteCamp: (id: string) =>
    apiClient.delete(`/admin/camps/${id}`).then(unwrap),
};

export const authApi = {
  sendOtp: (phone: string) =>
    apiClient.post('/auth/send-otp', { phone }).then(unwrap),

  verifyOtp: (phone: string, otp: string) =>
    apiClient.post('/auth/verify-otp', { phone, otp }).then(
      unwrap<{ isNewUser: boolean; accessToken?: string; refreshToken?: string; user?: AdminUser }>
    ),
};
