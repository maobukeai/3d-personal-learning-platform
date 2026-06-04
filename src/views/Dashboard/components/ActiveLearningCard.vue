<script setup lang="ts">
import { useRouter } from 'vue-router';
import { BookOpen, ArrowRight, Clock, ChevronRight } from 'lucide-vue-next';
import type { DashboardEnrollment } from '../types';

defineProps<{
  activeEnrollment: DashboardEnrollment | null;
}>();

const router = useRouter();
</script>

<template>
  <div class="blender-card overflow-hidden">
    <div class="p-4 sm:p-5 border-b flex items-center justify-between" style="border-color: var(--border-base)">
      <div class="flex items-center gap-2">
        <BookOpen class="w-4 h-4 text-blue-500" />
        <h3 class="font-bold text-sm" style="color: var(--text-primary)">推荐学习</h3>
      </div>
      <button
        type="button"
        class="flex items-center gap-1 text-xs font-bold text-accent hover:underline cursor-pointer transition-colors"
        @click="router.push('/academy')"
      >
        全部课程 <ChevronRight class="w-3 h-3" />
      </button>
    </div>

    <div class="p-4 sm:p-5">
      <!-- Active Course -->
      <div
        v-if="activeEnrollment"
        class="learning-card group relative overflow-hidden rounded-xl p-4 cursor-pointer transition-all"
        @click="router.push(`/academy/player/${activeEnrollment.courseId}`)"
      >
        <div class="flex items-start gap-3 mb-3">
          <div class="course-thumb w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center">
            <BookOpen class="w-5 h-5 text-blue-400" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[10px] font-bold uppercase tracking-wide" style="color: var(--text-muted)">进行中</span>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">3D建模</span>
            </div>
            <p class="text-sm font-bold leading-tight truncate" style="color: var(--text-primary)">
              {{ activeEnrollment.course.title }}
            </p>
            <div class="flex items-center gap-1.5 mt-1">
              <Clock class="w-3 h-3" style="color: var(--text-muted)" />
              <span class="text-[11px]" style="color: var(--text-muted)">
                剩余 {{ activeEnrollment.course._count.lessons }} 节课
              </span>
            </div>
          </div>
          <ArrowRight class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-accent" />
        </div>
        <!-- Progress bar -->
        <div class="progress-track rounded-full overflow-hidden h-1.5">
          <div
            class="h-full rounded-full progress-bar transition-all duration-500"
            :style="{ width: `${activeEnrollment.progress}%` }"
          ></div>
        </div>
        <div class="flex justify-between mt-1.5">
          <span class="text-[10px] font-bold text-blue-500">{{ activeEnrollment.progress }}% 完成</span>
          <span class="text-[10px]" style="color: var(--text-muted)">继续学习</span>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="empty-state rounded-xl p-5 flex flex-col items-center text-center cursor-pointer group"
        @click="router.push('/academy')"
      >
        <div class="w-12 h-12 rounded-xl flex items-center justify-center mb-3 empty-icon-bg">
          <BookOpen class="w-6 h-6" style="color: var(--text-muted)" />
        </div>
        <p class="text-sm font-bold mb-1" style="color: var(--text-primary)">开启你的学习之旅</p>
        <p class="text-xs leading-relaxed mb-3 max-w-[200px]" style="color: var(--text-muted)">
          探索专业 3D 创作课程，提升技能
        </p>
        <button
          type="button"
          class="text-xs font-bold px-4 py-2 rounded-lg border border-accent text-accent hover:bg-accent hover:text-white transition-colors cursor-pointer"
        >
          浏览课程
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.learning-card {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%);
  border: 1px solid rgba(59, 130, 246, 0.15);
}

.learning-card:hover {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.08) 100%);
  border-color: rgba(59, 130, 246, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.1);
}

.course-thumb {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.1));
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.progress-track {
  background: var(--bg-subtle);
}

.progress-bar {
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
}

.empty-state {
  border: 1px dashed var(--border-base);
  transition: all 0.2s ease;
}

.empty-state:hover {
  border-color: rgba(var(--accent-rgb, 99, 102, 241), 0.4);
  background: var(--bg-subtle);
}

.empty-icon-bg {
  background: var(--bg-subtle);
}
</style>
