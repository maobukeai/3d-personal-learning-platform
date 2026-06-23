<script setup lang="ts">
import { type Component } from 'vue';
import { Workflow, TrendingUp } from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';

interface ReviewQueue {
  key: string;
  label: string;
  icon?: Component;
  route: string;
  total: number;
  items: Array<{ id: string; title?: string; name?: string; createdAt: string }>;
}

interface PipelineCard {
  label: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  route: string;
  color: string;
}

interface GrowthBar {
  label: string;
  value: number;
  base: number;
  tone: string;
}

interface Props {
  reviewQueues: ReviewQueue[];
  pipelineCards: PipelineCard[];
  growthBars: GrowthBar[];
}

defineProps<Props>();

const emit = defineEmits(['navigate']);

const ratio = (value: number, total: number) => {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
};

const getPipelineWidth = (value: number, total: number) => `${ratio(value, total)}%`;
const getGrowthWidth = (value: number, base: number) => `${Math.max(4, ratio(value, base))}%`;

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
</script>

<template>
  <div class="space-y-3">
    <!-- Unified Content Audit & Pipelines Hub -->
    <Card padding="sm">
      <template #header>
        <div class="flex items-center justify-between w-full">
          <div>
            <h2
              class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
            >
              <Workflow class="h-4 w-4 text-[var(--accent)]" />
              内容审核与流转管线
            </h2>
            <p class="text-[10px] text-[var(--text-secondary)] mt-0.5">
              监控平台内容生产管线并处理待审队列。
            </p>
          </div>
          <Button variant="link" size="sm" @click="emit('navigate', '/admin/audits')">
            进入审核中心
          </Button>
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5 mobile-grid">
        <Card
          v-for="(queue, index) in reviewQueues"
          :key="queue.key"
          padding="sm"
          class="bg-subtle/40 border-base"
        >
          <!-- Top Part: Pipeline Card equivalent -->
          <div v-if="pipelineCards[index]" class="pb-1.5 border-b border-base/40 mb-2">
            <div class="flex items-center justify-between mb-1">
              <span
                class="inline-flex items-center gap-1 text-[11px] font-black text-[var(--text-primary)]"
              >
                <component :is="queue.icon" class="h-3.5 w-3.5 text-[var(--accent)]" />
                {{ queue.label }}
              </span>
              <div class="flex items-center gap-1">
                <span class="text-xs font-black text-[var(--text-primary)]">{{
                  pipelineCards[index].total
                }}</span>
                <span class="text-[9px] text-slate-400">总数</span>
              </div>
            </div>

            <!-- Pipeline Visual Bar -->
            <div class="flex h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5 my-1">
              <span
                class="bg-emerald-500 rounded-l"
                :style="{
                  width: getPipelineWidth(
                    pipelineCards[index].approved,
                    pipelineCards[index].total,
                  ),
                }"
              ></span>
              <span
                class="bg-amber-500"
                :style="{
                  width: getPipelineWidth(pipelineCards[index].pending, pipelineCards[index].total),
                }"
              ></span>
              <span
                class="bg-rose-500 rounded-r"
                :style="{
                  width: getPipelineWidth(
                    pipelineCards[index].rejected,
                    pipelineCards[index].total,
                  ),
                }"
              ></span>
            </div>

            <!-- Stats details -->
            <div
              class="flex justify-between items-center text-[9px] text-[var(--text-secondary)] font-bold px-0.5"
            >
              <span class="text-emerald-500">通过 {{ pipelineCards[index].approved }}</span>
              <span class="text-amber-500">待审 {{ pipelineCards[index].pending }}</span>
              <span class="text-rose-500">打回 {{ pipelineCards[index].rejected }}</span>
            </div>
          </div>

          <!-- Bottom Part: Queue Item list -->
          <div class="flex-1 flex flex-col justify-between">
            <div>
              <div
                class="flex items-center justify-between text-[9px] font-bold text-[var(--text-secondary)] mb-1.5"
              >
                <span>待审队列</span>
                <Badge :variant="queue.total > 0 ? 'warning' : 'info'">
                  {{ queue.total }} 个待处理
                </Badge>
              </div>
              <div class="space-y-1">
                <button
                  v-for="item in queue.items.slice(0, 2)"
                  :key="item.id"
                  type="button"
                  class="w-full flex items-center justify-between gap-2 p-1.5 border border-base rounded bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-[11px] cursor-pointer"
                  @click="emit('navigate', queue.route)"
                >
                  <span class="truncate font-medium text-[var(--text-primary)]">{{
                    item.title || item.name || '未命名内容'
                  }}</span>
                  <small class="text-slate-400 shrink-0 text-[9px]">{{
                    formatDate(item.createdAt)
                  }}</small>
                </button>
                <div
                  v-if="queue.items.length === 0"
                  class="empty-line py-3 text-center text-[10px] text-slate-400 border border-dashed border-base rounded-lg"
                >
                  暂无待审内容
                </div>
              </div>
            </div>

            <button
              v-if="queue.total > 2"
              type="button"
              class="mt-2 text-center text-[9px] font-black text-[var(--accent)] hover:underline cursor-pointer"
              @click="emit('navigate', queue.route)"
            >
              全部 {{ queue.total }} 个待审...
            </button>
          </div>
        </Card>
      </div>
    </Card>

    <!-- Growth Snapshot Card -->
    <Card padding="sm">
      <template #header>
        <h2
          class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
        >
          <TrendingUp class="h-4 w-4 text-[var(--accent)]" />
          趋势与成长快照
        </h2>
      </template>
      <div class="grid grid-cols-2 gap-2 mobile-grid">
        <div
          v-for="item in growthBars"
          :key="item.label"
          class="border border-base rounded-lg p-2 bg-subtle"
        >
          <span class="text-[9px] text-slate-500 font-bold block">{{ item.label }}</span>
          <b class="text-base font-black block mt-0.5 text-[var(--text-primary)]">{{
            item.value
          }}</b>
          <div class="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-1.5">
            <em
              class="block h-full rounded-full"
              :class="item.tone"
              :style="{ width: getGrowthWidth(item.value, item.base) }"
            ></em>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
