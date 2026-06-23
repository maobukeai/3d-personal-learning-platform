export interface ChatUser {
  id: string;
  name?: string;
  avatarUrl?: string | null;
  email?: string;
  role?: string;
  language?: string;
}

export interface ChatConversation {
  id: string;
  name?: string;
  isGroup: boolean;
  avatarUrl?: string | null;
  participants?: ChatUser[];
  unreadCount?: number;
  updatedAt?: string;
  messages?: ChatMessage[];
}

export interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  user?: ChatUser;
}

export interface ChatMessage {
  id: string;
  conversationId?: string;
  senderId: string;
  sender?: ChatUser;
  type: string;
  content: string;
  createdAt: string;
  fileSize?: number;
  replyToId?: string;
  replyTo?: ChatMessage | null;
  reactions?: MessageReaction[];
  readBy?: Array<{ userId: string; readAt?: string }>;
}
