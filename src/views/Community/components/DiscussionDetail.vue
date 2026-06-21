<script setup lang="ts">
import { formatRelativeTime as formatTime } from '@/utils/format';
import { ref, watch, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Heart,
  LoaderCircle,
  MessageCircle,
  MessageSquare,
  Pin,
  Send,
  Trash2,
  X,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));
import UserAvatar from '@/components/UserAvatar.vue';
import type { Discussion, DiscussionComment } from '../DiscussionsView.vue';
import Modal from '@/components/ui/Modal.vue';
import { parseTags } from '@/utils/tags';

const props = defineProps<{
  discussion: Discussion;
  currentUserId: string | undefined;
  isAdmin: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'setTag', tagName: string): void;
  (e: 'refresh-parent'): void;
}>();

const authStore = useAuthStore();
const { t, locale } = useI18n();

const localDiscussion = ref<Discussion>({ ...props.discussion });
watch(
  () => props.discussion,
  (newVal) => {
    if (newVal) {
      localDiscussion.value = newVal;
    }
  },
  { immediate: true },
);

const newComment = ref('');
const replyingTo = ref<DiscussionComment | null>(null);
const replyContent = ref('');
const isSubmittingComment = ref(false);
const expandedReplies = ref<Set<string>>(new Set());

// Initialize expanded replies
watch(
  () => localDiscussion.value,
  (newDiscussion) => {
    if (newDiscussion?.comments) {
      expandedReplies.value = new Set(
        newDiscussion.comments
          .filter((comment) => comment.replies && comment.replies.length > 0)
          .map((comment) => comment.id),
      );
    }
  },
  { immediate: true },
);

const parseImages = (imagesStr: string | null | undefined): string[] => {
  try {
    const parsed = imagesStr ? JSON.parse(imagesStr) : [];
    return Array.isArray(parsed)
      ? parsed.filter((img): img is string => typeof img === 'string')
      : [];
  } catch (_e) {
    return [];
  }
};

// Actions
const handleTogglePin = async () => {
  try {
    await api.post(`/api/discussions/${localDiscussion.value.id}/pin`);
    localDiscussion.value.isPinned = !localDiscussion.value.isPinned;
    ElMessage.success(
      localDiscussion.value.isPinned
        ? t('community.discussions.pinSuccess')
        : t('community.discussions.unpinSuccess'),
    );
    emit('refresh-parent');
  } catch (_error) {
    ElMessage.error(t('community.discussions.likeFailed'));
  }
};

const handleDeleteDiscussion = async () => {
  try {
    await ElMessageBox.confirm(
      t('community.discussions.deletePostConfirm'),
      t('common.confirmDelete'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      },
    );
    await api.delete(`/api/discussions/${localDiscussion.value.id}`);
    ElMessage.success(t('community.discussions.deleteSuccess'));
    emit('close');
    emit('refresh-parent');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('community.discussions.deleteFailed'));
    }
  }
};

const handleToggleLike = async () => {
  try {
    const response = await api.post(`/api/discussions/${localDiscussion.value.id}/like`);
    const wasLiked = Boolean(localDiscussion.value.isLiked);
    localDiscussion.value.isLiked = response.data.isLiked;
    if (!localDiscussion.value._count) {
      localDiscussion.value._count = { likes: 0, comments: 0 };
    }
    localDiscussion.value._count.likes = Math.max(
      0,
      (localDiscussion.value._count.likes || 0) + (response.data.isLiked ? 1 : wasLiked ? -1 : 0),
    );
    emit('refresh-parent');
  } catch (_error) {
    ElMessage.error(t('community.discussions.likeFailed'));
  }
};

const handleAddComment = async () => {
  if (!localDiscussion.value || !newComment.value.trim()) return;
  isSubmittingComment.value = true;
  try {
    const response = await api.post('/api/discussions/comments', {
      discussionId: localDiscussion.value.id,
      content: newComment.value.trim(),
    });
    if (!localDiscussion.value.comments) localDiscussion.value.comments = [];
    localDiscussion.value.comments.push(response.data);
    localDiscussion.value._count.comments = (localDiscussion.value._count.comments || 0) + 1;
    localDiscussion.value.latestComment = response.data;
    localDiscussion.value.lastActivityAt = response.data.createdAt;
    newComment.value = '';
    ElMessage.success(t('community.discussions.postSuccess'));
    emit('refresh-parent');
  } catch (_error) {
    ElMessage.error(t('community.discussions.postFailed'));
  } finally {
    isSubmittingComment.value = false;
  }
};

