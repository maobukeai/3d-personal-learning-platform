<script setup lang="ts">
import Table from '@/components/ui/Table.vue';
import TableColumn from '@/components/ui/TableColumn.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import { Eye, Edit2, Trash2, ExternalLink } from 'lucide-vue-next';
import type {
  SmartSheetItem,
  RecordStatus,
  RecordPriority,
  SheetTemplateType,
} from '../types/sheet';

defineProps<{
  items: SmartSheetItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'view', item: SmartSheetItem): void;
  (e: 'edit', item: SmartSheetItem): void;
  (e: 'delete', id: string): void;
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
  LOW: { label: '低', variant: 'info' },
  MEDIUM: { label: '中', variant: 'info' },
  HIGH: { label: '高', variant: 'warning' },
  URGENT: { label: '紧急', variant: 'danger' },
};
</script>

<template>
  <div class="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md overflow-hidden">
    <Table :data="items" :loading="loading" row-key="id">
      <TableColumn label="主题 / 标题" width="280">
        <template #default="{ row }">
          <div class="flex items-center gap-2">
            <Badge
              :variant="templateMap[row.templateType as SheetTemplateType]?.variant || 'info'"
              size="sm"
              outline
            >
              {{ templateMap[row.templateType as SheetTemplateType]?.label }}
            </Badge>
            <span class="font-medium text-neutral-100 truncate max-w-[200px]" :title="row.title">
              {{ row.title }}
            </span>
          </div>
        </template>
      </TableColumn>

      <TableColumn label="分类" width="120">
        <template #default="{ row }">
          <span class="text-neutral-300 text-xs px-2 py-1 rounded bg-white/5 border border-white/5">
            {{ row.category || '未分类' }}
          </span>
        </template>
      </TableColumn>

      <TableColumn label="状态" width="110">
        <template #default="{ row }">
          <Badge :variant="statusMap[row.status as RecordStatus]?.variant || 'info'" dot>
            {{ statusMap[row.status as RecordStatus]?.label }}
          </Badge>
        </template>
      </TableColumn>

      <TableColumn label="优先级" width="100">
        <template #default="{ row }">
          <Badge :variant="priorityMap[row.priority as RecordPriority]?.variant || 'info'" outline>
            {{ priorityMap[row.priority as RecordPriority]?.label }}
          </Badge>
        </template>
      </TableColumn>

      <TableColumn label="时长(分)" width="90" align="center">
        <template #default="{ row }">
          <span class="text-neutral-300">{{
            row.durationMinutes ? `${row.durationMinutes}m` : '-'
          }}</span>
        </template>
      </TableColumn>

      <TableColumn label="目标日期" width="110">
        <template #default="{ row }">
          <span class="text-neutral-400 text-xs">{{ row.dueDate || '-' }}</span>
        </template>
      </TableColumn>

      <TableColumn label="标签" width="160">
        <template #default="{ row }">
          <div class="flex flex-wrap gap-1">
            <span
              v-for="tag in (row.tags || []).slice(0, 2)"
              :key="tag"
              class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300"
            >
              #{{ tag }}
            </span>
            <span v-if="(row.tags || []).length > 2" class="text-[10px] text-neutral-400">
              +{{ row.tags.length - 2 }}
            </span>
          </div>
        </template>
      </TableColumn>

      <TableColumn label="操作" width="130" align="right">
        <template #default="{ row }">
          <div class="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0"
              title="查看明细"
              @click="emit('view', row)"
            >
              <Eye class="w-3.5 h-3.5 text-neutral-400 hover:text-white" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0"
              title="编辑"
              @click="emit('edit', row)"
            >
              <Edit2 class="w-3.5 h-3.5 text-neutral-400 hover:text-white" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              class="h-7 w-7 p-0"
              title="删除"
              @click="emit('delete', row.id)"
            >
              <Trash2 class="w-3.5 h-3.5 text-red-400/80 hover:text-red-400" />
            </Button>

            <a
              v-if="row.linkUrl"
              :href="row.linkUrl"
              target="_blank"
              class="p-1.5 text-neutral-400 hover:text-blue-400"
              title="打开外链"
            >
              <ExternalLink class="w-3.5 h-3.5" />
            </a>
          </div>
        </template>
      </TableColumn>
    </Table>

    <div v-if="!loading && items.length === 0" class="p-8">
      <EmptyState
        title="暂无备忘录记录"
        description="您可以点击右上角「新建记录」添加第一条多维备忘项"
      />
    </div>
  </div>
</template>
