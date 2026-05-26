<script setup lang="ts">
import { useRouter } from 'vue-router';
import {
  Gauge,
  TrendingUp,
  Clock,
  ListTodo,
  CheckCircle2,
  GraduationCap,
  BookOpen,
  ArrowRight,
} from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';

interface RoadmapStep {
  id: string;
  title: string;
  description?: string | null;
  subtasks?: string | string[] | null;
}

interface Roadmap {
  steps: RoadmapStep[];
}

interface RoadmapProgress {
  roadmapStepId: string;
  completed: boolean;
}

interface Course {
  id: string;
  title: string;
  description?: string | null;
  thumbnail?: string | null;
  difficulty?: string | null;
}

const props = defineProps<{
  selectedRoadmap: Roadmap;
  activeStep: RoadmapStep;
  myProgress: RoadmapProgress[];
  allCourses: Course[];
  checkedSubTasks: Record<string, boolean>;
}>();

const emit = defineEmits<{
  (e: 'toggle-step', stepId: string): void;
  (e: 'toggle-subtask', taskId: string): void;
}>();

const router = useRouter();

const isStepCompleted = (stepId: string) => {
  return props.myProgress.some((p) => p.roadmapStepId === stepId && p.completed);
};

const getRelatedCourses = (step: RoadmapStep | null) => {
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

const getSubTasksForStep = (step: RoadmapStep | null) => {
  if (!step) return [];

  if (step.subtasks) {
    try {
      const parsed = typeof step.subtasks === 'string' ? JSON.parse(step.subtasks) : step.subtasks;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, index: number) => {
          if (item && typeof item === 'object') {
            return {
              id: item.id || `${step.id}_custom_s${index}`,
              text: item.text || '',
            };
          }
          return {
            id: `${step.id}_custom_s${index}`,
            text: String(item),
          };
        });
      }
    } catch (e) {
      console.error('Failed to parse step subtasks:', e);
    }
  }
  return [];
};

const getMetricsForStep = (step: RoadmapStep | null, index: number) => {
  if (!step) return { difficulty: 50, practical: 50, duration: 20 };
  const title = step.title.toLowerCase();

  // 1. 基础系数（阶段顺序决定基础线，越往后难度和深度越高）
  let difficulty = 35 + index * 12;
  let practical = 55 + index * 5;
  let duration = 6 + index * 6;

  // 2. 专业领域关键字权重动态修正
  // 渲染/图形学/Shader 等高难硬核技能
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
  }
  // Blender/3D建模/材质烘焙等极高工程实操技能
  else if (
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
  }
  // Three.js/动画/交互脚本等逻辑性技能
  else if (
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

  // 入门/基础概念修饰词降低门槛和时长
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
  // 进阶/高级/精通修饰词提升难度和时长
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

  // 3. 关联的子任务清单（Checklist）的影响：任务越多，所需实战和周期成比例拉长
  const subTasks = getSubTasksForStep(step);
  duration += subTasks.length * 1.5;
  practical += subTasks.length * 3;

  // 4. 平台匹配课程的影响：如果系统成功智能匹配出推荐课程，将基于推荐课程的数据提升掌握度时长
  const relatedCourses = getRelatedCourses(step);
  if (relatedCourses.length > 0) {
    practical = Math.min(practical + relatedCourses.length * 8, 98);
    duration = Math.min(duration + relatedCourses.length * 6, 120);

    // 如果匹配到的课程中有“高级/ADVANCED”课程，大幅提高本阶段难度
    const hasAdvanced = relatedCourses.some((c) => c.difficulty === 'ADVANCED');
    if (hasAdvanced) {
      difficulty = Math.min(difficulty + 15, 98);
    }
  }

  // 5. 边界限制处理，确保百分比美观且合乎逻辑
  return {
    difficulty: Math.min(Math.max(Math.round(difficulty), 15), 98),
    practical: Math.min(Math.max(Math.round(practical), 20), 98),
    duration: Math.min(Math.max(Math.round(duration), 2), 160),
  };
};
</script>

