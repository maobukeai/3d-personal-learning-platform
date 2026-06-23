<script setup lang="ts">
import { Puzzle, Search, Eye, EyeOff, RefreshCw, Plus } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';

const props = defineProps<{
  searchQuery: string;
  isLoading: boolean;
  isStatsExpanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'toggleStats'): void;
  (e: 'refresh'): void;
  (e: 'upload'): void;
}>();

const label = useLabel();

const onInput = (event: Event) => {
  emit('update:searchQuery', (event.target as HTMLInputElement).value);
};
</script>

<template>
  <header
    class="page-header flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0"
  >
    <div class="title-block flex-1 min-w-0">
      <div class="title-icon">
        <Puzzle class="icon-sm" />
      </div>
      <div>
        <h1>{{ label('Blender 插件库', 'Blender Add-ons') }}</h1>
        <p>
          {{
            label(
              '集中管理 Blender 建模、材质、动画、渲染等相关插件与创作工具。',
              'Manage Blender plugins, including modeling, materials, animation, rendering tools.',
            )
          }}
        </p>
      </div>
    </div>

    <div class="flex justify-center flex-1 w-full md:w-auto">
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
        <Search />
        <input
          :value="props.searchQuery"
          type="text"
          :placeholder="label('搜索插件、标签、兼容版本', 'Search plugins, tags, or versions')"
          @input="onInput"
          @keydown.enter="emit('refresh')"
        />
      </label>
    </div>

    <div class="header-actions flex-1 flex justify-end mobile-row">
      <button type="button" class="ghost-button" @click="emit('toggleStats')">
        <component :is="isStatsExpanded ? EyeOff : Eye" class="icon-sm" />
        {{ isStatsExpanded ? label('收起指标', 'Hide Stats') : label('数据指标', 'Show Stats') }}
      </button>
      <button type="button" class="ghost-button" :disabled="isLoading" @click="emit('refresh')">
        <RefreshCw class="icon-sm" :class="{ spinning: isLoading }" />
        {{ label('刷新', 'Refresh') }}
      </button>
      <button type="button" class="primary-button" @click="emit('upload')">
        <Plus class="icon-sm" />
        {{ label('上传插件', 'Upload Plugin') }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  min-height: 32px;
}

.title-block {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.title-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-subtle);
}

.title-block h1 {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  line-height: 1.2;
}

.title-block p {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 10px;
  margin-bottom: 0;
  line-height: 1.2;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-button,
.ghost-button {
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  border-radius: 6px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-base);
}

.primary-button {
  border-color: transparent;
  background: var(--accent);
  color: white;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
}

.primary-button:hover {
  background: var(--accent-hover);
  transform: translateY(-0.5px);
}

.ghost-button {
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.primary-button:disabled,
.ghost-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
