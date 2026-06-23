<script setup lang="ts">
import { formatFileSize } from '@/utils/format';
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import {
  MessageSquare,
  AlignLeft,
  X,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Send,
} from 'lucide-vue-next';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import UserAvatar from '@/components/UserAvatar.vue';
import type { Project, User } from '@/types';

interface DiscussionReaction {
  emoji: string;
  userId: string;
}

interface ProjectDiscussion {
  id: string;
  content?: string | null;
  type?: string;
  images?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  userId: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'>;
  reactions?: DiscussionReaction[];
  createdAt: string;
}

type CollaborationProject = Project & {
  discussions?: ProjectDiscussion[];
};

type DiscussionPayload = {
  content: string;
  type: 'TEXT' | 'IMAGE' | 'FILE';
  images?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
};

type DiscussionUploadField = 'images' | 'message_file';

interface DiscussionUploadResponse {
  url: string;
  fileName: string;
  fileSize: number;
  type: 'IMAGE' | 'FILE';
}

const props = defineProps<{
  project: CollaborationProject;
  projectId: string;
  isMember: boolean;
}>();

const emit = defineEmits<{
  (e: 'open-profile', userId: string): void;
  (e: 'join'): void;
  (e: 'refresh'): void;
}>();

const authStore = useAuthStore();

// Discussions related
const newComment = ref('');
const isSendingComment = ref(false);
const chatScroll = ref<HTMLElement | null>(null);
const showEmojiPicker = ref(false);
const selectedImages = ref<File[]>([]);
const selectedFile = ref<File | null>(null);
const imagePreviewUrls = ref<string[]>([]);
const quickEmojis = ['👍', '❤️', '😂', '🚀', '🔥', '✅', '❌', '🎉', '💪', '👀'];

const revokePreviewUrl = (url: string | undefined) => {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

const clearSelectedImages = () => {
  imagePreviewUrls.value.forEach(revokePreviewUrl);
  imagePreviewUrls.value = [];
  selectedImages.value = [];
};

const resetComposer = () => {
  newComment.value = '';
  clearSelectedImages();
  selectedFile.value = null;
  showEmojiPicker.value = false;
};

const uploadDiscussionAttachment = async (
  file: File,
  field: DiscussionUploadField,
): Promise<DiscussionUploadResponse> => {
  const formData = new FormData();
  formData.append(field, file);
  const endpoint =
    field === 'images'
      ? '/api/projects/discussion-image-uploads'
      : '/api/projects/discussion-file-uploads';

  const uploadRes = await api.post<DiscussionUploadResponse>(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return uploadRes.data;
};

void resetComposer;
void uploadDiscussionAttachment;

const scrollToBottom = () => {
  nextTick(() => {
    if (chatScroll.value) {
      chatScroll.value.scrollTop = chatScroll.value.scrollHeight;
    }
  });
};

watch(
  () => props.project?.discussions?.length,
  () => {
    scrollToBottom();
  },
);

onMounted(() => {
  scrollToBottom();
});

onUnmounted(() => {
  clearSelectedImages();
});

const handleSendComment = async () => {
  if (!newComment.value.trim() && selectedImages.value.length === 0 && !selectedFile.value) return;
  isSendingComment.value = true;
  try {
    const payload: DiscussionPayload = {
      content: newComment.value || ' ',
      type: 'TEXT',
    };

    if (selectedImages.value.length > 0) {
      const uploads = await Promise.all(
        selectedImages.value.map((img) => uploadDiscussionAttachment(img, 'images')),
      );
      const imageUrls = uploads.map((upload) => upload.url);
      payload.images = JSON.stringify(imageUrls);
      payload.type = 'IMAGE';
      if (newComment.value.trim()) payload.type = 'TEXT';
    }

    if (selectedFile.value) {
      const upload = await uploadDiscussionAttachment(selectedFile.value, 'message_file');
      payload.fileUrl = upload.url;
      payload.fileName = upload.fileName || selectedFile.value.name;
      payload.fileSize = upload.fileSize || selectedFile.value.size / (1024 * 1024);
      if (payload.type === 'TEXT' && !newComment.value.trim()) payload.type = 'FILE';
    }

    await api.post(`/api/projects/${props.projectId}/discussions`, payload);
    resetComposer();
    emit('refresh');
  } catch {
    ElMessage.error('发表留言失败');
  } finally {
    isSendingComment.value = false;
  }
};

const handleImageSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;
  const files = Array.from(input.files);
  selectedImages.value.push(...files);
  files.forEach((f) => {
    imagePreviewUrls.value.push(URL.createObjectURL(f));
  });
  input.value = '';
};

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || !input.files[0]) return;
  selectedFile.value = input.files[0];
  input.value = '';
};

