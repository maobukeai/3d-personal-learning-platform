<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import {
  Plus,
  Minus,
  ChevronRight,
  CheckCircle2,
  CheckSquare,
  X,
  FolderOpen,
  User,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';

import type {
  UserType,
  Team,
  Task,
  ActiveColumn,
  TaskProjectGroup,
  Project,
  Subtask,
} from '@/types/task';


interface Props {
  tasksByProject: TaskProjectGroup[];
  activeColumns: ActiveColumn[];
  visibleColumns: {
    status: boolean;
    project: boolean;
    assignee: boolean;
    dueDate: boolean;
    priority: boolean;
  };
  projects: Project[];
  teamMembers: UserType[];
  teams: Team[];
  groupBy: 'status' | 'priority';
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'open-add-dialog', payload: { colId: string; projectId: string | null }): void;
  (e: 'open-detail', task: Task): void;
}>();

const workspaceStore = useWorkspaceStore();

const inlineTitles = ref<Record<string, string>>({});

const loadCollapsedGroups = () => {
  try {
    return JSON.parse(localStorage.getItem('task_collapsed_groups') || '{}');
  } catch {
    return {};
  }
};

const loadCollapsedProjects = () => {
  try {
    return JSON.parse(localStorage.getItem('task_collapsed_projects') || '{}');
  } catch {
    return {};
  }
};

const collapsedGroups = ref<Record<string, boolean>>(loadCollapsedGroups());
const collapsedProjects = ref<Record<string, boolean>>(loadCollapsedProjects());
const expandedTasks = ref<Record<string, boolean>>({});
const newSubtaskTexts = ref<Record<string, string>>({});

watch(
  collapsedGroups,
  (newVal) => {
    localStorage.setItem('task_collapsed_groups', JSON.stringify(newVal));
  },
  { deep: true },
);

watch(
  collapsedProjects,
  (newVal) => {
    localStorage.setItem('task_collapsed_projects', JSON.stringify(newVal));
  },
  { deep: true },
);

const toggleTaskExpand = (taskId: string) => {
  expandedTasks.value[taskId] = !expandedTasks.value[taskId];
};

const tagColorMap: Record<string, string> = {
  设计: 'bg-pink-500/10 text-pink-500',
  开发: 'bg-blue-500/10 text-blue-500',
  学习: 'bg-emerald-500/10 text-emerald-500',
  '3D': 'bg-violet-500/10 text-violet-500',
  建模: 'bg-cyan-500/10 text-cyan-500',
  渲染: 'bg-amber-500/10 text-amber-500',
  动画: 'bg-rose-500/10 text-rose-500',
  研究: 'bg-indigo-500/10 text-indigo-500',
  文档: 'bg-teal-500/10 text-teal-500',
  优化: 'bg-lime-500/10 text-lime-500',
};

const defaultTagClass = 'bg-slate-500/10 text-slate-500';

const getTagClass = (tag: string) => tagColorMap[tag] || defaultTagClass;

const nameColSpanClass = computed(() => {
  let span = 12;
  if (props.visibleColumns.status) span -= 1;
  if (props.visibleColumns.project) span -= 2;
  if (props.visibleColumns.assignee) span -= 2;
  if (props.visibleColumns.dueDate) span -= 1;
  if (props.visibleColumns.priority) span -= 1;

  const map: Record<number, string> = {
    3: 'col-span-3',
    4: 'col-span-4',
    5: 'col-span-5',
    6: 'col-span-6',
    7: 'col-span-7',
    8: 'col-span-8',
    9: 'col-span-9',
    10: 'col-span-10',
    11: 'col-span-11',
    12: 'col-span-12',
  };
  return map[span] || 'col-span-3';
});

const getTasksByGroupInProject = (projectTasks: Task[], colId: string) => {
  if (props.groupBy === 'status') {
    return projectTasks.filter((t) => t.status === colId);
  } else {
    if (colId === 'NONE') {
      return projectTasks.filter((t) => !t.priority || t.priority === 'NONE');
    }
    return projectTasks.filter((t) => t.priority === colId);
  }
};

const getGroupCollapseKey = (projectId: string | null, colId: string) => {
  return `${projectId || 'unassigned'}_${colId}`;
};

