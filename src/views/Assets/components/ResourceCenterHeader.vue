<script setup lang="ts">
import { ref } from 'vue';
import { FileStack, Search, Eye, EyeOff, RefreshCw, UploadCloud, Sparkles } from 'lucide-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import { useLabel } from '@/utils/i18n';
import ResourceSearchDialog from './ResourceSearchDialog.vue';

const label = useLabel();

const searchQuery = defineModel<string>('searchQuery', { required: true });

defineProps<{
  isLoading: boolean;
  isFeedLoading: boolean;
  isStatsExpanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleStats'): void;
  (e: 'refresh'): void;
  (e: 'publish'): void;
}>();

const isSearchOpen = ref(false);
</script>

<template>
  <PageHeader
    :title="label('资源中心', 'Resource Center')"
    :subtitle="
      label(
        '统一查看资源、材质、插件和作品展示的运营状态。',
        'Unify viewing of operational status for resources, materials, plug-ins and showcases.',
      )
    "
    :icon="FileStack"
  >
    <template #center>
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
        <Search />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="label('搜索最近内容、作者或标签', 'Search recent content, author, or tags')"
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
          isStatsExpanded ? label('收起指标', 'Hide Metrics') : label('数据指标', 'Show Metrics')
        }}</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        class="!h-8"
        :disabled="isLoading || isFeedLoading"
        @click="emit('refresh')"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading || isFeedLoading }" />
        <span>{{ label('刷新', 'Refresh') }}</span>
      </Button>
      <Button variant="primary" size="sm" class="!h-8 cursor-pointer" @click="emit('publish')">
        <UploadCloud class="w-3.5 h-3.5" />
        <span>{{ label('发布内容', 'Publish Content') }}</span>
      </Button>
    </div>
  </PageHeader>

  <ResourceSearchDialog v-model="isSearchOpen" />
</template>
