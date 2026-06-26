<script setup lang="ts">
import { ref, onUnmounted, watch, computed } from 'vue';
import { logError } from '@/utils/error';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { useSystemStore } from '@/stores/system';
import { preferences } from '@/utils/preferences';
import { parseMarkdownToPlanJson, getStableId } from '@/utils/planParser';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';
import ProjectImportHeader from './ProjectImportHeader.vue';
import NetdiskInputPanel from './NetdiskInputPanel.vue';
import AiGoalInputPanel from './AiGoalInputPanel.vue';
import CoPlanChatPanel from './CoPlanChatPanel.vue';
import PlanPreviewPanel from './PlanPreviewPanel.vue';
import TraditionalImportPanel from './TraditionalImportPanel.vue';
import FormatHelpPanel from './FormatHelpPanel.vue';
import Modal from '@/components/ui/Modal.vue';
import type { ImportMode, PlanJson, PlanMessage, ParsedNetdisk } from './importDialogTypes';

// Props and Emits definition
const props = defineProps<{
  visible: boolean;
  canCreateProject: boolean;
  initialMode?: ImportMode;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'imported'): void;
}>();

const systemStore = useSystemStore();

// Dialog & Stepper states
const importMode = ref<ImportMode>('netdisk');
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
const parsedNetdisk = ref<ParsedNetdisk | null>(null);

// Chat & Planning states
const planMessages = ref<PlanMessage[]>([]);
const chatInput = ref('');
const isChatSending = ref(false);
const currentReasoningText = ref(''); // live streaming reasoning/thinking
const isPlanJsonSynced = ref(false); // tracks if right panel has synced

const currentPlanJson = ref<PlanJson | null>(null);

const previewTab = ref('info'); // 'info' | 'tasks' | 'roadmap'
const isFinalImporting = ref(false);
const activeChatReader = ref<ReadableStreamDefaultReader<Uint8Array> | null>(null);
const currentStreamingText = ref('');

const importText = ref('');
const isHelpOpen = ref(false);
const isImporting = ref(false);

const aiPrompt = ref('');
const isAiGenerating = ref(false);

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
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, 'AI 生成失败'));
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
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '导入解析失败'));
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

  const isFallback = parsedNetdisk.value.isFallback ?? false;

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
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '解析失败'));
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
              logError(
                '[CoPlan] AI output raw JSON instead of Markdown — parsed via fallback extractor.',
              );
            }
          } catch {}
        }
      }
    } catch (e) {
      logError('Final markdown parse failed:', e);
    }
  } catch (err: unknown) {
    ElMessage.error(getApiErrorMessage(err, '规划助手对话发生错误'));
    planMessages.value[activeMessageIndex].content =
      '抱歉，AI 规划助手遇到了一点问题。请稍后重试，或检查后台 AI 配置是否正常。🛠️';
  } finally {
    isChatSending.value = false;
    currentStreamingText.value = '';
    currentReasoningText.value = '';
    activeChatReader.value = null;
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

  try {
    await triggerCoPlanStream(activeMessageIndex);
  } finally {
    isStartingAiPlanner.value = false;
  }
};

const handleImportCoPlan = async () => {
  if (!currentPlanJson.value) return;
  isFinalImporting.value = true;

  let planPayload = currentPlanJson.value as
    | (PlanJson & { plan?: PlanJson; project?: PlanJson })
    | null;
  if (planPayload && !planPayload.title) {
    if (planPayload.plan && planPayload.plan.title) {
      planPayload = planPayload.plan;
    } else if (planPayload.project && planPayload.project.title) {
      planPayload = planPayload.project;
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
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '导入项目失败'));
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
  <Modal
    :show="visible"
    :size="useTraditionalImport ? (isHelpOpen ? 'xxl' : 'lg') : importStep === 2 ? 'xxl' : 'lg'"
    padding="none"
    glass-card
    @close="emit('update:visible', false)"
  >
    <div
      class="mobile-adaptive relative w-full p-6 sm:p-8 rounded-3xl space-y-5 sm:space-y-6 overflow-hidden flex flex-col"
      :class="!useTraditionalImport && importStep === 2 ? 'h-[88vh]' : ''"
    >
      <!-- Unified Header -->
      <ProjectImportHeader
        :import-mode="importMode"
        :import-step="importStep"
        @close="emit('update:visible', false)"
        @update:import-mode="importMode = $event"
      />

      <!-- 1. Stepped Netdisk Co-planning dialog layout -->
      <div v-if="!useTraditionalImport" class="flex-1 flex flex-col min-h-0 pt-2">
        <!-- Stepper content area -->
        <div class="flex-1 overflow-hidden min-h-0 pt-4 flex flex-col justify-between">
          <!-- Step 1 Layout -->
          <NetdiskInputPanel
            v-if="importStep === 1 && importMode === 'netdisk'"
            v-model="netdiskUrl"
            v-model:password="netdiskPassword"
            :is-parsing-netdisk="isParsingNetdisk"
            @parse="handleParseNetdisk"
            @use-traditional="fillTraditionalTemplate"
          />

          <AiGoalInputPanel
            v-else-if="importStep === 1 && importMode === 'ai_assistant'"
            v-model="aiGoalInput"
            :rec-goals="recGoals"
            :is-starting-ai-planner="isStartingAiPlanner"
            @start="handleStartAiPlanner"
          />

          <!-- Step 2 Layout: Co-planning Workspace -->
          <div
            v-else-if="importStep === 2"
            class="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden min-h-0"
          >
            <!-- Left side: Interactive planning chat -->
            <CoPlanChatPanel
              v-model="chatInput"
              :messages="planMessages"
              :is-chat-sending="isChatSending"
              :current-streaming-text="currentStreamingText"
              :current-reasoning-text="currentReasoningText"
              :parsed-netdisk="parsedNetdisk"
              :is-plan-json-synced="isPlanJsonSynced"
              @send="
                (text?: string) => {
                  if (text) chatInput = text;
                  handleSendChat();
                }
              "
              @stop="activeChatReader?.cancel()"
            />

            <!-- Right side: Realtime generated project structures preview -->
            <PlanPreviewPanel
              v-model="previewTab"
              :current-plan-json="currentPlanJson"
              :is-chat-sending="isChatSending"
              :is-plan-json-synced="isPlanJsonSynced"
              :is-final-importing="isFinalImporting"
              :parsed-netdisk="parsedNetdisk"
              @back="importStep = 1"
              @import-plan="handleImportCoPlan"
            />
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
          <TraditionalImportPanel
            v-model:ai-prompt="aiPrompt"
            v-model:import-text="importText"
            :ai-import-enabled="systemStore.settings.AI_IMPORT_ENABLED"
            :is-ai-generating="isAiGenerating"
            :is-importing="isImporting"
            :is-help-open="isHelpOpen"
            @generate="handleAiGenerate"
            @copy-template="copyTemplate"
            @fill-demo-data="fillDemoData"
            @import-project="handleImportProject"
            @cancel="emit('update:visible', false)"
            @toggle-help="isHelpOpen = !isHelpOpen"
          />

          <!-- Right Panel: Format Reference Helper Documentation -->
          <Transition name="slide-fade">
            <FormatHelpPanel
              v-if="isHelpOpen"
              @close="isHelpOpen = false"
              @fill-demo-data="fillDemoData"
            />
          </Transition>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
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
