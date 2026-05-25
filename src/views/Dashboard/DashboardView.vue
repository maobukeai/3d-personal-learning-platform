<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Box,
  MessageSquare,
  TrendingUp,
  Calendar,
  X,
  LayoutDashboard,
  Sparkles,
  RefreshCw,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { socketService } from '@/utils/socket';
import StatCard from '@/components/StatCard.vue';
import ActiveLearningCard from './components/ActiveLearningCard.vue';
import RecentTasksCard from './components/RecentTasksCard.vue';
import RecentAssetsCard from './components/RecentAssetsCard.vue';
import TeamActivityCard from './components/TeamActivityCard.vue';
import CollaborationInviteCard from './components/CollaborationInviteCard.vue';
import type {
  DashboardActivity,
  DashboardAsset,
  DashboardEnrollment,
  DashboardTask,
} from './types';

const { t } = useI18n();
const authStore = useAuthStore();
const systemStore = useSystemStore();

const stats = ref([
  {
    label: t('dashboard.stats.learningProgress'),
    value: '0%',
    trend: '0%',
    color: 'text-accent',
    icon: TrendingUp,
  },
  {
    label: t('dashboard.stats.pendingTasks'),
    value: '0',
    trend: '0',
    color: 'text-amber-600',
    icon: Calendar,
  },
  {
    label: t('dashboard.stats.assets'),
    value: '0',
    trend: '0',
    color: 'text-emerald-600',
    icon: Box,
  },
  {
    label: t('dashboard.stats.feedback'),
    value: '0',
    trend: '0',
    color: 'text-purple-600',
    icon: MessageSquare,
  },
]);

// Re-initialize labels when language changes
watch(
  () => t('dashboard.stats.learningProgress'),
  () => {
    stats.value[0].label = t('dashboard.stats.learningProgress');
    stats.value[1].label = t('dashboard.stats.pendingTasks');
    stats.value[2].label = t('dashboard.stats.assets');
    stats.value[3].label = t('dashboard.stats.feedback');
  },
);

const activeEnrollment = ref<DashboardEnrollment | null>(null);
const activityLog = ref<DashboardActivity[]>([]);
const recentAssets = ref<DashboardAsset[]>([]);
const recentTasks = ref<DashboardTask[]>([]);
const selectedDate = ref(new Date());
const isAddDialogOpen = ref(false);
const importText = ref('');
const isHelpOpen = ref(false);
const isImporting = ref(false);

const aiPrompt = ref('');
const isAiGenerating = ref(false);

