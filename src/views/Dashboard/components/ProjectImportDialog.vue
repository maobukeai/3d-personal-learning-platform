<script setup lang="ts">
import { ref, onUnmounted, watch, nextTick, computed } from 'vue';
import {
  Sparkles,
  X,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Compass,
  Check,
  Send,
  Square,
  Brain,
  Zap,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useSystemStore } from '@/stores/system';
import { preferences } from '@/utils/preferences';
import { parseMarkdownToPlanJson, getStableId } from '@/utils/planParser';
import {
  createJsonHeaders,
  parseSSEStream,
  readFetchErrorMessage,
  renderMarkdown,
} from '@/utils/aiHelpers';
import SafeHtml from '@/components/SafeHtml.vue';

// Props and Emits definition
const props = defineProps<{
  visible: boolean;
  canCreateProject: boolean;
  initialMode?: 'netdisk' | 'ai_assistant' | 'traditional';
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'imported'): void;
}>();

const systemStore = useSystemStore();

// Dialog & Stepper states
const importMode = ref<'netdisk' | 'ai_assistant' | 'traditional'>('netdisk');
const useTraditionalImport = computed(() => importMode.value === 'traditional');
const aiGoalInput = ref('');
const isStartingAiPlanner = ref(false);
const recGoals = ref([
  '我想在 2 周内学会 Three.js 基础开发与常用材质',
  '帮我设计一个 30 天的 WebGL/Shader 进阶学习路线',
  '我想通过实战案例学习 C4D 粒子渲染特效',
]);

const importStep = ref(1); // 1: Input Netdisk Link, 2: AI Co-Planning & Preview, 3: Completed
const netdiskUrl = ref('');
const netdiskPassword = ref('');
const isParsingNetdisk = ref(false);
const parsedNetdisk = ref<{
  title: string;
  directories: { name: string; files: string[] }[];
} | null>(null);

// Chat & Planning states
const planMessages = ref<
  {
    role: 'user' | 'assistant';
    content: string;
    reasoning?: string;
    showReasoning?: boolean;
    suggestions?: string[];
    isFallback?: boolean;
  }[]
>([]);
const chatInput = ref('');
const isChatSending = ref(false);
const currentReasoningText = ref(''); // live streaming reasoning/thinking
const isPlanJsonSynced = ref(false); // tracks if right panel has synced

interface PlanJson {
  title: string;
  description: string;
  tags: string;
  dueDate: string;
  color: string;
  tasks: {
    title: string;
    description?: string;
    priority: string;
    dueDate?: string;
    subtasks?: { id: string; text: string; done: boolean }[];
  }[];
  roadmap?: {
    title: string;
    description?: string;
    steps: {
      title: string;
      description?: string;
      order: number;
      subtasks: { id: string; text: string; done: boolean }[];
    }[];
  };
}

const currentPlanJson = ref<PlanJson | null>(null);

const previewTab = ref('info'); // 'info' | 'tasks' | 'roadmap'
const isFinalImporting = ref(false);
const activeChatReader = ref<ReadableStreamDefaultReader<Uint8Array> | null>(null);
const currentStreamingText = ref('');
const chatScrollContainer = ref<HTMLDivElement | null>(null);

const importText = ref('');
const isHelpOpen = ref(false);
const isImporting = ref(false);

const aiPrompt = ref('');
const isAiGenerating = ref(false);

const scrollToBottom = async () => {
  await nextTick();
  if (chatScrollContainer.value) {
    chatScrollContainer.value.scrollTop = chatScrollContainer.value.scrollHeight;
  }
};

watch(useTraditionalImport, (val) => {
  if (val) {
    isHelpOpen.value = true;
  }
});

watch(
  () => props.visible,
  (val) => {
    if (val) {
      importStep.value = 1;
      importMode.value = props.initialMode || 'ai_assistant';
      netdiskUrl.value = '';
      netdiskPassword.value = '';
      parsedNetdisk.value = null;
      planMessages.value = [];
      currentPlanJson.value = null;
      importText.value = '';
      aiGoalInput.value = '';
    } else {
      // Cancel active stream reader when dialog is closed to prevent memory leaks and background console crashes
      if (activeChatReader.value) {
        activeChatReader.value.cancel().catch(() => {});
        activeChatReader.value = null;
      }
      isChatSending.value = false;
    }
  },
);

const handleAiGenerate = async () => {
  if (!props.canCreateProject) {
    ElMessage.warning('只有团队创建人或管理员才能在团队中生成项目规划');
    return;
  }
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
  } catch {
    ElMessage.error('复制失败，请手动选择复制。');
  }
};