<template>
  <div class="col-span-12 md:col-span-5 lg:col-span-4 sticky top-2 sm:top-6 space-y-4">
    <!-- Smart Companion box -->
    <div
      class="p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md space-y-3 sm:space-y-5 shadow-xl relative overflow-hidden text-left"
    >
      <div
        class="absolute -right-12 -top-12 w-24 h-24 bg-accent/5 rounded-full blur-2xl"
      ></div>

      <div
        class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 sm:pb-3 relative z-10"
      >
        <div class="flex items-center gap-1.5 sm:gap-2">
          <div
            class="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-accent text-white flex items-center justify-center shrink-0"
          >
            <Gauge class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
          </div>
          <div class="space-y-0.5">
            <h4
              class="text-[8px] sm:text-xs font-black text-slate-400 uppercase tracking-widest"
            >
              智能探索分析仪
            </h4>
            <p
              class="text-[10px] sm:text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              阶段聚焦
            </p>
          </div>
        </div>

        <span
          class="text-[8px] sm:text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full shrink-0"
        >
          模块 {{ selectedRoadmap.steps.indexOf(activeStep) + 1 }}
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
          class="text-[9px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-white/[0.01] p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-800"
        >
          {{
            activeStep.description ||
            '当前阶段为您的自定义攻坚节点。配合下方的技能突破清单，探索该领域并攻克技术难题。'
          }}
        </p>
      </div>

      <!-- Toggle Completion Action -->
      <div class="pt-1 sm:pt-2 relative z-10">
        <button
