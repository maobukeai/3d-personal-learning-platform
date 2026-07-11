<script lang="ts">
import { ref } from 'vue';

const cachedRoadmaps = ref<unknown[]>([]);
const cachedProgress = ref<unknown[]>([]);
const cachedCourses = ref<unknown[]>([]);

export default {
  name: 'RoadmapsView',
};
</script>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Map, Plus, Compass, User, Flame } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import PageHeader from '@/components/PageHeader.vue';
import RoadmapCard from '@/components/RoadmapCard.vue';
import { useWorkspaceStore } from '@/stores/workspace';
import RoadmapTimeline from './components/RoadmapTimeline.vue';
import RoadmapStepPanel from './components/RoadmapStepPanel.vue';
import RoadmapDetailHeader from './components/RoadmapDetailHeader.vue';
import RoadmapFormDialog from './components/RoadmapFormDialog.vue';
import { getRelatedCourses, getSubTasksForStep } from './utils/roadmapHelpers';
import type { Roadmap, RoadmapStep, Course } from '@/types';

interface RoadmapWithProject extends Roadmap {
  project?: { id: string; teamId: string | null } | null;
}

interface RoadmapProgress {
  roadmapStepId: string;
  completed: boolean;
}

const router = useRouter();
const { t } = useI18n();

const roadmaps = ref<RoadmapWithProject[]>(cachedRoadmaps.value as RoadmapWithProject[]);
const myProgress = ref<RoadmapProgress[]>(cachedProgress.value as RoadmapProgress[]);
const allCourses = ref<Course[]>(cachedCourses.value as Course[]);
const isLoading = ref(cachedRoadmaps.value.length === 0);
const selectedRoadmap = ref<RoadmapWithProject | null>(null);
const activeStepId = ref<string | null>(null);

// Tab management
const activeTab = ref<'system' | 'custom'>('system');

const workspaceStore = useWorkspaceStore();

// Modal CRUD state
const showFormDialog = ref(false);
const formRoadmap = ref<RoadmapWithProject | null>(null);

const openCreateDialog = () => {
  formRoadmap.value = null;
  showFormDialog.value = true;
};

const openEditDialog = () => {
  if (!selectedRoadmap.value) return;
  formRoadmap.value = selectedRoadmap.value;
  showFormDialog.value = true;
};

// Checklist persistent state
const checkedSubTasks = ref<Record<string, boolean>>({});

const loadCheckedSubTasks = () => {
  try {
    const saved = localStorage.getItem('learning_path_subtasks');
    if (saved) {
      checkedSubTasks.value = JSON.parse(saved);
    }
  } catch (e) {
    logError(e, { operation: 'loadCheckedSubTasks', view: 'RoadmapsView' });
  }
};

const toggleSubTask = (taskId: string) => {
  checkedSubTasks.value[taskId] = !checkedSubTasks.value[taskId];
  try {
    localStorage.setItem('learning_path_subtasks', JSON.stringify(checkedSubTasks.value));
  } catch (e) {
    logError(e, { operation: 'saveCheckedSubTasks', view: 'RoadmapsView' });
  }
};

const fetchData = async () => {
  if (roadmaps.value.length === 0) {
    isLoading.value = true;
  }
  try {
    const [roadRes, progRes, courseRes] = await Promise.all([
      api.get('/api/roadmaps'),
      api.get('/api/roadmaps/my-progress'),
      api.get('/api/courses'),
    ]);
    const fetchedRoadmaps = roadRes.data.data || [];
    const fetchedProgress = progRes.data || [];
    const fetchedCourses = courseRes.data || [];

    roadmaps.value = fetchedRoadmaps;
    myProgress.value = fetchedProgress;
    allCourses.value = fetchedCourses;

    // Save to global caches
    cachedRoadmaps.value = fetchedRoadmaps;
    cachedProgress.value = fetchedProgress;
    cachedCourses.value = fetchedCourses;

    // Keep active selected roadmap selection if still valid
    if (selectedRoadmap.value) {
      const match = fetchedRoadmaps.find(
        (r: RoadmapWithProject) => r.id === selectedRoadmap.value?.id,
      );
      if (match) {
        selectedRoadmap.value = match;
      } else {
        autoSelectFirstRoadmap();
      }
    } else {
      autoSelectFirstRoadmap();
    }
  } catch (_error) {
    ElMessage.error(t('roadmaps.loadFailed'));
  } finally {
    isLoading.value = false;
  }
};

