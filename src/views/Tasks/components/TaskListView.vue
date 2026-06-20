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
import { useI18n } from 'vue-i18n';
import Dropdown from '@/components/ui/Dropdown.vue';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';

import { TaskStatus } from '@/types/task';
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
  groupBy: 'status' | 'priority' | 'assignee' | 'dueDate';
  subtaskDisplay?: 'collapse' | 'expand' | 'separate';
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'refresh', updatedTask?: Task): void;
  (e: 'open-add-dialog', payload: { colId: string; projectId: string | null }): void;
  (e: 'open-detail', task: Task, subtaskId?: string): void;
  (e: 'update-subtask', parentId: string, subtaskIndex: number, fields: Record<string, any>): void;
}>();

const { t } = useI18n();
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

watch(
  () => props.subtaskDisplay,
  (newVal) => {
    if (newVal === 'expand') {
      props.tasksByProject.forEach((group) => {
        group.tasks.forEach((t) => {
          if (t.subtasks) {
            try {
              const parsed = JSON.parse(t.subtasks);
              if (Array.isArray(parsed) && parsed.length > 0) {
                expandedTasks.value[t.id] = true;
              }
            } catch {
              // ignore
            }
          }
        });
      });
    } else if (newVal === 'collapse') {
      expandedTasks.value = {};
    }
  },
  { immediate: true }
);

