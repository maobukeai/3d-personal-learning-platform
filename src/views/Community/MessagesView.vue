<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Search,
  Send,
  Languages,
  Mic,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Check,
  CheckCheck,
  Plus,
  User as UserIcon,
  MessageSquare,
  X,
  Reply,
  Users,
  LogOut,
  Info,
  Hash,
  AtSign,
  SmilePlus,
  Trash2,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserProfileDialog from '@/components/UserProfileDialog.vue';

import UserAvatar from '@/components/UserAvatar.vue';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { socketService } from '@/utils/socket';
import { sanitizeHtml } from '@/utils/sanitize';

const { t } = useI18n();
const authStore = useAuthStore();
const searchQuery = ref('');
const newMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const conversations = ref<any[]>([]);
const messages = ref<any[]>([]);
const activeConversation = ref<any>(null);
const isLoadingConversations = ref(false);
const isLoadingMessages = ref(false);
const isUploading = ref(false);

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const isInfoPanelOpen = ref(false);
const infoTab = ref<'info' | 'files' | 'photos'>('info');

const sharedPhotos = computed(() => {
  return messages.value
    .filter((m) => m.type === 'IMAGE')
    .map((m) => ({
      id: m.id,
      url: m.content,
      createdAt: m.createdAt,
    }));
});

const sharedFiles = computed(() => {
  return messages.value
    .filter((m) => m.type === 'FILE')
    .map((m) => ({
      id: m.id,
      name: m.content.split('/').pop() || '未知文件',
      url: m.content,
      createdAt: m.createdAt,
      size: m.fileSize, // Assume backend provides this or just show date
    }));
});

const replyToMessage = ref<any>(null);

const messageSearchQuery = ref('');

const showEmojiPicker = ref(false);
const showReactionPicker = ref<string | null>(null);
const commonEmojis = [
  '😊',
  '😂',
  '🤣',
  '😍',
  '😒',
  '👌',
  '😘',
  '👍',
  '🙌',
  '🎉',
  '🔥',
  '✨',
  '💻',
  '🎨',
  '🚀',
  '⭐',
];
const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀'];

const hasMoreMessages = ref(false);
const nextCursor = ref<string | null>(null);
const isLoadingOlderMessages = ref(false);

const isNewChatDialogOpen = ref(false);
const isGroupChatDialogOpen = ref(false);
const userSearchQuery = ref('');
const publicUsers = ref<any[]>([]);
const isLoadingUsers = ref(false);

// Swipe-to-delete state
const swipingConvId = ref<string | null>(null);
const swipeOffset = ref<Record<string, number>>({});
let touchStartX = 0;

const handleTouchStart = (e: TouchEvent, convId: string) => {
  touchStartX = e.touches[0].clientX;
  if (swipingConvId.value && swipingConvId.value !== convId) {
    swipeOffset.value[swipingConvId.value] = 0;
  }
  swipingConvId.value = convId;
};

const handleTouchMove = (e: TouchEvent, convId: string) => {
  const currentX = e.touches[0].clientX;
  const diff = touchStartX - currentX;
  if (diff > 0) {
    // Swiping left
    swipeOffset.value[convId] = Math.min(diff, 80);
  } else {
    swipeOffset.value[convId] = 0;
  }
};

const handleTouchEnd = (convId: string) => {
  if (swipeOffset.value[convId] > 40) {
    swipeOffset.value[convId] = 70;
  } else {
    swipeOffset.value[convId] = 0;
    swipingConvId.value = null;
  }
};

const groupChatName = ref('');
const groupChatParticipants = ref<any[]>([]);
const groupChatSearchQuery = ref('');

const contextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  messageId: string;
  message: any;
}>({
  visible: false,
  x: 0,
  y: 0,
  messageId: '',
  message: null,
});

const conversationContextMenu = ref<{ visible: boolean; x: number; y: number; conversation: any }>({
  visible: false,
  x: 0,
  y: 0,
  conversation: null,
});

const isDragOver = ref(false);
const dragCounter = ref(0);
const translations = ref<Record<string, string>>({});

const handleTranslate = async (message: any) => {
  if (translations.value[message.id]) {
    delete translations.value[message.id];
    return;
  }

  try {
    // In a real app, this would call a translation API
    // For now, we simulate with a simple logic or call a mock
    const response = await api.post('/api/messages/translate', {
      content: message.content,
      targetLang: (authStore.user as any)?.language || 'zh',
    });
    translations.value[message.id] = response.data.translation;
  } catch (error) {
    ElMessage.error(t('messages.sendFailed'));
  }
};

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const filteredMessages = computed(() => {
  if (!messageSearchQuery.value.trim()) return messages.value;
  const query = messageSearchQuery.value.toLowerCase();
  return messages.value.filter(
    (m) => m.type === 'TEXT' && m.content && m.content.toLowerCase().includes(query),
  );
});

const filteredConversations = computed(() => {
  if (!conversations.value) return [];
  if (!searchQuery.value.trim()) return conversations.value;
  const query = searchQuery.value.toLowerCase();
  return conversations.value.filter((c) => {
    const participant = getOtherParticipant(c);
    const name = c.isGroup ? c.name : participant?.name;
    return (name || participant?.email || '').toLowerCase().includes(query);
  });
});

const addEmoji = (emoji: string) => {
  newMessage.value += emoji;
  showEmojiPicker.value = false;
};

const filteredPublicUsers = computed(() => {
  const query = userSearchQuery.value.toLowerCase();
  return publicUsers.value.filter(
    (u) => (u.name || '').toLowerCase().includes(query) || u.email.toLowerCase().includes(query),
  );
});

const filteredGroupUsers = computed(() => {
  const query = groupChatSearchQuery.value.toLowerCase();
  return publicUsers.value.filter((u) => {
    const isAlreadyAdded = groupChatParticipants.value.some((p) => p.id === u.id);
    return (
      !isAlreadyAdded &&
      ((u.name || '').toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
    );
  });
});

const getConversationName = (conv: any) => {
  if (!conv) return '';
  if (conv.isGroup) return conv.name || '未命名群聊';
  const other = getOtherParticipant(conv);
  return other?.name || other?.email || '未知用户';
};

const getLastMessagePreview = (conv: any) => {
  const lastMsg = conv.messages?.[0];
  if (!lastMsg) return '暂无消息';
  const senderName = lastMsg.sender?.name || '未知';
  const prefix = conv.isGroup ? `${senderName}: ` : '';
  switch (lastMsg.type) {
    case 'IMAGE':
      return `${prefix}[图片]`;
    case 'FILE':
      return `${prefix}[文件] ${lastMsg.content.split('/').pop()}`;
    case 'SYSTEM':
      return lastMsg.content;
    default:
      return `${prefix}${lastMsg.content}`;
  }
};

const fetchConversations = async () => {
  isLoadingConversations.value = true;
  try {
    const response = await api.get('/api/messages/conversations');
    const seen = new Map<string, any>();
    for (const conv of response.data) {
      if (seen.has(conv.id)) continue;
      seen.set(conv.id, conv);
    }
    conversations.value = Array.from(seen.values());
    if (conversations.value.length > 0 && !activeConversation.value) {
      selectConversation(conversations.value[0]);
    }
  } catch (error) {
    console.error('Fetch conversations error:', error);
  } finally {
    isLoadingConversations.value = false;
  }
};

const selectConversation = async (conv: any) => {
  if (activeConversation.value && activeConversation.value.id !== conv.id) {
    socketService.emit('leave_conversation', activeConversation.value.id);
  }
  activeConversation.value = conv;
  hasMoreMessages.value = false;
  nextCursor.value = null;
  fetchMessages(conv.id);
  socketService.emit('join_conversation', conv.id);

  if (conv.unreadCount > 0) {
    api.patch(`/api/messages/conversations/${conv.id}/read`);
    conv.unreadCount = 0;
  }
};

const fetchMessages = async (id: string, cursor?: string) => {
  if (!cursor) isLoadingMessages.value = true;
  else isLoadingOlderMessages.value = true;

  try {
    const params: any = { limit: 50 };
    if (cursor) params.cursor = cursor;
    const response = await api.get(`/api/messages/conversations/${id}/messages`, { params });

    if (cursor) {
      const prevHeight = messagesContainer.value?.scrollHeight || 0;
      messages.value = [...response.data.messages, ...messages.value];
      hasMoreMessages.value = response.data.hasMore;
      nextCursor.value = response.data.nextCursor;
      await nextTick();
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight - prevHeight;
      }
    } else {
      messages.value = response.data.messages;
      hasMoreMessages.value = response.data.hasMore;
      nextCursor.value = response.data.nextCursor;
      scrollToBottom();
    }
  } catch (error) {
    console.error('Fetch messages error:', error);
  } finally {
    isLoadingMessages.value = false;
    isLoadingOlderMessages.value = false;
  }
};

