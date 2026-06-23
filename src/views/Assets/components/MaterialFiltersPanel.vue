<script setup lang="ts">
import { Layers, PackageCheck, Tags, SlidersHorizontal } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import Tabs from '@/components/ui/Tabs.vue';

type LibraryTab = 'explore' | 'favorites' | 'mine';
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';
type ProceduralFilter = 'all' | 'true' | 'false';

interface HotTag {
  label: string;
  count: number;
}

const props = defineProps<{
  isOpen: boolean;
  activeTab: LibraryTab;
  activeCategory: string;
  selectedResolution: string;
  selectedTag: string;
  selectedProcedural: ProceduralFilter;
  myStatusFilter: StatusFilter;
  categoryOptions: { label: string; value: string; badge?: number | string }[];
  resolutionOptions: { label: string; value: string; badge?: number | string }[];
  proceduralOptions: { label: string; value: string; badge?: number | string }[];
  statusOptions: { label: string; value: string; badge?: number | string }[];
  hotTags: HotTag[];
}>();

const emit = defineEmits<{
  (e: 'update:category', value: string): void;
  (e: 'update:resolution', value: string): void;
  (e: 'update:tag', value: string): void;
  (e: 'update:procedural', value: ProceduralFilter): void;
  (e: 'update:status', value: StatusFilter): void;
}>();

const label = useLabel();

const onCategoryChange = (value: string | number | null) => emit('update:category', String(value));
const onResolutionChange = (value: string | number | null) =>
  emit('update:resolution', String(value));
const onProceduralChange = (value: string | number | null) =>
  emit('update:procedural', String(value) as ProceduralFilter);
const onStatusChange = (value: string | number | null) =>
  emit('update:status', String(value) as StatusFilter);
</script>

<template>
  <aside class="filter-panel" :class="{ open: props.isOpen }">
    <div class="panel-section">
      <div class="section-title">
        <Layers class="icon-sm" />
        {{ label('分类', 'Categories') }}
      </div>
      <Tabs
        :model-value="activeCategory"
        :options="categoryOptions"
        direction="vertical"
        size="sm"
        @update:model-value="onCategoryChange"
      />
    </div>

    <div class="panel-section">
      <div class="section-title">
        <PackageCheck class="icon-sm" />
        {{ label('分辨率', 'Resolution') }}
      </div>
      <Tabs
        :model-value="selectedResolution"
        :options="resolutionOptions"
        direction="vertical"
        size="sm"
        @update:model-value="onResolutionChange"
      />
    </div>

    <div class="panel-section">
      <div class="section-title">
        <Tags class="icon-sm" />
        {{ label('类型', 'Type') }}
      </div>
      <Tabs
        :model-value="selectedProcedural"
        :options="proceduralOptions"
        direction="vertical"
        size="sm"
        @update:model-value="onProceduralChange"
      />
    </div>

    <div v-if="hotTags.length" class="panel-section">
      <div class="section-title">
        <Tags class="icon-sm" />
        {{ label('热标签', 'Hot Tags') }}
      </div>
      <div class="tag-cloud">
        <button
          type="button"
          :class="{ active: selectedTag === 'all' }"
          @click="emit('update:tag', 'all')"
        >
          {{ label('全部', 'All') }}
        </button>
        <button
          v-for="tag in hotTags"
          :key="tag.label"
          type="button"
          :class="{ active: selectedTag === tag.label }"
          @click="emit('update:tag', tag.label)"
        >
          {{ tag.label }}
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'mine'" class="panel-section">
      <div class="section-title">
        <SlidersHorizontal class="icon-sm" />
        {{ label('状态', 'Status') }}
      </div>
      <Tabs
        :model-value="myStatusFilter"
        :options="statusOptions"
        direction="vertical"
        size="sm"
        @update:model-value="onStatusChange"
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

.icon-sm {
  width: 14px;
  height: 14px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-cloud button {
  height: 24px;
  border: 0;
  border-radius: 9999px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 0 10px;
  font-size: 10px;
  font-weight: 500;
  transition: all 0.15s ease;
  cursor: pointer;
}

.tag-cloud button:hover {
  background: var(--bg-active);
  color: var(--accent);
  transform: translateY(-0.5px);
}

.tag-cloud button.active {
  background: var(--accent-subtle);
  color: var(--accent);
  font-weight: 600;
}

@media (max-width: 980px) {
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
