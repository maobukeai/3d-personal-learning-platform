<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Trash2, Users } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { useAuthStore } from '@/stores/auth';
import { socketService } from '@/utils/socket';
import { useRoute } from 'vue-router';
import type { ChatUser, ChatMessage, ChatConversation } from './components/chatTypes';

// Subcomponents
import ChatSidebar from './components/ChatSidebar.vue';
import ChatWindow from './components/ChatWindow.vue';
import ChatInfoPanel from './components/ChatInfoPanel.vue';
import NewChatDialog from './components/NewChatDialog.vue';
import GroupChatDialog from './components/GroupChatDialog.vue';
import Button from '@/components/ui/Button.vue';

const { t } = useI18n();
const authStore = useAuthStore();
const route = useRoute();

const searchQuery = ref('');
const conversations = ref<ChatConversation[]>([]);
const messages = ref<ChatMessage[]>([]);
const activeConversation = ref<ChatConversation | null>(null);
const isLoadingConversations = ref(false);
const isLoadingMessages = ref(false);

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const isInfoPanelOpen = ref(false);

const chatWindowRef = ref<{
  closeContextMenu: () => void;
  messagesContainer?: HTMLElement;
  scrollToBottom: () => void;
} | null>(null);

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
      name: m.content.split('/').pop() || t('messages.unknownFile'),
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

const conversationContextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  conversation: ChatConversation | null;
}>({
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
    const seen = new Map<string, ChatConversation>();
    for (const conv of response.data) {
      if (seen.has(conv.id)) continue;
      seen.set(conv.id, conv);
    }
    conversations.value = Array.from(seen.values());
    if (conversations.value.length > 0 && !activeConversation.value) {
      const requestedId =
        typeof route.query.conversationId === 'string' ? route.query.conversationId : '';
      const requestedConversation = requestedId
        ? conversations.value.find((conversation) => conversation.id === requestedId)
        : null;
      selectConversation(requestedConversation || conversations.value[0]);
    }
  } catch (error) {
    logError(error, { operation: 'fetchConversations', view: 'MessagesView' });
  } finally {
    isLoadingConversations.value = false;
  }
};

const joinActiveConversation = () => {
  if (activeConversation.value) {
    socketService.emit('join_conversation', activeConversation.value.id);
  }
};

const selectConversation = async (conv: ChatConversation) => {
  if (activeConversation.value && activeConversation.value.id !== conv.id) {
    socketService.emit('leave_conversation', activeConversation.value.id);
  }
  activeConversation.value = conv;
  hasMoreMessages.value = false;
  nextCursor.value = null;
  fetchMessages(conv.id);
  // Directly use conv.id to avoid reading shared state after async boundaries
  socketService.emit('join_conversation', conv.id);

  if (conv.unreadCount && conv.unreadCount > 0) {
    api.patch(`/api/messages/conversations/${conv.id}/read`);
    conv.unreadCount = 0;
  }
};

const selectConversationById = (conversationId?: string) => {
  if (!conversationId || activeConversation.value?.id === conversationId) return;
  const conversation = conversations.value.find((item) => item.id === conversationId);
  if (conversation) {
    selectConversation(conversation);
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
    logError(error, { operation: 'fetchMessages', view: 'MessagesView' });
  } finally {
    isLoadingMessages.value = false;
    isLoadingOlderMessages.value = false;
  }
};

const loadOlderMessages = () => {
  if (
    activeConversation.value &&
    hasMoreMessages.value &&
    nextCursor.value &&
    !isLoadingOlderMessages.value
  ) {
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
    const response = await api.post('/api/messages/messages', {
      conversationId: activeConversation.value.id,
      content: msgContent,
      type,
      ...(replyToId && { replyToId }),
    });

    const newMessage = response.data;
    if (activeConversation.value?.id === newMessage.conversationId) {
      if (!messages.value.some((m) => m.id === newMessage.id)) {
        messages.value.push(newMessage);
        chatWindowRef.value?.scrollToBottom();
      }
    }
    updateSidebarWithNewMessage(newMessage);
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
    ElMessage.error(t('tasks.chatFailed'));
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
    ElMessage.error(t('messages.groupCreateFailed'));
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
    ElMessage.success(t('messages.groupLeftSuccess'));
  } catch {
    ElMessage.error(t('messages.groupLeftFailed'));
  }
};

