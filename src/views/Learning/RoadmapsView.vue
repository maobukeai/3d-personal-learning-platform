<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Map,
  CheckCircle2,
  Trophy,
  ArrowRight,
  Sparkles,
  BookOpen,
  Target,
  Flame,
  Zap,
  CircleCheck,
  Lock,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import PageHeader from '@/components/PageHeader.vue';
import RoadmapCard from '@/components/RoadmapCard.vue';

const roadmaps = ref<any[]>([]);
const myProgress = ref<any[]>([]);
const isLoading = ref(false);
const selectedRoadmap = ref<any>(null);

const fetchData = async () => {
  isLoading.value = true;
  try {
    const [roadRes, progRes] = await Promise.all([
      api.get('/api/roadmaps'),
      api.get('/api/roadmaps/my-progress'),
    ]);
    roadmaps.value = roadRes.data;
    myProgress.value = progRes.data;
    if (roadmaps.value.length > 0) {
      selectedRoadmap.value = roadmaps.value[0];
    }
  } catch (error) {
    ElMessage.error('加载学习路线失败');
  } finally {
    isLoading.value = false;
  }
};

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
    ElMessage.success(!isCompleted ? '恭喜完成该阶段！' : '已重置阶段进度');
  } catch (error) {
    ElMessage.error('更新进度失败');
  }
};

const calculateRoadmapProgress = (roadmap: any) => {
  if (!roadmap.steps || roadmap.steps.length === 0) return 0;
  const completedCount = roadmap.steps.filter((s: any) => isStepCompleted(s.id)).length;
  return Math.round((completedCount / roadmap.steps.length) * 100);
};

const overallStats = computed(() => {
  const totalSteps = roadmaps.value.reduce((sum, r) => sum + (r.steps?.length || 0), 0);
  const completedSteps = roadmaps.value.reduce((sum, r) => {
    return sum + (r.steps?.filter((s: any) => isStepCompleted(s.id)).length || 0);
  }, 0);
  const completedRoadmaps = roadmaps.value.filter(
    (r) => calculateRoadmapProgress(r) === 100,
  ).length;
  const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  return { totalSteps, completedSteps, completedRoadmaps, overallProgress };
});

const isStepLocked = (_step: any, index: number | string) => {
  const idx = Number(index);
  if (idx === 0) return false;
  if (!selectedRoadmap.value) return false;
  const prevStep = selectedRoadmap.value.steps[idx - 1];
  return prevStep && !isStepCompleted(prevStep.id);
};

const getStepStatus = (step: any, index: number | string) => {
  const idx = Number(index);
  if (isStepCompleted(step.id)) return 'completed';
  if (isStepLocked(step, idx)) return 'locked';
  if (
    idx === 0 ||
    (selectedRoadmap.value && isStepCompleted(selectedRoadmap.value.steps[idx - 1]?.id))
  )
    return 'current';
  return 'upcoming';
};

const circumference = 2 * Math.PI * 18;

const getProgressOffset = (progress: number) => {
  return circumference - (progress / 100) * circumference;
};

