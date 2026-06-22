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
  pushSystemUpdates: boolean;
  pushTeamActivity: boolean;
  pushMentions: boolean;
  pushDirectMessages: boolean;
  pushMarketing: boolean;
  emailSystemUpdates: boolean;
  emailTeamActivity: boolean;
  emailDirectMessages: boolean;
  emailMentions: boolean;
  emailMarketing: boolean;
}

export const defaultNotificationPreferences = (): NotificationPreferences => ({
  pushSystemUpdates: true,
  pushTeamActivity: true,
  pushMentions: true,
  pushDirectMessages: true,
  pushMarketing: false,
  emailSystemUpdates: true,
  emailTeamActivity: true,
  emailDirectMessages: true,
  emailMentions: true,
  emailMarketing: false,
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
    pushSystemUpdates: data.pushSystemUpdates ?? true,
    pushTeamActivity: data.pushTeamActivity ?? true,
    pushMentions: data.pushMentions ?? true,
    pushDirectMessages: data.pushDirectMessages ?? true,
    pushMarketing: data.pushMarketing ?? false,
    emailSystemUpdates: data.emailSystemUpdates ?? true,
    emailTeamActivity: data.emailTeamActivity ?? true,
    emailDirectMessages: data.emailDirectMessages ?? true,
    emailMentions: data.emailMentions ?? true,
    emailMarketing: data.emailMarketing ?? false,
  };
};

export const updateNotificationPreferences = (preferences: NotificationPreferences) =>
  api.put('/api/notifications/preferences', preferences);
