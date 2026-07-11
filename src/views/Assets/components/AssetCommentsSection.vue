<script setup lang="ts">
import { watch } from 'vue';
import { RefreshCw } from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import { useAuthStore } from '@/stores/auth';
import { useResourceComments } from '@/composables/useResourceComments'; /** * Inline discussions block for AssetDetailModal. Owns the comments composable * so the parent no longer has to thread comment state through; fetches whenever * the bound asset id changes. */
const props = defineProps<{ resourceId: string | undefined }>();
const label = useLabel();
const authStore = useAuthStore();
const {
  comments,
  isCommentsLoading,
  newCommentContent,
  isSubmittingComment,
  fetchComments,
  handlePostComment,
  handleDeleteComment,
  canDeleteComment,
} = useResourceComments('assets', () => props.resourceId);
watch(
  () => props.resourceId,
  (id) => {
    if (id) fetchComments();
  },
  { immediate: true },
);
</script>
<template>
  <div class="flex flex-col gap-4 pt-4 border-t border-white/10 text-left mt-6">
    <h3
      class="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-l-2 border-indigo-500 pl-2"
    >
      <span>{{ label('用户讨论与反馈', 'Discussions & Feedback') }}</span>
      <span
        class="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-[var(--text-muted)] font-mono"
        >{{ comments.length }}</span
      >
    </h3>
    <!-- Post Comment Form -->
    <div
      v-if="authStore.user"
      class="flex flex-col gap-2 bg-white/[0.01] border border-white/5 rounded-2xl p-4"
    >
      <textarea
        v-model="newCommentContent"
        :placeholder="label('发表您的想法和建议...', 'Post your thoughts and suggestions...')"
        class="w-full min-h-[80px] bg-white/[0.03] dark:bg-black/[0.1] border border-[var(--border-base)] rounded-xl p-3 text-xs text-[var(--text-primary)] focus:border-indigo-500 outline-none resize-none placeholder-[var(--text-muted)]"
      ></textarea>
      <div class="flex justify-end">
        <Button
          variant="primary"
          size="sm"
          :disabled="isSubmittingComment || !newCommentContent.trim()"
          @click="handlePostComment"
        >
          <span class="text-xs">{{
            isSubmittingComment
              ? label('发表中...', 'Posting...')
              : label('发表评论', 'Post Comment')
          }}</span>
        </Button>
      </div>
    </div>
    <div
      v-else
      class="text-center py-4 bg-white/[0.02] dark:bg-black/[0.05] rounded-xl border border-dashed border-[var(--border-base)]"
    >
      <p class="text-xs text-[var(--text-muted)]">
        {{ label('登录平台后即可发表评论', 'Login to post comments') }}
      </p>
    </div>
    <!-- Comments List -->
    <div v-if="isCommentsLoading" class="flex justify-center py-6">
      <RefreshCw class="w-6 h-6 animate-spin text-indigo-400" />
    </div>
    <div
      v-else-if="comments.length === 0"
      class="text-center py-6 text-[var(--text-muted)] text-xs bg-white/[0.01] border border-dashed border-white/5 rounded-2xl font-semibold"
    >
      {{ label('暂无评论，快来抢沙发吧！', 'No comments yet. Be the first to comment!') }}
    </div>
    <div v-else class="space-y-4 max-h-[300px] overflow-y-auto pr-1.5 custom-scrollbar">
      <div
        v-for="c in comments"
        :key="c.id"
        class="flex gap-3 pb-3 border-b border-[var(--border-base)]/50 last:border-0 last:pb-0"
      >
        <div
          class="h-8 w-8 rounded-full overflow-hidden border border-[var(--border-base)] bg-[var(--bg-card)] flex items-center justify-center shrink-0"
        >
          <img
            v-if="c.user?.avatarUrl"
            :src="getAssetUrl(c.user.avatarUrl)"
            class="h-full w-full object-cover"
          />
          <span v-else class="text-xs font-bold uppercase text-[var(--text-secondary)]">{{
            c.user?.name?.slice(0, 1) || 'U'
          }}</span>
        </div>
        <div class="flex-1 flex flex-col gap-1 min-w-0">
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold text-[var(--text-primary)] truncate">{{
              c.user?.name || '用户'
            }}</span>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-[var(--text-muted)]">{{
                new Date(c.createdAt).toLocaleString()
              }}</span>
              <button
                v-if="canDeleteComment(c)"
                class="text-[10px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer border-0 bg-transparent"
                @click="handleDeleteComment(c.id)"
              >
                {{ label('删除', 'Delete') }}
              </button>
            </div>
          </div>
          <p
            class="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words"
          >
            {{ c.content }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
