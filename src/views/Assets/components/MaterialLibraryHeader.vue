<script setup lang="ts">
import { computed, ref } from 'vue';
import { Layers, Search, Eye, EyeOff, Heart, UploadCloud, Sparkles } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import ResourceSearchDialog from './ResourceSearchDialog.vue';

const props = defineProps<{
  searchQuery: string;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'showFavorites'): void;
  (e: 'upload'): void;
  (e: 'success'): void;
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
    :title="label('材质库', 'Material Library')"
    :subtitle="
      label(
        'PBR 贴图、程序化材质、纹理包统一管理。',
        'PBR maps, procedural materials, and texture packs managed in one place.',
      )
    "
    :icon="Layers"
  >
    <template #center>
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
        <Search />
        <input
          v-model="localSearch"
          type="text"
          :placeholder="label('搜索名称、标签、说明', 'Search name, tags, or description')"
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
      <Button variant="secondary" size="sm" class="!h-8" @click="emit('showFavorites')">
        <Heart class="w-3.5 h-3.5" />
        <span>{{ label('收藏', 'Favorites') }}</span>
      </Button>
      <Button variant="primary" size="sm" class="!h-8 cursor-pointer" @click="emit('upload')">
        <UploadCloud class="w-3.5 h-3.5" />
        <span>{{ label('上传', 'Upload') }}</span>
      </Button>
    </div>
  </PageHeader>

  <ResourceSearchDialog v-model="isSearchOpen" @success="emit('success')" />
</template>
