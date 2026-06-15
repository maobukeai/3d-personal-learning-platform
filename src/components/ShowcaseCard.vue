<script setup lang="ts">
import { computed } from 'vue';
import {
  Box,
  Download,
  Eye,
  Heart,
  Image,
  MessageCircle,
  Play,
  Share2,
  Sparkles,
  Type,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { getAssetUrl } from '@/utils/api';
import type { Asset } from '@/types';

type ShowcaseCardItem = {
  id: string;
  title: string;
  description?: string | null;
  tags?: string | null;
  type: 'IMAGE' | 'VIDEO' | 'MODEL' | 'TEXT' | 'OTHER';
  thumbnailUrl?: string | null;
  images?: string | null;
  isVideo?: boolean;
  views: number;
  createdAt: string;
  asset?: Asset | null;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  user: {
    id: string;
    name?: string | null;
    avatar?: string;
    avatarUrl?: string | null;
    role?: string;
    email?: string;
    bio?: string | null;
  };
  isLiked?: boolean;
  likesCount: number;
  commentsCount: number;
};

const props = withDefaults(
  defineProps<{
    item: ShowcaseCardItem;
    compact?: boolean;
    featured?: boolean;
  }>(),
  {
    compact: false,
    featured: false,
  },
);

const emit = defineEmits<{
  (e: 'click', item: ShowcaseCardItem): void;
  (e: 'like', item: ShowcaseCardItem): void;
  (e: 'share', item: ShowcaseCardItem): void;
  (e: 'user-click', userId: string): void;
}>();

const parsedTags = computed(() => {
  if (!props.item?.tags) return [];
  try {
    const parsed = JSON.parse(props.item.tags);
    if (Array.isArray(parsed)) return parsed.map((tag) => String(tag).trim()).filter(Boolean);
  } catch {
    // Legacy tags are comma-separated.
  }
  return props.item.tags
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
});

const mediaUrl = computed(() => getAssetUrl(props.item.thumbnailUrl));
const assetDownloadUrl = computed(() => getAssetUrl(props.item.asset?.url));
const mediaCount = computed(() => {
  let count = mediaUrl.value ? 1 : 0;
  if (props.item.images) {
    try {
      const parsed = JSON.parse(props.item.images);
      if (Array.isArray(parsed)) count += parsed.filter(Boolean).length;
    } catch {
      // Old showcase records can carry a malformed gallery string.
    }
  }
  return count;
});

const authorName = computed(() => props.item.user?.name || props.item.user?.email || '匿名创作者');

const typeMeta = computed(() => {
  switch (props.item?.type) {
    case 'MODEL':
      return { label: '3D模型', className: 'type-model', icon: Box };
    case 'VIDEO':
      return { label: '视频', className: 'type-video', icon: Play };
    case 'IMAGE':
      return { label: '图片', className: 'type-image', icon: Image };
    case 'TEXT':
      return { label: '文本', className: 'type-text', icon: Type };
    default:
      return { label: '其他', className: 'type-other', icon: Sparkles };
  }
});

const statusMeta = computed(() => {
  if (props.item.status === 'PENDING') return { label: '审核中', className: 'status-pending' };
  if (props.item.status === 'REJECTED') return { label: '已驳回', className: 'status-rejected' };
  return null;
});

const plainDescription = computed(() => {
  if (!props.item.description) return '创作者还没有填写说明，点开查看作品细节与讨论。';
  return props.item.description
    .replace(/[#*_`>[\\\](){}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
});

const formatNumber = (value: number) =>
  new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value || 0,
  );

const formatTime = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString('zh-CN');
};

function handleCardClick() {
  emit('click', props.item);
}

function handleLikeClick() {
  emit('like', props.item);
}

function handleShareClick() {
  emit('share', props.item);
}

function handleUserClick() {
  if (props.item?.user?.id) {
    emit('user-click', props.item.user.id);
  }
}
</script>

<template>
  <article
    class="showcase-card"
    :class="{
      'showcase-card--compact': compact,
      'showcase-card--featured': featured,
      'list-row': compact,
    }"
    @click="handleCardClick"
  >
    <div class="showcase-card__media">
      <img v-if="mediaUrl" :src="mediaUrl" :alt="item.title" loading="lazy" />
      <div v-else class="showcase-card__text-cover">
        <component :is="typeMeta.icon" class="w-7 h-7" />
        <span>{{ item.title }}</span>
      </div>

      <div class="showcase-card__shade"></div>
      <div class="showcase-card__badges">
        <span class="showcase-card__type" :class="typeMeta.className">
          <component :is="typeMeta.icon" class="w-3 h-3" />
          {{ typeMeta.label }}
        </span>
        <span v-if="item.asset" class="showcase-card__asset">
          <Box class="w-3 h-3" />
          可下载
        </span>
        <span v-if="statusMeta" class="showcase-card__status" :class="statusMeta.className">
          {{ statusMeta.label }}
        </span>
      </div>
      <div v-if="item.isVideo || item.type === 'VIDEO'" class="showcase-card__play">
        <Play class="w-5 h-5 fill-current" />
      </div>
      <div class="showcase-card__views">
        <Eye class="w-3 h-3" />
        {{ formatNumber(item.views) }}
      </div>
      <div v-if="mediaCount > 1" class="showcase-card__gallery">{{ mediaCount }} 张</div>
      <div class="showcase-card__quick-view">
        <Eye class="w-3.5 h-3.5" />
        查看详情
      </div>
    </div>

    <div class="showcase-card__body">
      <div class="showcase-card__author" @click.stop="handleUserClick">
        <UserAvatar :user="item.user" size="sm" />
        <div class="min-w-0">
          <p>{{ authorName }}</p>
          <span>{{ formatTime(item.createdAt) }}</span>
        </div>
      </div>

      <h3>{{ item.title }}</h3>
      <p class="showcase-card__desc">{{ plainDescription }}</p>

      <div v-if="parsedTags.length" class="showcase-card__tags">
        <span v-for="tag in parsedTags.slice(0, compact ? 2 : 3)" :key="tag">#{{ tag }}</span>
      </div>

      <div class="showcase-card__footer">
        <button
          type="button"
          class="showcase-card__action"
          :class="{ 'is-liked': item.isLiked }"
          :title="item.isLiked ? '取消点赞' : '点赞作品'"
          @click.stop="handleLikeClick"
        >
          <Heart class="w-3.5 h-3.5" :class="{ 'fill-current': item.isLiked }" />
          {{ formatNumber(item.likesCount) }}
        </button>
        <button
          type="button"
          class="showcase-card__action"
          title="分享作品"
          @click.stop="handleShareClick"
        >
          <Share2 class="w-3.5 h-3.5" />
        </button>
        <a
          v-if="assetDownloadUrl"
          class="showcase-card__action"
          :href="assetDownloadUrl"
          download
          title="下载关联资源"
          @click.stop
        >
          <Download class="w-3.5 h-3.5" />
        </a>
        <div class="showcase-card__metric" title="评论">
          <MessageCircle class="w-3.5 h-3.5" />
          {{ formatNumber(item.commentsCount) }}
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.showcase-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  box-shadow: 0 12px 34px rgb(15 23 42 / 0.08);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.showcase-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border-base));
  box-shadow: 0 18px 44px rgb(15 23 42 / 0.13);
}

