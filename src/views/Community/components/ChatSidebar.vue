<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Search, Users, Plus, Hash, Trash2, MessageSquare } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';

interface ChatUser {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: string;
  content: string;
  createdAt: string;
  fileSize?: number;
  replyToId?: string;
  readBy?: { userId: string }[];
  reactions?: { id: string; emoji: string; userId: string }[];
  sender?: ChatUser | null;
}

interface ChatConversation {
  id: string;
  name?: string;
  isGroup: boolean;
  avatarUrl?: string | null;
  participants?: ChatUser[];
  messages: ChatMessage[];
  updatedAt: string;
  unreadCount?: number;
}

const props = defineProps<{
  conversations: ChatConversation[];
  activeConversation: ChatConversation | null;
  isLoadingConversations: boolean;
  searchQuery: string;
  swipeOffset: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: 'select-conversation', conv: ChatConversation): void;
  (e: 'delete-conversation', conv: ChatConversation): void;
  (e: 'open-profile', userId: string): void;
  (e: 'create-group-chat'): void;
  (e: 'start-new-chat'): void;
  (e: 'update:searchQuery', val: string): void;
  (e: 'conversation-contextmenu', event: MouseEvent, conv: ChatConversation): void;
  (e: 'touch-start', event: TouchEvent, convId: string): void;
  (e: 'touch-move', event: TouchEvent, convId: string): void;
  (e: 'touch-end', convId: string): void;
}>();

const { t } = useI18n();
const authStore = useAuthStore();

const localSearchQuery = computed({
  get: () => props.searchQuery,
  set: (val) => emit('update:searchQuery', val),
});

const getOtherParticipant = (conv: ChatConversation | null) => {
  if (!conv) return null;
  return conv.participants?.find((p) => p.id !== authStore.user?.id) || conv.participants?.[0];
};

const getConversationName = (conv: ChatConversation | null) => {
  if (!conv) return '';
  if (conv.isGroup) return conv.name || t('community.chat.unnamedGroup');
  const other = getOtherParticipant(conv);
  return other?.name || other?.email || t('community.chat.unknownUser');
};

const getLastMessagePreview = (conv: ChatConversation) => {
  const lastMsg = conv.messages?.[0];
  if (!lastMsg) return t('common.noData');
  const senderName = lastMsg.sender?.name || t('community.chat.unknownUser');
  const prefix = conv.isGroup ? `${senderName}: ` : '';
  switch (lastMsg.type) {
    case 'IMAGE':
      return `${prefix}[${t('community.chat.photosTab')}]`;
    case 'VOICE':
      return `${prefix}[${t('messages.voiceMessage')}]`;
    case 'FILE':
      return `${prefix}[${t('community.chat.filesTab')}] ${lastMsg.content.split('/').pop()}`;
    case 'SYSTEM':
      return lastMsg.content;
    default:
      return `${prefix}${lastMsg.content}`;
  }
};

const filteredConversations = computed(() => {
  if (!props.conversations) return [];
  if (!localSearchQuery.value.trim()) return props.conversations;
  const query = localSearchQuery.value.toLowerCase();
  return props.conversations.filter((c) => {
    const participant = getOtherParticipant(c);
    const name = c.isGroup ? c.name : participant?.name;
    return (name || participant?.email || '').toLowerCase().includes(query);
  });
});
</script>

