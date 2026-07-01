<script setup lang="ts">
import { ref } from 'vue';
import { Eye, EyeOff, Loader2, PackageCheck, Plus, Search, Sparkles } from 'lucide-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import { useLabel } from '@/utils/i18n';
import ResourceSearchDialog from './ResourceSearchDialog.vue';

const label = useLabel();

const searchQuery = defineModel<string>('searchQuery', { required: true });
const isStatsExpanded = defineModel<boolean>('isStatsExpanded', { required: true });

defineProps<{
  activeTab: 'mine' | 'favorites';
  isLoading: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  publish: [];
}>();

const isSearchOpen = ref(false);
</script>

<template>
  <PageHeader
    :title="label('我的作品', 'My Works')"
    :subtitle="
      label(
        '统一管理资源、材料、插件和展示作品的发布状态。',
        'Unify management of publishing status for resources, materials, plugins, and showcases.',
      )
    "
    :icon="PackageCheck"
  >
    <template #center>
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
        <Search />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="
            label(
              '搜索标题、说明、标签或发布位置',
              'Search by title, description, tags, or publishing location',
            )
          "
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
      <Button
        v-if="activeTab === 'mine'"
        variant="secondary"
        size="sm"
        class="!h-8"
        @click="isStatsExpanded = !isStatsExpanded"
      >
        <component :is="isStatsExpanded ? EyeOff : Eye" class="w-3.5 h-3.5" />
        <span>{{
          isStatsExpanded ? label('收起指标', 'Hide Metrics') : label('数据指标', 'Show Metrics')
        }}</span>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        class="!h-8"
        :disabled="isLoading"
        @click="emit('refresh')"
      >
        <Loader2 v-if="isLoading" class="w-3.5 h-3.5 spinning" />
        <Sparkles v-else class="w-3.5 h-3.5" />
        <span>{{ label('刷新', 'Refresh') }}</span>
      </Button>
      <Button
        v-if="activeTab === 'mine'"
        variant="primary"
        size="sm"
        class="!h-8 cursor-pointer"
        @click="emit('publish')"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>{{ label('发布作品', 'Publish Work') }}</span>
      </Button>
    </div>
  </PageHeader>

  <ResourceSearchDialog v-model="isSearchOpen" />
</template>
