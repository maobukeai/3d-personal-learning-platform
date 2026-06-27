<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDown, ChevronUp, Heart, MessageSquare, Send, Trash2 } from 'lucide-vue-next';
import { formatRelativeTime as formatTime } from '@/utils/format';
import type { DiscussionComment } from '../DiscussionsView.vue';

const props = defineProps<{
  comment: DiscussionComment;
  currentUserId: string | undefined;
  isAdmin: boolean;
}>();

const emit = defineEmits<{
  (e: 'like', comment: DiscussionComment): void;
  (e: 'delete', comment: DiscussionComment, parentComment?: DiscussionComment): void;
  (e: 'reply', parentId: string, content: string): void;
}>();

const { t } = useI18n();

const replyingTo = ref(false);
const replyContent = ref('');
const expandedReplies = ref(true);

const startReply = () => {
  replyingTo.value = true;
};

const cancelReply = () => {
  replyingTo.value = false;
  replyContent.value = '';
};

const submitReply = () => {
  const content = replyContent.value.trim();
  if (!content) return;
  emit('reply', props.comment.id, content);
  replyingTo.value = false;
  replyContent.value = '';
  expandedReplies.value = true;
};

const toggleReplies = () => {
  expandedReplies.value = !expandedReplies.value;
};

const canDelete = (item: DiscussionComment) =>
  props.currentUserId === item.user?.id || props.isAdmin;
</script>

<template>
  <div class="comment-item mobile-adaptive group/comment">
    <div class="comment-body">
      <div class="comment-bubble">
        <div>
          <strong>{{ comment.user?.name || t('community.discussions.anonymous') }}</strong>
          <span>{{ formatTime(comment.createdAt) }}</span>
        </div>
        <p>{{ comment.content }}</p>
      </div>

      <div class="comment-actions mobile-row">
        <button
          type="button"
          :class="{ 'is-liked': comment.isLiked }"
          @click="emit('like', comment)"
        >
          <Heart class="h-3 w-3" :class="{ 'fill-current': comment.isLiked }" />
          {{ comment._count?.likes || 0 }}
        </button>
        <button type="button" @click="startReply">
          <MessageSquare class="h-3 w-3" />
          {{ t('common.reply') }}
        </button>
        <button
          v-if="canDelete(comment)"
          type="button"
          class="danger opacity-0 group-hover/comment:opacity-100 transition-opacity duration-200"
          @click="emit('delete', comment)"
        >
          <Trash2 class="h-3 w-3" />
          {{ t('common.delete') }}
        </button>
      </div>

      <div v-if="replyingTo" class="reply-box">
        <textarea
          v-model="replyContent"
          rows="2"
          :placeholder="
            t('community.discussions.replyTo', {
              name: comment.user?.name || t('community.discussions.anonymous'),
            })
          "
        ></textarea>
        <div class="mobile-row">
          <button type="button" @click="cancelReply">
            {{ t('common.cancel') }}
          </button>
          <button type="button" :disabled="!replyContent.trim()" @click="submitReply">
            <Send class="h-3 w-3" />
            {{ t('common.reply') }}
          </button>
        </div>
      </div>

      <button
        v-if="comment._count?.replies"
        type="button"
        class="reply-toggle"
        @click="toggleReplies"
      >
        <ChevronUp v-if="expandedReplies" class="h-3 w-3" />
        <ChevronDown v-else class="h-3 w-3" />
        {{
          expandedReplies
              ? t('community.discussions.collapseReplies')
              : t('community.discussions.showRepliesCount', { count: comment._count.replies })
        }}
      </button>

      <div v-if="expandedReplies && comment.replies?.length" class="reply-list">
        <div v-for="reply in comment.replies" :key="reply.id" class="reply-item group/reply">
          <div class="flex-1 min-w-0">
            <div class="comment-bubble">
              <div>
                <strong>{{ reply.user?.name || t('community.discussions.anonymous') }}</strong>
                <span>{{ formatTime(reply.createdAt) }}</span>
              </div>
              <p>{{ reply.content }}</p>
            </div>
            <div class="comment-actions mobile-row">
              <button
                type="button"
                :class="{ 'is-liked': reply.isLiked }"
                @click="emit('like', reply)"
              >
                <Heart class="h-3 w-3" :class="{ 'fill-current': reply.isLiked }" />
                {{ reply._count?.likes || 0 }}
              </button>
              <button
                v-if="canDelete(reply)"
                type="button"
                class="danger opacity-0 group-hover/reply:opacity-100 transition-opacity duration-200"
                @click="emit('delete', reply, comment)"
              >
                <Trash2 class="h-3 w-3" />
                {{ t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comment-item {
  display: flex;
  gap: 10px;
}

.comment-body {
  flex: 1;
  min-width: 0;
}

.comment-bubble {
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 12px;
  padding: 10px 12px;
  min-width: 0;
}

.comment-bubble div {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.comment-bubble strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 950;
}

.comment-bubble span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 750;
}

.comment-bubble p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  word-break: break-word;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.comment-actions button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;
}

.comment-actions button:hover {
  background: var(--bg-app);
}

.comment-actions button.is-liked {
  color: #ef4444;
}

.comment-actions button.danger {
  color: #ef4444;
}

.reply-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.reply-toggle:hover {
  background: var(--bg-card);
}

.reply-box {
  margin-top: 8px;
}

.reply-box textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-app);
  color: var(--text-primary);
  font-size: 12px;
  resize: vertical;
  outline: none;
}

.reply-box textarea:focus {
  border-color: var(--accent);
}

.reply-box div {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.reply-box button {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.reply-box button:first-child {
  color: var(--text-muted);
}

.reply-box button:last-child {
  background: var(--accent);
  color: #fff;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.reply-box button:last-child:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reply-list {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reply-item {
  display: flex;
  gap: 10px;
}
</style>