const removeImage = (index: number) => {
  revokePreviewUrl(imagePreviewUrls.value[index]);
  selectedImages.value.splice(index, 1);
  imagePreviewUrls.value.splice(index, 1);
};

const removeFile = () => {
  selectedFile.value = null;
};

const insertEmoji = (emoji: string) => {
  newComment.value += emoji;
  showEmojiPicker.value = false;
};

const handleReaction = async (discussionId: string, emoji: string) => {
  try {
    await api.post(`/api/projects/discussions/${discussionId}/reactions`, { emoji });
    emit('refresh');
  } catch {
    // silently fail
  }
};

const parseImages = (images: string | null | undefined): string[] => {
  if (!images) return [];
  try {
    return JSON.parse(images);
  } catch {
    return [];
  }
};

const openImage = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

const hasReaction = (reactions: DiscussionReaction[] | undefined, emoji: string) => {
  return reactions?.some((r) => r.emoji === emoji && r.userId === authStore.user?.id) || false;
};

const getReactionCount = (reactions: DiscussionReaction[] | undefined, emoji: string) => {
  return reactions?.filter((r) => r.emoji === emoji).length || 0;
};
</script>

<template>
  <div class="absolute inset-0 flex flex-col bg-white dark:bg-slate-950 mobile-adaptive">
    <template v-if="props.isMember">
      <div ref="chatScroll" class="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
        <div
          v-for="msg in props.project.discussions || []"
          :key="msg.id"
          class="flex gap-4 max-w-3xl animate-fade-in"
          :class="msg.userId === authStore.user?.id ? 'ml-auto flex-row-reverse' : ''"
        >
          <UserAvatar
            :user="msg.user"
            size="md"
            class="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
            @click="emit('open-profile', msg.user.id)"
          />

          <div :class="msg.userId === authStore.user?.id ? 'items-end' : ''" class="flex flex-col">
            <div
              class="flex items-center gap-3 mb-2"
              :class="msg.userId === authStore.user?.id ? 'flex-row-reverse' : ''"
            >
              <span
                class="text-xs font-black text-slate-700 dark:text-slate-300 cursor-pointer hover:text-accent transition-colors"
                @click="emit('open-profile', msg.user.id)"
                >{{ msg.user.name || msg.user.email }}</span
              >
              <span class="text-[10px] font-bold text-slate-400">{{
                new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              }}</span>
            </div>
            <div
              class="px-6 py-4 rounded-3xl text-sm leading-relaxed shadow-sm max-w-xl"
              :class="
                msg.userId === authStore.user?.id
                  ? 'bg-accent text-white rounded-tr-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
              "
            >
              {{ msg.content && msg.content !== ' ' ? msg.content : '' }}
            </div>

            <div
              v-if="parseImages(msg.images).length > 0"
              class="mt-2 flex flex-wrap gap-2 max-w-xl"
            >
              <img
                v-for="(img, idx) in parseImages(msg.images)"
                :key="idx"
                alt=""
                :src="img"
                class="max-w-[200px] max-h-[200px] rounded-2xl object-cover cursor-pointer hover:opacity-80 transition-opacity"
                @click="openImage(img)"
              />
            </div>

            <div v-if="msg.fileUrl" class="mt-2 max-w-xl">
              <a
                :href="msg.fileUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border shadow-sm hover:shadow-md transition-all"
                style="border-color: var(--border-base)"
              >
                <Paperclip class="w-5 h-5 text-accent shrink-0" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold truncate" style="color: var(--text-primary)">
                    {{ msg.fileName || '文件' }}
                  </p>
                  <p v-if="msg.fileSize" class="text-[10px] text-slate-400">
                    {{ formatFileSize(msg.fileSize) }}
                  </p>
                </div>
              </a>
            </div>

            <div class="flex items-center gap-1 mt-2 flex-wrap">
              <button
                v-for="emoji in quickEmojis.slice(0, 6)"
                :key="emoji"
                type="button"
                class="px-2 py-0.5 rounded-full text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                :class="
                  hasReaction(msg.reactions, emoji) ? 'bg-accent/10 ring-1 ring-accent/30' : ''
                "
                @click="handleReaction(msg.id, emoji)"
              >
                {{ emoji }}
                <span
                  v-if="getReactionCount(msg.reactions, emoji)"
                  class="text-[10px] text-slate-400"
                  >{{ getReactionCount(msg.reactions, emoji) }}</span
                >
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="(props.project.discussions?.length || 0) === 0"
          class="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 py-16"
        >
          <MessageSquare class="w-16 h-16 mb-6" />
          <p class="text-lg font-black">打个招呼吧，开启协作第一步</p>
        </div>
      </div>

      <!-- Input Area -->
      <div
        class="p-6 bg-white dark:bg-slate-950 border-t shrink-0"
        style="border-color: var(--border-base)"
      >
        <!-- Image Preview -->
        <div v-if="imagePreviewUrls.length > 0" class="flex gap-2 mb-3 flex-wrap animate-fade-in">
          <div v-for="(url, idx) in imagePreviewUrls" :key="idx" class="relative group">
            <img alt="" :src="url" class="w-20 h-20 rounded-xl object-cover" />
            <button
              type="button"
              class="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer animate-fade-in"
              @click="removeImage(idx)"
            >
              <X class="w-3 h-3" />
            </button>
          </div>
        </div>
        <!-- File Preview -->
        <div
          v-if="selectedFile"
          class="flex items-center gap-3 mb-3 px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl animate-fade-in"
        >
          <Paperclip class="w-4 h-4 text-accent" />
          <span class="text-sm font-bold flex-1 truncate" style="color: var(--text-primary)">{{
            selectedFile.name
          }}</span>
          <span class="text-[10px] text-slate-400">{{
            formatFileSize(selectedFile.size / (1024 * 1024))
          }}</span>
          <button
            type="button"
            class="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer"
            @click="removeFile"
          >
            <X class="w-3 h-3 text-slate-400" />
          </button>
        </div>
        <div class="max-w-4xl mx-auto relative">
          <!-- Toolbar -->
          <div class="flex items-center gap-1 mb-2 pl-2">
            <label
              class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all text-slate-400 hover:text-accent"
            >
              <ImageIcon class="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                @change="handleImageSelect"
              />
            </label>
            <label
              class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all text-slate-400 hover:text-accent"
            >
              <Paperclip class="w-4 h-4" />
              <input type="file" class="hidden" @change="handleFileSelect" />
            </label>
            <div class="relative">
              <button
                type="button"
                class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-400 hover:text-accent cursor-pointer"
                @click="showEmojiPicker = !showEmojiPicker"
              >
                <Smile class="w-4 h-4" />
              </button>
              <div
                v-if="showEmojiPicker"
                class="absolute bottom-full left-0 mb-2 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border flex flex-wrap gap-1 w-64 z-20 animate-fade-in"
                style="border-color: var(--border-base)"
              >
                <button
                  v-for="emoji in quickEmojis"
                  :key="emoji"
                  type="button"
                  class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-lg transition-all cursor-pointer"
                  @click="insertEmoji(emoji)"
                >
                  {{ emoji }}
                </button>
              </div>
            </div>
          </div>
          <textarea
            v-model="newComment"
            rows="1"
            class="w-full pl-6 pr-16 py-4 bg-slate-100 dark:bg-slate-900 border-none rounded-full text-sm outline-none focus:ring-4 focus:ring-accent/20 transition-all resize-none overflow-hidden"
            placeholder="输入消息，按 Enter 发送..."
            style="color: var(--text-primary)"
            @keydown.enter.prevent="handleSendComment"
            @input="
              (e) => {
                (e.target as HTMLElement).style.height = 'auto';
                (e.target as HTMLElement).style.height =
                  (e.target as HTMLElement).scrollHeight + 'px';
              }
            "
          ></textarea>
          <button
            type="button"
            :disabled="
              (!newComment.trim() && selectedImages.length === 0 && !selectedFile) ||
              isSendingComment
            "
            class="absolute right-2 bottom-2 p-2 bg-accent text-white rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
            @click="handleSendComment"
          >
            <Send class="w-5 h-5" />
          </button>
        </div>
      </div>
    </template>

    <div
      v-else
      class="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 dark:bg-slate-900/50"
    >
      <div
        class="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-8"
      >
        <AlignLeft class="w-10 h-10 text-slate-400" />
      </div>
      <h3 class="text-2xl font-black mb-3" style="color: var(--text-primary)">受保护的工作流</h3>
      <p class="text-sm text-slate-500 max-w-md mb-8 leading-relaxed">
        协作空间仅对项目正式成员开放。这里存放着最核心的讨论和进度档案。如果你想参与其中，请立即报名。
      </p>
      <button
        v-if="(props.project.members?.length || 0) < props.project.maxMembers"
        type="button"
        class="px-10 py-4 bg-accent text-white rounded-2xl font-black shadow-2xl shadow-accent/20 hover:scale-105 transition-all cursor-pointer"
        @click="emit('join')"
      >
        立即报名加入
      </button>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in {
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