.showcase-card__media {
  position: relative;
  aspect-ratio: 4 / 3;
  min-height: 190px;
  overflow: hidden;
  background: linear-gradient(135deg, #172033, #243044 52%, #18231f);
}

.showcase-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.45s ease;
}

.showcase-card:hover .showcase-card__media img {
  transform: scale(1.04);
}

.showcase-card__text-cover {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: white;
  text-align: center;
  font-weight: 800;
}

.showcase-card__shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgb(0 0 0 / 0.18), rgb(0 0 0 / 0.02) 42%, rgb(0 0 0 / 0.5));
  pointer-events: none;
}

.showcase-card__badges,
.showcase-card__views,
.showcase-card__gallery {
  position: absolute;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.showcase-card__badges {
  top: 8px;
  left: 8px;
  right: 8px;
  flex-wrap: wrap;
}

.showcase-card__type,
.showcase-card__asset,
.showcase-card__status,
.showcase-card__views,
.showcase-card__gallery {
  height: 22px;
  padding: 0 7px;
  border-radius: 4px;
  color: white;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  background: rgb(15 23 42 / 0.72);
}

.showcase-card__type,
.showcase-card__asset,
.showcase-card__status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.showcase-card__asset {
  background: rgb(37 99 235 / 0.86);
}

.showcase-card__status.status-pending {
  background: rgb(217 119 6 / 0.9);
}

.showcase-card__status.status-rejected {
  background: rgb(225 29 72 / 0.9);
}

.showcase-card__views {
  right: 8px;
  bottom: 8px;
}

.showcase-card__gallery {
  left: 8px;
  bottom: 8px;
  background: rgb(15 23 42 / 0.72);
}

.showcase-card__quick-view {
  position: absolute;
  left: 50%;
  bottom: 9px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  color: white;
  background: rgb(15 23 42 / 0.78);
  font-size: 11px;
  font-weight: 900;
  opacity: 0;
  transform: translate(-50%, 6px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.showcase-card:hover .showcase-card__quick-view {
  opacity: 1;
  transform: translate(-50%, 0);
}

.showcase-card__play {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  color: white;
  opacity: 0.92;
  pointer-events: none;
}

.showcase-card__play svg {
  width: 42px;
  height: 42px;
  padding: 12px;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.42);
}

.type-model {
  background: rgb(37 99 235 / 0.88);
}

.type-video {
  background: rgb(225 29 72 / 0.88);
}

.type-image {
  background: rgb(5 150 105 / 0.88);
}

.type-text {
  background: rgb(217 119 6 / 0.9);
}

.type-other {
  background: rgb(71 85 105 / 0.88);
}

.showcase-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 13px 14px 14px;
}

.showcase-card__author {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--text-secondary);
}

