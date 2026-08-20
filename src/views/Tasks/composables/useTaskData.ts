import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import { useWorkspaceStore } from '@/stores/workspace';
import { TaskStatus } from '@/types/task';
import type { Task, UserType, Project, Team, TaskUpdatePayload, Subtask } from '@/types/task';

// Global cache to avoid double loading flash when swapping workspace context
const cachedTasksByTeam = ref<Record<string, Task[]>>({});
const cachedStatsByTeam = ref<Record<string, unknown>>({});
const cachedTeamMembersByTeam = ref<Record<string, UserType[]>>({});
const cachedProjectsByTeam = ref<Record<string, Project[]>>({});
const cachedTeams = ref<Team[]>([]);

export function useTaskData() {
  const { t } = useI18n();
  const workspaceStore = useWorkspaceStore();

  const tasks = ref<Task[]>([]);
  const stats = ref<any>(null);
  const teamMembers = ref<UserType[]>([]);
  const projects = ref<Project[]>([]);
  const teams = ref<Team[]>([]);
  const isLoading = ref(false);

  const activeTask = ref<Task | null>(null);
  const activeSubtaskId = ref<string | null>(null);

  const newTask = ref({
    title: '',
    description: '',
    status: TaskStatus.TODO as TaskStatus,
    priority: 'MEDIUM',
    tags: [] as string[],
    dueDate: '',
    assigneeId: '',
    projectId: '',
    teamId: '',
    participantIds: [] as string[],
  });

  const parseTaskProps = (task: Task): Task => {
    if (task.tags && typeof task.tags === 'string') {
      try {
        task.parsedTags = JSON.parse(task.tags);
      } catch {
        task.parsedTags = [];
      }
    } else if (Array.isArray(task.tags)) {
      task.parsedTags = task.tags;
    } else {
      task.parsedTags = [];
    }

    if (task.subtasks && typeof task.subtasks === 'string') {
      try {
        task.parsedSubtasks = JSON.parse(task.subtasks);
      } catch {
        task.parsedSubtasks = [];
      }
    } else if (Array.isArray(task.subtasks)) {
      task.parsedSubtasks = task.subtasks;
    } else {
      task.parsedSubtasks = [];
    }
    return task;
  };

  const parseTasksList = (list: Task[]): Task[] => {
    return list.map(parseTaskProps);
  };

  const fetchTasks = async () => {
    const tid = workspaceStore.activeTeamId || 'personal';
    if (tasks.value.length === 0) {
      isLoading.value = true;
    }
    try {
      const response = await api.get('/api/tasks');
      const parsed = parseTasksList(response.data);
      tasks.value = parsed;
      cachedTasksByTeam.value[tid] = parsed;
    } catch {
      ElMessage.error(t('tasks.fetchFailed'));
    } finally {
      isLoading.value = false;
    }
  };

  const fetchStats = async () => {
    const tid = workspaceStore.activeTeamId || 'personal';
    try {
      const response = await api.get('/api/tasks/stats');
      stats.value = response.data;
      cachedStatsByTeam.value[tid] = response.data;
    } catch {
      // silently fail
    }
  };

  const fetchTeamMembers = async (teamId?: string) => {
    try {
      const tid = teamId || workspaceStore.activeTeamId;
      if (!tid) return;
      const response = await api.get(`/api/teams/${tid}/members`);
      const list = response.data?.map((m: { user: UserType }) => m.user) || [];
      teamMembers.value = list;
      cachedTeamMembersByTeam.value[tid] = list;
    } catch {
      // silently fail
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await api.get('/api/teams');
      teams.value = response.data;
      cachedTeams.value = response.data;
    } catch {
      // silently fail
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await api.get('/api/projects');
      projects.value = response.data;
      const tid = workspaceStore.activeTeamId || 'personal';
      cachedProjectsByTeam.value[tid] = response.data;
    } catch {
      // silently fail
    }
  };

  const handleTaskUpdated = (updatedTask?: Task) => {
    const tid = workspaceStore.activeTeamId || 'personal';
    if (updatedTask && updatedTask.id) {
      const parsedTask = parseTaskProps(updatedTask);
      const idx = tasks.value.findIndex((t) => t.id === parsedTask.id);
      if (idx !== -1) {
        tasks.value[idx] = parsedTask;
      } else {
        tasks.value.push(parsedTask);
      }
      if (activeTask.value && activeTask.value.id === parsedTask.id) {
        activeTask.value = parsedTask;
      }
      cachedTasksByTeam.value[tid] = [...tasks.value];
      fetchStats();
    } else {
      fetchTasks();
      fetchStats();
    }
  };

  const handleAddTaskWithPayload = async (payload: {
    title: string;
    description?: string;
    status: string;
    priority: string;
    tags: string[];
    dueDate: string;
    assigneeId?: string | null;
    projectId?: string | null;
    teamId?: string | null;
    participantIds?: string[];
    recurrence?: string | null;
  }) => {
    const tid = workspaceStore.activeTeamId || 'personal';
    try {
      const formattedPayload = {
        ...payload,
        tags: payload.tags.length > 0 ? JSON.stringify(payload.tags) : null,
        assigneeId: payload.assigneeId || null,
        projectId: payload.projectId || null,
        teamId: payload.teamId || null,
        recurrence: payload.recurrence || null,
        participantIds:
          payload.participantIds && payload.participantIds.length > 0
            ? payload.participantIds
            : undefined,
      };
      const response = await api.post('/api/tasks', formattedPayload);
      ElMessage.success(t('tasks.addSuccess'));
      tasks.value.push(parseTaskProps(response.data));
      cachedTasksByTeam.value[tid] = [...tasks.value];
      fetchStats();
      return true;
    } catch (error) {
      const errMsg = getApiErrorMessage(error, t('tasks.addFailed'));
      if (errMsg === '部分指定人员不在该团队中') {
        ElMessage.error(t('tasks.memberNotInTeam'));
      } else {
        ElMessage.error(errMsg);
      }
      return false;
    }
  };

  const deleteTask = (task: Task) => {
    return new Promise<boolean>((resolve) => {
      ElMessageBox.confirm(t('tasks.deleteConfirm'), t('tasks.tip'), {
        type: 'warning',
        confirmButtonText: t('tasks.confirmDelete'),
        cancelButtonText: t('common.cancel'),
      })
        .then(async () => {
          const tid = workspaceStore.activeTeamId || 'personal';
          try {
            await api.delete(`/api/tasks/${task.id}`);
            ElMessage.success(t('tasks.deleteSuccess'));
            tasks.value = tasks.value.filter((t) => t.id !== task.id);
            cachedTasksByTeam.value[tid] = [...tasks.value];
            fetchStats();
            resolve(true);
          } catch {
            ElMessage.error(t('tasks.deleteFailed'));
            resolve(false);
          }
        })
        .catch(() => {
          resolve(false);
        });
    });
  };

  const autoSaveTask = async (payload: TaskUpdatePayload | Task) => {
    if (!activeTask.value) return;
    const tid = workspaceStore.activeTeamId || 'personal';
    try {
      if ('id' in payload) {
        const parsedPayload = parseTaskProps(payload as Task);
        activeTask.value = parsedPayload;
        const idx = tasks.value.findIndex((t) => t.id === parsedPayload.id);
        if (idx !== -1) {
          tasks.value[idx] = parsedPayload;
        }
        cachedTasksByTeam.value[tid] = [...tasks.value];
        fetchStats();
        return;
      }

      const response = await api.put(`/api/tasks/${activeTask.value.id}`, payload);
      const updated = parseTaskProps(response.data);
      activeTask.value = updated;
      const idx = tasks.value.findIndex((t) => t.id === updated.id);
      if (idx !== -1) {
        tasks.value[idx] = updated;
      }
      cachedTasksByTeam.value[tid] = [...tasks.value];
      fetchStats();
    } catch (error: unknown) {
      ElMessage.error(getApiErrorMessage(error, '保存任务失败'));
      fetchTasks();
    }
  };

  const handleUpdateSubtask = async (
    parentId: string,
    subtaskIndex: number,
    fields: Record<string, unknown>,
  ) => {
    const parent = tasks.value.find((t) => t.id === parentId);
    if (!parent) return;
    const tid = workspaceStore.activeTeamId || 'personal';
    try {
      let subtasksList: Subtask[] = [];
      if (parent.subtasks) {
        subtasksList = JSON.parse(parent.subtasks as string);
      }
      if (subtasksList[subtaskIndex]) {
        subtasksList[subtaskIndex] = {
          ...subtasksList[subtaskIndex],
          ...fields,
        } as Subtask;
      }
      const response = await api.put(`/api/tasks/${parentId}`, {
        subtasks: JSON.stringify(subtasksList),
      });
      ElMessage.success('子任务已更新');
      const parsed = parseTaskProps(response.data);
      const idx = tasks.value.findIndex((t) => t.id === parentId);
      if (idx !== -1) {
        tasks.value[idx] = parsed;
      }
      if (activeTask.value && activeTask.value.id === parentId) {
        activeTask.value = parsed;
      }
      cachedTasksByTeam.value[tid] = [...tasks.value];
      fetchStats();
    } catch {
      ElMessage.error('更新子任务失败');
    }
  };

  const handleSubtaskDrag = async (
    parentId: string,
    subtaskIndex: number,
    columnId: string,
    groupBy: 'status' | 'priority' | 'assignee' | 'dueDate',
  ) => {
    const parent = tasks.value.find((t) => t.id === parentId);
    if (!parent) return;
    const tid = workspaceStore.activeTeamId || 'personal';
    try {
      let subtasksList: Subtask[] = [];
      if (parent.subtasks) {
        subtasksList = JSON.parse(parent.subtasks as string);
      }
      if (subtasksList[subtaskIndex]) {
        if (groupBy === 'status') {
          subtasksList[subtaskIndex].done = columnId === TaskStatus.DONE;
        } else if (groupBy === 'assignee') {
          subtasksList[subtaskIndex].assigneeId = columnId === 'unassigned' ? null : columnId;
        }
      }
      const response = await api.put(`/api/tasks/${parentId}`, {
        subtasks: JSON.stringify(subtasksList),
      });
      ElMessage.success('子任务已更新');
      const parsed = parseTaskProps(response.data);
      const idx = tasks.value.findIndex((t) => t.id === parentId);
      if (idx !== -1) {
        tasks.value[idx] = parsed;
      }
      if (activeTask.value && activeTask.value.id === parentId) {
        activeTask.value = parsed;
      }
      cachedTasksByTeam.value[tid] = [...tasks.value];
      fetchStats();
    } catch {
      ElMessage.error('更新子任务失败');
    }
  };

  watch(
    () => workspaceStore.activeTeamId,
    (newTeamId) => {
      const tid = newTeamId || 'personal';
      if (cachedTasksByTeam.value[tid]) {
        tasks.value = cachedTasksByTeam.value[tid];
      } else {
        tasks.value = [];
      }
      if (cachedStatsByTeam.value[tid]) {
        stats.value = cachedStatsByTeam.value[tid];
      } else {
        stats.value = {
          totalTasks: 0,
          completedTasks: 0,
          completionRate: 0,
          overdueTasks: 0,
          byPriority: { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 },
          byStatus: { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 },
        };
      }
      if (cachedTeamMembersByTeam.value[tid]) {
        teamMembers.value = cachedTeamMembersByTeam.value[tid];
      } else {
        teamMembers.value = [];
      }
      if (cachedProjectsByTeam.value[tid]) {
        projects.value = cachedProjectsByTeam.value[tid];
      } else {
        projects.value = [];
      }
      if (cachedTeams.value && cachedTeams.value.length > 0) {
        teams.value = cachedTeams.value;
      } else {
        teams.value = [];
      }
      fetchTasks();
      fetchStats();
      fetchTeamMembers();
      fetchProjects();
      fetchTeams();
    },
    { immediate: true },
  );

  return {
    tasks,
    stats,
    teamMembers,
    projects,
    teams,
    isLoading,
    activeTask,
    activeSubtaskId,
    newTask,
    parseTaskProps,
    fetchTasks,
    fetchStats,
    fetchTeamMembers,
    fetchProjects,
    fetchTeams,
    handleTaskUpdated,
    handleAddTaskWithPayload,
    deleteTask,
    autoSaveTask,
    handleUpdateSubtask,
    handleSubtaskDrag,
  };
}
