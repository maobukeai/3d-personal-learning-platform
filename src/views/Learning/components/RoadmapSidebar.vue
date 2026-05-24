<script setup lang="ts">
import { Compass, User, Plus, Map } from 'lucide-vue-next';
import RoadmapCard from '@/components/RoadmapCard.vue';

interface RoadmapStep {
  id: string;
}

interface RoadmapProgress {
  roadmapStepId: string;
  completed: boolean;
}

interface RoadmapSummary {
  id: string;
  steps?: RoadmapStep[];
}

const props = defineProps<{
  isLoading: boolean;
  filteredRoadmaps: RoadmapSummary[];
  selectedRoadmap: RoadmapSummary | null;
  activeTab: 'system' | 'custom';
  overallStats: {
    systemCount: number;
    customCount: number;
    totalSteps: number;
    completedSteps: number;
    completedRoadmaps: number;
    overallProgress: number;
  };
  myProgress: RoadmapProgress[];
}>();

const emit = defineEmits<{
  (e: 'tab-change', tab: 'system' | 'custom'): void;
  (e: 'select-roadmap', roadmap: RoadmapSummary): void;
  (e: 'open-create'): void;
}>();

const isStepCompleted = (stepId: string) => {
  return props.myProgress.some((p) => p.roadmapStepId === stepId && p.completed);
};

const calculateRoadmapProgress = (roadmap: RoadmapSummary) => {
  if (!roadmap || !roadmap.steps || roadmap.steps.length === 0) return 0;
  const completedCount = roadmap.steps.filter((step) => isStepCompleted(step.id)).length;
  return Math.round((completedCount / roadmap.steps.length) * 100);
};
</script>

<template>
  <div
    class="w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-col shrink-0 p-1.5 sm:p-3 md:p-4 gap-1.5 sm:gap-3"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <!-- Custom/System Tabs Switcher & Inline Add Button (Merged Row on Mobile) -->
    <div class="flex items-center gap-1.5">
      <div
        class="flex-1 flex p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-900/80 rounded-lg sm:rounded-xl"
      >
        <button
type="button" class="flex-1 flex items-center justify-center gap-1 py-1 sm:py-2 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-all cursor-pointer" :class="
            activeTab === 'system'
              ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          " @click="emit('tab-change', 'system')">
          <Compass class="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span class="truncate">官方推荐</span>
        </button>
        <button
type="button" class="flex-1 flex items-center justify-center gap-1 py-1 sm:py-2 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-all cursor-pointer" :class="
            activeTab === 'custom'
              ? 'bg-white dark:bg-slate-800 text-accent shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          " @click="emit('tab-change', 'custom')">
          <User class="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span class="truncate">我的学习计划</span>
        </button>
      </div>

      <!-- Add Button Inline (Saves a full row on mobile!) -->
      <button v-if="activeTab === 'custom'" type="button" class="md:hidden p-1.5 bg-accent text-white rounded-lg hover:bg-accent-dark transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-md" @click="emit('open-create')">
        <Plus class="w-4 h-4 shrink-0" />
      </button>
    </div>

    <!-- Add Custom Roadmap Button (Desktop Only) -->
    <button v-if="activeTab === 'custom'" type="button" class="hidden md:flex w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-accent hover:bg-accent-dark transition-all items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-accent/20" @click="emit('open-create')">
      <Plus class="w-4 h-4" />
      规划个性化学习路径
    </button>

    <!-- Roadmap selector list -->
    <div
      class="flex-1 overflow-x-auto md:overflow-y-auto flex flex-row md:flex-col gap-2 scrollbar-hide"
    >
      <template v-if="isLoading">
        <div
          v-for="i in 3"
          :key="i"
          class="p-4 rounded-2xl animate-pulse shrink-0 w-48 md:w-full"
          style="background-color: var(--bg-app)"
        >
          <div class="h-4 bg-slate-200 dark:bg-white/10 rounded-lg w-3/4 mb-3"></div>
          <div class="h-3 bg-slate-200 dark:bg-white/10 rounded-lg w-full mb-2"></div>
          <div class="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full w-full"></div>
        </div>
      </template>

      <template v-else>
        <RoadmapCard
          v-for="roadmap in filteredRoadmaps"
          :key="roadmap.id"
          :roadmap="roadmap"
          :active="selectedRoadmap?.id === roadmap.id"
          :progress="calculateRoadmapProgress(roadmap)"
          @click="emit('select-roadmap', roadmap)"
        />

        <div
          v-if="filteredRoadmaps.length === 0"
          class="hidden md:flex flex-col items-center justify-center py-10 text-center"
        >
          <Map class="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
          <p class="text-xs text-slate-400">
            {{ activeTab === 'system' ? '暂无系统官方推荐路线' : '您还没有规划过学习计划哦' }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
