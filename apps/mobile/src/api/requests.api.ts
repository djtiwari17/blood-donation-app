import { apiClient } from './client';

export interface CreateRequestPayload {
  patientName: string;
  hospitalName: string;
  bloodGroup: string;
  unitsNeeded: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requiredBy: string; // ISO 8601
  hospitalAddress?: string;
  hospitalLat?: number;
  hospitalLng?: number;
}

export interface ApiBloodRequest {
  id: string;
  requestCode: string;
  receiverId: string;
  patientName: string;
  hospitalName: string;
  hospitalLat: number | null;
  hospitalLng: number | null;
  bloodGroup: string;
  unitsNeeded: number;
  unitsFulfilled: number;
  urgency: string;
  requiredBy: string;
  expiresAt: string;
  status: string;
  // Admin moderation (present on receiver's own requests; isVerified also on donor feed)
  moderationStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  isVerified?: boolean;
  rejectionReason?: string | null;
  createdAt: string;
  distanceKm?: number;
  totalMatches?: number;
  acceptedMatches?: number;
  // Requester phone — only present (unmasked) once the donor's match is ACCEPTED.
  receiverPhone?: string | null;
  myMatch?: {
    id: string;
    status: string; // NOTIFIED | ACCEPTED | DONATED | CANCELLED | TIMED_OUT
    distanceKm: number;
    timeoutAt: string;
  } | null;
}

export interface AcceptRequestResult {
  matchId: string;
  status: string;
  requestId: string;
  receiverPhone: string | null;
}

export const requestsApi = {
  createRequest: async (payload: CreateRequestPayload): Promise<ApiBloodRequest> => {
    const res = await apiClient.post('/requests', payload);
    return res.data.data;
  },

  getMyRequests: async (): Promise<ApiBloodRequest[]> => {
    const res = await apiClient.get('/requests/mine');
    return res.data.data;
  },

  getNearbyRequests: async (radiusKm?: number): Promise<ApiBloodRequest[]> => {
    const res = await apiClient.get('/requests/nearby', {
      params: radiusKm ? { radius: radiusKm } : undefined,
    });
    return res.data.data;
  },

  getRequestById: async (requestId: string): Promise<ApiBloodRequest> => {
    const res = await apiClient.get(`/requests/${requestId}`);
    return res.data.data;
  },

  cancelRequest: async (requestId: string): Promise<void> => {
    await apiClient.patch(`/requests/${requestId}/cancel`);
  },

  acceptRequest: async (requestId: string): Promise<AcceptRequestResult> => {
    const res = await apiClient.post(`/requests/${requestId}/accept`);
    return res.data.data;
  },

  getMatchesForRequest: async (requestId: string): Promise<ApiMatch[]> => {
    const res = await apiClient.get(`/requests/${requestId}/matches`);
    return res.data.data;
  },
};

export interface ApiMatch {
  id: string;
  status: string;
  distanceKm: number;
  score: number;
  notifiedAt: string;
  respondedAt: string | null;
  donatedAt: string | null;
  timeoutAt: string;
  donor: {
    name: string;
    bloodGroup: string;
    verifStatus: string;
    totalDonations: number;
    phone: string; // may be masked: ends with XXXXXX when not ACCEPTED
  };
}
