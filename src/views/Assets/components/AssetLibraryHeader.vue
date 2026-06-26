<script setup lang="ts">
import { computed } from 'vue';
import { Box, Eye, EyeOff, BarChart3, UploadCloud, Search } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';

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
  <PageHeader
    :title="label('资源库', 'Asset Library')"
    :subtitle="label('模型、工程文件、贴图包与外链资产统一分发。', 'Distribute models, project files, texture packs, and external assets in one place.')"
    :icon="Box"
  >
    <template #center>
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
    </template>

    <div class="flex items-center gap-2 shrink-0">
      <Button variant="secondary" size="sm" class="!h-8" @click="emit('toggleStats')">
        <component :is="isStatsExpanded ? EyeOff : Eye" class="w-3.5 h-3.5" />
        <span>{{ isStatsExpanded ? label('收起指标', 'Hide Stats') : label('数据指标', 'Show Stats') }}</span>
      </Button>
      <Button variant="secondary" size="sm" class="!h-8" @click="emit('refreshStats')">
        <BarChart3 class="w-3.5 h-3.5" />
        <span>{{ label('更新统计', 'Refresh Stats') }}</span>
      </Button>
      <Button variant="primary" size="sm" class="!h-8 cursor-pointer" @click="emit('upload')">
        <UploadCloud class="w-3.5 h-3.5" />
        <span>{{ label('上传资源', 'Upload Asset') }}</span>
      </Button>
    </div>
  </PageHeader>
</template>
