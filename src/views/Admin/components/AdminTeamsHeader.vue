<script setup lang="ts">
import { Search, RefreshCw, Download, Plus } from 'lucide-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import Badge from '@/components/ui/Badge.vue';
import UiButton from '@/components/ui/Button.vue';
import { compactNumber } from './adminTeamsUtils';
import type { AdminTeamsSummary } from './adminTeamsTypes';

const props = defineProps<{
  searchQuery: string;
  isLoading: boolean;
  summary: AdminTeamsSummary;
  totalPending: number;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'refresh'): void;
  (e: 'export'): void;
  (e: 'create'): void;
}>();
</script>

<template>
  <PageHeader
    title="团队管理"
    subtitle="全站团队组织、协作规范及数据资产的合规统计与治理"
    variant="card"
  >
    <template #title-badge>
      <div class="flex flex-wrap items-center gap-1.5 ml-2">
        <Badge variant="info">团队数: {{ compactNumber(props.summary.totalTeams) }}</Badge>
        <Badge variant="info">成员数: {{ compactNumber(props.summary.totalMembers) }}</Badge>
        <Badge variant="info">待处理: {{ compactNumber(props.totalPending) }}</Badge>
      </div>
    </template>

    <template #center>
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
        <Search />
        <input
          :value="props.searchQuery"
          placeholder="搜索团队、负责人..."
          type="search"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </template>

    <UiButton
      variant="secondary"
      size="sm"
      :icon="RefreshCw"
      :loading="isLoading"
      @click="emit('refresh')"
    >
      刷新
    </UiButton>
    <UiButton variant="secondary" size="sm" :icon="Download" @click="emit('export')">
      导出
    </UiButton>
    <UiButton variant="primary" size="sm" :icon="Plus" @click="emit('create')"> 新建团队 </UiButton>
  </PageHeader>
</template>
