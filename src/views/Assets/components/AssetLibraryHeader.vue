<script setup lang="ts">
import { computed } from 'vue';
import { Box, Eye, EyeOff, BarChart3, UploadCloud, Search } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';

const props = defineProps<{
  searchQuery: string;
  isStatsExpanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'toggleStats'): void;
  (e: 'refreshStats'): void;
  (e: 'upload'): void;
}>();

const label = useLabel();

const localSearch = computed({
  get: () => props.searchQuery,
  set: (value) => emit('update:searchQuery', value),
});
</script>

<template>
  <header
    class="page-header flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0"
  >
    <div class="title-block flex-1 min-w-0">
      <div class="title-icon">
        <Box class="icon-sm" />
      </div>
      <div class="min-w-0">
        <h1 class="truncate">{{ label('资源库', 'Asset Library') }}</h1>
        <p class="truncate">
          {{
            label(
              '模型、工程文件、贴图包与外链资产统一分发。',
              'Distribute models, project files, texture packs, and external assets in one place.',
            )
          }}
        </p>
      </div>
    </div>

    <div class="flex justify-center flex-1 w-full md:w-auto">
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
        <Search />
        <input
          v-model="localSearch"
          type="text"
          :placeholder="
            label('搜索资源名称、标签、作者或描述', 'Search names, tags, authors, or descriptions')
          "
        />
      </label>
    </div>

    <div class="header-actions flex-1 flex justify-end mobile-row">
      <button type="button" class="ghost-button" @click="emit('toggleStats')">
        <component :is="isStatsExpanded ? EyeOff : Eye" class="icon-sm" />
        {{ isStatsExpanded ? label('收起指标', 'Hide Stats') : label('数据指标', 'Show Stats') }}
      </button>
      <button type="button" class="ghost-button" @click="emit('refreshStats')">
        <BarChart3 class="icon-sm" />
        {{ label('更新统计', 'Refresh Stats') }}
      </button>
      <button type="button" class="primary-button" @click="emit('upload')">
        <UploadCloud class="icon-sm" />
        {{ label('上传资源', 'Upload Asset') }}
      </button>
    </div>
  </header>
</template>

<style scoped>
.page-header {
  justify-content: space-between;
  gap: 12px;
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
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-subtle);
  flex: 0 0 auto;
}

.title-block h1 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.title-block p {
  margin: 1px 0 0;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.2;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-sm {
  width: 14px;
  height: 14px;
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
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border-base);
}

.primary-button {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
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
</style>
