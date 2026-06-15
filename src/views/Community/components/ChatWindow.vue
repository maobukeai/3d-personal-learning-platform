<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChevronLeft,
  Users,
  Hash,
  Search,
  Mic,
  Languages,
  Info,
  Reply,
  X,
  Play,
  Pause,
  Paperclip,
  Check,
  CheckCheck,
  SmilePlus,
  Trash2,
  Smile,
  Send,
  AtSign,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';
import SafeHtml from '@/components/SafeHtml.vue';
import api from '@/utils/api';

interface UserType {
  id: string;
  name?: string;
  avatarUrl?: string | null;
  email?: string;
  role?: string;
  language?: string;
}

interface Conversation {
  id: string;
  name?: string;
  isGroup: boolean;
  avatarUrl?: string | null;
  participants?: UserType[];
}

interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  user?: UserType;
}

interface Message {
  id: string;
  senderId: string;
  sender?: UserType;
  type: string;
  content: string;
  createdAt: string;
  replyTo?: Message | null;
  reactions?: MessageReaction[];
  readBy?: Array<{ userId: string; readAt?: string }>;
}

const props = defineProps<{
  activeConversation: Conversation;
  messages: Message[];
  isLoadingMessages: boolean;
  isLoadingOlderMessages: boolean;
  hasMoreMessages: boolean;
  isInfoPanelOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'send-message', type: string, content?: string): void;
  (e: 'delete-message', messageId: string): void;
  (e: 'load-older'): void;
  (e: 'open-profile', userId: string): void;
  (e: 'toggle-info-panel'): void;
  (e: 'back'): void;
}>();

const { t } = useI18n();
const authStore = useAuthStore();

const newMessage = ref('');
const messageSearchQuery = ref('');
const replyToMessage = ref<Message | null>(null);
const showEmojiPicker = ref(false);
const showReactionPicker = ref<string | null>(null);
const isDragOver = ref(false);
const dragCounter = ref(0);
const translations = ref<Record<string, string>>({});

const messagesContainer = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

// Voice recording state
const isRecording = ref(false);
const recordingDuration = ref(0);
const currentlyPlaying = ref<string | null>(null);
const isUploading = ref(false);
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingTimer: ReturnType<typeof setInterval> | null = null;

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

const contextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  messageId: string;
  message: Message | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  messageId: '',
  message: null,
});

const getOtherParticipant = (conv: Conversation | null) => {
  if (!conv) return null;
  return (
    conv.participants?.find((p) => p.id !== authStore.user?.id) || conv.participants?.[0] || null
  );
};

const getConversationName = (conv: Conversation | null) => {
  if (!conv) return '';
  if (conv.isGroup) return conv.name || t('community.chat.unnamedGroup');
  const other = getOtherParticipant(conv);
  return other?.name || other?.email || t('community.chat.unknownUser');
};

const isMessageRead = (msg: Message) => {
  if (!props.activeConversation) return false;
  return !!msg.readBy && msg.readBy.length > 0;
};

const filteredMessages = computed(() => {
  if (!messageSearchQuery.value.trim()) return props.messages;
  const query = messageSearchQuery.value.toLowerCase();
  return props.messages.filter(
    (m) => m.type === 'TEXT' && m.content && m.content.toLowerCase().includes(query),
  );
});

const addEmoji = (emoji: string) => {
  newMessage.value += emoji;
  showEmojiPicker.value = false;
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
  } catch {
    ElMessage.error(t('messages.uploadFailed'));
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
  } catch {
    ElMessage.error(t('messages.uploadFailed'));
  } finally {
    isUploading.value = false;
  }
};

