import { ref, computed, watch } from 'vue';
import type { Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { TaskStatus } from '@/types/task';
import type { Task, Project, UserType } from '@/types/task';
import { getTaskDayIndex, getTaskTime } from '@/utils/taskSort';
import { isTaskOverdue } from '@/utils/taskDisplay';

interface UseTaskFiltersProps {
  tasks: Ref<Task[]>;
  teamMembers: Ref<UserType[]>;
  projects: Ref<Project[]>;
  userId: string | undefined;
}

export function useTaskFilters({ tasks, teamMembers, projects, userId }: UseTaskFiltersProps) {
  const { t } = useI18n();
  const route = useRoute();
  const router = useRouter();

  const searchQuery = ref('');
  const dateFilter = ref('all');
  const statusFilter = ref('all');
  const priorityFilter = ref('all');
  const customDate = ref('');
  const hideCompleted = ref(false);
  const onlyMyTasks = ref(false);
  const sortBy = ref<'natural' | 'createdAt_asc' | 'createdAt_desc'>(
    (localStorage.getItem('task_sort_by') as
      | 'natural'
      | 'createdAt_asc'
      | 'createdAt_desc'
      | null) || 'natural',
  );
  const sortOrder = ref<'asc' | 'desc'>('asc');
  const assigneeFilter = ref<string>('all');
  const tagFilter = ref<string>('all');
  const subtaskDisplay = ref<'collapse' | 'expand' | 'separate'>('collapse');
  const selectedProjectId = ref<string | null>((route.query.projectId as string) || null);
  const groupBy = ref<'status' | 'priority' | 'assignee' | 'dueDate'>('status');

  watch(sortBy, (newVal) => {
    localStorage.setItem('task_sort_by', newVal);
  });

  watch(
    () => route.query.projectId,
    (newVal) => {
      selectedProjectId.value = (newVal as string) || null;
    },
  );

  watch(selectedProjectId, (newVal) => {
    const currentQuery = { ...route.query };
    if (newVal) {
      if (currentQuery.projectId !== newVal) {
        router.replace({ query: { ...currentQuery, projectId: newVal } });
      }
    } else {
      if (currentQuery.projectId !== undefined) {
        router.replace({ query: { ...currentQuery, projectId: undefined } });
      }
    }
  });

  const clearProjectFilter = () => {
    selectedProjectId.value = null;
  };

  const isAnyFilterActive = computed(() => {
    return (
      searchQuery.value !== '' ||
      dateFilter.value !== 'all' ||
      statusFilter.value !== 'all' ||
      priorityFilter.value !== 'all' ||
      assigneeFilter.value !== 'all' ||
      tagFilter.value !== 'all' ||
      subtaskDisplay.value !== 'collapse' ||
      hideCompleted.value ||
      onlyMyTasks.value ||
      selectedProjectId.value !== null
    );
  });

  const resetAllFilters = () => {
    searchQuery.value = '';
    dateFilter.value = 'all';
    statusFilter.value = 'all';
    priorityFilter.value = 'all';
    assigneeFilter.value = 'all';
    tagFilter.value = 'all';
    subtaskDisplay.value = 'collapse';
    hideCompleted.value = false;
    onlyMyTasks.value = false;
    selectedProjectId.value = null;
  };

  const filteredTasks = computed(() => {
    let filtered = tasks.value;

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          (t.parsedTags && t.parsedTags.some((tag: string) => tag.toLowerCase().includes(q))),
      );
    }

    if (assigneeFilter.value !== 'all') {
      if (assigneeFilter.value === 'unassigned') {
        filtered = filtered.filter((t) => !t.assigneeId);
      } else {
        filtered = filtered.filter((t) => t.assigneeId === assigneeFilter.value);
      }
    }

    if (tagFilter.value !== 'all') {
      filtered = filtered.filter((t) => {
        return t.parsedTags && t.parsedTags.includes(tagFilter.value);
      });
    }

    if (dateFilter.value !== 'all') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      if (dateFilter.value === 'overdue') {
        filtered = filtered.filter(
          (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.DONE,
        );
      } else if (dateFilter.value === 'today') {
        filtered = filtered.filter((t) => {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return d >= now && d <= endOfDay;
        });
      } else if (dateFilter.value === 'week') {
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + 7);
        filtered = filtered.filter((t) => {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return d >= now && d <= endOfWeek;
        });
      } else if (dateFilter.value === 'custom' && customDate.value) {
        const selectedDate = new Date(customDate.value);
        selectedDate.setHours(0, 0, 0, 0);
        const selectedEnd = new Date(selectedDate);
        selectedEnd.setHours(23, 59, 59, 999);
        filtered = filtered.filter((t) => {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return d >= selectedDate && d <= selectedEnd;
        });
      }
    }

    if (statusFilter.value !== 'all') {
      filtered = filtered.filter((t) => t.status === statusFilter.value);
    }

    if (priorityFilter.value !== 'all') {
      filtered = filtered.filter((t) => t.priority === priorityFilter.value);
    }

    if (hideCompleted.value) {
      filtered = filtered.filter((t) => t.status !== TaskStatus.DONE);
    }

    if (onlyMyTasks.value && userId) {
      filtered = filtered.filter((t) => t.assigneeId === userId);
    }

    if (selectedProjectId.value) {
      if (selectedProjectId.value === 'unassigned') {
        filtered = filtered.filter((t) => !t.projectId);
      } else {
        filtered = filtered.filter((t) => t.projectId === selectedProjectId.value);
      }
    }

    if (sortBy.value === 'natural') {
      filtered = [...filtered].sort((a, b) => {
        const dayA = a && a.title ? getTaskDayIndex(a.title) : Infinity;
        const dayB = b && b.title ? getTaskDayIndex(b.title) : Infinity;
        if (dayA !== dayB) {
          return dayA - dayB;
        }
        return getTaskTime(a) - getTaskTime(b);
      });
    } else if (sortBy.value === 'createdAt_asc') {
      filtered = [...filtered].sort((a, b) => getTaskTime(a) - getTaskTime(b));
    } else if (sortBy.value === 'createdAt_desc') {
      filtered = [...filtered].sort((a, b) => getTaskTime(b) - getTaskTime(a));
    }

    if (sortOrder.value === 'desc') {
      filtered = [...filtered].reverse();
    }

    return filtered;
  });

  const allTags = computed(() => {
    const tagsSet = new Set<string>();
    tasks.value.forEach((t) => {
      if (t.parsedTags) {
        t.parsedTags.forEach((tag) => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet);
  });

  const processedTasks = computed(() => {
    const list = filteredTasks.value;
    if (subtaskDisplay.value === 'separate') {
      const flattened: Task[] = [];
      list.forEach((t) => {
        flattened.push(t);
        if (t.parsedSubtasks && Array.isArray(t.parsedSubtasks)) {
          t.parsedSubtasks.forEach((sub, index: number) => {
            flattened.push({
              id: `${t.id}_sub_${index}`,
              title: sub.text,
              description: `子任务来自: ${t.title}`,
              status: sub.done ? TaskStatus.DONE : TaskStatus.TODO,
              priority: t.priority || 'MEDIUM',
              dueDate: t.dueDate,
              assigneeId: sub.assigneeId || null,
              projectId: t.projectId,
              teamId: t.teamId,
              tags: t.tags,
              parsedTags: t.parsedTags,
              isSubtask: true,
              parentId: t.id,
              subtaskIndex: index,
              project: t.project,
              assignee: sub.assigneeId
                ? teamMembers.value.find((m) => m.id === sub.assigneeId)
                : null,
            });
          });
        }
      });
      return flattened;
    }
    return list;
  });

  const tasksByProject = computed(() => {
    const filtered = processedTasks.value;
    const projectMap: Record<string, { id: string | null; name: string; tasks: Task[] }> = {};

    projectMap['unassigned'] = {
      id: null,
      name: t('projects.unassignedProject'),
      tasks: [],
    };

    projects.value.forEach((p) => {
      projectMap[p.id] = {
        id: p.id,
        name: p.title,
        tasks: [],
      };
    });

    filtered.forEach((taskItem) => {
      const pid = taskItem.projectId || 'unassigned';
      if (!projectMap[pid]) {
        projectMap[pid] = {
          id: taskItem.projectId || null,
          name: taskItem.project?.title || t('projects.unknownProject'),
          tasks: [],
        };
      }
      projectMap[pid].tasks.push(taskItem);
    });

    const result = Object.values(projectMap).filter((g) => g.tasks.length > 0);

    result.sort((a, b) => {
      if (a.id === null) return 1;
      if (b.id === null) return -1;
      return a.name.localeCompare(b.name);
    });

    return result;
  });

  const getDueDateGroup = (dateStr: string | null | undefined, status: string): string => {
    if (!dateStr) return 'none';
    const d = new Date(dateStr);
    const now = new Date();

    const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = dDate.getTime() - nowDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return status === 'DONE' ? 'none' : 'overdue';
    }
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays <= 7) return 'week';
    return 'future';
  };

  const tasksByGroup = computed(() => {
    const filtered = processedTasks.value;
    const map: Record<string, Task[]> = {};

    if (groupBy.value === 'status') {
      map[TaskStatus.TODO] = [];
      map[TaskStatus.IN_PROGRESS] = [];
      map[TaskStatus.DONE] = [];
      filtered.forEach((t) => {
        const status = t.status || TaskStatus.TODO;
        if (map[status]) map[status].push(t);
      });
    } else if (groupBy.value === 'priority') {
      map['URGENT'] = [];
      map['HIGH'] = [];
      map['MEDIUM'] = [];
      map['LOW'] = [];
      map['NONE'] = [];
      filtered.forEach((t) => {
        const p = t.priority || 'NONE';
        if (map[p]) {
          map[p].push(t);
        } else {
          map['NONE'].push(t);
        }
      });
    } else if (groupBy.value === 'assignee') {
      map['unassigned'] = [];
      teamMembers.value.forEach((m) => {
        map[m.id] = [];
      });
      filtered.forEach((t) => {
        if (!t.assigneeId || !map[t.assigneeId]) {
          map['unassigned'].push(t);
        } else {
          map[t.assigneeId].push(t);
        }
      });
    } else if (groupBy.value === 'dueDate') {
      map['overdue'] = [];
      map['today'] = [];
      map['tomorrow'] = [];
      map['week'] = [];
      map['future'] = [];
      map['none'] = [];
      filtered.forEach((t) => {
        const group = getDueDateGroup(t.dueDate, t.status);
        if (map[group]) map[group].push(t);
      });
    }
    return map;
  });

  const boardTasksByGroup = computed(() => tasksByGroup.value);
  const listTasksByProject = computed(() => tasksByProject.value);
  const calendarTasks = computed(() => processedTasks.value);

  const completionRate = computed(() => {
    const total = tasks.value.length;
    if (total === 0) return 0;
    return Math.round(
      (tasks.value.filter((t) => t.status === TaskStatus.DONE).length / total) * 100,
    );
  });

  const overdueCount = computed(() => {
    return tasks.value.filter((t) => isTaskOverdue(t)).length;
  });

  return {
    searchQuery,
    dateFilter,
    statusFilter,
    priorityFilter,
    customDate,
    hideCompleted,
    onlyMyTasks,
    sortBy,
    sortOrder,
    assigneeFilter,
    tagFilter,
    subtaskDisplay,
    selectedProjectId,
    groupBy,
    isAnyFilterActive,
    filteredTasks,
    allTags,
    processedTasks,
    boardTasksByGroup,
    listTasksByProject,
    calendarTasks,
    completionRate,
    overdueCount,
    clearProjectFilter,
    resetAllFilters,
  };
}