.showcase-card__author p,
.showcase-card__author span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.showcase-card__author p {
  max-width: 190px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 800;
}

.showcase-card__author span {
  display: block;
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
}

.showcase-card h3 {
  display: -webkit-box;
  margin: 0;
  min-height: 40px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 850;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.showcase-card__desc {
  display: -webkit-box;
  min-height: 38px;
  margin: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.showcase-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-height: 20px;
}

.showcase-card__tags span {
  max-width: 92px;
  overflow: hidden;
  padding: 3px 6px;
  border-radius: 4px;
  color: var(--accent);
  background: var(--accent-subtle);
  font-size: 10px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.showcase-card__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  margin-top: auto;
  border-top: 1px solid color-mix(in srgb, var(--border-base) 72%, transparent);
}

.showcase-card__action,
.showcase-card__metric {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
}

.showcase-card__action {
  padding: 0;
  border: 0;
  background: transparent;
  transition:
    color 0.16s ease,
    transform 0.16s ease;
}

.showcase-card__action:hover {
  color: #e11d48;
  transform: scale(1.03);
}

.showcase-card__action.is-liked {
  color: #e11d48;
}

.showcase-card__metric {
  margin-left: auto;
}

.showcase-card--featured {
  grid-column: span 2;
}

.showcase-card--featured .showcase-card__media {
  aspect-ratio: 16 / 9;
  min-height: 240px;
}

.showcase-card--featured .showcase-card__body {
  padding: 16px;
}

.showcase-card--featured h3 {
  min-height: auto;
  font-size: 18px;
  line-height: 1.25;
}

.showcase-card--featured .showcase-card__desc {
  max-width: 720px;
  min-height: auto;
  font-size: 13px;
}

@media (min-width: 768px) {
  .showcase-card--featured {
    flex-direction: row;
    align-items: stretch;
  }

  .showcase-card--featured .showcase-card__media {
    width: 50%;
    aspect-ratio: auto;
    min-height: 100%;
  }

  .showcase-card--featured .showcase-card__body {
    width: 50%;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .showcase-card--featured h3 {
    font-size: 20px;
    margin-bottom: 4px;
  }
}

.showcase-card.list-row {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.showcase-card.list-row .showcase-card__media {
  width: 120px;
  height: 72px;
  aspect-ratio: auto;
  min-height: auto;
  flex-shrink: 0;
}

.showcase-card.list-row .showcase-card__body {
  flex-direction: row;
  align-items: center;
  flex: 1;
  padding: 8px 12px;
  gap: 16px;
}

.showcase-card.list-row h3 {
  margin: 0;
  flex: 1;
  min-height: auto;
  font-size: 14px;
}

.showcase-card.list-row .showcase-card__tags {
  margin: 0;
  min-height: auto;
  display: flex;
}

.showcase-card.list-row .showcase-card__footer {
  margin: 0;
  border-top: none;
  padding-top: 0;
  flex-shrink: 0;
  gap: 12px;
}

.showcase-card--compact .showcase-card__media {
  aspect-ratio: 16 / 10;
  min-height: 132px;
}

.showcase-card--compact .showcase-card__author,
.showcase-card--compact .showcase-card__desc {
  display: none;
}

.showcase-card--compact .showcase-card__body {
  gap: 6px;
  padding: 8px;
}

.showcase-card--compact h3 {
  min-height: 20px;
  font-size: 13px;
  -webkit-line-clamp: 1;
}

.showcase-card--compact .showcase-card__tags {
  min-height: 0;
}

.showcase-card--compact .showcase-card__tags span {
  max-width: 76px;
}

@media (max-width: 640px) {
  .showcase-card--featured {
    grid-column: span 1;
  }

  .showcase-card__media {
    min-height: 170px;
  }

  .showcase-card h3 {
    font-size: 13px;
  }
}
</style>