watch(
  () => props.tasksByProject,
  () => {
    if (props.subtaskDisplay === 'expand') {
      props.tasksByProject.forEach((group) => {
        group.tasks.forEach((t) => {
          if (t.subtasks) {
            try {
              const parsed = JSON.parse(t.subtasks);
              if (Array.isArray(parsed) && parsed.length > 0) {
                expandedTasks.value[t.id] = true;
              }
            } catch {
              // ignore
            }
          }
        });
      });
    }
  }
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
    if (Array.isArray(parsed)) {
      return parsed.map((s, idx) => ({
        ...s,
        id: s.id || `subtask-legacy-${idx}`,
      }));
    }
    return [];
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

const handleSubtaskUpdateInList = (task: Task, fields: Record<string, any>) => {
  if ((task as any).isSubtask && (task as any).parentId) {
    emit('update-subtask', (task as any).parentId, (task as any).subtaskIndex, fields);
    return true;
  }
  return false;
};

const quickStatusChange = async (task: Task, newStatus: string) => {
  if (handleSubtaskUpdateInList(task, { done: newStatus === 'DONE' })) {
    return;
  }
  try {
    const response = await api.put(`/api/tasks/${task.id}`, { status: newStatus });
    ElMessage.success(
      t('tasks.movedTo', {
        status:
          newStatus === 'DONE'
            ? t('tasks.done')
            : newStatus === 'IN_PROGRESS'
              ? t('tasks.inProgress')
              : t('tasks.todo'),
      }),
    );
    emit('refresh', response.data);
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || t('tasks.updateStatusFailed');
    ElMessage.error(errorMsg);
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
  const nextStatus = task.status === TaskStatus.DONE ? TaskStatus.TODO : TaskStatus.DONE;
  await quickStatusChange(task, nextStatus);
};

const handleProjectChange = async (task: Task, projectId: string | null) => {
  if ((task as any).isSubtask) {
    ElMessage.warning('子任务不能独立关联项目');
    return;
  }
  try {
    const response = await api.put(`/api/tasks/${task.id}`, { projectId });
    ElMessage.success(projectId ? t('tasks.projectAssociated') : t('tasks.projectUnassociated'));
    emit('refresh', response.data);
  } catch {
    ElMessage.error(t('tasks.updateProjectFailed'));
  }
};

const handleAssigneeChange = async (task: Task, assigneeId: string | null) => {
  if (handleSubtaskUpdateInList(task, { assigneeId })) {
    return;
  }
  try {
    const response = await api.put(`/api/tasks/${task.id}`, { assigneeId });
    ElMessage.success(assigneeId ? t('tasks.assigneeAssigned') : t('tasks.assigneeCleared'));
    emit('refresh', response.data);
  } catch {
    ElMessage.error(t('tasks.updateAssigneeFailed'));
  }
};

const userMap = computed(() => {
  const map = new Map<string, UserType>();
  props.teamMembers.forEach((u) => {
    if (u.id) map.set(u.id, u);
  });
  props.teams.forEach((team) => {
    if (team.members) {
      team.members.forEach((m) => {
        if (m.user?.id) {
          map.set(m.user.id, m.user);
        }
      });
    }
  });
  return map;
});

const teamMembersMap = computed(() => {
  const map = new Map<string, UserType[]>();
  props.teams.forEach((team) => {
    if (team.id && team.members) {
      map.set(team.id, team.members.map((m) => m.user));
    }
  });
  return map;
});

const getUserById = (userId: string | null, task: Task | null) => {
  if (!userId) return null;
  const u = userMap.value.get(userId);
  if (u) return u;
  if (task && task.assignee && task.assignee.id === userId) {
    return task.assignee;
  }
  return null;
};

const getMembersForSubtask = (task: Task) => {
  if (task.teamId) {
    const members = teamMembersMap.value.get(task.teamId);
    if (members) return members;
  }
  return props.teamMembers;
};


const toggleSubtaskInline = async (task: Task, subIdx: number) => {
  const list = parseSubtasks(task.subtasks);
  if (list[subIdx]) {
    list[subIdx].done = !list[subIdx].done;
    try {
      const subtasksStr = JSON.stringify(list);
      const response = await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
      task.subtasks = subtasksStr;
      emit('refresh', response.data);
    } catch {
      ElMessage.error(t('tasks.updateSubtaskFailed'));
    }
  }
};

const removeSubtaskInline = async (task: Task, subIdx: number) => {
  const list = parseSubtasks(task.subtasks);
  list.splice(subIdx, 1);
  try {
    const subtasksStr = JSON.stringify(list);
    const response = await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
    task.subtasks = subtasksStr;
    emit('refresh', response.data);
    ElMessage.success(t('tasks.subtaskDeleted'));
  } catch {
    ElMessage.error(t('tasks.deleteSubtaskFailed'));
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
      const response = await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
      task.subtasks = subtasksStr;
      emit('refresh', response.data);
    } catch {
      ElMessage.error(t('tasks.assignSubtaskAssigneeFailed'));
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
    const response = await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
    task.subtasks = subtasksStr;
    newSubtaskTexts.value[task.id] = '';
    emit('refresh', response.data);
    ElMessage.success(t('tasks.subtaskAdded'));
  } catch {
    ElMessage.error(t('tasks.addSubtaskFailed'));
  }
};

const handleInlineAddInProject = async (columnId: string, projectId: string | null) => {
  const key = `${columnId}_${projectId || 'unassigned'}`;
  const title = inlineTitles.value[key]?.trim();
  if (!title) return;

  try {
    const payload = {
      title,
      status: props.groupBy === 'status' ? columnId : TaskStatus.TODO,
      priority: props.groupBy === 'priority' ? columnId : 'MEDIUM',
      teamId: workspaceStore.activeTeamId || null,
      subtasks: '[]',
      tags: null,
      dueDate: null,
      assigneeId: null,
      projectId: projectId || null,
      participantIds: [],
    };

    const response = await api.post('/api/tasks', payload);
    ElMessage.success(t('tasks.quickCreateSuccess'));
    inlineTitles.value[key] = '';
    emit('refresh', response.data);
  } catch {
    ElMessage.error(t('tasks.quickCreateFailed'));
  }
};

const openAddDialogByCol = (colId: string, projectId: string | null) => {
  emit('open-add-dialog', { colId, projectId });
};

const openDetailDrawer = (task: Task, subtaskId?: string) => {
  emit('open-detail', task, subtaskId);
};
</script>

<template>
  <div class="flex-1 overflow-y-auto p-1 sm:p-4 scrollbar-hide">
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
              {{ t('tasks.tasksCount', { count: proj.tasks.length }) }}
            </span>
          </div>

          <span
            v-if="isProjectCollapsed(proj.id)"
            class="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium font-mono select-none"
          >
            {{ t('projects.clickToExpand') }}
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
              <button
                type="button"
                class="p-1 hover:bg-accent/10 rounded-lg text-slate-400 hover:text-accent transition-all shrink-0"
                @click.stop="openAddDialogByCol(col.id, proj.id)"
              >
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
                <div :class="nameColSpanClass" class="flex items-center gap-1">
                  {{ t('tasks.taskName') }}
                </div>
                <div v-if="visibleColumns.status" class="col-span-1 text-center">
                  {{ t('tasks.statusLabel') }}
                </div>
                <div v-if="visibleColumns.project" class="col-span-2 text-center">
                  {{ t('tasks.associatedProject') }}
                </div>
                <div v-if="visibleColumns.assignee" class="col-span-2 text-center">
                  {{ t('tasks.assignee') }}
                </div>
                <div v-if="visibleColumns.dueDate" class="col-span-1 text-center">
                  {{ t('tasks.dueDate') }}
                </div>
                <div v-if="visibleColumns.priority" class="col-span-1 text-center">
                  {{ t('tasks.priority') }}
                </div>
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
                      <button
                        type="button"
                        class="p-0.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-transform duration-200 shrink-0"
                        :class="expandedTasks[task.id] ? 'rotate-90' : ''"
                        @click.stop="toggleTaskExpand(task.id)"
                      >
                        <ChevronRight class="w-3.5 h-3.5 text-slate-400" />
                      </button>

                      <!-- Checkbox Circle to complete -->
                      <button
                        type="button"
                        class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-full border flex items-center justify-center transition-colors shrink-0"
                        :class="
                          task.status === 'DONE'
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-slate-300 dark:border-slate-650 hover:border-emerald-500 hover:bg-emerald-500/10'
                        "
                        @click.stop="toggleTaskCompletion(task)"
                      >
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
                        class="truncate font-semibold transition-colors group-hover:text-accent flex items-center gap-1.5 min-w-0"
                        :class="
                          task.status === 'DONE'
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : ''
                        "
                        style="color: var(--text-primary)"
                      >
                        <span
                          v-if="(task as any).isSubtask"
                          class="shrink-0 inline-flex items-center px-1.5 py-0.2 rounded text-[7px] font-black bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase tracking-wider scale-90 mr-1 select-none"
                        >
                          子任务
                        </span>
                        <span class="truncate">{{ task.title }}</span>
                      </span>

                      <!-- Subtasks Checklist Badge -->
                      <span
                        v-if="getSubtaskProgress(task).total > 0"
                        class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 rounded-md text-[9px] font-bold text-slate-400 shrink-0"
                        :title="t('tasks.subtasksProgress')"
                      >
                        <CheckSquare class="w-2.5 h-2.5" />
                        {{ getSubtaskProgress(task).completed }}/{{
                          getSubtaskProgress(task).total
                        }}
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
                      <Dropdown align="left" width-class="w-28">
                        <template #trigger>
                          <span
                            class="inline-flex items-center gap-1 max-w-full cursor-pointer hover:text-accent py-0.5 px-0.5 sm:px-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                          >
                            <span
                              class="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded font-bold"
                              :class="
                                task.status === TaskStatus.TODO
                                  ? 'bg-slate-500/10 text-slate-500'
                                  : task.status === TaskStatus.IN_PROGRESS
                                    ? 'bg-blue-500/10 text-blue-500'
                                    : 'bg-emerald-500/10 text-emerald-500'
                              "
                            >
                              {{
                                task.status === TaskStatus.TODO
                                  ? t('tasks.todo')
                                  : task.status === TaskStatus.IN_PROGRESS
                                    ? t('tasks.inProgress')
                                    : t('tasks.done')
                              }}
                            </span>
                          </span>
                        </template>
                        <template #content>
                          <button
                            type="button"
                            class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors"
                            @click="handleStatusCommand(task, TaskStatus.TODO)"
                          >
                            {{ t('tasks.todo') }}
                          </button>
                          <button
                            type="button"
                            class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors"
                            @click="handleStatusCommand(task, TaskStatus.IN_PROGRESS)"
                          >
                            {{ t('tasks.inProgress') }}
                          </button>
                          <button
                            type="button"
                            class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors"
                            @click="handleStatusCommand(task, TaskStatus.DONE)"
                          >
                            {{ t('tasks.done') }}
                          </button>
                        </template>
                      </Dropdown>
                    </div>

                    <!-- Project -->
                    <div
                      v-if="visibleColumns.project"
                      class="col-span-2 text-center text-slate-450 dark:text-slate-400 font-medium truncate px-0.5"
                      @click.stop
                    >
                      <Dropdown align="left" width-class="w-48">
                        <template #trigger>
                          <span
                            class="inline-flex items-center gap-0.5 sm:gap-1 max-w-full cursor-pointer hover:text-accent py-0.5 px-0.5 sm:px-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                          >
                            <FolderOpen class="w-3 h-3 text-accent shrink-0" />
                            <span
                              v-if="task.project"
                              class="truncate max-w-[40px] sm:max-w-[85px] text-[8px] sm:text-xs"
                              >{{ task.project.title }}</span
                            >
                            <span
                              v-else
                              class="text-slate-450 dark:text-slate-400 text-[8px] sm:text-[10px] font-bold"
                              >+ {{ t('tasks.associatedProject') }}</span
                            >
                          </span>
                        </template>
                        <template #content>
                          <button
                            type="button"
                            class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs text-rose-500 hover:bg-rose-500/10 border-none bg-transparent cursor-pointer transition-colors"
                            @click="handleProjectCommand(task, '')"
                          >
                            {{ t('projects.clearProject') }}
                          </button>
                          <div class="h-[1px] my-1 bg-slate-100 dark:bg-white/10"></div>
                          <button
                            v-for="p in projects"
                            :key="p.id"
                            type="button"
                            class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors"
                            @click="handleProjectCommand(task, p.id)"
                          >
                            {{ p.title }}
                          </button>
                        </template>
                      </Dropdown>
                    </div>

                    <!-- Assignee -->
                    <div
                      v-if="visibleColumns.assignee"
                      class="col-span-2 flex items-center justify-center gap-0.5 sm:gap-1.5 px-0.5 min-w-0"
                      @click.stop
                    >
                      <Dropdown align="left" width-class="w-48">
                        <template #trigger>
                          <span
                            class="inline-flex items-center gap-0.5 sm:gap-1 max-w-full cursor-pointer hover:text-accent py-0.5 px-0.5 sm:px-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                          >
                            <template v-if="task.assignee">
                              <img
                                v-if="task.assignee.avatarUrl"
                                alt=""
                                :src="task.assignee.avatarUrl"
                                class="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full object-cover shrink-0"
                              />
                              <div
                                v-else
                                class="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0"
                              >
                                <User class="w-2 h-2 text-accent" />
                              </div>
                              <span
                                class="hidden sm:inline text-[10px] text-slate-400 truncate max-w-[60px]"
                                >{{ task.assignee.name }}</span
                              >
                            </template>
                            <span
                              v-else
                              class="text-slate-455 dark:text-slate-400 text-[8px] sm:text-[10px] font-bold"
                              >+ {{ t('tasks.assignee') }}</span
                            >
                          </span>
                        </template>
                        <template #content>
                          <button
                            type="button"
                            class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs text-rose-500 hover:bg-rose-500/10 border-none bg-transparent cursor-pointer transition-colors"
                            @click="handleAssigneeCommand(task, '')"
                          >
                            {{ t('tasks.clearAssignee') }}
                          </button>
                          <div class="h-[1px] my-1 bg-slate-100 dark:bg-white/10"></div>
                          <button
                            v-for="m in teamMembers"
                            :key="m.id"
                            type="button"
                            class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors flex items-center gap-2"
                            @click="handleAssigneeCommand(task, m.id)"
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
                        <span class="hidden sm:inline">{{
                          new Date(task.dueDate).toLocaleDateString()
                        }}</span>
                        <span class="sm:hidden"
                          >{{ new Date(task.dueDate).getMonth() + 1 }}/{{
                            new Date(task.dueDate).getDate()
                          }}</span
                        >
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
                            ? t('tasks.urgent')
                            : task.priority === 'HIGH'
                              ? t('tasks.high')
                              : task.priority === 'MEDIUM'
                                ? t('tasks.medium')
                                : task.priority === 'LOW'
                                  ? t('tasks.low')
                                  : t('tasks.none')
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
                    <div class="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">
                      {{ t('tasks.subtaskList') }}
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
                            type="button"
                            class="w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0"
                            :class="
                              sub.done
                                ? 'border-emerald-500 bg-emerald-500/10'
                                : 'border-slate-350 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/10'
                            "
                            @click.stop="toggleSubtaskInline(task, index)"
                          >
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
                            class="truncate font-medium text-xs cursor-pointer hover:text-accent hover:underline transition-all"
                            :class="
                              sub.done ? 'line-through text-slate-400 dark:text-slate-500' : ''
                            "
                            @click.stop="openDetailDrawer(task, sub.id)"
                          >
                            {{ sub.text }}
                          </span>
                        </div>

                        <!-- Subtask Actions -->
                        <div class="flex items-center gap-3 shrink-0 ml-4">
                          <!-- Subtask Assignee -->
                          <Dropdown align="right" width-class="w-48">
                            <template #trigger>
                              <span
                                class="inline-flex items-center gap-1 cursor-pointer hover:text-accent text-[10px] text-slate-400"
                              >
                                <template v-if="sub.assigneeId">
                                  <img
                                    v-if="getUserById(sub.assigneeId, task)?.avatarUrl"
                                    alt=""
                                    :src="getUserById(sub.assigneeId, task)?.avatarUrl || undefined"
                                    class="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                                  />
                                  <span class="max-w-[70px] truncate">{{
                                    getUserById(sub.assigneeId, task)?.name ||
                                    t('common.unknownMember')
                                  }}</span>
                                </template>
                                <span
                                  v-else
                                  class="text-slate-400 text-[10px] hover:text-accent font-semibold"
                                  >+ {{ t('tasks.assignMember') }}</span
                                >
                              </span>
                            </template>
                            <template #content>
                              <button
                                type="button"
                                class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs text-rose-500 hover:bg-rose-500/10 border-none bg-transparent cursor-pointer transition-colors"
                                @click="handleSubtaskAssigneeCommand(task, Number(index), '')"
                              >
                                {{ t('tasks.clearMember') }}
                              </button>
                              <div class="h-[1px] my-1 bg-slate-100 dark:bg-white/10"></div>
                              <button
                                v-for="m in getMembersForSubtask(task)"
                                :key="m.id"
                                type="button"
                                class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors flex items-center gap-2"
                                @click="handleSubtaskAssigneeCommand(task, Number(index), m.id)"
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

                          <!-- Delete button -->
                          <button
                            type="button"
                            class="p-1 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-md transition-all shrink-0"
                            @click.stop="removeSubtaskInline(task, index)"
                          >
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
                        :placeholder="t('tasks.quickAddSubtaskPlaceholder')"
                        class="w-full px-2.5 py-1.5 bg-transparent border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-350 dark:hover:border-slate-600 focus:border-accent/40 focus:border-solid rounded-lg text-xs focus:outline-none transition-all pr-8"
                        style="color: var(--text-primary)"
                        @keyup.enter="addSubtaskInline(task)"
                      />
                      <button
                        v-show="newSubtaskTexts[task.id]?.trim()"
                        type="button"
                        class="absolute right-1.5 p-1 bg-accent/10 hover:bg-accent hover:text-white text-accent rounded-md transition-all"
                        @click="addSubtaskInline(task)"
                      >
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
                      :placeholder="t('tasks.quickAddPlaceholder')"
                      class="w-full px-1.5 sm:px-3 py-1 sm:py-1.5 bg-transparent border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent/40 focus:border-solid rounded-lg text-[9px] sm:text-xs focus:outline-none transition-all pr-8"
                      style="color: var(--text-primary)"
                      @keyup.enter="handleInlineAddInProject(col.id, proj.id)"
                    />
                    <button
                      v-show="inlineTitles[col.id + '_' + (proj.id || 'unassigned')]?.trim()"
                      type="button"
                      class="absolute right-1 p-0.5 sm:p-1 bg-accent/10 hover:bg-accent hover:text-white text-accent rounded-md transition-all"
                      @click="handleInlineAddInProject(col.id, proj.id)"
                    >
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
                {{ t('tasks.noTasksInGroup') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
