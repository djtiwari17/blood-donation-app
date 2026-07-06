import axios from 'axios';
import { apiClient } from './client';
import { API_URL } from '../constants/api';

export interface CreateDonorProfilePayload {
  isAvailable?: boolean;
  lastDonationDate?: string;
  locationLat?: number;
  locationLng?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
}

export interface UpdateDonorProfilePayload {
  isAvailable?: boolean;
  lastDonationDate?: string;
  locationLat?: number;
  locationLng?: number;
}

export interface DonorProfile {
  id: string;
  userId: string;
  isAvailable: boolean;
  lastDonationDate: string | null;
  locationLat: number | null;
  locationLng: number | null;
  totalDonations: number;
  livesSaved: number;
  responseRate: number;
  isEligible: boolean;
  nextEligibleDate: string | null;
}

export interface DonationHistoryMatch {
  id: string;
  status: 'DONATED' | 'CANCELLED' | 'TIMED_OUT';
  distanceKm: number;
  donatedAt: string | null;
  notifiedAt: string;
  request: {
    patientName: string;
    hospitalName: string;
    bloodGroup: string;
    urgency: string;
  };
}

export const donorsApi = {
  getProfile: async (): Promise<DonorProfile> => {
    const res = await apiClient.get('/donors/profile');
    return res.data.data;
  },

  updateProfile: async (payload: UpdateDonorProfilePayload): Promise<DonorProfile> => {
    const res = await apiClient.patch('/donors/profile', payload);
    return res.data.data;
  },

  getDonationHistory: async (page = 1): Promise<{
    matches: DonationHistoryMatch[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const res = await apiClient.get('/donors/history', { params: { page, limit: 20 } });
    return res.data.data;
  },

  // Called during onboarding before tokens are saved to SecureStore
  createProfileWithToken: (payload: CreateDonorProfilePayload, accessToken: string) =>
    axios.post(`${API_URL}/donors/profile`, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      timeout: 15_000,
    }),
};
