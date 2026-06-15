<script setup lang="ts">
import { Activity } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import { getAssetUrl } from '@/utils/api';
import type { FeedItem } from '../types';

defineProps<{
  unifiedFeed: FeedItem[];
}>();

const emit = defineEmits<{
  (e: 'navigate', route: string | undefined): void;
}>();
</script>

<template>
  <Card hoverable glow class="activity-panel h-full" padding="none">
    <div class="dashboard-panel-header">
      <div>
        <h3>实时动态</h3>
        <p>{{ unifiedFeed.length }} 条更新</p>
      </div>
      <Badge variant="success" dot>LIVE</Badge>
    </div>

    <div class="flex flex-col min-h-0 flex-1">
      <div v-if="unifiedFeed.length" class="feed-list flex-1">
        <button
          v-for="feed in unifiedFeed"
          :key="feed.id"
          type="button"
          class="feed-row"
          @click="emit('navigate', feed.route)"
        >
          <span class="feed-visual">
            <img v-if="feed.imageUrl" :src="getAssetUrl(feed.imageUrl)" :alt="feed.title" />
            <UserAvatar v-else-if="feed.user" :user="feed.user" size="xs" />
            <component :is="feed.icon" v-else class="h-4 w-4" />
          </span>
          <span class="feed-body">
            <span>
              <strong>{{ feed.title }}</strong>
              <small>{{ feed.time }}</small>
            </span>
            <em>{{ feed.description }}</em>
          </span>
          <Badge v-if="feed.badge" variant="primary" outline class="ml-auto scale-90">{{
            feed.badge
          }}</Badge>
        </button>
      </div>
      <div v-else class="dashboard-panel-empty">
        <Activity class="h-5 w-5 opacity-40" />
        <span>暂无实时动态</span>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.activity-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.feed-list {
  position: relative;
  display: grid;
  gap: 8px;
  padding: 12px;
  overflow-y: auto;
}

.feed-list::before {
  content: '';
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 29px;
  width: 1px;
  border-left: 1px dashed var(--border-base);
  pointer-events: none;
  z-index: 0;
}

.dark .feed-list::before {
  border-left-color: rgba(255, 255, 255, 0.12);
}

.feed-row {
  z-index: 1;
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
  background: transparent;
  text-align: left;
  width: 100%;
}

.feed-row:hover {
  background: var(--bg-hover);
  border-color: var(--border-base);
  transform: translateX(3px);
}

.feed-visual {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-muted);
  border: 1px solid var(--border-base);
}

.feed-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-body {
  display: grid;
  min-width: 0;
  flex: 1;
}

.feed-body span {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}

.feed-body strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

.feed-body small {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9px;
  font-weight: 500;
}

.feed-body em {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 500;
  font-style: normal;
  margin-top: 2px;
}
</style>
