<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import type { Course } from '@/types';
import { getApiErrorMessage, logError } from '@/utils/error';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/ui/Modal.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import { getTaskDayIndex, getTaskTime } from '@/utils/taskSort';
import ProjectDetailHeader from './project-detail/ProjectDetailHeader.vue';
import ProjectDetailSkeleton from './project-detail/ProjectDetailSkeleton.vue';
import ProjectDetailTaskPanel from './project-detail/ProjectDetailTaskPanel.vue';
import ProjectDetailRoadmapPanel from './project-detail/ProjectDetailRoadmapPanel.vue';
import ProjectDetailDescription from './project-detail/ProjectDetailDescription.vue';
import ProjectMetaCard from './project-detail/ProjectMetaCard.vue';
import ProjectMembersPanel from './project-detail/ProjectMembersPanel.vue';
import BatchCreateTasksDialog from './project-detail/BatchCreateTasksDialog.vue';
import InviteMembersDialog from '@/components/InviteMembersDialog.vue';
import ImagePreviewDialog from './project-detail/ImagePreviewDialog.vue';
import type {
  ProjectUser,
  ProjectDetail,
  ProjectTask,
  BatchTaskPayload,
} from './project-detail/types';

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const authStore = useAuthStore();
const router = useRouter();

const emit = defineEmits<{
  (e: 'refresh-list'): void;
}>();

interface TeamMemberResponse {
  user: ProjectUser;
}

const isDetailDrawerOpen = ref(false);
const activeProjectId = ref<string | null>(null);
const projectDetail = ref<ProjectDetail | null>(null);
const isDetailLoading = ref(false);

const isBatchDialogOpen = ref(false);

const isDetailInviteDialogOpen = ref(false);
const teamMembers = ref<ProjectUser[]>([]);

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
  } catch {
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
  } catch {
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
        } catch {
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
  if (projectDetail.value) {
    fetchTeamMembers(projectDetail.value.teamId);
  }
  isDetailInviteDialogOpen.value = true;
};

