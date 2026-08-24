<script setup lang="ts">
import { ref } from 'vue';
import { MessageSquare, Loader2, Trash2, Send, Sparkles, UserCheck } from 'lucide-vue-next';
import { formatDateTime as formatDate } from '@/utils/format';
import { getAssetUrl } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';

export interface MirrorComment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    avatarUrl?: string | null;
  } | null;
}

const props = defineProps<{
  comments: MirrorComment[];
  isSubmitting: boolean;
}>();

const emit = defineEmits<{
  (e: 'submit', content: string): void;
  (e: 'delete', commentId: string): void;
}>();

const authStore = useAuthStore();
const newCommentText = ref('');

function handleSubmit() {
  if (!newCommentText.value.trim() || props.isSubmitting) return;
  emit('submit', newCommentText.value.trim());
  newCommentText.value = '';
}
</script>

<template>
  <div
    class="bg-white/80 dark:bg-slate-800/70 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 p-5 backdrop-blur-md shadow-xs space-y-4"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3.5"
    >
      <div class="flex items-center gap-2.5">
        <span class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-inner">
          <MessageSquare class="w-4 h-4" />
        </span>
        <div>
          <h3 class="text-sm font-black text-slate-900 dark:text-white tracking-tight">
            讨论区 ({{ comments.length }})
          </h3>
          <p class="text-[10px] text-slate-400">学习交流与问题反馈</p>
        </div>
      </div>

      <span
        class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20"
      >
        实时互动
      </span>
    </div>

    <!-- Write Comment Box -->
    <div class="space-y-2.5">
      <div class="relative group">
        <textarea
          v-model="newCommentText"
          placeholder="写下你的心得或问题，与大家一起讨论..."
          rows="3"
          class="w-full text-xs md:text-sm p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none shadow-inner"
          @keydown.enter.ctrl="handleSubmit"
        ></textarea>
      </div>

      <div class="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
        <span
          >按
          <kbd
            class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[10px] text-slate-600 dark:text-slate-300"
            >Ctrl + Enter</kbd
          >
          快速发送</span
        >
        <button
          type="button"
          :disabled="isSubmitting || !newCommentText.trim()"
          class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer active:scale-98"
          @click="handleSubmit"
        >
          <Loader2 v-if="isSubmitting" class="w-3.5 h-3.5 animate-spin" />
          <Send v-else class="w-3.5 h-3.5" />
          <span>发表评论</span>
        </button>
      </div>
    </div>

    <!-- Comments List with Scroll Area -->
    <div class="pt-2">
      <div
        v-if="comments.length === 0"
        class="flex flex-col items-center justify-center py-8 px-4 bg-slate-50/60 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-1.5"
      >
        <span class="p-2.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 mb-1">
          <Sparkles class="w-4 h-4" />
        </span>
        <p class="text-xs font-bold text-slate-700 dark:text-slate-300">暂无讨论内容</p>
        <p class="text-[11px] text-slate-400">提出疑问或分享学习心得，快来抢首条评论吧~</p>
      </div>

      <div v-else class="space-y-3 max-h-[440px] overflow-y-auto pr-1 scrollbar-hide">
        <div
          v-for="comment in comments"
          :key="comment.id"
          class="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 flex gap-3 group transition-colors hover:border-slate-200 dark:hover:border-slate-700"
        >
          <!-- User Avatar with Glow -->
          <div
            class="w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 shrink-0 mt-0.5 shadow-sm ring-2 ring-white dark:ring-slate-800"
          >
            <img
              v-if="comment.user?.avatarUrl"
              :src="getAssetUrl(comment.user.avatarUrl)"
              alt=""
              class="w-full h-full object-cover"
            />
            <div
              v-else
              class="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-black"
            >
              {{ comment.user?.name?.[0]?.toUpperCase() || 'U' }}
            </div>
          </div>

          <!-- Comment Content Bubble -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                  {{ comment.user?.name || '平台学习者' }}
                </span>
                <span
                  v-if="comment.userId === authStore.user?.id"
                  class="px-1.5 py-0.2 rounded-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black"
                >
                  我
                </span>
              </div>
              <span class="text-[10px] text-slate-400 shrink-0 ml-2">
                {{ formatDate(comment.createdAt) }}
              </span>
            </div>

            <p
              class="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed"
            >
              {{ comment.content }}
            </p>

            <div
              v-if="comment.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'"
              class="flex justify-end mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <button
                type="button"
                class="text-[10px] text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-0.5 font-bold cursor-pointer"
                @click="emit('delete', comment.id)"
              >
                <Trash2 class="w-3 h-3" />
                <span>删除</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
