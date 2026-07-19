<script setup lang="ts">
import { ArrowRight, Image as ImageIcon, Upload } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import { getAssetUrl } from '@/utils/api';
import type { DashboardAsset } from '../types';

defineProps<{
  visibleAssets: DashboardAsset[];
  contentSummary: {
    approvedAssets: number;
    pendingAssets: number;
  };
}>();

const emit = defineEmits<{
  (e: 'navigate', route: string): void;
}>();
</script>

<template>
  <Card hoverable glow glass class="assets-panel" padding="none">
    <div class="dashboard-panel-header">
      <div>
        <h3>作品资产</h3>
        <p>
          {{ contentSummary.approvedAssets }} 已通过 · {{ contentSummary.pendingAssets }} 审核中
        </p>
      </div>
      <Button
        variant="link"
        size="sm"
        :icon="ArrowRight"
        icon-position="right"
        @click="emit('navigate', '/my-works')"
      >
        管理
      </Button>
    </div>
    <div v-if="visibleAssets.length" class="asset-grid">
      <button
        v-for="asset in visibleAssets"
        :key="asset.id"
        type="button"
        class="asset-item group relative overflow-hidden rounded-xl border border-base bg-card transition-all duration-300"
        @click="emit('navigate', `/assets/${asset.id}`)"
      >
        <span class="asset-thumb">
          <img
            v-if="asset.thumbnail"
            :src="getAssetUrl(asset.thumbnail)"
            :alt="asset.title"
            loading="lazy"
            decoding="async"
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <ImageIcon v-else class="h-6 w-6 text-slate-400" />
        </span>
        <span
          class="asset-meta bg-slate-950/80 backdrop-blur-md border-t border-white/10 p-2 flex flex-col justify-end"
        >
          <strong class="text-[10px] text-white font-bold truncate">{{ asset.title }}</strong>
          <small class="text-[8px] text-white/75 font-semibold truncate">
            {{ asset.type || '3D 作品' }}
          </small>
        </span>
      </button>
    </div>
    <div v-else class="dashboard-panel-empty">
      <Upload class="h-8 w-8 opacity-40 mb-1" />
      <strong>还没有上传作品</strong>
    </div>
  </Card>
</template>

<style scoped>
.assets-panel {
  display: flex;
  flex-direction: column;
}

.dashboard-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-base);
}

.dashboard-panel-header h3 {
  font-size: 14px;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
}

.dashboard-panel-header p {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  margin: 2px 0 0;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.asset-item {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
  aspect-ratio: 4 / 3;
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 1px solid var(--border-base);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  background: var(--bg-card);
  cursor: pointer;
  width: 100%;
}

.asset-item:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card-hover);
}

.asset-thumb {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(245, 121, 42, 0.05) 100%);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.asset-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.asset-item:hover .asset-thumb img {
  transform: scale(1.05);
}

.asset-meta {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 8px;
  color: #fff;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  pointer-events: none;
}

.asset-meta strong {
  color: #fff;
  font-size: 11px;
  line-height: 1.2;
}

.asset-meta small {
  color: rgba(255, 255, 255, 0.7);
  font-size: 9px;
}

.dashboard-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: var(--text-muted);
  text-align: center;
}

.dashboard-panel-empty strong {
  font-size: 13px;
  font-weight: 600;
}
</style>
