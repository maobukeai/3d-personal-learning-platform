<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Flame,
  ArrowUp,
  Minus,
  ArrowDown,
  HelpCircle,
  PanelRightOpen,
  PanelRightClose,
  FolderSearch,
} from 'lucide-vue-next';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import type { Task, UserType } from '@/types/task';

interface Props {
  tasks: Task[];
  teamMembers: UserType[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'refresh', updatedTask?: Task): void;
  (e: 'refresh-stats'): void;
  (e: 'open-detail', task: Task): void;
}>();

const today = new Date();
const currentYear = ref(today.getFullYear());
const currentMonth = ref(today.getMonth()); // 0-indexed (Jan = 0, Dec = 11)

const monthNames = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
];

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

// Sidebar state
const isSidebarOpen = ref(true);

// Computed split of tasks
const scheduledTasks = computed(() => props.tasks.filter((t) => t.dueDate));
const unscheduledTasks = computed(() => props.tasks.filter((t) => !t.dueDate));

// Get days of the month grid (42 days to cover 6 weeks)
const calendarDays = computed(() => {
  const year = currentYear.value;
  const month = currentMonth.value;

  const firstDayOfMonth = new Date(year, month, 1);
  let startDayOfWeek = firstDayOfMonth.getDay();
  startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: { date: Date; isCurrentMonth: boolean; dayNumber: number; isToday: boolean }[] = [];

  // Previous month padding days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const prevDate = new Date(year, month - 1, daysInPrevMonth - i);
    days.push({
      date: prevDate,
      isCurrentMonth: false,
      dayNumber: prevDate.getDate(),
      isToday: isSameDay(prevDate, today),
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const currDate = new Date(year, month, i);
    days.push({
      date: currDate,
      isCurrentMonth: true,
      dayNumber: i,
      isToday: isSameDay(currDate, today),
    });
  }

  // Next month padding days to fill 42 cells
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextDate = new Date(year, month + 1, i);
    days.push({
      date: nextDate,
      isCurrentMonth: false,
      dayNumber: i,
      isToday: isSameDay(nextDate, today),
    });
  }

  return days;
});

const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const getTasksForDate = (date: Date) => {
  return scheduledTasks.value.filter((task) => {
    if (!task.dueDate) return false;
    return isSameDay(new Date(task.dueDate), date);
  });
};

const prevMonth = () => {
  if (currentMonth.value === 0) {
    currentMonth.value = 11;
    currentYear.value--;
  } else {
    currentMonth.value--;
  }
};

const nextMonth = () => {
  if (currentMonth.value === 11) {
    currentMonth.value = 0;
    currentYear.value++;
  } else {
    currentMonth.value++;
  }
};

const goToday = () => {
  currentYear.value = today.getFullYear();
  currentMonth.value = today.getMonth();
};

const getPriorityConfig = (priority?: string) => {
  switch (priority) {
    case 'URGENT':
      return { label: '紧急', color: 'bg-rose-500', textColor: 'text-rose-500', icon: Flame };
    case 'HIGH':
      return { label: '高', color: 'bg-orange-500', textColor: 'text-orange-500', icon: ArrowUp };
    case 'MEDIUM':
      return { label: '中', color: 'bg-amber-500', textColor: 'text-amber-500', icon: Minus };
    case 'LOW':
      return { label: '低', color: 'bg-blue-500', textColor: 'text-blue-500', icon: ArrowDown };
    default:
      return { label: '无', color: 'bg-slate-400', textColor: 'text-slate-400', icon: HelpCircle };
  }
};

// Drag and drop logic
const draggedTaskId = ref<string | null>(null);

const onDragStart = (event: DragEvent, taskId: string) => {
  draggedTaskId.value = taskId;
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', taskId);
    event.dataTransfer.effectAllowed = 'move';
  }
};

const onDragOver = (event: DragEvent) => {
  event.preventDefault();
};

