<script setup lang="ts">
import { SlidersHorizontal, Layers, Tags, FolderOpen } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import Tabs from '@/components/ui/Tabs.vue';

type LibraryTab = 'explore' | 'favorites' | 'mine' | 'requests';
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

defineProps<{
  isOpen: boolean;
  activeCategory: string;
  activeTab: LibraryTab;
  myStatusFilter: StatusFilter;
  selectedTag: string;
  categoryTabOptions: { label: string; badge: number | string; value: string }[];
  statusTabOptions: { label: string; value: string }[];
  hotTags: { label: string; count: number }[];
  favoriteCategories?: string[];
  selectedFavoriteCategory?: string;
}>();

const emit = defineEmits<{
  (e: 'update:activeCategory', value: string): void;
  (e: 'update:myStatusFilter', value: StatusFilter): void;
  (e: 'update:selectedTag', value: string): void;
  (e: 'update:selectedFavoriteCategory', value: string): void;
  (e: 'fetchPlugins'): void;
  (e: 'rename-category', value: string): void;
  (e: 'delete-category', value: string): void;
  (e: 'create-category'): void;
}>();

const label = useLabel();

const onCategoryChange = (value: string | number | null) => {
  if (value === null) return;
  emit('update:activeCategory', String(value));
  emit('fetchPlugins');
};

const onStatusChange = (value: string | number | null) => {
  if (value === null) return;
  emit('update:myStatusFilter', value as StatusFilter);
};
</script>

<template>
  <aside class="filter-panel" :class="{ open: isOpen }">
    <!-- Favorite Categories folders filter -->
    <div v-if="activeTab === 'favorites'" class="panel-section mb-2">
      <div class="section-title flex justify-between items-center w-full">
        <div class="flex items-center gap-1.5">
          <FolderOpen class="icon-sm" />
          <span>{{ label('收藏夹分类', 'Favorite Folders') }}</span>
        </div>
        <button 
          type="button" 
          class="p-0.5 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded transition-all cursor-pointer border-0 bg-transparent flex items-center justify-center shrink-0"
          title="新建分类"
          @click.stop="emit('create-category')"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </button>
      </div>
      <div class="flex flex-col gap-1">
        <div 
          class="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border border-transparent"
          :class="selectedFavoriteCategory === 'all' || !selectedFavoriteCategory ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'"
          @click="emit('update:selectedFavoriteCategory', 'all')"
        >
          <span>{{ label('全部收藏', 'All Favorites') }}</span>
        </div>

        <div 
          v-for="cat in favoriteCategories"
          :key="cat"
          class="group flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all border border-transparent"
          :class="selectedFavoriteCategory === cat ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'"
          @click="emit('update:selectedFavoriteCategory', cat)"
        >
          <span class="truncate pr-2 flex-1 text-left">{{ cat }}</span>
          
          <div v-if="cat !== '默认'" class="hidden group-hover:flex items-center gap-1.5 shrink-0">
            <button 
              type="button"
              class="p-0.5 text-slate-400 hover:text-indigo-400 rounded transition-colors cursor-pointer border-0 bg-transparent"
              title="重命名"
              @click.stop="emit('rename-category', cat)"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button 
              type="button"
              class="p-0.5 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer border-0 bg-transparent"
              title="删除分类"
              @click.stop="emit('delete-category', cat)"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab !== 'favorites'" class="panel-section">
      <div class="section-title">
        <Layers class="icon-sm" />
        {{ label('分类', 'Categories') }}
      </div>
      <Tabs
        :model-value="activeCategory"
        :options="categoryTabOptions"
        direction="vertical"
        size="sm"
        @update:model-value="onCategoryChange"
      />
    </div>

    <div v-if="activeTab === 'mine'" class="panel-section">
      <div class="section-title">
        <SlidersHorizontal class="icon-sm" />
        {{ label('状态', 'Status') }}
      </div>
      <Tabs
        :model-value="myStatusFilter"
        :options="statusTabOptions"
        direction="vertical"
        size="sm"
        @update:model-value="onStatusChange"
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
          @click="emit('update:selectedTag', 'all')"
        >
          {{ label('全部', 'All') }}
        </button>
        <button
          v-for="tag in hotTags"
          :key="tag.label"
          type="button"
          :class="{ active: selectedTag === tag.label }"
          @click="emit('update:selectedTag', tag.label)"
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
