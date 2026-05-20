<script setup lang="ts">
import { useRouter } from 'vue-router';
import { BookOpen, Layout } from 'lucide-vue-next';

defineProps<{
  activeEnrollment: any;
}>();

const router = useRouter();
</script>

<template>
  <div>
    <!-- Active Learning Card -->
    <div
      v-if="activeEnrollment"
      class="relative overflow-hidden rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-2xl group cursor-pointer"
      style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%)"
      @click="router.push(`/academy/player/${activeEnrollment.courseId}`)"
    >
      <div class="relative z-10">
        <div class="flex items-center gap-2 mb-3 sm:mb-4">
          <div
            class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
          >
            <BookOpen class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-80"
            >继续学习</span
          >
        </div>
        <h2 class="text-xl sm:text-2xl font-black mb-1 sm:mb-2">{{ activeEnrollment.course.title }}</h2>
        <p class="text-xs sm:text-sm opacity-80 mb-6 sm:mb-8 max-w-md">
          进度: {{ activeEnrollment.progress }}% | 还剩下
          {{ activeEnrollment.course._count.lessons }} 个章节
        </p>
        <button
          class="px-5 py-2 sm:px-6 sm:py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-[10px] sm:text-xs shadow-xl hover:scale-105 transition-all"
        >
          开始学习
        </button>
      </div>
      <div
        class="absolute right-0 bottom-0 opacity-10 group-hover:scale-110 transition-transform duration-700"
      >
        <Layout class="w-48 h-48 sm:w-64 sm:h-64 -mb-8 -mr-8 sm:-mb-10 sm:-mr-10" />
      </div>
    </div>

    <!-- Empty Enrollment State -->
    <div
      v-else
      class="relative overflow-hidden rounded-2xl sm:rounded-3xl p-6 sm:p-8 border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-accent/50 transition-all"
      @click="router.push('/academy')"
    >
      <div
        class="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform"
      >
        <BookOpen class="w-6 h-6 sm:w-8 sm:h-8 text-slate-300 group-hover:text-accent" />
      </div>
      <h2 class="text-base sm:text-lg font-bold mb-1" style="color: var(--text-primary)">
        开启你的学习之旅
      </h2>
      <p class="text-[10px] sm:text-xs text-slate-400 mb-5 sm:mb-6 max-w-[240px]">
        您还没有加入任何课程。前往学院探索海量 3D 创作课程，提升您的技能。
      </p>
      <button
        class="px-5 py-1.5 sm:px-6 sm:py-2 border-2 border-accent text-accent rounded-xl font-bold text-[10px] sm:text-xs hover:bg-accent hover:text-white transition-all"
      >
        浏览课程
      </button>
    </div>
  </div>
</template>
