<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  Calendar,
  Plus,
  Users,
  MessageSquare,
  UserPlus,
  Send,
  KanbanSquare,
  AlignLeft,
  X,
  Image as ImageIcon,
  Paperclip,
  Smile,
  Search,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const projectId = computed(() => route.params.id as string);

const project = ref<any>(null);
const isLoading = ref(true);
const activeTab = ref('tasks'); // 'tasks', 'discussions', 'settings'

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleStartChat = async (user: any) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    router.push('/messages');
  } catch (error) {
    ElMessage.error('创建对话失败');
  }
};

// Discussions related
const newComment = ref('');
const isSendingComment = ref(false);
const chatScroll = ref<HTMLElement | null>(null);
const showEmojiPicker = ref(false);
const selectedImages = ref<File[]>([]);
const selectedFile = ref<File | null>(null);
const imagePreviewUrls = ref<string[]>([]);
const quickEmojis = ['👍', '❤️', '😂', '🚀', '🔥', '✅', '❌', '🎉', '💪', '👀'];

// Invite related
const showInviteDialog = ref(false);
const inviteUserIds = ref<string[]>([]);
const teamMembersForInvite = ref<any[]>([]);

// Tasks related
const isTaskDialogOpen = ref(false);
const taskForm = ref({
  title: '',
  description: '',
  assigneeId: '',
  dueDate: '',
  participantIds: [] as string[],
});
const isEditTaskDialogOpen = ref(false);
const editingTask = ref<any>(null);
const editTaskForm = ref({
  title: '',
  description: '',
  assigneeId: '',
  dueDate: '',
  status: '',
  participantIds: [] as string[],
});

// Kanban Drag & Drop State
const draggedTask = ref<any>(null);
const dragOverColumn = ref<string | null>(null);
const taskSearchQuery = ref('');
const taskDateFilter = ref('all'); // 'all', 'overdue', 'today', 'week'
const taskAssigneeFilter = ref('all'); // 'all', 'me'

const fetchProject = async () => {
  isLoading.value = true;
  try {
    const response = await api.get(`/api/projects/${projectId.value}`);
    project.value = response.data;
  } catch (error) {
    ElMessage.error('获取项目详情失败');
    router.push('/team-tasks');
  } finally {
    isLoading.value = false;
  }
};

const isMember = computed(() => {
  if (!project.value || !authStore.user) return false;
  return project.value.members.some((m: any) => m.userId === authStore.user?.id);
});

const handleJoin = async () => {
  try {
    await api.post(`/api/projects/${projectId.value}/join`);
    ElMessage.success('成功加入项目');
    fetchProject();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '加入失败');
  }
};

const handleSendComment = async () => {
  if (!newComment.value.trim() && selectedImages.value.length === 0 && !selectedFile.value) return;
  isSendingComment.value = true;
  try {
    const payload: any = {
      content: newComment.value || ' ',
      type: 'TEXT',
    };

    if (selectedImages.value.length > 0) {
      const imageUrls: string[] = [];
      for (const img of selectedImages.value) {
        const formData = new FormData();
        formData.append('file', img);
        try {
          const uploadRes = await api.post('/api/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          imageUrls.push(uploadRes.data.url);
        } catch {
          imageUrls.push(URL.createObjectURL(img));
        }
      }
      payload.images = JSON.stringify(imageUrls);
      payload.type = 'IMAGE';
      if (newComment.value.trim()) payload.type = 'TEXT';
    }

    if (selectedFile.value) {
      const formData = new FormData();
      formData.append('file', selectedFile.value);
      try {
        const uploadRes = await api.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        payload.fileUrl = uploadRes.data.url;
      } catch {
        payload.fileUrl = URL.createObjectURL(selectedFile.value);
      }
      payload.fileName = selectedFile.value.name;
      payload.fileSize = selectedFile.value.size / (1024 * 1024);
      if (payload.type === 'TEXT' && !newComment.value.trim()) payload.type = 'FILE';
    }

    const response = await api.post(`/api/projects/${projectId.value}/discussions`, payload);
    project.value.discussions.push(response.data);
    newComment.value = '';
    selectedImages.value = [];
    selectedFile.value = null;
    imagePreviewUrls.value = [];
    showEmojiPicker.value = false;
    setTimeout(() => {
      if (chatScroll.value) chatScroll.value.scrollTop = chatScroll.value.scrollHeight;
    }, 100);
  } catch (error) {
    ElMessage.error('发表留言失败');
  } finally {
    isSendingComment.value = false;
  }
};

const handleImageSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files) return;
  const files = Array.from(input.files);
  selectedImages.value.push(...files);
  files.forEach((f) => {
    imagePreviewUrls.value.push(URL.createObjectURL(f));
  });
  input.value = '';
};

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || !input.files[0]) return;
  selectedFile.value = input.files[0];
  input.value = '';
};

const removeImage = (index: number) => {
  selectedImages.value.splice(index, 1);
  imagePreviewUrls.value.splice(index, 1);
};

const removeFile = () => {
  selectedFile.value = null;
};

const insertEmoji = (emoji: string) => {
  newComment.value += emoji;
  showEmojiPicker.value = false;
};

