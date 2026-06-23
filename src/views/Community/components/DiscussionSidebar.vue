<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { BarChart3, Flame, MessageCircle, Tag, Users } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import {
  formatRelativeTime as formatTime,
  formatCompactNumber as formatNumber,
} from '@/utils/format';
import { useLabel } from '@/utils/i18n';
import type {
  Discussion,
  DiscussionInsights,
  TagInsight,
  ContributorInsight,
  RecentCommentInsight,
} from '../DiscussionsView.vue';

defineProps<{
  insights: DiscussionInsights | null;
  tagInsights: TagInsight[];
  selectedTag: string;
  hotDiscussions: Discussion[];
  topContributors: ContributorInsight[];
  recentComments: RecentCommentInsight[];
}>();

const emit = defineEmits<{
  (e: 'tag-click', tag: string): void;
  (e: 'open-discussion', id: string): void;
}>();

const { t } = useI18n();
const label = useLabel();
</script>

<template>
  <aside class="discussion-side">
    <section class="side-panel side-panel--health">
      <div class="health-header">
        <BarChart3 class="h-3.5 w-3.5 text-accent" />
        <span>{{ t('community.discussions.communityHealth') }}</span>
      </div>
      <div class="health-stats">
        <div class="health-stat-item">
          <strong>{{
            formatNumber(insights?.totals.activeAuthors || topContributors.length)
          }}</strong>
          <span>{{ t('community.discussions.activeAuthors') }}</span>
        </div>
        <div v-if="insights?.totals.unanswered !== undefined" class="health-stat-item">
          <strong>{{ formatNumber(insights?.totals.unanswered) }}</strong>
          <span>{{ label('等回复', 'Unanswered') }}</span>
        </div>
      </div>
    </section>

    <section class="side-panel">
      <header>
        <h2><Tag class="h-4 w-4" /> {{ t('community.discussions.popularTags') }}</h2>
      </header>
      <div v-if="tagInsights.length > 0" class="tag-cloud">
        <button
          v-for="tagItem in tagInsights.slice(0, 18)"
          :key="tagItem.name"
          type="button"
          :class="{ 'is-active': selectedTag === tagItem.name }"
          @click="emit('tag-click', tagItem.name)"
        >
          <span>#{{ tagItem.name }}</span>
          <b>{{ tagItem.count }}</b>
        </button>
      </div>
      <p v-else class="muted-line">{{ t('community.discussions.noTagsYet') }}</p>
    </section>

    <section class="side-panel">
      <header>
        <h2><Flame class="h-4 w-4" /> {{ t('community.discussions.hotPosts') }}</h2>
      </header>
      <div v-if="hotDiscussions.length > 0" class="rank-list">
        <button
          v-for="(item, index) in hotDiscussions"
          :key="item.id"
          type="button"
          @click="emit('open-discussion', item.id)"
        >
          <b :class="`rank-index--${index + 1}`">{{ index + 1 }}</b>
          <span>{{ item.title }}</span>
          <small>{{ formatNumber(item.viewCount) }} {{ t('community.discussions.views') }}</small>
        </button>
      </div>
      <p v-else class="muted-line">{{ t('community.discussions.noHotPosts') }}</p>
    </section>

    <section class="side-panel">
      <header>
        <h2><Users class="h-4 w-4" /> {{ t('community.discussions.activeCreators') }}</h2>
      </header>
      <div v-if="topContributors.length > 0" class="creator-list">
        <div v-for="creator in topContributors" :key="creator.user.id">
          <UserAvatar :user="creator.user" size="xs" />
          <div>
            <strong>{{ creator.user.name || t('community.discussions.anonymousCreator') }}</strong>
            <span>
              {{
                t('community.discussions.creatorStats', {
                  posts: creator.discussions,
                  comments: creator.comments,
                })
              }}
            </span>
          </div>
          <b>{{ formatNumber(creator.likesReceived) }}</b>
        </div>
      </div>
      <p v-else class="muted-line">{{ t('community.discussions.noCreatorsYet') }}</p>
    </section>

    <section class="side-panel">
      <header>
        <h2><MessageCircle class="h-4 w-4" /> {{ t('community.discussions.recentActivity') }}</h2>
      </header>
      <div v-if="recentComments.length > 0" class="activity-list">
        <button
          v-for="activity in recentComments"
          :key="activity.id"
          type="button"
          @click="emit('open-discussion', activity.discussion.id)"
        >
          <span>{{ activity.user.name || t('community.discussions.anonymous') }}</span>
          <strong>{{ activity.discussion.title }}</strong>
          <small>{{ formatTime(activity.createdAt) }}</small>
        </button>
      </div>
      <p v-else class="muted-line">{{ t('community.discussions.noActivityYet') }}</p>
    </section>
  </aside>
</template>

<style scoped>
.discussion-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.discussion-side::-webkit-scrollbar {
  display: none;
}

.side-panel {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
}

.side-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.side-panel h2 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.side-panel--health {
  background:
    linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(20, 184, 166, 0.03)), var(--bg-card);
  padding: 12px;
}

.health-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.health-stats {
  display: flex;
  gap: 16px;
}

.health-stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.health-stat-item strong {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.1;
}

.health-stat-item span {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-cloud button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  max-width: 130px;
  padding: 0 8px;
  border-radius: 9999px;
  border: 0;
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tag-cloud button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-cloud button b {
  color: var(--text-muted);
  font-size: 9px;
  margin-left: 2px;
}

.rank-list,
.creator-list,
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rank-list button,
.creator-list > div,
.activity-list button {
  display: grid;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  padding: 6px 4px;
  border-bottom: 1px dashed var(--border-base);
  transition: all 0.15s ease;
}

.rank-list button:hover,
.creator-list > div:hover,
.activity-list button:hover {
  background: var(--bg-hover);
  border-radius: 4px;
}

.rank-list button:last-child,
.creator-list > div:last-child,
.activity-list button:last-child {
  border-bottom: 0;
}

.rank-list button {
  grid-template-columns: 20px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
}

.rank-list b {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.rank-list b.rank-index--1 {
  background: #f59e0b;
  color: #fff;
}
.rank-list b.rank-index--2 {
  background: #94a3b8;
  color: #fff;
}
.rank-list b.rank-index--3 {
  background: #a16207;
  color: #fff;
}
.rank-list b:not(.rank-index--1):not(.rank-index--2):not(.rank-index--3) {
  background: var(--bg-app);
  color: var(--text-muted);
}

.rank-list span,
.activity-list strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
}

.rank-list small,
.activity-list small,
.creator-list span,
.muted-line {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
}

.creator-list > div {
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.creator-list strong {
  display: block;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creator-list b {
  color: #e11d48;
  font-size: 10px;
}

.activity-list button {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 6px;
  padding: 6px;
  background: transparent;
}

.activity-list span {
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
}

.activity-list strong {
  grid-column: 1 / -1;
}

.muted-line {
  margin: 0;
  line-height: 1.5;
}
</style>
