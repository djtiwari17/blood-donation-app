import { apiClient } from './client';

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  relatedId: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  notifications: ApiNotification[];
  unreadCount: number;
  total: number;
  page: number;
  totalPages: number;
}

export const notificationsApi = {
  getAll: async (page = 1): Promise<NotificationsPage> => {
    const res = await apiClient.get('/notifications', { params: { page } });
    return res.data.data;
  },

  markRead: async (notificationId: string): Promise<void> => {
    await apiClient.patch(`/notifications/${notificationId}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/read-all');
  },
};
