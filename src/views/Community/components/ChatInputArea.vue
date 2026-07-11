<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Loader2, Mic, Paperclip, Reply, Send, Smile, X } from 'lucide-vue-next';
import type { ChatMessage } from './chatTypes';

const props = defineProps<{
  modelValue: string;
  replyToMessage: ChatMessage | null;
  isUploading: boolean;
  uploadProgress: number;
  uploadSpeed: string;
  isDownloading: boolean;
  downloadProgress: number;
  downloadSpeed: string;
  isRecording: boolean;
  recordingDuration: number;
  isDragOver: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'send', type: string): void;
  (e: 'file-upload', event: Event): void;
  (e: 'cancel-upload'): void;
  (e: 'cancel-download'): void;
  (e: 'start-recording'): void;
  (e: 'stop-recording'): void;
  (e: 'cancel-reply'): void;
}>();

const { t, locale } = useI18n();

const showEmojiPicker = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

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

const canSend = computed(() => {
  return props.modelValue.trim().length > 0 && !props.isUploading;
});

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const addEmoji = (emoji: string) => {
  emit('update:modelValue', props.modelValue + emoji);
  showEmojiPicker.value = false;
  nextTick(() => textareaRef.value?.focus());
};

const triggerFileUpload = () => {
  fileInput.value?.click();
};

const textareaRef = ref<HTMLTextAreaElement | null>(null);

const handleInput = (event: Event) => {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
};

const handleSend = () => {
  if (!canSend.value) return;
  emit('send', 'TEXT');
};
</script>

<template>
  <div
    class="chat-input-wrapper p-2.5 sm:p-3 border-t relative shrink-0 mobile-adaptive"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <!-- Uploading Progress overlay -->
    <div
      v-if="isUploading && uploadProgress > 0"
      class="absolute bottom-full mb-3 right-3 left-3 md:left-auto md:w-80 p-3 rounded-xl shadow-lg border z-50 glass-panel backdrop-blur-xl transition-all animate-none"
      style="border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between mb-1.5">
        <span
          class="text-[11px] sm:text-xs font-bold flex items-center gap-1.5"
          style="color: var(--text-secondary)"
        >
          <Loader2 class="w-3.5 h-3.5 animate-spin text-accent" />
          {{ locale === 'en' ? 'Uploading...' : '正在上传文件...' }}
        </span>
        <div class="flex items-center gap-2">
          <span
            v-if="uploadSpeed"
            class="text-[11px] sm:text-xs text-slate-400 font-medium font-mono mr-1"
            >{{ uploadSpeed }}</span
          >
          <span class="text-[11px] sm:text-xs font-black text-accent">{{ uploadProgress }}%</span>
          <button
            type="button"
            class="p-0.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 hover:text-rose-500 transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="取消上传 / Cancel upload"
            @click="emit('cancel-upload')"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div
          class="bg-accent h-1.5 rounded-full transition-all duration-300"
          :style="{ width: `${uploadProgress}%` }"
        ></div>
      </div>
    </div>

    <!-- Downloading Progress overlay -->
    <div
      v-if="isDownloading && downloadProgress > 0"
      class="absolute bottom-full mb-3 right-3 left-3 md:left-auto md:w-80 p-3 rounded-xl shadow-lg border z-50 glass-panel backdrop-blur-xl transition-all animate-none"
      style="border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between mb-1.5">
        <span
          class="text-[11px] sm:text-xs font-bold flex items-center gap-1.5"
          style="color: var(--text-secondary)"
        >
          <Loader2 class="w-3.5 h-3.5 animate-spin text-accent" />
          {{ locale === 'en' ? 'Downloading...' : '正在下载文件...' }}
        </span>
        <div class="flex items-center gap-2">
          <span
            v-if="downloadSpeed"
            class="text-[11px] sm:text-xs text-slate-400 font-medium font-mono mr-1"
            >{{ downloadSpeed }}</span
          >
          <span class="text-[11px] sm:text-xs font-black text-accent">{{ downloadProgress }}%</span>
          <button
            type="button"
            class="p-0.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded text-slate-400 hover:text-rose-500 transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="取消下载 / Cancel download"
            @click="emit('cancel-download')"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div
          class="bg-accent h-1.5 rounded-full transition-all duration-300"
          :style="{ width: `${downloadProgress}%` }"
        ></div>
      </div>
    </div>

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

    <!-- Reply Bar -->
    <div v-if="replyToMessage" class="px-2 pb-2 flex items-center gap-2.5 animate-none">
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
        @click="emit('cancel-reply')"
      >
        <X class="w-3 h-3" style="color: var(--text-muted)" />
      </button>
    </div>

    <div
      class="flex items-end gap-1 sm:gap-2 p-1 sm:p-1.5 rounded-xl focus-within:ring-2 focus-within:ring-accent/20 transition-all border"
      :class="isDragOver ? 'border-accent ring-2 ring-accent/20' : ''"
      style="background-color: var(--bg-app); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-0.5 sm:gap-1 shrink-0 mobile-row">
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
          @click="isRecording ? emit('stop-recording') : emit('start-recording')"
        >
          <Mic class="w-4 h-4" />
        </button>
        <span v-if="isRecording" class="text-[9px] font-black text-rose-500 animate-pulse ml-0.5">{{
          formatDuration(recordingDuration)
        }}</span>
      </div>

      <input ref="fileInput" type="file" class="hidden" @change="emit('file-upload', $event)" />

      <textarea
        ref="textareaRef"
        :value="modelValue"
        :placeholder="t('sidebar.messages') + '...'"
        rows="1"
        class="flex-1 bg-transparent border-none focus:ring-0 text-xs sm:text-sm py-1.5 resize-none max-h-32 scrollbar-hide focus:outline-none"
        style="color: var(--text-primary)"
        @input="handleInput"
        @keydown.enter.prevent="handleSend"
      ></textarea>

      <button
        type="button"
        :disabled="!canSend"
        class="p-2 bg-accent text-white rounded-lg hover:bg-accent transition-all shadow-md shadow-accent/20 disabled:opacity-50 flex items-center justify-center min-w-[32px] h-8 w-8 shrink-0 cursor-pointer"
        @click="handleSend"
      >
        <div
          v-if="isUploading"
          class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
        ></div>
        <Send v-else class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
