<script setup lang="ts">
import { computed } from 'vue';
import { Laptop, Search, RefreshCw, UploadCloud } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';

const props = defineProps<{
  searchQuery: string;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'open-search'): void;
  (e: 'refresh'): void;
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
    :title="label('软件库', 'Software Library')"
    :subtitle="
      label(
        '集中管理 3D 建模、渲染器、后期图像处理等创作软件。',
        'Manage 3D modeling, rendering, post processing, and game engines.',
      )
    "
    :icon="Laptop"
  >
    <template #center>
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
        <Search />
        <input
          v-model="localSearch"
          type="text"
          :placeholder="label('搜索软件名称、标签、兼容版本', 'Search names, tags, or versions')"
        />
      </label>
    </template>

    <div class="flex items-center gap-2 shrink-0">
      <Button
        variant="secondary"
        size="sm"
        class="!h-8"
        :disabled="isLoading"
        @click="emit('refresh')"
      >
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
        <span>{{ label('刷新', 'Refresh') }}</span>
      </Button>
      <Button variant="primary" size="sm" class="!h-8 cursor-pointer" @click="emit('upload')">
        <UploadCloud class="w-3.5 h-3.5" />
        <span>{{ label('上传软件', 'Upload Software') }}</span>
      </Button>
    </div>
  </PageHeader>
</template>
