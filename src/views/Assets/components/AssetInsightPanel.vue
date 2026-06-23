<script setup lang="ts">
import { ArrowDownToLine, CalendarClock } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import { formatCompactNumber, formatRelativeTime, resolvePreviewUrl } from '../resourceUtils';
import type { AssetListItem } from '../assetLibraryModel';

defineProps<{
  topDownloads: AssetListItem[];
  latest: AssetListItem[];
}>();

const emit = defineEmits<{
  (e: 'goToDetail', asset: AssetListItem): void;
}>();

const label = useLabel();
</script>

<template>
  <aside class="insight-panel">
    <section class="side-section">
      <div class="section-title">
        <ArrowDownToLine class="icon-sm" />
        {{ label('下载榜', 'Top Downloads') }}
      </div>
      <button
        v-for="(asset, index) in topDownloads"
        :key="asset.id"
        type="button"
        class="rank-item"
        @click="emit('goToDetail', asset)"
      >
        <span class="rank-badge" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
        <img :src="resolvePreviewUrl(asset.thumbnail, asset.type)" :alt="asset.title" />
        <span class="rank-title">{{ asset.title }}</span>
        <strong class="rank-value">{{ formatCompactNumber(asset.downloads) }}</strong>
      </button>
    </section>

    <section class="side-section">
      <div class="section-title">
        <CalendarClock class="icon-sm" />
        {{ label('最近更新', 'Recently Updated') }}
      </div>
      <button
        v-for="asset in latest"
        :key="asset.id"
        type="button"
        class="activity-item"
        @click="emit('goToDetail', asset)"
      >
        <span>{{ asset.title }}</span>
        <small>{{ formatRelativeTime(asset.createdAt) }}</small>
      </button>
    </section>
  </aside>
</template>

<style scoped>
.insight-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.side-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.section-title svg {
  color: var(--accent);
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.side-section > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.rank-item,
.activity-item {
  display: flex;
  align-items: center;
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 5px 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.rank-item:hover,
.activity-item:hover {
  background: var(--bg-hover);
}

.rank-item {
  display: grid;
  grid-template-columns: 18px 24px minmax(0, 1fr) auto;
  gap: 6px;
}

.rank-badge {
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

.rank-badge.rank-1 {
  background: #f59e0b;
  color: #fff;
}

.rank-badge.rank-2 {
  background: #94a3b8;
  color: #fff;
}

.rank-badge.rank-3 {
  background: #a16207;
  color: #fff;
}

.rank-badge:not(.rank-1):not(.rank-2):not(.rank-3) {
  background: var(--bg-app);
  color: var(--text-muted);
}

.rank-item img {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
}

.rank-item span,
.activity-item span {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-item strong {
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  text-align: right;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.activity-item small {
  color: var(--text-muted);
  font-size: 10px;
}

@media (max-width: 1180px) {
  .insight-panel {
    display: none;
  }
}
</style>