const loadOlderMessages = () => {
  if (hasMoreMessages.value && nextCursor.value && !isLoadingOlderMessages.value) {
    fetchMessages(activeConversation.value.id, nextCursor.value!);
  }
};

const handleScroll = () => {
  if (messagesContainer.value && messagesContainer.value.scrollTop < 100 && hasMoreMessages.value) {
    loadOlderMessages();
  }
};

const handleSendMessage = async (type = 'TEXT', content?: string) => {
  if (!activeConversation.value) return;

  const msgContent = content || newMessage.value;
  if (!msgContent.trim() && type === 'TEXT') return;

  if (type === 'TEXT') newMessage.value = '';
  const replyId = replyToMessage.value?.id;
  replyToMessage.value = null;

  try {
    await api.post('/api/messages/messages', {
      conversationId: activeConversation.value.id,
      content: msgContent,
      type,
      ...(replyId && { replyToId: replyId }),
    });
  } catch (error) {
    ElMessage.error(t('messages.sendFailed'));
    if (type === 'TEXT') newMessage.value = msgContent;
  }
};

const handleDeleteMessage = async (messageId: string) => {
  try {
    await ElMessageBox.confirm(t('messages.deleteConfirm'), t('common.confirm'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });
    await api.delete(`/api/messages/messages/${messageId}`);
    ElMessage.success(t('messages.deleteSuccess'));
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('common.deleteFailed'));
    }
  }
};

const setReplyTo = (msg: any) => {
  replyToMessage.value = msg;
  contextMenu.value.visible = false;
};

const cancelReply = () => {
  replyToMessage.value = null;
};

const toggleReaction = async (messageId: string, emoji: string) => {
  showReactionPicker.value = null;
  try {
    const msg = messages.value.find((m) => m.id === messageId);
    if (!msg) return;
    const existing = msg.reactions?.find(
      (r: any) => r.emoji === emoji && r.userId === authStore.user?.id,
    );
    if (existing) {
      await api.delete(`/api/messages/messages/${messageId}/reactions/${emoji}`);
    } else {
      await api.post(`/api/messages/messages/${messageId}/reactions`, { emoji });
    }
  } catch (error) {
    console.error('Toggle reaction error:', error);
  }
};

const getGroupedReactions = (reactions: any[]) => {
  if (!reactions || reactions.length === 0) return [];
  const groups: Record<
    string,
    { emoji: string; count: number; hasMine: boolean; users: string[] }
  > = {};
  reactions.forEach((r) => {
    if (!groups[r.emoji]) {
      groups[r.emoji] = { emoji: r.emoji, count: 0, hasMine: false, users: [] };
    }
    groups[r.emoji].count++;
    groups[r.emoji].users.push(r.user?.name || '未知');
    if (r.userId === authStore.user?.id) groups[r.emoji].hasMine = true;
  });
  return Object.values(groups);
};

const triggerFileUpload = () => {
  fileInput.value?.click();
};

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  const file = input.files[0];
  const formData = new FormData();
  formData.append('message_file', file);

  isUploading.value = true;
  try {
    const res = await api.post('/api/messages/upload', formData);
    const { url, type } = res.data;
    handleSendMessage(type, url);
  } catch (error) {
    ElMessage.error('上传失败');
  } finally {
    isUploading.value = false;
    input.value = '';
  }
};

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault();
  dragCounter.value++;
  isDragOver.value = true;
};

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault();
  dragCounter.value--;
  if (dragCounter.value <= 0) {
    dragCounter.value = 0;
    isDragOver.value = false;
  }
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  isDragOver.value = true;
};

const handleDrop = async (event: DragEvent) => {
  event.preventDefault();
  isDragOver.value = false;
  dragCounter.value = 0;
  const files = event.dataTransfer?.files;
  if (!files?.length) return;

  const file = files[0];
  const formData = new FormData();
  formData.append('message_file', file);

  isUploading.value = true;
  try {
    const res = await api.post('/api/messages/upload', formData);
    const { url, type } = res.data;
    handleSendMessage(type, url);
  } catch (error) {
    ElMessage.error('上传失败');
  } finally {
    isUploading.value = false;
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

const getOtherParticipant = (conv: any) => {
  if (!conv) return null;
  return conv.participants?.find((p: any) => p.id !== authStore.user?.id) || conv.participants?.[0];
};

const fetchPublicUsers = async () => {
  isLoadingUsers.value = true;
  try {
    const response = await api.get('/api/auth/users/public');
    publicUsers.value = response.data.filter((u: any) => u.id !== authStore.user?.id);
  } catch (error) {
    console.error('Fetch users error:', error);
  } finally {
    isLoadingUsers.value = false;
  }
};

const startNewChat = async (user: any) => {
  try {
    const response = await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    isNewChatDialogOpen.value = false;
    userSearchQuery.value = '';

    const existing = conversations.value.find((c) => c.id === response.data.id);
    if (!existing) {
      conversations.value.unshift(response.data);
      selectConversation(response.data);
    } else {
      selectConversation(existing);
    }
  } catch (error) {
    ElMessage.error('创建对话失败');
  }
};

const createGroupChat = async () => {
  if (groupChatParticipants.value.length === 0) {
    ElMessage.warning('请至少选择一位成员');
    return;
  }
  if (!groupChatName.value.trim()) {
    ElMessage.warning('请输入群聊名称');
    return;
  }

  try {
    const response = await api.post('/api/messages/conversations', {
      participantIds: groupChatParticipants.value.map((u) => u.id),
      isGroup: true,
      name: groupChatName.value.trim(),
    });
    isGroupChatDialogOpen.value = false;
    groupChatName.value = '';
    groupChatParticipants.value = [];
    groupChatSearchQuery.value = '';

    conversations.value.unshift(response.data);
    selectConversation(response.data);
  } catch (error) {
    ElMessage.error('创建群聊失败');
  }
};

const addGroupParticipant = (user: any) => {
  if (!groupChatParticipants.value.some((p) => p.id === user.id)) {
    groupChatParticipants.value.push(user);
  }
};

const removeGroupParticipant = (userId: string) => {
  groupChatParticipants.value = groupChatParticipants.value.filter((p) => p.id !== userId);
};

const leaveGroupChat = async () => {
  if (!activeConversation.value?.isGroup) return;
  try {
    await api.post(`/api/messages/conversations/${activeConversation.value.id}/leave`);
    conversations.value = conversations.value.filter((c) => c.id !== activeConversation.value.id);
    activeConversation.value = null;
    isInfoPanelOpen.value = false;
    if (conversations.value.length > 0) {
      selectConversation(conversations.value[0]);
    }
    ElMessage.success('已退出群聊');
  } catch (error) {
    ElMessage.error('退出群聊失败');
  }
};

const deleteConversation = async (conv: any) => {
  try {
    await ElMessageBox.confirm('确定要删除此会话吗？这将清除你的本地聊天记录。', '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/messages/conversations/${conv.id}`);
    conversations.value = conversations.value.filter((c) => c.id !== conv.id);
    if (activeConversation.value?.id === conv.id) {
      activeConversation.value = null;
      isInfoPanelOpen.value = false;
      if (conversations.value.length > 0) {
        selectConversation(conversations.value[0]);
      }
    }
    ElMessage.success('会话已删除');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除会话失败');
    }
  }
  conversationContextMenu.value.visible = false;
  if (conv.id) swipeOffset.value[conv.id] = 0;
};

const handleConversationContextMenu = (event: MouseEvent, conv: any) => {
  event.preventDefault();
  event.stopPropagation();
  conversationContextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    conversation: conv,
  };
};

const closeConversationContextMenu = () => {
  conversationContextMenu.value.visible = false;
};

const openLink = (url: string) => {
  window.open(url, '_blank');
};

const isMessageRead = (msg: any) => {
  if (!activeConversation.value) return false;
  return msg.readBy && msg.readBy.length > 0;
};

const isOtherTyping = ref(false);
let typingTimeout: any = null;

const handleTyping = () => {
  if (!activeConversation.value) return;
  socketService.emit('typing', {
    conversationId: activeConversation.value.id,
    isTyping: true,
  });

  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socketService.emit('typing', {
      conversationId: activeConversation.value.id,
      isTyping: false,
    });
  }, 2000);
};

