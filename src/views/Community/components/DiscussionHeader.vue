<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Edit3, MessageSquare, RefreshCw, Search } from 'lucide-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';

defineProps<{
  title: string;
  subtitle: string;
  searchQuery: string;
  isLoading: boolean;
  isInsightsLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'refresh'): void;
  (e: 'create'): void;
}>();

const { t } = useI18n();

function handleInput(event: Event) {
  emit('update:searchQuery', (event.target as HTMLInputElement).value);
}
</script>

<template>
  <PageHeader :title="title" :subtitle="subtitle" :icon="MessageSquare">
    <template #center>
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
        <Search />
        <input
          :value="searchQuery"
          type="text"
          :placeholder="t('community.discussions.searchPlaceholder')"
          @input="handleInput"
        />
      </label>
    </template>

    <div class="discussion-header-actions mobile-row">
      <Button
        variant="outline"
        size="sm"
        class="!w-8 !h-8 !p-0 !rounded-lg shrink-0"
        :title="t('community.discussions.refresh')"
        @click="emit('refresh')"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading || isInsightsLoading }" />
      </Button>
      <Button
        variant="primary"
        size="sm"
        :icon="Edit3"
        class="!h-8 !rounded-lg shrink-0 font-bold"
        @click="emit('create')"
      >
        {{ t('community.discussions.newPost') }}
      </Button>
    </div>
  </PageHeader>
</template>

<style scoped>
.discussion-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
</style>
