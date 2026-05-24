<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Trash2, Users } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { socketService } from '@/utils/socket';

// Subcomponents
import ChatSidebar from './components/ChatSidebar.vue';
import ChatWindow from './components/ChatWindow.vue';
import ChatInfoPanel from './components/ChatInfoPanel.vue';
import NewChatDialog from './components/NewChatDialog.vue';
import GroupChatDialog from './components/GroupChatDialog.vue';

const { t } = useI18n();
const authStore = useAuthStore();

interface ChatUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
  email?: string;
  role?: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  fileSize?: number;
  createdAt: string;
  replyToId?: string;
  readBy?: { userId: string }[];
  reactions?: { id: string; emoji: string; userId: string }[];
}

interface Conversation {
  id: string;
  name?: string;
  isGroup: boolean;
  unreadCount?: number;
  updatedAt: string;
  participants?: ChatUser[];
  messages: Message[];
}

const searchQuery = ref('');
const conversations = ref<Conversation[]>([]);
const messages = ref<Message[]>([]);
const activeConversation = ref<Conversation | null>(null);
const isLoadingConversations = ref(false);
const isLoadingMessages = ref(false);

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const isInfoPanelOpen = ref(false);

const chatWindowRef = ref<{ closeContextMenu: () => void; messagesContainer?: HTMLElement; scrollToBottom: () => void } | null>(null);

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
      size: m.fileSize,
    }));
});

const hasMoreMessages = ref(false);
const nextCursor = ref<string | null>(null);
const isLoadingOlderMessages = ref(false);

const isNewChatDialogOpen = ref(false);
const isGroupChatDialogOpen = ref(false);

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

const conversationContextMenu = ref<{ visible: boolean; x: number; y: number; conversation: Conversation | null }>({
  visible: false,
  x: 0,
  y: 0,
  conversation: null,
});

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};
const fetchConversations = async () => {
  isLoadingConversations.value = true;
  try {
    const response = await api.get('/api/messages/conversations');
    const seen = new Map<string, Conversation>();
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

const selectConversation = async (conv: Conversation) => {
  if (activeConversation.value && activeConversation.value.id !== conv.id) {
    socketService.emit('leave_conversation', activeConversation.value.id);
  }
  activeConversation.value = conv;
  hasMoreMessages.value = false;
  nextCursor.value = null;
  fetchMessages(conv.id);
  socketService.emit('join_conversation', conv.id);

  if (conv.unreadCount && conv.unreadCount > 0) {
    api.patch(`/api/messages/conversations/${conv.id}/read`);
    conv.unreadCount = 0;
  }
};

const fetchMessages = async (id: string, cursor?: string) => {
  if (!cursor) isLoadingMessages.value = true;
  else isLoadingOlderMessages.value = true;

  try {
    const params: Record<string, unknown> = { limit: 50 };
    if (cursor) params.cursor = cursor;
    const response = await api.get(`/api/messages/conversations/${id}/messages`, { params });

    if (cursor) {
      const prevHeight = chatWindowRef.value?.messagesContainer?.scrollHeight || 0;
      messages.value = [...response.data.messages, ...messages.value];
      hasMoreMessages.value = response.data.hasMore;
      nextCursor.value = response.data.nextCursor;
      await nextTick();
      const container = chatWindowRef.value?.messagesContainer;
      if (container) {
        container.scrollTop = container.scrollHeight - prevHeight;
      }
    } else {
      messages.value = response.data.messages;
      hasMoreMessages.value = response.data.hasMore;
      nextCursor.value = response.data.nextCursor;
      chatWindowRef.value?.scrollToBottom();
    }
  } catch (error) {
    console.error('Fetch messages error:', error);
  } finally {
    isLoadingMessages.value = false;
    isLoadingOlderMessages.value = false;
  }
};

const loadOlderMessages = () => {
  if (activeConversation.value && hasMoreMessages.value && nextCursor.value && !isLoadingOlderMessages.value) {
    fetchMessages(activeConversation.value.id, nextCursor.value!);
  }
};

const handleSendMessage = async (type = 'TEXT', content?: string) => {
  if (!activeConversation.value) return;

  let msgContent = content || '';
  let replyToId: string | undefined = undefined;
  
  if (msgContent.includes('::REPLY::')) {
    const parts = msgContent.split('::REPLY::');
    replyToId = parts.pop();
    msgContent = parts.join('::REPLY::');
  }

  try {
    await api.post('/api/messages/messages', {
      conversationId: activeConversation.value.id,
      content: msgContent,
      type,
      ...(replyToId && { replyToId }),
    });
  } catch {
    ElMessage.error(t('messages.sendFailed'));
  }
};

const handleDeleteMessage = async (messageId: string) => {
  try {
    await api.delete(`/api/messages/messages/${messageId}`);
    ElMessage.success(t('messages.deleteSuccess'));
  } catch {
    ElMessage.error(t('common.deleteFailed'));
  }
};

const startNewChat = async (user: ChatUser) => {
  try {
    const response = await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    isNewChatDialogOpen.value = false;
    searchQuery.value = '';

    const existing = conversations.value.find((c) => c.id === response.data.id);
    if (!existing) {
      conversations.value.unshift(response.data);
      selectConversation(response.data);
    } else {
      selectConversation(existing);
    }
  } catch {
    ElMessage.error('创建对话失败');
  }
};

const createGroupChat = async (payload: { name: string; participantIds: string[] }) => {
  try {
    const response = await api.post('/api/messages/conversations', {
      participantIds: payload.participantIds,
      isGroup: true,
      name: payload.name,
    });
    isGroupChatDialogOpen.value = false;

    conversations.value.unshift(response.data);
    selectConversation(response.data);
  } catch {
    ElMessage.error('创建群聊失败');
  }
};

const leaveGroupChat = async () => {
  if (!activeConversation.value?.isGroup) return;
  const convId = activeConversation.value.id;
  try {
    await api.post(`/api/messages/conversations/${convId}/leave`);
    conversations.value = conversations.value.filter((c) => c.id !== convId);
    activeConversation.value = null;
    isInfoPanelOpen.value = false;
    if (conversations.value.length > 0) {
      selectConversation(conversations.value[0]);
    }
    ElMessage.success('已退出群聊');
  } catch {
    ElMessage.error('退出群聊失败');
  }
};

const deleteConversation = async (conv: Conversation) => {
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

const handleConversationContextMenu = (event: MouseEvent, conv: Conversation) => {
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

const updateSidebarWithNewMessage = (message: Message) => {
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
        (acc: number, c: Conversation) => acc + (c.unreadCount || 0),
        0,
      );
      authStore.setUnreadMessagesCount(total);
    });
  }
};

