<script setup lang="ts">
import { ref } from 'vue';
import { Puzzle, Search, Eye, EyeOff, RefreshCw, Plus, Sparkles } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import ResourceSearchDialog from './ResourceSearchDialog.vue';

const searchQuery = defineModel<string>('searchQuery', { required: true });

defineProps<{
  isLoading: boolean;
  isStatsExpanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleStats'): void;
  (e: 'refresh'): void;
  (e: 'upload'): void;
}>();

const label = useLabel();

const isSearchOpen = ref(false);
</script>

<template>
  <PageHeader
    :title="label('Blender 插件库', 'Blender Add-ons')"
    :subtitle="
      label(
        '集中管理 Blender 建模、材质、动画、渲染等相关插件与创作工具。',
        'Manage Blender plugins, including modeling, materials, animation, rendering tools.',
      )
    "
    :icon="Puzzle"
  >
    <template #center>
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
        <Search />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="label('搜索插件、标签、兼容版本', 'Search plugins, tags, or versions')"
          @keydown.enter="emit('refresh')"
        />
      </label>
    </template>

    <div class="flex items-center gap-2 shrink-0">
      <Button
        variant="secondary"
        size="sm"
        class="!h-8 !text-indigo-400 border-indigo-500/25 hover:bg-indigo-500/[0.05]"
        @click="isSearchOpen = true"
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>{{ label('AI 全网搜', 'AI Search') }}</span>
      </Button>
      <Button variant="secondary" size="sm" class="!h-8" @click="emit('toggleStats')">
        <component :is="isStatsExpanded ? EyeOff : Eye" class="w-3.5 h-3.5" />
        <span>{{
          isStatsExpanded ? label('收起指标', 'Hide Stats') : label('数据指标', 'Show Stats')
        }}</span>
      </Button>
      <Button variant="secondary" size="sm" class="!h-8" :disabled="isLoading" @click="emit('refresh')">
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
        <span>{{ label('刷新', 'Refresh') }}</span>
      </Button>
      <Button variant="primary" size="sm" class="!h-8 cursor-pointer" @click="emit('upload')">
        <Plus class="w-3.5 h-3.5" />
        <span>{{ label('上传插件', 'Upload Plugin') }}</span>
      </Button>
    </div>
  </PageHeader>

  <ResourceSearchDialog v-model="isSearchOpen" />
</template>