const deleteConversation = async (conv: ChatConversation) => {
  try {
    await ElMessageBox.confirm(
      t('messages.deleteConversationConfirm'),
      t('messages.deleteConversationConfirmTitle'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      },
    );
    await api.delete(`/api/messages/conversations/${conv.id}`);
    conversations.value = conversations.value.filter((c) => c.id !== conv.id);
    if (activeConversation.value?.id === conv.id) {
      activeConversation.value = null;
      isInfoPanelOpen.value = false;
      if (conversations.value.length > 0) {
        selectConversation(conversations.value[0]);
      }
    }
    ElMessage.success(t('messages.conversationDeletedSuccess'));
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('messages.conversationDeletedFailed'));
    }
  }
  conversationContextMenu.value.visible = false;
  if (conv.id) swipeOffset.value[conv.id] = 0;
};

const handleConversationContextMenu = (event: MouseEvent, conv: ChatConversation) => {
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

const updateSidebarWithNewMessage = (message: ChatMessage) => {
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
        (acc: number, c: ChatConversation) => acc + (c.unreadCount || 0),
        0,
      );
      authStore.setUnreadMessagesCount(total);
    });
  }
};

const handleNewMessageSocket = (message: ChatMessage) => {
  if (activeConversation.value?.id === message.conversationId) {
    if (!messages.value.some((m) => m.id === message.id)) {
      messages.value.push(message);
      chatWindowRef.value?.scrollToBottom();
    }
    api.patch(`/api/messages/conversations/${message.conversationId}/read`);
  }
  updateSidebarWithNewMessage(message);
};

const handleMessageReceivedSocket = ({
  conversationId,
  message,
}: {
  conversationId: string;
  message: ChatMessage;
}) => {
  if (activeConversation.value?.id !== conversationId) {
    updateSidebarWithNewMessage(message);
  }
};

const handleMessageDeletedSocket = ({
  messageId,
  conversationId,
}: {
  messageId: string;
  conversationId: string;
}) => {
  if (activeConversation.value?.id === conversationId) {
    messages.value = messages.value.filter((m) => m.id !== messageId);
  }
  const conv = conversations.value.find((c) => c.id === conversationId);
  if (conv && conv.messages?.[0]?.id === messageId) {
    fetchConversations();
  }
};

const handleMessagesReadSocket = ({
  conversationId,
  messageIds,
  userId,
}: {
  conversationId: string;
  messageIds: string[];
  userId: string;
}) => {
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
};

const handleMessageReactionSocket = ({
  messageId,
  reaction,
}: {
  messageId: string;
  reaction: { id: string; emoji: string; userId: string };
}) => {
  const msg = messages.value.find((m) => m.id === messageId);
  if (msg) {
    if (!msg.reactions) msg.reactions = [];
    const exists = msg.reactions.find((r) => r.id === reaction.id);
    if (!exists) msg.reactions.push(reaction);
  }
};

const handleMessageReactionRemovedSocket = ({
  messageId,
  userId,
  emoji,
}: {
  messageId: string;
  userId: string;
  emoji: string;
}) => {
  const msg = messages.value.find((m) => m.id === messageId);
  if (msg && msg.reactions) {
    msg.reactions = msg.reactions.filter((r) => !(r.emoji === emoji && r.userId === userId));
  }
};

const handleConversationUpdatedSocket = (updatedConv: ChatConversation) => {
  if (activeConversation.value?.id === updatedConv.id) {
    activeConversation.value = { ...activeConversation.value, ...updatedConv };
  }
  const idx = conversations.value.findIndex((c) => c.id === updatedConv.id);
  if (idx !== -1) {
    conversations.value[idx] = { ...conversations.value[idx], ...updatedConv };
  }
};