const handleImportProject = async () => {
  if (!props.canCreateProject) {
    ElMessage.warning('只有团队创建人或管理员才能在团队中导入和解析项目');
    return;
  }
  if (!importText.value.trim()) {
    ElMessage.warning('请输入或粘贴格式化文本后再进行导入解析。');
    return;
  }
  isImporting.value = true;
  try {
    const response = await api.post('/api/projects/import', { text: importText.value });
    if (response.data && response.data.success) {
      ElMessage.success(response.data.message || '导入解析成功！');
      emit('update:visible', false);
      importText.value = '';
      emit('imported');
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

const initializeCoPlan = () => {
  if (!parsedNetdisk.value) return;

  const title = parsedNetdisk.value.title;
  const categories = parsedNetdisk.value.directories;

  const tasks = categories.map((dir, i) => {
    const fileSummary =
      dir.files.slice(0, 3).join('、') +
      (dir.files.length > 3 ? ` 等共 ${dir.files.length} 个视频` : '');
    return {
      title: `完成 ${dir.name} 模块学习`,
      description: `学习内容包含：${fileSummary}`,
      priority: i === 0 ? 'HIGH' : 'MEDIUM',
      dueDate: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      subtasks: dir.files.map((file, fIdx) => ({
        id: getStableId(`学习视频: ${file}`, `task-${i}-sub-${fIdx}`),
        text: `学习视频: ${file}`,
        done: false,
      })),
    };
  });

  const steps = categories.map((dir, i) => ({
    title: dir.name,
    description: `完成该阶段所有视频课时，包括 ${dir.files.slice(0, 3).join('、')}${dir.files.length > 3 ? ' 等' : ''}。`,
    order: i + 1,
    subtasks: dir.files.map((file, fIdx) => ({
      id: getStableId(`学习视频: ${file}`, `step-${i}-sub-${fIdx}`),
      text: `学习视频: ${file}`,
      done: false,
    })),
  }));

  currentPlanJson.value = {
    title: title,
    description: `从百度网盘自动导入的 3D/全栈学习项目。\n网盘链接：${netdiskUrl.value}`,
    tags: '3D学习, 网盘导入',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    color: 'bg-indigo',
    tasks: tasks,
    roadmap: {
      title: `学习路线 - ${title}`,
      description: `针对该网盘资源的专属学习与实践路径`,
      steps: steps,
    },
  };

  const isFallback = (parsedNetdisk.value as any).isFallback ?? false;

  const greetingContent = isFallback
    ? `⚠️ **注意**：未能从网盘链接读取到真实文件列表（链接可能已失效，或需要提取码），以下大纲为 AI 根据链接主题**智能估算**生成，仅供参考，实际内容请以您的网盘为准。\n\n---\n\n✨ 孨！我是您的 AI 智能规划助手。我已基于您的链接主题，为课程 **${title}** 生成了一套包含 **${tasks.length}** 个看板任务和 **${steps.length}** 个学习阶段的初始参考计划。📋\n\n您可以直接与我对话来调整方案，直到满意为止！👾`
    : `✨ 孨！我是您的 AI 智能规划助手。我已经成功解析了您提供的百度网盘资源！📚\n\n课程：**${title}**，共 **${categories.length}** 个章节目录。我已提取其中的视频文件，并生成了包含 **${tasks.length}** 个看板任务和 **${steps.length}** 个学习阶段的初始计划。\n\n右侧是实时预览，您可以直接与我对话来进行微调！👾`;

  planMessages.value = [
    {
      role: 'assistant',
      content: greetingContent,
      isFallback,
      suggestions: [
        `把整体计划压缩到 ${Math.max(2, Math.round(categories.length / 2))} 周内完成`,
        '给每个任务加上更详细的学习目标描述',
        '在最后增加一个项目实战演练与答辩展示任务',
      ],
    },
  ];

  importStep.value = 2;
  previewTab.value = 'info';
  isPlanJsonSynced.value = true;
  scrollToBottom();
};

const handleParseNetdisk = async () => {
  const url = netdiskUrl.value.trim();
  if (!url) {
    ElMessage.warning('请输入百度网盘链接');
    return;
  }
  isParsingNetdisk.value = true;
  parsedNetdisk.value = null;
  try {
    const { data } = await api.post('/api/projects/parse-netdisk', {
      url,
      password: netdiskPassword.value.trim(),
    });
    if (data.success && data.data) {
      parsedNetdisk.value = data.data;
      if (data.data.isFallback) {
        ElMessage.warning(
          '已启动 AI 智能大纲还原！(未提取到网盘真实目录，已基于链接及主题为您智能设计大纲)',
        );
      } else {
        ElMessage.success('网盘链接智能解析成功！');
      }
      initializeCoPlan();
    } else {
      ElMessage.error('解析网盘链接失败，请重试');
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || '解析失败';
    ElMessage.error(errorMsg);
  } finally {
    isParsingNetdisk.value = false;
  }
};

const triggerCoPlanStream = async (activeMessageIndex: number) => {
  isChatSending.value = true;
  try {
    const activeWorkspaceId = preferences.getActiveWorkspaceId();
    const headers = createJsonHeaders();
    if (activeWorkspaceId) {
      headers['X-Workspace-Id'] = activeWorkspaceId;
    }

    const sanitizedMessages = planMessages.value
      .slice(0, -1)
      .slice(-10)
      .map((m) => {
        // Avoid sending full plan markdown back as history — the currentPlan JSON already carries that state.
        // Assistant messages that contain a full plan are replaced with a short placeholder.
        if (
          m.role === 'assistant' &&
          m.content.length > 300 &&
          (m.content.includes('## 任务看板') || m.content.includes('## 学习路线'))
        ) {
          return {
            role: m.role,
            content: '（已输出完整计划，已通过 currentPlan 参数传递，此处省略）',
          };
        }
        return { role: m.role, content: m.content };
      });

    const response = await fetch('/api/projects/co-plan-chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: sanitizedMessages,
        netdiskInfo: parsedNetdisk.value,
        currentPlan: currentPlanJson.value,
      }),
    });

    if (!response.ok) {
      throw new Error(await readFetchErrorMessage(response, '呼叫 AI 规划助手失败'));
    }

    if (!response.body) {
      throw new Error('未获得数据流响应');
    }

    const reader = response.body.getReader();
    activeChatReader.value = reader;

    let lastMarkdownParseTime = 0;

    await parseSSEStream(
      reader,
      (payload) => {
        if (payload.error) {
          throw new Error(payload.error);
        }
        if (payload.reasoning) {
          currentReasoningText.value += payload.reasoning;
          planMessages.value[activeMessageIndex].reasoning = currentReasoningText.value;
          if (currentReasoningText.value.length > 0) {
            planMessages.value[activeMessageIndex].showReasoning = true;
          }
          scrollToBottom();
        }
        if (payload.text) {
          currentStreamingText.value += payload.text;
          planMessages.value[activeMessageIndex].content = currentStreamingText.value;

          // Throttled real-time sync: update right panel every 300ms while streaming
          const now = Date.now();
          if (now - lastMarkdownParseTime > 300) {
            lastMarkdownParseTime = now;
            try {
              const parsed = parseMarkdownToPlanJson(currentStreamingText.value);
              if (
                parsed &&
                parsed.title !== '未命名导入项目' &&
                ((parsed.tasks?.length ?? 0) > 0 || (parsed.roadmap?.steps?.length ?? 0) > 0)
              ) {
                currentPlanJson.value = parsed as PlanJson;
              }
            } catch {}
          }
          scrollToBottom();
        }
      },
      () => {},
      (err) => {
        throw err;
      },
    );

    // Final authoritative parse once the stream is complete
    planMessages.value[activeMessageIndex].content = currentStreamingText.value;
    try {
      const finalParsed = parseMarkdownToPlanJson(currentStreamingText.value);
      const hasData =
        finalParsed &&
        finalParsed.title !== '未命名导入项目' &&
        ((finalParsed.tasks?.length ?? 0) > 0 || (finalParsed.roadmap?.steps?.length ?? 0) > 0);

      if (hasData) {
        currentPlanJson.value = finalParsed as PlanJson;
        isPlanJsonSynced.value = true;
      } else {
        // JSON fallback: AI may have output raw JSON despite instructions — try to extract it
        const jsonMatch = currentStreamingText.value.match(/\{[\s\S]*"tasks"\s*:\s*\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const extracted = JSON.parse(jsonMatch[0] + (jsonMatch[0].endsWith('}') ? '' : '}'));
            if (
              extracted &&
              extracted.title &&
              (extracted.tasks?.length > 0 || extracted.roadmap?.steps?.length > 0)
            ) {
              currentPlanJson.value = extracted as PlanJson;
              isPlanJsonSynced.value = true;
              console.warn(
                '[CoPlan] AI output raw JSON instead of Markdown — parsed via fallback extractor.',
              );
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('Final markdown parse failed:', e);
    }
  } catch (err: any) {
    ElMessage.error(err.message || '规划助手对话发生错误');
    planMessages.value[activeMessageIndex].content =
      '抱歉，AI 规划助手遇到了一点问题。请稍后重试，或检查后台 AI 配置是否正常。🛠️';
  } finally {
    isChatSending.value = false;
    currentStreamingText.value = '';
    currentReasoningText.value = '';
    activeChatReader.value = null;
    scrollToBottom();
  }
};

const handleSendChat = async () => {
  const text = chatInput.value.trim();
  if (!text) return;
  if (isChatSending.value) return;

  planMessages.value.push({ role: 'user', content: text });
  chatInput.value = '';
  isPlanJsonSynced.value = false;
  currentReasoningText.value = '';
  scrollToBottom();

  planMessages.value.push({ role: 'assistant', content: '', reasoning: '', showReasoning: false });
  const activeMessageIndex = planMessages.value.length - 1;

  await triggerCoPlanStream(activeMessageIndex);
};

const handleStartAiPlanner = async () => {
  const goal = aiGoalInput.value.trim();
  if (!goal) {
    ElMessage.warning('请输入您的学习目标或想学的主题');
    return;
  }

  isStartingAiPlanner.value = true;
  parsedNetdisk.value = null;
  currentPlanJson.value = null;
  planMessages.value = [];

  planMessages.value.push({ role: 'user', content: goal });
  planMessages.value.push({ role: 'assistant', content: '', reasoning: '', showReasoning: false });
  const activeMessageIndex = planMessages.value.length - 1;

  importStep.value = 2;
  previewTab.value = 'info';
  isPlanJsonSynced.value = false;
  currentStreamingText.value = '';
  currentReasoningText.value = '';
  scrollToBottom();

  try {
    await triggerCoPlanStream(activeMessageIndex);
  } finally {
    isStartingAiPlanner.value = false;
  }
};

const handleImportCoPlan = async () => {
  if (!currentPlanJson.value) return;
  isFinalImporting.value = true;

  let planPayload = currentPlanJson.value;
  if (planPayload && !planPayload.title) {
    if ((planPayload as any).plan && (planPayload as any).plan.title) {
      planPayload = (planPayload as any).plan;
    } else if ((planPayload as any).project && (planPayload as any).project.title) {
      planPayload = (planPayload as any).project;
    }
  }

  try {
    const { data } = await api.post('/api/projects/import-json', {
      plan: planPayload,
    });
    if (data.success && data.project) {
      ElMessage.success('学习项目及路线看板成功导入！');
      emit('update:visible', false);

      importStep.value = 1;
      netdiskUrl.value = '';
      netdiskPassword.value = '';
      parsedNetdisk.value = null;
      planMessages.value = [];
      currentPlanJson.value = null;
      importMode.value = 'ai_assistant';

      emit('imported');
    } else {
      ElMessage.error(data.message || '导入项目失败');
    }
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || error.message || '导入项目失败';
    ElMessage.error(errorMsg);
  } finally {
    isFinalImporting.value = false;
  }
};

const fillTraditionalTemplate = () => {
  importMode.value = 'traditional';
  fillDemoData();
};

onUnmounted(() => {
  if (activeChatReader.value) {
    activeChatReader.value.cancel().catch(() => {});
    activeChatReader.value = null;
  }
});
</script>

<template>
  <!-- Smart Import Dialog -->
  <Transition name="fade">
    <div v-if="visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-black/40 backdrop-blur-sm"
        @click="emit('update:visible', false)"
      ></div>
      <div
        class="relative w-full p-6 sm:p-8 rounded-3xl shadow-2xl border space-y-5 sm:space-y-6 transition-all duration-500 ease-out overflow-hidden flex flex-col"
        :class="
          useTraditionalImport
            ? isHelpOpen
              ? 'max-w-7xl'
              : 'max-w-3xl'
            : importStep === 2
              ? 'max-w-7xl h-[88vh]'
              : 'max-w-3xl'
        "
        style="background-color: var(--bg-card); border-color: var(--border-base)"
      >
        <!-- Unified Header -->
        <div
          class="flex items-center justify-between shrink-0 pb-4 border-b"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-center gap-2">
            <div class="p-1.5 bg-gradient-to-br from-accent to-indigo-600 rounded-lg text-white">
              <Sparkles class="w-4 h-4" />
            </div>
            <h3
              class="text-md sm:text-lg font-black tracking-tight"
              style="color: var(--text-primary)"
            >
              {{
                importMode === 'traditional'
                  ? '传统文本解析导入'
                  : importMode === 'ai_assistant'
                    ? 'AI 智能规划助手'
                    : '百度网盘智能解析'
              }}
            </h3>
          </div>

          <!-- Segmented Switch: only visible in step 1 and when not in traditional import mode -->
          <div
            v-if="importStep === 1 && importMode !== 'traditional'"
            class="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl"
          >
            <button
              type="button"
              class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              :class="
                importMode === 'ai_assistant'
                  ? 'bg-white dark:bg-slate-800 text-accent shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
              "
              @click="importMode = 'ai_assistant'"
            >
              智能规划助手
            </button>
            <button
              type="button"
              class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              :class="
                importMode === 'netdisk'
                  ? 'bg-white dark:bg-slate-800 text-accent shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
              "
              @click="importMode = 'netdisk'"
            >
              网盘智能解析
            </button>
          </div>

          <button
            type="button"
            class="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            style="color: var(--text-secondary)"
            @click="emit('update:visible', false)"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- 1. Stepped Netdisk Co-planning dialog layout -->
        <div v-if="!useTraditionalImport" class="flex-1 flex flex-col min-h-0 pt-2">
          <!-- Stepper content area -->
          <div class="flex-1 overflow-hidden min-h-0 pt-4 flex flex-col justify-between">
            <!-- Step 1 Layout -->
            <div v-if="importStep === 1" class="space-y-6 my-auto max-w-2xl mx-auto w-full">
              <!-- If Netdisk Mode -->
              <template v-if="importMode === 'netdisk'">
                <div class="text-center max-w-lg mx-auto space-y-2">
                  <div
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold"
                  >
                    <Compass class="w-3.5 h-3.5" />
                    <span>全新升级：百度网盘智能解析</span>
                  </div>
                  <h4 class="text-md font-bold text-slate-800 dark:text-slate-200">
                    一键解析网盘课程/资源
                  </h4>
                  <p class="text-xs text-slate-400">
                    我们将解析您分享的网盘课程名称、目录结构与视频大纲，并自动配置出任务看板 and
                    学习路线图。
                  </p>
                </div>

                <!-- Input form -->
                <div
                  class="p-6 bg-slate-50 dark:bg-white/[0.02] border rounded-2xl space-y-4"
                  style="border-color: var(--border-base)"
                >
                  <div class="space-y-1.5">
                    <label class="text-[11px] font-black text-slate-500 uppercase tracking-wider"
                      >百度网盘分享链接</label
                    >
                    <input
                      v-model="netdiskUrl"
                      type="text"
                      placeholder="https://pan.baidu.com/s/... 或直接粘贴整段分享内容"
                      class="w-full px-4 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                      style="border-color: var(--border-base); color: var(--text-primary)"
                      :disabled="isParsingNetdisk"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <div class="flex justify-between items-center">
                      <label class="text-[11px] font-black text-slate-500 uppercase tracking-wider"
                        >提取码 (选填)</label
                      >
                      <span class="text-[10px] text-slate-400"
                        >若链接中已包含提取码，可留空自动识别</span
                      >
                    </div>
                    <input
                      v-model="netdiskPassword"
                      type="text"
                      placeholder="例如: abcd"
                      class="w-32 px-4 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-mono uppercase"
                      style="border-color: var(--border-base); color: var(--text-primary)"
                      :disabled="isParsingNetdisk"
                    />
                  </div>

                  <button
                    type="button"
                    class="w-full py-3 bg-gradient-to-r from-accent to-indigo-600 hover:from-accent hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-accent/20 hover:shadow-accent/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    :disabled="isParsingNetdisk || !netdiskUrl.trim()"
                    @click="handleParseNetdisk"
                  >
                    <Loader2 v-if="isParsingNetdisk" class="w-4 h-4 animate-spin" />
                    <Sparkles v-else class="w-4 h-4" />
                    <span>开始网盘智能解析 (AI 协同规划)</span>
                  </button>
                </div>

                <!-- Tip alert -->
                <div
                  class="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/[0.02] border border-indigo-100/50 dark:border-indigo-500/10 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex gap-2"
                >
                  <span class="text-xs">💡</span>
                  <div>
                    <p class="font-bold text-indigo-900 dark:text-indigo-400">这是如何工作的？</p>
                    <p class="mt-0.5">
                      当您提交网盘链接时，我们的系统会爬取提取网盘文件列表。接着，AI
                      会将目录文件解析成结构化的学习路线与看板任务，并启动<b>对话式规划窗口</b>供您二次微调。
                    </p>
                    <button
                      type="button"
                      class="mt-1.5 text-accent font-bold hover:underline cursor-pointer"
                      @click="fillTraditionalTemplate"
                    >
                      没有网盘？点击前往体验传统的纯文本生成
                    </button>
                  </div>
                </div>
              </template>

              <!-- If AI Assistant Mode -->
              <template v-else-if="importMode === 'ai_assistant'">
                <div class="text-center max-w-lg mx-auto space-y-2">
                  <div
                    class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold"
                  >
                    <Brain class="w-3.5 h-3.5 text-accent" />
                    <span>对话式协同规划</span>
                  </div>
                  <h4 class="text-md font-bold text-slate-800 dark:text-slate-200">
                    输入您的学习目标，让 AI 帮您做规划
                  </h4>
                  <p class="text-xs text-slate-400">
                    只需一句话描述您想学的内容，AI
                    将为您智能定制阶段路线、梳理任务清单，并支持对话式微调。
                  </p>
                </div>

                <!-- Input form -->
                <div
                  class="p-6 bg-slate-50 dark:bg-white/[0.02] border rounded-2xl space-y-4"
                  style="border-color: var(--border-base)"
                >
                  <div class="space-y-1.5">
                    <label class="text-[11px] font-black text-slate-500 uppercase tracking-wider"
                      >您的学习目标或主题</label
                    >
                    <textarea
                      v-model="aiGoalInput"
                      rows="3"
                      placeholder="例如：我想从零开始在 30 天内学完 Three.js 并开发一个 3D 个人画廊项目..."
                      class="w-full px-4 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent leading-relaxed"
                      style="border-color: var(--border-base); color: var(--text-primary)"
                      :disabled="isStartingAiPlanner"
                    ></textarea>
                  </div>

                  <!-- Recommendation goals -->
                  <div class="space-y-1.5">
                    <label class="text-[10px] font-bold text-slate-400">推荐灵感</label>
                    <div class="flex flex-wrap gap-2">
                      <button
                        v-for="(rec, rIdx) in recGoals"
                        :key="rIdx"
                        type="button"
                        class="px-3 py-1.5 rounded-lg border text-[11px] text-slate-500 dark:text-slate-400 hover:text-accent hover:border-accent bg-white dark:bg-slate-900 transition-colors cursor-pointer text-left font-medium"
                        style="border-color: var(--border-base)"
                        :disabled="isStartingAiPlanner"
                        @click="aiGoalInput = rec"
                      >
                        💡 {{ rec }}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    class="w-full py-3 bg-gradient-to-r from-accent to-indigo-600 hover:from-accent hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-accent/20 hover:shadow-accent/35 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    :disabled="isStartingAiPlanner || !aiGoalInput.trim()"
                    @click="handleStartAiPlanner"
                  >
                    <Loader2 v-if="isStartingAiPlanner" class="w-4 h-4 animate-spin" />
                    <Brain v-else class="w-4 h-4" />
                    <span>开始对话生成规划</span>
                  </button>
                </div>

                <!-- Tip alert -->
                <div
                  class="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/[0.02] border border-indigo-100/50 dark:border-indigo-500/10 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex gap-2"
                >
                  <span class="text-xs">💡</span>
                  <div>
                    <p class="font-bold text-indigo-900 dark:text-indigo-400">
                      如何与 AI 规划助手协同？
                    </p>
                    <p class="mt-0.5">
                      AI
                      生成初始规划后，您可以针对看板任务和学习路线，在左侧对话框中直接提出修改要求。例如：“加一些进阶内容”、“把周期缩短至
                      2 周”，右侧面板将实时更新呈现。
                    </p>
                  </div>
                </div>
              </template>
            </div>

            <!-- Step 2 Layout: Co-planning Workspace -->
            <div
              v-else-if="importStep === 2"
              class="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden min-h-0"
            >
              <!-- Left side: Interactive planning chat -->
              <div
                class="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-white/[0.01] border rounded-2xl p-4"
                style="border-color: var(--border-base)"
              >
                <div
                  class="flex items-center gap-1.5 pb-2 border-b mb-3"
                  style="border-color: var(--border-base)"
                >
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span class="text-xs font-bold" style="color: var(--text-primary)"
                    >与 AI 智能助理对话调优</span
                  >
                </div>

                <!-- Chat Messages Scroll -->
                <div
                  ref="chatScrollContainer"
                  class="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin custom-scrollbar"
                >
                  <div
                    v-for="(msg, index) in planMessages"
                    v-show="msg.role === 'user' || msg.content || msg.reasoning"
                    :key="index"
                    class="flex gap-2.5"
                    :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
                  >
                    <!-- AI Avatar -->
                    <div
                      v-if="msg.role === 'assistant'"
                      class="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shrink-0 shadow-md mt-0.5"
                    >
                      ✨
                    </div>

                    <div class="flex flex-col gap-1 max-w-[85%]">
                      <!-- Thinking block (reasoning) -->
                      <div v-if="msg.role === 'assistant' && msg.reasoning" class="mb-1">
                        <button
                          type="button"
                          class="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer group"
                          @click="msg.showReasoning = !msg.showReasoning"
                        >
                          <Brain class="w-3 h-3" />
                          <span>{{ msg.showReasoning ? '收起' : '展开' }}思考过程</span>
                          <span class="text-[9px] text-slate-400 font-normal"
                            >({{ Math.round((msg.reasoning?.length || 0) * 0.45) }} tokens)</span
                          >
                        </button>
                        <div
                          v-if="msg.showReasoning"
                          class="mt-1 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 text-[10px] text-indigo-500/80 dark:text-indigo-400/70 leading-relaxed whitespace-pre-wrap font-mono max-h-32 overflow-y-auto scrollbar-thin"
                        >
                          {{ msg.reasoning }}
                        </div>
                      </div>

                      <!-- Main message bubble -->
                      <div
                        class="rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed"
                        :class="
                          msg.role === 'user'
                            ? 'bg-accent text-white rounded-tr-none'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/30 dark:border-white/5'
                        "
                      >
                        <!-- User: plain text -->
                        <div v-if="msg.role === 'user'" class="whitespace-pre-line leading-relaxed">
                          {{ msg.content }}
                        </div>
                        <!-- AI: rendered markdown -->
                        <SafeHtml
                          v-else
                          class="ai-markdown leading-relaxed"
                          :html="renderMarkdown(msg.content || '...')"
                        />
                      </div>

                      <!-- Suggestion chips for the first greeting message -->
                      <div
                        v-if="
                          msg.role === 'assistant' &&
                          index === 0 &&
                          msg.suggestions &&
                          msg.suggestions.length &&
                          !isChatSending
                        "
                        class="flex flex-wrap gap-1.5 mt-2 pl-0.5"
                      >
                        <button
                          v-for="(sug, sIdx) in msg.suggestions"
                          :key="sIdx"
                          type="button"
                          class="px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                          style="
                            border-color: var(--accent-color, #6366f1);
                            color: var(--accent-color, #6366f1);
                            background: transparent;
                          "
                          @mouseover="
                            ($event.currentTarget as HTMLElement).style.background =
                              'rgba(99,102,241,0.08)'
                          "
                          @mouseleave="
                            ($event.currentTarget as HTMLElement).style.background = 'transparent'
                          "
                          @click="
                            () => {
                              chatInput = sug;
                              handleSendChat();
                            }
                          "
                        >
                          ⚡ {{ sug }}
                        </button>
                      </div>

                      <!-- Live sync badge when JSON was parsed -->
                      <div
                        v-if="
                          msg.role === 'assistant' &&
                          index === planMessages.length - 1 &&
                          isPlanJsonSynced &&
                          !isChatSending
                        "
                        class="flex items-center gap-1 text-[9px] font-bold text-emerald-500 pl-1"
                      >
                        <Zap class="w-2.5 h-2.5" />
                        <span>右侧规划已同步</span>
                      </div>
                    </div>

                    <div
                      v-if="msg.role === 'user'"
                      class="w-7 h-7 rounded-xl bg-accent/15 flex items-center justify-center text-accent text-xs font-black shrink-0 mt-0.5"
                    >
                      我
                    </div>
                  </div>

                  <!-- Thinking/Loading indicator when waiting for first token -->
                  <div
                    v-if="isChatSending && !currentStreamingText && !currentReasoningText"
                    class="flex gap-2.5"
                  >
                    <div
                      class="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shrink-0 animate-pulse"
                    >
                      🧠
                    </div>
                    <div
                      class="bg-slate-100 dark:bg-white/5 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-xs text-slate-400 flex items-center gap-1.5"
                    >
                      <Loader2 class="w-3.5 h-3.5 animate-spin text-accent" />
                      <span
                        >AI 正在思考并分析{{ parsedNetdisk ? '网盘资源' : '您的规划需求' }}...</span
                      >
                    </div>
                  </div>

                  <!-- Live reasoning streaming indicator -->
                  <div
                    v-if="isChatSending && currentReasoningText && !currentStreamingText"
                    class="flex gap-2.5"
                  >
                    <div
                      class="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shrink-0"
                    >
                      🧠
                    </div>
                    <div
                      class="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-[10px] text-indigo-400 flex items-center gap-1.5 max-w-[80%]"
                    >
                      <Loader2 class="w-3 h-3 animate-spin text-indigo-500 shrink-0" />
                      <span class="italic font-mono animate-pulse"
                        >分析及规划思考中：{{ currentReasoningText.slice(-30) }}...</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Chat Input footer -->
                <div
                  class="mt-3 pt-3 border-t flex items-center gap-2"
                  style="border-color: var(--border-base)"
                >
                  <input
                    v-model="chatInput"
                    type="text"
                    placeholder="输入您的调整指示，例如：“把阶段一和二合并”..."
                    class="flex-1 px-4 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent"
                    style="border-color: var(--border-base); color: var(--text-primary)"
                    :disabled="isChatSending"
                    @keydown.enter="handleSendChat"
                  />

                  <button
                    v-if="isChatSending"
                    type="button"
                    class="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition-all shrink-0"
                    @click="activeChatReader?.cancel()"
                  >
                    <Square class="w-4 h-4 fill-current" />
                  </button>
                  <button
                    v-else
                    type="button"
                    :disabled="!chatInput.trim()"
                    class="w-9 h-9 rounded-xl bg-accent text-white flex items-center justify-center shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all shrink-0 disabled:opacity-50"
                    style="background: var(--accent)"
                    @click="handleSendChat"
                  >
                    <Send class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Right side: Realtime generated project structures preview -->
              <div
                class="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-white/[0.01] border rounded-2xl p-4"
                style="border-color: var(--border-base)"
              >
                <!-- Preview Tabs -->
                <div
                  class="flex items-center justify-between border-b pb-2 mb-3 shrink-0"
                  style="border-color: var(--border-base)"
                >
                  <div class="flex gap-4">
                    <button
                      type="button"
                      class="text-xs font-bold pb-2 relative transition-all cursor-pointer"
                      :class="
                        previewTab === 'info'
                          ? 'text-accent'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                      "
                      @click="previewTab = 'info'"
                    >
                      项目概览
                      <span
                        v-if="previewTab === 'info'"
                        class="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-accent"
                      ></span>
                    </button>
                    <button
                      type="button"
                      class="text-xs font-bold pb-2 relative transition-all cursor-pointer"
                      :class="
                        previewTab === 'tasks'
                          ? 'text-accent'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                      "
                      @click="previewTab = 'tasks'"
                    >
                      任务看板 ({{ currentPlanJson?.tasks?.length || 0 }})
                      <span
                        v-if="previewTab === 'tasks'"
                        class="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-accent"
                      ></span>
                    </button>
                    <button
                      type="button"
                      class="text-xs font-bold pb-2 relative transition-all cursor-pointer"
                      :class="
                        previewTab === 'roadmap'
                          ? 'text-accent'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-350'
                      "
                      @click="previewTab = 'roadmap'"
                    >
                      学习路线 ({{ currentPlanJson?.roadmap?.steps?.length || 0 }})
                      <span
                        v-if="previewTab === 'roadmap'"
                        class="absolute bottom-[-9px] left-0 right-0 h-0.5 bg-accent"
                      ></span>
                    </button>
                  </div>

                  <span
                    v-if="isChatSending"
                    class="text-[9px] font-bold text-amber-500 animate-pulse bg-amber-500/5 px-2 py-0.5 border border-amber-500/10 rounded"
                  >
                    正在合成最新结构规划...
                  </span>
                  <span
                    v-else-if="isPlanJsonSynced"
                    class="text-[9px] font-bold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded flex items-center gap-0.5"
                  >
                    <Check class="w-3 h-3" /> 已实时同步
                  </span>
                  <span
                    v-else
                    class="text-[9px] font-bold text-slate-400 bg-slate-500/5 px-2 py-0.5 border border-slate-500/10 rounded flex items-center gap-0.5"
                  >
                    预览规划
                  </span>
                </div>

                <!-- Preview Area -->
                <div
                  class="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin custom-scrollbar text-left"
                >
                  <!-- Info Tab -->
                  <div v-if="previewTab === 'info'" class="space-y-4">
                    <div class="space-y-1">
                      <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                        >项目名称</label
                      >
                      <h4 class="text-sm font-black text-slate-800 dark:text-slate-200">
                        {{ currentPlanJson?.title || '正在规划生成中...' }}
                      </h4>
                    </div>

                    <div class="space-y-1">
                      <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                        >项目描述</label
                      >
                      <p
                        class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap bg-slate-100 dark:bg-white/5 p-3 rounded-2xl"
                      >
                        {{ currentPlanJson?.description || '无项目描述' }}
                      </p>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                          >周期时间截止</label
                        >
                        <div class="text-xs font-bold text-slate-700 dark:text-slate-300">
                          📅 {{ currentPlanJson?.dueDate || '未定' }}
                        </div>
                      </div>
                      <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
                          >分类标签</label
                        >
                        <div class="flex flex-wrap gap-1.5 mt-0.5">
                          <span
                            v-for="tag in (currentPlanJson?.tags || '').split(',')"
                            v-show="tag.trim()"
                            :key="tag"
                            class="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 text-[10px] font-bold"
                          >
                            {{ tag.trim() }}
                          </span>
                          <span
                            v-if="!(currentPlanJson?.tags || '').trim()"
                            class="text-[10px] text-slate-400"
                            >无标签</span
                          >
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Tasks Tab -->
                  <div v-else-if="previewTab === 'tasks'" class="space-y-3">
                    <div
                      v-for="(task, idx) in currentPlanJson?.tasks"
                      :key="idx"
                      class="p-3 border rounded-xl space-y-2 bg-white dark:bg-slate-900/50"
                      style="border-color: var(--border-base)"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <span class="text-xs font-bold text-slate-800 dark:text-slate-200">{{
                          task.title
                        }}</span>
                        <span
                          class="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                          :class="{
                            'bg-rose-500/10 text-rose-500':
                              task.priority === 'HIGH' ||
                              task.priority === '紧急' ||
                              task.priority === '高',
                            'bg-amber-500/10 text-amber-500':
                              task.priority === 'MEDIUM' || task.priority === '中',
                            'bg-slate-500/10 text-slate-400':
                              task.priority === 'LOW' || task.priority === '低',
                          }"
                        >
                          {{ task.priority }}
                        </span>
                      </div>
                      <p
                        v-if="task.description"
                        class="text-[11px] text-slate-500 dark:text-slate-400 leading-normal"
                      >
                        {{ task.description }}
                      </p>

                      <!-- DueDate -->
                      <div v-if="task.dueDate" class="text-[10px] text-slate-400 font-bold">
                        ⏱ 截止时间: {{ task.dueDate }}
                      </div>

                      <!-- Subtasks -->
                      <div
                        v-if="task.subtasks && task.subtasks.length > 0"
                        class="bg-slate-50 dark:bg-white/5 p-2 rounded-lg space-y-1"
                      >
                        <div
                          v-for="sub in task.subtasks"
                          :key="sub.id"
                          class="flex items-start gap-1.5"
                        >
                          <div
                            class="w-3.5 h-3.5 rounded border border-slate-300 dark:border-white/10 flex items-center justify-center shrink-0 mt-0.5"
                          >
                            <Check class="w-2.5 h-2.5 text-accent opacity-30" />
                          </div>
                          <span
                            class="text-[10px] text-slate-500 dark:text-slate-400 leading-normal"
                            >{{ sub.text }}</span
                          >
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Roadmap Tab -->
                  <div v-else-if="previewTab === 'roadmap'" class="space-y-4">
                    <div class="pb-1 border-b" style="border-color: var(--border-base)">
                      <h4 class="text-xs font-black text-slate-800 dark:text-slate-200">
                        🗺 {{ currentPlanJson?.roadmap?.title || '阶段学习路线' }}
                      </h4>
                      <p class="text-[10px] text-slate-400 mt-0.5">
                        {{ currentPlanJson?.roadmap?.description || '无大纲描述' }}
                      </p>
                    </div>

                    <div
                      class="relative pl-4 border-l-2 border-indigo-100 dark:border-white/5 space-y-5"
                    >
                      <div
                        v-for="(step, idx) in currentPlanJson?.roadmap?.steps"
                        :key="idx"
                        class="relative"
                      >
                        <!-- Timeline Node Ball -->
                        <span
                          class="absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-500 flex items-center justify-center text-white text-[7px] font-bold shadow-md"
                        ></span>

                        <div class="space-y-1.5">
                          <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-slate-800 dark:text-slate-200">{{
                              step.title
                            }}</span>
                            <span
                              class="text-[9px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-500/5 px-1.5 py-0.5 rounded"
                              >阶段 {{ step.order }}</span
                            >
                          </div>

                          <p
                            v-if="step.description"
                            class="text-[11px] text-slate-500 dark:text-slate-400 leading-normal"
                          >
                            {{ step.description }}
                          </p>

                          <div
                            v-if="step.subtasks && step.subtasks.length > 0"
                            class="bg-slate-50 dark:bg-white/5 p-3 rounded-xl space-y-1.5"
                          >
                            <div
                              v-for="sub in step.subtasks"
                              :key="sub.id"
                              class="flex items-start gap-2"
                            >
                              <div
                                class="w-3.5 h-3.5 rounded border border-slate-300 dark:border-white/10 flex items-center justify-center shrink-0 mt-0.5"
                              >
                                <Check class="w-2.5 h-2.5 text-accent opacity-30" />
                              </div>
                              <span
                                class="text-[10px] text-slate-500 dark:text-slate-400 leading-normal"
                                >{{ sub.text }}</span
                              >
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Dialog Actions -->
                <div
                  class="flex items-center gap-4 mt-4 pt-4 border-t shrink-0"
                  style="border-color: var(--border-base)"
                >
                  <button
                    v-if="importStep === 2"
                    type="button"
                    class="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-xs cursor-pointer flex items-center gap-1.5"
                    :disabled="isChatSending"
                    @click="importStep = 1"
                  >
                    <ArrowLeft class="w-4 h-4" />
                    <span>{{ parsedNetdisk ? '修改网盘资源' : '修改规划目标' }}</span>
                  </button>

                  <button
                    v-if="importStep === 2"
                    type="button"
                    :disabled="isFinalImporting || isChatSending"
                    class="flex-1 py-3 rounded-2xl bg-gradient-to-r from-accent to-indigo-600 text-white font-bold text-xs shadow-lg shadow-accent/20 hover:shadow-accent/40 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    @click="handleImportCoPlan"
                  >
                    <Loader2 v-if="isFinalImporting" class="w-4 h-4 animate-spin" />
                    <CheckCircle2 v-else class="w-4 h-4" />
                    <span>确认规划满意，一键生成导入项目</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Traditional text parsing fall-back (Original layout) -->
        <div v-else class="flex-1 flex flex-col min-h-0 pt-2">
          <div
            class="grid grid-cols-1 gap-6 transition-all duration-500"
            :class="isHelpOpen ? 'md:grid-cols-2' : 'grid-cols-1'"
          >
            <!-- Left Panel: Text Area input -->
            <div class="space-y-4 flex flex-col justify-between">
              <div>
                <!-- AI Smart Copilot Generator Section -->
                <div
                  v-if="systemStore.settings.AI_IMPORT_ENABLED"
                  class="mb-4 p-4 rounded-2xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01] space-y-2.5 text-left"
                >
                  <div class="flex items-center justify-between">
                    <span
                      class="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5"
                    >
                      <Sparkles class="w-3.5 h-3.5 text-indigo-500" />
                      AI 智能规划助手
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-400 leading-normal">
                    没有现成规划文本？在下方输入您的学习意图与目标，AI
                    将智能规划并在此自动生成大纲模板，省去手写排版！
                  </p>
                  <div class="flex gap-2">
                    <input
                      v-model="aiPrompt"
                      type="text"
                      placeholder="例如：“我想用 1 个月时间，完成一个 3D 酷炫个人画廊网站，需要学习哪些技术”"
                      class="flex-1 px-3 py-1.5 rounded-xl border text-xs bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent"
                      style="border-color: var(--border-base); color: var(--text-primary)"
                      :disabled="isAiGenerating"
                    />
                    <button
                      type="button"
                      class="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1 shadow disabled:opacity-50"
                      :disabled="isAiGenerating || !aiPrompt.trim()"
                      @click="handleAiGenerate"
                    >
                      <Loader2 v-if="isAiGenerating" class="w-3.5 h-3.5 animate-spin" />
                      <span>智能生成</span>
                    </button>
                  </div>
                </div>

                <div class="flex justify-between items-center mb-1 text-left">
                  <label class="text-[11px] font-black text-slate-500 uppercase tracking-wider"
                    >规划结构化文本</label
                  >
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="text-[10px] text-accent font-bold hover:underline cursor-pointer"
                      @click="copyTemplate"
                    >
                      复制空白模板
                    </button>
                    <span class="text-slate-300 dark:text-white/10">|</span>
                    <button
                      type="button"
                      class="text-[10px] text-emerald-500 font-bold hover:underline cursor-pointer"
                      @click="fillDemoData"
                    >
                      填入范例数据
                    </button>
                  </div>
                </div>

                <textarea
                  v-model="importText"
                  rows="14"
                  placeholder="项目：[项目名称]&#10;描述：[项目主旨简介]&#10;标签：[标签1, 标签2]&#10;截止日期：[YYYY-MM-DD]&#10;&#10;## 任务看板&#10;- [ ] 任务一标题 | 优先级:高 | 截止:2026-06-15 | 描述:任务描述&#10;&#10;## 学习路线&#10;### 阶段一：[阶段名称]&#10;描述：[阶段目标描述]&#10;- [ ] 子学习项标题"
                  class="w-full p-4 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent font-mono leading-relaxed bg-white dark:bg-slate-900"
                  style="border-color: var(--border-base); color: var(--text-primary)"
                  :disabled="isImporting"
                ></textarea>
              </div>

              <div class="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  class="px-5 py-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 font-bold text-xs cursor-pointer"
                  @click="emit('update:visible', false)"
                >
                  取消
                </button>
                <button
                  type="button"
                  class="px-4 py-2 rounded-xl border font-bold text-xs cursor-pointer text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
                  style="border-color: var(--border-base)"
                  @click="isHelpOpen = !isHelpOpen"
                >
                  {{ isHelpOpen ? '隐藏解析说明' : '查看解析说明' }}
                </button>
                <button
                  type="button"
                  :disabled="isImporting || !importText.trim()"
                  class="px-6 py-2 rounded-xl bg-accent text-white font-bold text-xs shadow-lg shadow-accent/15 hover:scale-103 active:scale-97 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  style="background: var(--accent)"
                  @click="handleImportProject"
                >
                  <Loader2 v-if="isImporting" class="w-3.5 h-3.5 animate-spin" />
                  <span>解析建档并导入</span>
                </button>
              </div>
            </div>

            <!-- Right Panel: Format Reference Helper Documentation -->
            <Transition name="slide-fade">
              <div
                v-if="isHelpOpen"
                class="flex flex-col border rounded-2xl p-5 bg-slate-50/50 dark:bg-white/[0.01] h-[580px] overflow-hidden min-h-0 text-left"
                style="border-color: var(--border-base)"
              >
                <div
                  class="flex items-center justify-between shrink-0 pb-3 border-b"
                  style="border-color: var(--border-base)"
                >
                  <h4
                    class="text-xs font-black uppercase tracking-wider"
                    style="color: var(--text-primary)"
                  >
                    💡 解析规则与格式参考
                  </h4>
                  <button
                    type="button"
                    class="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold cursor-pointer"
                    @click="isHelpOpen = false"
                  >
                    收起说明
                  </button>
                </div>

                <div
                  class="flex-1 overflow-y-auto space-y-4 pr-1 mt-3 scrollbar-thin text-xs leading-relaxed text-slate-500 dark:text-slate-400"
                >
                  <div
                    class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 space-y-1"
                  >
                    <h5 class="font-bold text-slate-700 dark:text-slate-300">
                      1. 基本配置参数 (头部信息)
                    </h5>
                    <p>通过冒号或等号声明项目的元属性。例如：</p>
                    <ul class="list-disc pl-4 space-y-0.5">
                      <li><strong>描述：</strong> 项目主旨，支持多行。</li>
                      <li><strong>标签：</strong> 分类标签（英文逗号隔开）。</li>
                      <li>
                        <strong>截止日期：</strong> 例如
                        <code class="font-mono text-emerald-500">2026-06-30</code>.
                      </li>
                      <li>
                        <strong>颜色：</strong> 例如
                        <code class="font-mono text-indigo-500">bg-accent/bg-indigo/bg-emerald</code
                        >.
                      </li>
                    </ul>
                  </div>

                  <div
                    class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 space-y-1"
                  >
                    <h5 class="font-bold text-slate-700 dark:text-slate-300">
                      2. 看板工作任务 (二级标题)
                    </h5>
                    <p>
                      必须以
                      <code
                        class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono font-bold text-accent"
                        >## 任务看板</code
                      >
                      开头，列表项解析属性：
                    </p>
                    <ul class="list-disc pl-4 space-y-0.5">
                      <li>
                        格式：<code
                          class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono"
                          >- [ ] 任务标题 | 优先级:高 | 描述:任务描述</code
                        >
                      </li>
                      <li>
                        属性间使用 <code class="font-bold text-accent">|</code> 分隔。包含：<code
                          class="font-mono"
                          >优先级 (低/中/高/紧急)</code
                        >，<code class="font-mono">截止 (YYYY-MM-DD)</code>，<code class="font-mono"
                          >描述</code
                        >。
                      </li>
                    </ul>
                  </div>

                  <div
                    class="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 space-y-1"
                  >
                    <h5 class="font-bold text-slate-700 dark:text-slate-300">
                      3. 学习路线阶段 (二级标题)
                    </h5>
                    <p>
                      必须以
                      <code
                        class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono font-bold text-accent"
                        >## 学习路线</code
                      >
                      开头：
                    </p>
                    <ul class="list-disc pl-4 space-y-0.5">
                      <li>
                        使用三级标题
                        <code class="px-1 py-0.5 bg-slate-200 dark:bg-white/10 rounded font-mono"
                          >### 阶段标题</code
                        >
                        声明阶段。
                      </li>
                      <li>在阶段下方使用 <code class="font-mono">描述：</code> 声明该阶段要求。</li>
                      <li>
                        使用列表项（例如 <code class="font-mono">- [ ] 子学习项</code>）声明内容。
                      </li>
                    </ul>
                  </div>
                </div>

                <div
                  class="shrink-0 pt-2 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-white/5 flex items-center justify-between"
                >
                  <span>💡 编写工整，系统即可完成解析建档。</span>
                  <button
                    type="button"
                    class="text-accent font-bold hover:underline cursor-pointer"
                    @click="fillDemoData"
                  >
                    点击填入完整范例体验
                  </button>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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

/* AI Markdown styles */
.ai-markdown :deep(strong) {
  font-weight: 700;
}
.ai-markdown :deep(em) {
  font-style: italic;
}
.ai-markdown :deep(.inline-code) {
  font-family: monospace;
  font-size: 0.85em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}
.ai-markdown :deep(.md-h2) {
  font-size: 1.15rem;
  font-weight: 800;
  margin: 0.6em 0 0.3em;
}
.ai-markdown :deep(.md-h3) {
  font-size: 1rem;
  font-weight: 750;
  margin: 0.5em 0 0.25em;
}
.ai-markdown :deep(.md-h4) {
  font-size: 0.9rem;
  font-weight: 700;
  margin: 0.4em 0 0.2em;
}
.ai-markdown :deep(.md-li) {
  display: flex;
  align-items: flex-start;
  gap: 0.4em;
  margin: 0.15em 0;
  padding-left: 0.5em;
}
.ai-markdown :deep(.md-li::before) {
  content: '·';
  color: #6366f1;
  font-weight: bold;
  flex-shrink: 0;
}
.ai-markdown :deep(.chk) {
  display: inline-block;
  width: 0.9em;
  height: 0.9em;
  border: 1px solid currentColor;
  border-radius: 2px;
  opacity: 0.4;
  flex-shrink: 0;
  margin-top: 0.1em;
}
.ai-markdown :deep(.chk.done) {
  background: #10b981;
  border-color: #10b981;
  color: white;
  opacity: 1;
  font-size: 0.7em;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
