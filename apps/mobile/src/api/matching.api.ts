import { apiClient } from './client';

export const matchingApi = {
  respondToMatch: async (matchId: string, action: 'ACCEPT' | 'DECLINE'): Promise<{ success: boolean; action: string }> => {
    const res = await apiClient.post(`/matches/${matchId}/respond`, { action });
    return res.data.data;
  },

  confirmDonation: async (matchId: string): Promise<{ success: boolean }> => {
    const res = await apiClient.post(`/matches/${matchId}/confirm`);
    return res.data.data;
  },
};