const isGroupCollapsed = (projectId: string | null, colId: string) => {
  return !!collapsedGroups.value[getGroupCollapseKey(projectId, colId)];
};

const toggleGroupCollapseKey = (projectId: string | null, colId: string) => {
  const key = getGroupCollapseKey(projectId, colId);
  collapsedGroups.value[key] = !collapsedGroups.value[key];
};

const isProjectCollapsed = (projectId: string | null) => {
  return !!collapsedProjects.value[projectId || 'unassigned'];
};

const toggleProjectCollapse = (projectId: string | null) => {
  const key = projectId || 'unassigned';
  collapsedProjects.value[key] = !collapsedProjects.value[key];
};

const parseSubtasks = (subtasksStr: string | null | undefined): Subtask[] => {
  if (!subtasksStr) return [];
  try {
    const parsed = JSON.parse(subtasksStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getSubtaskProgress = (task: Task) => {
  const subtasks = parseSubtasks(task.subtasks);
  return {
    total: subtasks.length,
    completed: subtasks.filter((subtask) => subtask.done).length,
  };
};

const quickStatusChange = async (task: Task, newStatus: string) => {
  try {
    await api.put(`/api/tasks/${task.id}`, { status: newStatus });
    ElMessage.success(
      `已移动到 ${newStatus === 'DONE' ? '已完成' : newStatus === 'IN_PROGRESS' ? '进行中' : '待办'}`,
    );
    emit('refresh');
  } catch {
    ElMessage.error('更新状态失败');
  }
};

const handleStatusCommand = (task: Task, command: string | number | object) => {
  if (typeof command === 'string') {
    void quickStatusChange(task, command);
  }
};

const handleProjectCommand = (task: Task, command: string | number | object) => {
  if (typeof command === 'string') {
    void handleProjectChange(task, command || null);
  }
};

const handleAssigneeCommand = (task: Task, command: string | number | object) => {
  if (typeof command === 'string') {
    void handleAssigneeChange(task, command || null);
  }
};

const handleSubtaskAssigneeCommand = (
  task: Task,
  subtaskIndex: number,
  command: string | number | object,
) => {
  if (typeof command === 'string') {
    void handleSubtaskAssigneeChange(task, subtaskIndex, command || null);
  }
};

const toggleTaskCompletion = async (task: Task) => {
  const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
  await quickStatusChange(task, nextStatus);
};

const handleProjectChange = async (task: Task, projectId: string | null) => {
  try {
    await api.put(`/api/tasks/${task.id}`, { projectId });
    ElMessage.success(projectId ? '已关联项目' : '已取消关联项目');
    emit('refresh');
  } catch {
    ElMessage.error('更新关联项目失败');
  }
};

const handleAssigneeChange = async (task: Task, assigneeId: string | null) => {
  try {
    await api.put(`/api/tasks/${task.id}`, { assigneeId });
    ElMessage.success(assigneeId ? '已成功指派负责人' : '已清除负责人');
    emit('refresh');
  } catch {
    ElMessage.error('更新负责人失败');
  }
};

const getUserById = (userId: string | null, task: Task | null) => {
  if (!userId) return null;
  for (const team of props.teams) {
    if (team.members) {
      const member = team.members.find((m) => m.user?.id === userId);
      if (member) return member.user;
    }
  }
  const m = props.teamMembers.find((u) => u.id === userId);
  if (m) return m;
  if (task && task.assignee && task.assignee.id === userId) {
    return task.assignee;
  }
  return null;
};

const getMembersForSubtask = (task: Task) => {
  if (task.teamId) {
    const team = props.teams.find((t) => t.id === task.teamId);
    if (team && team.members) {
      return team.members.map((m) => m.user);
    }
  }
  return props.teamMembers;
};

const toggleSubtaskInline = async (task: Task, subIdx: number) => {
  const list = parseSubtasks(task.subtasks);
  if (list[subIdx]) {
    list[subIdx].done = !list[subIdx].done;
    try {
      const subtasksStr = JSON.stringify(list);
      await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
      task.subtasks = subtasksStr;
      emit('refresh');
    } catch {
      ElMessage.error('更新子任务失败');
    }
  }
};

const removeSubtaskInline = async (task: Task, subIdx: number) => {
  const list = parseSubtasks(task.subtasks);
  list.splice(subIdx, 1);
  try {
    const subtasksStr = JSON.stringify(list);
    await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
    task.subtasks = subtasksStr;
    emit('refresh');
    ElMessage.success('子任务已删除');
  } catch {
    ElMessage.error('删除子任务失败');
  }
};

const handleSubtaskAssigneeChange = async (
  task: Task,
  subIdx: number,
  assigneeId: string | null,
) => {
  const list = parseSubtasks(task.subtasks);
  if (list[subIdx]) {
    list[subIdx].assigneeId = assigneeId;
    try {
      const subtasksStr = JSON.stringify(list);
      await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
      task.subtasks = subtasksStr;
    } catch {
      ElMessage.error('指派子任务负责人失败');
    }
  }
};

const addSubtaskInline = async (task: Task) => {
  const text = newSubtaskTexts.value[task.id]?.trim();
  if (!text) return;
  const list = parseSubtasks(task.subtasks);
  list.push({
    id: Math.random().toString(36).substring(2, 11),
    text,
    done: false,
    assigneeId: null,
  });
  try {
    const subtasksStr = JSON.stringify(list);
    await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
    task.subtasks = subtasksStr;
    newSubtaskTexts.value[task.id] = '';
    emit('refresh');
    ElMessage.success('子任务已添加');
  } catch {
    ElMessage.error('添加子任务失败');
  }
};

const handleInlineAddInProject = async (columnId: string, projectId: string | null) => {
  const key = `${columnId}_${projectId || 'unassigned'}`;
  const title = inlineTitles.value[key]?.trim();
  if (!title) return;

  try {
    const payload = {
      title,
      status: props.groupBy === 'status' ? columnId : 'TODO',
      priority: props.groupBy === 'priority' ? columnId : 'MEDIUM',
      teamId: workspaceStore.activeTeamId || null,
      subtasks: '[]',
      tags: null,
      dueDate: null,
      assigneeId: null,
      projectId: projectId || null,
      participantIds: [],
    };

    await api.post('/api/tasks', payload);
    ElMessage.success('任务已快速创建');
    inlineTitles.value[key] = '';
    emit('refresh');
  } catch {
    ElMessage.error('快速创建任务失败');
  }
};

const openAddDialogByCol = (colId: string, projectId: string | null) => {
  emit('open-add-dialog', { colId, projectId });
};

const openDetailDrawer = (task: Task) => {
  emit('open-detail', task);
};
</script>

<template>
  <div class="flex-1 overflow-y-auto p-1 sm:p-8 scrollbar-hide">
    <div class="w-full max-w-none space-y-8">
      <!-- Project Group Card -->
      <div
        v-for="proj in tasksByProject"
        :key="proj.id || 'unassigned'"
        class="rounded-xl sm:rounded-2xl border bg-slate-50/15 dark:bg-white/1 transition-all duration-300"
        :class="
          isProjectCollapsed(proj.id)
            ? 'p-2 sm:p-3.5 space-y-0 shadow-sm'
            : 'p-2 sm:p-5 space-y-3 sm:space-y-4'
        "
        style="border-color: var(--border-base)"
      >
        <!-- Project Card Header -->
        <div
          class="flex items-center justify-between px-1 sm:px-2 py-0.5 select-none cursor-pointer group/proj"
          @click="toggleProjectCollapse(proj.id)"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <!-- Chevron for Project Collapse -->
            <span
              class="transition-transform duration-200 text-slate-400 group-hover/proj:text-accent"
              :class="isProjectCollapsed(proj.id) ? '-rotate-90' : ''"
            >
              <ChevronRight class="w-4 h-4 shrink-0" />
            </span>
            <FolderOpen class="w-4 h-4 text-accent shrink-0" />
            <h2
              class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate"
              style="color: var(--text-primary)"
            >
              {{ proj.name }}
            </h2>
            <span
              class="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full text-slate-400 shrink-0"
            >
              {{ proj.tasks.length }} 个任务
            </span>
          </div>

          <span
            v-if="isProjectCollapsed(proj.id)"
            class="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium font-mono select-none"
          >
            点击展开项目
          </span>
        </div>

        <!-- Status Groups inside Project -->
        <div v-show="!isProjectCollapsed(proj.id)" class="space-y-4">
          <div
            v-for="col in activeColumns"
            :key="col.id"
            class="rounded-xl border shadow-sm overflow-hidden bg-card"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <!-- Section Group Header -->
            <div
              class="px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between cursor-pointer select-none border-b transition-colors bg-slate-50/50 dark:bg-white/2 hover:bg-slate-100/50 dark:hover:bg-white/5"
              style="border-color: var(--border-base)"
              @click="toggleGroupCollapseKey(proj.id, col.id)"
            >
              <div class="flex items-center gap-3 min-w-0">
                <!-- Collapse Chevron -->
                <span
                  class="transition-transform duration-200"
                  :class="isGroupCollapsed(proj.id, col.id) ? '-rotate-90' : ''"
                >
                  <Plus
                    v-if="isGroupCollapsed(proj.id, col.id)"
                    class="w-3.5 h-3.5 text-slate-400"
                  />
                  <Minus v-else class="w-3.5 h-3.5 text-slate-400" />
                </span>

                <!-- Column Tag -->
                <span
                  class="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm shrink-0"
                  :class="col.color"
                >
                  {{ col.title }}
                </span>

                <!-- Tasks count -->
                <span class="text-xs font-bold text-slate-400 shrink-0">
                  {{ getTasksByGroupInProject(proj.tasks, col.id).length }}
                </span>
              </div>

              <!-- Header Quick Add -->
              <button type="button" class="p-1 hover:bg-accent/10 rounded-lg text-slate-400 hover:text-accent transition-all shrink-0" @click.stop="openAddDialogByCol(col.id, proj.id)">
                <Plus class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Section Tasks List -->
            <div v-show="!isGroupCollapsed(proj.id, col.id)" class="overflow-x-auto">
              <!-- Table Header Row -->
              <div
                v-if="getTasksByGroupInProject(proj.tasks, col.id).length > 0"
                class="grid grid-cols-12 px-1.5 sm:px-4 py-1.5 sm:py-2 border-b text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 select-none bg-slate-100/30 dark:bg-white/1"
                style="border-color: var(--border-base)"
              >
                <div :class="nameColSpanClass" class="flex items-center gap-1">任务名称</div>
                <div v-if="visibleColumns.status" class="col-span-1 text-center">状态</div>
                <div v-if="visibleColumns.project" class="col-span-2 text-center">关联项目</div>
                <div v-if="visibleColumns.assignee" class="col-span-2 text-center">负责人</div>
                <div v-if="visibleColumns.dueDate" class="col-span-1 text-center">截止日期</div>
                <div v-if="visibleColumns.priority" class="col-span-1 text-center">优先级</div>
              </div>

              <!-- Task Rows -->
              <div
                class="divide-y divide-slate-100 dark:divide-white/5"
                style="border-color: var(--border-base)"
              >
                <template
                  v-for="task in getTasksByGroupInProject(proj.tasks, col.id)"
                  :key="task.id"
                >
                  <div
                    class="grid grid-cols-12 px-1.5 sm:px-4 py-1.5 sm:py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors items-center text-[10.5px] sm:text-xs group cursor-pointer"
                    @click="openDetailDrawer(task)"
                  >
                    <!-- Task Name & Subtasks Indicator -->
                    <div :class="nameColSpanClass" class="flex items-center gap-2 min-w-0">
                      <!-- Expand Chevron -->
                      <button type="button" class="p-0.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-transform duration-200 shrink-0" :class="expandedTasks[task.id] ? 'rotate-90' : ''" @click.stop="toggleTaskExpand(task.id)">
                        <ChevronRight class="w-3.5 h-3.5 text-slate-400" />
                      </button>

                      <!-- Checkbox Circle to complete -->
                      <button
type="button" class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-full border flex items-center justify-center transition-colors shrink-0" :class="
                          task.status === 'DONE'
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-slate-300 dark:border-slate-650 hover:border-emerald-500 hover:bg-emerald-500/10'
                        " @click.stop="toggleTaskCompletion(task)">
                        <CheckCircle2
                          class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 transition-colors"
                          :class="
                            task.status === 'DONE'
                              ? 'text-emerald-500'
                              : 'text-slate-350 dark:text-slate-600 group-hover:text-emerald-500'
                          "
                        />
                      </button>

                      <span
                        class="truncate font-semibold transition-colors group-hover:text-accent"
                        :class="
                          task.status === 'DONE'
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : ''
                        "
                        style="color: var(--text-primary)"
                      >
                        {{ task.title }}
                      </span>

                      <!-- Subtasks Checklist Badge -->
                      <span
                        v-if="getSubtaskProgress(task).total > 0"
                        class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 rounded-md text-[9px] font-bold text-slate-400 shrink-0"
                        title="子任务进度"
                      >
                        <CheckSquare class="w-2.5 h-2.5" />
                        {{ getSubtaskProgress(task).completed }}/{{ getSubtaskProgress(task).total }}
                      </span>

                      <!-- Tags (small) -->
                      <div
                        v-if="task.tags && JSON.parse(task.tags).length > 0"
                        class="hidden sm:flex flex-wrap gap-1 ml-2 min-w-0"
                      >
                        <span
                          v-for="tag in JSON.parse(task.tags)"
                          :key="tag"
                          class="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-tight shrink-0 scale-95"
                          :class="getTagClass(tag)"
                        >
                          {{ tag }}
                        </span>
                      </div>
                    </div>

                    <!-- Status -->
                    <div
                      v-if="visibleColumns.status"
                      class="col-span-1 text-center text-slate-450 dark:text-slate-400 font-medium truncate px-0.5"
                      @click.stop
                    >
                      <el-dropdown
                        trigger="click"
                        @command="(cmd: string | number | object) => handleStatusCommand(task, cmd)"
                      >
                        <span
                          class="inline-flex items-center gap-1 max-w-full cursor-pointer hover:text-accent py-0.5 px-0.5 sm:px-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <span
                            class="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded font-bold"
                            :class="
                              task.status === 'TODO'
                                ? 'bg-slate-500/10 text-slate-500'
                                : task.status === 'IN_PROGRESS'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-emerald-500/10 text-emerald-500'
                            "
                          >
                            {{
                              task.status === 'TODO'
                                ? '待办'
                                : task.status === 'IN_PROGRESS'
                                  ? '进行中'
                                  : '已完成'
                            }}
                          </span>
                        </span>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="TODO">待办</el-dropdown-item>
                            <el-dropdown-item command="IN_PROGRESS">进行中</el-dropdown-item>
                            <el-dropdown-item command="DONE">已完成</el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>

                    <!-- Project -->
                    <div
                      v-if="visibleColumns.project"
                      class="col-span-2 text-center text-slate-450 dark:text-slate-400 font-medium truncate px-0.5"
                      @click.stop
                    >
                      <el-dropdown
                        trigger="click"
                        @command="(cmd: string | number | object) => handleProjectCommand(task, cmd)"
                      >
                        <span
                          class="inline-flex items-center gap-0.5 sm:gap-1 max-w-full cursor-pointer hover:text-accent py-0.5 px-0.5 sm:px-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <FolderOpen class="w-3 h-3 text-accent shrink-0" />
                          <span v-if="task.project" class="truncate max-w-[40px] sm:max-w-[85px] text-[8px] sm:text-xs">{{
                            task.project.title
                          }}</span>
                          <span
                            v-else
                            class="text-slate-450 dark:text-slate-400 text-[8px] sm:text-[10px] font-bold"
                            >+ 项目</span
                          >
                        </span>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="">清除项目</el-dropdown-item>
                            <el-dropdown-item v-for="p in projects" :key="p.id" :command="p.id">
                              {{ p.title }}
                            </el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>

                    <!-- Assignee -->
                    <div
                      v-if="visibleColumns.assignee"
                      class="col-span-2 flex items-center justify-center gap-0.5 sm:gap-1.5 px-0.5 min-w-0"
                      @click.stop
                    >
                      <el-dropdown
                        trigger="click"
                        @command="(cmd: string | number | object) => handleAssigneeCommand(task, cmd)"
                      >
                        <span
                          class="inline-flex items-center gap-0.5 sm:gap-1 max-w-full cursor-pointer hover:text-accent py-0.5 px-0.5 sm:px-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                        >
                          <template v-if="task.assignee">
                            <img v-if="task.assignee.avatarUrl" alt="" :src="task.assignee.avatarUrl" class="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full object-cover shrink-0" />
                            <div
                              v-else
                              class="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0"
                            >
                              <User class="w-2 h-2 text-accent" />
                            </div>
                            <span class="hidden sm:inline text-[10px] text-slate-400 truncate max-w-[60px]">{{
                              task.assignee.name
                            }}</span>
                          </template>
                          <span
                            v-else
                            class="text-slate-450 dark:text-slate-400 text-[8px] sm:text-[10px] font-bold"
                            >+ 负责人</span
                          >
                        </span>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item command="">清除负责人</el-dropdown-item>
                            <el-dropdown-item
                              v-for="m in teamMembers"
                              :key="m.id"
                              :command="m.id"
                            >
                              <div class="flex items-center gap-2">
                                <img v-if="m.avatarUrl" alt="" :src="m.avatarUrl" class="w-5 h-5 rounded-lg object-cover" />
                                <span>{{ m.name }}</span>
                              </div>
                            </el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>
                    </div>

                    <!-- Due Date -->
                    <div
                      v-if="visibleColumns.dueDate"
                      class="col-span-1 text-center text-[8px] sm:text-[10px] px-0.5 font-semibold"
                    >
                      <span
                        v-if="task.dueDate"
                        :class="
                          new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                            ? 'text-rose-500'
                            : 'text-slate-400'
                        "
                      >
                        <span class="hidden sm:inline">{{ new Date(task.dueDate).toLocaleDateString() }}</span>
                        <span class="sm:hidden">{{ new Date(task.dueDate).getMonth() + 1 }}/{{ new Date(task.dueDate).getDate() }}</span>
                      </span>
                      <span v-else class="text-slate-350 dark:text-slate-650">-</span>
                    </div>

                    <!-- Priority -->
                    <div
                      v-if="visibleColumns.priority"
                      class="col-span-1 text-center font-bold px-0.5"
                    >
                      <span
                        v-if="task.priority"
                        class="text-[7.5px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded"
                        :class="
                          task.priority === 'URGENT'
                            ? 'bg-rose-500/10 text-rose-500'
                            : task.priority === 'HIGH'
                              ? 'bg-orange-500/10 text-orange-500'
                              : task.priority === 'MEDIUM'
                                ? 'bg-amber-500/10 text-amber-500'
                                : task.priority === 'LOW'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-slate-500/10 text-slate-500'
                        "
                      >
                        {{
                          task.priority === 'URGENT'
                            ? '急'
                            : task.priority === 'HIGH'
                              ? '高'
                              : task.priority === 'MEDIUM'
                                ? '中'
                                : task.priority === 'LOW'
                                  ? '低'
                                  : '无'
                        }}
                      </span>
                      <span v-else class="text-slate-350 dark:text-slate-600">-</span>
                    </div>
                  </div>

                  <!-- Collapsible Subtasks Checklist Container -->
                  <div
                    v-if="expandedTasks[task.id]"
                    class="col-span-12 pl-12 pr-4 py-3 bg-slate-50/30 dark:bg-white/1 space-y-2 border-t border-b border-slate-100/50 dark:border-white/5"
                    @click.stop
                  >
                    <div
                      class="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2"
                    >
                      子任务清单
                    </div>

                    <!-- Subtask Checklist Rows -->
                    <div class="space-y-1.5">
                      <div
                        v-for="(sub, index) in parseSubtasks(task.subtasks)"
                        :key="sub.id"
                        class="flex items-center justify-between py-1.5 px-2 bg-slate-100/50 dark:bg-white/2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-xs text-slate-650 dark:text-slate-300"
                      >
                        <div class="flex items-center gap-2.5 min-w-0 flex-1">
                          <!-- Subtask Checklist checkbox -->
                          <button
type="button" class="w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0" :class="
                              sub.done
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-slate-350 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/10'
                            " @click.stop="toggleSubtaskInline(task, index)">
                            <CheckCircle2
                              class="w-3 h-3 transition-colors"
                              :class="
                                sub.done
                                  ? 'text-emerald-500'
                                  : 'text-transparent hover:text-emerald-500'
                              "
                            />
                          </button>

                          <!-- Subtask title text -->
                          <span
                            class="truncate font-medium text-xs"
                            :class="
                              sub.done ? 'line-through text-slate-400 dark:text-slate-500' : ''
                            "
                          >
                            {{ sub.text }}
                          </span>
                        </div>

                        <!-- Subtask Actions -->
                        <div class="flex items-center gap-3 shrink-0 ml-4">
                          <!-- Subtask Assignee -->
                          <el-dropdown
                            trigger="click"
                            @command="
                              (cmd: string | number | object) =>
                                handleSubtaskAssigneeCommand(task, Number(index), cmd)
                            "
                          >
                            <span
                              class="inline-flex items-center gap-1 cursor-pointer hover:text-accent text-[10px] text-slate-400"
                            >
                              <template v-if="sub.assigneeId">
                                <img v-if="getUserById(sub.assigneeId, task)?.avatarUrl" alt="" :src="getUserById(sub.assigneeId, task)?.avatarUrl || undefined" class="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                                <span class="max-w-[70px] truncate">{{
                                  getUserById(sub.assigneeId, task)?.name || '未知成员'
                                }}</span>
                              </template>
                              <span
                                v-else
                                class="text-slate-400 text-[10px] hover:text-accent font-semibold"
                                >+ 指派成员</span
                              >
                            </span>
                            <template #dropdown>
                              <el-dropdown-menu>
                                <el-dropdown-item command="">清除成员</el-dropdown-item>
                                <el-dropdown-item
                                  v-for="m in getMembersForSubtask(task)"
                                  :key="m.id"
                                  :command="m.id"
                                >
                                  <div class="flex items-center gap-2">
                                    <img v-if="m.avatarUrl" alt="" :src="m.avatarUrl" class="w-5 h-5 rounded-lg object-cover" />
                                    <span>{{ m.name }}</span>
                                  </div>
                                </el-dropdown-item>
                              </el-dropdown-menu>
                            </template>
                          </el-dropdown>

                          <!-- Delete button -->
                          <button type="button" class="p-1 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-md transition-all shrink-0" @click.stop="removeSubtaskInline(task, index)">
                            <X class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Inline Quick Add Subtask -->
                    <div class="relative flex items-center max-w-md pt-2 mt-1">
                      <input
                        v-model="newSubtaskTexts[task.id]"
                        type="text"
                        placeholder="+ 快速添加子任务..."
                        class="w-full px-2.5 py-1.5 bg-transparent border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-350 dark:hover:border-slate-600 focus:border-accent/40 focus:border-solid rounded-lg text-xs focus:outline-none transition-all pr-8"
                        style="color: var(--text-primary)"
                        @keyup.enter="addSubtaskInline(task)"
                      />
                      <button v-show="newSubtaskTexts[task.id]?.trim()" type="button" class="absolute right-1.5 p-1 bg-accent/10 hover:bg-accent hover:text-white text-accent rounded-md transition-all" @click="addSubtaskInline(task)">
                        <Plus class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </template>

                <!-- Inline Quick Add row inside List Group -->
                <div class="px-2 py-1.5 bg-slate-50/20 dark:bg-white/1">
                  <div class="relative flex items-center max-w-xl">
                    <input
                      v-model="inlineTitles[col.id + '_' + (proj.id || 'unassigned')]"
                      type="text"
                      placeholder="+ 快速添加..."
                      class="w-full px-1.5 sm:px-3 py-1 sm:py-1.5 bg-transparent border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent/40 focus:border-solid rounded-lg text-[9px] sm:text-xs focus:outline-none transition-all pr-8"
                      style="color: var(--text-primary)"
                      @keyup.enter="handleInlineAddInProject(col.id, proj.id)"
                    />
                    <button v-show="inlineTitles[col.id + '_' + (proj.id || 'unassigned')]?.trim()" type="button" class="absolute right-1 p-0.5 sm:p-1 bg-accent/10 hover:bg-accent hover:text-white text-accent rounded-md transition-all" @click="handleInlineAddInProject(col.id, proj.id)">
                      <Plus class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Empty State for Group -->
              <div
                v-if="getTasksByGroupInProject(proj.tasks, col.id).length === 0"
                class="py-8 text-center text-slate-400 text-xs select-none"
              >
                此列表中暂无任务，可在上方输入框中快速添加。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
