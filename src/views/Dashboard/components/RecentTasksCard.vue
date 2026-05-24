<script setup lang="ts">
import { useRouter } from 'vue-router';
import type { DashboardTask } from '../types';

defineProps<{
  recentTasks: DashboardTask[];
}>();

const router = useRouter();
</script>

<template>
  <div class="p-3.5 sm:p-4 glass-card">
    <div class="flex items-center justify-between mb-2 sm:mb-3">
      <h3 class="font-bold text-sm sm:text-base" style="color: var(--text-primary)">
        待办学习任务
      </h3>
      <button type="button" class="text-xs sm:text-sm font-bold text-accent hover:underline cursor-pointer" @click="router.push('/work')">
        查看全部任务
      </button>
    </div>
    <div class="space-y-1.5">
      <div
        v-for="task in recentTasks"
        :key="task.id"
        class="flex items-center justify-between p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all hover:bg-slate-50 dark:hover:bg-white/5"
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
            <p class="text-xs sm:text-sm font-bold truncate" style="color: var(--text-primary)">
              {{ task.title }}
            </p>
            <p class="text-[11px] sm:text-xs mt-0.5" style="color: var(--text-muted)">
              截止于: {{ task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '无' }}
            </p>
          </div>
        </div>
        <span
          class="text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-lg shrink-0 ml-2"
          style="background-color: var(--bg-app); color: var(--text-secondary)"
        >
          {{ task.status }}
        </span>
      </div>
      <div v-if="recentTasks.length === 0" class="py-3 sm:py-4 text-center text-slate-400">
        <p class="text-xs sm:text-sm font-bold">暂无近期任务</p>
      </div>
    </div>
  </div>
</template>
