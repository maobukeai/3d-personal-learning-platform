<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import { MessageSquare, Trash2, X, Send } from 'lucide-vue-next';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}
import { parseCommentContent } from './helpers';

const props = defineProps<{
  taskId: string | undefined;
}>();

const emit = defineEmits<{
  (e: 'comments-changed'): void;
  (e: 'image-click', url: string): void;
}>();

const authStore = useAuthStore();
const comments = ref<TaskComment[]>([]);
const newCommentText = ref('');
const isCommentsLoading = ref(false);
const tempUploadedImages = ref<string[]>([]);

const fetchComments = async () => {
  if (!props.taskId) {
    comments.value = [];
    return;
  }
  isCommentsLoading.value = true;
  try {
    const response = await api.get(`/api/tasks/${props.taskId}/comments`);
    comments.value = response.data;
  } catch {
    ElMessage.error('获取评论失败');
  } finally {
    isCommentsLoading.value = false;
  }
};

const handleAddComment = async () => {
  const content = newCommentText.value.trim();
  if (!content && tempUploadedImages.value.length === 0) return;
  if (!props.taskId) return;
  try {
    let finalContent = content;
    if (tempUploadedImages.value.length > 0) {
      finalContent += '\n' + tempUploadedImages.value.map((url) => `![图片](${url})`).join('\n');
    }
    const response = await api.post(`/api/tasks/${props.taskId}/comments`, {
      content: finalContent,
    });
    comments.value.push(response.data);
    newCommentText.value = '';
    tempUploadedImages.value = [];
    ElMessage.success('发表评论成功');
    emit('comments-changed');
  } catch {
    ElMessage.error('发表评论失败');
  }
};

const handleDeleteComment = async (commentId: string) => {
  if (!props.taskId) return;
  try {
    await api.delete(`/api/tasks/${props.taskId}/comments/${commentId}`);
    comments.value = comments.value.filter((c) => c.id !== commentId);
    ElMessage.success('评论删除成功');
    emit('comments-changed');
  } catch {
    ElMessage.error('删除评论失败');
  }
};

const handlePasteComment = async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  let hasImage = false;
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      hasImage = true;
      break;
    }
  }

  if (hasImage) {
    event.preventDefault();
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (!file) continue;

        const formData = new FormData();
        formData.append('task_image', file);
        try {
          ElMessage.info('图片上传中...');
          const response = await api.post('/api/tasks/upload-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const imageUrl = response.data.url;
          tempUploadedImages.value.push(imageUrl);
          ElMessage.success('图片上传成功');
        } catch {
          ElMessage.error('图片上传失败');
        }
      }
    }
  } else {
    // Check if user pasted a Markdown image URL directly
    const pastedText = event.clipboardData.getData('text');
    const imageReg = /!\[.*?\]\((.*?)\)/;
    const match = imageReg.exec(pastedText);
    if (match && match[1]) {
      event.preventDefault();
      tempUploadedImages.value.push(match[1].trim());
      ElMessage.success('图片链接已识别');
    }
  }
};

watch(
  // Watch taskId to load comments
  () => props.taskId,
  (newId) => {
    if (newId) {
      fetchComments();
    } else {
      comments.value = [];
    }
  },
  { immediate: true },
);

defineExpose({
  refresh: fetchComments,
});
</script>

<template>
  <div class="pt-6 border-t" style="border-color: var(--border-base)">
    <div class="flex items-center gap-2 mb-4">
      <MessageSquare class="w-4 h-4 text-accent" />
      <h3 class="text-sm font-bold" style="color: var(--text-primary)">评论讨论区</h3>
      <span v-if="comments.length > 0" class="text-xs text-slate-400 font-bold">
        ({{ comments.length }})
      </span>
    </div>

    <!-- Comment List -->
    <div class="space-y-4 mb-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
      <div v-if="isCommentsLoading" class="text-center py-4 text-xs text-slate-400">
        加载评论中...
      </div>
      <div
        v-else-if="comments.length === 0"
        class="text-center py-4 text-xs text-slate-400 dark:text-slate-500"
      >
        暂无讨论，发表第一条评论吧！
      </div>
      <div
        v-for="comment in comments"
        v-else
        :key="comment.id"
        class="flex gap-3 group/comment p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <!-- Avatar -->
        <div class="shrink-0">
          <img
            v-if="comment.user?.avatarUrl"
            :src="comment.user.avatarUrl"
            class="w-7 h-7 rounded-full object-cover"
            alt=""
          />
          <div
            v-else
            class="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xs"
          >
            {{ comment.user?.name?.[0] || 'U' }}
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-xs font-bold" style="color: var(--text-primary)">
              {{ comment.user?.name || '未知用户' }}
            </span>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-slate-400">
                {{ new Date(comment.createdAt).toLocaleString() }}
              </span>
              <!-- Delete Action -->
              <button
                v-if="comment.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'"
                type="button"
                class="opacity-0 group-hover/comment:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 rounded transition-opacity"
                @click="handleDeleteComment(comment.id)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div class="space-y-1.5">
            <p
              v-if="parseCommentContent(comment.content).text"
              class="text-xs whitespace-pre-wrap leading-relaxed text-slate-600 dark:text-slate-300"
            >
              {{ parseCommentContent(comment.content).text }}
            </p>
            <div
              v-if="parseCommentContent(comment.content).images.length > 0"
              class="flex flex-wrap gap-2 pt-1"
            >
              <img
                v-for="img in parseCommentContent(comment.content).images"
                :key="img"
                :src="img"
                class="max-w-[200px] max-h-[150px] rounded-lg border object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                style="border-color: var(--border-base)"
                @click="emit('image-click', img)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Comment Input -->
    <div class="space-y-2">
      <!-- Pasted Image Preview List -->
      <div
        v-if="tempUploadedImages.length > 0"
        class="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl"
      >
        <div
          v-for="(url, idx) in tempUploadedImages"
          :key="url"
          class="relative group w-16 h-16 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          <img :src="url" class="w-full h-full object-cover" />
          <button
            type="button"
            class="absolute top-1 right-1 p-0.5 bg-black/55 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer flex items-center justify-center"
            @click="tempUploadedImages.splice(idx, 1)"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div class="flex gap-2 items-end">
        <textarea
          v-model="newCommentText"
          rows="2"
          placeholder="输入评论或反馈，按 Enter 发送... (支持粘贴图片)"
          class="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-accent/40 focus:border-solid transition-all resize-none"
          style="color: var(--text-primary)"
          @keyup.enter.exact.prevent="handleAddComment"
          @paste="handlePasteComment"
        ></textarea>
        <button
          type="button"
          class="p-2.5 bg-accent hover:opacity-85 text-white rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer"
          @click="handleAddComment"
        >
          <Send class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
