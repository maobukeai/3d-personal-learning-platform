import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { TaskStatus } from '@/types/task';
import type { Task } from '@/types/task';
import { getPriorityOption, formatDueDate, isTaskOverdue } from '@/utils/taskDisplay'; // * * A single task projected into display-ready fields shared by every view. * Raw `task` is kept alongside the derived fields so views can reach back to * ids / relations when needed (e.g. opening the detail drawer).
export interface TaskPresentationItem {
  task: Task;
  displayTitle: string;
  displayStatus: string;
  displayPriority: string;
  displayAssignee: string;
  displayDueDate: string;
  isOverdue: boolean;
  isCompleted: boolean;
}
export interface BoardColumn {
  // * Group key (a status / priority / assignee id / due-date bucket).
  status: string;
  title: string;
  tasks: TaskPresentationItem[];
}
export interface CalendarDay {
  date: Date;
  tasks: TaskPresentationItem[];
  isCurrentMonth: boolean;
  isToday: boolean;
}
export type TaskGroupBy = 'status' | 'priority' | 'assignee' | 'dueDate';
export interface TaskPresentation {
  // * Board layout — one entry per group column.
  columns: ComputedRef<BoardColumn[]>; // * List layout — flat row list.
  rows: ComputedRef<TaskPresentationItem[]>; // * Calendar layout — 42-cell month grid with tasks per day.
  calendarDays: ComputedRef<CalendarDay[]>; // * Generic `Record<groupKey, items>` view of the active grouping.
  grouped: ComputedRef<Record<string, TaskPresentationItem[]>>;
}
const STATUS_LABELS: Record<string, string> = {
  TODO: '待办',
  IN_PROGRESS: '进行中',
  DONE: '已完成',
};
const PRIORITY_ORDER = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const;
const DUE_DATE_GROUPS = [
  { key: 'overdue', title: '已逾期' },
  { key: 'today', title: '今天截止' },
  { key: 'tomorrow', title: '明天截止' },
  { key: 'week', title: '本周截止' },
  { key: 'future', title: '以后截止' },
  { key: 'none', title: '无截止日期' },
] as const;
const isSameDay = (d1: Date, d2: Date): boolean =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate(); // * * Maps a due date (or its absence) to a bucket key used by the `dueDate` * grouping. Mirrors the logic in TaskBoard.vue `getDueDateGroup`.
const getDueDateGroup = (dateStr: string | null | undefined, status: string): string => {
  if (!dateStr) return 'none';
  const d = new Date(dateStr);
  const now = new Date();
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.ceil((dDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return status === TaskStatus.DONE ? 'none' : 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'week';
  return 'future';
}; // * * Projects a raw `Task` into a display-ready `TaskPresentationItem`, deriving * all label / state fields from the existing `taskDisplay` formatters so the * Board / List / Calendar views stay consistent.
const toPresentationItem = (task: Task): TaskPresentationItem => {
  const priorityOption = getPriorityOption(task.priority);
  return {
    task,
    displayTitle: task.title || '未命名任务',
    displayStatus: STATUS_LABELS[task.status] ?? task.status,
    displayPriority: priorityOption.label,
    displayAssignee: task.assignee?.name || task.participants?.[0]?.user?.name || '未指派',
    displayDueDate: formatDueDate(task.dueDate),
    isOverdue: isTaskOverdue(task),
    isCompleted: task.status === TaskStatus.DONE,
  };
}; // * * View-model composable that transforms the (already filtered/sorted) task list * into the shapes consumed by the Board, List and Calendar views. * * @param tasks the filtered task list — typically `useTaskQuery().filteredTasks`. * @param options.groupBy active board grouping (default `'status'`).
export function useTaskPresentation(
  tasks: Ref<Task[]>,
  options?: { groupBy?: TaskGroupBy },
): TaskPresentation {
  const groupBy = ref<TaskGroupBy>(options?.groupBy ?? 'status');
  const rows = computed<TaskPresentationItem[]>(() =>
    tasks.value.map(toPresentationItem),
  ) as ComputedRef<TaskPresentationItem[]>;
  const grouped = computed<Record<string, TaskPresentationItem[]>>(() => {
    const map: Record<string, TaskPresentationItem[]> = {};
    if (groupBy.value === 'status') {
      ([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE] as string[]).forEach((s) => {
        map[s] = [];
      });
      rows.value.forEach((item) => {
        const key = item.task.status || TaskStatus.TODO;
        if (!map[key]) map[key] = [];
        map[key].push(item);
      });
    } else if (groupBy.value === 'priority') {
      PRIORITY_ORDER.forEach((p) => {
        map[p] = [];
      });
      rows.value.forEach((item) => {
        const key = item.task.priority || 'NONE';
        if (!map[key]) map[key] = [];
        map[key].push(item);
      });
    } else if (groupBy.value === 'assignee') {
      map['unassigned'] = [];
      rows.value.forEach((item) => {
        const key = item.task.assigneeId || 'unassigned';
        if (!map[key]) map[key] = [];
        map[key].push(item);
      });
    } else {
      DUE_DATE_GROUPS.forEach((g) => {
        map[g.key] = [];
      });
      rows.value.forEach((item) => {
        const key = getDueDateGroup(item.task.dueDate, item.task.status);
        if (!map[key]) map[key] = [];
        map[key].push(item);
      });
    }
    return map;
  }) as ComputedRef<Record<string, TaskPresentationItem[]>>;
  const columns = computed<BoardColumn[]>(() => {
    const groups = grouped.value;
    if (groupBy.value === 'status') {
      return [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.DONE]
        .filter((s) => (groups[s]?.length ?? 0) > 0)
        .map((s) => ({ status: s, title: STATUS_LABELS[s] ?? s, tasks: groups[s] ?? [] }));
    }
    if (groupBy.value === 'priority') {
      return PRIORITY_ORDER.filter((p) => (groups[p]?.length ?? 0) > 0).map((p) => ({
        status: p,
        title: getPriorityOption(p).label,
        tasks: groups[p] ?? [],
      }));
    }
    if (groupBy.value === 'assignee') {
      return Object.keys(groups)
        .filter((key) => (groups[key]?.length ?? 0) > 0)
        .map((key) => {
          const first = groups[key]?.[0];
          const title = key === 'unassigned' ? '未指派' : first?.task.assignee?.name || key;
          return { status: key, title, tasks: groups[key] ?? [] };
        });
    } // dueDate
    return DUE_DATE_GROUPS.filter((g) => (groups[g.key]?.length ?? 0) > 0).map((g) => ({
      status: g.key,
      title: g.title,
      tasks: groups[g.key] ?? [],
    }));
  }) as ComputedRef<BoardColumn[]>; // --- calendar grid (current month, 42 cells) ---
  const today = new Date();
  const currentYear = ref<number>(today.getFullYear());
  const currentMonth = ref<number>(today.getMonth()); // 0-indexed
  const calendarDays = computed<CalendarDay[]>(() => {
    const year = currentYear.value;
    const month = currentMonth.value;
    const firstDayOfMonth = new Date(year, month, 1);
    let startDayOfWeek = firstDayOfMonth.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Mon-first
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const cells: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = []; // Previous-month padding.
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      cells.push({ date, isCurrentMonth: false, isToday: isSameDay(date, today) });
    } // Current-month days.
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      cells.push({ date, isCurrentMonth: true, isToday: isSameDay(date, today) });
    } // Next-month padding to fill 42 cells.
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      cells.push({ date, isCurrentMonth: false, isToday: isSameDay(date, today) });
    }
    return cells.map((cell) => ({
      ...cell,
      tasks: rows.value.filter((item) => {
        if (!item.task.dueDate) return false;
        return isSameDay(new Date(item.task.dueDate), cell.date);
      }),
    }));
  }) as ComputedRef<CalendarDay[]>;
  return { columns, rows, calendarDays, grouped };
}
export type UseTaskPresentationReturn = ReturnType<typeof useTaskPresentation>;