const handleConversationRemovedSocket = ({ conversationId }: { conversationId: string }) => {
  conversations.value = conversations.value.filter((c) => c.id !== conversationId);
  if (activeConversation.value?.id === conversationId) {
    activeConversation.value = null;
    isInfoPanelOpen.value = false;
    if (conversations.value.length > 0) {
      selectConversation(conversations.value[0]);
    }
  }
};

onMounted(() => {
  fetchConversations();

  document.addEventListener('click', closeConversationContextMenu);

  socketService.on('connect', joinActiveConversation);
  socketService.on('new_message', handleNewMessageSocket);
  socketService.on('message_received', handleMessageReceivedSocket);
  socketService.on('message_deleted', handleMessageDeletedSocket);
  socketService.on('messages_read', handleMessagesReadSocket);
  socketService.on('message_reaction', handleMessageReactionSocket);
  socketService.on('message_reaction_removed', handleMessageReactionRemovedSocket);
  socketService.on('conversation_updated', handleConversationUpdatedSocket);
  socketService.on('conversation_removed', handleConversationRemovedSocket);
});

watch(
  () => route.query.conversationId,
  (conversationId) => {
    if (typeof conversationId === 'string') {
      selectConversationById(conversationId);
    }
  },
);

onUnmounted(() => {
  socketService.off('connect', joinActiveConversation);
  socketService.off('new_message', handleNewMessageSocket);
  socketService.off('message_received', handleMessageReceivedSocket);
  socketService.off('message_deleted', handleMessageDeletedSocket);
  socketService.off('messages_read', handleMessagesReadSocket);
  socketService.off('message_reaction', handleMessageReactionSocket);
  socketService.off('message_reaction_removed', handleMessageReactionRemovedSocket);
  socketService.off('conversation_updated', handleConversationUpdatedSocket);
  socketService.off('conversation_removed', handleConversationRemovedSocket);
  document.removeEventListener('click', closeConversationContextMenu);
  if (activeConversation.value) {
    socketService.emit('leave_conversation', activeConversation.value.id);
  }
});
</script>

<template>
  <div
    class="flex-1 flex h-full overflow-hidden relative mobile-adaptive"
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
      <div
        class="w-16 h-16 bg-accent/5 rounded-full flex items-center justify-center mb-4 shrink-0"
      >
        <Users class="w-8 h-8 text-accent opacity-20" />
      </div>
      <h2 class="text-lg font-bold mb-1.5" style="color: var(--text-primary)">
        {{ t('messages.startNewChatTitle') }}
      </h2>
      <p class="text-xs max-w-xs mx-auto mb-6" style="color: var(--text-secondary)">
        {{ t('messages.startNewChatDesc') }}
      </p>
      <div class="flex gap-3 justify-center mobile-row">
        <Button
          variant="primary"
          size="sm"
          class="shadow-md hover:scale-102"
          @click="isNewChatDialogOpen = true"
        >
          {{ t('messages.findContacts') }}
        </Button>
        <Button
          variant="glass"
          size="sm"
          class="shadow-md hover:scale-102"
          @click="isGroupChatDialogOpen = true"
        >
          {{ t('messages.createGroup') }}
        </Button>
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
      class="fixed z-[100] py-2 rounded-2xl shadow-2xl border border-strong/10 min-w-[160px] glass-panel backdrop-blur-xl overflow-hidden"
      :style="{
        left: conversationContextMenu.x + 'px',
        top: conversationContextMenu.y + 'px',
      }"
      @click.stop
    >
      <button
        type="button"
        class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-rose-500/10 text-rose-500 transition-all cursor-pointer font-bold"
        @click="
          conversationContextMenu.conversation &&
          deleteConversation(conversationContextMenu.conversation)
        "
      >
        <Trash2 class="w-4 h-4" /> {{ t('common.delete') }} {{ t('sidebar.messages') }}
      </button>
    </div>

    <!-- New Chat Dialog -->
    <NewChatDialog v-model="isNewChatDialogOpen" @start-chat="startNewChat" />

    <!-- Group Chat Dialog -->
    <GroupChatDialog v-model="isGroupChatDialogOpen" @create-group="createGroupChat" />

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