const autoSelectFirstRoadmap = () => {
  const filtered = filteredRoadmaps.value;
  if (filtered.length > 0) {
    selectedRoadmap.value = filtered[0];
  } else {
    selectedRoadmap.value = null;
  }
};

const filteredRoadmaps = computed(() => {
  const activeWorkspaceId = workspaceStore.activeWorkspaceId;
  const currentWs = workspaceStore.currentWorkspace;
  if (activeTab.value === 'system') {
    return roadmaps.value.filter((r) => r.creatorId === null && !r.projectId);
  } else {
    return roadmaps.value.filter((r) => {
      if (r.creatorId === null && !r.projectId) return false;
      if (r.projectId) {
        return r.project?.teamId === activeWorkspaceId;
      }
      return !currentWs || currentWs.type === 'personal';
    });
  }
});

// Watch roadmap changes to auto-select the first step as active focus step
watch(
  selectedRoadmap,
  (newRm) => {
    if (newRm && newRm.steps && newRm.steps.length > 0) {
      activeStepId.value = newRm.steps[0].id;
    } else {
      activeStepId.value = null;
    }
  },
  { immediate: true },
);

// Switch roadmaps when active workspace changes
watch(
  () => workspaceStore.activeWorkspaceId,
  () => {
    selectedRoadmap.value = null;
    fetchData();
  },
);

const activeStep = computed(() => {
  if (
    !selectedRoadmap.value ||
    !selectedRoadmap.value.steps ||
    selectedRoadmap.value.steps.length === 0
  )
    return null;
  return (
    selectedRoadmap.value.steps.find((s) => s.id === activeStepId.value) ||
    selectedRoadmap.value.steps[0] ||
    null
  );
});

const isStepCompleted = (stepId: string) => {
  return myProgress.value.some((p) => p.roadmapStepId === stepId && p.completed);
};

const toggleStep = async (stepId: string) => {
  const isCompleted = isStepCompleted(stepId);
  try {
    await api.post('/api/roadmaps/step-progress', {
      stepId,
      completed: !isCompleted,
    });
    const progIndex = myProgress.value.findIndex((p) => p.roadmapStepId === stepId);
    if (progIndex > -1) {
      myProgress.value[progIndex].completed = !isCompleted;
    } else {
      myProgress.value.push({ roadmapStepId: stepId, completed: !isCompleted });
    }
    ElMessage.success(!isCompleted ? t('roadmaps.stepCompleted') : t('roadmaps.stepReset'));
  } catch (_error) {
    ElMessage.error(t('roadmaps.updateProgressFailed'));
  }
};

const calculateRoadmapProgress = (roadmap: Roadmap) => {
  if (!roadmap || !roadmap.steps || roadmap.steps.length === 0) return 0;
  const completedCount = roadmap.steps.filter((s) => isStepCompleted(s.id)).length;
  return Math.round((completedCount / roadmap.steps.length) * 100);
};

// Statistics calculation
const overallStats = computed(() => {
  const systemRoadmaps = roadmaps.value.filter((r) => r.creatorId === null);
  const customRoadmaps = roadmaps.value.filter((r) => r.creatorId !== null);

  const totalSteps = roadmaps.value.reduce((sum, r) => sum + (r.steps?.length || 0), 0);
  const completedSteps = roadmaps.value.reduce((sum, r) => {
    return sum + (r.steps?.filter((s) => isStepCompleted(s.id)).length || 0);
  }, 0);

  const completedRoadmaps = roadmaps.value.filter(
    (r) => calculateRoadmapProgress(r) === 100,
  ).length;

  const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  return {
    systemCount: systemRoadmaps.length,
    customCount: customRoadmaps.length,
    totalSteps,
    completedSteps,
    completedRoadmaps,
    overallProgress,
  };
});

