<script setup lang="ts">
import { computed, ref } from 'vue';
import GlassCard from '@/components/ui/GlassCard.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import { Trash2, Star, Plus } from 'lucide-vue-next';
import type { CustomSheetTable, SheetRowData, SheetColumnDef } from '../types/sheet';

const props = defineProps<{
  table: CustomSheetTable;
  rows: SheetRowData[];
}>();

const emit = defineEmits<{
  (e: 'update-cell', rowId: string, colId: string, value: any): void;
  (e: 'delete-row', rowId: string): void;
  (e: 'add-row'): void;
}>();

const selectColumns = computed(() => {
  return props.table.columns.filter((c) => c.type === 'select');
});

const activeSelectColId = ref<string>('');

const currentSelectCol = computed<SheetColumnDef | null>(() => {
  if (activeSelectColId.value) {
    return (
      selectColumns.value.find((c) => c.id === activeSelectColId.value) ||
      selectColumns.value[0] ||
      null
    );
  }
  return selectColumns.value[0] || null;
});

const columnsList = computed(() => {
  if (!currentSelectCol.value || !currentSelectCol.value.options) return [];
  return currentSelectCol.value.options;
});

const rowsByOption = computed(() => {
  const map: Record<string, SheetRowData[]> = {};
  columnsList.value.forEach((opt) => {
    map[opt.id] = [];
  });
  map['unassigned'] = [];

  const colId = currentSelectCol.value?.id;
  if (!colId) return map;

  props.rows.forEach((row) => {
    const val = row.cells[colId];
    if (val && map[val]) {
      map[val].push(row);
    } else {
      map['unassigned'].push(row);
    }
  });
  return map;
});
</script>

<template>
  <div class="space-y-4">
    <!-- 如果没有 Select 列 -->
    <div
      v-if="!selectColumns.length"
      class="p-8 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md"
    >
      <EmptyState
        title="看板视图需要表内存在「单选标签 (Select)」列"
        description="请在表格中添加一个单选标签列（例如：心情、分类、等级、状态），系统将自动生成看板分栏"
      />
    </div>

    <template v-else>
      <!-- 如果有多个 Select 列，允许切换选择 -->
      <div
        v-if="selectColumns.length > 1"
        class="flex items-center gap-2 mb-2 text-xs text-neutral-300"
      >
        <span>看板分组基准列：</span>
        <select
          v-model="activeSelectColId"
          class="bg-white/10 border border-white/10 rounded px-2 py-1 outline-none text-white"
        >
          <option
            v-for="col in selectColumns"
            :key="col.id"
            :value="col.id"
            class="bg-neutral-900 text-neutral-100"
          >
            {{ col.name }}
          </option>
        </select>
      </div>

      <!-- 看板列布局 -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div
          v-for="opt in columnsList"
          :key="opt.id"
          class="flex flex-col rounded-xl border border-white/10 bg-white/5 p-3 min-h-[360px]"
        >
          <div class="flex items-center justify-between pb-2.5 border-b border-white/10 mb-3">
            <div class="flex items-center gap-2">
              <Badge variant="primary" outline>
                {{ opt.label }}
              </Badge>
              <span class="text-xs font-mono text-neutral-400">
                ({{ rowsByOption[opt.id]?.length || 0 }})
              </span>
            </div>
          </div>

          <div class="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
            <GlassCard
              v-for="row in rowsByOption[opt.id] || []"
              :key="row.id"
              class="p-3 glass-real-physical hover:border-white/20 transition-all group"
            >
              <div class="space-y-2">
                <div v-for="col in table.columns.slice(0, 4)" :key="col.id" class="text-xs">
                  <span class="text-[10px] text-neutral-400 block">{{ col.name }}</span>
                  <div class="text-neutral-200 font-medium truncate">
                    <template v-if="col.type === 'rating'">
                      <span class="text-amber-400">★ {{ row.cells[col.id] || 0 }}</span>
                    </template>
                    <template v-else-if="col.type === 'checkbox'">
                      <span>{{ row.cells[col.id] ? '☑ 已完成' : '☐ 未完成' }}</span>
                    </template>
                    <template v-else>
                      {{ row.cells[col.id] || '-' }}
                    </template>
                  </div>
                </div>
              </div>

              <div class="pt-2 border-t border-white/5 flex items-center justify-end mt-2">
                <button
                  class="text-neutral-500 hover:text-red-400 opacity-80 group-hover:opacity-100"
                  title="删除"
                  @click="emit('delete-row', row.id)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
