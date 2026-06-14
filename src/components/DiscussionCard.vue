<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Eye, Heart, MessageSquare, Pin, Sparkles, Tag, Trash2 } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { getAssetUrl } from '@/utils/api';
import type { User } from '@/types';

interface DiscussionCardUser extends Pick<User, 'id' | 'name' | 'avatarUrl'> {
  email?: string | null;
}

interface DiscussionCardComment {
  id: string;
  content: string;
  createdAt: string;
  user: DiscussionCardUser;
  parentId?: string | null;
  replies: DiscussionCardComment[];
  isLiked?: boolean;
  _count: {
    likes: number;
    comments?: number;
    replies?: number;
  };
}

interface DiscussionCardItem {
  id: string;
  title: string;
  content: string;
  tags: string | null;
  images: string | null;
  isPinned?: boolean;
  isLiked?: boolean;
  viewCount?: number;
  createdAt: string;
  lastActivityAt?: string;
  latestComment?: DiscussionCardComment | null;
  user: DiscussionCardUser;
  comments?: DiscussionCardComment[];
  _count: {
    likes: number;
    comments: number;
    replies?: number;
  };
}

const props = withDefaults(
  defineProps<{
    discussion: DiscussionCardItem;
    currentUserId?: string;
    isAdmin?: boolean;
  }>(),
  {
    currentUserId: '',
    isAdmin: false,
  },
);

const emit = defineEmits<{
  (e: 'click', id: string): void;
  (e: 'like', discussion: DiscussionCardItem, event: Event): void;
  (e: 'pin', discussion: DiscussionCardItem, event: Event): void;
  (e: 'delete', discussion: DiscussionCardItem, event: Event): void;
  (e: 'tag', tag: string, event: Event): void;
}>();

const { t, locale } = useI18n();

const isOwner = computed(() => props.currentUserId === props.discussion?.user?.id);

