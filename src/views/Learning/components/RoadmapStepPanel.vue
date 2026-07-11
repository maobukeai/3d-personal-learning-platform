<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  Gauge,
  TrendingUp,
  Clock,
  ListTodo,
  GraduationCap,
  BookOpen,
  ArrowRight,
  CheckCircle2,
} from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';
import type { Roadmap, RoadmapStep, Course } from '@/types';
import { getRelatedCourses, getSubTasksForStep } from '../utils/roadmapHelpers';

interface Props {
  activeStep: RoadmapStep | null;
  selectedRoadmap: Roadmap | null;
  isStepCompleted: (stepId: string) => boolean;
  checkedSubTasks: Record<string, boolean>;
  allCourses: Course[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'toggle-step', stepId: string): void;
  (e: 'toggle-sub-task', taskId: string): void;
  (e: 'navigate-to-course', courseId: string): void;
}>();

const { t } = useI18n();

const getMetricsForStep = (step: RoadmapStep, index: number) => {
  if (!step) return { difficulty: 50, practical: 50, duration: 20 };
  const title = step.title.toLowerCase();

  let difficulty = 35 + index * 12;
  let practical = 55 + index * 5;
  let duration = 6 + index * 6;

  if (
    title.includes('shader') ||
    title.includes('着色器') ||
    title.includes('glsl') ||
    title.includes('渲染引擎') ||
    title.includes('webgl') ||
    title.includes('图形学') ||
    title.includes('渲染')
  ) {
    difficulty += 25;
    practical += 15;
    duration += 12;
  } else if (
    title.includes('blender') ||
    title.includes('建模') ||
    title.includes('雕刻') ||
    title.includes('拓扑') ||
    title.includes('材质') ||
    title.includes('贴图') ||
    title.includes('pbr') ||
    title.includes('灯光')
  ) {
    difficulty += 10;
    practical += 28;
    duration += 8;
  } else if (
    title.includes('three.js') ||
    title.includes('threejs') ||
    title.includes('交互') ||
    title.includes('动画') ||
    title.includes('控制') ||
    title.includes('代码')
  ) {
    difficulty += 8;
    practical += 18;
    duration += 6;
  }

  if (
    title.includes('入门') ||
    title.includes('基础') ||
    title.includes('概念') ||
    title.includes('起步') ||
    title.includes('介绍') ||
    title.includes('理论')
  ) {
    difficulty = Math.max(difficulty - 22, 15);
    practical = Math.max(practical - 15, 20);
    duration = Math.max(duration - 5, 3);
  }

  if (
    title.includes('高级') ||
    title.includes('精通') ||
    title.includes('进阶') ||
    title.includes('核心') ||
    title.includes('深入') ||
    title.includes('深度')
  ) {
    difficulty += 15;
    practical += 10;
    duration += 8;
  }

  const subTasks = getSubTasksForStep(step);
  duration += subTasks.length * 1.5;
  practical += subTasks.length * 3;

  const relatedCourses = getRelatedCourses(step, props.allCourses);
  if (relatedCourses.length > 0) {
    practical = Math.min(practical + relatedCourses.length * 8, 98);
    duration = Math.min(duration + relatedCourses.length * 6, 120);

    const hasAdvanced = relatedCourses.some((c) => c.difficulty === 'ADVANCED');
    if (hasAdvanced) {
      difficulty = Math.min(difficulty + 15, 98);
    }
  }

  return {
    difficulty: Math.min(Math.max(Math.round(difficulty), 15), 98),
    practical: Math.min(Math.max(Math.round(practical), 20), 98),
    duration: Math.min(Math.max(Math.round(duration), 2), 160),
  };
};

const activeStepIndex = () => {
  if (!props.activeStep || !props.selectedRoadmap) return 0;
  return props.selectedRoadmap.steps.indexOf(props.activeStep);
};

const metrics = () => {
  if (!props.activeStep || !props.selectedRoadmap)
    return { difficulty: 50, practical: 50, duration: 20 };
  return getMetricsForStep(props.activeStep, activeStepIndex());
};
</script>

