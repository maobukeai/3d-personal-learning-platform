<script setup lang="ts">
import {
  formatCompactNumber as formatNumber,
  formatRelativeTime as formatTime,
} from '@/utils/format';
import { Trophy, Tag, MessageCircle, Filter } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import type {
  ShowcaseUser,
  ShowcaseActivity,
  ShowcaseStats,
  ShowcaseType,
  TypeBreakdownItem,
} from './showcaseTypes';

defineProps<{
  stats: ShowcaseStats | null;
  topTags: Array<{ name: string; count: number }>;
  topCreators: Array<
    ShowcaseUser & { works: number; likes: number; comments: number; views: number; score: number }
  >;
  recentActivity: ShowcaseActivity[];
  typeBreakdown: TypeBreakdownItem[];
}>();

const emit = defineEmits<{
  (e: 'open-user-profile', userId: string): void;
  (e: 'select-tag', tag: string): void;
  (e: 'open-activity', activity: ShowcaseActivity): void;
  (e: 'select-type', type: ShowcaseType | 'all'): void;
}>();
</script>

<template>
  <aside class="showcase-rail mobile-adaptive">
    <section class="rail-panel">
      <div class="rail-title mobile-row">
        <Trophy class="w-4 h-4" />
        创作者榜
      </div>
      <div v-if="topCreators.length" class="creator-list">
        <button
          v-for="(creator, index) in topCreators"
          :key="creator.id"
          type="button"
          @click="emit('open-user-profile', creator.id)"
        >
          <span class="rank">{{ index + 1 }}</span>
          <UserAvatar :user="creator" size="sm" />
          <span class="creator-name">{{ creator.name || creator.email }}</span>
          <small>{{ formatNumber(creator.likes + creator.comments) }}</small>
        </button>
      </div>
      <p v-else class="rail-empty">发布和互动后会自动生成榜单。</p>
    </section>

    <section class="rail-panel">
      <div class="rail-title mobile-row">
        <Tag class="w-4 h-4" />
        热门标签
      </div>
      <div v-if="topTags.length" class="tag-cloud">
        <button
          v-for="tag in topTags"
          :key="tag.name"
          type="button"
          @click="emit('select-tag', tag.name)"
        >
          #{{ tag.name }}
          <span>{{ tag.count }}</span>
        </button>
      </div>
      <p v-else class="rail-empty">作品标签会在这里聚合。</p>
    </section>

    <section class="rail-panel">
      <div class="rail-title mobile-row">
        <MessageCircle class="w-4 h-4" />
        社区动态
      </div>
      <div v-if="recentActivity.length" class="activity-list">
        <button
          v-for="activity in recentActivity"
          :key="activity.id"
          type="button"
          @click="emit('open-activity', activity)"
        >
          <UserAvatar :user="activity.user" size="sm" />
          <span>
            <strong>{{ activity.user.name || activity.user.email || '创作者' }}</strong>
            评论了《{{ activity.showcase.title }}》
            <small>{{ formatTime(activity.createdAt) }}</small>
          </span>
        </button>
      </div>
      <p v-else class="rail-empty">评论出现后会在这里实时沉淀。</p>
    </section>

    <section class="rail-panel">
      <div class="rail-title mobile-row">
        <Filter class="w-4 h-4" />
        类型分布
      </div>
      <div class="type-bars">
        <button
          v-for="type in typeBreakdown"
          :key="type.value"
          type="button"
          @click="emit('select-type', type.value)"
        >
          <span>{{ type.label }}</span>
          <strong>{{ type.count }}</strong>
          <i :style="{ width: `${Math.max(type.percent, type.count ? 8 : 0)}%` }"></i>
        </button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.showcase-rail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 2px;
  min-height: 0;
  overflow-y: auto;
}

.rail-panel {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-enterprise);
  padding: 12px;
}

.rail-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
}

.creator-list,
.activity-list,
.type-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.creator-list button,
.activity-list button,
.type-bars button {
  min-width: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
}

.creator-list button {
  display: grid;
  grid-template-columns: 22px 26px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 4px;
}

.creator-list button:hover,
.activity-list button:hover,
.type-bars button:hover {
  background: var(--bg-hover);
}

.rank {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border-radius: 5px;
  color: var(--accent);
  background: var(--accent-subtle);
  font-size: 11px;
  font-weight: 900;
}

.creator-name {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creator-list small {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 850;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-cloud button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 132px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--bg-app);
  font-size: 11px;
  font-weight: 850;
}

.tag-cloud button span {
  color: var(--text-muted);
  font-size: 10px;
}

.activity-list button {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 4px;
}

.activity-list span {
  display: block;
  min-width: 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.45;
}

.activity-list strong {
  color: var(--text-primary);
}

.activity-list small {
  display: block;
  margin-top: 2px;
  color: var(--text-muted);
}

.type-bars button {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  overflow: hidden;
  padding: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 850;
}

.type-bars button span,
.type-bars button strong {
  position: relative;
  z-index: 1;
}

.type-bars button i {
  position: absolute;
  inset: auto auto 0 0;
  height: 2px;
  border-radius: 999px;
  background: var(--accent);
}

.rail-empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 1100px) {
  .showcase-rail {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: 10px;
    overflow: visible;
  }
}

@media (max-width: 640px) {
  .showcase-rail {
    grid-template-columns: 1fr;
  }
}
</style>