const handleReplyComment = async (parentId: string) => {
  if (!localDiscussion.value || !replyContent.value.trim()) return;
  try {
    const response = await api.post('/api/discussions/comments', {
      discussionId: localDiscussion.value.id,
      content: replyContent.value.trim(),
      parentId,
    });
    const parentComment = localDiscussion.value.comments?.find(
      (comment) => comment.id === parentId,
    );
    if (parentComment) {
      if (!parentComment.replies) parentComment.replies = [];
      parentComment.replies.push(response.data);
      parentComment._count = {
        ...parentComment._count,
        replies: (parentComment._count?.replies || 0) + 1,
      };
      expandedReplies.value = new Set([...expandedReplies.value, parentId]);
    }
    localDiscussion.value._count.comments = (localDiscussion.value._count.comments || 0) + 1;
    localDiscussion.value.latestComment = response.data;
    localDiscussion.value.lastActivityAt = response.data.createdAt;
    replyContent.value = '';
    replyingTo.value = null;
    ElMessage.success(t('community.discussions.postSuccess'));
    emit('refresh-parent');
  } catch (_error) {
    ElMessage.error(t('community.discussions.postFailed'));
  }
};

const toggleLikeComment = async (comment: DiscussionComment) => {
  try {
    const response = await api.post(`/api/discussions/comments/${comment.id}/like`);
    const wasLiked = Boolean(comment.isLiked);
    comment.isLiked = response.data.isLiked;
    comment._count.likes = Math.max(
      0,
      (comment._count?.likes || 0) + (response.data.isLiked ? 1 : wasLiked ? -1 : 0),
    );
  } catch (_error) {
    ElMessage.error(t('community.discussions.likeFailed'));
  }
};

const deleteComment = async (comment: DiscussionComment, parentComment?: DiscussionComment) => {
  try {
    await ElMessageBox.confirm(
      t('community.discussions.deleteCommentConfirm'),
      t('common.confirmDelete'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      },
    );
    await api.delete(`/api/discussions/comments/${comment.id}`);
    if (parentComment) {
      parentComment.replies = (parentComment.replies || []).filter(
        (reply) => reply.id !== comment.id,
      );
      parentComment._count = {
        ...parentComment._count,
        replies: Math.max(0, (parentComment._count?.replies || 1) - 1),
      };
    } else if (localDiscussion.value?.comments) {
      localDiscussion.value.comments = localDiscussion.value.comments.filter(
        (item) => item.id !== comment.id,
      );
    }
    if (localDiscussion.value) {
      localDiscussion.value._count.comments = Math.max(
        0,
        (localDiscussion.value._count.comments || 1) - 1,
      );
    }
    ElMessage.success(t('community.discussions.deleteSuccess'));
    emit('refresh-parent');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('community.discussions.deleteFailed'));
    }
  }
};

const toggleReplies = (commentId: string) => {
  const next = new Set(expandedReplies.value);
  if (next.has(commentId)) {
    next.delete(commentId);
  } else {
    next.add(commentId);
  }
  expandedReplies.value = next;
};
</script>