onMounted(() => {
  fetchConversations();

  document.addEventListener('click', closeConversationContextMenu);

  socketService.on('new_message', (message: Message) => {
    if (activeConversation.value?.id === message.conversationId) {
      messages.value.push(message);
      chatWindowRef.value?.scrollToBottom();
      api.patch(`/api/messages/conversations/${message.conversationId}/read`);
    }
    updateSidebarWithNewMessage(message);
  });

  socketService.on('message_received', ({ conversationId, message }: { conversationId: string; message: Message }) => {
    if (activeConversation.value?.id !== conversationId) {
      updateSidebarWithNewMessage(message);
    }
  });

  socketService.on('message_deleted', ({ messageId, conversationId }: { messageId: string; conversationId: string }) => {
    if (activeConversation.value?.id === conversationId) {
      messages.value = messages.value.filter((m) => m.id !== messageId);
    }
    const conv = conversations.value.find((c) => c.id === conversationId);
    if (conv && conv.messages[0]?.id === messageId) {
      fetchConversations();
    }
  });

  socketService.on('messages_read', ({ conversationId, messageIds, userId }: { conversationId: string; messageIds: string[]; userId: string }) => {
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

  socketService.on('message_reaction', ({ messageId, reaction }: { messageId: string; reaction: { id: string; emoji: string; userId: string } }) => {
    const msg = messages.value.find((m) => m.id === messageId);
    if (msg) {
      if (!msg.reactions) msg.reactions = [];
      const exists = msg.reactions.find((r) => r.id === reaction.id);
      if (!exists) msg.reactions.push(reaction);
    }
  });

  socketService.on('message_reaction_removed', ({ messageId, userId, emoji }: { messageId: string; userId: string; emoji: string }) => {
    const msg = messages.value.find((m) => m.id === messageId);
    if (msg && msg.reactions) {
      msg.reactions = msg.reactions.filter((r) => !(r.emoji === emoji && r.userId === userId));
    }
  });

  socketService.on('conversation_updated', (updatedConv: Conversation) => {
    if (activeConversation.value?.id === updatedConv.id) {
      activeConversation.value = { ...activeConversation.value, ...updatedConv };
    }
    const idx = conversations.value.findIndex((c) => c.id === updatedConv.id);
    if (idx !== -1) {
      conversations.value[idx] = { ...conversations.value[idx], ...updatedConv };
    }
  });

  socketService.on('conversation_removed', ({ conversationId }: { conversationId: string }) => {
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
  socketService.off('message_reaction');
  socketService.off('message_reaction_removed');
  socketService.off('message_received');
  socketService.off('conversation_updated');
  socketService.off('conversation_removed');
  document.removeEventListener('click', closeConversationContextMenu);
  if (activeConversation.value) {
    socketService.emit('leave_conversation', activeConversation.value.id);
  }
});
</script>

<template>
  <div
    class="flex-1 flex h-full overflow-hidden relative"
    style="background-color: var(--bg-app)"
    @click="
      chatWindowRef?.closeContextMenu();
      closeConversationContextMenu();
    "
  >
    <!-- Contacts Sidebar -->
    <ChatSidebar
      v-model:search-query="searchQuery"
      :conversations="conversations"
      :active-conversation="activeConversation"
      :is-loading-conversations="isLoadingConversations"
      :swipe-offset="swipeOffset"
      @select-conversation="selectConversation"
      @delete-conversation="deleteConversation"
      @open-profile="openUserProfile"
      @create-group-chat="isGroupChatDialogOpen = true"
      @start-new-chat="isNewChatDialogOpen = true"
      @conversation-contextmenu="handleConversationContextMenu"
      @touch-start="handleTouchStart"
      @touch-move="handleTouchMove"
      @touch-end="handleTouchEnd"
    />

    <!-- Chat Area -->
    <ChatWindow
      v-if="activeConversation"
      ref="chatWindowRef"
      :active-conversation="activeConversation"
      :messages="messages"
      :is-loading-messages="isLoadingMessages"
      :is-loading-older-messages="isLoadingOlderMessages"
      :has-more-messages="hasMoreMessages"
      :is-info-panel-open="isInfoPanelOpen"
      @send-message="handleSendMessage"
      @delete-message="handleDeleteMessage"
      @load-older="loadOlderMessages"
      @open-profile="openUserProfile"
      @toggle-info-panel="isInfoPanelOpen = !isInfoPanelOpen"
      @back="activeConversation = null"
    />

    <!-- Empty State -->
    <div
      v-else
      class="flex-1 flex flex-col items-center justify-center p-6 text-center"
      style="background-color: var(--bg-app)"
    >
      <div class="w-16 h-16 bg-accent/5 rounded-full flex items-center justify-center mb-4 shrink-0">
        <Users class="w-8 h-8 text-accent opacity-20" />
      </div>
      <h2 class="text-lg font-bold mb-1.5" style="color: var(--text-primary)">开启新对话</h2>
      <p class="text-xs max-w-xs mx-auto mb-6" style="color: var(--text-secondary)">
        在左侧选择一个联系人开始聊天，或者点击加号查找新朋友。
      </p>
      <div class="flex gap-2">
        <button type="button" class="px-5 py-2 bg-accent text-white rounded-xl font-bold shadow-md shadow-accent/20 hover:scale-102 transition-all text-xs cursor-pointer" @click="isNewChatDialogOpen = true">
          寻找联系人
        </button>
        <button type="button" class="px-5 py-2 bg-indigo-500 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20 hover:scale-102 transition-all text-xs cursor-pointer" @click="isGroupChatDialogOpen = true">
          创建群聊
        </button>
      </div>
    </div>

    <!-- Info Panel -->
    <ChatInfoPanel
      :model-value="isInfoPanelOpen"
      :active-conversation="activeConversation"
      :shared-photos="sharedPhotos"
      :shared-files="sharedFiles"
      @update:model-value="isInfoPanelOpen = $event"
      @open-profile="openUserProfile"
      @leave-group="leaveGroupChat"
    />

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
      <button type="button" class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-rose-500/10 text-rose-500 transition-all cursor-pointer font-bold" @click="conversationContextMenu.conversation && deleteConversation(conversationContextMenu.conversation)">
        <Trash2 class="w-4 h-4" /> {{ t('common.delete') }} {{ t('sidebar.messages') }}
      </button>
    </div>

    <!-- New Chat Dialog -->
    <NewChatDialog
      v-model="isNewChatDialogOpen"
      @start-chat="startNewChat"
    />

    <!-- Group Chat Dialog -->
    <GroupChatDialog
      v-model="isGroupChatDialogOpen"
      @create-group="createGroupChat"
    />

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
</style>

<style>
.custom-dialog {
  border-radius: 1.25rem !important;
  overflow: hidden;
  background-color: var(--bg-card) !important;
  border: 1px solid var(--border-base) !important;
}
.custom-dialog .el-dialog__header {
  margin-right: 0;
  padding: 1.25rem 1.5rem 0;
}
.custom-dialog .el-dialog__title {
  font-weight: 800;
  color: var(--text-primary);
  font-size: 1.1rem;
}
.custom-dialog .el-dialog__body {
  padding: 1rem 1.5rem 1.5rem;
}
.custom-dialog .el-dialog__headerbtn {
  top: 1.25rem;
  right: 1.5rem;
  width: 2rem;
  height: 2rem;
  background-color: var(--bg-app);
  border-radius: 0.5rem;
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
