<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  Layers,
  Plus,
  Trash2,
  Users,
  X,
  Maximize2,
  Minimize2,
  FolderOpen,
  CheckCircle2,
  Flame,
  ArrowUp,
  Minus,
  ArrowDown,
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
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import type { Roadmap, RoadmapStep } from '@/types';
import { getApiErrorMessage } from '@/utils/error';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import UserAvatar from '@/components/UserAvatar.vue';
import Button from '@/components/ui/Button.vue';
import { getTaskDayIndex, getTaskTime } from '@/utils/taskSort';
import Dropdown from '@/components/ui/Dropdown.vue';

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const authStore = useAuthStore();
const router = useRouter();

const emit = defineEmits<{
  (e: 'refresh-list'): void;
}>();

interface ProjectUser {
  id: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
}

interface ProjectMember {
  id?: string;
  userId: string;
  role: string;
  user: ProjectUser;
}

interface ProjectTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assignee?: ProjectUser | null;
}

interface ProjectInvitation {
  id: string;
  invitee: ProjectUser;
  createdAt?: string;
}

interface ProjectDetail {
  id: string;
  teamId?: string;
  title: string;
  description?: string | null;
  visibility?: string;
  color?: string;
  dueDate?: string | null;
  progress: number;
  tasks: ProjectTask[];
  members: ProjectMember[];
  invitations?: ProjectInvitation[];
  roadmap?: Roadmap | null;
}

interface TeamMemberResponse {
  user: ProjectUser;
}

const isDetailDrawerOpen = ref(false);
const activeProjectId = ref<string | null>(null);
const projectDetail = ref<ProjectDetail | null>(null);
const isDetailLoading = ref(false);

const projectDetailViewMode = ref(localStorage.getItem('project_detail_view_mode') || 'drawer');

const toggleDetailViewMode = () => {
  projectDetailViewMode.value = projectDetailViewMode.value === 'drawer' ? 'modal' : 'drawer';
  localStorage.setItem('project_detail_view_mode', projectDetailViewMode.value);
};

// Batch task state
const isBatchDialogOpen = ref(false);
const batchTaskText = ref('');
const batchAssigneeId = ref('');
const batchPriority = ref('MEDIUM');
const batchDueDate = ref('');
const quickTaskTitle = ref('');

// Invite members state
const isDetailInviteDialogOpen = ref(false);
const detailInviteUserIds = ref<string[]>([]);
const teamMembers = ref<ProjectUser[]>([]);

const priorityOptions = computed(() => [
  {
    id: 'URGENT',
    label: t('tasks.urgent'),
    color: 'bg-red-500',
    textColor: 'text-red-500',
    icon: Flame,
  },
  {
    id: 'HIGH',
    label: t('tasks.high'),
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    icon: ArrowUp,
  },
  {
    id: 'MEDIUM',
    label: t('tasks.medium'),
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
    icon: Minus,
  },
  {
    id: 'LOW',
    label: t('tasks.low'),
    color: 'bg-slate-400',
    textColor: 'text-slate-400',
    icon: ArrowDown,
  },
]);

const fetchTeamMembers = async (teamId?: string) => {
  try {
    const tid = teamId || workspaceStore.activeTeamId;
    if (!tid) return;
    const response = await api.get(`/api/teams/${tid}/members`);
    teamMembers.value = ((response.data || []) as TeamMemberResponse[]).map((m) => m.user);
  } catch {
    // silently fail
  }
};

const isDetailMember = computed(() => {
  if (!projectDetail.value || !authStore.user) return false;
  return projectDetail.value.members.some((m) => m.userId === authStore.user?.id);
});

const isDetailOwner = computed(() => {
  if (!projectDetail.value || !authStore.user) return false;
  return projectDetail.value.members.some(
    (m) => m.userId === authStore.user?.id && m.role === 'OWNER',
  );
});

const availableMembersForDetailInvite = computed(() => {
  if (!projectDetail.value) return [];
  const existingUserIds = new Set(projectDetail.value.members.map((m) => m.userId));
  return teamMembers.value.filter((m) => !existingUserIds.has(m.id));
});

const parsedBatchTasks = computed(() => {
  if (!batchTaskText.value.trim()) return [];
  return batchTaskText.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
});

const sortedTasks = computed(() => {
  if (!projectDetail.value?.tasks) return [];

  return [...projectDetail.value.tasks].sort((a, b) => {
    const dayA = a && a.title ? getTaskDayIndex(a.title) : Infinity;
    const dayB = b && b.title ? getTaskDayIndex(b.title) : Infinity;
    if (dayA !== dayB) {
      return dayA - dayB;
    }
    return getTaskTime(a) - getTaskTime(b);
  });
});

// Project Description Edit, Preview & Clipboard Paste states
const isEditingProjectDescription = ref(false);
const tempProjectDescription = ref('');
const tempProjectDescriptionImages = ref<string[]>([]);
const isImagePreviewOpen = ref(false);
const previewImageUrl = ref('');

const openImageModal = (url: string) => {
  previewImageUrl.value = url;
  isImagePreviewOpen.value = true;
};

const startEditingProjectDescription = () => {
  const parsed = parseCommentContent(projectDetail.value?.description || '');
  tempProjectDescription.value = parsed.text;
  tempProjectDescriptionImages.value = [...parsed.images];
  isEditingProjectDescription.value = true;
};

const saveProjectDescription = async () => {
  if (!projectDetail.value?.id) return;
  try {
    let finalDesc = (tempProjectDescription.value || '').trim();
    if (tempProjectDescriptionImages.value.length > 0) {
      finalDesc +=
        (finalDesc ? '\n' : '') +
        tempProjectDescriptionImages.value.map((url) => `![图片](${url})`).join('\n');
    }

    await api.put(`/api/projects/${projectDetail.value.id}`, {
      description: finalDesc,
    });
    projectDetail.value.description = finalDesc;
    ElMessage.success('更新项目描述成功');
    isEditingProjectDescription.value = false;
    emit('refresh-list');
  } catch (error) {
    ElMessage.error('更新项目描述失败');
  }
};