onMounted(fetchData);
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Header -->
    <PageHeader
      title="学习路径"
      subtitle="规划你的 3D 学习旅程"
      :icon="Map"
    >
      <!-- Overall Progress Ring -->
      <div v-if="!isLoading && roadmaps.length > 0" class="flex items-center justify-between w-full sm:w-auto gap-2.5 sm:gap-6">
        <div class="flex items-center gap-1 sm:gap-3">
          <div
            class="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-0.5 sm:py-1.5 rounded-lg sm:rounded-xl"
            style="background-color: var(--bg-app)"
          >
            <Target class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-accent" />
            <span class="text-[8px] sm:text-[10px] font-bold" style="color: var(--text-secondary)"
              >{{ roadmaps.length }} <span class="hidden xs:inline">条路线</span></span
            >
          </div>
          <div
            class="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-0.5 sm:py-1.5 rounded-lg sm:rounded-xl"
            style="background-color: var(--bg-app)"
          >
            <Flame class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-amber-500" />
            <span class="text-[8px] sm:text-[10px] font-bold" style="color: var(--text-secondary)"
              >{{ overallStats.completedSteps }}/{{ overallStats.totalSteps }} <span class="hidden xs:inline">阶段</span></span
            >
          </div>
        </div>
        <div class="relative w-7 h-7 sm:w-10 sm:h-10">
          <svg class="w-7 h-7 sm:w-10 sm:h-10 -rotate-90" viewBox="0 0 40 40">
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
              :stroke-dashoffset="getProgressOffset(overallStats.overallProgress)"
            />
          </svg>
          <span
            class="absolute inset-0 flex items-center justify-center text-[6px] sm:text-[9px] font-black text-emerald-600"
            >{{ overallStats.overallProgress }}%</span
          >
        </div>
      </div>
    </PageHeader>

    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
      <!-- Roadmap Selector Sidebar -->
      <div
        class="w-full md:w-80 border-b md:border-b-0 md:border-r flex flex-row md:flex-col shrink-0 overflow-x-auto md:overflow-y-auto p-2.5 md:p-5 gap-2 md:space-y-3 scrollbar-hide"
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <h2 class="hidden md:block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 px-1">
          可用的路线
        </h2>

        <!-- Loading Skeleton -->
        <template v-if="isLoading">
          <div
            v-for="i in 3"
            :key="i"
            class="p-4 rounded-2xl animate-pulse shrink-0 w-56 md:w-full"
            style="background-color: var(--bg-app)"
          >
            <div class="h-4 bg-slate-200 dark:bg-white/10 rounded-lg w-3/4 mb-3"></div>
            <div class="h-3 bg-slate-200 dark:bg-white/10 rounded-lg w-full mb-2"></div>
            <div class="h-3 bg-slate-200 dark:bg-white/10 rounded-lg w-1/2 mb-4"></div>
            <div class="h-1.5 bg-slate-200 dark:bg-white/10 rounded-full w-full"></div>
          </div>
        </template>

          <RoadmapCard
            v-for="roadmap in roadmaps"
            :key="roadmap.id"
            :roadmap="roadmap"
            :active="selectedRoadmap?.id === roadmap.id"
            :progress="calculateRoadmapProgress(roadmap)"
            @click="selectedRoadmap = roadmap"
          />
      </div>

      <!-- Roadmap Detail Timeline -->
      <div class="flex-1 overflow-y-auto p-3.5 sm:p-6 md:p-10 scrollbar-hide">
        <!-- Loading Skeleton for Detail -->
        <div v-if="isLoading" class="max-w-3xl mx-auto">
          <div class="text-center mb-5 md:mb-12 animate-pulse">
            <div class="h-4 bg-slate-200 dark:bg-white/10 rounded-lg w-20 md:w-32 mx-auto mb-2.5"></div>
            <div class="h-6 md:h-10 bg-slate-200 dark:bg-white/10 rounded-lg w-4/5 md:w-2/3 mx-auto mb-2.5"></div>
            <div class="h-3 bg-slate-200 dark:bg-white/10 rounded-lg w-2/3 md:w-1/2 mx-auto"></div>
          </div>
          <div class="space-y-3.5 md:space-y-8">
            <div v-for="i in 4" :key="i" class="flex gap-3 md:gap-6 animate-pulse">
              <div class="w-7 h-7 md:w-14 md:h-14 bg-slate-200 dark:bg-white/10 rounded-lg md:rounded-2xl shrink-0"></div>
              <div class="flex-1 p-3 md:p-6 bg-slate-200 dark:bg-white/10 rounded-xl md:rounded-3xl">
                <div class="h-4 bg-slate-300 dark:bg-white/15 rounded-lg w-1/3 mb-1.5"></div>
                <div class="h-2 bg-slate-300 dark:bg-white/15 rounded-lg w-full mb-1"></div>
                <div class="h-2 bg-slate-300 dark:bg-white/15 rounded-lg w-2/3"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="selectedRoadmap" :key="selectedRoadmap.id" class="max-w-3xl mx-auto">
          <!-- Roadmap Header -->
          <div class="mb-5 md:mb-10 text-center">
            <div
              class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] md:text-[10px] font-bold rounded-full mb-1.5 md:mb-4"
            >
              <Sparkles class="w-2.5 h-2.5" /> 推荐学习路径
            </div>
            <h2 class="text-lg md:text-3xl font-black mb-1 md:mb-3" style="color: var(--text-primary)">
              {{ selectedRoadmap.title }}
            </h2>
            <p
              class="text-[10px] md:text-sm leading-relaxed max-w-xl mx-auto px-2"
              style="color: var(--text-secondary)"
            >
              {{ selectedRoadmap.description }}
            </p>

            <!-- Progress Summary Bar -->
            <div
              class="mt-3.5 md:mt-6 flex overflow-x-auto sm:overflow-visible items-center gap-2 md:gap-4 px-2.5 md:px-5 py-1.5 md:py-3 rounded-xl md:rounded-2xl border scrollbar-hide"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-1 shrink-0">
                <Target class="w-2.5 h-2.5 md:w-4 md:h-4 text-accent" />
                <span class="text-[8px] md:text-xs font-bold" style="color: var(--text-secondary)"
                  >{{ selectedRoadmap.steps?.length || 0 }} <span class="hidden sm:hidden md:inline">个阶段</span><span class="inline sm:inline md:hidden">阶段</span></span
                >
              </div>
              <div class="hidden sm:block w-px h-4 shrink-0" style="background-color: var(--border-base)"></div>
              <div class="flex items-center gap-1 shrink-0">
                <CircleCheck class="w-2.5 h-2.5 md:w-4 md:h-4 text-emerald-500" />
                <span class="text-[8px] md:text-xs font-bold" style="color: var(--text-secondary)"
                  >{{
                    selectedRoadmap.steps?.filter((s: any) => isStepCompleted(s.id)).length || 0
                  }}
                  <span class="hidden sm:hidden md:inline">已完成</span><span class="inline sm:inline md:hidden">完成</span></span
                >
              </div>
              <div class="hidden sm:block w-px h-4 shrink-0" style="background-color: var(--border-base)"></div>
              <div class="flex-1 min-w-[80px] flex items-center gap-1.5 shrink-0 sm:shrink">
                <div class="flex-1 sm:w-16 md:w-20 h-1 md:h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    :style="{ width: calculateRoadmapProgress(selectedRoadmap) + '%' }"
                  ></div>
                </div>
                <span class="text-[8px] md:text-xs font-black text-emerald-600"
                  >{{ calculateRoadmapProgress(selectedRoadmap) }}%</span
                >
              </div>
            </div>
          </div>

          <!-- Timeline -->
          <div class="relative space-y-0">
            <!-- Timeline Line -->
            <div
              class="absolute left-[13px] md:left-[27px] top-6 md:top-8 bottom-6 md:bottom-8 w-0.5 rounded-full transition-colors duration-500"
              style="background-color: var(--border-base)"
            ></div>

            <div
              v-for="(step, index) in selectedRoadmap.steps"
              :key="step.id"
              class="relative pl-9 md:pl-20 pb-5 md:pb-10 group last:pb-0"
            >
              <!-- Timeline Dot -->
              <div
                class="absolute left-0 top-0 w-7 h-7 md:w-14 md:h-14 rounded-lg md:rounded-2xl flex items-center justify-center transition-all z-10 border-[1.5px] md:border-4 border-white dark:border-slate-950"
                :class="{
                  'bg-emerald-500 text-white shadow-md md:shadow-xl shadow-emerald-500/20 cursor-pointer scale-105':
                    getStepStatus(step, index) === 'completed',
                  'bg-accent text-white shadow-md md:shadow-xl shadow-accent/20 cursor-pointer animate-pulse':
                    getStepStatus(step, index) === 'current',
                  'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed':
                    getStepStatus(step, index) === 'locked',
                  'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm':
                    getStepStatus(step, index) === 'upcoming',
                }"
                @click="!isStepLocked(step, index) && toggleStep(step.id)"
              >
                <CheckCircle2 v-if="getStepStatus(step, index) === 'completed'" class="w-3 h-3 md:w-6 md:h-6" />
                <Lock v-else-if="getStepStatus(step, index) === 'locked'" class="w-2.5 h-2.5 md:w-5 md:h-5" />
                <Zap v-else-if="getStepStatus(step, index) === 'current'" class="w-3 h-3 md:w-6 md:h-6" />
                <span v-else class="text-[10px] md:text-lg font-black">{{ Number(index) + 1 }}</span>
              </div>

              <!-- Step Content -->
              <div
                class="p-2.5 md:p-6 rounded-lg md:rounded-2xl border transition-all duration-300"
                :class="{
                  'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-500/20 shadow-sm':
                    getStepStatus(step, index) === 'completed',
                  'bg-accent/5 border-accent/20 shadow-lg shadow-accent/5 ring-1 ring-accent/10':
                    getStepStatus(step, index) === 'current',
                  'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/50 dark:border-white/5 opacity-60':
                    getStepStatus(step, index) === 'locked',
                  'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-lg hover:-translate-y-0.5 group-hover:border-accent/20':
                    getStepStatus(step, index) === 'upcoming',
                }"
              >
                <div class="flex items-center justify-between mb-1 md:mb-3">
                  <div class="flex items-center gap-1 md:gap-3">
                    <span
                      class="text-[7px] md:text-[10px] font-black uppercase tracking-widest px-1 py-0.5 md:px-2.5 md:py-1 rounded-md md:rounded-lg"
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
                      阶段 {{ Number(index) + 1 }}
                    </span>
                    <span
                      v-if="getStepStatus(step, index) === 'completed'"
                      class="flex items-center gap-0.5 text-[7px] md:text-[10px] font-bold text-emerald-500"
                    >
                      <CheckCircle2 class="w-2.5 h-2.5" /> <span class="hidden xs:inline">已完成</span>
                    </span>
                    <span
                      v-else-if="getStepStatus(step, index) === 'current'"
                      class="flex items-center gap-0.5 text-[7px] md:text-[10px] font-bold text-accent"
                    >
                      <Zap class="w-2.5 h-2.5" /> <span class="hidden xs:inline">进行中</span>
                    </span>
                    <span
                      v-else-if="getStepStatus(step, index) === 'locked'"
                      class="flex items-center gap-0.5 text-[7px] md:text-[10px] font-bold text-slate-400"
                    >
                      <Lock class="w-2.5 h-2.5" /> <span class="hidden xs:inline">未解锁</span>
                    </span>
                  </div>
                </div>

                <h3
                  class="text-[14px] md:text-lg font-bold mb-1 md:mb-2"
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

                <p class="text-[11px] md:text-sm leading-relaxed mb-2.5 md:mb-5" style="color: var(--text-secondary)">
                  {{ step.description }}
                </p>

                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                  <div
                    class="flex items-center gap-1 text-[7px] md:text-[10px] font-bold"
                    style="color: var(--text-muted)"
                  >
                    <BookOpen class="w-3 h-3" /> 建议学习课程
                  </div>
                  <button
                    v-if="getStepStatus(step, index) !== 'locked'"
                    class="w-full sm:w-auto px-2.5 py-1 md:px-4 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-xs font-bold transition-all flex items-center justify-center gap-1 md:gap-2"
                    :class="{
                      'bg-emerald-500 text-white hover:bg-emerald-600':
                        getStepStatus(step, index) === 'completed',
                      'bg-accent text-white hover:bg-accent-dark shadow-sm md:shadow-lg shadow-accent/20':
                        getStepStatus(step, index) === 'current',
                      'bg-slate-900 text-white hover:bg-accent':
                        getStepStatus(step, index) === 'upcoming',
                    }"
                    @click.stop="toggleStep(step.id)"
                  >
                    {{ getStepStatus(step, index) === 'completed' ? '取消完成' : '标记完成' }}
                    <ArrowRight
                      v-if="getStepStatus(step, index) !== 'completed'"
                      class="w-3 h-3 md:w-3.5 md:h-3.5"
                    />
                  </button>
                  <span v-else class="text-[7px] md:text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
                    <Lock class="w-2.5 h-2.5" /> 完成上一阶段解锁
                  </span>
                </div>
              </div>
            </div>

            <!-- Goal Node -->
            <div class="relative pl-9 md:pl-20 pt-5 md:pt-10">
              <div
                class="absolute left-0 top-5 md:top-10 w-7 h-7 md:w-14 md:h-14 rounded-lg md:rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md md:shadow-xl shadow-amber-500/30 z-10 border-[1.5px] md:border-4 border-white dark:border-slate-950"
                :class="{
                  'scale-110 animate-bounce': calculateRoadmapProgress(selectedRoadmap) === 100,
                }"
              >
                <Trophy class="w-3 h-3 md:w-6 md:h-6" />
              </div>
              <div
                class="p-2.5 md:p-6 rounded-lg md:rounded-2xl border transition-all duration-300"
                :class="
                  calculateRoadmapProgress(selectedRoadmap) === 100
                    ? 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-500/20 shadow-md md:shadow-lg shadow-amber-500/5'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                "
              >
                <h3
                  class="text-[14px] md:text-lg font-black mb-1 md:mb-2"
                  :class="
                    calculateRoadmapProgress(selectedRoadmap) === 100
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-800 dark:text-slate-100'
                  "
                >
                  {{
                    calculateRoadmapProgress(selectedRoadmap) === 100
                      ? '🎉 恭喜！路线已完成'
                      : '终点：' + selectedRoadmap.title + '认证'
                  }}
                </h3>
                <p class="text-[11px] md:text-sm" style="color: var(--text-secondary)">
                  {{
                    calculateRoadmapProgress(selectedRoadmap) === 100
                      ? '你已经完成了该路径的所有阶段，获得了专属勋章和平台实战推荐资格！'
                      : '完成该路径的所有阶段，即可解锁专属勋章并获得平台实战推荐。'
                  }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State - No Roadmaps -->
        <div
          v-else-if="!isLoading && roadmaps.length === 0"
          class="h-full flex flex-col items-center justify-center"
        >
          <div
            class="w-20 h-20 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6"
          >
            <Map class="w-10 h-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 class="text-lg font-bold mb-2" style="color: var(--text-primary)">暂无学习路径</h3>
          <p class="text-sm text-slate-400 max-w-xs text-center">
            管理员还未创建任何学习路径，请稍后再来查看。
          </p>
        </div>

        <!-- Empty State - No Selection -->
        <div v-else-if="!isLoading" class="h-full flex flex-col items-center justify-center">
          <div
            class="w-20 h-20 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6"
          >
            <Map class="w-10 h-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 class="text-lg font-bold mb-2" style="color: var(--text-primary)">
            选择一个学习路径
          </h3>
          <p class="text-sm text-slate-400">从左侧选择一条路线，开始你的学习旅程</p>
        </div>
      </div>
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
