import { apiClient } from './client';

export type CampStatus = 'upcoming' | 'ongoing' | 'past';

export interface ApiCamp {
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
  isJoined: boolean;
}

export const campsApi = {
  getCamps: async (status: CampStatus = 'upcoming'): Promise<ApiCamp[]> => {
    const res = await apiClient.get('/camps', { params: { status } });
    return res.data.data;
  },

  joinCamp: async (campId: string): Promise<{ success: boolean; joined: boolean }> => {
    const res = await apiClient.post(`/camps/${campId}/join`);
    return res.data.data;
  },

  leaveCamp: async (campId: string): Promise<{ success: boolean; joined: boolean }> => {
    const res = await apiClient.delete(`/camps/${campId}/join`);
    return res.data.data;
  },
};
