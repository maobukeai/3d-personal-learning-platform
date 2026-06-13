<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { DashboardTask } from '../types';

const props = defineProps<{
  recentTasks: DashboardTask[];
}>();

const router = useRouter();

const statusText: Record<string, string> = {
  TODO: '待办',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
};

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
    statusLabel: statusText[task.status] || task.status,
    overdue: isOverdue(task),
  })),
);
</script>

<template>
  <div class="p-4 sm:p-5 glass-card">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold text-sm sm:text-base" style="color: var(--text-primary)">
        待办学习任务
      </h3>
      <button type="button" class="px-2.5 py-1.5 text-xs font-bold text-accent rounded-md hover:bg-accent-subtle cursor-pointer transition-colors" @click="router.push('/work')">
        查看全部任务
      </button>
    </div>
    <div class="space-y-2">
      <div
        v-for="task in visibleTasks"
        :key="task.id"
        class="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-[var(--bg-subtle)]"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div
            class="w-2 h-2 rounded-full shrink-0"
            :class="
              task.status === 'IN_PROGRESS'
                ? 'bg-accent'
                : task.status === 'DONE'
                  ? 'bg-emerald-500'
                  : 'bg-slate-300'
            "
          ></div>
          <div class="min-w-0">
            <p class="text-xs sm:text-sm font-semibold truncate" style="color: var(--text-primary)">
              {{ task.title }}
            </p>
            <p class="text-[11px] sm:text-xs mt-0.5" style="color: var(--text-muted)">
              截止于: {{ task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '无' }}
              <span v-if="task.overdue" class="ml-1 font-bold text-rose-500">已逾期</span>
            </p>
          </div>
        </div>
        <span
          class="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-lg shrink-0 ml-2"
          style="background-color: var(--bg-app); color: var(--text-secondary)"
        >
          {{ task.statusLabel }}
        </span>
      </div>
      <div v-if="recentTasks.length === 0" class="py-5 text-center text-slate-400">
        <p class="text-xs sm:text-sm font-bold">暂无近期任务</p>
      </div>
    </div>
  </div>
</template>
