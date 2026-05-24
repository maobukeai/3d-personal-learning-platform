<script setup lang="ts">
import { ref, computed } from 'vue';
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
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import UserAvatar from '@/components/UserAvatar.vue';

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

const priorityOptions = [
  { id: 'URGENT', label: '紧急', color: 'bg-red-500', textColor: 'text-red-500', icon: Flame },
  { id: 'HIGH', label: '高', color: 'bg-orange-500', textColor: 'text-orange-500', icon: ArrowUp },
  { id: 'MEDIUM', label: '中', color: 'bg-amber-500', textColor: 'text-amber-500', icon: Minus },
  { id: 'LOW', label: '低', color: 'bg-slate-400', textColor: 'text-slate-400', icon: ArrowDown },
];

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

const fetchProjectDetail = async (id: string) => {
  isDetailLoading.value = true;
  try {
    const response = await api.get(`/api/projects/${id}`);
    projectDetail.value = response.data;
    if (projectDetail.value && projectDetail.value.teamId) {
      await fetchTeamMembers(projectDetail.value.teamId);
    }
  } catch {
    ElMessage.error('获取项目详情失败');
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
    ElMessage.success('任务状态已更新');
    if (activeProjectId.value) {
      await fetchProjectDetail(activeProjectId.value);
    }
    emit('refresh-list');
  } catch {
    ElMessage.error('更新任务状态失败');
  }
};