const cancelEditingProjectDescription = () => {
  isEditingProjectDescription.value = false;
};

const parseCommentContent = (content: string) => {
  if (!content) return { text: '', images: [] };
  const regex = /!\[.*?\]\((.*?)\)/g;
  const images: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    images.push(match[1]);
  }
  const cleanText = content.replace(regex, '').trim();
  return {
    text: cleanText,
    images,
  };
};

const isImageUrl = (url: string): boolean => {
  const clean = url.trim();
  if (
    !clean.startsWith('http://') &&
    !clean.startsWith('https://') &&
    !clean.startsWith('data:image/')
  )
    return false;
  if (clean.startsWith('data:image/')) return true;

  try {
    const urlObj = new URL(clean);
    const pathname = urlObj.pathname.toLowerCase();
    const cleanUrl = clean.toLowerCase();

    if (
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.gif') ||
      pathname.endsWith('.webp') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.bmp') ||
      pathname.endsWith('.tiff') ||
      pathname.endsWith('.ico')
    ) {
      return true;
    }

    if (
      cleanUrl.includes('/uploads/') ||
      cleanUrl.includes('/image') ||
      cleanUrl.includes('/img/') ||
      cleanUrl.includes('/avatar') ||
      cleanUrl.includes('/photo') ||
      cleanUrl.includes('/pic/') ||
      cleanUrl.includes('placeholder')
    ) {
      return true;
    }

    const format = urlObj.searchParams.get('format') || urlObj.searchParams.get('fmt');
    if (format && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(format.toLowerCase())) {
      return true;
    }
  } catch (e) {
    const lower = clean.toLowerCase();
    return (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp')
    );
  }

  return false;
};

const handlePasteProjectDescription = async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  let hasImage = false;
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      hasImage = true;
      break;
    }
  }

  if (hasImage) {
    event.preventDefault();
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (!file) continue;

        const formData = new FormData();
        formData.append('task_image', file);
        try {
          ElMessage.info('图片上传中...');
          const response = await api.post('/api/tasks/upload-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const imageUrl = response.data.url;
          tempProjectDescriptionImages.value.push(imageUrl);
          ElMessage.success('图片上传成功');
        } catch (error) {
          ElMessage.error('图片上传失败');
        }
      }
    }
    return;
  }

  const pastedText = event.clipboardData.getData('text');
  if (pastedText && isImageUrl(pastedText)) {
    event.preventDefault();
    tempProjectDescriptionImages.value.push(pastedText.trim());
    ElMessage.success('图片链接已识别');
  }
};

const fetchProjectDetail = async (id: string) => {
  isDetailLoading.value = true;
  try {
    const response = await api.get(`/api/projects/${id}`);
    projectDetail.value = response.data;
    if (projectDetail.value && projectDetail.value.teamId) {
      await fetchTeamMembers(projectDetail.value.teamId);
    }
  } catch {
    ElMessage.error(t('projects.fetchFailed'));
  } finally {
    isDetailLoading.value = false;
  }
};

const open = async (projectId: string) => {
  activeProjectId.value = projectId;
  isDetailDrawerOpen.value = true;
  await fetchProjectDetail(projectId);
};

const handleUpdateTaskStatus = async (task: ProjectTask, newStatus: string) => {
  try {
    await api.put(`/api/tasks/${task.id}`, { status: newStatus });
    ElMessage.success(t('tasks.updateStatusSuccess'));
    if (activeProjectId.value) {
      await fetchProjectDetail(activeProjectId.value);
    }
    emit('refresh-list');
  } catch {
    ElMessage.error(t('tasks.updateStatusFailed'));
  }
};

const handleAssigneeChange = async (task: ProjectTask, assigneeId: string | null) => {
  try {
    await api.put(`/api/tasks/${task.id}`, { assigneeId });
    ElMessage.success(assigneeId ? t('tasks.assigneeAssigned') : t('tasks.assigneeCleared'));
    if (activeProjectId.value) {
      await fetchProjectDetail(activeProjectId.value);
    }
    emit('refresh-list');
  } catch {
    ElMessage.error(t('tasks.updateAssigneeFailed'));
  }
};

const handleDeleteTask = (taskId: string) => {
  ElMessageBox.confirm(t('tasks.deleteConfirm'), t('tasks.confirmDelete'), {
    type: 'warning',
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
  })
    .then(async () => {
      try {
        await api.delete(`/api/tasks/${taskId}`);
        ElMessage.success(t('tasks.deleteSuccess'));
        if (activeProjectId.value) {
          await fetchProjectDetail(activeProjectId.value);
        }
        emit('refresh-list');
      } catch {
        ElMessage.error(t('tasks.deleteFailed'));
      }
    })
    .catch(() => {});
};

const openInviteDetailDialog = () => {
  detailInviteUserIds.value = [];
  if (projectDetail.value) {
    fetchTeamMembers(projectDetail.value.teamId);
  }
  isDetailInviteDialogOpen.value = true;
};

const handleSendDetailInvite = async () => {
  if (!projectDetail.value || detailInviteUserIds.value.length === 0) return;
  try {
    await api.post(`/api/projects/${projectDetail.value.id}/invite`, {
      userIds: detailInviteUserIds.value,
    });
    ElMessage.success(t('projects.invitationSent', { count: detailInviteUserIds.value.length }));
    isDetailInviteDialogOpen.value = false;
    fetchProjectDetail(projectDetail.value.id);
  } catch {
    ElMessage.error(t('projects.sendInviteFailed'));
  }
};

const handleJoinProjectDetail = async () => {
  if (!projectDetail.value) return;
  try {
    await api.post(`/api/projects/${projectDetail.value.id}/join`);
    ElMessage.success(t('projects.joinSuccess'));
    fetchProjectDetail(projectDetail.value.id);
    emit('refresh-list');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('projects.joinFailed')));
  }
};

