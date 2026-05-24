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
      class="relative overflow-hidden rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-white shadow-2xl group cursor-pointer"
      style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%)"
      @click="router.push(`/academy/player/${activeEnrollment.courseId}`)"
    >
      <div class="relative z-10">
        <div class="flex items-center gap-2 mb-1.5 sm:mb-2">
          <div
            class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
          >
            <BookOpen class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </div>
          <span class="text-[10px] sm:text-xs font-bold uppercase tracking-widest opacity-80"
            >继续学习</span
          >
        </div>
        <h2 class="text-base sm:text-lg font-black mb-0.5 sm:mb-1">{{ activeEnrollment.course.title }}</h2>
        <p class="text-[11px] sm:text-xs opacity-80 mb-2.5 sm:mb-3 max-w-md">
          进度: {{ activeEnrollment.progress }}% | 还剩下
          {{ activeEnrollment.course._count.lessons }} 个章节
        </p>
        <button type="button" class="px-4 py-1.5 sm:px-4.5 sm:py-2 bg-white text-indigo-600 rounded-xl font-bold text-[11px] shadow-xl hover:scale-105 transition-all cursor-pointer">
          开始学习
        </button>
      </div>
      <div
        class="absolute right-0 bottom-0 opacity-10 group-hover:scale-110 transition-transform duration-700"
      >
        <Layout class="w-36 h-36 sm:w-48 sm:h-48 -mb-6 -mr-6 sm:-mb-8 sm:-mr-8" />
      </div>
    </div>

    <!-- Empty Enrollment State -->
    <div
      v-else
      class="relative overflow-hidden rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-accent/50 transition-all"
      @click="router.push('/academy')"
    >
      <div
        class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-1.5 sm:mb-2 group-hover:scale-110 transition-transform"
      >
        <BookOpen class="w-5 h-5 sm:w-6 sm:h-6 text-slate-300 group-hover:text-accent" />
      </div>
      <h2 class="text-sm sm:text-base font-bold mb-0.5" style="color: var(--text-primary)">
        开启你的学习之旅
      </h2>
      <p class="text-[11px] sm:text-xs text-slate-400 mb-2 sm:mb-2.5 max-w-[240px]">
        您还没有加入任何课程。前往学院探索海量 3D 创作课程，提升您的技能。
      </p>
      <button type="button" class="px-4 py-1 sm:px-4.5 sm:py-1.5 border-2 border-accent text-accent rounded-xl font-bold text-[11px] hover:bg-accent hover:text-white transition-all cursor-pointer">
        浏览课程
      </button>
    </div>
  </div>
</template>