<template>
  <Modal
    :show="true"
    size="xxl"
    glass-card
    padding="none"
    @close="emit('close')"
  >
    <section class="detail-modal">
      <header class="detail-header">
        <div class="detail-author">
          <UserAvatar :user="localDiscussion.user" size="sm" />
          <div>
            <strong>{{
              localDiscussion.user?.name || t('community.discussions.anonymous')
            }}</strong>
            <span>{{ formatTime(localDiscussion.createdAt) }}</span>
          </div>
          <i v-if="localDiscussion.isPinned">
            <Pin class="h-3 w-3" />
            {{ t('community.discussions.pinned') }}
          </i>
        </div>
        <div class="modal-actions">
          <button
            v-if="isAdmin"
            type="button"
            :class="{ 'is-active': localDiscussion.isPinned }"
            @click="handleTogglePin"
          >
            <Pin class="h-4 w-4" />
          </button>
          <button
            v-if="currentUserId === localDiscussion.user?.id || isAdmin"
            type="button"
            class="danger"
            @click="handleDeleteDiscussion"
          >
            <Trash2 class="h-4 w-4" />
          </button>
          <button type="button" @click="emit('close')">
            <X class="h-4 w-4" />
          </button>
        </div>
      </header>

      <div class="detail-grid">
        <article class="detail-content">
          <h2>{{ localDiscussion.title }}</h2>
          <div v-if="parseTags(localDiscussion.tags).length > 0" class="detail-tags">
            <button
              v-for="tagName in parseTags(localDiscussion.tags)"
              :key="tagName"
              type="button"
              @click="emit('setTag', tagName)"
            >
              #{{ tagName }}
            </button>
          </div>

          <div class="detail-stats">
            <button
              type="button"
              :class="{ 'is-liked': localDiscussion.isLiked }"
              @click="handleToggleLike"
            >
              <Heart class="h-4 w-4" :class="{ 'fill-current': localDiscussion.isLiked }" />
              {{ localDiscussion._count?.likes || 0 }}
            </button>
            <span>
              <MessageSquare class="h-4 w-4" />
              {{ localDiscussion._count?.comments || 0 }}
            </span>
            <span>
              <Eye class="h-4 w-4" />
              {{ localDiscussion.viewCount || 0 }}
            </span>
          </div>

          <MarkdownEditor
            class="discussion-preview"
            :model-value="localDiscussion.content"
            preview-only
          />

          <div v-if="parseImages(localDiscussion.images).length > 0" class="detail-images">
            <img
              v-for="(image, index) in parseImages(localDiscussion.images)"
              :key="`${image}-${index}`"
              :src="getAssetUrl(image)"
              alt=""
            />
          </div>
        </article>

        <aside class="detail-comments">
          <div class="comments-title">
            <h3>
              {{
                t('community.discussions.allComments', {
                  count: localDiscussion.comments?.length || 0,
                })
              }}
            </h3>
          </div>

          <div class="comments-scroll">
            <div v-if="localDiscussion.comments?.length" class="comment-list">
              <div
                v-for="comment in localDiscussion.comments"
                :key="comment.id"
                class="comment-item"
              >
                <UserAvatar :user="comment.user" size="xs" />
                <div class="comment-body">
                  <div class="comment-bubble">
                    <div>
                      <strong>{{
                        comment.user?.name || t('community.discussions.anonymous')
                      }}</strong>
                      <span>{{ formatTime(comment.createdAt) }}</span>
                    </div>
                    <p>{{ comment.content }}</p>
                  </div>

                  <div class="comment-actions">
                    <button
                      type="button"
                      :class="{ 'is-liked': comment.isLiked }"
                      @click="toggleLikeComment(comment)"
                    >
                      <Heart class="h-3 w-3" :class="{ 'fill-current': comment.isLiked }" />
                      {{ comment._count?.likes || 0 }}
                    </button>
                    <button
                      type="button"
                      @click="
                        replyingTo = replyingTo?.id === comment.id ? null : comment;
                        replyContent = '';
                      "
                    >
                      <MessageSquare class="h-3 w-3" />
                      {{ t('common.reply') }}
                    </button>
                    <button
                      v-if="currentUserId === comment.user?.id || isAdmin"
                      type="button"
                      class="danger"
                      @click="deleteComment(comment)"
                    >
                      <Trash2 class="h-3 w-3" />
                      {{ t('common.delete') }}
                    </button>
                  </div>

                  <div v-if="replyingTo?.id === comment.id" class="reply-box">
                    <textarea
                      v-model="replyContent"
                      rows="2"
                      :placeholder="
                        t('community.discussions.replyTo', {
                          name: comment.user?.name || t('community.discussions.anonymous'),
                        })
                      "
                    ></textarea>
                    <div>
                      <button type="button" @click="replyingTo = null">
                        {{ t('common.cancel') }}
                      </button>
                      <button
                        type="button"
                        :disabled="!replyContent.trim()"
                        @click="handleReplyComment(comment.id)"
                      >
                        <Send class="h-3 w-3" />
                        {{ t('common.reply') }}
                      </button>
                    </div>
                  </div>

                  <button
                    v-if="comment._count?.replies"
                    type="button"
                    class="reply-toggle"
                    @click="toggleReplies(comment.id)"
                  >
                    <ChevronUp v-if="expandedReplies.has(comment.id)" class="h-3 w-3" />
                    <ChevronDown v-else class="h-3 w-3" />
                    {{
                      expandedReplies.has(comment.id)
                        ? t('community.discussions.collapseReplies')
                        : t('community.discussions.showRepliesCount', {
                            count: comment._count.replies,
                          })
                    }}
                  </button>

                  <div
                    v-if="expandedReplies.has(comment.id) && comment.replies?.length"
                    class="reply-list"
                  >
                    <div v-for="reply in comment.replies" :key="reply.id" class="reply-item">
                      <UserAvatar :user="reply.user" size="xs" />
                      <div>
                        <div class="comment-bubble">
                          <div>
                            <strong>{{
                              reply.user?.name || t('community.discussions.anonymous')
                            }}</strong>
                            <span>{{ formatTime(reply.createdAt) }}</span>
                          </div>
                          <p>{{ reply.content }}</p>
                        </div>
                        <div class="comment-actions">
                          <button
                            type="button"
                            :class="{ 'is-liked': reply.isLiked }"
                            @click="toggleLikeComment(reply)"
                          >
                            <Heart class="h-3 w-3" :class="{ 'fill-current': reply.isLiked }" />
                            {{ reply._count?.likes || 0 }}
                          </button>
                          <button
                            v-if="currentUserId === reply.user?.id || isAdmin"
                            type="button"
                            class="danger"
                            @click="deleteComment(reply, comment)"
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
            </div>
            <div v-else class="comments-empty">
              <MessageCircle class="h-8 w-8" />
              <span>{{ t('community.discussions.noRepliesYet') }}</span>
            </div>
          </div>

          <div class="comment-composer">
            <UserAvatar :user="authStore.user" size="sm" />
            <div>
              <textarea
                v-model="newComment"
                rows="3"
                :placeholder="t('community.discussions.commentPlaceholder')"
              ></textarea>
              <button
                type="button"
                :disabled="!newComment.trim() || isSubmittingComment"
                @click="handleAddComment"
              >
                <LoaderCircle v-if="isSubmittingComment" class="h-3.5 w-3.5 animate-spin" />
                <Send v-else class="h-3.5 w-3.5" />
                {{ t('community.discussions.postComment') }}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </section>
  </Modal>