const handleQuickAddTask = async () => {
  if (!quickTaskTitle.value.trim() || !activeProjectId.value) return;
  try {
    await api.post(`/api/projects/${activeProjectId.value}/tasks`, {
      title: quickTaskTitle.value.trim(),
      teamId: workspaceStore.activeTeamId,
    });
    quickTaskTitle.value = '';
    ElMessage.success(t('tasks.addSuccess'));
    await fetchProjectDetail(activeProjectId.value);
    emit('refresh-list');
  } catch {
    ElMessage.error(t('tasks.addFailed'));
  }
};

const handleBatchCreateTasks = async () => {
  if (!batchTaskText.value.trim() || !activeProjectId.value) return;
  const lines = batchTaskText.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return;

  const payloadTasks = lines.map((title) => ({
    title,
    priority: batchPriority.value,
    dueDate: batchDueDate.value || null,
    assigneeId: batchAssigneeId.value || null,
  }));

  try {
    await api.post(`/api/projects/${activeProjectId.value}/tasks/batch`, { tasks: payloadTasks });
    ElMessage.success(t('tasks.batchCreateSuccess', { count: lines.length }));
    isBatchDialogOpen.value = false;
    batchTaskText.value = '';
    batchAssigneeId.value = '';
    batchDueDate.value = '';
    batchPriority.value = 'MEDIUM';
    await fetchProjectDetail(activeProjectId.value);
    emit('refresh-list');
  } catch {
    ElMessage.error(t('tasks.batchCreateFailed'));
  }
};

const navigateToTaskBoard = (projectId: string) => {
  router.push({ name: 'TaskBoard', query: { projectId } });
};

const activeLeftTab = ref<'tasks' | 'roadmap'>('tasks');
const myProgress = ref<{ roadmapStepId: string; completed: boolean }[]>([]);
const allCourses = ref<any[]>([]);
const activeStepId = ref<string | null>(null);

const fetchMyProgress = async () => {
  try {
    const response = await api.get('/api/roadmaps/my-progress');
    myProgress.value = response.data;
  } catch (e) {
    console.error('Failed to fetch progress:', e);
  }
};

const fetchAllCourses = async () => {
  try {
    const response = await api.get('/api/courses');
    allCourses.value = response.data;
  } catch (e) {
    console.error('Failed to fetch courses:', e);
  }
};

watch(
  () => projectDetail.value?.roadmap,
  (newRm) => {
    if (newRm && newRm.steps && newRm.steps.length > 0 && !activeStepId.value) {
      activeStepId.value = newRm.steps[0].id;
    }
  },
  { immediate: true },
);