<template>
  <div
    class="w-full lg:w-80 border-r flex flex-col shrink-0 transition-all duration-300 z-20"
    :class="activeConversation ? 'hidden lg:flex' : 'flex'"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div class="p-3 border-b" style="border-color: var(--border-base)">
      <div class="flex items-center justify-between mb-2.5">
        <h1 class="text-base font-bold" style="color: var(--text-primary)">
          {{ t('messages.title') }}
        </h1>
        <div class="flex gap-1">
          <button type="button" class="p-1.5 bg-indigo-500/10 text-indigo-500 rounded-lg hover:bg-indigo-500 hover:text-white transition-all cursor-pointer" :title="t('community.chat.groupChat')" @click="emit('create-group-chat')">
            <Users class="w-3.5 h-3.5" />
          </button>
          <button type="button" class="p-1.5 bg-accent/10 text-accent rounded-lg hover:bg-accent hover:text-white transition-all cursor-pointer" :title="t('messages.startNewChat')" @click="emit('start-new-chat')">
            <Plus class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div class="relative">
        <Search
          class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2"
          style="color: var(--text-muted)"
        />
        <input
          v-model="localSearchQuery"
          type="text"
          :placeholder="t('messages.searchPlaceholder')"
          class="pl-8 pr-3 py-1.5 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-full transition-all"
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
          class="p-2 sm:p-2.5 flex gap-2 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-white/5 relative group overflow-hidden"
          :class="activeConversation?.id === conv.id ? 'bg-accent-subtle' : ''"
          @click="emit('select-conversation', conv)"
          @contextmenu="emit('conversation-contextmenu', $event, conv)"
          @touchstart="emit('touch-start', $event, conv.id)"
          @touchmove="emit('touch-move', $event, conv.id)"
          @touchend="emit('touch-end', conv.id)"
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
            <button type="button" class="w-full h-full flex items-center justify-center text-white" @click.stop="emit('delete-conversation', conv)">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>

          <!-- Content Area -->
          <div
            class="flex flex-1 gap-2 transition-transform duration-200 z-10"
            :style="{ transform: `translateX(-${swipeOffset[conv.id] || 0}px)` }"
          >
            <div class="relative shrink-0">
              <template v-if="conv.isGroup">
                <div
                  class="w-6 h-6 rounded-full border flex items-center justify-center shrink-0 bg-[var(--bg-app)]"
                  :class="conv.avatarUrl ? '' : 'bg-indigo-500/10'"
                  style="border-color: var(--border-base)"
                >
                  <img v-if="conv.avatarUrl" alt="" :src="conv.avatarUrl" class="w-6 h-6 rounded-full object-cover" />
                  <Users v-else class="w-3 h-3 text-indigo-500" />
                </div>
              </template>
              <template v-else>
                <UserAvatar
                  :user="getOtherParticipant(conv)"
                  size="sm"
                  class="cursor-pointer hover:ring-2 hover:ring-accent transition-all animate-none"
                  @click.stop="getOtherParticipant(conv)?.id && emit('open-profile', getOtherParticipant(conv)!.id)"
                />
                <div
                  v-if="authStore.isUserOnline(getOtherParticipant(conv)?.id || '')"
                  class="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border rounded-full z-40"
                  style="border-color: var(--bg-card)"
                ></div>
              </template>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-0.5">
                <span
                  class="text-[11px] sm:text-xs font-bold truncate pr-2 flex items-center gap-1"
                  style="color: var(--text-primary)"
                >
                  <Hash v-if="conv.isGroup" class="w-2.5 h-2.5 text-indigo-400 shrink-0" />
                  {{ getConversationName(conv) }}
                </span>
                <span class="text-[8px] font-medium shrink-0" style="color: var(--text-muted)">
                  {{
                    new Date(conv.updatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <p class="text-[10px] sm:text-[11px] truncate pr-4" style="color: var(--text-secondary)">
                  {{ getLastMessagePreview(conv) }}
                </p>
                <div
                  v-if="(conv.unreadCount || 0) > 0"
                  class="shrink-0 min-w-[12px] h-3 bg-accent text-white text-[7px] font-bold rounded-full flex items-center justify-center px-0.5"
                >
                  {{ conv.unreadCount }}
                </div>
              </div>
            </div>
          </div>

          <!-- Hover Delete Button (for Desktop) -->
          <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-600 z-20 shadow-lg md:flex hidden" :title="t('common.delete')" @click.stop="emit('delete-conversation', conv)">
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>

        <div v-if="filteredConversations.length === 0" class="py-20 text-center text-slate-400">
          <MessageSquare class="w-10 h-10 mx-auto mb-3 opacity-10" />
          <p class="text-xs">{{ t('messages.noConversations') }}</p>
        </div>
      </template>
    </div>
  </div>
</template>