const handleAiGenerate = async () => {
  if (!aiPrompt.value.trim()) {
    ElMessage.warning('请输入您的项目目标或需求设想。');
    return;
  }
  isAiGenerating.value = true;
  try {
    const { data } = await api.post('/api/projects/ai-generate', { prompt: aiPrompt.value });
    if (data.success && data.data) {
      importText.value = data.data;
      ElMessage.success('AI 已成功为您生成标准结构文本，请核对后导入！');
    } else {
      ElMessage.error('AI 生成文本失败，请稍后重试。');
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || 'AI 生成失败';
    ElMessage.error(errorMsg);
  } finally {
    isAiGenerating.value = false;
  }
};

const disabledDate = (time: Date) => {
  if (!authStore.user?.createdAt) return time.getTime() > Date.now();
  const regDate = new Date(authStore.user.createdAt);
  regDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return time.getTime() < regDate.getTime() || time.getTime() > today.getTime();
};

const fetchDashboardData = async () => {
  try {
    const year = selectedDate.value.getFullYear();
    const month = String(selectedDate.value.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.value.getDate()).padStart(2, '0');
    const dateParam = `${year}-${month}-${day}`;

    const [statsRes, enrollmentsRes, activityRes, assetsRes, tasksRes] = await Promise.all([
      api.get('/api/auth/stats', { params: { date: dateParam } }),
      api.get('/api/courses/my-enrollments'),
      api.get('/api/auth/activity', { params: { date: dateParam } }),
      api.get('/api/assets/my'),
      api.get('/api/tasks', { params: { date: dateParam } }),
    ]);

    // Also fetch overall pending tasks if specifically needed for "Recent Tasks"
    const overallTasksRes = await api.get('/api/tasks');

    const data = statsRes.data;
    stats.value[0].value = data.learningProgress;
    stats.value[0].trend = data.trends?.learning || '0%';
    stats.value[1].value = data.taskCount.toString();
    stats.value[1].trend = data.trends?.tasks || '0';
    stats.value[2].value = data.assetCount.toString();
    stats.value[2].trend = data.trends?.assets || '0';
    stats.value[3].value = data.feedbackCount.toString();
    stats.value[3].trend = data.trends?.feedbacks || '0';

    if (enrollmentsRes.data.length > 0) {
      activeEnrollment.value = enrollmentsRes.data[0];
    } else {
      activeEnrollment.value = null;
    }

    activityLog.value = activityRes.data;
    recentAssets.value = (assetsRes.data || []).slice(0, 2);
    recentTasks.value = (tasksRes.data.length > 0 ? tasksRes.data : overallTasksRes.data).slice(
      0,
      3,
    );
  } catch (error) {
    console.error('Fetch dashboard data error:', error);
  }
};

watch(selectedDate, () => {
  fetchDashboardData();
});

const fillDemoData = () => {
  importText.value = `# 项目：智能机器人开发
描述：在这个项目中，我们将学习如何基于 ROS2 平台，从零开发一个具有自主导航与建图功能的移动避障机器人。
标签：机器人, ROS2, Python, C++
截止日期：2026-08-31
颜色：bg-emerald

## 任务看板
- [ ] 采购激光雷达与底盘硬件 | 优先级:高 | 截止:2026-06-15 | 描述:挑选高精度固态雷达与差速轮式底盘，准备调试。
- [ ] 配置 ROS2 机器人底层驱动 | 优先级:中 | 截止:2026-07-01 | 描述:编写串口通信驱动程序，实现与 STM32 底盘的双向数据传输。
- [ ] 实现 2D 激光 SLAM 建图 | 优先级:中 | 截止:2026-07-20 | 描述:使用 Cartographer 算法，控制机器人移动并构建室内高精度地图。
- [ ] 配置 Nav2 导航算法参数 | 优先级:高 | 截止:2026-08-10 | 描述:配置代价地图 (Costmap) 及路径规划器，实现自主避障。
- [ ] 系统联调与实物场景测试 | 优先级:紧急 | 截止:2026-08-31 | 描述:在真实办公室走廊场景进行多次多点导航导航联调。

## 学习路线
### 阶段一：Linux 与 ROS2 入门
描述：熟悉 Ubuntu 系统操作与 ROS2 核心通信机制（主题、服务、动作）。
- [ ] 学习 Linux 基础命令行与 C++/Python 编译环境配置
- [ ] 掌握 ROS2 Topic 发布与订阅编程
- [ ] 熟练使用 ROS2 Service 与 Action 接口通信

### 阶段二：机器人建模与仿真
描述：使用 URDF 建立机器人 3D 物理模型并在 Gazebo 中进行虚拟测试。
- [ ] 学习 URDF 机器人描述文件语法与 xacro 模块化编写
- [ ] 了解 TF2 坐标变换原理与激光雷达/驱动轴坐标关系
- [ ] 在 Gazebo 仿真环境中导入机器人模型并添加传感器插件

### 阶段三：SLAM 建图与自主导航
描述：进入核心算法领域，学习建图与高级路径规划。
- [ ] 学习 Gmapping/Cartographer 建图原理与里程计标定
- [ ] 熟练掌握 Nav2 导航框架核心参数配置方法
- [ ] 学习 AMCL 蒙特卡洛定位机制与路径规划优化`;
};

const copyTemplate = async () => {
  const template = `# 项目：[项目名称]
描述：[项目简介]
标签：[标签1, 标签2]
截止日期：[YYYY-MM-DD]
颜色：[bg-accent/bg-indigo/bg-emerald/bg-purple/bg-amber]

## 任务看板
- [ ] [任务一标题] | 优先级:[低/中/高/紧急] | 截止:[YYYY-MM-DD] | 描述:[描述内容]
- [ ] [任务二标题] | 优先级:[低/中/高/紧急] | 描述:[描述内容]

## 学习路线
### [阶段一标题]
描述：[阶段简介]
- [ ] 学习细分项 1
- [ ] 学习细分项 2`;
  try {
    await navigator.clipboard.writeText(template);
    ElMessage.success('标准格式模板已复制到剪贴板！');
  } catch (err) {
    ElMessage.error('复制失败，请手动选择复制。');
  }
};

const handleImportProject = async () => {
  if (!importText.value.trim()) {
    ElMessage.warning('请输入或粘贴格式化文本后再进行导入解析。');
    return;
  }
  isImporting.value = true;
  try {
    const response = await api.post('/api/projects/import', { text: importText.value });
    if (response.data && response.data.success) {
      ElMessage.success(response.data.message || '导入解析成功！');
      isAddDialogOpen.value = false;
      importText.value = '';
      fetchDashboardData();
    } else {
      ElMessage.error('导入解析失败，请检查文本格式。');
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || '导入解析失败';
    ElMessage.error(errorMsg);
  } finally {
    isImporting.value = false;
  }
};

onMounted(() => {
  fetchDashboardData();

  // Listen for real-time activity updates
  socketService.on('new_activity', (activity: DashboardActivity) => {
    // Check if activity matches current date filter
    const year = selectedDate.value.getFullYear();
    const month = String(selectedDate.value.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.value.getDate()).padStart(2, '0');
    const currentFilterStr = `${year}-${month}-${day}`;

    const activityDate = new Date(activity.createdAt);
    const actYear = activityDate.getFullYear();
    const actMonth = String(activityDate.getMonth() + 1).padStart(2, '0');
    const actDay = String(activityDate.getDate()).padStart(2, '0');
    const activityDateStr = `${actYear}-${actMonth}-${actDay}`;

    if (activityDateStr === currentFilterStr) {
      activityLog.value.unshift(activity);
      if (activityLog.value.length > 10) activityLog.value.pop();
    }
  });
});

</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Dashboard Header -->
    <div
      class="flex flex-col sm:flex-row gap-2 py-2.5 sm:py-0 sm:h-13 border-b px-3 sm:px-4 md:px-6 sm:items-center justify-between shrink-0 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-accent to-indigo-600 flex items-center justify-center shadow-lg shadow-accent/20"
        >
          <LayoutDashboard class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 text-white" />
        </div>
        <div>
          <h1
            class="text-md sm:text-lg font-black tracking-tight"
            style="color: var(--text-primary)"
          >
            {{ t('dashboard.title') }}
          </h1>
          <p
            class="hidden sm:block text-[9px] font-bold uppercase tracking-widest text-slate-400"
          >
            {{ t('dashboard.welcome') }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          class="!w-40 custom-date-picker"
          :placeholder="t('dashboard.selectDate')"
          :clearable="false"
          :disabled-date="disabledDate"
          popper-class="custom-date-popper"
        >
          <template #prefix>
            <Calendar class="w-4 h-4 text-slate-400" />
          </template>
        </el-date-picker>
        <button type="button" class="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-accent to-indigo-600 text-white rounded-xl shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all cursor-pointer font-bold text-xs animate-pulse" @click="isAddDialogOpen = true">
          <Sparkles class="w-4 h-4" />
          <span>导入解析</span>
        </button>
      </div>
    </div>

    <!-- Main Content Scroll Area -->
    <div class="flex-1 overflow-y-auto p-2 sm:p-3 lg:p-3.5 scrollbar-hide">
      <div class="max-w-7xl mx-auto space-y-3 md:space-y-3.5 min-w-0">
        <!-- Stats Grid -->
        <div class="grid grid-cols-4 gap-1.5 sm:gap-3 lg:gap-3.5">
          <StatCard
            v-for="stat in stats"
            :key="stat.label"
            :label="stat.label"
            :value="stat.value"
            :trend="stat.trend"
            :color="stat.color"
            :icon="stat.icon"
          />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-3.5">
          <!-- Left Column: Tasks & Assets -->
          <div class="lg:col-span-2 space-y-3 md:space-y-3.5">
            <!-- Active Learning Card -->
            <ActiveLearningCard :active-enrollment="activeEnrollment" />

            <!-- Recent Tasks -->
            <RecentTasksCard :recent-tasks="recentTasks" />

            <!-- Recent Assets -->
            <RecentAssetsCard :recent-assets="recentAssets" />
          </div>

          <!-- Right Column: Community & Feed -->
          <div class="space-y-3 md:space-y-3.5">
            <!-- Activity Feed -->
            <TeamActivityCard :activity-log="activityLog" />

            <!-- Collaboration Invite -->
            <CollaborationInviteCard />
          </div>
        </div>
      </div>
    </div>

    <!-- Smart Import Dialog -->
    <Transition name="fade">
      <div
        v-if="isAddDialogOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isAddDialogOpen = false"
        ></div>
        <div
          class="relative w-full p-6 sm:p-8 rounded-3xl shadow-2xl border space-y-5 sm:space-y-6 transition-all duration-500 ease-out overflow-hidden"
          :class="isHelpOpen ? 'max-w-7xl' : (systemStore.settings.AI_IMPORT_ENABLED ? 'max-w-3xl' : 'max-w-2xl')"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="p-1.5 bg-gradient-to-br from-accent to-indigo-600 rounded-lg text-white">
                <Sparkles class="w-4 h-4 animate-spin-slow" />
              </div>
              <h3 class="text-md sm:text-lg font-black tracking-tight" style="color: var(--text-primary)">
                项目导入与智能解析
              </h3>
            </div>
            <button type="button" class="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer" style="color: var(--text-secondary)" @click="isAddDialogOpen = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="grid grid-cols-1 gap-6 transition-all duration-500" :class="isHelpOpen ? 'md:grid-cols-2' : 'grid-cols-1'">
            <!-- Left Panel: Text Area input -->
            <div class="space-y-4 flex flex-col justify-between">
              <div>
                <!-- AI Smart Copilot Generator Section -->
                <div v-if="systemStore.settings.AI_IMPORT_ENABLED" class="mb-4 p-4 rounded-2xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01] space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <Sparkles class="w-3.5 h-3.5 text-indigo-500" />
                      AI 智能规划助手
                    </span>
                    <span class="text-[9px] text-slate-400">输入您的设想，AI 自动生成标准大纲</span>
                  </div>
                  <div class="relative">
                    <textarea
                      v-model="aiPrompt"
                      rows="3.5"
                      class="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none leading-relaxed"
                      placeholder="例如：我想要一个 3D 渲染课程学习平台，要求包括：1. 阶段一学习 WebGL 基础与着色器；2. 阶段二掌握 Three.js 核心组件与物理引擎；3. 阶段三优化渲染性能与项目上线。并分配看板任务。"
                    ></textarea>
                  </div>
                  <button
                    type="button"
                    :disabled="isAiGenerating"
                    class="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 hover:bg-indigo-700 hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    @click="handleAiGenerate"
                  >
                    <RefreshCw v-if="isAiGenerating" class="w-3.5 h-3.5 animate-spin" />
                    <Sparkles v-else class="w-3.5 h-3.5" />
                    <span>{{ isAiGenerating ? 'AI 正在全力为您生成结构大纲...' : 'AI 智能一键生成' }}</span>
                  </button>
                </div>

                <div class="flex items-center justify-between mb-2">
                  <label class="block text-[10px] font-bold uppercase ml-1 text-slate-400">
                    请在下方粘贴或核对项目结构文本
                  </label>
                  <button type="button" class="text-[10px] font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer" @click="isHelpOpen = !isHelpOpen">
                    <span>{{ isHelpOpen ? '收起格式说明' : '查看标准格式说明' }}</span>
                  </button>
                </div>
                <textarea
                  v-model="importText"
                  :rows="systemStore.settings.AI_IMPORT_ENABLED ? 14 : 20"
                  class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all font-mono leading-relaxed"
                  style="color: var(--text-primary)"
                  placeholder="# 项目：请输入项目名&#10;描述：请输入简介&#10;标签：标签1, 标签2&#10;截止日期：2026-06-30&#10;&#10;## 任务看板&#10;- [ ] 看板任务铺设 | 优先级:中&#10;&#10;## 学习路线&#10;### 阶段一：阶段名&#10;- [ ] 路线学习细分项"
                ></textarea>
              </div>

              <div class="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  class="w-full py-3 bg-gradient-to-r from-accent to-indigo-600 hover:scale-[1.01] text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                  :disabled="isImporting"
                  @click="handleImportProject"
                >
                  <Sparkles v-if="!isImporting" class="w-4 h-4" />
                  <span v-else class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>{{ isImporting ? '正在解析导入...' : '一键解析并创建项目' }}</span>
                </button>
                <div v-if="!isHelpOpen" class="text-center">
                  <button type="button" class="text-[10px] font-bold text-slate-400 hover:text-accent transition-colors cursor-pointer" @click="isHelpOpen = true">
                    如何规范编写以实现完美解析？
                  </button>
                </div>
              </div>
            </div>

            <!-- Right Panel: Gorgeous Detailed Help Document -->
            <Transition name="slide-fade">
              <div v-if="isHelpOpen" class="border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-6 border-slate-100 dark:border-white/5 space-y-4 max-h-[75vh] overflow-y-auto pr-2 scrollbar-thin flex flex-col justify-between">
                <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5 shrink-0">
                  <h4 class="text-xs font-bold flex items-center gap-1.5" style="color: var(--text-primary)">
                    <span>📋 智能解析排版标准说明</span>
                  </h4>
                  <div class="flex gap-2">
                    <button type="button" class="px-2 py-1 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[9px] font-bold rounded-lg transition-colors cursor-pointer text-slate-500 dark:text-slate-400" @click="fillDemoData">
                      填入示例数据
                    </button>
                    <button type="button" class="px-2 py-1 bg-accent/10 hover:bg-accent/20 text-[9px] font-bold rounded-lg transition-colors cursor-pointer text-accent" @click="copyTemplate">
                      复制标准模板
                    </button>
                  </div>
                </div>

                <div class="space-y-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                  <div class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 space-y-1">
                    <h5 class="font-bold text-slate-700 dark:text-slate-300">1. 项目基本信息 (一级标题)</h5>
                    <p>必须以 <code class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono font-bold text-accent"># 项目：项目名</code> 开头。下方属性名加冒号：</p>
                    <ul class="list-disc pl-4 space-y-0.5">
                      <li><strong>描述：</strong> 项目主旨，支持多行。</li>
                      <li><strong>标签：</strong> 分类标签（英文逗号隔开）。</li>
                      <li><strong>截止日期：</strong> 例如 <code class="font-mono text-emerald-500">2026-06-30</code>。</li>
                      <li><strong>颜色：</strong> 例如 <code class="font-mono text-indigo-500">bg-accent/bg-indigo/bg-emerald</code>。</li>
                    </ul>
                  </div>

                  <div class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 space-y-1">
                    <h5 class="font-bold text-slate-700 dark:text-slate-300">2. 看板工作任务 (二级标题)</h5>
                    <p>必须以 <code class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono font-bold text-accent">## 任务看板</code> 开头，列表项解析属性：</p>
                    <ul class="list-disc pl-4 space-y-0.5">
                      <li>格式：<code class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono">- [ ] 任务标题 | 优先级:高 | 描述:任务描述</code></li>
                      <li>属性间使用 <code class="font-bold text-accent">|</code> 分隔。包含：<code class="font-mono">优先级 (低/中/高/紧急)</code>，<code class="font-mono">截止 (YYYY-MM-DD)</code>，<code class="font-mono">描述</code>。</li>
                    </ul>
                  </div>

                  <div class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 space-y-1">
                    <h5 class="font-bold text-slate-700 dark:text-slate-300">3. 学习路线阶段 (二级标题)</h5>
                    <p>必须以 <code class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono font-bold text-accent">## 学习路线</code> 开头：</p>
                    <ul class="list-disc pl-4 space-y-0.5">
                      <li>使用三级标题 <code class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono">### 阶段标题</code> 声明阶段。</li>
                      <li>在阶段下方使用 <code class="font-mono">描述：</code> 声明该阶段要求。</li>
                      <li>使用列表项（例如 <code class="font-mono">- [ ] 子学习项</code>）声明内容。</li>
                    </ul>
                  </div>
                </div>

                <div class="shrink-0 pt-2 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <span>💡 编写工整，系统即可完成解析建档。</span>
                  <button type="button" class="text-accent font-bold hover:underline cursor-pointer" @click="fillDemoData">点击填入完整范例体验</button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  padding: 0.5rem 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
}

/* Slide fade transition for the help panel */
.slide-fade-enter-active {
  transition: all 0.4s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

/* Slim scrollbar for helper panel */
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: var(--border-base) transparent;
}
</style>

<style>
/* Global styles for the date picker popper */
.custom-date-popper {
  border-radius: 1.5rem !important;
  overflow: hidden !important;
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.1),
    0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
  border: 1px solid var(--border-base) !important;
}
.custom-date-popper .el-picker-panel {
  border-radius: 1.5rem !important;
  border: none !important;
}
</style>