const exportToMarkdown = () => {
  if (!selectedRoadmap.value) return;
  const rm = selectedRoadmap.value;
  let md = t('roadmaps.export.title', { title: rm.title });
  if (rm.description) md += `> ${rm.description}\n\n`;
  md += t('roadmaps.export.stagesHeader', { n: rm.steps?.length || 0 });

  (rm.steps || []).forEach((s, idx) => {
    const isDone = isStepCompleted(s.id) ? t('roadmaps.export.completed') : '';
    md += t('roadmaps.export.stageTitle', { n: idx + 1, title: s.title, status: isDone });
    if (s.description) md += `${s.description}\n\n`;

    const subTasks = getSubTasksForStep(s);
    if (subTasks.length > 0) {
      md += t('roadmaps.export.checklistHeader');
      subTasks.forEach((st) => {
        const checked = checkedSubTasks.value[st.id] ? '[x]' : '[ ]';
        md += `- ${checked} ${st.text}\n`;
      });
      md += `\n`;
    }

    const matched = getRelatedCourses(s, allCourses.value);
    if (matched.length > 0) {
      md += t('roadmaps.export.coursesHeader');
      matched.forEach((c) => {
        md += `- **${c.title}** (${t('roadmaps.export.difficulty')}: ${c.difficulty})\n`;
      });
      md += `\n`;
    }
  });

  md += t('roadmaps.export.footer', { time: new Date().toLocaleString() });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${rm.title}_${t('sidebar.roadmaps')}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  ElMessage.success(t('roadmaps.exportSuccess'));
};

const handleTabChange = (tab: 'system' | 'custom') => {
  activeTab.value = tab;
  autoSelectFirstRoadmap();
};

const deleteCustomRoadmap = async () => {
  const roadmap = selectedRoadmap.value;
  if (!roadmap) return;
  try {
    await ElMessageBox.confirm(
      t('roadmaps.deleteConfirm', { title: roadmap.title }),
      t('roadmaps.deleteWarning'),
      {
        confirmButtonText: t('roadmaps.deleteConfirmBtn'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        customClass: 'dark:bg-slate-800 dark:border-slate-700',
      },
    );

    await api.delete(`/api/roadmaps/${roadmap.id}`);
    ElMessage.success(t('roadmaps.deleteSuccess'));
    const idx = roadmaps.value.findIndex((r) => r.id === roadmap.id);
    if (idx > -1) roadmaps.value.splice(idx, 1);
    autoSelectFirstRoadmap();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('roadmaps.deleteFailed'));
    }
  }
};

const handleSavedRoadmap = (roadmap: Roadmap, isEditing: boolean) => {
  if (isEditing) {
    const idx = roadmaps.value.findIndex((r) => r.id === roadmap.id);
    if (idx > -1) roadmaps.value[idx] = roadmap as RoadmapWithProject;
  } else {
    roadmaps.value.unshift(roadmap as RoadmapWithProject);
  }
  selectedRoadmap.value = roadmap as RoadmapWithProject;
};

const circumference = 2 * Math.PI * 18;

const getCircumferenceProgressOffset = (progress: number) => {
  return circumference - (progress / 100) * circumference;
};

onMounted(() => {
  fetchData();
  loadCheckedSubTasks();
});
</script>