const activeStep = computed(() => {
  if (!projectDetail.value?.roadmap?.steps || projectDetail.value.roadmap.steps.length === 0)
    return null;
  return (
    projectDetail.value.roadmap.steps.find((s) => s.id === activeStepId.value) ||
    projectDetail.value.roadmap.steps[0] ||
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
    ElMessage.success(!isCompleted ? t('projects.stepCompleted') : t('projects.stepReset'));
  } catch (_error) {
    ElMessage.error(t('projects.updateProgressFailed'));
  }
};

const calculateRoadmapProgress = (roadmap: Roadmap) => {
  if (!roadmap || !roadmap.steps || roadmap.steps.length === 0) return 0;
  const completedCount = roadmap.steps.filter((s) => isStepCompleted(s.id)).length;
  return Math.round((completedCount / roadmap.steps.length) * 100);
};

const isStepLocked = (_step: RoadmapStep, index: number) => {
  if (index === 0) return false;
  if (!projectDetail.value?.roadmap) return false;
  const prevStep = projectDetail.value.roadmap.steps[index - 1];
  return prevStep && !isStepCompleted(prevStep.id);
};

const getStepStatus = (step: RoadmapStep, index: number) => {
  if (isStepCompleted(step.id)) return 'completed';
  if (isStepLocked(step, index)) return 'locked';
  if (
    index === 0 ||
    (projectDetail.value?.roadmap &&
      isStepCompleted(projectDetail.value.roadmap.steps[index - 1]?.id))
  )
    return 'current';
  return 'upcoming';
};

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

const getSubTasksForStep = (step: RoadmapStep): { id: string; text: string }[] => {
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

watch(
  () => isDetailDrawerOpen.value,
  (open) => {
    if (open) {
      fetchMyProgress();
      fetchAllCourses();
      loadCheckedSubTasks();
    }
  },
);

defineExpose({
  open,
  fetchProjectDetail,
});
</script>

<template>
  <Transition :name="projectDetailViewMode === 'drawer' ? 'drawer-slide' : 'modal-fade'">
    <div
      v-if="isDetailDrawerOpen && projectDetail"
      class="fixed inset-0 z-50 flex transition-all duration-300"
      :class="
        projectDetailViewMode === 'drawer'
          ? 'justify-end'
          : 'items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm'
      "
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 cursor-pointer"
        :class="projectDetailViewMode === 'drawer' ? 'bg-black/40 backdrop-blur-sm' : ''"
        @click="isDetailDrawerOpen = false"
      ></div>

      <!-- Project Detail Panel Content Container -->
      <div
        class="project-detail-content relative shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
        :class="[
          projectDetailViewMode === 'drawer'
            ? 'w-full sm:w-[85%] md:w-[75%] lg:w-[65%] xl:w-[55%] h-full'
            : 'w-full max-w-4xl h-[90vh] md:h-[85vh] rounded-2xl border',
        ]"
        :style="{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-base)',
          borderLeftWidth: projectDetailViewMode === 'drawer' ? '1px' : '0px',
        }"
      >
        <!-- Header -->
        <div
          class="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base font-black shadow-md shrink-0"
              :class="projectDetail.color"
            >
              {{ projectDetail.title.substring(0, 1) }}
            </div>
            <div class="text-left">
              <h3 class="text-lg font-black tracking-tight" style="color: var(--text-primary)">
                {{ projectDetail.title }}
              </h3>
              <p class="text-[10px] font-bold text-slate-400">{{ t('projects.detailSubtitle') }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Join Project Button for non-members on PUBLIC projects -->
            <button
              v-if="!isDetailMember && projectDetail.visibility === 'PUBLIC'"
              type="button"
              class="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 border-none"
              @click="handleJoinProjectDetail"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>{{ t('projects.joinProject') }}</span>
            </button>

            <button
              type="button"
              class="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-none"
              @click="navigateToTaskBoard(projectDetail.id)"
            >
              <FolderOpen class="w-3.5 h-3.5" />
              <span>{{ t('projects.viewInBoard') }}</span>
            </button>

            <!-- View Mode Toggle (Drawer vs Modal) -->
            <button
              type="button"
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all text-slate-500 dark:text-slate-400 cursor-pointer bg-transparent border-none"
              :title="
                projectDetailViewMode === 'drawer'
                  ? t('projects.switchToModal')
                  : t('projects.switchToDrawer')
              "
              @click="toggleDetailViewMode"
            >
              <component
                :is="projectDetailViewMode === 'drawer' ? Maximize2 : Minimize2"
                class="w-4.5 h-4.5"
              />
            </button>

            <button
              type="button"
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer bg-transparent border-none"
              style="color: var(--text-secondary)"
              @click="isDetailDrawerOpen = false"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Content Body -->
        <div class="flex-1 overflow-y-auto p-4 md:p-5 scrollbar-hide">
          <div
            v-if="isDetailLoading"
            class="flex flex-col items-center justify-center py-20 opacity-50"
          >
            <div
              class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"
            ></div>
            <p class="text-xs font-bold text-slate-400">{{ t('projects.loadingDetails') }}</p>
          </div>

          <div
            v-else-if="projectDetail"
            class="space-y-6 md:space-y-0 md:grid md:grid-cols-3 md:gap-6 p-1"
          >
            <!-- Left Column: Tasks / Roadmap (col-span-2) -->
            <div class="md:col-span-2 space-y-4">
              <!-- Tab Header Switcher if project has roadmap -->
              <div
                v-if="projectDetail.roadmap"
                class="relative flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl max-w-xs text-left select-none overflow-hidden"
              >
                <!-- Sliding Pill Background -->
                <div
                  class="absolute top-0.5 bottom-0.5 bg-white dark:bg-slate-700 rounded-lg shadow-sm border border-slate-200/40 dark:border-slate-600/30 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-0 pointer-events-none"
                  :style="{
                    width: 'calc(50% - 2px)',
                    left: activeLeftTab === 'tasks' ? '2px' : 'calc(50%)',
                  }"
                ></div>

                <!-- Tab Buttons -->
                <button
                  type="button"
                  class="relative z-10 flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-colors duration-200 cursor-pointer border-none bg-transparent"
                  :class="
                    activeLeftTab === 'tasks'
                      ? 'text-accent'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  "
                  @click="activeLeftTab = 'tasks'"
                >
                  {{ t('projects.projectTasks') }}
                </button>
                <button
                  type="button"
                  class="relative z-10 flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition-colors duration-200 cursor-pointer border-none bg-transparent"
                  :class="
                    activeLeftTab === 'roadmap'
                      ? 'text-accent'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  "
                  @click="activeLeftTab = 'roadmap'"
                >
                  {{ t('projects.learningPath') }}
                </button>
              </div>

              <!-- Tasks Tab Content -->
              <div v-if="activeLeftTab === 'tasks'" class="space-y-4">
                <div class="flex items-center justify-between">
                  <h4
                    class="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"
                  >
                    <Layers class="w-4 h-4" /> {{ t('projects.projectTasks') }} ({{
                      sortedTasks.length
                    }})
                  </h4>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-sm"
                      @click="isBatchDialogOpen = true"
                    >
                      <Plus class="w-3 h-3" />
                      <span>{{ t('projects.batchAdd') }}</span>
                    </button>
                  </div>
                </div>

                <!-- Quick task title input -->
                <div class="relative flex items-center">
                  <input
                    v-model="quickTaskTitle"
                    type="text"
                    :placeholder="t('projects.quickTaskPlaceholder')"
                    class="w-full pl-4 pr-12 py-2 bg-slate-50 dark:bg-slate-800/30 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
                    style="border-color: var(--border-base); color: var(--text-primary)"
                    @keydown.enter="handleQuickAddTask"
                  />
                  <button
                    type="button"
                    class="absolute right-1.5 p-1.5 bg-accent text-white rounded-lg hover:scale-105 transition-all border-none cursor-pointer"
                    @click="handleQuickAddTask"
                  >
                    <Plus class="w-3 h-3 text-white" />
                  </button>
                </div>

                <!-- Tasks Table -->
                <div
                  v-if="sortedTasks.length === 0"
                  class="py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl opacity-40 animate-in fade-in"
                  style="border-color: var(--border-base)"
                >
                  <CheckCircle2 class="w-8 h-8 text-slate-300 mb-2" />
                  <p class="text-xs font-bold text-slate-400">{{ t('projects.noTasksLinked') }}</p>
                </div>
                <div
                  v-else
                  class="border rounded-xl overflow-hidden"
                  style="border-color: var(--border-base)"
                >
                  <table class="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr
                        class="bg-slate-50/50 dark:bg-slate-800/50 border-b"
                        style="border-color: var(--border-base)"
                      >
                        <th
                          class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px]"
                        >
                          {{ t('tasks.taskName') }}
                        </th>
                        <th
                          class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-36"
                        >
                          {{ t('tasks.assignee') }}
                        </th>
                        <th
                          class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-24"
                        >
                          {{ t('tasks.priority') }}
                        </th>
                        <th
                          class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-32"
                        >
                          {{ t('tasks.statusLabel') }}
                        </th>
                        <th
                          class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right w-16"
                        >
                          {{ t('common.actions') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="task in sortedTasks"
                        :key="task.id"
                        class="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                        style="border-color: var(--border-base)"
                      >
                        <td
                          class="px-3.5 py-2 font-bold truncate max-w-[200px]"
                          :title="task.title"
                          style="color: var(--text-primary)"
                        >
                          {{ task.title }}
                        </td>
                        <td class="px-3.5 py-2">
                          <Dropdown align="left" width-class="w-48">
                            <template #trigger>
                              <span
                                class="inline-flex items-center gap-1 cursor-pointer hover:text-accent rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors py-0.5 px-1.5"
                              >
                                <template v-if="task.assignee">
                                  <UserAvatar :user="task.assignee" size="xs" />
                                  <span
                                    class="font-bold text-slate-500 truncate max-w-[80px] text-[10px]"
                                    >{{ task.assignee.name || task.assignee.email }}</span
                                  >
                                </template>
                                <span v-else class="text-slate-400 text-[10px] font-bold">{{
                                  t('tasks.unassigned')
                                }}</span>
                              </span>
                            </template>
                            <template #content>
                              <button
                                type="button"
                                class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs text-rose-500 hover:bg-rose-500/10 border-none bg-transparent cursor-pointer transition-colors"
                                @click="handleAssigneeChange(task, null)"
                              >
                                {{ t('tasks.clearAssignee') }}
                              </button>
                              <div class="h-[1px] my-1 bg-slate-100 dark:bg-white/10"></div>
                              <button
                                v-for="m in teamMembers"
                                :key="m.id"
                                type="button"
                                class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors flex items-center gap-2"
                                @click="handleAssigneeChange(task, m.id)"
                              >
                                <img
                                  v-if="m.avatarUrl"
                                  alt=""
                                  :src="m.avatarUrl"
                                  class="w-5 h-5 rounded-lg object-cover"
                                />
                                <span>{{ m.name }}</span>
                              </button>
                            </template>
                          </Dropdown>
                        </td>
                        <td class="px-3.5 py-2">
                          <span
                            class="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider"
                            :class="
                              task.priority === 'URGENT'
                                ? 'bg-red-500/10 text-red-500'
                                : task.priority === 'HIGH'
                                  ? 'bg-orange-500/10 text-orange-500'
                                  : task.priority === 'MEDIUM'
                                    ? 'bg-amber-500/10 text-amber-500'
                                    : 'bg-slate-400/10 text-slate-500'
                            "
                          >
                            {{
                              task.priority === 'URGENT'
                                ? t('tasks.urgent')
                                : task.priority === 'HIGH'
                                  ? t('tasks.high')
                                  : task.priority === 'MEDIUM'
                                    ? t('tasks.medium')
                                    : t('tasks.low')
                            }}
                          </span>
                        </td>
                        <td class="px-3.5 py-2">
                          <el-select
                            v-model="task.status"
                            size="small"
                            class="!w-24 custom-select-small"
                            @change="(val: string) => handleUpdateTaskStatus(task, val)"
                          >
                            <el-option :label="t('tasks.todo')" value="TODO" />
                            <el-option :label="t('tasks.inProgress')" value="IN_PROGRESS" />
                            <el-option :label="t('tasks.done')" value="DONE" />
                          </el-select>
                        </td>
                        <td class="px-3.5 py-2 text-right">
                          <button
                            type="button"
                            class="p-1 hover:text-rose-500 text-slate-400 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer bg-transparent border-none"
                            @click="handleDeleteTask(task.id)"
                          >
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Roadmap View -->
              <div
                v-else-if="activeLeftTab === 'roadmap' && projectDetail.roadmap"
                class="space-y-6"
              >
                <!-- Roadmap Header card -->
                <div
                  class="p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md relative overflow-hidden"
                >
                  <div
                    class="absolute -right-10 -top-10 w-36 h-36 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl"
                  ></div>
                  <div
                    class="absolute -left-10 -bottom-10 w-36 h-36 bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl"
                  ></div>

                  <div
                    class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10"
                  >
                    <div class="space-y-1 min-w-0 text-left">
                      <div class="flex items-center gap-2">
                        <h2
                          class="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 truncate"
                        >
                          {{ projectDetail.roadmap.title }}
                        </h2>
                      </div>
                      <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {{ projectDetail.roadmap.description || t('projects.roadmapTip') }}
                      </p>
                    </div>

                    <!-- Progress -->
                    <div
                      class="flex items-center gap-2.5 shrink-0 self-start sm:self-center bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-1.5 px-2.5 rounded-xl"
                    >
                      <div class="flex flex-col items-end">
                        <span
                          class="text-[8px] font-black uppercase text-slate-400 tracking-wider"
                          >{{ t('projects.roadmapProgress') }}</span
                        >
                        <span class="text-xs font-black text-emerald-500"
                          >{{ calculateRoadmapProgress(projectDetail.roadmap) }}%</span
                        >
                      </div>
                      <div
                        class="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
                      >
                        <div
                          class="h-full bg-gradient-to-r from-accent to-emerald-500 rounded-full transition-all duration-700"
                          :style="{ width: calculateRoadmapProgress(projectDetail.roadmap) + '%' }"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Stacking timeline + companion vertically for drawer -->
                <div class="space-y-5">
                  <!-- Timeline -->
                  <div class="relative pl-[25px] sm:pl-10 space-y-3.5 py-1 text-left">
                    <div
                      class="absolute left-[11px] sm:left-[19px] top-5 bottom-5 w-0.5 rounded-full bg-slate-200 dark:bg-slate-800"
                    ></div>

                    <div
                      v-for="(step, index) in projectDetail.roadmap.steps"
                      :key="step.id"
                      class="relative cursor-pointer transition-all duration-300"
                      @click="activeStepId = step.id"
                    >
                      <!-- Progress glowing line -->
                      <div
                        v-if="
                          index < projectDetail.roadmap.steps.length - 1 && isStepCompleted(step.id)
                        "
                        class="absolute left-[-13px] sm:left-[-21px] top-5 bottom-[-18px] w-0.5 bg-emerald-500 z-0 opacity-80"
                      ></div>

                      <!-- Node icon -->
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

                      <!-- Card -->
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
                                  'bg-accent/10 text-accent':
                                    getStepStatus(step, index) === 'current',
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
                                'text-slate-400 dark:text-slate-500':
                                  getStepStatus(step, index) === 'locked',
                                'text-slate-800 dark:text-slate-100':
                                  getStepStatus(step, index) === 'upcoming',
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

                  <!-- Companion Companion Detail Box -->
                  <div
                    v-if="activeStep"
                    class="p-4 sm:p-5 rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md space-y-4 shadow-xl relative overflow-hidden text-left"
                  >
                    <div
                      class="absolute -right-12 -top-12 w-24 h-24 bg-accent/5 rounded-full blur-2xl"
                    ></div>

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
                          <h4
                            class="text-[8px] font-black text-slate-400 uppercase tracking-widest"
                          >
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
                            num: projectDetail.roadmap.steps.indexOf(activeStep) + 1,
                          })
                        }}
                      </span>
                    </div>

                    <!-- Title & Desc -->
                    <div class="space-y-1.5 relative z-10">
                      <h3
                        class="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight"
                      >
                        {{ activeStep.title }}
                      </h3>
                      <p
                        class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-white/[0.01] p-2.5 rounded-xl border border-slate-100 dark:border-slate-800"
                      >
                        {{ activeStep.description || t('projects.customStepTip') }}
                      </p>
                    </div>

                    <!-- Toggle Step Completion -->
                    <div class="pt-0.5 relative z-10">
                      <button
                        type="button"
                        class="w-full py-2 px-3 rounded-lg text-xs font-black text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md border-none"
                        :class="
                          isStepCompleted(activeStep.id)
                            ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10'
                            : 'bg-accent hover:bg-accent-dark shadow-accent/10'
                        "
                        @click="toggleStep(activeStep.id)"
                      >
                        <CheckCircle2 class="w-3.5 h-3.5" />
                        <span>{{
                          isStepCompleted(activeStep.id)
                            ? t('projects.stepCompletedReset')
                            : t('projects.stepCompleteTarget')
                        }}</span>
                      </button>
                    </div>

                    <!-- Attributes -->
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
                          <div
                            class="flex items-center justify-between text-[9px] text-slate-500 mb-0.5"
                          >
                            <span>{{ t('projects.skillDifficulty') }}</span>
                            <span class="font-bold text-slate-700 dark:text-slate-300">
                              {{
                                getMetricsForStep(
                                  activeStep,
                                  projectDetail.roadmap.steps.indexOf(activeStep),
                                ).difficulty
                              }}%
                            </span>
                          </div>
                          <div
                            class="h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden"
                          >
                            <div
                              class="h-full bg-rose-500 transition-all duration-500"
                              :style="{
                                width:
                                  getMetricsForStep(
                                    activeStep,
                                    projectDetail.roadmap.steps.indexOf(activeStep),
                                  ).difficulty + '%',
                              }"
                            ></div>
                          </div>
                        </div>

                        <div>
                          <div
                            class="flex items-center justify-between text-[9px] text-slate-500 mb-0.5"
                          >
                            <span>{{ t('projects.practicalWeight') }}</span>
                            <span class="font-bold text-slate-700 dark:text-slate-300">
                              {{
                                getMetricsForStep(
                                  activeStep,
                                  projectDetail.roadmap.steps.indexOf(activeStep),
                                ).practical
                              }}%
                            </span>
                          </div>
                          <div
                            class="h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden"
                          >
                            <div
                              class="h-full bg-purple-500 transition-all duration-500"
                              :style="{
                                width:
                                  getMetricsForStep(
                                    activeStep,
                                    projectDetail.roadmap.steps.indexOf(activeStep),
                                  ).practical + '%',
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
                            {{
                              getMetricsForStep(
                                activeStep,
                                projectDetail.roadmap.steps.indexOf(activeStep),
                              ).duration
                            }}
                            <span class="text-[9px] font-normal text-slate-400">{{
                              t('projects.hours')
                            }}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <!-- Checklist -->
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
                            <CheckCircle2
                              v-if="checkedSubTasks[subtask.id]"
                              class="w-2.5 h-2.5 text-white"
                            />
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

                    <!-- Courses -->
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
                          @click="router.push({ name: 'CourseDetail', params: { id: course.id } })"
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
                            <div
                              class="flex items-center justify-between text-[8px] text-slate-400"
                            >
                              <span
                                class="px-1 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-[8px]"
                              >
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
            </div>

            <!-- Right Column: Sidebar (col-span-1) -->
            <div class="space-y-4 md:space-y-5">
              <!-- Project Vision (Description) -->
              <div>
                <div class="flex items-center justify-between mb-1.5 ml-1">
                  <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {{ t('projects.projectVision') }}
                  </h4>
                  <button
                    v-if="!isEditingProjectDescription"
                    type="button"
                    class="text-[10px] font-bold text-accent hover:underline cursor-pointer"
                    @click="startEditingProjectDescription"
                  >
                    编辑描述
                  </button>
                </div>

                <!-- Edit Mode -->
                <div v-if="isEditingProjectDescription" class="space-y-2">
                  <textarea
                    v-model="tempProjectDescription"
                    placeholder="输入项目描述... (支持粘贴图片)"
                    rows="4"
                    class="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-accent/45 transition-all resize-y"
                    style="color: var(--text-primary)"
                    @paste="handlePasteProjectDescription"
                  ></textarea>

                  <!-- Image Previews during Editing -->
                  <div
                    v-if="tempProjectDescriptionImages.length > 0"
                    class="flex flex-wrap gap-1.5 p-1.5 bg-slate-50/50 dark:bg-white/2 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <div
                      v-for="(img, idx) in tempProjectDescriptionImages"
                      :key="img"
                      class="relative group w-12 h-12 rounded border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                      <img
                        :src="img"
                        class="w-full h-full object-cover cursor-zoom-in"
                        @click="openImageModal(img)"
                      />
                      <button
                        type="button"
                        class="absolute top-0.5 right-0.5 p-0.5 bg-black/55 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer flex items-center justify-center"
                        @click="tempProjectDescriptionImages.splice(idx, 1)"
                      >
                        <X class="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>

                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="px-2.5 py-1 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-lg hover:opacity-80 transition-all cursor-pointer"
                      @click="cancelEditingProjectDescription"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 bg-accent text-white text-[10px] font-bold rounded-lg hover:opacity-85 transition-all cursor-pointer"
                      @click="saveProjectDescription"
                    >
                      保存
                    </button>
                  </div>
                </div>

                <!-- Preview Mode -->
                <div
                  v-else
                  class="p-3 bg-slate-50 dark:bg-slate-800/20 rounded-xl border text-left cursor-pointer hover:bg-slate-100/30 dark:hover:bg-slate-800/30 transition-all"
                  style="border-color: var(--border-base)"
                  @click="startEditingProjectDescription"
                >
                  <div
                    v-if="!projectDetail.description"
                    class="text-xs text-slate-400 dark:text-slate-500 italic py-2 text-center select-none"
                  >
                    + 点击添加详细项目愿景...
                  </div>
                  <div
                    v-else
                    class="text-xs leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300 space-y-2"
                  >
                    <p>{{ parseCommentContent(projectDetail.description).text }}</p>
                    <div
                      v-if="parseCommentContent(projectDetail.description).images.length > 0"
                      class="flex flex-wrap gap-2 pt-1"
                    >
                      <img
                        v-for="img in parseCommentContent(projectDetail.description).images"
                        :key="img"
                        :src="img"
                        class="max-w-full max-h-[150px] rounded-lg border object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                        style="border-color: var(--border-base)"
                        @click.stop="openImageModal(img)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Project Meta (Deadline & Progress) -->
              <div class="grid grid-cols-2 gap-3">
                <div
                  class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border text-left"
                  style="border-color: var(--border-base)"
                >
                  <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    {{ t('tasks.dueDate') }}
                  </div>
                  <span class="text-xs font-bold" style="color: var(--text-primary)">
                    {{
                      projectDetail.dueDate
                        ? new Date(projectDetail.dueDate).toLocaleDateString()
                        : t('common.notSet')
                    }}
                  </span>
                </div>
                <div
                  class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border text-left"
                  style="border-color: var(--border-base)"
                >
                  <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    {{ t('projects.projectProgress') }}
                  </div>
                  <div class="flex items-center gap-2">
                    <div
                      class="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700"
                    >
                      <div
                        class="h-full rounded-full bg-accent transition-all duration-500"
                        :style="{ width: projectDetail.progress + '%' }"
                      ></div>
                    </div>
                    <span class="text-[10px] font-black text-accent"
                      >{{ projectDetail.progress }}%</span
                    >
                  </div>
                </div>
              </div>

              <!-- Members Section -->
              <div class="space-y-2.5">
                <div class="flex items-center justify-between">
                  <h4
                    class="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"
                  >
                    <Users class="w-3.5 h-3.5" /> {{ t('projects.members') }} ({{
                      projectDetail.members.length
                    }})
                  </h4>
                  <button
                    v-if="isDetailOwner"
                    type="button"
                    class="px-2 py-0.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[10px] font-bold transition-all flex items-center gap-0.5 cursor-pointer border-none"
                    @click="openInviteDetailDialog"
                  >
                    <Plus class="w-2.5 h-2.5" />
                    <span>{{ t('projects.invite') }}</span>
                  </button>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <div
                    v-for="m in projectDetail.members"
                    :key="m.userId"
                    class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
                  >
                    <UserAvatar :user="m.user" size="xs" />
                    <span class="text-[11px] font-bold" style="color: var(--text-primary)">{{
                      m.user.name || m.user.email
                    }}</span>
                    <span
                      class="text-[7px] px-1 py-0.1 bg-slate-200 dark:bg-slate-700 text-slate-400 rounded uppercase font-black tracking-wider"
                      >{{ m.role }}</span
                    >
                  </div>
                </div>

                <!-- Pending Invitations -->
                <div
                  v-if="projectDetail.invitations && projectDetail.invitations.length > 0"
                  class="pt-1.5 space-y-1.5 text-left"
                >
                  <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {{ t('projects.sentInvitationsPending') }}
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <div
                      v-for="inv in projectDetail.invitations"
                      :key="inv.id"
                      class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/40 border border-dashed rounded-lg"
                      style="border-color: var(--border-base)"
                    >
                      <UserAvatar :user="inv.invitee" size="xs" />
                      <span class="text-[11px] font-bold text-slate-400">{{
                        inv.invitee.name || inv.invitee.email
                      }}</span>
                      <span
                        class="text-[7px] px-1 py-0.1 bg-amber-500/10 text-amber-500 rounded uppercase font-black tracking-wider"
                        >PENDING</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Batch Create Tasks Dialog -->
  <Transition name="fade">
    <div
      v-if="isBatchDialogOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
    >
      <div
        class="absolute inset-0 bg-black/40 backdrop-blur-sm"
        @click="isBatchDialogOpen = false"
      ></div>
      <div
        class="relative w-full max-w-lg p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl space-y-4 sm:space-y-5 max-h-[90vh] overflow-y-auto"
        style="background-color: var(--bg-card)"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-lg sm:text-xl font-bold" style="color: var(--text-primary)">
            {{ t('projects.batchAddTask') }}
          </h3>
          <button
            type="button"
            class="bg-transparent border-none cursor-pointer"
            style="color: var(--text-secondary)"
            @click="isBatchDialogOpen = false"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="space-y-4 text-left">
          <div>
            <label
              class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
              >{{ t('projects.batchTaskTitleList') }}</label
            >
            <textarea
              v-model="batchTaskText"
              rows="6"
              class="w-full px-4 py-2.5 sm:py-3 bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none leading-relaxed"
              style="color: var(--text-primary)"
              :placeholder="t('projects.batchTaskPlaceholder')"
            ></textarea>
          </div>

          <!-- Tasks Preview -->
          <div v-if="parsedBatchTasks.length > 0" class="space-y-1.5 sm:space-y-2">
            <label class="block text-[10px] sm:text-xs font-bold uppercase text-slate-400 ml-1">{{
              t('projects.batchTaskPreview', { count: parsedBatchTasks.length })
            }}</label>
            <div
              class="max-h-24 overflow-y-auto border rounded-xl p-2.5 space-y-1 bg-slate-50 dark:bg-slate-800/10 scrollbar-hide"
              style="border-color: var(--border-base)"
            >
              <div
                v-for="(tTask, index) in parsedBatchTasks"
                :key="index"
                class="flex items-center justify-between text-[11px] font-bold py-0.5 border-b last:border-0"
                style="border-color: var(--border-base)"
              >
                <span class="truncate flex-1 pr-4" style="color: var(--text-primary)">
                  {{ index + 1 }}. {{ tTask }}
                </span>
                <span
                  class="px-1 py-0.2 bg-accent/10 text-accent rounded text-[7px] uppercase font-black tracking-wider shrink-0"
                  >{{ t('projects.toBeCreated') }}</span
                >
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label
                class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                >{{ t('projects.batchAssignee') }}</label
              >
              <el-select
                v-model="batchAssigneeId"
                clearable
                :placeholder="t('projects.selectAssignee')"
                class="!w-full custom-select"
              >
                <el-option
                  v-for="m in teamMembers"
                  :key="m.id"
                  :label="m.name || m.email"
                  :value="m.id"
                >
                  <div class="flex items-center gap-2">
                    <UserAvatar :user="m" size="sm" />
                    <span class="text-xs sm:text-sm">{{ m.name || m.email }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>
            <div>
              <label
                class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                >{{ t('projects.batchPriority') }}</label
              >
              <el-select v-model="batchPriority" class="!w-full custom-select">
                <el-option v-for="p in priorityOptions" :key="p.id" :label="p.label" :value="p.id">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full" :class="p.color"></div>
                    <span class="text-xs sm:text-sm font-bold">{{ p.label }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>
          </div>

          <div>
            <label
              class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
              >{{ t('projects.batchDueDate') }}</label
            >
            <el-date-picker
              v-model="batchDueDate"
              type="date"
              :placeholder="t('tasks.dueDate')"
              class="!w-full !rounded-2xl custom-date-picker"
              popper-class="custom-date-popper"
            />
          </div>
        </div>
        <button
          type="button"
          class="w-full py-3.5 bg-accent text-white rounded-xl sm:rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm border-none cursor-pointer"
          @click="handleBatchCreateTasks"
        >
          {{ t('projects.batchCreateButton') }}
        </button>
      </div>
    </div>
  </Transition>

  <!-- Invite Project Members Dialog -->
  <Transition name="fade">
    <div
      v-if="isDetailInviteDialogOpen"
      class="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
    >
      <div
        class="absolute inset-0 bg-black/40 backdrop-blur-sm"
        @click="isDetailInviteDialogOpen = false"
      ></div>
      <div
        class="relative w-full max-w-md p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl space-y-4 sm:space-y-5"
        style="background-color: var(--bg-card)"
      >
        <div class="flex items-center justify-between">
          <h3 class="text-lg sm:text-xl font-bold" style="color: var(--text-primary)">
            {{ t('projects.inviteMembersTitle') }}
          </h3>
          <button
            type="button"
            class="bg-transparent border-none cursor-pointer"
            style="color: var(--text-secondary)"
            @click="isDetailInviteDialogOpen = false"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="space-y-4 text-left">
          <div v-if="availableMembersForDetailInvite.length > 0">
            <label
              class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
              >{{ t('projects.selectTeamMembers') }}</label
            >
            <el-select
              v-model="detailInviteUserIds"
              multiple
              :placeholder="t('projects.selectMember')"
              class="!w-full custom-select"
            >
              <el-option
                v-for="m in availableMembersForDetailInvite"
                :key="m.id"
                :label="m.name || m.email"
                :value="m.id"
              >
                <div class="flex items-center gap-3">
                  <UserAvatar :user="m" size="sm" />
                  <span class="font-bold text-xs sm:text-sm">{{ m.name || m.email }}</span>
                </div>
              </el-option>
            </el-select>
          </div>
          <div v-else class="text-center py-6 text-slate-400 text-xs font-bold">
            {{ t('projects.noOtherMembersToInvite') }}
          </div>
        </div>

        <div class="flex justify-end gap-2.5 sm:gap-3 pt-2">
          <Button
            variant="secondary"
            class="text-xs sm:text-sm"
            @click="isDetailInviteDialogOpen = false"
          >
            {{ t('common.cancel') }}
          </Button>
          <Button
            variant="primary"
            class="text-xs sm:text-sm"
            :disabled="detailInviteUserIds.length === 0"
            @click="handleSendDetailInvite"
          >
            {{ t('projects.sendInvite') }}
          </Button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Image Preview Dialog -->
  <el-dialog
    v-model="isImagePreviewOpen"
    :show-close="true"
    align-center
    width="fit-content"
    style="background: transparent; box-shadow: none"
  >
    <img
      v-if="previewImageUrl"
      :src="previewImageUrl"
      class="max-w-[85vw] max-h-[80vh] rounded-xl object-contain border"
      style="border-color: var(--border-base)"
    />
  </el-dialog>
</template>

<style scoped>
.custom-select :deep(.el-select__wrapper),
.custom-select :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  background-color: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  transition: all 0.2s ease !important;
}
.dark .custom-select :deep(.el-select__wrapper),
.dark .custom-select :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.custom-select :deep(.el-select__wrapper.is-focused),
.custom-select :deep(.el-input__wrapper.is-focus) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.15) !important;
}

.custom-select-small :deep(.el-select__wrapper),
.custom-select-small :deep(.el-input__wrapper) {
  border-radius: 0.5rem !important;
  background-color: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(6px) !important;
  -webkit-backdrop-filter: blur(6px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  transition: all 0.2s ease !important;
  height: 28px !important;
}
.dark .custom-select-small :deep(.el-select__wrapper),
.dark .custom-select-small :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.custom-select-small :deep(.el-select__wrapper.is-focused),
.custom-select-small :deep(.el-input__wrapper.is-focus) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 8px rgba(var(--accent-rgb), 0.15) !important;
}

.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  background-color: rgba(255, 255, 255, 0.3) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
  box-shadow: none !important;
  transition: all 0.2s ease !important;
  height: 38px !important;
}
.dark .custom-date-picker :deep(.el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.04) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
}
.custom-date-picker :deep(.el-input__wrapper.is-focus) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.15) !important;
}
</style>
