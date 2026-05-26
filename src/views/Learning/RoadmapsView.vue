<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Map,
  CheckCircle2,
  // Trophy,
  ArrowRight,
  Sparkles,
  BookOpen,
  Target,
  Flame,
  Zap,
  CircleCheck,
  Lock,
  Plus,
  Trash2,
  Edit3,
  ChevronUp,
  ChevronDown,
  Download,
  // Award,
  X,
  Compass,
  User,
  GraduationCap,
  ListTodo,
  TrendingUp,
  Gauge,
  Clock,
  Sparkle,
  Loader2,
  FolderOpen,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import PageHeader from '@/components/PageHeader.vue';
import RoadmapCard from '@/components/RoadmapCard.vue';
import { getApiErrorMessage } from '@/utils/error';

const router = useRouter();

interface RoadmapStep {
  id: string;
  title: string;
  description?: string | null;
  subtasks?: string | string[] | null;
}

interface Roadmap {
  id: string;
  title: string;
  description?: string | null;
  creatorId?: string | null;
  projectId?: string | null;
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

interface StepTask {
  id: string;
  text: string;
}

interface FormStep {
  id?: string;
  title: string;
  description: string;
  subtasks: string[];
}

const roadmaps = ref<Roadmap[]>([]);
const myProgress = ref<RoadmapProgress[]>([]);
const allCourses = ref<Course[]>([]);
const isLoading = ref(false);
const selectedRoadmap = ref<Roadmap | null>(null);
const activeStepId = ref<string | null>(null);

// Tab management
const activeTab = ref<'system' | 'custom'>('system');

// Modal CRUD state
const showFormDialog = ref(false);
const isEditing = ref(false);
const formLoading = ref(false);
const customRoadmapForm = ref({
  id: '',
  title: '',
  description: '',
  steps: [] as FormStep[],
});

// Checklist persistent state
const checkedSubTasks = ref<Record<string, boolean>>({});

const loadCheckedSubTasks = () => {
  try {
    const saved = localStorage.getItem('learning_path_subtasks');
    if (saved) {
      checkedSubTasks.value = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load subtask progress:', e);
  }
};

const toggleSubTask = (taskId: string) => {
  checkedSubTasks.value[taskId] = !checkedSubTasks.value[taskId];
  try {
    localStorage.setItem('learning_path_subtasks', JSON.stringify(checkedSubTasks.value));
  } catch (e) {
    console.error('Failed to save subtask progress:', e);
  }
};

const fetchData = async () => {
  isLoading.value = true;
  try {
    const [roadRes, progRes, courseRes] = await Promise.all([
      api.get('/api/roadmaps'),
      api.get('/api/roadmaps/my-progress'),
      api.get('/api/courses'),
    ]);
    roadmaps.value = roadRes.data.data || [];
    myProgress.value = progRes.data;
    allCourses.value = courseRes.data;

    autoSelectFirstRoadmap();
  } catch (_error) {
    ElMessage.error('加载学习路径数据失败');
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
  if (activeTab.value === 'system') {
    return roadmaps.value.filter((r) => r.creatorId === null && !r.projectId);
  } else {
    return roadmaps.value.filter((r) => r.creatorId !== null || !!r.projectId);
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
    ElMessage.success(!isCompleted ? '恭喜完成该阶段！' : '已重置阶段进度');
  } catch (_error) {
    ElMessage.error('更新进度失败');
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

const isStepLocked = (_step: RoadmapStep, index: number | string) => {
  const idx = Number(index);
  if (idx === 0) return false;
  if (!selectedRoadmap.value) return false;
  const prevStep = selectedRoadmap.value.steps[idx - 1];
  return prevStep && !isStepCompleted(prevStep.id);
};

const getStepStatus = (step: RoadmapStep, index: number | string) => {
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

// Next Up core task targeting (commented out as unused)
/*
const nextUpTask = computed(() => {
  if (!selectedRoadmap.value || !selectedRoadmap.value.steps || selectedRoadmap.value.steps.length === 0) return null;
  const steps = selectedRoadmap.value.steps;
  for (let i = 0; i < steps.length; i++) {
    if (!isStepCompleted(steps[i].id)) {
      return {
        step: steps[i],
        index: i
      };
    }
  }
  return null;
});
*/

// Intelligent keyword matching course recommendations
const getRelatedCourses = (step: RoadmapStep) => {
  if (!step || !allCourses.value || allCourses.value.length === 0) return [];
  const title = step.title.toLowerCase();
  const desc = (step.description || '').toLowerCase();

  return allCourses.value
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

// Upgraded custom step sub-tasks resolver
const getSubTasksForStep = (step: RoadmapStep): StepTask[] => {
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

// Upgraded intelligent & course-aware skill metrics generator
const getMetricsForStep = (step: RoadmapStep, index: number) => {
  if (!step) return { difficulty: 50, practical: 50, duration: 20 };
  const title = step.title.toLowerCase();
  // const desc = (step.description || '').toLowerCase(); // removed as unused

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

// Custom Roadmap CRUD methods
const openCreateDialog = () => {
  isEditing.value = false;
  customRoadmapForm.value = {
    id: '',
    title: '',
    description: '',
    steps: [{ title: '阶段 1: 起步入门', description: '', subtasks: [] }],
  };
  showFormDialog.value = true;
};

const openEditDialog = () => {
  if (!selectedRoadmap.value) return;
  isEditing.value = true;
  customRoadmapForm.value = {
    id: selectedRoadmap.value.id,
    title: selectedRoadmap.value.title,
    description: selectedRoadmap.value.description || '',
    steps: (selectedRoadmap.value.steps || []).map((s) => {
      let subtasksArr: unknown = [];
      if (s.subtasks) {
        try {
          subtasksArr = typeof s.subtasks === 'string' ? JSON.parse(s.subtasks) : s.subtasks;
        } catch (e) {
          console.error('Parse step subtasks error:', e);
        }
      }
      return {
        id: s.id,
        title: s.title,
        description: s.description || '',
        subtasks: Array.isArray(subtasksArr) ? subtasksArr : [],
      };
    }),
  };
  showFormDialog.value = true;
};

const addFormStep = () => {
  customRoadmapForm.value.steps.push({
    title: `阶段 ${customRoadmapForm.value.steps.length + 1}: `,
    description: '',
    subtasks: [],
  });
};

const removeFormStep = (index: number) => {
  if (customRoadmapForm.value.steps.length <= 1) {
    return ElMessage.warning('学习路线至少需要包含一个阶段');
  }
  customRoadmapForm.value.steps.splice(index, 1);
};

const moveFormStep = (index: number, direction: 'up' | 'down') => {
  const steps = customRoadmapForm.value.steps;
  if (direction === 'up' && index > 0) {
    const temp = steps[index];
    steps[index] = steps[index - 1];
    steps[index - 1] = temp;
  } else if (direction === 'down' && index < steps.length - 1) {
    const temp = steps[index];
    steps[index] = steps[index + 1];
    steps[index + 1] = temp;
  }
};

const submitCustomRoadmap = async () => {
  if (!customRoadmapForm.value.title.trim()) {
    return ElMessage.warning('请输入学习路线名称');
  }
  const invalidStep = customRoadmapForm.value.steps.some((s) => !s.title.trim());
  if (invalidStep) {
    return ElMessage.warning('所有阶段的标题均不能为空');
  }

  // Format steps: filter empty subtasks for each step
  const formattedSteps = customRoadmapForm.value.steps.map((step) => ({
    id: step.id,
    title: step.title,
    description: step.description,
    subtasks: step.subtasks ? step.subtasks.map((t) => t.trim()).filter(Boolean) : [],
  }));

  const payload = {
    id: customRoadmapForm.value.id,
    title: customRoadmapForm.value.title,
    description: customRoadmapForm.value.description,
    steps: formattedSteps,
  };

  formLoading.value = true;
  try {
    if (isEditing.value) {
      const res = await api.put(`/api/roadmaps/${customRoadmapForm.value.id}`, payload);
      ElMessage.success('路线更新成功');
      const idx = roadmaps.value.findIndex((r) => r.id === res.data.id);
      if (idx > -1) roadmaps.value[idx] = res.data;
      selectedRoadmap.value = res.data;
    } else {
      const res = await api.post('/api/roadmaps', payload);
      ElMessage.success('自定义学习路线创建成功');
      roadmaps.value.unshift(res.data);
      selectedRoadmap.value = res.data;
    }
    showFormDialog.value = false;
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '保存路线方案失败'));
  } finally {
    formLoading.value = false;
  }
};

const deleteCustomRoadmap = async () => {
  const roadmap = selectedRoadmap.value;
  if (!roadmap) return;
  try {
    await ElMessageBox.confirm(
      `确定要彻底删除您的自定义学习路线「${roadmap.title}」吗？此操作不可撤销！`,
      '警告',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'dark:bg-slate-800 dark:border-slate-700',
      },
    );

    await api.delete(`/api/roadmaps/${roadmap.id}`);
    ElMessage.success('路线删除成功');
    const idx = roadmaps.value.findIndex((r) => r.id === roadmap.id);
    if (idx > -1) roadmaps.value.splice(idx, 1);
    autoSelectFirstRoadmap();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除学习路线失败');
    }
  }
};

const exportToMarkdown = () => {
  if (!selectedRoadmap.value) return;
  const rm = selectedRoadmap.value;
  let md = `# 学习路线大纲: ${rm.title}\n\n`;
  if (rm.description) md += `> ${rm.description}\n\n`;
  md += `--- \n\n## 学习大纲阶段拆解 (${rm.steps?.length || 0} 个阶段)\n\n`;

  (rm.steps || []).forEach((s, idx) => {
    const isDone = isStepCompleted(s.id) ? ' [已完成]' : '';
    md += `### 阶段 ${idx + 1}: ${s.title}${isDone}\n`;
    if (s.description) md += `${s.description}\n\n`;

    // Add checklist items to MD if not empty
    const subTasks = getSubTasksForStep(s);
    if (subTasks.length > 0) {
      md += `*技能点精通清单：*\n`;
      subTasks.forEach((st) => {
        const checked = checkedSubTasks.value[st.id] ? '[x]' : '[ ]';
        md += `- ${checked} ${st.text}\n`;
      });
      md += `\n`;
    }

    const matched = getRelatedCourses(s);
    if (matched.length > 0) {
      md += `*建议搭配学习平台课程：*\n`;
      matched.forEach((c) => {
        md += `- **${c.title}** (难度: ${c.difficulty})\n`;
      });
      md += `\n`;
    }
  });

  md += `\n*导出时间: ${new Date().toLocaleString()} | 3D 个人探索式学习空间*`;

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${rm.title}_学习路线.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  ElMessage.success('大纲已成功导出为 Markdown 文件！');
};

const handleTabChange = (tab: 'system' | 'custom') => {
  activeTab.value = tab;
  autoSelectFirstRoadmap();
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
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Header -->
    <PageHeader
      title="学习路径"
      subtitle="以极致科学的 3D 节点图谱指引成长，亦可自由编排专属学习战役"
      :icon="Map"
    >
      <div v-if="!isLoading" class="flex items-center gap-2 sm:gap-3">
        <!-- Dashboard widgets -->
        <div
          class="hidden lg:flex items-center gap-4 bg-slate-500/5 dark:bg-white/5 border border-slate-200/50 dark:border-slate-800 rounded-xl p-1.5 px-3"
        >
          <div class="flex items-center gap-1.5">
            <Compass class="w-4 h-4 text-emerald-500" />
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400"
              >系统官方: {{ overallStats.systemCount }}</span
            >
          </div>
          <div class="w-px h-3 bg-slate-300 dark:bg-slate-700"></div>
          <div class="flex items-center gap-1.5">
            <User class="w-4 h-4 text-accent" />
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400"
              >我的路线: {{ overallStats.customCount }}</span
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
              <span class="text-slate-400 font-normal">阶段</span></span
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
        <div class="flex items-center gap-1.5">
          <div
            class="flex-1 flex p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-900/80 rounded-lg sm:rounded-xl"
          >
            <button
type="button"
              class="flex-1 flex items-center justify-center gap-1 py-1 sm:py-2 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-all cursor-pointer"
              :class="
                activeTab === 'system'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              "
              @click="handleTabChange('system')"
            >
              <Compass class="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span class="truncate">官方推荐</span>
            </button>
            <button
type="button"
              class="flex-1 flex items-center justify-center gap-1 py-1 sm:py-2 text-[10px] sm:text-xs font-bold rounded-md sm:rounded-lg transition-all cursor-pointer"
              :class="
                activeTab === 'custom'
                  ? 'bg-white dark:bg-slate-800 text-accent shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              "
              @click="handleTabChange('custom')"
            >
              <User class="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span class="truncate">我的学习计划</span>
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
              @click="selectedRoadmap = roadmap"
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

      <!-- Roadmap Detail Timeline & Analytical Sidebar (Double Column Split Layout) -->
      <div class="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 scrollbar-hide">
        <div
          v-if="selectedRoadmap"
          :key="selectedRoadmap.id"
          class="w-full max-w-none space-y-4 sm:space-y-6"
        >
          <!-- Header card (premium extremely compact layout) -->
          <div
            class="p-2.5 sm:p-4 rounded-xl border border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md relative overflow-hidden"
          >
            <div
              class="absolute -right-10 -top-10 w-36 h-36 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl"
            ></div>
            <div
              class="absolute -left-10 -bottom-10 w-36 h-36 bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl"
            ></div>

            <div class="space-y-2 relative z-10">
              <!-- Row 1: Title & Badges on the left, Actions on the right -->
              <div
                class="flex items-center justify-between gap-3 border-b border-slate-100/50 dark:border-slate-800 pb-1.5 sm:pb-2"
              >
                <div class="flex items-center gap-1.5 min-w-0">
                  <h2
                    class="text-xs sm:text-base md:text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none truncate"
                  >
                    {{ selectedRoadmap.title }}
                  </h2>
                  <span
                    v-if="selectedRoadmap.projectId"
                    class="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-550/10 text-amber-600 dark:text-amber-400 text-[8px] sm:text-[10px] font-black rounded-full shrink-0"
                  >
                    <FolderOpen class="w-2.5 h-2.5" /> 项目路线
                  </span>
                  <span
                    v-else-if="selectedRoadmap.creatorId === null"
                    class="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] sm:text-[10px] font-black rounded-full shrink-0"
                  >
                    <Sparkles class="w-2 h-2" /> 官方推荐
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-accent/10 text-accent text-[8px] sm:text-[10px] font-black rounded-full shrink-0"
                  >
                    <User class="w-2 h-2" /> 我的计划
                  </span>
                </div>

                <!-- Actions inline next to Title! -->
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    v-if="selectedRoadmap.projectId"
                    type="button"
                    class="p-1 px-1.5 sm:px-2.5 rounded bg-accent hover:opacity-90 text-[8px] sm:text-[11px] font-black text-white transition-all flex items-center gap-1 cursor-pointer shadow-md shadow-accent/10 border-none animate-in fade-in"
                    @click="router.push({ name: 'ProjectDetail', params: { id: selectedRoadmap.projectId } })"
                  >
                    <FolderOpen class="w-2.5 h-2.5" />
                    <span>进入关联项目</span>
                  </button>
                  <button
                    type="button"
                    class="p-1 px-1.5 sm:px-2 rounded bg-slate-500/5 border border-slate-200/50 dark:border-slate-800 text-[8px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center gap-0.5 cursor-pointer shadow-sm"
                    @click="exportToMarkdown"
                  >
                    <Download class="w-2.5 h-2.5" />
                    <span>导出</span>
                  </button>
                  <template v-if="selectedRoadmap.creatorId !== null">
                    <button
type="button"
                      class="p-1 px-1.5 sm:px-2 rounded bg-slate-500/10 hover:bg-slate-500/20 text-[8px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-300 transition-all flex items-center gap-0.5 cursor-pointer"
                      @click="openEditDialog"
                    >
                      <Edit3 class="w-2.5 h-2.5" />
                      <span>修改</span>
                    </button>
                    <button
type="button"
                      class="p-1 px-1.5 sm:px-2 rounded bg-red-500/10 hover:bg-red-500/20 text-[8px] sm:text-[11px] font-bold text-red-600 dark:text-red-400 transition-all flex items-center gap-0.5 cursor-pointer"
                      @click="deleteCustomRoadmap"
                    >
                      <Trash2 class="w-2.5 h-2.5" />
                      <span>删除</span>
                    </button>
                  </template>
                </div>
              </div>

              <!-- Row 2: Description, Metadata & Progress Bar (Always single row!) -->
              <div
                class="flex flex-row items-center justify-between gap-3 text-[9px] sm:text-[11px] text-slate-400 dark:text-slate-500"
              >
                <div class="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                  <p class="text-[9px] sm:text-xs text-slate-500 leading-relaxed truncate max-w-xl">
                    {{ selectedRoadmap.description || '从入门到进阶的完整学习大纲。' }}
                  </p>

                  <!-- Combined metadata -->
                  <div class="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-0.5">
                    <span class="hidden xs:flex items-center gap-0.5 font-medium">
                      <User class="w-3 h-3 text-slate-400/80 dark:text-slate-500/80" />
                      由{{ selectedRoadmap.creatorId === null ? '系统' : '自己' }}创建
                    </span>

                    <div class="hidden xs:block w-px h-2 bg-slate-200 dark:bg-slate-800"></div>

                    <div
                      class="flex items-center gap-0.5 shrink-0 font-bold text-slate-600 dark:text-slate-400"
                    >
                      <Target class="w-3 h-3 text-accent/80" />
                      {{ selectedRoadmap.steps?.length || 0 }}
                      <span class="font-normal text-slate-400">阶段</span>
                    </div>

                    <div class="w-px h-2 bg-slate-200 dark:bg-slate-800"></div>

                    <div
                      class="flex items-center gap-0.5 shrink-0 font-bold text-slate-600 dark:text-slate-400"
                    >
                      <CircleCheck class="w-3 h-3 text-emerald-500/80" />
                      {{
                        selectedRoadmap.steps?.filter((s: RoadmapStep) => isStepCompleted(s.id)).length || 0
                      }}
                      <span class="font-normal text-slate-400">已解锁</span>
                    </div>
                  </div>
                </div>

                <!-- Progress Bar ALWAYS aligned on the right side of Row 2 -->
                <div class="w-20 sm:w-44 flex items-center gap-1 sm:gap-1.5 shrink-0 self-center">
                  <div class="flex-1 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-gradient-to-r from-accent to-emerald-500 rounded-full transition-all duration-700"
                      :style="{ width: calculateRoadmapProgress(selectedRoadmap) + '%' }"
                    ></div>
                  </div>
                  <span
                    class="text-[9px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0"
                  >
                    {{ calculateRoadmapProgress(selectedRoadmap) }}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Professional 2-Column Split Layout (Adapted to preserve side-by-side view on both mobile & desktop) -->
          <div class="grid grid-cols-12 gap-3 sm:gap-6 items-start">
            <!-- LEFT PANEL: Visual Flowchart / Connective Timeline -->
            <div class="col-span-5 md:col-span-7 lg:col-span-8 space-y-3 sm:space-y-4">
              <div class="relative pl-[23px] sm:pl-10 space-y-3 sm:space-y-5 py-1 sm:py-2">
                <!-- Connective glowing neon line -->
                <div
                  class="absolute left-[10px] sm:left-[19px] top-5 sm:top-6 bottom-5 sm:bottom-6 w-0.5 rounded-full bg-slate-200 dark:bg-slate-800"
                ></div>

                <div
                  v-for="(step, index) in selectedRoadmap.steps"
                  :key="step.id"
                  class="relative cursor-pointer transition-all duration-300"
                  @click="activeStepId = step.id"
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
                          class="hidden sm:block text-xs text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed"
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
                          class="w-3 sm:w-4 h-3 sm:h-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform shrink-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- RIGHT PANEL: Intelligent Analytics Companion (Sticky Panel) -->
            <div class="col-span-7 md:col-span-5 lg:col-span-4 sticky top-2 sm:top-6 space-y-4">
              <!-- Smart Companion box -->
              <div
                v-if="activeStep"
                class="p-2.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md space-y-3 sm:space-y-5 shadow-xl relative overflow-hidden"
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
type="button"
                    class="w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-black text-white transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer shadow-md"
                    :class="
                      isStepCompleted(activeStep.id)
                        ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10'
                        : 'bg-accent hover:bg-accent-dark shadow-accent/10'
                    "
                    @click="toggleStep(activeStep.id)"
                  >
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
                      @click="toggleSubTask(task.id)"
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
                      class="flex gap-2 sm:gap-3 p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-500/[0.01] hover:border-accent/40 dark:hover:border-accent/40 hover:bg-white dark:hover:bg-slate-900/50 transition-all cursor-pointer group/card"
                      @click="router.push({ name: 'CourseDetail', params: { id: course.id } })"
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
            暂无任何学习路径
          </h3>
          <p class="text-sm text-slate-400 max-w-xs leading-relaxed">
            平台还未添加系统推荐学习路径，您可以点击左侧“规划个性化学习路径”设计属于您自己的成长路线大纲。
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
            <Compass class="w-10 h-10 text-slate-300 dark:text-slate-600 animate-spin-slow" />
          </div>
          <h3 class="text-lg font-bold mb-2 text-slate-800 dark:text-slate-100">未选定攻坚路线</h3>
          <p class="text-sm text-slate-400">
            请从左侧选择一条推荐路径或您自己的自定义计划，开启 3D 技能探索。
          </p>
        </div>
      </div>
    </div>

    <!-- Create / Edit Custom Roadmap Form Dialog -->
    <Teleport to="body">
      <div
        v-if="showFormDialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        @click.self="showFormDialog = false"
      >
        <div
          class="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] border border-slate-100 dark:border-slate-700 overflow-hidden"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30"
          >
            <div class="flex items-center gap-2">
              <div class="p-1.5 rounded-lg bg-accent text-white">
                <Map class="w-4 h-4" />
              </div>
              <h3 class="text-base font-black text-slate-800 dark:text-slate-100">
                {{ isEditing ? '编辑我的学习路线' : '规划新学习路线' }}
              </h3>
            </div>
            <button
type="button"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              @click="showFormDialog = false"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Form Area -->
          <div class="flex-1 p-5 overflow-y-auto space-y-4">
            <div class="space-y-1.5">
              <label class="block text-xs font-black text-slate-500 uppercase tracking-wider"
                >路线名称</label
              >
              <input
                v-model="customRoadmapForm.title"
                type="text"
                placeholder="例如: Blender 物理动画攻坚计划"
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div class="space-y-1.5">
              <label class="block text-xs font-black text-slate-500 uppercase tracking-wider"
                >描述（目标）</label
              >
              <textarea
                v-model="customRoadmapForm.description"
                rows="2"
                placeholder="用简短的内容描述该学习路线的大致目标与期望..."
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
              ></textarea>
            </div>

            <!-- Steps timeline editing list -->
            <div class="space-y-3 pt-2">
              <div
                class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2"
              >
                <label class="block text-xs font-black text-slate-500 uppercase tracking-wider"
                  >学习大纲与阶段 ({{ customRoadmapForm.steps.length }})</label
                >
                <button
                  type="button"
                  class="text-[10px] font-bold text-accent hover:text-accent-dark flex items-center gap-1 cursor-pointer"
                  @click="addFormStep"
                >
                  <Plus class="w-3.5 h-3.5" />
                  新增学习阶段
                </button>
              </div>

              <div class="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
                <div
                  v-for="(step, idx) in customRoadmapForm.steps"
                  :key="idx"
                  class="p-3.5 rounded-xl border border-slate-100 dark:border-slate-700/60 bg-slate-500/[0.01] dark:bg-slate-900/30 space-y-2 relative group"
                >
                  <!-- Controls inside step row -->
                  <div class="flex items-center justify-between gap-2.5">
                    <span class="text-xs font-black text-accent shrink-0">阶段 {{ idx + 1 }}</span>

                    <div class="flex items-center gap-1.5">
                      <!-- Move up -->
                      <button
                        type="button"
                        class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                        :disabled="idx === 0"
                        @click="moveFormStep(idx, 'up')"
                      >
                        <ChevronUp class="w-3.5 h-3.5" />
                      </button>
                      <!-- Move down -->
                      <button
                        type="button"
                        class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                        :disabled="idx === customRoadmapForm.steps.length - 1"
                        @click="moveFormStep(idx, 'down')"
                      >
                        <ChevronDown class="w-3.5 h-3.5" />
                      </button>
                      <!-- Delete -->
                      <button
                        type="button"
                        class="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
                        @click="removeFormStep(idx)"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <!-- Step Inputs -->
                  <input
                    v-model="step.title"
                    type="text"
                    placeholder="阶段标题 (例如: 掌握物理动力学与重力场)"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <textarea
                    v-model="step.description"
                    rows="1"
                    placeholder="该阶段需要攻克的具体技能或任务说明（选填）"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                  ></textarea>

                  <!-- User Customizable Subtasks List Editor -->
                  <div class="mt-2 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-2">
                    <div class="flex items-center justify-between">
                      <label
                        class="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1"
                      >
                        <CheckCircle2 class="w-3 h-3 text-accent" />
                        <span>阶段细分任务清单（留空则在前台隐藏此模块）</span>
                      </label>
                      <button
                        type="button"
                        class="text-[10px] font-black text-accent hover:text-accent-dark flex items-center gap-0.5 cursor-pointer"
                        @click="step.subtasks.push('')"
                      >
                        <Plus class="w-3 h-3" />
                        <span>添加任务项</span>
                      </button>
                    </div>

                    <div class="space-y-1.5">
                      <div
                        v-for="(_, sIdx) in step.subtasks"
                        :key="sIdx"
                        class="flex items-center gap-2"
                      >
                        <div
                          class="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-650 flex items-center justify-center shrink-0 text-[9px] font-black text-slate-450"
                        >
                          {{ sIdx + 1 }}
                        </div>
                        <input
                          v-model="step.subtasks[sIdx]"
                          type="text"
                          placeholder="例如: 掌握多边形布线与拓扑原理"
                          class="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-750 text-xs outline-none focus:ring-1 focus:ring-accent text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          class="p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-500 transition-colors shrink-0 cursor-pointer"
                          @click="step.subtasks.splice(sIdx, 1)"
                        >
                          <X class="w-3 h-3" />
                        </button>
                      </div>

                      <div
                        v-if="!step.subtasks || step.subtasks.length === 0"
                        class="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100/50 dark:bg-white/1 py-2 px-3 rounded-xl border border-dashed border-slate-200/50 dark:border-white/5 text-center font-medium"
                      >
                        暂无自定义细分任务，留空则在前台页面直接隐藏细分任务模块
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div
            class="p-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-end gap-3"
          >
            <button
type="button"
              class="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer"
              @click="showFormDialog = false"
            >
              取消
            </button>
            <button
type="button"
              class="px-5 py-2 rounded-xl text-xs font-bold text-white bg-accent hover:bg-accent-dark transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-accent/20"
              :class="formLoading ? 'opacity-70 pointer-events-none' : ''"
              @click="submitCustomRoadmap"
            >
              <Zap v-if="!formLoading" class="w-3.5 h-3.5" />
              <Loader2 v-else class="w-3.5 h-3.5 animate-spin" />
              保存我的路线
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
.animate-spin-slow {
  animation: spin 8s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
