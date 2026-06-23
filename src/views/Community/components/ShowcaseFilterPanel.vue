<script setup lang="ts">
import type { Component } from 'vue';
import { Users, SlidersHorizontal, Layers3 } from 'lucide-vue-next';
import Tabs from '@/components/ui/Tabs.vue';
import type { ShowcaseType, ShowcaseScope, ShowcaseBucket } from './showcaseTypes';

interface OptionItem<T> {
  value: T;
  label: string;
  icon: Component;
}

defineProps<{
  isOpen: boolean;
  activeScope: ShowcaseScope;
  activeBucket: ShowcaseBucket;
  activeType: ShowcaseType | 'all';
  scopeOptions: OptionItem<ShowcaseScope>[];
  bucketOptions: OptionItem<ShowcaseBucket>[];
  typeOptions: OptionItem<ShowcaseType | 'all'>[];
}>();

const emit = defineEmits<{
  (e: 'update:activeScope', val: ShowcaseScope): void;
  (e: 'update:activeBucket', val: ShowcaseBucket): void;
  (e: 'update:activeType', val: ShowcaseType | 'all'): void;
}>();
</script>

<template>
  <aside class="filter-panel mobile-adaptive" :class="{ open: isOpen }">
    <div class="panel-section">
      <div class="section-title">
        <Users class="w-4 h-4 text-accent" />
        范围
      </div>
      <Tabs
        :model-value="activeScope"
        :options="scopeOptions"
        direction="vertical"
        size="sm"
        @update:model-value="(val: any) => emit('update:activeScope', val as ShowcaseScope)"
      />
    </div>

    <div class="panel-section">
      <div class="section-title">
        <SlidersHorizontal class="w-4 h-4 text-accent" />
        过滤
      </div>
      <Tabs
        :model-value="activeBucket"
        :options="bucketOptions"
        direction="vertical"
        size="sm"
        @update:model-value="(val: any) => emit('update:activeBucket', val as ShowcaseBucket)"
      />
    </div>

    <div class="panel-section">
      <div class="section-title">
        <Layers3 class="w-4 h-4 text-accent" />
        类型
      </div>
      <Tabs
        :model-value="activeType"
        :options="typeOptions"
        direction="vertical"
        size="sm"
        @update:model-value="(val: any) => emit('update:activeType', val as ShowcaseType | 'all')"
      />
    </div>
  </aside>
</template>

<style scoped>
.filter-panel {
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
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

@media (max-width: 1100px) {
  .filter-panel {
    display: none;
  }
  .filter-panel.open {
    display: flex;
    position: fixed;
    top: 50px;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    border-radius: 0;
    border: 0;
    background: var(--bg-card);
    overflow: auto;
  }
}
</style>
