<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  CheckCircle2,
  Lock,
  Zap,
  Sparkle,
  Gauge,
  TrendingUp,
  Clock,
  ListTodo,
  GraduationCap,
  BookOpen,
  ArrowRight,
} from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { getAssetUrl } from '@/utils/api';
import { logError } from '@/utils/error';
import Button from '@/components/ui/Button.vue';
import type { Roadmap, RoadmapStep, Course } from '@/types';

const { t } = useI18n();

interface ProgressItem {
  roadmapStepId: string;
  completed: boolean;
}

interface Props {
  roadmap: Roadmap;
  activeStepId: string | null;
  myProgress: ProgressItem[];
  allCourses: Course[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:activeStepId', stepId: string | null): void;
  (e: 'toggle-step', stepId: string): void;
  (e: 'navigate-to-course', courseId: string): void;
}>();

const checkedSubTasks = ref<Record<string, boolean>>({});

const activeStep = computed(() => {
  if (!props.roadmap.steps || props.roadmap.steps.length === 0) return null;
  return (
    props.roadmap.steps.find((s) => s.id === props.activeStepId) || props.roadmap.steps[0] || null
  );
});

const isStepCompleted = (stepId: string) => {
  return props.myProgress.some((p) => p.roadmapStepId === stepId && p.completed);
};

const calculateRoadmapProgress = (roadmap: Roadmap) => {
  if (!roadmap || !roadmap.steps || roadmap.steps.length === 0) return 0;
  const completedCount = roadmap.steps.filter((s) => isStepCompleted(s.id)).length;
  return Math.round((completedCount / roadmap.steps.length) * 100);
};

const isStepLocked = (_step: RoadmapStep, index: number) => {
  if (index === 0) return false;
  if (!props.roadmap) return false;
  const prevStep = props.roadmap.steps[index - 1];
  return prevStep && !isStepCompleted(prevStep.id);
};

const getStepStatus = (step: RoadmapStep, index: number) => {
  if (isStepCompleted(step.id)) return 'completed';
  if (isStepLocked(step, index)) return 'locked';
  if (index === 0 || isStepCompleted(props.roadmap.steps[index - 1]?.id)) return 'current';
  return 'upcoming';
};

const loadCheckedSubTasks = () => {
  try {
    const saved = localStorage.getItem('learning_path_subtasks');
    if (saved) {
      checkedSubTasks.value = JSON.parse(saved);
    }
  } catch (e) {
    logError(e, { operation: 'project.loadSubtasks', component: 'ProjectDetailRoadmapPanel' });
  }
};

const toggleSubTask = (taskId: string) => {
  checkedSubTasks.value[taskId] = !checkedSubTasks.value[taskId];
  try {
    localStorage.setItem('learning_path_subtasks', JSON.stringify(checkedSubTasks.value));
  } catch (e) {
    logError(e, { operation: 'project.saveSubtasks', component: 'ProjectDetailRoadmapPanel' });
  }
};

const getRelatedCourses = (step: RoadmapStep) => {
  if (!step || !props.allCourses || props.allCourses.length === 0) return [];
  const title = step.title.toLowerCase();
  const desc = (step.description || '').toLowerCase();

  return props.allCourses
    .filter((course) => {
      const courseTitle = course.title.toLowerCase();
      const courseDesc = (course.description || '').toLowerCase();

      const keywords = [
        'three.js',
        'threejs',
        'blender',
        'shader',
        'webgl',
        '3d',
        'modeling',
        '渲染',
        '建模',
        '材质',
        '动画',
        '贴图',
        '灯光',
        '拓扑',
        '材质',
        '骨骼',
        '动力学',
      ];
      for (const kw of keywords) {
        if (
          (title.includes(kw) || desc.includes(kw)) &&
          (courseTitle.includes(kw) || courseDesc.includes(kw))
        ) {
          return true;
        }
      }

      const words = title.split(/[\s,.\-得的要与及和了与]/).filter((w: string) => w.length > 1);
      for (const w of words) {
        if (courseTitle.includes(w)) {
          return true;
        }
      }
      return false;
    })
    .slice(0, 2);
};

interface StepSubtaskItem {
  id?: string;
  text?: string;
}

const getSubTasksForStep = (step: RoadmapStep): { id: string; text: string }[] => {
  if (!step) return [];

  if (step.subtasks) {
    try {
      const parsed = typeof step.subtasks === 'string' ? JSON.parse(step.subtasks) : step.subtasks;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: unknown, index: number) => {
          if (item && typeof item === 'object') {
            const obj = item as StepSubtaskItem;
            return {
              id: obj.id || `${step.id}_custom_s${index}`,
              text: obj.text || '',
            };
          }
          return {
            id: `${step.id}_custom_s${index}`,
            text: String(item),
          };
        });
      }
    } catch (e) {
      logError(e, { operation: 'project.parseSubtasks', component: 'ProjectDetailRoadmapPanel' });
    }
  }
  return [];
};

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

  const relatedCourses = getRelatedCourses(step);
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

