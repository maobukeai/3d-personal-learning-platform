<script setup lang="ts">
import Drawer from '@/components/ui/Drawer.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import { ExternalLink, Calendar, Clock, Tag as CategoryIcon, Edit2 } from 'lucide-vue-next';
import type {
  SmartSheetItem,
  RecordStatus,
  RecordPriority,
  SheetTemplateType,
} from '../types/sheet';

defineProps<{
  show: boolean;
  item: SmartSheetItem | null;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'edit', item: SmartSheetItem): void;
}>();

const templateMap: Record<
  SheetTemplateType,
  { label: string; variant: 'info' | 'primary' | 'warning' }
> = {
  STUDY_LOG: { label: '学习日志', variant: 'primary' },
  PROJECT_MILESTONE: { label: '项目里程碑', variant: 'warning' },
  RESOURCE_INVENTORY: { label: '资料积累', variant: 'info' },
};

const statusMap: Record<
  RecordStatus,
  { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }
> = {
  TODO: { label: '未开始', variant: 'info' },
  IN_PROGRESS: { label: '进行中', variant: 'warning' },
  COMPLETED: { label: '已完成', variant: 'success' },
  ARCHIVED: { label: '已归档', variant: 'danger' },
};

const priorityMap: Record<
  RecordPriority,
  { label: string; variant: 'info' | 'warning' | 'danger' }
> = {
  LOW: { label: '低优先级', variant: 'info' },
  MEDIUM: { label: '中优先级', variant: 'info' },
  HIGH: { label: '高优先级', variant: 'warning' },
  URGENT: { label: '紧急优先级', variant: 'danger' },
};
</script>

<template>
  <Drawer
    :model-value="show"
    title="条目详细备忘"
    size="md"
    direction="rtl"
    @update:model-value="emit('update:show', $event)"
  >
    <div v-if="item" class="space-y-6 p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <Badge :variant="templateMap[item.templateType]?.variant" outline class="mb-2">
            {{ templateMap[item.templateType]?.label }}
          </Badge>
          <h2 class="text-lg font-bold text-neutral-100">{{ item.title }}</h2>
        </div>
        <Button variant="outline" size="sm" @click="emit('edit', item)">
          <Edit2 class="w-4 h-4 mr-1" />
          编辑
        </Button>
      </div>

      <div class="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
        <div class="flex items-center gap-2 text-neutral-300">
          <CategoryIcon class="w-4 h-4 text-blue-400" />
          <span>分类：{{ item.category }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Badge :variant="statusMap[item.status]?.variant" dot>
            {{ statusMap[item.status]?.label }}
          </Badge>
        </div>
        <div class="flex items-center gap-2 text-neutral-300">
          <Clock class="w-4 h-4 text-emerald-400" />
          <span>时长：{{ item.durationMinutes ? `${item.durationMinutes} 分钟` : '未设定' }}</span>
        </div>
        <div class="flex items-center gap-2 text-neutral-300">
          <Calendar class="w-4 h-4 text-amber-400" />
          <span>日期：{{ item.dueDate || '未设定' }}</span>
        </div>
      </div>

      <div class="space-y-1">
        <span class="text-xs font-medium text-neutral-400">优先级状态</span>
        <div>
          <Badge :variant="priorityMap[item.priority]?.variant" outline>
            {{ priorityMap[item.priority]?.label }}
          </Badge>
        </div>
      </div>

      <div v-if="item.tags && item.tags.length" class="space-y-1.5">
        <span class="text-xs font-medium text-neutral-400">关联标签</span>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="tag in item.tags"
            :key="tag"
            class="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20"
          >
            #{{ tag }}
          </span>
        </div>
      </div>

      <div v-if="item.linkUrl" class="space-y-1">
        <span class="text-xs font-medium text-neutral-400">参考链接</span>
        <div>
          <a
            :href="item.linkUrl"
            target="_blank"
            class="text-xs text-blue-400 hover:underline flex items-center gap-1 truncate"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            {{ item.linkUrl }}
          </a>
        </div>
      </div>

      <div class="space-y-2 pt-2 border-t border-white/10">
        <span class="text-xs font-medium text-neutral-400">心得与富文本备注</span>
        <div
          class="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap min-h-[120px]"
        >
          {{ item.content || '暂无详细备注说明...' }}
        </div>
      </div>

      <div class="text-[11px] text-neutral-500 space-y-1 pt-4 border-t border-white/5">
        <div>创建时间：{{ new Date(item.createdAt).toLocaleString() }}</div>
        <div>最近修改：{{ new Date(item.updatedAt).toLocaleString() }}</div>
      </div>
    </div>
  </Drawer>
</template>
