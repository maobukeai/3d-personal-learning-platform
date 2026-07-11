<script setup lang="ts">
import { RefreshCw, Send, Trash2 } from 'lucide-vue-next';
import {
  formatCompactNumber as formatNumber,
  formatRelativeTime as formatTime,
} from '@/utils/format';
import { useAuthStore } from '@/stores/auth';
import type { ShowcaseItem } from './showcaseTypes';
import type { CommentItem } from './useShowcaseDetail';
const props = defineProps<{
  item: ShowcaseItem;
  comments: CommentItem[];
  commentsLoading: boolean;
  isSubmittingComment: boolean;
  currentUserId: string | undefined;
  isAdmin: boolean;
}>();
const emit = defineEmits<{ (e: 'submit'): void; (e: 'delete', comment: CommentItem): void }>();
const authStore = useAuthStore();
const newComment = defineModel<string>({ required: true });
const canDeleteComment = (comment: CommentItem) =>
  comment.user.id === props.currentUserId || props.isAdmin;
</script>
<template>
  <section class="comments-panel mt-6 pt-6 border-t border-white/5">
    <header class="flex items-center justify-between mb-4">
      <h2 class="text-xs font-black uppercase tracking-widest text-slate-400">作品交流讨论</h2>
      <span class="text-[10px] text-slate-500 font-mono"
        >{{ formatNumber(item.commentsCount) }} 条讨论</span
      >
    </header>
    <div class="comment-composer flex gap-3.5 items-center mb-4">
      <UserAvatar :user="authStore.user" size="sm" class="shrink-0" />
      <div class="relative flex-1">
        <input
          v-model="newComment"
          type="text"
          placeholder="写下反馈、提问或制作建议..."
          class="w-full pl-3 pr-10 py-2 text-xs rounded-xl border border-white/10 bg-white/[0.02] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-indigo-500 focus:bg-white/[0.04] outline-none transition-all"
          @keyup.enter="emit('submit')"
        />
        <button
          type="button"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed border-0 text-white cursor-pointer transition-colors"
          :disabled="isSubmittingComment || !newComment.trim()"
          title="发送评论"
          @click="emit('submit')"
        >
          <Send class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    <div v-if="commentsLoading" class="comments-empty py-8 text-center text-slate-500">
      <RefreshCw class="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" /> 正在加载评论
    </div>
    <div
      v-else-if="!comments.length"
      class="comments-empty py-8 text-center text-slate-500 text-xs italic"
    >
      还没有评论，来发表第一句吧。
    </div>
    <div v-else class="comment-list flex flex-col gap-3.5 max-h-[360px] overflow-y-auto pr-1">
      <article
        v-for="comment in comments"
        :key="comment.id"
        class="comment-item flex gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.01]"
      >
        <UserAvatar :user="comment.user" size="sm" class="shrink-0" />
        <div class="flex-1 min-w-0">
          <header class="flex items-center justify-between gap-4 mb-1">
            <strong class="text-xs font-bold text-[var(--text-primary)] truncate">{{
              comment.user.name || comment.user.email || '匿名用户'
            }}</strong>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[10px] text-slate-500 font-mono">{{
                formatTime(comment.createdAt)
              }}</span>
              <button
                v-if="canDeleteComment(comment)"
                type="button"
                class="p-1 rounded bg-transparent hover:bg-red-500/10 text-slate-500 hover:text-red-400 border-0 transition-colors cursor-pointer flex items-center justify-center"
                title="删除评论"
                @click="emit('delete', comment)"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </header>
          <p class="text-xs text-[var(--text-secondary)] leading-relaxed">{{ comment.content }}</p>
        </div>
      </article>
    </div>
  </section>
</template>
<style scoped>
.comment-list::-webkit-scrollbar {
  width: 4px;
}
.comment-list::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 4px;
}
</style>
