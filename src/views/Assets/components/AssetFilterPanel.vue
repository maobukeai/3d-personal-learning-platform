<script setup lang="ts">
import { computed } from 'vue';
import { Layers, PackageCheck, SlidersHorizontal, Tags } from 'lucide-vue-next';
import Tabs from '@/components/ui/Tabs.vue';
import { useLabel } from '@/utils/i18n';

interface TabOption {
  label: string;
  value: string;
  badge?: number;
}

interface HotTag {
  label: string;
}

type LibraryTab = 'explore' | 'favorites' | 'mine';

const props = defineProps<{
  isOpen: boolean;
  activeCategoryId: string;
  selectedFormat: string;
  selectedTag: string;
  myStatusFilter: string;
  activeTab: LibraryTab;
  categoryTabOptions: TabOption[];
  formatTabOptions: TabOption[];
  statusTabOptions: TabOption[];
  hotTags: HotTag[];
}>();

const emit = defineEmits<{
  (e: 'update:activeCategoryId', value: string): void;
  (e: 'update:selectedFormat', value: string): void;
  (e: 'update:selectedTag', value: string): void;
  (e: 'update:myStatusFilter', value: string): void;
}>();

const label = useLabel();

const localCategory = computed({
  get: () => props.activeCategoryId,
  set: (value) => emit('update:activeCategoryId', value),
});

const localFormat = computed({
  get: () => props.selectedFormat,
  set: (value) => emit('update:selectedFormat', value),
});

const localTag = computed({
  get: () => props.selectedTag,
  set: (value) => emit('update:selectedTag', value),
});

const localStatus = computed({
  get: () => props.myStatusFilter,
  set: (value) => emit('update:myStatusFilter', value),
});
</script>

<template>
  <aside class="filter-panel" :class="{ open: isOpen }">
    <div class="panel-section">
      <div class="section-title">
        <Layers class="icon-sm" />
        {{ label('分类', 'Categories') }}
      </div>
      <Tabs v-model="localCategory" :options="categoryTabOptions" direction="vertical" size="sm" />
    </div>

    <div class="panel-section">
      <div class="section-title">
        <PackageCheck class="icon-sm" />
        {{ label('格式', 'Formats') }}
      </div>
      <Tabs v-model="localFormat" :options="formatTabOptions" direction="vertical" size="sm" />
    </div>

    <div v-if="activeTab === 'mine'" class="panel-section">
      <div class="section-title">
        <SlidersHorizontal class="icon-sm" />
        {{ label('状态', 'Status') }}
      </div>
      <Tabs v-model="localStatus" :options="statusTabOptions" direction="vertical" size="sm" />
    </div>

    <div class="panel-section">
      <div class="section-title">
        <Tags class="icon-sm" />
        {{ label('热标签', 'Hot Tags') }}
      </div>
      <div class="tag-cloud">
        <button type="button" :class="{ active: localTag === 'all' }" @click="localTag = 'all'">
          {{ label('全部', 'All') }}
        </button>
        <button
          v-for="tag in hotTags"
          :key="tag.label"
          type="button"
          :class="{ active: localTag === tag.label }"
          @click="localTag = tag.label"
        >
          {{ tag.label }}
        </button>
      </div>
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
  min-width: 0;
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

@media (max-width: 860px) {
  .filter-panel {
    display: none;
  }

  .filter-panel.open {
    display: flex;
  }
}
</style>