const startRecording = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    let mimeType = 'audio/webm';
    let extension = 'webm';

    if (typeof MediaRecorder.isTypeSupported === 'function') {
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
          extension = 'mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
          extension = 'm4a';
        } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
          mimeType = 'audio/mpeg';
          extension = 'mp3';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
          extension = 'ogg';
        } else {
          mimeType = '';
          extension = 'wav';
        }
      }
    } else {
      mimeType = '';
      extension = 'wav';
    }

    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    audioChunks = [];
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mimeType || 'audio/wav' });
      if (audioBlob.size < 1000) return;

      const formData = new FormData();
      formData.append('message_file', audioBlob, `voice_${Date.now()}.${extension}`);

      isUploading.value = true;
      try {
        const res = await api.post('/api/messages/upload', formData);
        const { url } = res.data;
        handleSendMessage('VOICE', url);
      } catch {
        ElMessage.error(t('messages.uploadFailed'));
      } finally {
        isUploading.value = false;
      }

      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();
    isRecording.value = true;
    recordingDuration.value = 0;
    recordingTimer = setInterval(() => {
      recordingDuration.value++;
    }, 1000);
  } catch {
    ElMessage.error(t('community.chat.micAccessFailed'));
  }
};

const stopRecording = () => {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop();
    isRecording.value = false;
    if (recordingTimer) clearInterval(recordingTimer);
  }
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const handleTranslate = async (message: Message) => {
  if (translations.value[message.id]) {
    delete translations.value[message.id];
    return;
  }

  try {
    const response = await api.post('/api/messages/translate', {
      content: message.content,
      targetLang: authStore.user?.language || 'zh',
    });
    translations.value[message.id] = response.data.translation;
  } catch {
    ElMessage.error(t('messages.sendFailed'));
  }
};

const playVoiceMessage = (msgId: string, _url: string) => {
  const audioId = `audio-${msgId}`;
  const audioElement = document.getElementById(audioId) as HTMLAudioElement;

  if (!audioElement) return;

  if (currentlyPlaying.value === msgId) {
    audioElement.pause();
    currentlyPlaying.value = null;
  } else {
    if (currentlyPlaying.value) {
      const prevAudio = document.getElementById(
        `audio-${currentlyPlaying.value}`,
      ) as HTMLAudioElement;
      if (prevAudio) prevAudio.pause();
    }

    audioElement.currentTime = 0;
    audioElement.play();
    currentlyPlaying.value = msgId;

    audioElement.onended = () => {
      currentlyPlaying.value = null;
    };
  }
};

const formatDateSeparator = (date: string | Date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return t('community.chat.today');
  if (d.toDateString() === yesterday.toDateString()) return t('community.chat.yesterday');

  return d.toLocaleDateString(authStore.user?.language === 'en' ? 'en-US' : 'zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const shouldShowDateSeparator = (currentMsg: Message, previousMsg: Message | null) => {
  if (!previousMsg) return true;
  const currentDate = new Date(currentMsg.createdAt).toDateString();
  const previousDate = new Date(previousMsg.createdAt).toDateString();
  return currentDate !== previousDate;
};

const shouldShowSenderAvatar = (currentMsg: Message, previousMsg: Message | null) => {
  if (currentMsg.senderId === authStore.user?.id) return false;
  if (!previousMsg) return true;
  if (previousMsg.senderId !== currentMsg.senderId) return true;
  const timeDiff =
    new Date(currentMsg.createdAt).getTime() - new Date(previousMsg.createdAt).getTime();
  return timeDiff > 5 * 60 * 1000;
};

const shouldShowTimestamp = (currentMsg: Message, nextMsg: Message | null) => {
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

const getGroupedReactions = (reactions: MessageReaction[] | undefined) => {
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
    groups[r.emoji].users.push(r.user?.name || t('community.chat.unknownUser'));
    if (r.userId === authStore.user?.id) groups[r.emoji].hasMine = true;
  });
  return Object.values(groups);
};

const setReplyTo = (msg: Message) => {
  replyToMessage.value = msg;
  contextMenu.value.visible = false;
};

const cancelReply = () => {
  replyToMessage.value = null;
};

