<script setup lang="ts">
import { Layers, PackageCheck, ShieldAlert } from 'lucide-vue-next';
import { type Component } from 'vue';
import Tabs from '@/components/ui/Tabs.vue';
import type { WorkKind, WorkStatus } from '../myWorksModel';

interface FilterTabOption {
  label?: string;
  value: string;
  badge?: number | string;
  icon?: Component;
}

const sourceFilter = defineModel<'ALL' | WorkKind>('sourceFilter', { required: true });
const statusFilter = defineModel<WorkStatus>('statusFilter', { required: true });

defineProps<{
  activeTab: 'mine' | 'favorites';
  sourceTabOptions: FilterTabOption[];
  statusTabOptions: FilterTabOption[];
}>();
</script>

<template>
  <aside class="filter-panel">
    <div class="panel-section">
      <div class="section-title">
        <Layers class="icon-sm" />
        发布位置
      </div>
      <Tabs v-model="sourceFilter" :options="sourceTabOptions" direction="vertical" size="sm" />
    </div>

    <div v-if="activeTab === 'mine'" class="panel-section">
      <div class="section-title">
        <PackageCheck class="icon-sm" />
        审核状态
      </div>
      <Tabs v-model="statusFilter" :options="statusTabOptions" direction="vertical" size="sm" />
    </div>

    <div v-if="activeTab === 'mine'" class="review-note">
      <ShieldAlert class="icon-sm" />
      <strong>审核流</strong>
      <p>编辑已通过内容后会回到待审核，管理员通过后重新公开。</p>
    </div>
  </aside>
</template>

<style scoped>
.icon-sm {
  width: 14px;
  height: 14px;
}

.filter-panel {
  width: 180px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
  align-self: start;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.review-note {
  display: grid;
  gap: 4px;
  margin-top: 4px;
  border: 1px solid rgba(217, 119, 6, 0.15);
  border-radius: 6px;
  background: rgba(217, 119, 6, 0.04);
  color: #d97706;
  padding: 8px;
}

.review-note strong {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.review-note p {
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.4;
  margin: 0;
}

@media (max-width: 980px) {
  .filter-panel {
    width: auto;
  }
}
</style>