</template>

<style scoped>
.detail-modal {
  position: relative;
  display: flex;
  width: 100%;
  max-height: min(92vh, 860px);
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-base);
}

.detail-author {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.detail-author strong {
  display: block;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 950;
}

.detail-author span {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 750;
}

.detail-author i {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 7px;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-style: normal;
  font-weight: 850;
}

.modal-actions {
  display: flex;
  gap: 6px;
}

.modal-actions button {
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.modal-actions button.is-active {
  border-color: var(--accent);
  color: var(--accent);
}

.modal-actions button.danger,
.comment-actions button.danger {
  color: #ef4444;
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  min-height: 0;
}

.detail-content,
.detail-comments {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.detail-content::-webkit-scrollbar,
.detail-comments::-webkit-scrollbar,
.comments-scroll::-webkit-scrollbar {
  display: none;
}

.detail-content {
  padding: 18px;
}

.detail-content h2 {
  margin: 0 0 10px;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 950;
  line-height: 1.35;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 12px;
}

.detail-tags button {
  height: 24px;
  padding: 0 9px;
  border-radius: 7px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 850;
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  cursor: pointer;
}

.detail-stats {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-base);
}

.detail-stats button,
.detail-stats span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 850;
}

.detail-stats button {
  cursor: pointer;
}

.detail-stats button.is-liked {
  color: #ef4444;
}

.discussion-preview {
  color: var(--text-primary);
}

.detail-images {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.detail-images img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  border: 1px solid var(--border-base);
  border-radius: 8px;
}

.detail-comments {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border-base);
  background: color-mix(in srgb, var(--bg-app) 72%, var(--bg-card));
}

.comments-title {
  padding: 13px;
  border-bottom: 1px solid var(--border-base);
}

.comments-title h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 950;
}

.comments-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 13px;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.comment-item,
.reply-item,
.comment-composer {
  display: flex;
  gap: 9px;
}

.comment-body {
  min-width: 0;
  flex: 1;
}

.comment-bubble {
  padding: 9px 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.comment-bubble > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 5px;
}

.comment-bubble strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 900;
}

.comment-bubble span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
}

.comment-bubble p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.comment-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 6px 0 0 4px;
}

.comment-actions button,
.reply-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10.5px;
  font-weight: 800;
}

.comment-actions button.is-liked {
  color: #ef4444;
}

.reply-box {
  margin-top: 8px;
}

.reply-box textarea,
.comment-composer textarea {
  width: 100%;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  outline: 0;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 12px;
  resize: vertical;
  min-height: 58px;
  padding: 9px;
  line-height: 1.55;
}

.reply-box > div {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 7px;
}

.reply-box button,
.comment-composer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 7px;
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;
}

.reply-box button:last-child,
.comment-composer button {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.comments-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--text-muted);
}

.reply-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
  padding-left: 14px;
  border-left: 2px solid var(--border-base);
}

.reply-item {
  display: flex;
  gap: 8px;
}

.reply-item > div {
  flex: 1;
  min-width: 0;
}
</style>
