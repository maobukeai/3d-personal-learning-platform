<script setup lang="ts">
import { computed } from 'vue';
import { Search, Plus, Upload, RefreshCw, Globe, Loader2, X, Layers } from 'lucide-vue-next';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import type { MirrorSource } from '../AdminMirrorView.vue';

const props = defineProps<{
  sources: MirrorSource[];
  isLoading: boolean;
}>();

const searchQuery = defineModel<string>('searchQuery', { required: true });

const emit = defineEmits<{
  create: [];
  importFile: [];
  scanCloud: [];
  refresh: [];
}>();

const consolidatedCards = computed(() => {
  const activeCount = props.sources.filter((s) => s.status === 'ACTIVE').length;
  const totalCount = props.sources.length;
  const totalResources = props.sources.reduce(
    (sum, s) => sum + (s._count?.resources || s.totalResources || 0),
    0,
  );
  const syncingCount = props.sources.filter((s) => s.syncStatus === 'SYNCING').length;
  const errorCount = props.sources.filter((s) => s.status === 'ERROR').length;
  const totalCategories = props.sources.reduce((sum, s) => sum + (s._count?.categories || 0), 0);

  return [
    {
      label: '可用镜像',
      value: `${activeCount}/${totalCount}`,
      hint: `${totalResources} 个资源`,
      icon: Globe,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: '运行中' },
    },
    {
      label: '同步中',
      value: syncingCount,
      hint: '当前后台镜像站同步中数',
      icon: Loader2,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      health: { label: syncingCount > 0 ? '同步中' : '空闲' },
    },
    {
      label: '异常源',
      value: errorCount,
      hint: '需查看网络或日志',
      icon: X,
      color: 'text-rose-600 bg-rose-500/10 border-rose-500/20',
      health: { label: errorCount > 0 ? '有异常' : '无异常' },
    },
    {
      label: '镜像分类',
      value: totalCategories,
      hint: '同步至系统内的分类数',
      icon: Layers,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health: { label: '资源目录' },
    },
  ];
});

const getBadgeVariant = (label: string) => {
  if (label === '运行中' || label === '无异常' || label === '空闲') return 'success';
  if (label === '有异常') return 'danger';
  if (label === '同步中') return 'warning';
  return 'primary';
};
</script>

<template>
  <PageHeader title="镜像源管理" variant="card">
    <template #title-badge>
      <div class="flex flex-wrap items-center gap-1.5 ml-2">
        <Badge variant="info"> 镜像源数: {{ sources.length }} </Badge>
      </div>
    </template>

    <template #center>
      <!-- Compact Search Box (Centered) -->
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
        <Search />
        <input v-model="searchQuery" type="text" placeholder="搜索镜像源..." />
      </label>
    </template>

    <!-- Actions -->
    <Button variant="primary" size="sm" :icon="Plus" @click="emit('create')"> 添加镜像源 </Button>
    <Button variant="secondary" size="sm" :icon="Upload" @click="emit('importFile')">
      导入镜像源
    </Button>
    <Button variant="secondary" size="sm" :icon="Search" @click="emit('scanCloud')">
      扫描云端镜像源
    </Button>
    <Button
      variant="secondary"
      size="sm"
      :icon="RefreshCw"
      :loading="isLoading"
      @click="emit('refresh')"
    >
      刷新
    </Button>
  </PageHeader>

  <!-- KPI Metrics Grid -->
  <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mobile-grid">
    <Card
      v-for="card in consolidatedCards"
      :key="card.label"
      hoverable
      glow
      class="group !p-2 px-2.5"
    >
      <div class="flex items-center justify-between w-full gap-3">
        <!-- Left: Icon & Info -->
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            class="panel-icon border border-base rounded-lg p-1.5 transition-transform group-hover:scale-105 shrink-0"
            :class="card.color"
          >
            <component :is="card.icon" class="h-3.5 w-3.5" />
          </span>
          <div class="min-w-0">
            <p class="text-[11px] font-bold text-[var(--text-secondary)] truncate leading-tight">
              {{ card.label }}
            </p>
            <p
              class="text-[9px] text-[var(--text-secondary)] opacity-80 truncate mt-0.5 leading-none"
              :title="card.hint"
            >
              {{ card.hint }}
            </p>
          </div>
        </div>

        <!-- Right: Metric & Health Badge -->
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-base font-black text-[var(--text-primary)] leading-none">
            {{ card.value }}
          </span>
          <Badge :variant="getBadgeVariant(card.health.label)">
            {{ card.health.label }}
          </Badge>
        </div>
      </div>
    </Card>
  </section>
</template>