const parsedTags = computed(() => {
  try {
    const parsed = props.discussion.tags ? JSON.parse(props.discussion.tags) : [];
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch (_e) {
    return [];
  }
});

const parsedImages = computed(() => {
  try {
    const parsed = props.discussion.images ? JSON.parse(props.discussion.images) : [];
    return Array.isArray(parsed) ? parsed.filter((img): img is string => typeof img === 'string') : [];
  } catch (_e) {
    return [];
  }
});

const coverImages = computed(() => parsedImages.value.slice(0, 3).map((img) => getAssetUrl(img)));

const plainContent = computed(() => {
  return props.discussion.content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~\-[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
});

const latestCommentText = computed(() => {
  const comment = props.discussion.latestComment;
  if (!comment?.content) return '';
  return comment.content.replace(/\s+/g, ' ').trim();
});

const formattedTime = computed(() => formatTime(props.discussion.createdAt));
const formattedActivityTime = computed(() =>
  formatTime(props.discussion.lastActivityAt || props.discussion.createdAt),
);

const score = computed(() => {
  const likes = props.discussion._count?.likes || 0;
  const comments = props.discussion._count?.comments || 0;
  const views = props.discussion.viewCount || 0;
  return likes * 3 + comments * 4 + Math.round(views / 12);
});

function formatTime(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t('common.time.justNow');
  if (minutes < 60) return t('common.time.minutesAgo', { n: minutes });
  if (hours < 24) return t('common.time.hoursAgo', { n: hours });
  if (days < 7) return t('common.time.daysAgo', { n: days });
  return date.toLocaleDateString(locale.value === 'en-US' ? 'en-US' : 'zh-CN');
}

function formatNumber(value: number | undefined) {
  const safe = value || 0;
  if (safe >= 10000) return `${(safe / 10000).toFixed(1)}w`;
  if (safe >= 1000) return `${(safe / 1000).toFixed(1)}k`;
  return String(safe);
}

function handleCardClick() {
  emit('click', props.discussion.id);
}

function handleLikeClick(event: Event) {
  emit('like', props.discussion, event);
}

function handlePinClick(event: Event) {
  emit('pin', props.discussion, event);
}

function handleDeleteClick(event: Event) {
  emit('delete', props.discussion, event);
}

function handleTagClick(tagName: string, event: Event) {
  emit('tag', tagName, event);
}
</script>

<template>
  <article
    class="discussion-card"
    :class="{ 'discussion-card--pinned': discussion.isPinned }"
    @click="handleCardClick"
  >
    <UserAvatar :user="discussion.user" size="sm" class="discussion-card__avatar" />

    <div class="discussion-card__content">
      <header class="discussion-card__header">
        <div class="discussion-card__title-line">
          <h3 class="discussion-card__title">{{ discussion.title }}</h3>
          <span v-if="discussion.isPinned" class="discussion-card__pin">
            <Pin class="h-3 w-3" />
            {{ t('community.discussions.pinned') }}
          </span>
        </div>
        <p class="discussion-card__byline">
          <strong>{{ discussion.user?.name || t('community.discussions.anonymous') }}</strong>
          <span>{{ formattedTime }}</span>
          <span>{{ t('community.discussions.lastActive') }} {{ formattedActivityTime }}</span>
        </p>
      </header>

      <div class="discussion-card__body">
        <div class="discussion-card__copy">
          <p class="discussion-card__excerpt">
            {{ plainContent || t('community.discussions.emptyContent') }}
          </p>

          <div v-if="latestCommentText" class="discussion-card__reply">
            <MessageSquare class="h-3.5 w-3.5" />
            <span class="truncate">
              {{ discussion.latestComment?.user?.name || t('community.discussions.anonymous') }}:
              {{ latestCommentText }}
            </span>
          </div>
        </div>

        <div v-if="coverImages.length > 0" class="discussion-card__media" aria-hidden="true">
          <img :src="coverImages[0]" alt="" loading="lazy" />
          <span v-if="parsedImages.length > 1">+{{ parsedImages.length - 1 }}</span>
        </div>
      </div>

      <footer class="discussion-card__footer">
        <div v-if="parsedTags.length > 0" class="discussion-card__tags">
          <button
            v-for="tagName in parsedTags.slice(0, 4)"
            :key="tagName"
            type="button"
            class="discussion-card__tag"
            @click.stop="handleTagClick(tagName, $event)"
          >
            <Tag class="h-3 w-3" />
            {{ tagName }}
          </button>
        </div>
        <div v-else class="discussion-card__tags">
          <span class="discussion-card__tag discussion-card__tag--muted">
            <Tag class="h-3 w-3" />
            {{ t('community.discussions.noTag') }}
          </span>
        </div>

        <div class="discussion-card__metrics" @click.stop>
          <button
            type="button"
            class="discussion-card__metric discussion-card__metric--button"
            :class="{ 'is-liked': discussion.isLiked }"
            :title="t('community.discussions.likes')"
            @click="handleLikeClick"
          >
            <Heart class="h-3.5 w-3.5" :class="{ 'fill-current': discussion.isLiked }" />
            <span>{{ formatNumber(discussion._count?.likes) }}</span>
          </button>
          <span class="discussion-card__metric" :title="t('community.discussions.comments')">
            <MessageSquare class="h-3.5 w-3.5" />
            {{ formatNumber(discussion._count?.comments) }}
          </span>
          <span class="discussion-card__metric" :title="t('community.discussions.views')">
            <Eye class="h-3.5 w-3.5" />
            {{ formatNumber(discussion.viewCount) }}
          </span>
          <span class="discussion-card__metric discussion-card__score">
            <Sparkles class="h-3.5 w-3.5" />
            {{ score }}
          </span>

          <span v-if="isOwner || isAdmin" class="discussion-card__actions">
            <button
              v-if="isAdmin"
              type="button"
              class="discussion-card__icon-button"
              :class="{ 'is-active': discussion.isPinned }"
              :title="t('community.discussions.pinned')"
              @click="handlePinClick"
            >
              <Pin class="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              class="discussion-card__icon-button discussion-card__icon-button--danger"
              :title="t('common.delete')"
              @click="handleDeleteClick"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.discussion-card {
  position: relative;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.18s ease;
}

.discussion-card:hover {
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-1.5px);
}

.discussion-card--pinned {
  border-color: color-mix(in srgb, var(--accent) 54%, var(--border-base));
  box-shadow: inset 3px 0 0 var(--accent);
}

.discussion-card__avatar {
  margin-top: 2px;
}

.discussion-card__content {
  min-width: 0;
}

.discussion-card__header {
  min-width: 0;
}

.discussion-card__title-line,
.discussion-card__byline,
.discussion-card__footer,
.discussion-card__tags,
.discussion-card__metrics,
.discussion-card__metric,
.discussion-card__actions,
.discussion-card__pin,
.discussion-card__reply {
  display: flex;
  align-items: center;
}

.discussion-card__title-line {
  gap: 8px;
  min-width: 0;
}

.discussion-card__title {
  margin: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discussion-card:hover .discussion-card__title {
  color: var(--accent);
}

.discussion-card__pin {
  gap: 3px;
  height: 20px;
  padding: 0 7px;
  flex: 0 0 auto;
  border-radius: 6px;
  background: var(--accent-subtle);
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
}

.discussion-card__byline {
  gap: 7px;
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.discussion-card__byline strong {
  overflow: hidden;
  max-width: 132px;
  color: var(--text-secondary);
  font-weight: 600;
  text-overflow: ellipsis;
}

.discussion-card__byline span:not(:first-child)::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 3px;
  margin-right: 7px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.45;
  vertical-align: middle;
}

.discussion-card__body {
  display: flex;
  gap: 14px;
  min-width: 0;
  margin-top: 8px;
}

.discussion-card__copy {
  min-width: 0;
  flex: 1;
}

.discussion-card__excerpt {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.discussion-card__media {
  position: relative;
  width: 96px;
  height: 64px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
}

.discussion-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.discussion-card__media span {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.72);
  color: white;
  font-size: 10px;
  font-weight: 600;
}

.discussion-card__reply {
  gap: 6px;
  height: 28px;
  margin-top: 8px;
  padding: 0 8px;
  border-radius: 6px;
  background: var(--accent-subtle);
  color: var(--text-secondary);
  font-size: 10.5px;
  font-weight: 500;
}

.discussion-card__reply svg {
  flex: 0 0 auto;
  color: var(--accent);
}

.discussion-card__footer {
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  margin-top: 10px;
}

.discussion-card__tags {
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  gap: 4px;
}

.discussion-card__tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  max-width: 132px;
  padding: 0 8px;
  overflow: hidden;
  border: 1px solid rgba(37, 99, 235, 0.15);
  border-radius: 9999px;
  background: var(--accent-subtle);
  color: var(--accent);
  cursor: pointer;
  font-size: 10px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.discussion-card__tag:hover {
  background: var(--accent);
  color: #fff;
  border-color: transparent;
}

.discussion-card__tag--muted {
  border-color: var(--border-base);
  background: var(--bg-app);
  color: var(--text-muted);
  cursor: default;
}

.discussion-card__metrics {
  flex: 0 0 auto;
  gap: 8px;
}

.discussion-card__metric {
  justify-content: center;
  gap: 4px;
  height: 24px;
  padding: 0 6px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 10.5px;
  font-weight: 500;
}

.discussion-card__metric--button {
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.discussion-card__metric--button:hover,
.discussion-card__metric.is-liked {
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
}

.discussion-card__score {
  color: #b45309;
}

.discussion-card__actions {
  gap: 4px;
  margin-left: 2px;
}

.discussion-card__icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.discussion-card__icon-button:hover,
.discussion-card__icon-button.is-active {
  color: var(--accent);
}

.discussion-card__icon-button--danger:hover {
  color: #ef4444;
}

@media (max-width: 720px) {
  .discussion-card {
    grid-template-columns: 34px minmax(0, 1fr);
    padding: 10px;
  }

  .discussion-card__body {
    align-items: flex-start;
  }

  .discussion-card__media {
    width: 78px;
    height: 52px;
  }

  .discussion-card__footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .discussion-card__metrics {
    width: 100%;
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .discussion-card__body {
    flex-direction: column;
  }

  .discussion-card__media {
    width: min(180px, 100%);
    height: auto;
    aspect-ratio: 16 / 10;
  }

  .discussion-card__byline {
    flex-wrap: wrap;
    white-space: normal;
  }
}
</style>