<template>
  <div
    class="mobile-adaptive flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Header -->
    <PageHeader :title="t('sidebar.roadmaps')" :subtitle="t('roadmaps.subtitle')" :icon="Map">
      <div v-if="!isLoading" class="mobile-row flex items-center gap-2 sm:gap-3">
        <!-- Dashboard widgets -->
        <div
          class="hidden lg:flex items-center gap-4 bg-slate-500/5 dark:bg-white/5 border border-slate-200/50 dark:border-slate-800 rounded-xl p-1.5 px-3"
        >
          <div class="flex items-center gap-1.5">
            <Compass class="w-4 h-4 text-emerald-500" />
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400"
              >{{ t('roadmaps.official') }}: {{ overallStats.systemCount }}</span
            >
          </div>
          <div class="w-px h-3 bg-slate-300 dark:bg-slate-700"></div>
          <div class="flex items-center gap-1.5">
            <User class="w-4 h-4 text-accent" />
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400"
              >{{ t('roadmaps.custom') }}: {{ overallStats.customCount }}</span
            >
          </div>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-4">
          <div
            class="flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-900/60"
          >
            <Flame class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
            <span class="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300"
              >{{ overallStats.completedSteps }}/{{ overallStats.totalSteps }}
              <span class="text-slate-400 font-normal">{{ t('roadmaps.stageUnit') }}</span></span
            >
          </div>
        </div>

        <div
          class="relative w-7 h-7 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center bg-white dark:bg-slate-900/60 rounded-full border border-slate-200/50 dark:border-slate-800"
        >
          <svg class="w-7 h-7 sm:w-9 sm:h-9 -rotate-90" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              class="text-slate-100 dark:text-white/10"
            />
            <circle
              cx="20"
              cy="20"
              r="18"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              class="text-emerald-500 transition-all duration-700"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="getCircumferenceProgressOffset(overallStats.overallProgress)"
            />
          </svg>
          <span class="absolute text-[8px] sm:text-[9px] font-black text-emerald-600"
            >{{ overallStats.overallProgress }}%</span
          >
        </div>
      </div>
    </PageHeader>

    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
      <!-- Roadmap Selector Sidebar (Extremely Compact on Mobile) -->
      <div
        class="w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-col shrink-0 p-1.5 sm:p-3 md:p-4 gap-1.5 sm:gap-3"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <!-- Custom/System Tabs Switcher & Inline Add Button (Merged Row on Mobile) -->
        <div class="mobile-row flex items-center gap-1.5">
          <div
            class="flex-1 flex relative p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-900/80 rounded-lg sm:rounded-xl"
          >
            <!-- Sliding Indicator Wrapper -->
            <div
              class="absolute top-0 bottom-0 left-0 w-1/2 p-0.5 sm:p-1"
              style="
                transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
                will-change: transform;
              "
              :style="{
                transform:
                  activeTab === 'system' ? 'translate3d(0, 0, 0)' : 'translate3d(100%, 0, 0)',
              }"
            >
              <div
                class="w-full h-full bg-white dark:bg-slate-800 rounded-md sm:rounded-lg shadow-xs"
              ></div>
            </div>

            <button
              type="button"
              class="flex-1 flex relative z-10 items-center justify-center gap-1 py-1 sm:py-2 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-all cursor-pointer"
              :class="
                activeTab === 'system'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              "
              @click="handleTabChange('system')"
            >
              <Compass class="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span class="truncate">{{ t('roadmaps.officialRecommend') }}</span>
            </button>
            <button
              type="button"
              class="flex-1 flex relative z-10 items-center justify-center gap-1 py-1 sm:py-2 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-all cursor-pointer"
              :class="
                activeTab === 'custom'
                  ? 'text-accent'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              "
              @click="handleTabChange('custom')"
            >
              <User class="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span class="truncate">{{ t('roadmaps.myLearningPlan') }}</span>
            </button>
          </div>

          <!-- Add Button Inline (Saves a full row on mobile!) -->
          <button
            v-if="activeTab === 'custom'"
            type="button"
            class="md:hidden p-1.5 bg-accent text-white rounded-lg hover:bg-accent-dark transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-md"
            @click="openCreateDialog"
          >
            <Plus class="w-4 h-4 shrink-0" />
          </button>
        </div>

        <!-- Add Custom Roadmap Button (Desktop Only) -->
        <button
          v-if="activeTab === 'custom'"
          type="button"
          class="hidden md:flex w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-accent hover:bg-accent-dark transition-all items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-accent/20"
          @click="openCreateDialog"
        >
          <Plus class="w-4 h-4" />
          {{ t('roadmaps.createRoadmap') }}
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
              @click="selectedRoadmap = roadmap"
            />

            <div
              v-if="filteredRoadmaps.length === 0"
              class="hidden md:flex flex-col items-center justify-center py-10 text-center"
            >
              <Map class="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
              <p class="text-xs text-slate-400">
                {{ activeTab === 'system' ? t('roadmaps.noOfficial') : t('roadmaps.noCustom') }}
              </p>
            </div>
          </template>
        </div>
      </div>

      <!-- Roadmap Detail Timeline & Analytical Sidebar (Double Column Split Layout) -->
      <div class="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4.5 scrollbar-hide">
        <div
          v-if="selectedRoadmap"
          :key="selectedRoadmap.id"
          class="w-full max-w-none space-y-3 sm:space-y-4"
        >
          <RoadmapDetailHeader
            :roadmap="selectedRoadmap"
            :progress="calculateRoadmapProgress(selectedRoadmap)"
            :completed-count="
              selectedRoadmap.steps?.filter((s: RoadmapStep) => isStepCompleted(s.id)).length || 0
            "
            @enter-project="
              router.push({
                name: 'ProjectDetail',
                params: { id: selectedRoadmap.projectId },
              })
            "
            @export="exportToMarkdown"
            @edit="openEditDialog"
            @delete="deleteCustomRoadmap"
          />

          <!-- Professional 2-Column Split Layout -->
          <div class="roadmap-detail-grid grid grid-cols-12 gap-3 sm:gap-6 items-start">
            <RoadmapTimeline
              :steps="selectedRoadmap.steps"
              :active-step-id="activeStepId"
              :is-step-completed="isStepCompleted"
              @update:active-step-id="activeStepId = $event"
            />

            <RoadmapStepPanel
              :active-step="activeStep"
              :selected-roadmap="selectedRoadmap"
              :is-step-completed="isStepCompleted"
              :checked-sub-tasks="checkedSubTasks"
              :all-courses="allCourses"
              @toggle-step="toggleStep"
              @toggle-sub-task="toggleSubTask"
              @navigate-to-course="router.push({ name: 'CourseDetail', params: { id: $event } })"
            />
          </div>
        </div>

        <!-- Empty State - No Roadmaps -->
        <div
          v-else-if="!isLoading && roadmaps.length === 0"
          class="h-full flex flex-col items-center justify-center py-20 text-center"
        >
          <div
            class="w-20 h-20 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6 border border-slate-200/50 dark:border-slate-800"
          >
            <Map class="w-10 h-10 text-slate-300 dark:text-slate-600 animate-pulse" />
          </div>
          <h3 class="text-lg font-bold mb-2 text-slate-800 dark:text-slate-100">
            {{ t('roadmaps.noRoadmapsTitle') }}
          </h3>
          <p class="text-sm text-slate-400 max-w-xs leading-relaxed">
            {{ t('roadmaps.noRoadmapsDesc') }}
          </p>
        </div>

        <!-- Empty State - No Selection -->
        <div
          v-else-if="!isLoading"
          class="h-full flex flex-col items-center justify-center py-20 text-center"
        >
          <div
            class="w-20 h-20 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6 border border-slate-200/50 dark:border-slate-800"
          >
            <Compass class="w-10 h-10 text-slate-300 dark:text-slate-600 animate-pulse" />
          </div>
          <h3 class="text-lg font-bold mb-2 text-slate-800 dark:text-slate-100">
            {{ t('roadmaps.noSelectionTitle') }}
          </h3>
          <p class="text-sm text-slate-400">
            {{ t('roadmaps.noSelectionDesc') }}
          </p>
        </div>
      </div>
    </div>

    <RoadmapFormDialog
      v-model:show="showFormDialog"
      :roadmap="formRoadmap"
      @saved="handleSavedRoadmap"
    />
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

@media (max-width: 767px) {
  .roadmap-detail-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
  .roadmap-detail-grid > :deep(.roadmap-left-panel),
  .roadmap-detail-grid > :deep(.roadmap-right-panel) {
    grid-column: 1 / -1;
  }
  .roadmap-detail-grid > :deep(.roadmap-right-panel) {
    position: static;
  }
}
</style>
