<script setup lang="ts">
import { ref } from 'vue';
import { useTableSummary } from '../composables/useTableSummary';
import { ChevronDown } from 'lucide-vue-next';
import type { SheetColumnDef, SheetRowData, ColumnSummaryType } from '../types/sheet';

const props = defineProps<{
  columns: SheetColumnDef[];
  rows: SheetRowData[];
}>();

const emit = defineEmits<{
  (e: 'update-summary-type', colId: string, type: ColumnSummaryType): void;
}>();

const { calculateColumnSummary, getDefaultSummaryType } = useTableSummary();

const activeColId = ref<string | null>(null);

const summaryTypes: { type: ColumnSummaryType; label: string }[] = [
  { type: 'sum', label: '求和 (Sum)' },
  { type: 'avg', label: '平均值 (Avg)' },
  { type: 'count', label: '有效计数 (Count)' },
  { type: 'percent', label: '完成占比 (%)' },
  { type: 'min', label: '最小值 (Min)' },
  { type: 'max', label: '最大值 (Max)' },
];

const selectSummaryType = (colId: string, type: ColumnSummaryType) => {
  emit('update-summary-type', colId, type);
  activeColId.value = null;
};
</script>

<template>
  <tr class="bg-white/10 border-t-2 border-white/20 text-neutral-300 font-mono text-xs select-none">
    <td
      v-for="col in columns"
      :key="col.id"
      class="border-r border-white/10 px-2.5 py-2 relative group"
    >
      <div
        class="flex items-center justify-between cursor-pointer hover:bg-white/10 p-1 rounded transition-colors"
        title="点击切换统计计算方式"
        @click.stop="activeColId = activeColId === col.id ? null : col.id"
      >
        <span class="text-[10px] text-neutral-400 font-sans mr-1">
          {{ calculateColumnSummary(col, rows, col.summaryType).label }}:
        </span>
        <span class="font-semibold text-neutral-100 truncate">
          {{ calculateColumnSummary(col, rows, col.summaryType).value }}
        </span>
        <ChevronDown class="w-3 h-3 text-neutral-500 group-hover:text-white shrink-0 ml-1" />
      </div>

      <!-- 下拉选择统计函数 -->
      <div
        v-if="activeColId === col.id"
        class="absolute left-0 bottom-full mb-1 w-36 rounded-lg bg-neutral-900/95 border border-white/15 p-1 shadow-2xl z-30 text-xs backdrop-blur-md font-sans"
        @click.stop
      >
        <div
          class="px-2 py-1 text-[10px] text-neutral-400 font-semibold border-b border-white/10 mb-1"
        >
          选择汇总规则
        </div>
        <button
          v-for="st in summaryTypes"
          :key="st.type"
          :class="[
            'w-full text-left px-2 py-1 rounded hover:bg-white/10 transition-colors',
            (col.summaryType || getDefaultSummaryType(col)) === st.type
              ? 'text-blue-400 font-semibold bg-white/5'
              : 'text-neutral-300',
          ]"
          @click="selectSummaryType(col.id, st.type)"
        >
          {{ st.label }}
        </button>
      </div>

      <div
        v-if="activeColId === col.id"
        class="fixed inset-0 z-20"
        @click="activeColId = null"
      ></div>
    </td>

    <!-- 右侧空白边框匹配 -->
    <td class="w-20 border-r-0"></td>
  </tr>
</template>
