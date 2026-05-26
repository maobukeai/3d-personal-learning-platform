import api from '@/utils/api';

export interface AppNotification {
  id: string;
  title: string;
  content: string;
  type: string;
  isRead: boolean;
  createdAt: string | number | Date;
  link?: string | null;
}

export interface NotificationPreferences {
  emailSystemUpdates: boolean;
  emailTeamActivity: boolean;
  emailMarketing: boolean;
  pushMentions: boolean;
  pushDirectMessages: boolean;
}

export const defaultNotificationPreferences = (): NotificationPreferences => ({
  emailSystemUpdates: true,
  emailTeamActivity: true,
  emailMarketing: false,
  pushMentions: true,
  pushDirectMessages: true,
});

export const fetchNotifications = async (): Promise<AppNotification[]> => {
  const { data } = await api.get('/api/notifications');
  return data.notifications || [];
};

export const markNotificationAsRead = (id: string) => api.put(`/api/notifications/${id}/read`);

export const markAllNotificationsAsRead = () => api.put('/api/notifications/read-all');

export const fetchNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const { data } = await api.get('/api/notifications/preferences');
  return {
    emailSystemUpdates: data.emailSystemUpdates ?? true,
    emailTeamActivity: data.emailTeamActivity ?? true,
    emailMarketing: data.emailMarketing ?? false,
    pushMentions: data.pushMentions ?? true,
    pushDirectMessages: data.pushDirectMessages ?? true,
  };
};

export const updateNotificationPreferences = (preferences: NotificationPreferences) =>
  api.put('/api/notifications/preferences', preferences);
