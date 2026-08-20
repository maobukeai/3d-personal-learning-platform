<script setup lang="ts">
import { computed } from 'vue';
import GlassCard from '@/components/ui/GlassCard.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import { Eye, Edit2, Trash2, Clock, Calendar as CalendarIcon } from 'lucide-vue-next';
import type { SmartSheetItem, RecordStatus, RecordPriority } from '../types/sheet';

const props = defineProps<{
  items: SmartSheetItem[];
}>();

const emit = defineEmits<{
  (e: 'view', item: SmartSheetItem): void;
  (e: 'edit', item: SmartSheetItem): void;
  (e: 'delete', id: string): void;
}>();

const columns: {
  status: RecordStatus;
  title: string;
  variant: 'info' | 'warning' | 'success' | 'danger';
}[] = [
  { status: 'TODO', title: '未开始', variant: 'info' },
  { status: 'IN_PROGRESS', title: '进行中', variant: 'warning' },
  { status: 'COMPLETED', title: '已完成', variant: 'success' },
  { status: 'ARCHIVED', title: '已归档', variant: 'danger' },
];

const itemsByStatus = computed(() => {
  const map: Record<RecordStatus, SmartSheetItem[]> = {
    TODO: [],
    IN_PROGRESS: [],
    COMPLETED: [],
    ARCHIVED: [],
  };
  props.items.forEach((item) => {
    if (map[item.status]) {
      map[item.status].push(item);
    }
  });
  return map;
});

const priorityMap: Record<
  RecordPriority,
  { label: string; variant: 'info' | 'warning' | 'danger' }
> = {
  LOW: { label: '低优先级', variant: 'info' },
  MEDIUM: { label: '中优先级', variant: 'info' },
  HIGH: { label: '高优先级', variant: 'warning' },
  URGENT: { label: '紧急', variant: 'danger' },
};
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
    <div
      v-for="col in columns"
      :key="col.status"
      class="flex flex-col rounded-xl border border-white/10 bg-white/5 p-3 min-h-[400px]"
    >
      <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
        <div class="flex items-center gap-2">
          <Badge :variant="col.variant" dot>
            {{ col.title }}
          </Badge>
          <span class="text-xs text-neutral-400 font-mono">
            ({{ itemsByStatus[col.status]?.length || 0 }})
          </span>
        </div>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto max-h-[650px] pr-1">
        <GlassCard
          v-for="item in itemsByStatus[col.status]"
          :key="item.id"
          class="p-3 glass-real-physical hover:border-white/20 transition-all group"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <h4 class="font-medium text-sm text-neutral-100 line-clamp-2">{{ item.title }}</h4>
            <Badge :variant="priorityMap[item.priority]?.variant" size="sm" outline>
              {{ priorityMap[item.priority]?.label }}
            </Badge>
          </div>

          <div class="text-xs text-neutral-400 mb-3 flex items-center justify-between">
            <span class="px-1.5 py-0.5 rounded bg-white/5 border border-white/5">{{
              item.category
            }}</span>
            <span v-if="item.durationMinutes" class="flex items-center gap-1 text-emerald-400/90">
              <Clock class="w-3 h-3" />
              {{ item.durationMinutes }}m
            </span>
          </div>

          <div v-if="item.tags && item.tags.length" class="flex flex-wrap gap-1 mb-3">
            <span
              v-for="tag in item.tags"
              :key="tag"
              class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300"
            >
              #{{ tag }}
            </span>
          </div>

          <div
            class="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-neutral-400"
          >
            <span class="flex items-center gap-1 text-[11px]">
              <CalendarIcon class="w-3 h-3" />
              {{ item.dueDate || '未定日期' }}
            </span>

            <div
              class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity"
            >
              <Button
                variant="glass"
                size="sm"
                class="h-6 w-6 p-0"
                title="详情"
                @click="emit('view', item)"
              >
                <Eye class="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="glass"
                size="sm"
                class="h-6 w-6 p-0"
                title="编辑"
                @click="emit('edit', item)"
              >
                <Edit2 class="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="glass"
                size="sm"
                class="h-6 w-6 p-0"
                title="删除"
                @click="emit('delete', item.id)"
              >
                <Trash2 class="w-3.5 h-3.5 text-red-400" />
              </Button>
            </div>
          </div>
        </GlassCard>

        <div
          v-if="!itemsByStatus[col.status]?.length"
          class="h-24 border border-dashed border-white/10 rounded-xl flex items-center justify-center text-xs text-neutral-500"
        >
          暂无{{ col.title }}事项
        </div>
      </div>
    </div>
  </div>
</template>
