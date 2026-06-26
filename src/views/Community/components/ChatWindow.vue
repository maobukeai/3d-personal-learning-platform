<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Check,
  CheckCheck,
  Loader2,
  Paperclip,
  Pause,
  Play,
  Reply,
  SmilePlus,
  Trash2,
  X,
  AtSign,
  Languages,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';
import SafeHtml from '@/components/SafeHtml.vue';
import api, { getAssetUrl } from '@/utils/api';
import { logError } from '@/utils/error';
import axios from 'axios';
import { downloadFileMultiThreaded } from '@/utils/downloadHelper';
import type { ChatConversation, ChatMessage, MessageReaction } from './chatTypes';
import ChatWindowHeader from './ChatWindowHeader.vue';
import ChatInputArea from './ChatInputArea.vue';

const props = defineProps<{
  activeConversation: ChatConversation;
  messages: ChatMessage[];
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

const isCancelError = (err: unknown): boolean => {
  if (axios.isCancel(err)) return true;
  if (err instanceof Error && err.name === 'CanceledError') return true;
  if (
    typeof err === 'object' &&
    err !== null &&
    (err as { message?: string }).message === 'canceled'
  )
    return true;
  return false;
};

const newMessage = ref('');
const messageSearchQuery = ref('');
const replyToMessage = ref<ChatMessage | null>(null);
const showReactionPicker = ref<string | null>(null);
const isDragOver = ref(false);
const dragCounter = ref(0);
const translations = ref<Record<string, string>>({});
const translating = ref<Record<string, boolean>>({});

const messagesContainer = ref<HTMLElement | null>(null);

const isRecording = ref(false);
const recordingDuration = ref(0);
const currentlyPlaying = ref<string | null>(null);
const isUploading = ref(false);
const uploadProgress = ref(0);
let uploadAbortController: AbortController | null = null;

const uploadSpeed = ref('');
let activeMultipart: { key: string; uploadId: string } | null = null;

const isDownloading = ref(false);
const downloadProgress = ref(0);
const downloadSpeedStr = ref('');
let downloadAbortController: AbortController | null = null;

const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀'];

const contextMenu = ref<{
  visible: boolean;
  x: number;
  y: number;
  messageId: string;
  message: ChatMessage | null;
}>({
  visible: false,
  x: 0,
  y: 0,
  messageId: '',
  message: null,
});

const isMessageRead = (msg: ChatMessage) => {
  return !!msg.readBy && msg.readBy.length > 0;
};

const filteredMessages = computed(() => {
  if (!messageSearchQuery.value.trim()) return props.messages;
  const query = messageSearchQuery.value.toLowerCase();
  return props.messages.filter(
    (m) => m.type === 'TEXT' && m.content && m.content.toLowerCase().includes(query),
  );
});

const cancelUpload = async () => {
  if (uploadAbortController) {
    uploadAbortController.abort();
    uploadAbortController = null;
  }
  if (activeMultipart) {
    try {
      await api.post('/api/messages/multipart/abort', {
        key: activeMultipart.key,
        uploadId: activeMultipart.uploadId,
      });
    } catch (err) {
      logError('[Upload] Failed to abort multipart upload on cancel:', err);
    } finally {
      activeMultipart = null;
    }
  }
  isUploading.value = false;
  uploadProgress.value = 0;
  uploadSpeed.value = '';
};

const cancelDownload = () => {
  if (downloadAbortController) {
    downloadAbortController.abort();
    downloadAbortController = null;
  }
  isDownloading.value = false;
  downloadProgress.value = 0;
  downloadSpeedStr.value = '';
};

const handleDownloadFile = async (contentUrl: string, fileSizeMb?: number) => {
  const resolvedUrl = getAssetUrl(contentUrl);
  const filename = contentUrl.split('/').pop() || 'download';

  isDownloading.value = true;
  downloadProgress.value = 0;
  downloadSpeedStr.value = '';
  downloadAbortController = new AbortController();

  try {
    const totalSizeOverrideBytes = fileSizeMb ? (fileSizeMb * 1024 * 1024) : undefined;
    await downloadFileMultiThreaded(
      resolvedUrl,
      filename,
      (percent) => {
        downloadProgress.value = percent;
      },
      (speed) => {
        downloadSpeedStr.value = speed;
      },
      downloadAbortController.signal,
      totalSizeOverrideBytes
    );
  } catch (err: unknown) {
    if (isCancelError(err)) {
      return;
    }
    logError('[Download] Parallel download error, standard fallback occurred.', err);
  } finally {
    isDownloading.value = false;
    downloadProgress.value = 0;
    downloadSpeedStr.value = '';
    downloadAbortController = null;
  }
};

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingTimer: ReturnType<typeof setInterval> | null = null;

const uploadFile = async (fileOrBlob: File | Blob, filename: string, mimetype: string) => {
  uploadProgress.value = 0;
  isUploading.value = true;
  uploadSpeed.value = '';
  activeMultipart = null;
  uploadAbortController = new AbortController();

  const size = fileOrBlob.size;
  let lastLoaded = 0;
  let lastTime = Date.now();

  const updateSpeed = (loaded: number) => {
    const now = Date.now();
    const elapsed = (now - lastTime) / 1000;
    if (elapsed >= 0.5) {
      const bytesTransferred = loaded - lastLoaded;
      const speedBytesPerSec = bytesTransferred / elapsed;
      let speedStr: string;
      if (speedBytesPerSec > 1024 * 1024) {
        speedStr = `${(speedBytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
      } else if (speedBytesPerSec > 1024) {
        speedStr = `${(speedBytesPerSec / 1024).toFixed(0)} KB/s`;
      } else {
        speedStr = `${speedBytesPerSec.toFixed(0)} B/s`;
      }
      uploadSpeed.value = speedStr;
      lastLoaded = loaded;
      lastTime = now;
    }
  };

  try {
    if (size >= 10 * 1024 * 1024) {
      const initRes = await api.post('/api/messages/multipart/initiate', {
        filename,
        mimetype,
        size,
      });

      if (initRes.data.isDirect) {
        const { uploadId, key } = initRes.data;
        activeMultipart = { key, uploadId };

        const chunkSize = 5 * 1024 * 1024;
        const totalChunks = Math.ceil(size / chunkSize);
        const partNumbers = Array.from({ length: totalChunks }, (_, i) => i + 1);

        const partsRes = await api.post('/api/messages/multipart/presign-parts', {
          key,
          uploadId,
          partNumbers,
        });

        const urls = partsRes.data.urls;
        const loadedParts = new Array(totalChunks).fill(0);
        const completedParts: { ETag: string; PartNumber: number }[] = [];

        const uploadChunk = async (partNum: number) => {
          const start = (partNum - 1) * chunkSize;
          const end = Math.min(start + chunkSize, size);
          const chunk = fileOrBlob.slice(start, end);
          const presignedUrl = urls[partNum];

          const res = await axios.put(presignedUrl, chunk, {
            headers: {
              'Content-Type': mimetype,
            },
            signal: uploadAbortController?.signal,
            onUploadProgress: (progressEvent) => {
              loadedParts[partNum - 1] = progressEvent.loaded || 0;
              const totalLoaded = loadedParts.reduce((sum, val) => sum + val, 0);
              const percent = Math.min(Math.round((totalLoaded * 100) / size), 99);
              uploadProgress.value = percent;
              updateSpeed(totalLoaded);
            },
          });

          const etag = res.headers.etag || res.headers.ETag || '';
          completedParts.push({
            ETag: etag.replace(/"/g, ''),
            PartNumber: partNum,
          });
        };

        const queue = [...partNumbers];
        const workers: Promise<void>[] = [];
        const executeWorker = async () => {
          while (queue.length > 0) {
            const partNum = queue.shift();
            if (partNum !== undefined) {
              await uploadChunk(partNum);
            }
          }
        };

        for (let w = 0; w < Math.min(3, totalChunks); w++) {
          workers.push(executeWorker());
        }
        await Promise.all(workers);

        const completeRes = await api.post('/api/messages/multipart/complete', {
          key,
          uploadId,
          parts: completedParts,
        });

        activeMultipart = null;
        uploadProgress.value = 100;
        return completeRes.data;
      }
    } else {
      const presignedRes = await api.post('/api/messages/presigned-url', {
        filename,
        mimetype,
        size,
      });

      if (presignedRes.data.isDirect) {
        const { uploadUrl, publicUrl } = presignedRes.data;

        await axios.put(uploadUrl, fileOrBlob, {
          headers: {
            'Content-Type': mimetype,
          },
          signal: uploadAbortController.signal,
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.min(
                Math.round((progressEvent.loaded * 100) / progressEvent.total),
                99,
              );
              uploadProgress.value = percent;
              updateSpeed(progressEvent.loaded);
            }
          },
        });

        uploadProgress.value = 100;
        return {
          url: publicUrl,
          type: mimetype.startsWith('image/') ? 'IMAGE' : 'FILE',
        };
      }
    }

    const formData = new FormData();
    formData.append('message_file', fileOrBlob, filename);

    const res = await api.post('/api/messages/upload', formData, {
      signal: uploadAbortController.signal,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.min(
            Math.round((progressEvent.loaded * 100) / progressEvent.total),
            99,
          );
          uploadProgress.value = percent;
          updateSpeed(progressEvent.loaded);
        }
      },
    });

    uploadProgress.value = 100;
    return res.data;
  } catch (error: unknown) {
    if (isCancelError(error)) {
      if (activeMultipart) {
        try {
          await api.post('/api/messages/multipart/abort', {
            key: activeMultipart.key,
            uploadId: activeMultipart.uploadId,
          });
        } catch (abortErr) {
          logError('[Upload] Failed to abort multipart upload on cancel/error:', abortErr);
        } finally {
          activeMultipart = null;
        }
      }
      throw error;
    }
    throw error;
  } finally {
    isUploading.value = false;
    uploadAbortController = null;
    // Hold 100% briefly so the user can see the completed state before the progress bar clears
    await new Promise((resolve) => setTimeout(resolve, 600));
    uploadProgress.value = 0;
    uploadSpeed.value = '';
  }
};

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files?.length) return;

  const file = input.files[0];
  if (file.size > 500 * 1024 * 1024) {
    ElMessage.error(
      authStore.user?.language === 'en'
        ? 'File size exceeds limit, maximum allowed is 500MB'
        : '文件大小不能超过 500MB',
    );
    input.value = '';
    return;
  }

  try {
    const data = await uploadFile(file, file.name, file.type || 'application/octet-stream');
    const { url, type } = data;
    handleSendMessage(type, url);
  } catch (err: unknown) {
    if (isCancelError(err)) {
      return;
    }
    ElMessage.error(t('messages.uploadFailed'));
  } finally {
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
  if (file.size > 500 * 1024 * 1024) {
    ElMessage.error(
      authStore.user?.language === 'en'
        ? 'File size exceeds limit, maximum allowed is 500MB'
        : '文件大小不能超过 500MB',
    );
    return;
  }

  try {
    const data = await uploadFile(file, file.name, file.type || 'application/octet-stream');
    const { url, type } = data;
    handleSendMessage(type, url);
  } catch (err: unknown) {
    if (isCancelError(err)) {
      return;
    }
    ElMessage.error(t('messages.uploadFailed'));
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

      try {
        const data = await uploadFile(
          audioBlob,
          `voice_${Date.now()}.${extension}`,
          mimeType || 'audio/wav',
        );
        const { url } = data;
        handleSendMessage('VOICE', url);
      } catch (err: unknown) {
        if (isCancelError(err)) {
          return;
        }
        ElMessage.error(t('messages.uploadFailed'));
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

const handleTranslate = async (message: ChatMessage) => {
  if (translations.value[message.id]) {
    delete translations.value[message.id];
    return;
  }

  translating.value[message.id] = true;
  try {
    const response = await api.post('/api/messages/translate', {
      content: message.content,
    });
    translations.value[message.id] = response.data.translation;
  } catch {
    ElMessage.error(t('messages.sendFailed'));
  } finally {
    translating.value[message.id] = false;
  }
};

const isAllPeerTranslated = computed(() => {
  const peerTextMessages = props.messages.filter(
    (msg) => msg.senderId !== authStore.user?.id && msg.type === 'TEXT',
  );
  if (peerTextMessages.length === 0) return false;
  return peerTextMessages.every((msg) => !!translations.value[msg.id]);
});

const handleTranslateAllPeer = async () => {
  const peerTextMessages = props.messages.filter(
    (msg) => msg.senderId !== authStore.user?.id && msg.type === 'TEXT',
  );

  if (peerTextMessages.length === 0) return;

  const hasUntranslated = peerTextMessages.some((msg) => !translations.value[msg.id]);

  if (hasUntranslated) {
    const untranslatedMessages = peerTextMessages.filter(
      (msg) => !translations.value[msg.id] && !translating.value[msg.id],
    );

    if (untranslatedMessages.length === 0) return;

    untranslatedMessages.forEach((msg) => {
      translating.value[msg.id] = true;
    });

    try {
      const response = await api.post('/api/messages/translate', {
        messages: untranslatedMessages.map((msg) => ({
          id: msg.id,
          content: msg.content,
        })),
      });

      const results: Array<{ id: string; translation: string }> = response.data.translations || [];
      results.forEach((item) => {
        translations.value[item.id] = item.translation;
      });
    } catch (err) {
      logError(err, { operation: 'chat.batchTranslate', component: 'ChatWindow' });
      ElMessage.error(t('messages.sendFailed'));
    } finally {
      untranslatedMessages.forEach((msg) => {
        translating.value[msg.id] = false;
      });
    }
  } else {
    peerTextMessages.forEach((msg) => {
      delete translations.value[msg.id];
    });
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

const shouldShowDateSeparator = (currentMsg: ChatMessage, previousMsg: ChatMessage | null) => {
  if (!previousMsg) return true;
  const currentDate = new Date(currentMsg.createdAt).toDateString();
  const previousDate = new Date(previousMsg.createdAt).toDateString();
  return currentDate !== previousDate;
};

const shouldShowSenderAvatar = (currentMsg: ChatMessage, previousMsg: ChatMessage | null) => {
  if (currentMsg.senderId === authStore.user?.id) return false;
  if (!previousMsg) return true;
  if (previousMsg.senderId !== currentMsg.senderId) return true;
  const timeDiff =
    new Date(currentMsg.createdAt).getTime() - new Date(previousMsg.createdAt).getTime();
  return timeDiff > 5 * 60 * 1000;
};

const shouldShowTimestamp = (currentMsg: ChatMessage, nextMsg: ChatMessage | null) => {
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

const setReplyTo = (msg: ChatMessage) => {
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

const handleContextMenu = (event: MouseEvent, msg: ChatMessage) => {
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
  () => [props.messages.length, props.messages[props.messages.length - 1]?.id],
  () => {
    if (!props.isLoadingOlderMessages) {
      scrollToBottom();
    }
  },
);

onUnmounted(() => {
  if (isRecording.value) {
    stopRecording();
  }
  if (recordingTimer) {
    clearInterval(recordingTimer);
  }
  // Cancel any in-progress upload or download to avoid state updates on unmounted component
  cancelUpload();
  cancelDownload();
});

defineExpose({
  scrollToBottom,
  closeContextMenu,
});
</script>

<template>
  <div
    class="flex-1 flex flex-col relative transition-all duration-300 z-10 mobile-adaptive"
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

    <ChatWindowHeader
      v-model:search-query="messageSearchQuery"
      :active-conversation="activeConversation"
      :is-info-panel-open="isInfoPanelOpen"
      :is-recording="isRecording"
      :recording-duration="recordingDuration"
      :is-all-peer-translated="isAllPeerTranslated"
      @back="emit('back')"
      @toggle-info-panel="emit('toggle-info-panel')"
      @start-recording="startRecording"
      @stop-recording="stopRecording"
      @translate-all-peer="handleTranslateAllPeer"
      @open-profile="emit('open-profile', $event)"
    />

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
                    :src="getAssetUrl(msg.content)"
                    class="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    @click="openLink(getAssetUrl(msg.content))"
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
                        :src="getAssetUrl(msg.content)"
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
                        href="#"
                        class="text-[9px] text-accent hover:underline font-bold"
                        @click.prevent="handleDownloadFile(msg.content)"
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
                  v-if="translations[msg.id] || translating[msg.id]"
                  class="mt-1.5 pt-1.5 border-t border-white/20 dark:border-slate-800 flex flex-col gap-0.5"
                >
                  <div class="flex items-center gap-1 text-[8px] font-bold opacity-60">
                    <Loader2 v-if="translating[msg.id]" class="w-2.5 h-2.5 animate-spin" />
                    <Languages v-else class="w-2.5 h-2.5" />
                    {{
                      translating[msg.id] ? '正在翻译 / Translating...' : t('messages.translate')
                    }}
                  </div>
                  <p v-if="translations[msg.id]" class="text-[11px] italic opacity-90">
                    {{ translations[msg.id] }}
                  </p>
                  <p v-else-if="translating[msg.id]" class="text-[11px] italic opacity-40">
                    正在翻译，请稍候...
                  </p>
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
                  :disabled="translating[msg.id]"
                  @click="handleTranslate(msg)"
                >
                  <Loader2 v-if="translating[msg.id]" class="w-3 h-3 animate-spin text-accent" />
                  <Languages v-else class="w-3 h-3" />
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

    <ChatInputArea
      v-model="newMessage"
      :reply-to-message="replyToMessage"
      :is-uploading="isUploading"
      :upload-progress="uploadProgress"
      :upload-speed="uploadSpeed"
      :is-downloading="isDownloading"
      :download-progress="downloadProgress"
      :download-speed="downloadSpeedStr"
      :is-recording="isRecording"
      :recording-duration="recordingDuration"
      :is-drag-over="isDragOver"
      @send="handleSendMessage"
      @file-upload="handleFileUpload"
      @cancel-upload="cancelUpload"
      @cancel-download="cancelDownload"
      @start-recording="startRecording"
      @stop-recording="stopRecording"
      @cancel-reply="cancelReply"
    />

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
