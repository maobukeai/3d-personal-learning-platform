<script setup lang="ts">
import {
  CheckCircle2,
  Lock,
  Zap,
  Sparkle,
  ArrowRight,
} from 'lucide-vue-next';

interface RoadmapStep {
  id: string;
  title: string;
  description?: string | null;
  subtasks?: string[] | string | null;
}

interface RoadmapTimelineItem {
  id: string;
  steps: RoadmapStep[];
}

interface RoadmapProgressItem {
  roadmapStepId: string;
  completed: boolean;
}

const props = defineProps<{
  selectedRoadmap: RoadmapTimelineItem;
  activeStepId: string | null;
  myProgress: RoadmapProgressItem[];
}>();

const emit = defineEmits<{
  (e: 'select-step', stepId: string): void;
}>();

const isStepCompleted = (stepId: string) => {
  return props.myProgress.some((p) => p.roadmapStepId === stepId && p.completed);
};

const isStepLocked = (_step: RoadmapStep, index: number | string) => {
  const idx = Number(index);
  if (idx === 0) return false;
  if (!props.selectedRoadmap) return false;
  const prevStep = props.selectedRoadmap.steps[idx - 1];
  return prevStep && !isStepCompleted(prevStep.id);
};

const getStepStatus = (step: RoadmapStep, index: number | string) => {
  const idx = Number(index);
  if (isStepCompleted(step.id)) return 'completed';
  if (isStepLocked(step, idx)) return 'locked';
  if (
    idx === 0 ||
    (props.selectedRoadmap && isStepCompleted(props.selectedRoadmap.steps[idx - 1]?.id))
  )
    return 'current';
  return 'upcoming';
};
</script>

<template>
  <div class="col-span-12 md:col-span-7 lg:col-span-8 space-y-3 sm:space-y-4">
    <div class="relative pl-[23px] sm:pl-10 space-y-3 sm:space-y-5 py-1 sm:py-2">
      <!-- Connective glowing neon line -->
      <div
        class="absolute left-[10px] sm:left-[19px] top-5 sm:top-6 bottom-5 sm:bottom-6 w-0.5 rounded-full bg-slate-200 dark:bg-slate-800"
      ></div>

      <div
        v-for="(step, index) in selectedRoadmap.steps"
        :key="step.id"
        class="relative cursor-pointer transition-all duration-300"
        @click="emit('select-step', step.id)"
      >
        <!-- Connecting glowing track representing current progress -->
        <div
          v-if="
            Number(index) < selectedRoadmap.steps.length - 1 && isStepCompleted(step.id)
          "
          class="absolute left-[-13px] sm:left-[-28px] top-5 sm:top-6 bottom-[-18px] sm:bottom-[-24px] w-0.5 bg-emerald-500 z-0 opacity-80"
        ></div>

        <!-- Roadmap step indicator node -->
        <div
          class="absolute -left-[23px] sm:-left-[47px] top-1 sm:top-2 w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-2xl flex items-center justify-center z-10 border-2 border-white dark:border-slate-950 transition-all duration-300"
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
            class="w-3 h-3 sm:w-4 sm:h-4"
          />
          <Lock
            v-else-if="getStepStatus(step, index) === 'locked'"
            class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5"
          />
          <Zap
            v-else-if="getStepStatus(step, index) === 'current'"
            class="w-3 h-3 sm:w-4 sm:h-4"
          />
          <span v-else class="text-[9px] sm:text-xs font-black">{{
            Number(index) + 1
          }}</span>
        </div>

        <!-- Flow card block -->
        <div
          class="p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border transition-all duration-300 relative group overflow-hidden"
          :class="{
            'bg-emerald-500/[0.01] dark:bg-emerald-500/[0.02] border-emerald-500/20':
              getStepStatus(step, index) === 'completed' && activeStepId !== step.id,
            'bg-accent/[0.02] border-accent/25 shadow-md shadow-accent/5 ring-1 ring-accent/5':
              getStepStatus(step, index) === 'current' && activeStepId !== step.id,
            'bg-slate-50/20 dark:bg-white/[0.005] border-slate-200/40 dark:border-white/5 opacity-55':
              getStepStatus(step, index) === 'locked' && activeStepId !== step.id,
            'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800':
              getStepStatus(step, index) === 'upcoming' && activeStepId !== step.id,
            // Active selected node highlight style
            'border-accent ring-2 ring-accent/20 bg-accent/[0.04] dark:bg-accent/[0.03] shadow-lg -translate-y-0.5':
              activeStepId === step.id,
          }"
        >
          <div class="flex items-start justify-between gap-1.5 sm:gap-4">
            <div class="space-y-0.5 sm:space-y-1 flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-1">
                <span
                  class="text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-1.5 sm:py-0.5 rounded"
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
                  模块 {{ Number(index) + 1 }}
                </span>

                <span
                  v-if="activeStepId === step.id"
                  class="text-[8px] font-black text-accent bg-accent/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 animate-pulse"
                >
                  <Sparkle class="w-2 h-2" /> 聚焦中
                </span>
              </div>

              <h3
                class="text-xs sm:text-base font-bold transition-colors truncate"
                :class="{
                  'text-emerald-600 dark:text-emerald-400':
                    getStepStatus(step, index) === 'completed',
                  'text-accent': getStepStatus(step, index) === 'current',
                  'text-slate-400 dark:text-slate-500':
                    getStepStatus(step, index) === 'locked',
                  'text-slate-800 dark:text-slate-100':
                    getStepStatus(step, index) === 'upcoming',
                }"
              >
                {{ step.title }}
              </h3>

              <p
                class="hidden sm:block text-xs text-slate-400 dark:text-slate-550 line-clamp-2 leading-relaxed"
              >
                {{
                  step.description ||
                  '当前阶段暂无详细指引。点击即可在右侧面板查看智能技能 Checklist 及关联推荐。'
                }}
              </p>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <!-- Tiny node completion tick indicator -->
              <div
                v-if="isStepCompleted(step.id)"
                class="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"
              >
                <CheckCircle2 class="w-3 h-3" />
              </div>
              <ArrowRight
                class="w-3 sm:w-4 h-3 sm:h-4 text-slate-300 dark:text-slate-650 group-hover:translate-x-0.5 transition-transform shrink-0"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