<template>
  <div
    class="roadmap-right-panel col-span-7 md:col-span-5 lg:col-span-4 sticky top-2 sm:top-6 space-y-4"
  >
    <!-- Smart Companion box -->
    <div
      v-if="activeStep"
      class="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md space-y-2.5 sm:space-y-4 shadow-xl relative overflow-hidden"
    >
      <div class="absolute -right-12 -top-12 w-24 h-24 bg-accent/5 rounded-full blur-2xl"></div>

      <div
        class="mobile-row flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1.5 sm:pb-2.5 relative z-10"
      >
        <div class="flex items-center gap-1.5 sm:gap-2">
          <div
            class="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-accent text-white flex items-center justify-center shrink-0"
          >
            <Gauge class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </div>
          <div class="space-y-0.5">
            <h4 class="text-[8px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">
              {{ t('roadmaps.analyzerTitle') }}
            </h4>
            <p class="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200">
              {{ t('roadmaps.stageFocus') }}
            </p>
          </div>
        </div>

        <span
          class="text-[8px] sm:text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full shrink-0"
        >
          {{ t('roadmaps.moduleNumber', { n: activeStepIndex() + 1 }) }}
        </span>
      </div>

      <!-- Active Step Description Details -->
      <div class="space-y-1 sm:space-y-2 relative z-10">
        <h3
          class="text-xs sm:text-base font-black text-slate-800 dark:text-slate-100 leading-tight"
        >
          {{ activeStep.title }}
        </h3>
        <p
          class="text-[9px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-white/[0.01] p-2 rounded-lg border border-slate-100 dark:border-slate-800"
        >
          {{ activeStep.description || t('roadmaps.customStageDesc') }}
        </p>
      </div>

      <!-- Toggle Completion Action -->
      <div class="pt-0.5 sm:pt-1 relative z-10">
        <button
          type="button"
          class="w-full py-1.5 sm:py-2 px-3 sm:px-4 rounded-lg text-[9px] sm:text-xs font-black text-white transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-md"
          :class="
            isStepCompleted(activeStep.id)
              ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10'
              : 'bg-accent hover:bg-accent-dark shadow-accent/10'
          "
          @click="emit('toggle-step', activeStep.id)"
        >
          <CheckCircle2 class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {{
            isStepCompleted(activeStep.id)
              ? t('roadmaps.stepCompletedReset')
              : t('roadmaps.conquerStage')
          }}
        </button>
      </div>

      <!-- Skill metrics quantizer -->
      <div
        class="space-y-2 sm:space-y-2.5 pt-1.5 sm:pt-2.5 border-t border-slate-100 dark:border-slate-800/80 relative z-10"
      >
        <div
          class="flex items-center gap-1 text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1"
        >
          <TrendingUp class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" />
          {{ t('roadmaps.metricsTitle') }}
        </div>

        <div class="space-y-1.5 sm:space-y-2">
          <div>
            <div
              class="flex items-center justify-between text-[8px] sm:text-[10px] text-slate-500 mb-0.5"
            >
              <span>{{ t('roadmaps.difficultyMetric') }}</span>
              <span class="font-bold text-slate-700 dark:text-slate-300">
                {{ metrics().difficulty }}%
              </span>
            </div>
            <div class="h-1 sm:h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                class="h-full bg-rose-500 rounded-full transition-all duration-500"
                :style="{ width: metrics().difficulty + '%' }"
              ></div>
            </div>
          </div>

          <div>
            <div
              class="flex items-center justify-between text-[8px] sm:text-[10px] text-slate-500 mb-0.5"
            >
              <span>{{ t('roadmaps.practicalMetric') }}</span>
              <span class="font-bold text-slate-700 dark:text-slate-300">
                {{ metrics().practical }}%
              </span>
            </div>
            <div class="h-1 sm:h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                class="h-full bg-purple-500 rounded-full transition-all duration-500"
                :style="{ width: metrics().practical + '%' }"
              ></div>
            </div>
          </div>

          <div class="flex items-center justify-between text-[10px] sm:text-xs pt-0.5 sm:pt-1">
            <span class="text-slate-500 flex items-center gap-1">
              <Clock class="w-3 sm:w-3.5 h-3 sm:h-3.5 text-slate-400" />
              {{ t('roadmaps.durationMetric') }}
            </span>
            <span class="font-black text-slate-700 dark:text-slate-200">
              {{ metrics().duration }}
              <span class="text-[8px] sm:text-[10px] font-normal text-slate-400">{{
                t('roadmaps.hourUnit')
              }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Sub-skills interactive checklist -->
      <div
        v-if="getSubTasksForStep(activeStep).length > 0"
        class="space-y-1 sm:space-y-2 pt-1.5 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80 relative z-10"
      >
        <div
          class="flex items-center gap-1 text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest"
        >
          <ListTodo class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" />
          {{ t('roadmaps.checklistTitle') }}
        </div>

        <div
          class="space-y-1 sm:space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800/50"
        >
          <div
            v-for="task in getSubTasksForStep(activeStep)"
            :key="task.id"
            class="flex items-start gap-1.5 sm:gap-2.5 group/item cursor-pointer text-left"
            @click="emit('toggle-sub-task', task.id)"
          >
            <div
              class="w-3 h-3 sm:w-4 sm:h-4 rounded border flex items-center justify-center shrink-0 transition-colors mt-0.5"
              :class="
                checkedSubTasks[task.id]
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/10'
                  : 'border-slate-300 dark:border-slate-600 group-hover/item:border-accent bg-white dark:bg-slate-800'
              "
            >
              <CheckCircle2 v-if="checkedSubTasks[task.id]" class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </div>

            <span
              class="text-[9px] sm:text-[11px] leading-tight sm:leading-relaxed transition-all duration-300"
              :class="
                checkedSubTasks[task.id]
                  ? 'text-slate-400 dark:text-slate-500 line-through'
                  : 'text-slate-600 dark:text-slate-300 group-hover/item:text-slate-800 dark:group-hover/item:text-slate-100'
              "
            >
              {{ task.text }}
            </span>
          </div>
        </div>
      </div>

      <!-- Mapped Courses list inside Sidebar -->
      <div
        v-if="getRelatedCourses(activeStep, allCourses).length > 0"
        class="space-y-1 sm:space-y-2 pt-1.5 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80 relative z-10"
      >
        <div
          class="flex items-center gap-1 text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest"
        >
          <GraduationCap class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" />
          {{ t('roadmaps.recommendCoursesTitle') }}
        </div>

        <div class="space-y-1 sm:space-y-1.5">
          <div
            v-for="course in getRelatedCourses(activeStep, allCourses)"
            :key="course.id"
            class="mobile-row flex gap-2 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-500/[0.01] hover:border-accent/40 dark:hover:border-accent/40 hover:bg-white dark:hover:bg-slate-900/50 transition-all cursor-pointer group/card"
            @click="emit('navigate-to-course', course.id)"
          >
            <div
              class="w-14 sm:w-20 h-9 sm:h-12 rounded bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden"
            >
              <img
                v-if="course.thumbnail"
                alt=""
                :src="getAssetUrl(course.thumbnail)"
                class="w-full h-full object-cover group-hover/card:scale-105 transition-transform"
              />
              <BookOpen v-else class="w-3 h-3 text-slate-400 mx-auto my-3" />
            </div>
            <div class="min-w-0 flex-1 flex flex-col justify-between">
              <h4
                class="text-[9px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 truncate group-hover/card:text-accent transition-colors leading-snug"
              >
                {{ course.title }}
              </h4>
              <div
                class="flex items-center justify-between text-[8px] sm:text-[10px] text-slate-400"
              >
                <span
                  class="px-1 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-[7px] sm:text-[9px]"
                >
                  {{
                    course.difficulty === 'BEGINNER'
                      ? t('common.difficulty.beginner')
                      : course.difficulty === 'INTERMEDIATE'
                        ? t('common.difficulty.intermediate')
                        : t('common.difficulty.advanced')
                  }}
                </span>
                <span
                  class="text-accent flex items-center gap-0.5 font-bold group-hover/card:translate-x-0.5 transition-transform text-[7px] sm:text-[9px]"
                >
                  {{ t('roadmaps.goMaster') }} <ArrowRight class="w-2 h-2" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