const handleReaction = async (discussionId: string, emoji: string) => {
  try {
    await api.post(`/api/projects/discussions/${discussionId}/reactions`, { emoji });
    const msg = project.value.discussions.find((d: any) => d.id === discussionId);
    if (msg) {
      const existingIdx = msg.reactions?.findIndex(
        (r: any) => r.userId === authStore.user?.id && r.emoji === emoji,
      );
      if (existingIdx >= 0) {
        msg.reactions.splice(existingIdx, 1);
      } else {
        if (!msg.reactions) msg.reactions = [];
        msg.reactions.push({
          emoji,
          userId: authStore.user?.id,
          user: {
            id: authStore.user?.id,
            name: authStore.user?.name,
            avatarUrl: authStore.user?.avatarUrl,
          },
        });
      }
    }
  } catch {
    // silently fail
  }
};

const fetchTeamMembersForInvite = async () => {
  try {
    const currentProject = project.value;
    if (!currentProject?.teamId) return;
    const response = await api.get(`/api/teams/${currentProject.teamId}/members`);
    const allMembers = response.data?.map((m: any) => m.user) || [];
    const existingMemberIds = new Set(currentProject.members.map((m: any) => m.userId));
    teamMembersForInvite.value = allMembers.filter((m: any) => !existingMemberIds.has(m.id));
  } catch {
    // silently fail
  }
};

const handleInviteMembers = async () => {
  if (!inviteUserIds.value.length) return;
  try {
    await api.post(`/api/projects/${projectId.value}/invite`, { userIds: inviteUserIds.value });
    ElMessage.success(`已发送 ${inviteUserIds.value.length} 份邀请`);
    inviteUserIds.value = [];
    showInviteDialog.value = false;
    fetchProject();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '邀请失败');
  }
};

const parseImages = (images: string | null): string[] => {
  if (!images) return [];
  try {
    return JSON.parse(images);
  } catch {
    return [];
  }
};

const openImage = (url: string) => {
  window.open(url, '_blank');
};

const formatFileSize = (sizeMb: number | null): string => {
  if (!sizeMb) return '';
  if (sizeMb < 1) return `${Math.round(sizeMb * 1024)} KB`;
  return `${sizeMb.toFixed(1)} MB`;
};

const handleCreateTask = async () => {
  if (!taskForm.value.title) return;
  try {
    const payload = {
      ...taskForm.value,
      participantIds:
        taskForm.value.participantIds.length > 0 ? taskForm.value.participantIds : undefined,
    };
    const response = await api.post(`/api/projects/${projectId.value}/tasks`, payload);
    project.value.tasks.push(response.data);
    isTaskDialogOpen.value = false;
    taskForm.value = {
      title: '',
      description: '',
      assigneeId: '',
      dueDate: '',
      participantIds: [],
    };
    fetchProject();
    ElMessage.success('任务已分配');
  } catch (error) {
    ElMessage.error('分配任务失败');
  }
};

const openEditTaskDialog = (task: any) => {
  editingTask.value = task;
  editTaskForm.value = {
    title: task.title,
    description: task.description || '',
    assigneeId: task.assigneeId || '',
    dueDate: task.dueDate || '',
    status: task.status,
    participantIds: task.participants?.map((p: any) => p.userId) || [],
  };
  isEditTaskDialogOpen.value = true;
};

const handleUpdateTask = async () => {
  if (!editTaskForm.value.title) return;
  try {
    const response = await api.put(
      `/api/projects/tasks/${editingTask.value.id}`,
      editTaskForm.value,
    );
    const index = project.value.tasks.findIndex((t: any) => t.id === editingTask.value.id);
    if (index !== -1) {
      project.value.tasks[index] = response.data;
    }
    if (response.data._projectProgress !== undefined) {
      project.value.progress = response.data._projectProgress;
    }
    isEditTaskDialogOpen.value = false;
    ElMessage.success('任务已更新');
  } catch (error) {
    ElMessage.error('更新失败');
  }
};

const handleDeleteTask = async (task: any) => {
  try {
    await ElMessageBox.confirm('确定要删除这个任务吗？', '确认删除', { type: 'warning' });
    await api.delete(`/api/tasks/${task.id}`);
    project.value.tasks = project.value.tasks.filter((t: any) => t.id !== task.id);
    isEditTaskDialogOpen.value = false;
    fetchProject();
    ElMessage.success('任务已删除');
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('删除失败');
  }
};

const updateTaskStatus = async (task: any, newStatus: string) => {
  if (task.status === newStatus) return;
  const originalStatus = task.status;
  task.status = newStatus;
  try {
    const response = await api.put(`/api/projects/tasks/${task.id}`, {
      ...task,
      status: newStatus,
    });
    if (response.data._projectProgress !== undefined) {
      project.value.progress = response.data._projectProgress;
    }
  } catch (error) {
    task.status = originalStatus;
    ElMessage.error('更新状态失败');
  }
};

// Kanban Handlers
const onDragStart = (task: any, event: DragEvent) => {
  draggedTask.value = task;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.dropEffect = 'move';
    // This makes the drag ghost look a bit better
    event.dataTransfer.setData('text/plain', task.id);
  }
};