const handleContextMenu = (event: MouseEvent, msg: any) => {
  event.preventDefault();
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    messageId: msg.id,
    message: msg,
  };
};

const closeContextMenu = () => {
  contextMenu.value.visible = false;
};

const copyMessage = (content: string) => {
  navigator.clipboard.writeText(content);
  contextMenu.value.visible = false;
  ElMessage.success('已复制到剪贴板');
};

const formatDateSeparator = (date: string | Date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return '今天';
  if (d.toDateString() === yesterday.toDateString()) return '昨天';

  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
};

const shouldShowDateSeparator = (currentMsg: any, previousMsg: any | null) => {
  if (!previousMsg) return true;
  const currentDate = new Date(currentMsg.createdAt).toDateString();
  const previousDate = new Date(previousMsg.createdAt).toDateString();
  return currentDate !== previousDate;
};

const shouldShowSenderAvatar = (currentMsg: any, previousMsg: any | null) => {
  if (currentMsg.senderId === authStore.user?.id) return false;
  if (!previousMsg) return true;
  if (previousMsg.senderId !== currentMsg.senderId) return true;
  const timeDiff =
    new Date(currentMsg.createdAt).getTime() - new Date(previousMsg.createdAt).getTime();
  return timeDiff > 5 * 60 * 1000;
};

const shouldShowTimestamp = (currentMsg: any, nextMsg: any | null) => {
  if (!nextMsg) return true;
  if (nextMsg.senderId !== currentMsg.senderId) return true;
  const timeDiff = new Date(nextMsg.createdAt).getTime() - new Date(currentMsg.createdAt).getTime();
  return timeDiff > 5 * 60 * 1000;
};

const escapeHtml = (text: string) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const renderTextWithLinks = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);
  return parts
    .map((part) => {
      if (urlRegex.test(part)) {
        return `<a href="${escapeHtml(part)}" target="_blank" rel="noopener noreferrer" class="text-accent underline hover:no-underline">${escapeHtml(part)}</a>`;
      }
      return escapeHtml(part);
    })
    .join('');
};

const updateSidebarWithNewMessage = (message: any) => {
  const convIndex = conversations.value.findIndex((c) => c.id === message.conversationId);
  if (convIndex !== -1) {
    const conv = conversations.value[convIndex];
    conv.messages = [message];
    conv.updatedAt = message.createdAt;
    if (activeConversation.value?.id !== message.conversationId) {
      conv.unreadCount = (conv.unreadCount || 0) + 1;
      authStore.incrementUnreadMessagesCount();
    }
    conversations.value.splice(convIndex, 1);
    conversations.value.unshift(conv);
  } else {
    fetchConversations().then(() => {
      const total = conversations.value.reduce(
        (acc: number, c: any) => acc + (c.unreadCount || 0),
        0,
      );
      authStore.setUnreadMessagesCount(total);
    });
  }
};

onMounted(() => {
  fetchConversations();

  document.addEventListener('click', closeContextMenu);
  document.addEventListener('click', closeConversationContextMenu);

  socketService.on('new_message', (message) => {
    if (activeConversation.value?.id === message.conversationId) {
      messages.value.push(message);
      scrollToBottom();
      api.patch(`/api/messages/conversations/${message.conversationId}/read`);
    }
    updateSidebarWithNewMessage(message);
  });

  socketService.on('message_received', ({ conversationId, message }) => {
    if (activeConversation.value?.id !== conversationId) {
      updateSidebarWithNewMessage(message);
    }
  });

  socketService.on('message_deleted', ({ messageId, conversationId }) => {
    if (activeConversation.value?.id === conversationId) {
      messages.value = messages.value.filter((m) => m.id !== messageId);
    }
    const conv = conversations.value.find((c) => c.id === conversationId);
    if (conv && conv.messages[0]?.id === messageId) {
      fetchConversations();
    }
  });

  socketService.on('messages_read', ({ conversationId, messageIds, userId }) => {
    if (activeConversation.value?.id === conversationId && userId !== authStore.user?.id) {
      messages.value = messages.value.map((m) => {
        if (messageIds.includes(m.id)) {
          return {
            ...m,
            readBy: [...(m.readBy || []), { userId }],
          };
        }
        return m;
      });
    }
  });

  socketService.on('user_typing', ({ userId, conversationId, isTyping }) => {
    if (activeConversation.value?.id === conversationId && userId !== authStore.user?.id) {
      isOtherTyping.value = isTyping;
    }
  });

  socketService.on('message_reaction', ({ messageId, reaction }) => {
    const msg = messages.value.find((m) => m.id === messageId);
    if (msg) {
      if (!msg.reactions) msg.reactions = [];
      const exists = msg.reactions.find((r: any) => r.id === reaction.id);
      if (!exists) msg.reactions.push(reaction);
    }
  });

  socketService.on('message_reaction_removed', ({ messageId, userId, emoji }) => {
    const msg = messages.value.find((m) => m.id === messageId);
    if (msg && msg.reactions) {
      msg.reactions = msg.reactions.filter((r: any) => !(r.emoji === emoji && r.userId === userId));
    }
  });

  socketService.on('conversation_updated', (updatedConv) => {
    if (activeConversation.value?.id === updatedConv.id) {
      activeConversation.value = { ...activeConversation.value, ...updatedConv };
    }
    const idx = conversations.value.findIndex((c) => c.id === updatedConv.id);
    if (idx !== -1) {
      conversations.value[idx] = { ...conversations.value[idx], ...updatedConv };
    }
  });

  socketService.on('conversation_removed', ({ conversationId }) => {
    conversations.value = conversations.value.filter((c) => c.id !== conversationId);
    if (activeConversation.value?.id === conversationId) {
      activeConversation.value = null;
      isInfoPanelOpen.value = false;
      if (conversations.value.length > 0) {
        selectConversation(conversations.value[0]);
      }
    }
  });
});

