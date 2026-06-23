<script setup lang="ts">
import { ref, watch, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { Eye, Heart, MessageCircle } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import type { Discussion, DiscussionComment } from '../DiscussionsView.vue';
import Modal from '@/components/ui/Modal.vue';
import { parseTags, getTagClass } from '@/utils/tags';
import DiscussionDetailHeader from './DiscussionDetailHeader.vue';
import DiscussionCommentItem from './DiscussionCommentItem.vue';
import DiscussionCommentComposer from './DiscussionCommentComposer.vue';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

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

const { t } = useI18n();

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
const isSubmittingComment = ref(false);

const parseImages = (imagesStr: string | null | undefined): string[] => {
  try {
    const parsed = imagesStr ? JSON.parse(imagesStr) : [];
    return Array.isArray(parsed)
      ? parsed.filter((img): img is string => typeof img === 'string')
      : [];
  } catch {
    return [];
  }
};

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
  } catch {
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
  } catch {
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
  } catch {
    ElMessage.error(t('community.discussions.postFailed'));
  } finally {
    isSubmittingComment.value = false;
  }
};

const handleReplyComment = async (parentId: string, content: string) => {
  if (!localDiscussion.value || !content.trim()) return;
  try {
    const response = await api.post('/api/discussions/comments', {
      discussionId: localDiscussion.value.id,
      content: content.trim(),
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
    }
    localDiscussion.value._count.comments = (localDiscussion.value._count.comments || 0) + 1;
    localDiscussion.value.latestComment = response.data;
    localDiscussion.value.lastActivityAt = response.data.createdAt;
    ElMessage.success(t('community.discussions.postSuccess'));
    emit('refresh-parent');
  } catch {
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
  } catch {
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
</script>

<template>
  <Modal :show="true" size="xxl" glass-card padding="none" @close="emit('close')">
    <section class="detail-modal mobile-adaptive">
      <DiscussionDetailHeader
        :discussion="localDiscussion"
        :current-user-id="currentUserId"
        :is-admin="isAdmin"
        @close="emit('close')"
        @toggle-pin="handleTogglePin"
        @delete="handleDeleteDiscussion"
      />

      <div class="detail-grid">
        <article class="detail-content">
          <h2 class="truncate">{{ localDiscussion.title }}</h2>
          <div v-if="parseTags(localDiscussion.tags).length > 0" class="detail-tags">
            <button
              v-for="tagName in parseTags(localDiscussion.tags)"
              :key="tagName"
              type="button"
              :class="getTagClass(tagName)"
              @click="emit('setTag', tagName)"
            >
              #{{ tagName }}
            </button>
          </div>

          <div class="detail-stats mobile-row">
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
              <DiscussionCommentItem
                v-for="comment in localDiscussion.comments"
                :key="comment.id"
                :comment="comment"
                :current-user-id="currentUserId"
                :is-admin="isAdmin"
                @like="toggleLikeComment"
                @delete="deleteComment"
                @reply="handleReplyComment"
              />
            </div>
            <div v-else class="comments-empty">
              <MessageCircle class="h-8 w-8" />
              <span>{{ t('community.discussions.noRepliesYet') }}</span>
            </div>
          </div>

          <DiscussionCommentComposer
            v-model="newComment"
            :is-submitting="isSubmittingComment"
            @submit="handleAddComment"
          />
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

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  min-height: 0;
}

@media (max-width: 767px) {
  .detail-grid {
    grid-template-columns: 1fr !important;
  }
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
  padding: 12px;
  scrollbar-width: none;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.comments-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}
</style>