const onDragOver = (columnId: string, event: DragEvent) => {
  event.preventDefault(); // Necessary to allow dropping
  dragOverColumn.value = columnId;
};

const onDrop = (columnId: string, event: DragEvent) => {
  event.preventDefault();
  dragOverColumn.value = null;
  if (draggedTask.value && draggedTask.value.status !== columnId) {
    updateTaskStatus(draggedTask.value, columnId);
  }
  draggedTask.value = null;
};

const onDragEnd = () => {
  draggedTask.value = null;
  dragOverColumn.value = null;
};

const tasksByStatus = computed(() => {
  if (!project.value?.tasks) return { TODO: [], IN_PROGRESS: [], DONE: [] };

  let filtered = project.value.tasks;

  // Search Filter
  if (taskSearchQuery.value) {
    const q = taskSearchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (t: any) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
    );
  }

  // Date Filter
  if (taskDateFilter.value !== 'all') {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (taskDateFilter.value === 'overdue') {
      filtered = filtered.filter(
        (t: any) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE',
      );
    } else if (taskDateFilter.value === 'today') {
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (t: any) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= endOfDay,
      );
    } else if (taskDateFilter.value === 'week') {
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + 7);
      filtered = filtered.filter(
        (t: any) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= endOfWeek,
      );
    }
  }

  // Assignee Filter
  if (taskAssigneeFilter.value === 'me' && authStore.user) {
    filtered = filtered.filter((t: any) => t.assigneeId === authStore.user?.id);
  }

  return {
    TODO: filtered.filter((t: any) => t.status === 'TODO'),
    IN_PROGRESS: filtered.filter((t: any) => t.status === 'IN_PROGRESS'),
    DONE: filtered.filter((t: any) => t.status === 'DONE'),
  };
});

const getTagsList = (tags: string | null) => {
  if (!tags) return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t);
};

watch(
  () => route.params.id,
  (newId) => {
    if (newId) fetchProject();
  },
);

onMounted(fetchProject);
</script>

