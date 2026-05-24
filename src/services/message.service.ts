import api from '@/utils/api';

interface ConversationSummary {
  unreadCount?: number;
}

export const fetchUnreadMessageCount = async () => {
  const { data } = await api.get('/api/messages/conversations');
  return (data as ConversationSummary[]).reduce((acc, conversation) => {
    return acc + (conversation.unreadCount || 0);
  }, 0);
};