const onDropToDate = async (event: DragEvent, targetDate: Date) => {
  event.preventDefault();
  const taskId = draggedTaskId.value || event.dataTransfer?.getData('text/plain');
  if (!taskId) return;

  try {
    // Set targeted hour to 12:00 local time to avoid local day shifts
    const scheduledDate = new Date(targetDate);
    scheduledDate.setHours(12, 0, 0, 0);

    const response = await api.put(`/api/tasks/${taskId}`, {
      dueDate: scheduledDate.toISOString(),
    });
    ElMessage.success(`截止时间已变更为: ${scheduledDate.toLocaleDateString()}`);
    emit('refresh', response.data);
    emit('refresh-stats');
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '无法修改任务截止日期'));
  } finally {
    draggedTaskId.value = null;
  }
};

const onDropToSidebar = async (event: DragEvent) => {
  event.preventDefault();
  const taskId = draggedTaskId.value || event.dataTransfer?.getData('text/plain');
  if (!taskId) return;

  try {
    const response = await api.put(`/api/tasks/${taskId}`, { dueDate: null });
    ElMessage.success(`已移出计划并清除截止日期`);
    emit('refresh', response.data);
    emit('refresh-stats');
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '无法取消计划任务'));
  } finally {
    draggedTaskId.value = null;
  }
};
</script>

