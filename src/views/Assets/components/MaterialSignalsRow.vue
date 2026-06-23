<script setup lang="ts">
import { Download, Clock3 } from 'lucide-vue-next';
import { formatCompactNumber, formatRelativeTime, resolvePreviewUrl } from '../resourceUtils';
import { useLabel } from '@/utils/i18n';

interface MaterialItem {
  id: string;
  title?: string | null;
  previewUrl?: string | null;
  downloads?: number;
  createdAt?: string;
}

defineProps<{
  topDownloads: MaterialItem[];
  latestUploads: MaterialItem[];
}>();

const emit = defineEmits<{
  (e: 'openDetail', material: MaterialItem): void;
}>();

const label = useLabel();
</script>

<template>
  <section class="signal-row mobile-row">
    <div class="signal-panel">
      <header>
        <Download class="icon-sm" />
        <span>{{ label('热门下载', 'Top Downloads') }}</span>
      </header>
      <div class="mini-list">
        <button
          v-for="material in topDownloads.slice(0, 3)"
          :key="material.id"
          type="button"
          class="mini-material"
          @click="emit('openDetail', material)"
        >
          <img :src="resolvePreviewUrl(material.previewUrl, 'STL')" :alt="material.title || ''" />
          <span>{{ material.title }}</span>
          <strong>{{ formatCompactNumber(material.downloads) }}</strong>
        </button>
      </div>
    </div>

    <div class="signal-panel">
      <header>
        <Clock3 class="icon-sm" />
        <span>{{ label('最近上传', 'Recent Uploads') }}</span>
      </header>
      <div class="mini-list">
        <button
          v-for="material in latestUploads.slice(0, 3)"
          :key="material.id"
          type="button"
          class="mini-material"
          @click="emit('openDetail', material)"
        >
          <img :src="resolvePreviewUrl(material.previewUrl, 'STL')" :alt="material.title || ''" />
          <span>{{ material.title }}</span>
          <small>{{ formatRelativeTime(material.createdAt) }}</small>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.signal-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(260px, 1.2fr);
  gap: 10px;
}

.signal-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
}

.signal-panel header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.mini-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mini-material {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 5px 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mini-list > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.mini-material:hover {
  background: var(--bg-hover);
}

.mini-material img {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
}

.mini-material span,
.mini-material strong,
.mini-material small {
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-material span {
  color: var(--text-primary);
  font-weight: 500;
}

.mini-material strong {
  color: #d97706;
  font-weight: 600;
  text-align: right;
}

.mini-material small {
  color: var(--text-muted);
  text-align: right;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

@media (max-width: 1040px) {
  .signal-row {
    grid-template-columns: 1fr;
  }
}
</style>
