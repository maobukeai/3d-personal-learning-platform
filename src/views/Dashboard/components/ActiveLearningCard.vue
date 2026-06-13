<script setup lang="ts">
import { useRouter } from 'vue-router';
import { BookOpen, Layout } from 'lucide-vue-next';
import type { DashboardEnrollment } from '../types';

defineProps<{
  activeEnrollment: DashboardEnrollment | null;
}>();

const router = useRouter();
</script>

<template>
  <div>
    <!-- Active Learning Card -->
    <div
      v-if="activeEnrollment"
      class="glass-card glass-card-hover relative overflow-hidden p-4 sm:p-5 group cursor-pointer"
      @click="router.push(`/academy/player/${activeEnrollment.courseId}`)"
    >
      <div class="relative z-10">
        <div class="flex items-center gap-2 mb-3">
          <div
            class="w-8 h-8 rounded-lg bg-accent-subtle text-accent flex items-center justify-center border border-accent/10"
          >
            <BookOpen class="w-4 h-4" />
          </div>
          <span class="text-[11px] sm:text-xs font-bold uppercase" style="color: var(--text-muted)"
            >继续学习</span
          >
        </div>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h2 class="text-base sm:text-lg font-bold mb-1 truncate" style="color: var(--text-primary)">
              {{ activeEnrollment.course.title }}
            </h2>
            <p class="text-xs sm:text-sm max-w-md" style="color: var(--text-secondary)">
              已完成 {{ activeEnrollment.progress }}%，剩余
              {{ activeEnrollment.course._count.lessons }} 个章节
            </p>
          </div>
          <button type="button" class="shrink-0 px-4 py-2 bg-accent text-white rounded-lg font-bold text-xs shadow-sm hover:bg-accent-hover transition-colors cursor-pointer">
            开始学习
          </button>
        </div>
        <div class="mt-4 h-2 rounded-full overflow-hidden" style="background-color: var(--bg-subtle)">
          <div
            class="h-full rounded-full bg-accent transition-all duration-500"
            :style="{ width: `${activeEnrollment.progress}%` }"
          ></div>
        </div>
      </div>
      <div
        class="absolute right-4 top-4 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-300"
      >
        <Layout class="w-32 h-32" style="color: var(--text-primary)" />
      </div>
    </div>

    <!-- Empty Enrollment State -->
    <div
      v-else
      class="glass-card relative overflow-hidden p-5 border border-dashed flex flex-col items-center justify-center text-center group cursor-pointer hover:border-accent/50 transition-all"
      @click="router.push('/academy')"
    >
      <div
        class="w-10 h-10 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-2 group-hover:text-accent transition-colors"
      >
        <BookOpen class="w-5 h-5 sm:w-6 sm:h-6 text-slate-300 group-hover:text-accent" />
      </div>
      <h2 class="text-sm sm:text-base font-bold mb-1" style="color: var(--text-primary)">
        开启你的学习之旅
      </h2>
      <p class="text-xs sm:text-sm text-slate-500 mb-3 max-w-[320px]">
        您还没有加入任何课程。前往学院探索海量 3D 创作课程，提升您的技能。
      </p>
      <button type="button" class="px-4 py-2 border border-accent text-accent rounded-lg font-bold text-xs hover:bg-accent hover:text-white transition-colors cursor-pointer">
        浏览课程
      </button>
    </div>
  </div>
</template>
