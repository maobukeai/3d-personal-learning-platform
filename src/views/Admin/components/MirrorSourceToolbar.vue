<script setup lang="ts">
import { computed } from 'vue';
import { Globe, Check, Square, X } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Tabs from '@/components/ui/Tabs.vue';
import type { MirrorSource } from '../AdminMirrorView.vue';

const props = defineProps<{
  sources: MirrorSource[];
  filteredSources: MirrorSource[];
}>();

const statusFilter = defineModel<'ALL' | 'ACTIVE' | 'PAUSED' | 'ERROR'>('statusFilter', {
  required: true,
});

const tabOptions = computed(() => [
  { label: `所有镜像源 (${props.sources.length})`, value: 'ALL', icon: Globe },
  {
    label: `启用 (${props.sources.filter((s) => s.status === 'ACTIVE').length})`,
    value: 'ACTIVE',
    icon: Check,
  },
  {
    label: `暂停 (${props.sources.filter((s) => s.status === 'PAUSED').length})`,
    value: 'PAUSED',
    icon: Square,
  },
  {
    label: `异常 (${props.sources.filter((s) => s.status === 'ERROR').length})`,
    value: 'ERROR',
    icon: X,
  },
]);
</script>

<template>
  <!-- Toolbar Card -->
  <Card padding="sm" class="workbench-toolbar-card">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div class="overflow-x-auto scrollbar-hide shrink-0 max-w-full mobile-row">
        <Tabs v-model="statusFilter" :options="tabOptions" size="sm" />
      </div>

      <!-- Filter count info -->
      <div class="flex items-center gap-3 shrink-0">
        <div class="text-[10px] font-bold text-slate-400 shrink-0">
          已过滤:
          <span class="text-blue-500 font-extrabold">{{ filteredSources.length }}</span> / 总计:
          {{ sources.length }}
        </div>
      </div>
    </div>
  </Card>
</template>