const handleDeleteTask = (taskId: string) => {
  ElMessageBox.confirm('确定要删除这个任务吗？', '确认删除', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
    .then(async () => {
      try {
        await api.delete(`/api/tasks/${taskId}`);
        ElMessage.success('任务已删除');
        if (activeProjectId.value) {
          await fetchProjectDetail(activeProjectId.value);
        }
        emit('refresh-list');
      } catch {
        ElMessage.error('删除任务失败');
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
    ElMessage.success(`已发送 ${detailInviteUserIds.value.length} 份邀请`);
    isDetailInviteDialogOpen.value = false;
    fetchProjectDetail(projectDetail.value.id);
  } catch {
    ElMessage.error('发送邀请失败');
  }
};

const handleJoinProjectDetail = async () => {
  if (!projectDetail.value) return;
  try {
    await api.post(`/api/projects/${projectDetail.value.id}/join`);
    ElMessage.success('成功加入项目');
    fetchProjectDetail(projectDetail.value.id);
    emit('refresh-list');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '加入失败'));
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
    ElMessage.success('任务已添加');
    await fetchProjectDetail(activeProjectId.value);
    emit('refresh-list');
  } catch {
    ElMessage.error('添加任务失败');
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
    ElMessage.success(`成功批量创建 ${lines.length} 个任务`);
    isBatchDialogOpen.value = false;
    batchTaskText.value = '';
    batchAssigneeId.value = '';
    batchDueDate.value = '';
    batchPriority.value = 'MEDIUM';
    await fetchProjectDetail(activeProjectId.value);
    emit('refresh-list');
  } catch {
    ElMessage.error('批量创建任务失败');
  }
};

const navigateToTaskBoard = (projectId: string) => {
  router.push({ name: 'TaskBoard', query: { projectId } });
};

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
              <p class="text-[10px] font-bold text-slate-400">项目详情与任务协作</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <!-- Join Project Button for non-members on PUBLIC projects -->
            <button v-if="!isDetailMember && projectDetail.visibility === 'PUBLIC'" type="button" class="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10 border-none" @click="handleJoinProjectDetail">
              <Plus class="w-3.5 h-3.5" />
              <span>报名加入项目</span>
            </button>

            <button type="button" class="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border-none" @click="navigateToTaskBoard(projectDetail.id)">
              <FolderOpen class="w-3.5 h-3.5" />
              <span>在看板中查看</span>
            </button>

            <!-- View Mode Toggle (Drawer vs Modal) -->
            <button type="button" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all text-slate-500 dark:text-slate-400 cursor-pointer bg-transparent border-none" :title="projectDetailViewMode === 'drawer' ? '切换为弹窗模式' : '切换为抽屉模式'" @click="toggleDetailViewMode">
              <component
                :is="projectDetailViewMode === 'drawer' ? Maximize2 : Minimize2"
                class="w-4.5 h-4.5"
              />
            </button>

            <button type="button" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer bg-transparent border-none" style="color: var(--text-secondary)" @click="isDetailDrawerOpen = false">
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
            <p class="text-xs font-bold text-slate-400">正在加载项目详情...</p>
          </div>

          <div
            v-else-if="projectDetail"
            class="space-y-6 md:space-y-0 md:grid md:grid-cols-3 md:gap-6 p-1"
          >
            <!-- Left Column: Tasks (col-span-2) -->
            <div class="md:col-span-2 space-y-4">
              <div class="flex items-center justify-between">
                <h4
                  class="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"
                >
                  <Layers class="w-4 h-4" /> 项目任务 ({{ projectDetail.tasks.length }})
                </h4>
                <div class="flex gap-2">
                  <button type="button" class="px-2.5 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:opacity-95 transition-all cursor-pointer border-none" @click="isBatchDialogOpen = true">
                    <Plus class="w-3 h-3" />
                    <span>批量添加</span>
                  </button>
                </div>
              </div>

              <!-- Quick task title input -->
              <div class="relative flex items-center">
                <input
                  v-model="quickTaskTitle"
                  type="text"
                  placeholder="在此输入新任务标题，按回车快速添加..."
                  class="w-full pl-4 pr-12 py-2 bg-slate-50 dark:bg-slate-800/30 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
                  style="border-color: var(--border-base); color: var(--text-primary)"
                  @keydown.enter="handleQuickAddTask"
                />
                <button type="button" class="absolute right-1.5 p-1.5 bg-accent text-white rounded-lg hover:scale-105 transition-all border-none cursor-pointer" @click="handleQuickAddTask">
                  <Plus class="w-3 h-3 text-white" />
                </button>
              </div>

              <!-- Tasks Table -->
              <div
                v-if="projectDetail.tasks.length === 0"
                class="py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl opacity-40 animate-in fade-in"
                style="border-color: var(--border-base)"
              >
                <CheckCircle2 class="w-8 h-8 text-slate-300 mb-2" />
                <p class="text-xs font-bold text-slate-400">目前暂无关联任务</p>
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
                        任务名称
                      </th>
                      <th
                        class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-36"
                      >
                        执行人
                      </th>
                      <th
                        class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-24"
                      >
                        优先级
                      </th>
                      <th
                        class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-32"
                      >
                        状态
                      </th>
                      <th
                        class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right w-16"
                      >
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="task in projectDetail.tasks"
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
                        <div v-if="task.assignee" class="flex items-center gap-1.5">
                          <UserAvatar :user="task.assignee" size="xs" />
                          <span class="font-bold text-slate-500 truncate max-w-[80px] text-[10px]">{{
                            task.assignee.name || task.assignee.email
                          }}</span>
                        </div>
                        <span v-else class="text-slate-400">未指派</span>
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
                              ? '紧急'
                              : task.priority === 'HIGH'
                                ? '高'
                                : task.priority === 'MEDIUM'
                                  ? '中'
                                  : '低'
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
                          <el-option label="待办" value="TODO" />
                          <el-option label="进行中" value="IN_PROGRESS" />
                          <el-option label="已完成" value="DONE" />
                        </el-select>
                      </td>
                      <td class="px-3.5 py-2 text-right">
                        <button type="button" class="p-1 hover:text-rose-500 text-slate-400 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer bg-transparent border-none" @click="handleDeleteTask(task.id)">
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Right Column: Sidebar (col-span-1) -->
            <div class="space-y-4 md:space-y-5">
              <!-- Project Vision (Description) -->
              <div>
                <h4
                  class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1 text-left"
                >
                  项目愿景
                </h4>
                <p
                  class="text-xs text-slate-500 leading-relaxed bg-slate-50 dark:bg-slate-800/20 p-3 rounded-xl border text-left"
                  style="border-color: var(--border-base)"
                >
                  {{ projectDetail.description || '暂无项目描述。' }}
                </p>
              </div>

              <!-- Project Meta (Deadline & Progress) -->
              <div class="grid grid-cols-2 gap-3">
                <div
                  class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border text-left"
                  style="border-color: var(--border-base)"
                >
                  <div
                    class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1"
                  >
                    截止日期
                  </div>
                  <span class="text-xs font-bold" style="color: var(--text-primary)">
                    {{
                      projectDetail.dueDate
                        ? new Date(projectDetail.dueDate).toLocaleDateString()
                        : '未设定'
                    }}
                  </span>
                </div>
                <div
                  class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border text-left"
                  style="border-color: var(--border-base)"
                >
                  <div
                    class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1"
                  >
                    项目进度
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
                    <Users class="w-3.5 h-3.5" /> 参与成员 ({{ projectDetail.members.length }})
                  </h4>
                  <button v-if="isDetailOwner" type="button" class="px-2 py-0.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[10px] font-bold transition-all flex items-center gap-0.5 cursor-pointer border-none" @click="openInviteDetailDialog">
                    <Plus class="w-2.5 h-2.5" />
                    <span>邀请</span>
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
                    已发邀请 (等待接受)
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
            批量添加项目任务
          </h3>
          <button type="button" class="bg-transparent border-none cursor-pointer" style="color: var(--text-secondary)" @click="isBatchDialogOpen = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="space-y-4 text-left">
          <div>
            <label
              class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
              >任务标题列表 (一行一个任务标题)</label
            >
            <textarea
              v-model="batchTaskText"
              rows="6"
              class="w-full px-4 py-2.5 sm:py-3 bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none leading-relaxed"
              style="color: var(--text-primary);"
              placeholder="例如：&#10;核心功能代码编写&#10;接口文档编写&#10;前端样式还原校验"
            ></textarea>
          </div>

          <!-- Tasks Preview -->
          <div v-if="parsedBatchTasks.length > 0" class="space-y-1.5 sm:space-y-2">
            <label class="block text-[10px] sm:text-xs font-bold uppercase text-slate-400 ml-1"
              >即将创建的任务预览 (共 {{ parsedBatchTasks.length }} 个)</label
            >
            <div
              class="max-h-24 overflow-y-auto border rounded-xl p-2.5 space-y-1 bg-slate-50 dark:bg-slate-800/10 scrollbar-hide"
              style="border-color: var(--border-base)"
            >
              <div
                v-for="(t, index) in parsedBatchTasks"
                :key="index"
                class="flex items-center justify-between text-[11px] font-bold py-0.5 border-b last:border-0"
                style="border-color: var(--border-base)"
              >
                <span class="truncate flex-1 pr-4" style="color: var(--text-primary)">
                  {{ index + 1 }}. {{ t }}
                </span>
                <span
                  class="px-1 py-0.2 bg-accent/10 text-accent rounded text-[7px] uppercase font-black tracking-wider shrink-0"
                  >待创建</span
                >
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label
                class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                >统一负责人</label
              >
              <el-select
                v-model="batchAssigneeId"
                clearable
                placeholder="选择负责人"
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
                >统一优先级</label
              >
              <el-select v-model="batchPriority" class="!w-full custom-select">
                <el-option
                  v-for="p in priorityOptions"
                  :key="p.id"
                  :label="p.label"
                  :value="p.id"
                >
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
              >统一截止日期</label
            >
            <el-date-picker
              v-model="batchDueDate"
              type="date"
              placeholder="Deadline"
              class="!w-full !rounded-2xl custom-date-picker"
              popper-class="custom-date-popper"
            />
          </div>
        </div>
        <button type="button" class="w-full py-3.5 bg-accent text-white rounded-xl sm:rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm border-none cursor-pointer" @click="handleBatchCreateTasks">
          批量创建任务
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
            邀请新成员加入项目
          </h3>
          <button type="button" class="bg-transparent border-none cursor-pointer" style="color: var(--text-secondary)" @click="isDetailInviteDialogOpen = false">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="space-y-4 text-left">
          <div v-if="availableMembersForDetailInvite.length > 0">
            <label
              class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
              >选择要邀请的团队成员</label
            >
            <el-select
              v-model="detailInviteUserIds"
              multiple
              placeholder="选择成员"
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
            团队中没有可邀请的其他成员（所有成员均已加入该项目）
          </div>
        </div>

        <div class="flex justify-end gap-2.5 sm:gap-3 pt-2">
          <button type="button" class="px-4 py-2 sm:px-5 sm:py-2.5 bg-slate-100 dark:bg-white/5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold hover:scale-105 transition-all cursor-pointer border-none" style="color: var(--text-primary)" @click="isDetailInviteDialogOpen = false">
            取消
          </button>
          <button type="button" class="px-4 py-2 sm:px-5 sm:py-2.5 bg-accent text-white rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold hover:scale-105 transition-all shadow-md shadow-accent/20 cursor-pointer disabled:opacity-50 disabled:hover:scale-100 border-none" :disabled="detailInviteUserIds.length === 0" @click="handleSendDetailInvite">
            发送邀请
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
