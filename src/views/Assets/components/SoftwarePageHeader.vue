<script setup lang="ts">
import { ref } from 'vue';
import { Laptop, Search, Eye, EyeOff, RefreshCw, Plus, Sparkles } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import ResourceSearchDialog from './ResourceSearchDialog.vue';

const searchQuery = defineModel<string>('searchQuery', { required: true });

defineProps<{
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'upload'): void;
  (e: 'success'): void;
}>();

const label = useLabel();

const isSearchOpen = ref(false);
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
          v-model="searchQuery"
          type="text"
          :placeholder="label('搜索软件、标签、兼容版本', 'Search softwares, tags, or versions')"
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
      <!-- Stats button removed -->
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
        <Plus class="w-3.5 h-3.5" />
        <span>{{ label('上传软件', 'Upload Software') }}</span>
      </Button>
    </div>
  </PageHeader>

  <ResourceSearchDialog v-model="isSearchOpen" @success="emit('success')" />
</template>
