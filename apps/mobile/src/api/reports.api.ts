import { apiClient } from './client';

export type ReportReason = 'FAKE_PROFILE' | 'SPAM' | 'HARASSMENT' | 'WRONG_INFO' | 'OTHER';

export const reportsApi = {
  createReport: async (
    reportedUserId: string,
    reason: ReportReason,
    details?: string,
  ): Promise<{ success: boolean }> => {
    const res = await apiClient.post('/reports', { reportedUserId, reason, details });
    return res.data.data;
  },
};
