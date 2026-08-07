<script setup lang="ts">
import { ref, computed } from 'vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-vue-next';
import type { SmartSheetItem, RecordStatus } from '../types/sheet';

const props = defineProps<{
  items: SmartSheetItem[];
}>();

const emit = defineEmits<{
  (e: 'view', item: SmartSheetItem): void;
}>();

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

const daysInMonth = computed(() => {
  const year = currentDate.value.getFullYear();
  const month = currentDate.value.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysCount = new Date(year, month + 1, 0).getDate();

  const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Padding prev month
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dateStr, dayNum: d, isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= daysCount; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ dateStr, dayNum: d, isCurrentMonth: true });
  }

  return days;
});

const itemsByDate = computed(() => {
  const map: Record<string, SmartSheetItem[]> = {};
  props.items.forEach((item) => {
    if (item.dueDate) {
      if (!map[item.dueDate]) map[item.dueDate] = [];
      map[item.dueDate].push(item);
    }
  });
  return map;
});

const statusVariantMap: Record<RecordStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  TODO: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  ARCHIVED: 'danger',
};
</script>

<template>
  <div class="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
    <!-- 日历头部控制器 -->
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

    <!-- 星期表头 -->
    <div class="grid grid-cols-7 gap-1 text-center font-medium text-xs text-neutral-400 mb-2">
      <div>日</div>
      <div>一</div>
      <div>二</div>
      <div>三</div>
      <div>四</div>
      <div>五</div>
      <div>六</div>
    </div>

    <!-- 日历格子 -->
    <div class="grid grid-cols-7 gap-1.5">
      <div
        v-for="day in daysInMonth"
        :key="day.dateStr"
        :class="[
          'min-h-[100px] p-1.5 rounded-lg border flex flex-col justify-between transition-colors',
          day.isCurrentMonth
            ? 'border-white/10 bg-white/5 text-neutral-200'
            : 'border-transparent bg-white/[0.02] text-neutral-600 opacity-50',
        ]"
      >
        <div class="text-xs font-mono mb-1 font-semibold">{{ day.dayNum }}</div>

        <div class="flex-1 space-y-1 overflow-y-auto max-h-[80px]">
          <div
            v-for="item in itemsByDate[day.dateStr] || []"
            :key="item.id"
            class="p-1 rounded bg-white/10 border border-white/10 text-[11px] truncate flex items-center justify-between cursor-pointer hover:bg-white/20"
            :title="item.title"
            @click="emit('view', item)"
          >
            <span class="truncate flex-1">{{ item.title }}</span>
            <Badge :variant="statusVariantMap[item.status]" size="sm" class="ml-1 text-[9px]">
              {{ item.status === 'COMPLETED' ? '已完成' : '待办' }}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