const toggleReaction = async (messageId: string, emoji: string) => {
  showReactionPicker.value = null;
  try {
    const msg = props.messages.find((m) => m.id === messageId);
    if (!msg) return;
    const existing = msg.reactions?.find(
      (r) => r.emoji === emoji && r.userId === authStore.user?.id,
    );
    if (existing) {
      await api.delete(`/api/messages/messages/${messageId}/reactions/${emoji}`);
    } else {
      await api.post(`/api/messages/messages/${messageId}/reactions`, { emoji });
    }
  } catch {
    // silently fail
  }
};

const handleSendMessage = (type = 'TEXT', content?: string) => {
  const msgContent = content || newMessage.value;
  if (!msgContent.trim() && type === 'TEXT') return;

  if (type === 'TEXT') newMessage.value = '';
  const replyId = replyToMessage.value?.id;
  replyToMessage.value = null;

  emit('send-message', type, msgContent + (replyId ? `::REPLY::${replyId}` : ''));
};

const handleDeleteMessage = async (messageId: string) => {
  try {
    await ElMessageBox.confirm(t('messages.deleteConfirm'), t('common.confirm'), {
      confirmButtonText: t('common.delete'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });
    emit('delete-message', messageId);
  } catch {
    // cancelled
  }
};

const handleContextMenu = (event: MouseEvent, msg: Message) => {
  event.preventDefault();
  event.stopPropagation();
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
  ElMessage.success(t('notes.copiedToClipboard'));
};

const openLink = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const handleScroll = () => {
  if (messagesContainer.value && messagesContainer.value.scrollTop < 100 && props.hasMoreMessages) {
    emit('load-older');
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
};

watch(
  () => props.messages,
  () => {
    // If we loaded newer messages, scroll down
    if (!props.isLoadingOlderMessages) {
      scrollToBottom();
    }
  },
  { deep: true },
);

onUnmounted(() => {
  if (isRecording.value) {
    stopRecording();
  }
  if (recordingTimer) {
    clearInterval(recordingTimer);
  }
});

defineExpose({
  scrollToBottom,
  closeContextMenu,
});
</script>

<template>
  <div
    class="flex-1 flex flex-col relative transition-all duration-300 z-10"
    :class="activeConversation ? 'flex' : 'hidden lg:flex'"
    style="background-color: var(--bg-app)"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @click="closeContextMenu"
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

    <!-- Chat Header -->
    <div
      class="h-13 border-b px-4 flex items-center justify-between shrink-0 animate-none"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-2 md:gap-2.5">
        <!-- Mobile Back Button -->
        <button
          type="button"
          class="lg:hidden p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all text-slate-500 cursor-pointer"
          @click="emit('back')"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>

        <template v-if="activeConversation.isGroup">
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center bg-indigo-500/10 shrink-0"
          >
            <img
              v-if="activeConversation.avatarUrl"
              alt=""
              :src="activeConversation.avatarUrl"
              class="w-6 h-6 rounded-full object-cover"
            />
            <Users v-else class="w-3.5 h-3.5 text-indigo-500" />
          </div>
        </template>
        <template v-else>
          <UserAvatar
            :user="getOtherParticipant(activeConversation)"
            size="sm"
            class="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
            @click="
              getOtherParticipant(activeConversation)?.id &&
              emit('open-profile', getOtherParticipant(activeConversation)!.id)
            "
          />
        </template>
        <div>
          <p class="text-xs font-bold flex items-center gap-1" style="color: var(--text-primary)">
            <Hash v-if="activeConversation.isGroup" class="w-3 h-3 text-indigo-400" />
            {{ getConversationName(activeConversation) }}
            <span
              v-if="activeConversation.isGroup"
              class="text-[9px] font-medium text-slate-400 ml-1"
              >{{ activeConversation.participants?.length || 0
              }}{{ t('messages.groupParticipants') }}</span
            >
          </p>
          <p
            v-if="!activeConversation.isGroup"
            class="text-[9px] font-bold flex items-center gap-1"
            :class="
              authStore.isUserOnline(getOtherParticipant(activeConversation)?.id || '')
                ? 'text-emerald-500'
                : 'text-slate-400'
            "
          >
            <span
              class="w-1.5 h-1.5 rounded-full animate-none"
              :class="
                authStore.isUserOnline(getOtherParticipant(activeConversation)?.id || '')
                  ? 'bg-emerald-500'
                  : 'bg-slate-300'
              "
            ></span>
            {{
              authStore.isUserOnline(getOtherParticipant(activeConversation)?.id || '')
                ? t('messages.online')
                : t('messages.offline')
            }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-1 md:gap-2">
        <el-popover
          placement="bottom-end"
          :width="280"
          trigger="click"
          popper-class="!glass-panel !backdrop-blur-xl !rounded-2xl !p-3 !border-strong/10 shadow-[0_12px_30px_rgba(0,0,0,0.15)]"
        >
          <template #reference>
            <button
              type="button"
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all text-slate-400 sm:mr-2 cursor-pointer"
            >
              <Search class="w-4 h-4" />
            </button>
          </template>
          <div class="relative">
            <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="messageSearchQuery"
              type="text"
              :placeholder="t('messages.searchMessages')"
              class="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-accent/20 outline-none transition-all"
              style="color: var(--text-primary)"
            />
          </div>
        </el-popover>
        <button
          type="button"
          class="hidden sm:block p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all cursor-pointer"
          :class="
            isRecording
              ? 'text-rose-500 animate-pulse bg-rose-50 dark:bg-rose-900/20'
              : 'text-slate-400'
          "
          :title="t('messages.voiceMessage')"
          @click="isRecording ? stopRecording() : startRecording()"
        >
          <Mic class="w-4 h-4" />
        </button>
        <span
          v-if="isRecording"
          class="hidden sm:inline text-[10px] font-black text-rose-500 animate-pulse"
          >{{ formatDuration(recordingDuration) }}</span
        >
        <button
          type="button"
          class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all cursor-pointer"
          style="color: var(--text-muted)"
          :title="t('messages.translate')"
          @click="messages.length > 0 && handleTranslate(messages[messages.length - 1])"
        >
          <Languages class="w-4 h-4" />
        </button>
        <div class="w-px h-4 mx-1 sm:mx-2" style="background-color: var(--border-base)"></div>
        <button
          type="button"
          class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all cursor-pointer"
          :class="isInfoPanelOpen ? 'text-accent' : ''"
          :style="!isInfoPanelOpen ? 'color: var(--text-muted)' : ''"
          @click="emit('toggle-info-panel')"
        >
          <Info class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Messages Area -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-3.5 sm:p-4.5 space-y-1 scrollbar-hide"
      @scroll="handleScroll"
    >
      <!-- Load older messages button -->
      <div v-if="hasMoreMessages" class="text-center py-3 mb-4">
        <button
          type="button"
          :disabled="isLoadingOlderMessages"
          class="px-4 py-2 text-xs font-bold text-accent hover:bg-accent/10 rounded-xl transition-all cursor-pointer"
          @click="emit('load-older')"
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
          class="flex items-center justify-center my-3 sm:my-4"
        >
          <div
            class="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
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
        <div v-if="msg.type === 'SYSTEM'" class="flex items-center justify-center my-2">
          <div
            class="px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-medium"
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
            class="flex gap-2 max-w-[85%] md:max-w-[70%]"
            :class="msg.senderId === authStore.user?.id ? 'flex-row-reverse' : ''"
          >
            <!-- Avatar -->
            <div
              v-if="shouldShowSenderAvatar(msg, filteredMessages[index - 1])"
              class="shrink-0 mb-0.5"
            >
              <UserAvatar
                v-if="msg.senderId !== authStore.user?.id"
                :user="msg.sender"
                size="sm"
                class="cursor-pointer hover:ring-2 hover:ring-accent transition-all animate-none"
                @click="emit('open-profile', msg.senderId)"
              />
              <UserAvatar v-else :user="authStore.user" size="sm" class="animate-none" />
            </div>
            <div v-else class="w-6 shrink-0"></div>

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
                class="text-[9px] font-bold mb-0.5 px-1"
                style="color: var(--text-muted)"
              >
                {{ msg.sender?.name || t('community.chat.unknownUser') }}
              </p>

              <!-- Reply Preview -->
              <div
                v-if="msg.replyTo"
                class="mb-0.5 px-2 py-1 rounded-lg text-[9px] max-w-full border-l-2 border-accent"
                style="background-color: var(--bg-card); color: var(--text-secondary)"
              >
                <span class="font-bold text-accent">{{
                  msg.replyTo.sender?.name || t('community.chat.unknownUser')
                }}</span>
                <span class="ml-1 truncate inline-block max-w-[200px] align-bottom">{{
                  msg.replyTo.type === 'IMAGE'
                    ? '[' + t('community.chat.photosTab') + ']'
                    : msg.replyTo.type === 'FILE'
                      ? '[' + t('community.chat.filesTab') + ']'
                      : msg.replyTo.content
                }}</span>
              </div>

              <!-- Message Content -->
              <div
                class="px-3 py-1.5 rounded-xl text-xs sm:text-sm shadow-sm relative animate-none"
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
                    alt=""
                    :src="api.defaults.baseURL + msg.content"
                    class="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    @click="openLink(api.defaults.baseURL + msg.content)"
                  />
                </template>
                <template v-else-if="msg.type === 'VOICE'">
                  <div class="flex items-center gap-2 py-0.5 min-w-[120px]">
                    <button
                      type="button"
                      class="w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm cursor-pointer"
                      :class="[
                        msg.senderId === authStore.user?.id
                          ? 'bg-white/20 hover:bg-white/30 text-white'
                          : 'bg-accent/10 hover:bg-accent/20 text-accent',
                      ]"
                      @click.stop="playVoiceMessage(msg.id, msg.content)"
                    >
                      <component
                        :is="currentlyPlaying === msg.id ? Pause : Play"
                        class="w-3.5 h-3.5"
                        :class="currentlyPlaying === msg.id ? '' : 'ml-0.5'"
                      />
                      <audio
                        :id="`audio-${msg.id}`"
                        :src="api.defaults.baseURL + msg.content"
                        class="hidden"
                      ></audio>
                    </button>
                    <div
                      class="flex-1 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full transition-all duration-300"
                        :class="msg.senderId === authStore.user?.id ? 'bg-white/60' : 'bg-accent'"
                        :style="{ width: currentlyPlaying === msg.id ? '100%' : '20%' }"
                      ></div>
                    </div>
                    <span
                      class="text-[9px] font-black uppercase tracking-widest opacity-70"
                      :class="msg.senderId === authStore.user?.id ? 'text-white' : 'text-accent'"
                    >
                      {{
                        currentlyPlaying === msg.id
                          ? t('community.chat.playing')
                          : t('messages.voiceMessage')
                      }}
                    </span>
                  </div>
                </template>
                <template v-else-if="msg.type === 'FILE'">
                  <div
                    class="flex items-center gap-2 p-1.5 bg-black/5 dark:bg-white/5 rounded-lg border border-white/10"
                  >
                    <div
                      class="w-8 h-8 bg-accent/20 rounded-md flex items-center justify-center text-accent shrink-0"
                    >
                      <Paperclip class="w-4 h-4" />
                    </div>
                    <div class="flex-1 min-w-0 pr-4">
                      <p class="text-[11px] font-bold truncate">
                        {{ msg.content.split('/').pop() }}
                      </p>
                      <a
                        :href="api.defaults.baseURL + msg.content"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-[9px] text-accent hover:underline font-bold"
                        >{{ t('community.chat.download') }}</a
                      >
                    </div>
                  </div>
                </template>
                <template v-else>
                  <SafeHtml tag="span" :html="renderTextWithLinks(msg.content)" />
                </template>

                <!-- Translation Display -->
                <div
                  v-if="translations[msg.id]"
                  class="mt-1.5 pt-1.5 border-t border-white/20 dark:border-slate-800 flex flex-col gap-0.5"
                >
                  <div class="flex items-center gap-1 text-[8px] font-bold opacity-60">
                    <Languages class="w-2.5 h-2.5" />
                    {{ t('messages.translate') }}
                  </div>
                  <p class="text-[11px] italic opacity-90">{{ translations[msg.id] }}</p>
                </div>
              </div>

              <!-- Message Actions (On Hover) -->
              <div
                class="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <button
                  v-if="msg.type === 'TEXT'"
                  type="button"
                  class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-all cursor-pointer"
                  :class="translations[msg.id] ? 'text-accent' : 'text-slate-400'"
                  :title="t('messages.translate')"
                  @click="handleTranslate(msg)"
                >
                  <Languages class="w-3 h-3" />
                </button>
                <button
                  type="button"
                  class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 transition-all cursor-pointer"
                  @click="setReplyTo(msg)"
                >
                  <Reply class="w-3 h-3" />
                </button>
                <button
                  type="button"
                  class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 transition-all cursor-pointer"
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
                  type="button"
                  class="p-1 rounded-full hover:scale-110 shadow-sm border border-[var(--border-base)] cursor-pointer"
                  style="background-color: var(--bg-card)"
                  @click.stop="showReactionPicker = showReactionPicker === msg.id ? null : msg.id"
                >
                  <SmilePlus class="w-3 h-3 text-[var(--text-muted)]" />
                </button>
                <button
                  v-if="msg.senderId === authStore.user?.id"
                  type="button"
                  class="p-1 rounded-full hover:scale-110 shadow-sm border border-[var(--border-base)] hover:bg-rose-50 dark:hover:bg-rose-900/20 cursor-pointer"
                  style="background-color: var(--bg-card)"
                  :title="t('common.delete')"
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
                  type="button"
                  class="w-8 h-8 flex items-center justify-center text-base hover:scale-125 hover:bg-accent/10 rounded-lg transition-all cursor-pointer"
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
                  type="button"
                  class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all hover:scale-105 cursor-pointer"
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
        <span class="text-[10px] text-slate-400 animate-pulse">{{ t('messages.syncing') }}...</span>
      </div>
      <div
        v-if="filteredMessages.length === 0 && messageSearchQuery"
        class="text-center py-20 text-slate-400"
      >
        <p class="text-xs">{{ t('search.noResults') }}</p>
      </div>
    </div>

    <!-- Reply Bar -->
    <div
      v-if="replyToMessage"
      class="px-4 py-1.5 border-t flex items-center gap-2.5 animate-none shrink-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <Reply class="w-3.5 h-3.5 text-accent shrink-0" />
      <div class="flex-1 min-w-0">
        <p class="text-[9px] font-bold text-accent">
          {{ replyToMessage.sender?.name || t('community.chat.unknownUser') }}
        </p>
        <p class="text-[11px] truncate" style="color: var(--text-secondary)">
          {{
            replyToMessage.type === 'IMAGE'
              ? '[' + t('community.chat.photosTab') + ']'
              : replyToMessage.type === 'FILE'
                ? '[' + t('community.chat.filesTab') + ']'
                : replyToMessage.content
          }}
        </p>
      </div>
      <button
        type="button"
        class="p-0.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded transition-all cursor-pointer"
        @click="cancelReply"
      >
        <X class="w-3 h-3" style="color: var(--text-muted)" />
      </button>
    </div>

    <!-- Input Area -->
    <div
      class="p-2.5 sm:p-3 border-t relative shrink-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- Emoji Picker -->
      <div
        v-if="showEmojiPicker"
        class="absolute bottom-full mb-2 left-2 right-2 md:left-3 md:right-auto p-2 rounded-xl shadow-xl border z-50 grid grid-cols-8 md:grid-cols-4 gap-1 sm:gap-1.5 max-w-[calc(100%-1rem)] md:w-72"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <button
          v-for="emoji in commonEmojis"
          :key="emoji"
          type="button"
          class="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-base sm:text-lg hover:bg-accent-subtle rounded-md sm:rounded-lg transition-all cursor-pointer"
          @click="addEmoji(emoji)"
        >
          {{ emoji }}
        </button>
      </div>

      <div
        class="flex items-end gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-xl focus-within:ring-2 focus-within:ring-accent/20 transition-all border"
        :class="isDragOver ? 'border-accent ring-2 ring-accent/20' : ''"
        style="background-color: var(--bg-app); border-color: var(--border-base)"
      >
        <div class="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            class="p-1 hover:text-accent transition-colors cursor-pointer"
            :class="showEmojiPicker ? 'text-accent' : ''"
            style="color: var(--text-muted)"
            @click="showEmojiPicker = !showEmojiPicker"
          >
            <Smile class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="p-1 hover:text-accent transition-colors cursor-pointer"
            style="color: var(--text-muted)"
            @click="triggerFileUpload"
          >
            <Paperclip class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="p-1 hover:text-accent transition-colors cursor-pointer"
            :class="isRecording ? 'text-rose-500 animate-pulse' : 'text-slate-400'"
            @click="isRecording ? stopRecording() : startRecording()"
          >
            <Mic class="w-4 h-4" />
          </button>
          <span
            v-if="isRecording"
            class="text-[9px] font-black text-rose-500 animate-pulse ml-0.5"
            >{{ formatDuration(recordingDuration) }}</span
          >
        </div>

        <input ref="fileInput" type="file" class="hidden" @change="handleFileUpload" />

        <textarea
          v-model="newMessage"
          :placeholder="t('sidebar.messages') + '...'"
          rows="1"
          class="flex-1 bg-transparent border-none focus:ring-0 text-xs sm:text-sm py-1.5 resize-none max-h-32 scrollbar-hide focus:outline-none"
          style="color: var(--text-primary)"
          @keydown.enter.prevent="handleSendMessage('TEXT')"
        ></textarea>

        <button
          type="button"
          :disabled="!newMessage.trim() || isUploading"
          class="p-2 bg-accent text-white rounded-lg hover:bg-accent transition-all shadow-md shadow-accent/20 disabled:opacity-50 flex items-center justify-center min-w-[32px] h-8 w-8 shrink-0 cursor-pointer"
          @click="handleSendMessage('TEXT')"
        >
          <div
            v-if="isUploading"
            class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
          ></div>
          <Send v-else class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Context Menu -->
    <div
      v-if="contextMenu.visible && contextMenu.message"
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
        type="button"
        class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-accent/10 transition-all cursor-pointer"
        style="color: var(--text-primary)"
        @click="setReplyTo(contextMenu.message)"
      >
        <Reply class="w-4 h-4 text-accent" /> {{ t('common.reply') }}
      </button>
      <button
        v-if="contextMenu.message.type === 'TEXT'"
        type="button"
        class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-accent/10 transition-all cursor-pointer"
        style="color: var(--text-primary)"
        @click="handleTranslate(contextMenu.message)"
      >
        <Languages class="w-4 h-4 text-indigo-500" /> {{ t('messages.translate') }}
      </button>
      <button
        v-if="contextMenu.message.type === 'TEXT'"
        type="button"
        class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-accent/10 transition-all cursor-pointer"
        style="color: var(--text-primary)"
        @click="copyMessage(contextMenu.message.content)"
      >
        <AtSign class="w-4 h-4" style="color: var(--text-muted)" /> {{ t('common.copy') }}
      </button>
      <button
        v-if="contextMenu.message.senderId === authStore.user?.id"
        type="button"
        class="w-full px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-rose-500/10 text-rose-500 transition-all cursor-pointer"
        @click="
          emit('delete-message', contextMenu.messageId);
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
          type="button"
          class="w-8 h-8 flex items-center justify-center text-base hover:scale-125 hover:bg-accent/10 rounded-lg transition-all cursor-pointer"
          @click="
            toggleReaction(contextMenu.messageId, emoji);
            closeContextMenu();
          "
        >
          {{ emoji }}
        </button>
      </div>
    </div>
  </div>
</template>