const handleSendDetailInvite = async (userIds: string[]) => {
  if (!projectDetail.value || userIds.length === 0) return;
  try {
    await api.post(`/api/projects/${projectDetail.value.id}/invite`, {
      userIds,
    });
    ElMessage.success(t('projects.invitationSent', { count: userIds.length }));
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

const handleQuickAddTask = async (title: string) => {
  if (!title.trim() || !activeProjectId.value) return;
  try {
    await api.post(`/api/projects/${activeProjectId.value}/tasks`, {
      title: title.trim(),
      teamId: workspaceStore.activeTeamId,
    });
    ElMessage.success(t('tasks.addSuccess'));
    await fetchProjectDetail(activeProjectId.value);
    emit('refresh-list');
  } catch {
    ElMessage.error(t('tasks.addFailed'));
  }
};

const handleBatchCreateTasks = async (payload: { tasks: BatchTaskPayload[] }) => {
  if (!activeProjectId.value || payload.tasks.length === 0) return;

  try {
    await api.post(`/api/projects/${activeProjectId.value}/tasks/batch`, {
      tasks: payload.tasks,
    });
    ElMessage.success(t('tasks.batchCreateSuccess', { count: payload.tasks.length }));
    isBatchDialogOpen.value = false;
    await fetchProjectDetail(activeProjectId.value);
    emit('refresh-list');
  } catch {
    ElMessage.error(t('tasks.batchCreateFailed'));
  }
};

const navigateToTaskBoard = (projectId: string) => {
  router.push({ name: 'TaskBoard', query: { projectId } });
};

const navigateToCourse = (courseId: string) => {
  router.push({ name: 'CourseDetail', params: { id: courseId } });
};

const activeLeftTab = ref<'tasks' | 'roadmap'>('tasks');
const myProgress = ref<{ roadmapStepId: string; completed: boolean }[]>([]);
const allCourses = ref<Course[]>([]);
const activeStepId = ref<string | null>(null);

const fetchMyProgress = async () => {
  try {
    const response = await api.get('/api/roadmaps/my-progress');
    myProgress.value = response.data;
  } catch (e) {
    logError(e, { operation: 'fetchMyProgress', component: 'ProjectDetailPanel' });
  }
};

const fetchAllCourses = async () => {
  try {
    const response = await api.get('/api/courses');
    allCourses.value = response.data;
  } catch (e) {
    logError(e, { operation: 'fetchAllCourses', component: 'ProjectDetailPanel' });
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

const toggleStep = async (stepId: string) => {
  const isCompleted = myProgress.value.some((p) => p.roadmapStepId === stepId && p.completed);
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
  } catch {
    ElMessage.error(t('projects.updateProgressFailed'));
  }
};

watch(
  () => isDetailDrawerOpen.value,
  (open) => {
    if (open) {
      fetchMyProgress();
      fetchAllCourses();
    }
  },
);

defineExpose({
  open,
  fetchProjectDetail,
});
</script>

<template>
  <Modal
    :show="isDetailDrawerOpen && !!projectDetail"
    size="xxl"
    padding="none"
    @close="isDetailDrawerOpen = false"
  >
    <template #header>
      <ProjectDetailHeader
        v-if="projectDetail"
        :project="projectDetail"
        :is-member="isDetailMember"
        @join-project="handleJoinProjectDetail"
        @view-in-board="navigateToTaskBoard"
      />
    </template>

    <div
      v-if="projectDetail"
      class="mobile-adaptive overflow-y-auto p-4 md:p-5 pb-8 scrollbar-hide max-h-[82vh] text-left"
    >
      <ProjectDetailSkeleton v-if="isDetailLoading" />

      <div
        v-else-if="projectDetail"
        class="space-y-6 md:space-y-0 md:grid md:grid-cols-3 md:gap-6 p-1"
      >
        <div class="md:col-span-2 space-y-4">
          <SegmentedControl
            v-if="projectDetail.roadmap"
            v-model="activeLeftTab"
            :options="[
              { value: 'tasks', label: t('projects.projectTasks') },
              { value: 'roadmap', label: t('projects.learningPath') },
            ]"
            size="sm"
            class="max-w-xs"
          />

          <ProjectDetailTaskPanel
            v-if="activeLeftTab === 'tasks'"
            :tasks="sortedTasks"
            :team-members="teamMembers"
            @quick-add="handleQuickAddTask"
            @batch-open="isBatchDialogOpen = true"
            @update-status="handleUpdateTaskStatus"
            @change-assignee="handleAssigneeChange"
            @delete-task="handleDeleteTask"
          />

          <ProjectDetailRoadmapPanel
            v-else-if="activeLeftTab === 'roadmap' && projectDetail.roadmap"
            :roadmap="projectDetail.roadmap"
            :active-step-id="activeStepId"
            :my-progress="myProgress"
            :all-courses="allCourses"
            @update:active-step-id="activeStepId = $event"
            @toggle-step="toggleStep"
            @navigate-to-course="navigateToCourse"
          />
        </div>

        <div class="space-y-4 md:space-y-5">
          <ProjectDetailDescription
            :description="projectDetail.description"
            :is-editing="isEditingProjectDescription"
            :temp-text="tempProjectDescription"
            :temp-images="tempProjectDescriptionImages"
            @start-edit="startEditingProjectDescription"
            @save="saveProjectDescription"
            @cancel="cancelEditingProjectDescription"
            @update:temp-text="tempProjectDescription = $event"
            @update:temp-images="tempProjectDescriptionImages = $event"
            @paste="handlePasteProjectDescription"
            @open-image="openImageModal"
          />

          <ProjectMetaCard :due-date="projectDetail.dueDate" :progress="projectDetail.progress" />

          <ProjectMembersPanel
            :members="projectDetail.members"
            :invitations="projectDetail.invitations"
            :is-owner="isDetailOwner"
            @invite="openInviteDetailDialog"
          />
        </div>
      </div>
    </div>
  </Modal>

  <BatchCreateTasksDialog
    v-model:show="isBatchDialogOpen"
    :team-members="teamMembers"
    @submit="handleBatchCreateTasks"
  />

  <InviteMembersDialog
    v-model:visible="isDetailInviteDialogOpen"
    :users="availableMembersForDetailInvite"
    @submit="handleSendDetailInvite"
  />

  <ImagePreviewDialog v-model:show="isImagePreviewOpen" :image-url="previewImageUrl" />
</template>