onUnmounted(() => {
  socketService.off('new_message');
  socketService.off('message_deleted');
  socketService.off('messages_read');
  socketService.off('user_typing');
  socketService.off('message_reaction');
  socketService.off('message_reaction_removed');
  socketService.off('message_received');
  socketService.off('conversation_updated');
  socketService.off('conversation_removed');
  document.removeEventListener('click', closeContextMenu);
  document.removeEventListener('click', closeConversationContextMenu);
  if (activeConversation.value) {
    socketService.emit('leave_conversation', activeConversation.value.id);
  }
});

watch(
  () => isNewChatDialogOpen.value,
  (val) => {
    if (val && publicUsers.value.length === 0) fetchPublicUsers();
  },
);

watch(
  () => isGroupChatDialogOpen.value,
  (val) => {
    if (val && publicUsers.value.length === 0) fetchPublicUsers();
  },
);
</script>

<template>
  <div
    class="flex-1 flex h-full overflow-hidden"
    style="background-color: var(--bg-app)"
    @click="
      closeContextMenu();
      closeConversationContextMenu();
    "
  >
    <!-- Contacts Sidebar -->
    <div
      class="w-80 border-r flex flex-col shrink-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="p-6 border-b" style="border-color: var(--border-base)">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-xl font-bold" style="color: var(--text-primary)">
            {{ t('messages.title') }}
          </h1>
          <div class="flex gap-1">
            <button
              class="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl hover:bg-indigo-500 hover:text-white transition-all"
              title="创建群聊"
              @click="isGroupChatDialogOpen = true"
            >
              <Users class="w-4 h-4" />
            </button>
            <button
              class="p-2 bg-accent/10 text-accent rounded-xl hover:bg-accent hover:text-white transition-all"
              title="发起新聊天"
              @click="isNewChatDialogOpen = true"
            >
              <Plus class="w-4 h-4" />
            </button>
          </div>
        </div>
        <div class="relative">
          <Search
            class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
            style="color: var(--text-muted)"
          />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('messages.searchPlaceholder')"
            class="pl-10 pr-4 py-2 border-none rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-full transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto scrollbar-hide">
        <div v-if="isLoadingConversations" class="p-10 text-center">
          <div
            class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"
          ></div>
          <p class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
            {{ t('messages.syncing') }}
          </p>
        </div>

        <template v-else>
          <div
            v-for="conv in filteredConversations"
            :key="conv.id"
            class="p-4 flex gap-3 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-white/5 relative group overflow-hidden"
            :class="activeConversation?.id === conv.id ? 'bg-accent-subtle' : ''"
            @click="selectConversation(conv)"
            @contextmenu="handleConversationContextMenu($event, conv)"
            @touchstart="handleTouchStart($event, conv.id)"
            @touchmove="handleTouchMove($event, conv.id)"
            @touchend="handleTouchEnd(conv.id)"
          >
            <div
              v-if="activeConversation?.id === conv.id"
              class="absolute left-0 top-0 bottom-0 w-1 bg-accent"
            ></div>

            <!-- Swipe Delete Action (Background) -->
            <div
              class="absolute inset-y-0 right-0 bg-rose-500 flex items-center justify-center transition-all duration-200 z-0"
              :style="{ width: (swipeOffset[conv.id] || 0) + 'px' }"
            >
              <button
                class="w-full h-full flex items-center justify-center text-white"
                @click.stop="deleteConversation(conv)"
              >
                <Trash2 class="w-5 h-5" />
              </button>
            </div>

            <!-- Content Area -->
            <div
              class="flex flex-1 gap-3 transition-transform duration-200 z-10"
              :style="{ transform: `translateX(-${swipeOffset[conv.id] || 0}px)` }"
            >
              <div class="relative shrink-0">
                <template v-if="conv.isGroup">
                  <div
                    class="w-12 h-12 rounded-full border flex items-center justify-center"
                    :class="conv.avatarUrl ? '' : 'bg-indigo-500/10'"
                    style="border-color: var(--border-base)"
                  >
                    <img
                      v-if="conv.avatarUrl"
                      :src="conv.avatarUrl"
                      class="w-12 h-12 rounded-full object-cover"
                    />
                    <Users v-else class="w-5 h-5 text-indigo-500" />
                  </div>
                </template>
                <template v-else>
                  <UserAvatar
                    :user="getOtherParticipant(conv)"
                    size="md"
                    class="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
                    @click.stop="openUserProfile(getOtherParticipant(conv)?.id)"
                  />
                  <div
                    v-if="authStore.isUserOnline(getOtherParticipant(conv)?.id)"
                    class="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 rounded-full z-40"
                    style="border-color: var(--bg-card)"
                  ></div>
                </template>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <span
                    class="text-sm font-bold truncate pr-2 flex items-center gap-1.5"
                    style="color: var(--text-primary)"
                  >
                    <Hash v-if="conv.isGroup" class="w-3 h-3 text-indigo-400 shrink-0" />
                    {{ getConversationName(conv) }}
                  </span>
                  <span class="text-[9px] font-medium shrink-0" style="color: var(--text-muted)">
                    {{
                      new Date(conv.updatedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <p class="text-xs truncate pr-4" style="color: var(--text-secondary)">
                    {{ getLastMessagePreview(conv) }}
                  </p>
                  <div
                    v-if="conv.unreadCount > 0"
                    class="shrink-0 min-w-[16px] h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
                  >
                    {{ conv.unreadCount }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Hover Delete Button (for Desktop) -->
            <button
              class="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-600 z-20 shadow-lg md:flex hidden"
              title="删除会话"
              @click.stop="deleteConversation(conv)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>

          <div v-if="filteredConversations.length === 0" class="py-20 text-center text-slate-400">
            <MessageSquare class="w-10 h-10 mx-auto mb-3 opacity-10" />
            <p class="text-xs">{{ t('messages.noConversations') }}</p>
          </div>
        </template>
      </div>
    </div>

    <!-- Chat Area -->
    <div
      class="flex-1 flex flex-col relative"
      style="background-color: var(--bg-app)"
      @dragenter="handleDragEnter"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- Drag overlay -->
      <div
        v-if="isDragOver"
        class="absolute inset-0 z-50 bg-accent/10 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-accent rounded-2xl m-4 pointer-events-none"
      >
        <div class="text-center">
          <Paperclip class="w-12 h-12 text-accent mx-auto mb-3" />
          <p class="text-lg font-bold text-accent">{{ t('messages.dropToUpload') }}</p>
        </div>
      </div>

      <template v-if="activeConversation">
        <!-- Chat Header -->
        <div
          class="h-16 border-b px-6 flex items-center justify-between shrink-0"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <div class="flex items-center gap-3">
            <template v-if="activeConversation.isGroup">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center"
                :class="activeConversation.avatarUrl ? '' : 'bg-indigo-500/10'"
              >
                <img
                  v-if="activeConversation.avatarUrl"
                  :src="activeConversation.avatarUrl"
                  class="w-10 h-10 rounded-full object-cover"
                />
                <Users v-else class="w-5 h-5 text-indigo-500" />
              </div>
            </template>
            <template v-else>
              <UserAvatar
                :user="getOtherParticipant(activeConversation)"
                size="md"
                class="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
                @click="openUserProfile(getOtherParticipant(activeConversation)?.id)"
              />
            </template>
            <div>
              <p
                class="text-sm font-bold flex items-center gap-1.5"
                style="color: var(--text-primary)"
              >
                <Hash v-if="activeConversation.isGroup" class="w-3.5 h-3.5 text-indigo-400" />
                {{ getConversationName(activeConversation) }}
                <span
                  v-if="activeConversation.isGroup"
                  class="text-[10px] font-medium text-slate-400 ml-1"
                  >{{ activeConversation.participants?.length || 0
                  }}{{ t('messages.groupParticipants') }}</span
                >
              </p>
              <p v-if="isOtherTyping" class="text-[10px] text-accent font-bold animate-pulse">
                {{ t('messages.typing') }}
              </p>
              <p
                v-else-if="!activeConversation.isGroup"
                class="text-[10px] font-bold flex items-center gap-1"
                :class="
                  authStore.isUserOnline(getOtherParticipant(activeConversation)?.id)
                    ? 'text-emerald-500'
                    : 'text-slate-400'
                "
              >
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :class="
                    authStore.isUserOnline(getOtherParticipant(activeConversation)?.id)
                      ? 'bg-emerald-500'
                      : 'bg-slate-300'
                  "
                ></span>
                {{
                  authStore.isUserOnline(getOtherParticipant(activeConversation)?.id)
                    ? t('messages.online')
                    : t('messages.offline')
                }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <el-popover
              placement="bottom-end"
              :width="280"
              trigger="click"
              popper-style="padding: 12px; border-radius: 16px; border: 1px solid var(--border-base); background-color: var(--bg-card); box-shadow: var(--el-box-shadow-dark);"
            >
              <template #reference>
                <button
                  class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all text-slate-400 mr-2"
                >
                  <Search class="w-4 h-4" />
                </button>
              </template>
              <div class="relative">
                <Search
                  class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  v-model="messageSearchQuery"
                  type="text"
                  :placeholder="t('messages.searchMessages')"
                  class="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  style="color: var(--text-primary)"
                />
              </div>
            </el-popover>
            <button
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
              style="color: var(--text-muted)"
              :title="t('messages.voiceMessage')"
            >
              <Mic class="w-4 h-4" />
            </button>
            <button
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
              style="color: var(--text-muted)"
              :title="t('messages.translate')"
            >
              <Languages class="w-4 h-4" />
            </button>
            <div class="w-px h-4 mx-2" style="background-color: var(--border-base)"></div>
            <button
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
              :class="isInfoPanelOpen ? 'text-accent' : ''"
              :style="!isInfoPanelOpen ? 'color: var(--text-muted)' : ''"
              @click="isInfoPanelOpen = !isInfoPanelOpen"
            >
              <Info class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Messages Area -->
        <div
          ref="messagesContainer"
          class="flex-1 overflow-y-auto p-6 space-y-1 scrollbar-hide"
          @scroll="handleScroll"
        >
          <!-- Load older messages button -->
          <div v-if="hasMoreMessages" class="text-center py-3 mb-4">
            <button
              :disabled="isLoadingOlderMessages"
              class="px-4 py-2 text-xs font-bold text-accent hover:bg-accent/10 rounded-xl transition-all"
              @click="loadOlderMessages"
            >
              <div
                v-if="isLoadingOlderMessages"
                class="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto"
              ></div>
              <template v-else>{{ t('messages.loadOlder') }}</template>
            </button>
          </div>

          <template v-for="(msg, index) in filteredMessages" :key="msg.id">
            <!-- Date Separator -->
            <div
              v-if="shouldShowDateSeparator(msg, filteredMessages[index - 1])"
              class="flex items-center justify-center my-6"
            >
              <div
                class="px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style="
                  background-color: var(--bg-card);
                  color: var(--text-muted);
                  border: 1px solid var(--border-base);
                "
              >
                {{ formatDateSeparator(msg.createdAt) }}
              </div>
            </div>

            <!-- System Message -->
            <div v-if="msg.type === 'SYSTEM'" class="flex items-center justify-center my-3">
              <div
                class="px-4 py-1.5 rounded-full text-[10px] font-medium"
                style="background-color: var(--bg-card); color: var(--text-muted)"
              >
                {{ msg.content }}
              </div>
            </div>

            <!-- Normal Message -->
            <div
              v-else
              class="flex group"
              :class="msg.senderId === authStore.user?.id ? 'justify-end' : 'justify-start'"
            >
              <div
                class="flex gap-3 max-w-[70%]"
                :class="msg.senderId === authStore.user?.id ? 'flex-row-reverse' : ''"
              >
                <!-- Avatar -->
                <div
                  v-if="shouldShowSenderAvatar(msg, filteredMessages[index - 1])"
                  class="shrink-0 mb-1"
                >
                  <UserAvatar
                    v-if="msg.senderId !== authStore.user?.id"
                    :user="msg.sender"
                    size="md"
                    class="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
                    @click="openUserProfile(msg.senderId)"
                  />
                  <UserAvatar v-else :user="authStore.user" size="md" />
                </div>
                <div v-else class="w-10 shrink-0"></div>

                <div
                  class="flex flex-col relative"
                  :class="msg.senderId === authStore.user?.id ? 'items-end' : 'items-start'"
                >
                  <!-- Sender name for group chats -->
                  <p
                    v-if="
                      activeConversation?.isGroup &&
                      msg.senderId !== authStore.user?.id &&
                      shouldShowSenderAvatar(msg, filteredMessages[index - 1])
                    "
                    class="text-[10px] font-bold mb-1 px-1"
                    style="color: var(--text-muted)"
                  >
                    {{ msg.sender?.name || '未知' }}
                  </p>

                  <!-- Reply Preview -->
                  <div
                    v-if="msg.replyTo"
                    class="mb-1 px-3 py-1.5 rounded-xl text-[10px] max-w-full border-l-2 border-accent"
                    style="background-color: var(--bg-card); color: var(--text-secondary)"
                  >
                    <span class="font-bold text-accent">{{
                      msg.replyTo.sender?.name || '未知'
                    }}</span>
                    <span class="ml-1 truncate inline-block max-w-[200px] align-bottom">{{
                      msg.replyTo.type === 'IMAGE'
                        ? '[图片]'
                        : msg.replyTo.type === 'FILE'
                          ? '[文件]'
                          : msg.replyTo.content
                    }}</span>
                  </div>

                  <!-- Message Content -->
                  <div
                    class="px-4 py-2.5 rounded-2xl text-sm shadow-sm relative"
                    :class="
                      msg.senderId === authStore.user?.id
                        ? 'bg-accent text-white rounded-br-none'
                        : 'rounded-bl-none border'
                    "
                    :style="
                      msg.senderId !== authStore.user?.id
                        ? 'background-color: var(--bg-card); color: var(--text-primary); border-color: var(--border-base)'
                        : ''
                    "
                    @contextmenu="handleContextMenu($event, msg)"
                  >
                    <template v-if="msg.type === 'IMAGE'">
                      <img
                        :src="api.defaults.baseURL + msg.content"
                        class="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        @click="openLink(api.defaults.baseURL + msg.content)"
                      />
                    </template>
                    <template v-else-if="msg.type === 'FILE'">
                      <div
                        class="flex items-center gap-3 p-2 bg-black/5 dark:bg-white/5 rounded-xl border border-white/10"
                      >
                        <div
                          class="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center text-accent"
                        >
                          <Paperclip class="w-5 h-5" />
                        </div>
                        <div class="flex-1 min-w-0 pr-4">
                          <p class="text-xs font-bold truncate">
                            {{ msg.content.split('/').pop() }}
                          </p>
                          <a
                            :href="api.defaults.baseURL + msg.content"
                            target="_blank"
                            class="text-[10px] text-accent hover:underline font-bold"
                            >点击下载</a
                          >
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <span v-html="sanitizeHtml(renderTextWithLinks(msg.content))"></span>

                      <!-- Translation Display -->
                      <div
                        v-if="translations[msg.id]"
                        class="mt-2 pt-2 border-t border-white/20 dark:border-slate-800 flex flex-col gap-1"
                      >
                        <div class="flex items-center gap-1.5 text-[9px] font-bold opacity-60">
                          <Languages class="w-3 h-3" />
                          {{ t('messages.translate') }}
                        </div>
                        <p class="text-xs italic opacity-90">{{ translations[msg.id] }}</p>
                      </div>
                    </template>
                  </div>

                  <!-- Message Actions (On Hover) -->
                  <div
                    class="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <button
                      v-if="msg.type === 'TEXT'"
                      class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-all"
                      :class="translations[msg.id] ? 'text-accent' : 'text-slate-400'"
                      :title="t('messages.translate')"
                      @click="handleTranslate(msg)"
                    >
                      <Languages class="w-3 h-3" />
                    </button>
                    <button
                      class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 transition-all"
                      @click="setReplyTo(msg)"
                    >
                      <Reply class="w-3 h-3" />
                    </button>
                    <button
                      class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 transition-all"
                      @click="showReactionPicker = msg.id"
                    >
                      <SmilePlus class="w-3 h-3" />
                    </button>
                  </div>

                  <!-- Quick reaction button on hover -->
                  <div
                    class="absolute -bottom-1 opacity-0 group-hover:opacity-100 transition-all flex gap-1 z-10"
                    :class="msg.senderId === authStore.user?.id ? '-left-1' : '-right-1'"
                  >
                    <button
                      class="p-1 rounded-full hover:scale-110 shadow-sm border border-[var(--border-base)]"
                      style="background-color: var(--bg-card)"
                      @click.stop="
                        showReactionPicker = showReactionPicker === msg.id ? null : msg.id
                      "
                    >
                      <SmilePlus class="w-3 h-3 text-[var(--text-muted)]" />
                    </button>
                    <button
                      v-if="msg.senderId === authStore.user?.id"
                      class="p-1 rounded-full hover:scale-110 shadow-sm border border-[var(--border-base)] hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      style="background-color: var(--bg-card)"
                      title="删除消息"
                      @click.stop="handleDeleteMessage(msg.id)"
                    >
                      <Trash2 class="w-3 h-3 text-rose-500" />
                    </button>
                  </div>

                  <!-- Reaction Picker Popup -->
                  <div
                    v-if="showReactionPicker === msg.id"
                    class="flex gap-0.5 p-1.5 rounded-2xl shadow-xl border z-30 mb-1"
                    style="background-color: var(--bg-card); border-color: var(--border-base)"
                    @click.stop
                  >
                    <button
                      v-for="emoji in reactionEmojis"
                      :key="emoji"
                      class="w-8 h-8 flex items-center justify-center text-base hover:scale-125 hover:bg-accent/10 rounded-lg transition-all"
                      @click="toggleReaction(msg.id, emoji)"
                    >
                      {{ emoji }}
                    </button>
                  </div>

                  <!-- Reactions Display -->
                  <div
                    v-if="msg.reactions && getGroupedReactions(msg.reactions).length > 0"
                    class="flex flex-wrap gap-1 mt-1"
                  >
                    <button
                      v-for="group in getGroupedReactions(msg.reactions)"
                      :key="group.emoji"
                      class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all hover:scale-105"
                      :class="group.hasMine ? 'bg-accent/10 text-accent ring-1 ring-accent/30' : ''"
                      :style="
                        !group.hasMine
                          ? 'background-color: var(--bg-card); color: var(--text-secondary); border: 1px solid var(--border-base)'
                          : ''
                      "
                      :title="group.users.join(', ')"
                      @click="toggleReaction(msg.id, group.emoji)"
                    >
                      <span>{{ group.emoji }}</span>
                      <span>{{ group.count }}</span>
                    </button>
                  </div>

                  <!-- Timestamp -->
                  <div
                    v-if="shouldShowTimestamp(msg, filteredMessages[index + 1])"
                    class="flex items-center gap-1 mt-1 px-1"
                  >
                    <span class="text-[9px] font-medium text-slate-400">
                      {{
                        new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }}
                    </span>
                    <template v-if="msg.senderId === authStore.user?.id">
                      <CheckCheck v-if="isMessageRead(msg)" class="w-3 h-3 text-accent" />
                      <Check v-else class="w-3 h-3 text-slate-400" />
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div v-if="isLoadingMessages" class="text-center py-4">
            <span class="text-[10px] text-slate-400 animate-pulse">正在加载历史消息...</span>
          </div>
          <div
            v-if="filteredMessages.length === 0 && messageSearchQuery"
            class="text-center py-20 text-slate-400"
          >
            <p class="text-xs">未找到匹配的搜索结果</p>
          </div>
        </div>

        <!-- Reply Bar -->
        <div
          v-if="replyToMessage"
          class="px-6 py-2 border-t flex items-center gap-3"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <Reply class="w-4 h-4 text-accent shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-[10px] font-bold text-accent">
              {{ replyToMessage.sender?.name || '未知' }}
            </p>
            <p class="text-xs truncate" style="color: var(--text-secondary)">
              {{
                replyToMessage.type === 'IMAGE'
                  ? '[图片]'
                  : replyToMessage.type === 'FILE'
                    ? '[文件]'
                    : replyToMessage.content
              }}
            </p>
          </div>
          <button
            class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
            @click="cancelReply"
          >
            <X class="w-3.5 h-3.5" style="color: var(--text-muted)" />
          </button>
        </div>

        <!-- Input Area -->
        <div
          class="p-6 border-t relative"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <!-- Emoji Picker -->
          <div
            v-if="showEmojiPicker"
            class="absolute bottom-full mb-4 left-6 p-4 rounded-3xl shadow-2xl border z-50 grid grid-cols-4 gap-2"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <button
              v-for="emoji in commonEmojis"
              :key="emoji"
              class="w-10 h-10 flex items-center justify-center text-xl hover:bg-accent-subtle rounded-xl transition-all"
              @click="addEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>

          <div
            class="flex items-end gap-3 p-2 rounded-2xl focus-within:ring-4 focus-within:ring-accent/20 transition-all border"
            :class="isDragOver ? 'border-accent ring-4 ring-accent/20' : ''"
            style="background-color: var(--bg-app); border-color: var(--border-base)"
          >
            <div class="flex items-center">
              <button
                class="p-2 hover:text-accent transition-colors"
                :class="showEmojiPicker ? 'text-accent' : ''"
                style="color: var(--text-muted)"
                @click="showEmojiPicker = !showEmojiPicker"
              >
                <Smile class="w-5 h-5" />
              </button>
              <button
                class="p-2 hover:text-accent transition-colors"
                style="color: var(--text-muted)"
                @click="triggerFileUpload"
              >
                <Paperclip class="w-5 h-5" />
              </button>
              <button
                class="p-2 hover:text-accent transition-colors"
                style="color: var(--text-muted)"
              >
                <Mic class="w-5 h-5" />
              </button>
            </div>

            <input ref="fileInput" type="file" class="hidden" @change="handleFileUpload" />

            <textarea
              v-model="newMessage"
              :placeholder="t('sidebar.messages') + '...'"
              rows="1"
              class="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32 scrollbar-hide"
              style="color: var(--text-primary)"
              @input="handleTyping"
              @keydown.enter.prevent="handleSendMessage('TEXT')"
            ></textarea>

            <button
              :disabled="!newMessage.trim() || isUploading"
              class="p-2.5 bg-accent text-white rounded-xl hover:bg-accent transition-all shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center justify-center min-w-[40px]"
              @click="handleSendMessage('TEXT')"
            >
              <div
                v-if="isUploading"
                class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
              ></div>
              <Send v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
      </template>

      <!-- Empty State -->
      <div
        v-else
        class="flex-1 flex flex-col items-center justify-center p-12 text-center"
        style="background-color: var(--bg-app)"
      >
        <div class="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mb-6">
          <MessageSquare class="w-10 h-10 text-accent opacity-20" />
        </div>
        <h2 class="text-xl font-bold mb-2" style="color: var(--text-primary)">开启新对话</h2>
        <p class="text-sm max-w-xs mx-auto mb-8" style="color: var(--text-secondary)">
          在左侧选择一个联系人开始聊天，或者点击加号查找新朋友。
        </p>
        <div class="flex gap-3">
          <button
            class="px-8 py-3 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all"
            @click="isNewChatDialogOpen = true"
          >
            寻找联系人
          </button>
          <button
            class="px-8 py-3 bg-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all"
            @click="isGroupChatDialogOpen = true"
          >
            创建群聊
          </button>
        </div>
      </div>
    </div>

    <!-- Info Panel -->
    <div
      v-if="isInfoPanelOpen && activeConversation"
      class="w-80 border-l flex flex-col shrink-0 overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div
        class="p-6 border-b flex items-center justify-between shrink-0"
        style="border-color: var(--border-base)"
      >
        <h3 class="text-sm font-bold" style="color: var(--text-primary)">会话详情</h3>
        <button
          class="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all"
          @click="isInfoPanelOpen = false"
        >
          <X class="w-4 h-4" style="color: var(--text-muted)" />
        </button>
      </div>

      <!-- Tabs Header -->
      <div class="flex p-1 gap-1 mx-4 mt-4 rounded-xl bg-[var(--bg-app)] shrink-0">
        <button
          v-for="tab in ['info', 'photos', 'files']"
          :key="tab"
          class="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider"
          :class="infoTab === tab ? 'bg-[var(--bg-card)] shadow-sm' : 'text-[var(--text-muted)]'"
          :style="infoTab === tab ? 'color: var(--text-primary)' : ''"
          @click="infoTab = tab as any"
        >
          {{ tab === 'info' ? '信息' : tab === 'photos' ? '照片' : '文件' }}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto scrollbar-hide">
        <!-- Info Tab -->
        <div v-if="infoTab === 'info'">
          <!-- Group Info -->
          <div
            v-if="activeConversation.isGroup"
            class="p-6 text-center border-b"
            style="border-color: var(--border-base)"
          >
            <div
              class="w-20 h-20 rounded-2xl mx-auto mb-3 flex items-center justify-center"
              :class="activeConversation.avatarUrl ? '' : 'bg-indigo-500/10'"
            >
              <img
                v-if="activeConversation.avatarUrl"
                :src="activeConversation.avatarUrl"
                class="w-20 h-20 rounded-2xl object-cover"
              />
              <Users v-else class="w-8 h-8 text-indigo-500" />
            </div>
            <h3 class="text-lg font-bold mb-1" style="color: var(--text-primary)">
              {{ activeConversation.name || '未命名群聊' }}
            </h3>
            <p class="text-xs" style="color: var(--text-muted)">
              群聊 · {{ activeConversation.participants?.length || 0 }} 位成员
            </p>
          </div>

          <!-- 1:1 User Info -->
          <div v-else class="p-6 text-center border-b" style="border-color: var(--border-base)">
            <UserAvatar
              :user="getOtherParticipant(activeConversation)"
              size="xl"
              class="mx-auto mb-3"
            />
            <h3
              class="text-lg font-bold mb-1 cursor-pointer hover:text-accent transition-colors"
              style="color: var(--text-primary)"
              @click="openUserProfile(getOtherParticipant(activeConversation)?.id)"
            >
              {{ getOtherParticipant(activeConversation)?.name || '未知用户' }}
            </h3>
            <p
              class="text-xs flex items-center justify-center gap-1"
              :class="
                authStore.isUserOnline(getOtherParticipant(activeConversation)?.id)
                  ? 'text-emerald-500'
                  : 'text-slate-400'
              "
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="
                  authStore.isUserOnline(getOtherParticipant(activeConversation)?.id)
                    ? 'bg-emerald-500'
                    : 'bg-slate-300'
                "
              ></span>
              {{
                authStore.isUserOnline(getOtherParticipant(activeConversation)?.id)
                  ? '在线'
                  : '离线'
              }}
            </p>
          </div>

          <!-- Members List -->
          <div class="p-6">
            <h4
              class="text-xs font-bold uppercase tracking-wider mb-3"
              style="color: var(--text-muted)"
            >
              {{ activeConversation.isGroup ? '群成员' : '共享群聊' }}
            </h4>
            <div class="space-y-2">
              <div
                v-for="participant in activeConversation.participants"
                :key="participant.id"
                class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
                @click="participant.id !== authStore.user?.id && openUserProfile(participant.id)"
              >
                <div class="relative shrink-0">
                  <UserAvatar :user="participant" size="sm" />
                  <div
                    v-if="authStore.isUserOnline(participant.id)"
                    class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 rounded-full z-40"
                    style="border-color: var(--bg-card)"
                  ></div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate" style="color: var(--text-primary)">
                    {{ participant.name || '未命名用户' }}
                    <span
                      v-if="participant.id === authStore.user?.id"
                      class="text-[10px] text-slate-400 ml-1"
                      >(你)</span
                    >
                  </p>
                  <p class="text-[10px] truncate" style="color: var(--text-muted)">
                    {{ participant.email }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Group Actions -->
            <div v-if="activeConversation.isGroup" class="mt-6 space-y-2">
              <button
                class="w-full py-3 px-4 flex items-center gap-3 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all text-sm font-medium"
                @click="leaveGroupChat"
              >
                <LogOut class="w-4 h-4" />
                退出群聊
              </button>
            </div>
          </div>
        </div>

        <!-- Photos Tab -->
        <div v-else-if="infoTab === 'photos'" class="p-4">
          <div v-if="sharedPhotos.length === 0" class="py-20 text-center opacity-40">
            <ImageIcon class="w-10 h-10 mx-auto mb-2" />
            <p class="text-xs">暂无共享照片</p>
          </div>
          <div v-else class="grid grid-cols-3 gap-2">
            <div
              v-for="photo in sharedPhotos"
              :key="photo.id"
              class="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-all border border-[var(--border-base)]"
              @click="openLink(api.defaults.baseURL + photo.url)"
            >
              <img :src="api.defaults.baseURL + photo.url" class="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        <!-- Files Tab -->
        <div v-else-if="infoTab === 'files'" class="p-4">
          <div v-if="sharedFiles.length === 0" class="py-20 text-center opacity-40">
            <Paperclip class="w-10 h-10 mx-auto mb-2" />
            <p class="text-xs">暂无共享文件</p>
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="file in sharedFiles"
              :key="file.id"
              class="p-3 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] flex items-center gap-3 group"
            >
              <div
                class="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent"
              >
                <Paperclip class="w-5 h-5" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-bold truncate" style="color: var(--text-primary)">
                  {{ file.name }}
                </p>
                <p class="text-[10px]" style="color: var(--text-muted)">
                  {{ formatDateSeparator(file.createdAt) }}
                </p>
              </div>
              <a
                :href="api.defaults.baseURL + file.url"
                target="_blank"
                class="p-2 opacity-0 group-hover:opacity-100 transition-all hover:text-accent"
              >
                <Download class="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible"
      class="fixed z-[100] py-2 rounded-2xl shadow-2xl border min-w-[160px]"
      :style="{
        left: contextMenu.x + 'px',
        top: contextMenu.y + 'px',
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-base)',
      }"
      @click.stop
    >
      <button
        class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-accent/10 transition-all"
        style="color: var(--text-primary)"
        @click="setReplyTo(contextMenu.message)"
      >
        <Reply class="w-4 h-4 text-accent" /> {{ t('common.reply') || '回复' }}
      </button>
      <button
        v-if="contextMenu.message.type === 'TEXT'"
        class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-accent/10 transition-all"
        style="color: var(--text-primary)"
        @click="handleTranslate(contextMenu.message)"
      >
        <Languages class="w-4 h-4 text-indigo-500" /> {{ t('messages.translate') }}
      </button>
      <button
        v-if="contextMenu.message.type === 'TEXT'"
        class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-accent/10 transition-all"
        style="color: var(--text-primary)"
        @click="copyMessage(contextMenu.message.content)"
      >
        <AtSign class="w-4 h-4" style="color: var(--text-muted)" /> {{ t('common.copy') || '复制' }}
      </button>
      <button
        v-if="contextMenu.message.senderId === authStore.user?.id"
        class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-rose-500/10 text-rose-500 transition-all"
        @click="
          handleDeleteMessage(contextMenu.messageId);
          closeContextMenu();
        "
      >
        <X class="w-4 h-4" /> {{ t('common.delete') }}
      </button>
      <div class="border-t my-1" style="border-color: var(--border-base)"></div>
      <div class="px-3 py-2 flex gap-1">
        <button
          v-for="emoji in reactionEmojis.slice(0, 6)"
          :key="emoji"
          class="w-8 h-8 flex items-center justify-center text-base hover:scale-125 hover:bg-accent/10 rounded-lg transition-all"
          @click="
            toggleReaction(contextMenu.messageId, emoji);
            closeContextMenu();
          "
        >
          {{ emoji }}
        </button>
      </div>
    </div>

    <!-- Conversation Context Menu -->
    <div
      v-if="conversationContextMenu.visible"
      class="fixed z-[100] py-2 rounded-2xl shadow-2xl border min-w-[160px]"
      :style="{
        left: conversationContextMenu.x + 'px',
        top: conversationContextMenu.y + 'px',
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-base)',
      }"
      @click.stop
    >
      <button
        class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-rose-500/10 text-rose-500 transition-all"
        @click="deleteConversation(conversationContextMenu.conversation)"
      >
        <Trash2 class="w-4 h-4" /> {{ t('common.delete') }} {{ t('sidebar.messages') }}
      </button>
    </div>

    <!-- New Chat Dialog -->
    <el-dialog
      v-model="isNewChatDialogOpen"
      :title="t('messages.startNewChat') || '发起新聊天'"
      width="440px"
      class="custom-dialog"
      :show-close="true"
      destroy-on-close
    >
      <div class="space-y-6">
        <div class="relative">
          <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="userSearchQuery"
            type="text"
            placeholder="搜索用户姓名或邮箱..."
            class="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            style="color: var(--text-primary)"
          />
        </div>

        <div class="max-h-80 overflow-y-auto scrollbar-hide space-y-2">
          <div v-if="isLoadingUsers" class="py-10 text-center">
            <div
              class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"
            ></div>
          </div>

          <div
            v-for="user in filteredPublicUsers"
            :key="user.id"
            class="p-3 flex items-center gap-3 rounded-2xl hover:bg-accent/10 cursor-pointer transition-all group"
            @click.stop="startNewChat(user)"
          >
            <UserAvatar :user="user" size="md" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold truncate" style="color: var(--text-primary)">
                {{ user.name || '未命名用户' }}
              </p>
              <p class="text-[10px] text-slate-400 truncate">{{ user.email }}</p>
            </div>
            <div
              class="w-8 h-8 rounded-full bg-accent/5 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all"
            >
              <Plus class="w-4 h-4" />
            </div>
          </div>

          <div
            v-if="filteredPublicUsers.length === 0 && !isLoadingUsers"
            class="py-10 text-center text-slate-400"
          >
            <UserIcon class="w-8 h-8 mx-auto mb-2 opacity-10" />
            <p class="text-xs">未找到匹配的用户</p>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- Group Chat Dialog -->
    <el-dialog
      v-model="isGroupChatDialogOpen"
      title="创建群聊"
      width="480px"
      class="custom-dialog"
      :show-close="true"
      destroy-on-close
    >
      <div class="space-y-5">
        <div>
          <label
            class="text-xs font-bold uppercase tracking-wider mb-2 block"
            style="color: var(--text-muted)"
            >群聊名称</label
          >
          <input
            v-model="groupChatName"
            type="text"
            placeholder="输入群聊名称..."
            class="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            style="color: var(--text-primary)"
          />
        </div>

        <!-- Selected Members -->
        <div v-if="groupChatParticipants.length > 0">
          <label
            class="text-xs font-bold uppercase tracking-wider mb-2 block"
            style="color: var(--text-muted)"
            >已选择 ({{ groupChatParticipants.length }})</label
          >
          <div class="flex flex-wrap gap-2">
            <div
              v-for="user in groupChatParticipants"
              :key="user.id"
              class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style="
                background-color: var(--bg-app);
                color: var(--text-primary);
                border: 1px solid var(--border-base);
              "
            >
              <UserAvatar :user="user" size="sm" />
              {{ user.name || user.email }}
              <button
                class="hover:text-rose-500 transition-colors"
                @click="removeGroupParticipant(user.id)"
              >
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div>
          <label
            class="text-xs font-bold uppercase tracking-wider mb-2 block"
            style="color: var(--text-muted)"
            >添加成员</label
          >
          <div class="relative mb-3">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="groupChatSearchQuery"
              type="text"
              placeholder="搜索用户..."
              class="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              style="color: var(--text-primary)"
            />
          </div>

          <div class="max-h-60 overflow-y-auto scrollbar-hide space-y-2">
            <div v-if="isLoadingUsers" class="py-10 text-center">
              <div
                class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"
              ></div>
            </div>

            <div
              v-for="user in filteredGroupUsers"
              :key="user.id"
              class="p-3 flex items-center gap-3 rounded-2xl hover:bg-indigo-500/10 cursor-pointer transition-all group"
              @click="addGroupParticipant(user)"
            >
              <UserAvatar :user="user" size="md" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold truncate" style="color: var(--text-primary)">
                  {{ user.name || '未命名用户' }}
                </p>
                <p class="text-[10px] text-slate-400 truncate">{{ user.email }}</p>
              </div>
              <div
                class="w-8 h-8 rounded-full bg-indigo-500/5 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all"
              >
                <Plus class="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        <button
          :disabled="!groupChatName.trim() || groupChatParticipants.length === 0"
          class="w-full py-3.5 bg-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          @click="createGroupChat"
        >
          <Users class="w-4 h-4" />
          创建群聊
        </button>
      </div>
    </el-dialog>

    <!-- User Profile Dialog -->
    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="startNewChat"
    />
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<style>
.custom-dialog {
  border-radius: 2rem !important;
  overflow: hidden;
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border-base) !important;
}
.custom-dialog .el-dialog__header {
  margin-right: 0;
  padding: 1.5rem 2rem 0;
}
.custom-dialog .el-dialog__title {
  font-weight: 800;
  color: var(--text-primary);
  font-size: 1.25rem;
}
.custom-dialog .el-dialog__body {
  padding: 1.5rem 2rem 2rem;
}
.custom-dialog .el-dialog__headerbtn {
  top: 1.5rem;
  right: 1.5rem;
  width: 2.5rem;
  height: 2.5rem;
  background-color: var(--bg-app);
  border-radius: 1rem;
  transition: all 0.3s;
}
.custom-dialog .el-dialog__headerbtn:hover {
  background-color: var(--accent);
}
.custom-dialog .el-dialog__headerbtn .el-dialog__close {
  color: var(--text-secondary);
}
.custom-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: white;
}
</style>
