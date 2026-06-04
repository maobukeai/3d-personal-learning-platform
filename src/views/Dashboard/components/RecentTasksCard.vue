<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { CheckSquare, ChevronRight, Clock } from 'lucide-vue-next';
import type { DashboardTask } from '../types';

const props = defineProps<{
  recentTasks: DashboardTask[];
}>();

const router = useRouter();

const today = computed(() => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
});

const isOverdue = (task: DashboardTask) => {
  if (!task.dueDate || task.status === 'DONE') return false;
  const dueDate = new Date(task.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  return dueDate.getTime() < today.value.getTime();
};

const visibleTasks = computed(() =>
  props.recentTasks.map((task) => ({
    ...task,
    overdue: isOverdue(task),
  })),
);

const statusConfig: Record<string, { label: string; class: string }> = {
  TODO: { label: '待办', class: 'status-todo' },
  IN_PROGRESS: { label: '进行中', class: 'status-progress' },
  DONE: { label: '已完成', class: 'status-done' },
};
</script>

<template>
  <div class="blender-card overflow-hidden">
    <div class="p-4 sm:p-5 border-b flex items-center justify-between" style="border-color: var(--border-base)">
      <div class="flex items-center gap-2">
        <CheckSquare class="w-4 h-4 text-amber-500" />
        <h3 class="font-bold text-sm" style="color: var(--text-primary)">待办任务</h3>
      </div>
      <button
        type="button"
        class="flex items-center gap-1 text-xs font-bold text-accent hover:underline cursor-pointer transition-colors"
        @click="router.push('/work')"
      >
        查看全部 <ChevronRight class="w-3 h-3" />
      </button>
    </div>

    <div class="divide-y" style="border-color: var(--border-base)">
      <div
        v-for="task in visibleTasks"
        :key="task.id"
        class="task-item flex items-center gap-3 px-4 sm:px-5 py-3 transition-colors"
      >
        <!-- Status dot -->
        <div
          class="w-2 h-2 rounded-full shrink-0"
          :class="
            task.status === 'IN_PROGRESS'
              ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]'
              : task.status === 'DONE'
                ? 'bg-emerald-500'
                : 'bg-slate-300 dark:bg-slate-600'
          "
        ></div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold truncate" style="color: var(--text-primary)">{{ task.title }}</p>
          <div class="flex items-center gap-1 mt-0.5">
            <Clock class="w-3 h-3 shrink-0" style="color: var(--text-muted)" />
            <p class="text-[10px]" style="color: var(--text-muted)">
              {{ task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '无截止日期' }}
              <span v-if="task.overdue" class="ml-1 font-bold text-rose-500">已逾期</span>
            </p>
          </div>
        </div>
        <span
          class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          :class="statusConfig[task.status]?.class || 'status-todo'"
        >
          {{ statusConfig[task.status]?.label || task.status }}
        </span>
      </div>

      <div v-if="recentTasks.length === 0" class="px-4 sm:px-5 py-8 text-center">
        <CheckSquare class="w-8 h-8 mx-auto mb-2 opacity-20" style="color: var(--text-muted)" />
        <p class="text-xs font-bold" style="color: var(--text-muted)">暂无待办任务</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-item:hover {
  background-color: var(--bg-subtle);
}

.status-todo {
  background: rgba(148, 163, 184, 0.12);
  color: #94a3b8;
}

.status-progress {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.status-done {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
}
</style>