loadCheckedSubTasks();
</script>

<template>
  <div class="space-y-6">
    <div
      class="p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md relative overflow-hidden"
    >
      <div
        class="absolute -right-10 -top-10 w-36 h-36 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl"
      ></div>
      <div
        class="absolute -left-10 -bottom-10 w-36 h-36 bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl"
      ></div>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div class="space-y-1 min-w-0 text-left">
          <div class="flex items-center gap-2">
            <h2 class="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 truncate">
              {{ roadmap.title }}
            </h2>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            {{ roadmap.description || t('projects.roadmapTip') }}
          </p>
        </div>

        <div
          class="flex items-center gap-2.5 shrink-0 self-start sm:self-center bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-1.5 px-2.5 rounded-xl"
        >
          <div class="flex flex-col items-end">
            <span class="text-[8px] font-black uppercase text-slate-400 tracking-wider">{{
              t('projects.roadmapProgress')
            }}</span>
            <span class="text-xs font-black text-emerald-500"
              >{{ calculateRoadmapProgress(roadmap) }}%</span
            >
          </div>
          <div class="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-accent to-emerald-500 rounded-full transition-all duration-700"
              :style="{ width: calculateRoadmapProgress(roadmap) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div class="space-y-5">
      <div class="relative pl-[25px] sm:pl-10 space-y-3.5 py-1 text-left">
        <div
          class="absolute left-[11px] sm:left-[19px] top-5 bottom-5 w-0.5 rounded-full bg-slate-200 dark:bg-slate-800"
        ></div>

        <div
          v-for="(step, index) in roadmap.steps"
          :key="step.id"
          class="relative cursor-pointer transition-all duration-300"
          @click="emit('update:activeStepId', step.id)"
        >
          <div
            v-if="index < roadmap.steps.length - 1 && isStepCompleted(step.id)"
            class="absolute left-[-13px] sm:left-[-21px] top-5 bottom-[-18px] w-0.5 bg-emerald-500 z-0 opacity-80"
          ></div>

          <div
            class="absolute -left-[25px] sm:-left-[41px] top-0.5 w-6.5 h-6.5 sm:w-8 sm:h-8 rounded-lg sm:rounded-2xl flex items-center justify-center z-10 border-2 border-white dark:border-slate-900 transition-all duration-300"
            :class="{
              'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 scale-105 ring-4 ring-emerald-500/10':
                getStepStatus(step, index) === 'completed',
              'bg-accent text-white shadow-md shadow-accent/20 animate-pulse ring-4 ring-accent/10':
                getStepStatus(step, index) === 'current',
              'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600':
                getStepStatus(step, index) === 'locked',
              'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700':
                getStepStatus(step, index) === 'upcoming',
            }"
          >
            <CheckCircle2
              v-if="getStepStatus(step, index) === 'completed'"
              class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5"
            />
            <Lock
              v-else-if="getStepStatus(step, index) === 'locked'"
              class="w-3 h-3 sm:w-3.5 sm:h-3.5"
            />
            <Zap
              v-else-if="getStepStatus(step, index) === 'current'"
              class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5"
            />
            <span v-else class="text-xs font-black">{{ index + 1 }}</span>
          </div>

          <div
            class="p-3 sm:p-4 rounded-xl border transition-all duration-300 relative group overflow-hidden"
            :class="{
              'bg-emerald-500/[0.01] dark:bg-emerald-500/[0.02] border-emerald-500/20':
                getStepStatus(step, index) === 'completed' && activeStepId !== step.id,
              'bg-accent/[0.02] border-accent/25 shadow-md shadow-accent/5 ring-1 ring-accent/5':
                getStepStatus(step, index) === 'current' && activeStepId !== step.id,
              'bg-slate-50/20 dark:bg-white/[0.005] border-slate-200/40 dark:border-white/5 opacity-55':
                getStepStatus(step, index) === 'locked' && activeStepId !== step.id,
              'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800':
                getStepStatus(step, index) === 'upcoming' && activeStepId !== step.id,
              'border-accent ring-2 ring-accent/20 bg-accent/[0.04] dark:bg-accent/[0.03] shadow-lg -translate-y-0.5':
                activeStepId === step.id,
            }"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-0.5 flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span
                    class="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.2 rounded"
                    :class="{
                      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':
                        getStepStatus(step, index) === 'completed',
                      'bg-accent/10 text-accent': getStepStatus(step, index) === 'current',
                      'bg-slate-100 dark:bg-white/5 text-slate-400':
                        getStepStatus(step, index) === 'locked',
                      'bg-slate-100 dark:bg-white/5 text-slate-500':
                        getStepStatus(step, index) === 'upcoming',
                    }"
                  >
                    {{ t('projects.stage', { num: index + 1 }) }}
                  </span>
                  <span
                    v-if="activeStepId === step.id"
                    class="text-[8px] font-black text-accent bg-accent/10 px-1.5 py-0.2 rounded flex items-center gap-0.5"
                  >
                    <Sparkle class="w-2.5 h-2.5" /> {{ t('projects.exploring') }}
                  </span>
                </div>
                <h3
                  class="text-xs sm:text-sm font-bold truncate transition-colors"
                  :class="{
                    'text-emerald-600 dark:text-emerald-400':
                      getStepStatus(step, index) === 'completed',
                    'text-accent': getStepStatus(step, index) === 'current',
                    'text-slate-400 dark:text-slate-500': getStepStatus(step, index) === 'locked',
                    'text-slate-800 dark:text-slate-100': getStepStatus(step, index) === 'upcoming',
                  }"
                >
                  {{ step.title }}
                </h3>
              </div>
              <div class="flex items-center gap-1 shrink-0 self-center">
                <div
                  v-if="isStepCompleted(step.id)"
                  class="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center"
                >
                  <CheckCircle2 class="w-3 h-3" />
                </div>
                <ArrowRight
                  class="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="activeStep"
        class="p-4 sm:p-5 rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md space-y-4 shadow-xl relative overflow-hidden text-left"
      >
        <div class="absolute -right-12 -top-12 w-24 h-24 bg-accent/5 rounded-full blur-2xl"></div>

        <div
          class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 relative z-10"
        >
          <div class="flex items-center gap-1.5">
            <div
              class="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center shrink-0"
            >
              <Gauge class="w-4 h-4" />
            </div>
            <div class="space-y-0.5">
              <h4 class="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                {{ t('projects.explorerAnalyzer') }}
              </h4>
              <p class="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {{ t('projects.stageDetailFocus') }}
              </p>
            </div>
          </div>
          <span
            class="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.2 rounded-full shrink-0"
          >
            {{
              t('projects.stage', {
                num: roadmap.steps.indexOf(activeStep) + 1,
              })
            }}
          </span>
        </div>

        <div class="space-y-1.5 relative z-10">
          <h3 class="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight">
            {{ activeStep.title }}
          </h3>
          <p
            class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-white/[0.01] p-2.5 rounded-xl border border-slate-100 dark:border-slate-800"
          >
            {{ activeStep.description || t('projects.customStepTip') }}
          </p>
        </div>

        <div class="pt-0.5 relative z-10">
          <Button
            variant="primary"
            size="sm"
            :icon="CheckCircle2"
            class="w-full !h-9 text-xs"
            :class="
              isStepCompleted(activeStep.id)
                ? '!bg-emerald-500 hover:!bg-emerald-600 hover:!shadow-emerald-500/20'
                : ''
            "
            @click="emit('toggle-step', activeStep.id)"
          >
            {{
              isStepCompleted(activeStep.id)
                ? t('projects.stepCompletedReset')
                : t('projects.stepCompleteTarget')
            }}
          </Button>
        </div>

        <div
          class="space-y-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 relative z-10"
        >
          <div
            class="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5"
          >
            <TrendingUp class="w-3 h-3 text-accent" />
            <span>{{ t('projects.skillsAssessment') }}</span>
          </div>

          <div class="space-y-1.5">
            <div>
              <div class="flex items-center justify-between text-[9px] text-slate-500 mb-0.5">
                <span>{{ t('projects.skillDifficulty') }}</span>
                <span class="font-bold text-slate-700 dark:text-slate-300">
                  {{ getMetricsForStep(activeStep, roadmap.steps.indexOf(activeStep)).difficulty }}%
                </span>
              </div>
              <div class="h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div
                  class="h-full bg-rose-500 transition-all duration-500"
                  :style="{
                    width:
                      getMetricsForStep(activeStep, roadmap.steps.indexOf(activeStep)).difficulty +
                      '%',
                  }"
                ></div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between text-[9px] text-slate-500 mb-0.5">
                <span>{{ t('projects.practicalWeight') }}</span>
                <span class="font-bold text-slate-700 dark:text-slate-300">
                  {{ getMetricsForStep(activeStep, roadmap.steps.indexOf(activeStep)).practical }}%
                </span>
              </div>
              <div class="h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div
                  class="h-full bg-purple-500 transition-all duration-500"
                  :style="{
                    width:
                      getMetricsForStep(activeStep, roadmap.steps.indexOf(activeStep)).practical +
                      '%',
                  }"
                ></div>
              </div>
            </div>

            <div class="flex items-center justify-between text-[11px] pt-0.5">
              <span class="text-slate-500 flex items-center gap-1">
                <Clock class="w-3 h-3 text-slate-400" />
                {{ t('projects.estimatedStudyTime') }}
              </span>
              <span class="font-black text-slate-700 dark:text-slate-200">
                {{ getMetricsForStep(activeStep, roadmap.steps.indexOf(activeStep)).duration }}
                <span class="text-[9px] font-normal text-slate-400">{{ t('projects.hours') }}</span>
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="getSubTasksForStep(activeStep).length > 0"
          class="space-y-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 relative z-10"
        >
          <div
            class="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest"
          >
            <ListTodo class="w-3 h-3 text-accent" />
            <span>{{ t('projects.skillsChecklist') }}</span>
          </div>

          <div
            class="space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800"
          >
            <div
              v-for="subtask in getSubTasksForStep(activeStep)"
              :key="subtask.id"
              class="flex items-start gap-2 group/item cursor-pointer"
              @click="toggleSubTask(subtask.id)"
            >
              <div
                class="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors mt-0.5"
                :class="
                  checkedSubTasks[subtask.id]
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/10'
                    : 'border-slate-300 dark:border-slate-600 group-hover/item:border-accent bg-white dark:bg-slate-800'
                "
              >
                <CheckCircle2 v-if="checkedSubTasks[subtask.id]" class="w-2.5 h-2.5 text-white" />
              </div>
              <span
                class="text-xs transition-all duration-300"
                :class="
                  checkedSubTasks[subtask.id]
                    ? 'text-slate-400 dark:text-slate-500 line-through'
                    : 'text-slate-600 dark:text-slate-300 group-hover/item:text-slate-800 dark:group-hover/item:text-slate-100'
                "
              >
                {{ subtask.text }}
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="getRelatedCourses(activeStep).length > 0"
          class="space-y-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 relative z-10"
        >
          <div
            class="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest"
          >
            <GraduationCap class="w-3 h-3 text-accent" />
            <span>{{ t('projects.recommendedCourses') }}</span>
          </div>

          <div class="space-y-2">
            <div
              v-for="course in getRelatedCourses(activeStep)"
              :key="course.id"
              class="flex gap-2 p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-500/[0.01] hover:border-accent/40 dark:hover:border-accent/40 hover:bg-white dark:hover:bg-slate-900/50 transition-all cursor-pointer group/card"
              @click="emit('navigate-to-course', course.id)"
            >
              <div
                class="w-14 h-9 rounded bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden"
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
                  class="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate group-hover/card:text-accent transition-colors leading-snug"
                >
                  {{ course.title }}
                </h4>
                <div class="flex items-center justify-between text-[8px] text-slate-400">
                  <span class="px-1 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-[8px]">
                    {{
                      course.difficulty === 'BEGINNER'
                        ? t('common.difficulty.beginner')
                        : course.difficulty === 'INTERMEDIATE'
                          ? t('common.difficulty.intermediate')
                          : t('common.difficulty.advanced')
                    }}
                  </span>
                  <span
                    class="text-accent flex items-center gap-0.5 font-bold group-hover/card:translate-x-0.5 transition-transform text-[8px]"
                  >
                    {{ t('projects.goMaster') }} <ArrowRight class="w-2 h-2" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