<template>
  <div class="mobile-adaptive calendar-root flex-1 flex gap-4 p-1 sm:p-4 overflow-hidden h-full">
    <!-- Left Column: Calendar Main View -->
    <div class="calendar-main flex-1 flex flex-col min-w-0 h-full">
      <!-- Calendar Header controls -->
      <div
        class="mobile-row flex items-center justify-between px-3 py-2 border rounded-t-xl shrink-0"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <Calendar class="w-4 h-4 text-accent" />
          <h2 class="text-xs sm:text-sm font-bold" style="color: var(--text-primary)">
            {{ currentYear }} 年 {{ monthNames[currentMonth] }}
          </h2>
        </div>

        <div class="flex items-center gap-1.5">
          <button
            type="button"
            class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg border text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
            @click="prevMonth"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            class="px-2.5 py-1 text-[10px] sm:text-xs font-bold bg-slate-100 dark:bg-white/5 border text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all cursor-pointer"
            @click="goToday"
          >
            今天
          </button>
          <button
            type="button"
            class="p-1 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg border text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
            @click="nextMonth"
          >
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
          <div class="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-700"></div>

          <!-- Toggle Sidebar Button -->
          <button
            type="button"
            class="px-2 py-1 bg-slate-100 dark:bg-white/5 border text-slate-700 dark:text-slate-200 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1 shrink-0"
            @click="isSidebarOpen = !isSidebarOpen"
          >
            <component :is="isSidebarOpen ? PanelRightClose : PanelRightOpen" class="w-3.5 h-3.5" />
            <span>未排程任务</span>
          </button>
        </div>
      </div>

      <!-- Weekday Header labels -->
      <div
        class="calendar-grid grid grid-cols-7 border-x border-b py-2 text-center text-[10px] font-black uppercase tracking-wider shrink-0"
        style="
          background-color: var(--bg-card);
          border-color: var(--border-base);
          color: var(--text-secondary);
        "
      >
        <div v-for="day in weekDays" :key="day">
          {{ day }}
        </div>
      </div>

      <!-- Grid Container -->
      <div
        class="calendar-grid flex-1 grid grid-cols-7 grid-rows-6 border-l border-b overflow-hidden relative rounded-b-xl min-h-0"
        style="border-color: var(--border-base)"
      >
        <div
          v-for="(cell, index) in calendarDays"
          :key="index"
          class="border-r border-t flex flex-col p-1 min-h-0 min-w-0 transition-colors duration-300 relative group/cell"
          :class="[
            cell.isCurrentMonth ? 'bg-card/20' : 'bg-slate-50/20 dark:bg-white/1',
            cell.isToday ? 'bg-accent/2' : '',
          ]"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
          @dragover="onDragOver"
          @drop="onDropToDate($event, cell.date)"
        >
          <!-- Cell Date Header -->
          <div class="flex justify-between items-center mb-1 shrink-0">
            <span
              class="text-[9px] font-bold inline-flex items-center justify-center w-4 h-4 rounded-full"
              :class="[
                cell.isCurrentMonth
                  ? 'text-slate-700 dark:text-slate-200'
                  : 'text-slate-400 dark:text-slate-600',
                cell.isToday ? 'bg-accent text-white font-black' : '',
              ]"
            >
              {{ cell.dayNumber }}
            </span>
            <span
              v-if="getTasksForDate(cell.date).length > 0"
              class="text-[8px] font-bold px-1 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500"
            >
              {{ getTasksForDate(cell.date).length }}
            </span>
          </div>

          <!-- Task list container (scrollable within day cell) -->
          <div class="flex-1 overflow-y-auto space-y-1 pr-0.5 scrollbar-hide">
            <div
              v-for="task in getTasksForDate(cell.date)"
              :key="task.id"
              draggable="true"
              class="p-1 rounded-lg border text-[9px] font-semibold leading-tight shadow-sm hover:shadow-md hover:border-accent/30 transition-all cursor-grab active:cursor-grabbing truncate flex items-center gap-1"
              :class="[task.status === 'DONE' ? 'opacity-50 line-through' : '']"
              :style="{
                backgroundColor: 'var(--bg-app)',
                borderColor: 'var(--border-base)',
                color: 'var(--text-primary)',
              }"
              @dragstart="onDragStart($event, task.id)"
              @click.stop="emit('open-detail', task)"
            >
              <!-- Priority color bar -->
              <div
                v-if="task.priority && task.priority !== 'NONE'"
                class="w-1 h-3 rounded-full shrink-0"
                :class="getPriorityConfig(task.priority).color"
              ></div>
              <span class="truncate flex-1">{{ task.title }}</span>

              <!-- Assignee avatar -->
              <img
                v-if="task.assignee?.avatarUrl"
                :src="task.assignee.avatarUrl"
                class="w-3.5 h-3.5 rounded object-cover shrink-0"
                alt=""
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column: Unscheduled Tasks Sidebar -->
    <div
      v-show="isSidebarOpen"
      class="calendar-sidebar w-64 border rounded-xl flex flex-col overflow-hidden shrink-0 transition-all duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
      @dragover="onDragOver"
      @drop="onDropToSidebar"
    >
      <div
        class="p-3 border-b flex items-center justify-between shrink-0"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-1.5">
          <FolderSearch class="w-4 h-4 text-slate-400" />
          <h3
            class="text-xs font-black uppercase tracking-wider"
            style="color: var(--text-primary)"
          >
            未排程任务 ({{ unscheduledTasks.length }})
          </h3>
        </div>
      </div>

      <!-- Scrollable Tasks List inside Sidebar -->
      <div class="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
        <div
          v-for="task in unscheduledTasks"
          :key="task.id"
          draggable="true"
          class="p-2.5 rounded-xl border text-xs font-bold leading-tight shadow-sm hover:shadow-md hover:border-accent/30 transition-all cursor-grab active:cursor-grabbing relative flex flex-col gap-2"
          style="
            background-color: var(--bg-app);
            border-color: var(--border-base);
            color: var(--text-primary);
          "
          @dragstart="onDragStart($event, task.id)"
          @click="emit('open-detail', task)"
        >
          <!-- Task Title and Priority Indicator -->
          <div class="flex items-center gap-1.5 min-w-0">
            <div
              v-if="task.priority && task.priority !== 'NONE'"
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="getPriorityConfig(task.priority).color"
            ></div>
            <span class="truncate flex-1">{{ task.title }}</span>
          </div>

          <!-- Project and Assignee Footer -->
          <div class="flex items-center justify-between gap-2 text-[9px] text-slate-400">
            <span v-if="task.project" class="text-accent font-semibold truncate max-w-[120px]">{{
              task.project.title
            }}</span>
            <img
              v-if="task.assignee?.avatarUrl"
              :src="task.assignee.avatarUrl"
              class="w-4 h-4 rounded object-cover ml-auto shrink-0"
              alt=""
            />
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="unscheduledTasks.length === 0"
          class="text-center py-12 text-slate-400 dark:text-slate-500 italic text-[11px]"
        >
          暂无未排程任务<br />可从日历拖拽任务到这里以取消计划
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

@media (max-width: 767px) {
  .calendar-root {
    flex-direction: column;
    overflow-y: auto;
    height: auto;
  }
  .calendar-main {
    min-height: 360px;
  }
  .calendar-sidebar {
    width: 100%;
    margin-top: 12px;
    min-height: 200px;
  }
  .calendar-grid {
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
}
</style>