<template>
  <div class="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans relative">
    <!-- Global Loading -->
    <div
      v-if="isLoading"
      class="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center"
    >
      <div
        class="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin"
      ></div>
    </div>

    <template v-else-if="project">
      <!-- Left Sidebar (Project Meta) -->
      <aside
        class="w-96 bg-white dark:bg-slate-900 border-r flex flex-col shrink-0 transition-colors z-10 shadow-[5px_0_30px_rgba(0,0,0,0.02)]"
        style="border-color: var(--border-base)"
      >
        <!-- Back & Title -->
        <div class="p-8 pb-4">
          <button
            class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-accent hover:scale-110 transition-all mb-8"
            @click="router.push('/team-tasks')"
          >
            <ArrowLeft class="w-5 h-5" />
          </button>

          <div class="flex items-start gap-4 mb-4">
            <div
              class="w-14 h-14 rounded-[1rem] flex items-center justify-center text-white text-2xl font-black shadow-lg shrink-0"
              :class="project.color"
            >
              {{ project.title.substring(0, 1) }}
            </div>
            <div>
              <h1
                class="text-2xl font-black tracking-tight leading-tight mb-2"
                style="color: var(--text-primary)"
              >
                {{ project.title }}
              </h1>
              <div class="flex items-center gap-2">
                <span
                  class="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest"
                  :class="
                    project.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-accent/10 text-accent'
                  "
                >
                  {{
                    project.status === 'COMPLETED'
                      ? '已完成'
                      : project.status === 'IN_PROGRESS'
                        ? '进行中'
                        : project.status === 'PAUSED'
                          ? '已暂停'
                          : '规划中'
                  }}
                </span>
                <span
                  class="text-[10px] font-bold text-slate-400 border px-2 py-0.5 rounded-md"
                  style="border-color: var(--border-base)"
                >
                  {{ project.visibility === 'PUBLIC' ? '公开报名' : '私有项目' }}
                </span>
              </div>
            </div>
          </div>

          <p class="text-sm leading-relaxed text-slate-500 dark:text-slate-400 mb-6 line-clamp-3">
            {{ project.description || '暂无详细描述，伟大的想法正在酝酿中...' }}
          </p>

          <div class="flex flex-wrap gap-2 mb-8">
            <span
              v-for="tag in getTagsList(project.tags)"
              :key="tag"
              class="text-xs font-bold px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"
            >
              #{{ tag }}
            </span>
          </div>

          <!-- Progress -->
          <div
            class="space-y-3 mb-8 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border"
            style="border-color: var(--border-base)"
          >
            <div
              class="flex items-center justify-between text-[10px] font-black uppercase tracking-widest"
            >
              <span class="text-slate-500">总体完成度</span>
              <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'"
                >{{ project.progress }}%</span
              >
            </div>
            <div class="h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
              <div
                class="h-full rounded-full transition-all duration-1000"
                :class="project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
                :style="{ width: project.progress + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <div class="h-px bg-slate-100 dark:bg-slate-800 mx-8"></div>

        <!-- Members -->
        <div class="p-8 flex-1 overflow-y-auto scrollbar-hide">
          <div class="flex items-center justify-between mb-6">
            <h3
              class="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"
            >
              <Users class="w-4 h-4" /> 团队成员 ({{ project.members.length }}/{{
                project.maxMembers
              }})
            </h3>
            <div class="flex items-center gap-2">
              <button
                v-if="isMember"
                class="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                @click="
                  showInviteDialog = true;
                  fetchTeamMembersForInvite();
                "
              >
                <UserPlus class="w-3 h-3" /> 邀请
              </button>
              <button
                v-if="!isMember && project.members.length < project.maxMembers"
                class="text-xs font-bold text-accent hover:underline"
                @click="handleJoin"
              >
                报名加入
              </button>
            </div>
          </div>

          <div class="space-y-4">
            <div
              v-for="member in project.members"
              :key="member.id"
              class="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group cursor-pointer"
              @click="openUserProfile(member.user.id)"
            >
              <UserAvatar
                :user="member.user"
                size="md"
                class="group-hover:ring-2 group-hover:ring-accent transition-all"
              />
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-bold truncate group-hover:text-accent transition-colors"
                  style="color: var(--text-primary)"
                >
                  {{ member.user.name || member.user.email }}
                </p>
                <p class="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
                  {{ member.role }}
                </p>
              </div>
            </div>

            <!-- Empty Slots -->
            <div
              v-for="n in Math.max(0, project.maxMembers - project.members.length)"
              :key="`slot-${n}`"
              class="flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed opacity-50"
              style="border-color: var(--border-base)"
            >
              <div
                class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
              >
                <UserPlus class="w-4 h-4 text-slate-400" />
              </div>
              <span class="text-xs font-bold text-slate-400">虚位以待</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1 flex flex-col min-w-0 bg-transparent">
        <!-- Top Navigation -->
        <header
          class="h-20 px-10 flex items-center justify-between border-b bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shrink-0"
          style="border-color: var(--border-base)"
        >
          <!-- Segmented Control -->
          <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              v-for="tab in [
                { id: 'tasks', label: '敏捷看板', icon: KanbanSquare },
                { id: 'discussions', label: '协作空间', icon: MessageSquare },
              ]"
              :key="tab.id"
              class="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black transition-all"
              :class="
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              "
              @click="activeTab = tab.id"
            >
              <component :is="tab.icon" class="w-4 h-4" />
              {{ tab.label }}
            </button>
          </div>

          <div class="flex items-center gap-4">
            <div v-if="activeTab === 'tasks'" class="relative">
              <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="taskSearchQuery"
                type="text"
                placeholder="搜索任务..."
                class="pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-accent/20 w-48 transition-all"
              />
            </div>
            <button
              v-if="isMember && activeTab === 'tasks'"
              class="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              @click="isTaskDialogOpen = true"
            >
              <Plus class="w-4 h-4" /> 分配新任务
            </button>
          </div>
        </header>

        <!-- Project Kanban Filter Bar -->
        <div
          v-if="activeTab === 'tasks'"
          class="px-10 py-3 border-b flex items-center gap-6 overflow-x-auto scrollbar-hide shrink-0"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-center gap-2">
            <span
              class="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
              >截止时间:</span
            >
            <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                v-for="f in [
                  { id: 'all', label: '全部' },
                  { id: 'overdue', label: '已逾期' },
                  { id: 'today', label: '今日' },
                  { id: 'week', label: '本周' },
                ]"
                :key="f.id"
                class="px-3 py-1 rounded-md text-[10px] font-bold transition-all"
                :class="
                  taskDateFilter === f.id
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-500'
                "
                @click="taskDateFilter = f.id"
              >
                {{ f.label }}
              </button>
            </div>
          </div>

          <div class="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>

          <div class="flex items-center gap-2">
            <span
              class="text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
              >执行人:</span
            >
            <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                class="px-3 py-1 rounded-md text-[10px] font-bold transition-all"
                :class="
                  taskAssigneeFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-500'
                "
                @click="taskAssigneeFilter = 'all'"
              >
                全部人
              </button>
              <button
                class="px-3 py-1 rounded-md text-[10px] font-bold transition-all"
                :class="
                  taskAssigneeFilter === 'me'
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-500'
                "
                @click="taskAssigneeFilter = 'me'"
              >
                我的任务
              </button>
            </div>
          </div>
        </div>

        <!-- Dynamic Content -->
        <div class="flex-1 overflow-hidden relative">
          <!-- Kanban View -->
          <div v-show="activeTab === 'tasks'" class="absolute inset-0 p-8 overflow-x-auto">
            <div class="flex gap-8 h-full pb-4 items-start min-w-max">
              <!-- Columns -->
              <div
                v-for="col in [
                  {
                    id: 'TODO',
                    label: '待处理 (To Do)',
                    color: 'border-slate-300 dark:border-slate-600',
                    dot: 'bg-slate-400',
                  },
                  {
                    id: 'IN_PROGRESS',
                    label: '进行中 (In Progress)',
                    color: 'border-accent',
                    dot: 'bg-accent',
                  },
                  {
                    id: 'DONE',
                    label: '已交付 (Done)',
                    color: 'border-emerald-500',
                    dot: 'bg-emerald-500',
                  },
                ]"
                :key="col.id"
                class="w-[340px] flex flex-col h-full bg-slate-100/50 dark:bg-slate-800/30 rounded-[2rem] border-t-4 transition-colors"
                :class="[
                  col.color,
                  dragOverColumn === col.id
                    ? 'bg-slate-200/50 dark:bg-slate-700/50 scale-[1.02]'
                    : '',
                ]"
                @dragenter="onDragOver(col.id, $event)"
                @dragover="onDragOver(col.id, $event)"
                @drop="onDrop(col.id, $event)"
              >
                <!-- Column Header -->
                <div class="px-6 py-5 flex items-center justify-between shrink-0">
                  <div class="flex items-center gap-3">
                    <div class="w-2.5 h-2.5 rounded-full" :class="col.dot"></div>
                    <h3 class="text-sm font-black text-slate-700 dark:text-slate-200">
                      {{ col.label }}
                    </h3>
                  </div>
                  <span
                    class="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-xs font-bold text-slate-500 shadow-sm"
                    >{{ (tasksByStatus as any)[col.id].length }}</span
                  >
                </div>

                <!-- Column Body (Task List) -->
                <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-4 scrollbar-hide">
                  <div
                    v-for="task in (tasksByStatus as any)[col.id]"
                    :key="task.id"
                    draggable="true"
                    class="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border hover:shadow-xl hover:-translate-y-1 transition-all cursor-grab active:cursor-grabbing group"
                    style="border-color: var(--border-base)"
                    @dragstart="onDragStart(task, $event)"
                    @dragend="onDragEnd"
                    @click="openEditTaskDialog(task)"
                  >
                    <div class="flex items-start justify-between mb-3">
                      <h4
                        class="text-sm font-bold leading-snug group-hover:text-accent transition-colors"
                        style="color: var(--text-primary)"
                      >
                        {{ task.title }}
                      </h4>
                    </div>

                    <p class="text-xs text-slate-500 mb-5 line-clamp-2 leading-relaxed">
                      {{ task.description || '无详细描述' }}
                    </p>

                    <div class="flex items-center justify-between mt-auto">
                      <div class="flex items-center gap-2">
                        <div
                          v-if="task.assignee"
                          class="flex items-center gap-1.5 cursor-pointer group/as"
                          @click.stop="openUserProfile(task.assignee.id)"
                        >
                          <UserAvatar
                            :user="task.assignee"
                            size="xs"
                            class="group-hover/as:ring-2 group-hover/as:ring-accent transition-all"
                          />
                          <span
                            class="text-[10px] font-bold text-slate-400 group-hover/as:text-accent transition-colors"
                            >{{ task.assignee?.name || '未分配' }}</span
                          >
                        </div>
                        <div
                          v-else
                          class="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                        >
                          <UserPlus class="w-3 h-3 text-slate-400" />
                        </div>

                        <div
                          v-if="task.participants && task.participants.length > 0"
                          class="flex items-center -space-x-1.5 ml-1"
                        >
                          <UserAvatar
                            v-for="p in task.participants.slice(0, 3)"
                            :key="p.userId"
                            :user="p.user"
                            size="xs"
                            class="border-2 cursor-pointer hover:z-10 hover:scale-110 transition-all"
                            style="border-color: var(--bg-card)"
                            :title="p.user?.name"
                            @click.stop="openUserProfile(p.user.id)"
                          />
                          <span
                            v-if="task.participants.length > 3"
                            class="text-[9px] font-bold text-slate-400 ml-1"
                            >+{{ task.participants.length - 3 }}</span
                          >
                        </div>
                      </div>
                      <div
                        v-if="task.dueDate"
                        class="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800"
                        :class="
                          new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                            ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/20'
                            : 'text-slate-500'
                        "
                      >
                        <Calendar class="w-3 h-3" />
                        {{
                          new Date(task.dueDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })
                        }}
                      </div>
                    </div>
                  </div>

                  <!-- Empty Drop Zone Hint -->
                  <div
                    v-if="(tasksByStatus as any)[col.id].length === 0"
                    class="h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 text-xs font-bold opacity-50"
                  >
                    拖拽任务至此
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Discussions View -->
          <div
            v-show="activeTab === 'discussions'"
            class="absolute inset-0 flex flex-col bg-white dark:bg-slate-950"
          >
            <template v-if="isMember">
              <div ref="chatScroll" class="flex-1 overflow-y-auto p-10 space-y-8 scrollbar-hide">
                <div
                  v-for="msg in project.discussions"
                  :key="msg.id"
                  class="flex gap-4 max-w-3xl"
                  :class="msg.userId === authStore.user?.id ? 'ml-auto flex-row-reverse' : ''"
                >
                  <UserAvatar
                    :user="msg.user"
                    size="md"
                    class="cursor-pointer hover:ring-2 hover:ring-accent transition-all"
                    @click="openUserProfile(msg.user.id)"
                  />

                  <div
                    :class="msg.userId === authStore.user?.id ? 'items-end' : ''"
                    class="flex flex-col"
                  >
                    <div
                      class="flex items-center gap-3 mb-2"
                      :class="msg.userId === authStore.user?.id ? 'flex-row-reverse' : ''"
                    >
                      <span
                        class="text-xs font-black text-slate-700 dark:text-slate-300 cursor-pointer hover:text-accent transition-colors"
                        @click="openUserProfile(msg.user.id)"
                        >{{ msg.user.name || msg.user.email }}</span
                      >
                      <span class="text-[10px] font-bold text-slate-400">{{
                        new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }}</span>
                    </div>
                    <div
                      class="px-6 py-4 rounded-3xl text-sm leading-relaxed shadow-sm max-w-xl"
                      :class="
                        msg.userId === authStore.user?.id
                          ? 'bg-accent text-white rounded-tr-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                      "
                    >
                      {{ msg.content && msg.content !== ' ' ? msg.content : '' }}
                    </div>

                    <div
                      v-if="parseImages(msg.images).length > 0"
                      class="mt-2 flex flex-wrap gap-2 max-w-xl"
                    >
                      <img
                        v-for="(img, idx) in parseImages(msg.images)"
                        :key="idx"
                        :src="img"
                        class="max-w-[200px] max-h-[200px] rounded-2xl object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        @click="openImage(img)"
                      />
                    </div>

                    <div v-if="msg.fileUrl" class="mt-2 max-w-xl">
                      <a
                        :href="msg.fileUrl"
                        target="_blank"
                        class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border shadow-sm hover:shadow-md transition-all"
                        style="border-color: var(--border-base)"
                      >
                        <Paperclip class="w-5 h-5 text-accent shrink-0" />
                        <div class="min-w-0 flex-1">
                          <p class="text-sm font-bold truncate" style="color: var(--text-primary)">
                            {{ msg.fileName || '文件' }}
                          </p>
                          <p v-if="msg.fileSize" class="text-[10px] text-slate-400">
                            {{ formatFileSize(msg.fileSize) }}
                          </p>
                        </div>
                      </a>
                    </div>

                    <div class="flex items-center gap-1 mt-2 flex-wrap">
                      <button
                        v-for="emoji in quickEmojis.slice(0, 6)"
                        :key="emoji"
                        class="px-2 py-0.5 rounded-full text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                        :class="
                          msg.reactions?.some(
                            (r: any) => r.emoji === emoji && r.userId === authStore.user?.id,
                          )
                            ? 'bg-accent/10 ring-1 ring-accent/30'
                            : ''
                        "
                        @click="handleReaction(msg.id, emoji)"
                      >
                        {{ emoji }}
                        <span
                          v-if="msg.reactions?.filter((r: any) => r.emoji === emoji).length"
                          class="text-[10px] text-slate-400"
                          >{{ msg.reactions.filter((r: any) => r.emoji === emoji).length }}</span
                        >
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  v-if="project.discussions.length === 0"
                  class="h-full flex flex-col items-center justify-center text-slate-400 opacity-50"
                >
                  <MessageSquare class="w-16 h-16 mb-6" />
                  <p class="text-lg font-black">打个招呼吧，开启协作第一步</p>
                </div>
              </div>

              <!-- Input Area -->
              <div
                class="p-6 bg-white dark:bg-slate-950 border-t"
                style="border-color: var(--border-base)"
              >
                <!-- Image Preview -->
                <div v-if="imagePreviewUrls.length > 0" class="flex gap-2 mb-3 flex-wrap">
                  <div v-for="(url, idx) in imagePreviewUrls" :key="idx" class="relative group">
                    <img :src="url" class="w-20 h-20 rounded-xl object-cover" />
                    <button
                      class="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      @click="removeImage(idx)"
                    >
                      <X class="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <!-- File Preview -->
                <div
                  v-if="selectedFile"
                  class="flex items-center gap-3 mb-3 px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl"
                >
                  <Paperclip class="w-4 h-4 text-accent" />
                  <span
                    class="text-sm font-bold flex-1 truncate"
                    style="color: var(--text-primary)"
                    >{{ selectedFile.name }}</span
                  >
                  <span class="text-[10px] text-slate-400">{{
                    formatFileSize(selectedFile.size / (1024 * 1024))
                  }}</span>
                  <button
                    class="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-all"
                    @click="removeFile"
                  >
                    <X class="w-3 h-3 text-slate-400" />
                  </button>
                </div>
                <div class="max-w-4xl mx-auto relative">
                  <!-- Toolbar -->
                  <div class="flex items-center gap-1 mb-2 pl-2">
                    <label
                      class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all text-slate-400 hover:text-accent"
                    >
                      <ImageIcon class="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        class="hidden"
                        @change="handleImageSelect"
                      />
                    </label>
                    <label
                      class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all text-slate-400 hover:text-accent"
                    >
                      <Paperclip class="w-4 h-4" />
                      <input type="file" class="hidden" @change="handleFileSelect" />
                    </label>
                    <div class="relative">
                      <button
                        class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-400 hover:text-accent"
                        @click="showEmojiPicker = !showEmojiPicker"
                      >
                        <Smile class="w-4 h-4" />
                      </button>
                      <div
                        v-if="showEmojiPicker"
                        class="absolute bottom-full left-0 mb-2 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border flex flex-wrap gap-1 w-64"
                        style="border-color: var(--border-base)"
                      >
                        <button
                          v-for="emoji in quickEmojis"
                          :key="emoji"
                          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-lg transition-all"
                          @click="insertEmoji(emoji)"
                        >
                          {{ emoji }}
                        </button>
                      </div>
                    </div>
                  </div>
                  <textarea
                    v-model="newComment"
                    rows="1"
                    class="w-full pl-6 pr-16 py-4 bg-slate-100 dark:bg-slate-900 border-none rounded-full text-sm outline-none focus:ring-4 focus:ring-accent/20 transition-all resize-none overflow-hidden"
                    placeholder="输入消息，按 Enter 发送..."
                    style="color: var(--text-primary)"
                    @keydown.enter.prevent="handleSendComment"
                    @input="
                      (e) => {
                        (e.target as HTMLElement).style.height = 'auto';
                        (e.target as HTMLElement).style.height =
                          (e.target as HTMLElement).scrollHeight + 'px';
                      }
                    "
                  ></textarea>
                  <button
                    :disabled="
                      (!newComment.trim() && selectedImages.length === 0 && !selectedFile) ||
                      isSendingComment
                    "
                    class="absolute right-2 bottom-2 p-2 bg-accent text-white rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                    @click="handleSendComment"
                  >
                    <Send class="w-5 h-5" />
                  </button>
                </div>
              </div>
            </template>

            <div
              v-else
              class="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 dark:bg-slate-900/50"
            >
              <div
                class="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mb-8"
              >
                <AlignLeft class="w-10 h-10 text-slate-400" />
              </div>
              <h3 class="text-2xl font-black mb-3" style="color: var(--text-primary)">
                受保护的工作流
              </h3>
              <p class="text-sm text-slate-500 max-w-md mb-8 leading-relaxed">
                协作空间仅对项目正式成员开放。这里存放着最核心的讨论和进度档案。如果你想参与其中，请立即报名。
              </p>
              <button
                v-if="project.members.length < project.maxMembers"
                class="px-10 py-4 bg-accent text-white rounded-2xl font-black shadow-2xl shadow-accent/20 hover:scale-105 transition-all"
                @click="handleJoin"
              >
                立即报名加入
              </button>
            </div>
          </div>
        </div>
      </main>
    </template>

    <!-- Task Creation Drawer -->
    <el-drawer
      v-model="isTaskDialogOpen"
      title="分配新任务"
      size="400px"
      :show-close="false"
      class="custom-drawer"
    >
      <template #header="{ close }">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-black tracking-tight" style="color: var(--text-primary)">
            下达任务
          </h3>
          <button
            class="p-2 bg-slate-100 dark:bg-slate-800 hover:scale-110 rounded-full transition-all"
            @click="close"
          >
            <X class="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </template>

      <div class="space-y-6 p-2">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >任务名称</label
          >
          <input
            v-model="taskForm.title"
            type="text"
            class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
            style="border-color: var(--border-base); color: var(--text-primary)"
            placeholder="简明扼要..."
          />
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >执行标准 (描述)</label
          >
          <textarea
            v-model="taskForm.description"
            rows="4"
            class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all resize-none"
            style="border-color: var(--border-base); color: var(--text-primary)"
            placeholder="交付物包含哪些内容？"
          ></textarea>
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >委派给</label
          >
          <el-select
            v-model="taskForm.assigneeId"
            class="!w-full custom-select"
            placeholder="选择执行者"
            clearable
          >
            <el-option
              v-for="m in project?.members"
              :key="m.userId"
              :label="m.user.name || m.user.email"
              :value="m.userId"
            >
              <div class="flex items-center gap-3">
                <UserAvatar :user="m.user" size="xs" />
                <span class="font-bold">{{ m.user.name || m.user.email }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >参与人员</label
          >
          <el-select
            v-model="taskForm.participantIds"
            multiple
            placeholder="选择参与人员"
            class="!w-full custom-select"
          >
            <el-option
              v-for="m in project?.members"
              :key="m.userId"
              :label="m.user.name || m.user.email"
              :value="m.userId"
            >
              <div class="flex items-center gap-3">
                <UserAvatar :user="m.user" size="xs" />
                <span class="font-bold">{{ m.user.name || m.user.email }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >Deadline</label
          >
          <el-date-picker
            v-model="taskForm.dueDate"
            type="date"
            placeholder="最后期限"
            class="!w-full !rounded-2xl custom-date-picker"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex gap-4 p-4 border-t" style="border-color: var(--border-base)">
          <button
            class="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl font-black transition-all"
            style="color: var(--text-primary)"
            @click="isTaskDialogOpen = false"
          >
            取消
          </button>
          <button
            class="flex-[2] py-4 bg-accent text-white rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            @click="handleCreateTask"
          >
            确认下发
          </button>
        </div>
      </template>
    </el-drawer>

    <!-- Task Edit Drawer -->
    <el-drawer
      v-model="isEditTaskDialogOpen"
      title="修改任务详情"
      size="400px"
      :show-close="false"
      class="custom-drawer"
    >
      <template #header="{ close }">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-black tracking-tight" style="color: var(--text-primary)">
            编辑任务
          </h3>
          <button
            class="p-2 bg-slate-100 dark:bg-slate-800 hover:scale-110 rounded-full transition-all"
            @click="close"
          >
            <X class="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </template>

      <div class="space-y-6 p-2">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >任务名称</label
          >
          <input
            v-model="editTaskForm.title"
            type="text"
            class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
            style="border-color: var(--border-base); color: var(--text-primary)"
          />
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >任务描述</label
          >
          <textarea
            v-model="editTaskForm.description"
            rows="4"
            class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all resize-none"
            style="border-color: var(--border-base); color: var(--text-primary)"
          ></textarea>
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >当前状态</label
          >
          <el-select v-model="editTaskForm.status" class="!w-full custom-select">
            <el-option label="待处理" value="TODO" />
            <el-option label="进行中" value="IN_PROGRESS" />
            <el-option label="已完成" value="DONE" />
          </el-select>
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >委派给</label
          >
          <el-select
            v-model="editTaskForm.assigneeId"
            class="!w-full custom-select"
            placeholder="选择执行者"
            clearable
          >
            <el-option
              v-for="m in project?.members"
              :key="m.userId"
              :label="m.user.name || m.user.email"
              :value="m.userId"
            >
              <div class="flex items-center gap-3">
                <UserAvatar :user="m.user" size="xs" />
                <span class="font-bold">{{ m.user.name || m.user.email }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >参与人员</label
          >
          <el-select
            v-model="editTaskForm.participantIds"
            multiple
            placeholder="选择参与人员"
            class="!w-full custom-select"
          >
            <el-option
              v-for="m in project?.members"
              :key="m.userId"
              :label="m.user.name || m.user.email"
              :value="m.userId"
            >
              <div class="flex items-center gap-3">
                <UserAvatar :user="m.user" size="xs" />
                <span class="font-bold">{{ m.user.name || m.user.email }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >Deadline</label
          >
          <el-date-picker
            v-model="editTaskForm.dueDate"
            type="date"
            placeholder="最后期限"
            class="!w-full !rounded-2xl custom-date-picker"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex gap-4 p-4 border-t" style="border-color: var(--border-base)">
          <button
            class="flex-1 py-4 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-2xl font-black hover:bg-rose-100 transition-all"
            @click="handleDeleteTask(editingTask)"
          >
            删除任务
          </button>
          <button
            class="flex-[2] py-4 bg-accent text-white rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            @click="handleUpdateTask"
          >
            更新资料
          </button>
        </div>
      </template>
    </el-drawer>

    <!-- Invite Dialog -->
    <el-dialog
      v-model="showInviteDialog"
      title="邀请成员"
      width="440px"
      class="custom-dialog"
      :show-close="false"
    >
      <template #header="{ close }">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-black tracking-tight" style="color: var(--text-primary)">
            邀请加入项目
          </h3>
          <button
            class="p-2 bg-slate-100 dark:bg-slate-800 hover:scale-110 rounded-full transition-all"
            @click="close"
          >
            <X class="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </template>
      <div class="space-y-4">
        <div v-if="teamMembersForInvite.length === 0" class="text-center py-8 text-slate-400">
          <Users class="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p class="text-sm font-bold">团队中所有成员都已在此项目中</p>
        </div>
        <div v-else>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >选择要邀请的成员</label
          >
          <el-select
            v-model="inviteUserIds"
            multiple
            placeholder="选择成员"
            class="!w-full custom-select"
          >
            <el-option
              v-for="m in teamMembersForInvite"
              :key="m.id"
              :label="m.name || m.email"
              :value="m.id"
            >
              <div class="flex items-center gap-3">
                <UserAvatar :user="m" size="xs" />
                <span class="font-bold">{{ m.name || m.email }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-4">
          <button
            class="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl font-black transition-all"
            style="color: var(--text-primary)"
            @click="showInviteDialog = false"
          >
            取消
          </button>
          <button
            :disabled="inviteUserIds.length === 0"
            class="flex-[2] py-3 bg-accent text-white rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            @click="handleInviteMembers"
          >
            发送邀请
          </button>
        </div>
      </template>
    </el-dialog>

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleStartChat"
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
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Custom Overrides for Element Plus */
:deep(.custom-drawer) {
  background-color: var(--bg-card) !important;
  border-top-left-radius: 2rem !important;
  border-bottom-left-radius: 2rem !important;
  box-shadow: -20px 0 50px rgba(0, 0, 0, 0.1) !important;
}
:deep(.el-drawer__header) {
  margin-bottom: 0 !important;
  padding: 2rem !important;
  border-bottom: 1px solid var(--border-base);
}
:deep(.el-drawer__body) {
  padding: 2rem !important;
}
:deep(.el-drawer__footer) {
  padding: 0 !important;
}

.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  padding: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
}
.custom-select :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 52px;
}
</style>
