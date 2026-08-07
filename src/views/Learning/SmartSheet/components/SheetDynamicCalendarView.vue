<script setup lang="ts">
import { ref, computed } from 'vue';
import Button from '@/components/ui/Button.vue';
import EmptyState from '@/components/EmptyState.vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import type { CustomSheetTable, SheetRowData, SheetColumnDef } from '../types/sheet';

const props = defineProps<{
  table: CustomSheetTable;
  rows: SheetRowData[];
}>();

const dateColumns = computed(() => {
  return props.table.columns.filter((c) => c.type === 'date');
});

const currentDate = ref(new Date());

const currentYearMonthLabel = computed(() => {
  const y = currentDate.value.getFullYear();
  const m = currentDate.value.getMonth() + 1;
  return `${y} 年 ${m} 月`;
});

const prevMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1,
  );
};

const nextMonth = () => {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1,
  );
};

const activeDateCol = computed<SheetColumnDef | null>(() => dateColumns.value[0] || null);

const daysInMonth = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysCount = new Date(year, month + 1, 0).getDate();

  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dateStr, dayNum: d, isCurrentMonth: false });
  }

  for (let d = 1; d <= daysCount; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dateStr, dayNum: d, isCurrentMonth: true });
  }

  return days;
});

const rowsByDate = computed(() => {
  const map: Record<string, SheetRowData[]> = {};
  const colId = activeDateCol.value?.id;
  if (!colId) return map;

  props.rows.forEach((row) => {
    const dStr = row.cells[colId];
    if (dStr) {
      if (!map[dStr]) map[dStr] = [];
      map[dStr].push(row);
    }
  });
  return map;
});
</script>

<template>
  <div class="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
    <div v-if="!dateColumns.length" class="p-8">
      <EmptyState
        title="日历视图需要表内存在「日期 (Date)」列"
        description="请在表格中添加一个日期类型的字段（例如：记录日期、截止日期），系统将自动映射显示"
      />
    </div>

    <template v-else>
      <div class="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
        <h3 class="text-base font-semibold text-neutral-100">{{ currentYearMonthLabel }}</h3>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="prevMonth">
            <ChevronLeft class="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" @click="currentDate = new Date()"> 今天 </Button>
          <Button variant="outline" size="sm" @click="nextMonth">
            <ChevronRight class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-7 gap-1 text-center font-medium text-xs text-neutral-400 mb-2">
        <div>日</div>
        <div>一</div>
        <div>二</div>
        <div>三</div>
        <div>四</div>
        <div>五</div>
        <div>六</div>
      </div>

      <div class="grid grid-cols-7 gap-1.5">
        <div
          v-for="day in daysInMonth"
          :key="day.dateStr"
          :class="[
            'min-h-[90px] p-1.5 rounded-lg border flex flex-col justify-between transition-colors',
            day.isCurrentMonth
              ? 'border-white/10 bg-white/5 text-neutral-200'
              : 'border-transparent bg-white/[0.02] text-neutral-600 opacity-50',
          ]"
        >
          <div class="text-xs font-mono mb-1 font-semibold">{{ day.dayNum }}</div>

          <div class="flex-1 space-y-1 overflow-y-auto max-h-[70px]">
            <div
              v-for="row in rowsByDate[day.dateStr] || []"
              :key="row.id"
              class="p-1 rounded bg-white/10 border border-white/10 text-[11px] truncate text-neutral-200"
            >
              {{ Object.values(row.cells)[1] || Object.values(row.cells)[0] || '记录' }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