type="button" class="w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-black text-white transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-md" :class="
            isStepCompleted(activeStep.id)
              ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10'
              : 'bg-accent hover:bg-accent-dark shadow-accent/10'
          " @click="emit('toggle-step', activeStep.id)">
          <CheckCircle2 class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {{ isStepCompleted(activeStep.id) ? '已攻克阶段（重置）' : '攻克阶段大纲目标' }}
        </button>
      </div>

      <!-- Skill metrics quantizer -->
      <div
        class="space-y-2.5 sm:space-y-3 pt-2 sm:pt-3 border-t border-slate-100 dark:border-slate-800/80 relative z-10"
      >
        <div
          class="flex items-center gap-1 text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1"
        >
          <TrendingUp class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" />
          技能属性评估
        </div>

        <div class="space-y-1.5 sm:space-y-2">
          <div>
            <div
              class="flex items-center justify-between text-[8px] sm:text-[10px] text-slate-500 mb-0.5"
            >
              <span>技能挑战难度</span>
              <span class="font-bold text-slate-700 dark:text-slate-300">
                {{
                  getMetricsForStep(activeStep, selectedRoadmap.steps.indexOf(activeStep))
                    .difficulty
                }}%
              </span>
            </div>
            <div
              class="h-1 sm:h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden"
            >
              <div
                class="h-full bg-rose-500 rounded-full transition-all duration-500"
                :style="{
                  width:
                    getMetricsForStep(
                      activeStep,
                      selectedRoadmap.steps.indexOf(activeStep),
                    ).difficulty + '%',
                }"
              ></div>
            </div>
          </div>

          <div>
            <div
              class="flex items-center justify-between text-[8px] sm:text-[10px] text-slate-500 mb-0.5"
            >
              <span>工程实战权重</span>
              <span class="font-bold text-slate-700 dark:text-slate-300">
                {{
                  getMetricsForStep(activeStep, selectedRoadmap.steps.indexOf(activeStep))
                    .practical
                }}%
              </span>
            </div>
            <div
              class="h-1 sm:h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden"
            >
              <div
                class="h-full bg-purple-500 rounded-full transition-all duration-500"
                :style="{
                  width:
                    getMetricsForStep(
                      activeStep,
                      selectedRoadmap.steps.indexOf(activeStep),
                    ).practical + '%',
                }"
              ></div>
            </div>
          </div>

          <div
            class="flex items-center justify-between text-[10px] sm:text-xs pt-0.5 sm:pt-1"
          >
            <span class="text-slate-500 flex items-center gap-1">
              <Clock class="w-3 sm:w-3.5 h-3 sm:h-3.5 text-slate-400" />
              预估研读周期
            </span>
            <span class="font-black text-slate-700 dark:text-slate-200">
              {{
                getMetricsForStep(activeStep, selectedRoadmap.steps.indexOf(activeStep))
                  .duration
              }}
              <span class="text-[8px] sm:text-[10px] font-normal text-slate-400"
                >小时</span
              >
            </span>
          </div>
        </div>
      </div>

      <!-- Sub-skills interactive checklist -->
      <div
        v-if="getSubTasksForStep(activeStep).length > 0"
        class="space-y-1.5 sm:space-y-2.5 pt-2 sm:pt-4 border-t border-slate-100 dark:border-slate-800/80 relative z-10"
      >
        <div
          class="flex items-center gap-1 text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest"
        >
          <ListTodo class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" />
          技能突围细分任务
        </div>

        <div
          class="space-y-1.5 sm:space-y-2 bg-slate-50 dark:bg-slate-900/60 p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-800/50"
        >
          <div
            v-for="task in getSubTasksForStep(activeStep)"
            :key="task.id"
            class="flex items-start gap-1.5 sm:gap-2.5 group/item cursor-pointer text-left"
            @click="emit('toggle-subtask', task.id)"
          >
            <div
              class="w-3 h-3 sm:w-4 sm:h-4 rounded border flex items-center justify-center shrink-0 transition-colors mt-0.5"
              :class="
                checkedSubTasks[task.id]
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/10'
                  : 'border-slate-300 dark:border-slate-600 group-hover/item:border-accent bg-white dark:bg-slate-800'
              "
            >
              <CheckCircle2
                v-if="checkedSubTasks[task.id]"
                class="w-2.5 h-2.5 sm:w-3 sm:h-3"
              />
            </div>

            <span
              class="text-[9px] sm:text-[11px] leading-tight sm:leading-relaxed transition-all duration-305"
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
        v-if="getRelatedCourses(activeStep).length > 0"
        class="space-y-1.5 sm:space-y-2.5 pt-2 sm:pt-4 border-t border-slate-100 dark:border-slate-800/80 relative z-10"
      >
        <div
          class="flex items-center gap-1 text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest"
        >
          <GraduationCap class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" />
          智能推荐关联课程
        </div>

        <div class="space-y-1.5 sm:space-y-2.5">
          <div
            v-for="course in getRelatedCourses(activeStep)"
            :key="course.id"
            class="flex gap-2 sm:gap-3 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-550/[0.01] hover:border-accent/40 dark:hover:border-accent/40 hover:bg-white dark:hover:bg-slate-900/50 transition-all cursor-pointer group/card text-left"
            @click="router.push({ name: 'CourseDetail', params: { id: course.id } })"
          >
            <div
              class="w-14 sm:w-20 h-9 sm:h-12 rounded bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/50 dark:border-slate-700/55 overflow-hidden"
            >
              <img v-if="course.thumbnail" alt="" :src="getAssetUrl(course.thumbnail)" class="w-full h-full object-cover group-hover/card:scale-105 transition-transform" />
              <BookOpen v-else class="w-3 h-3 text-slate-450 mx-auto my-3" />
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
                      ? '入门'
                      : course.difficulty === 'INTERMEDIATE'
                        ? '进阶'
                        : '高级'
                  }}
                </span>
                <span
                  class="text-accent flex items-center gap-0.5 font-bold group-hover/card:translate-x-0.5 transition-transform text-[7px] sm:text-[9px]"
                >
                  去掌握 <ArrowRight class="w-2 h-2" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
