<script setup lang="ts">
import { computed, ref } from 'vue';
import { Box, Eye, EyeOff, BarChart3, UploadCloud, Search, Sparkles } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import ResourceSearchDialog from './ResourceSearchDialog.vue';

const props = defineProps<{
  searchQuery: string;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'upload'): void;
}>();

const label = useLabel();

const localSearch = computed({
  get: () => props.searchQuery,
  set: (value) => emit('update:searchQuery', value),
});

const isSearchOpen = ref(false);
</script>

<template>
  <PageHeader
    :title="label('模型库', 'Model Library')"
    :subtitle="
      label(
        '模型、工程文件、贴图包与外链资产统一分发。',
        'Distribute models, project files, texture packs, and external assets in one place.',
      )
    "
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
      <Button
        variant="secondary"
        size="sm"
        class="!h-8 !text-indigo-400 border-indigo-500/25 hover:bg-indigo-500/[0.05]"
        @click="isSearchOpen = true"
      >
        <Sparkles class="w-3.5 h-3.5" />
        <span>{{ label('AI 全网搜', 'AI Search') }}</span>
      </Button>
      <!-- Stats buttons removed -->
      <Button variant="primary" size="sm" class="!h-8 cursor-pointer" @click="emit('upload')">
        <UploadCloud class="w-3.5 h-3.5" />
        <span>{{ label('上传资源', 'Upload Asset') }}</span>
      </Button>
    </div>
  </PageHeader>

  <ResourceSearchDialog v-model="isSearchOpen" />
</template>
