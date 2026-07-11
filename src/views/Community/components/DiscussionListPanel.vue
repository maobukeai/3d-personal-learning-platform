<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { MessageSquare } from 'lucide-vue-next';
import type { Discussion, DiscussionCardActionTarget } from '../DiscussionsView.vue';
import DiscussionCard from '@/components/DiscussionCard.vue';
import EmptyState from '@/components/EmptyState.vue';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

defineProps<{
  discussions: Discussion[];
  isLoading: boolean;
  currentUserId: string | undefined;
  isAdmin: boolean;
  pagination: Pagination;
  viewMode: 'grid' | 'list';
}>();

const emit = defineEmits<{
  (e: 'open', id: string): void;
  (e: 'like', discussion: DiscussionCardActionTarget, event: Event): void;
  (e: 'pin', discussion: DiscussionCardActionTarget, event: Event): void;
  (e: 'delete', discussion: DiscussionCardActionTarget, event: Event): void;
  (e: 'tag', tag: string): void;
  (e: 'page-change', page: number): void;
  (e: 'create'): void;
}>();

const { t } = useI18n();

function handlePageChange(page: number) {
  emit('page-change', page);
}
</script>

<template>
  <div v-if="isLoading" class="loading-list" :class="viewMode">
    <div v-for="idx in 4" :key="idx" class="skeleton-card">
      <span></span>
      <div>
        <i></i>
        <i></i>
        <i></i>
      </div>
    </div>
  </div>

  <div v-else-if="discussions.length > 0" class="discussion-list" :class="viewMode">
    <DiscussionCard
      v-for="discussion in discussions"
      :key="discussion.id"
      :discussion="discussion"
      :current-user-id="currentUserId"
      :is-admin="isAdmin"
      :view-mode="viewMode"
      @click="emit('open', $event)"
      @like="(item, event) => emit('like', item, event)"
      @pin="(item, event) => emit('pin', item, event)"
      @delete="(item, event) => emit('delete', item, event)"
      @tag="emit('tag', $event)"
    />
  </div>

  <EmptyState
    v-else
    :icon="MessageSquare"
    :title="t('community.discussions.emptyTitle')"
    :description="t('community.discussions.emptySubtitle')"
    :action-text="t('community.discussions.newPost')"
    @action="$emit('create')"
  />

  <div v-if="pagination.totalPages > 1" class="pagination-row mobile-row">
    <Pagination
      :current-page="pagination.page"
      :page-size="pagination.limit"
      :total="pagination.total"
      layout="prev, pager, next"
      background
      @current-change="handlePageChange"
    />
  </div>
</template>

<style scoped>
.discussion-list,
.loading-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.discussion-list.grid,
.loading-list.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}

.skeleton-card {
  display: flex;
  gap: 12px;
  height: 136px;
  padding: 14px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.loading-list.grid .skeleton-card {
  flex-direction: column;
  height: 210px;
  align-items: flex-start;
}

.skeleton-card span,
.skeleton-card i {
  display: block;
  border-radius: 7px;
  background: linear-gradient(
    90deg,
    var(--bg-app),
    color-mix(in srgb, var(--border-base) 70%, var(--bg-card)),
    var(--bg-app)
  );
  background-size: 200% 100%;
  animation: shimmer 1.3s infinite linear;
}

.skeleton-card span {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.skeleton-card div {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
}

.skeleton-card i {
  height: 14px;
}

.skeleton-card i:nth-child(1) {
  width: 36%;
}
.skeleton-card i:nth-child(2) {
  width: 82%;
}
.skeleton-card i:nth-child(3) {
  width: 56%;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

.pagination-row {
  display: flex;
  justify-content: center;
  padding: 8px 0 12px;
}
</style>
