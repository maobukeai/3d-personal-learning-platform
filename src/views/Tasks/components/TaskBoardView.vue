<script setup lang="ts">
import { ref } from 'vue';
import draggable from 'vuedraggable';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { ElMessage } from '@/utils/feedbackBridge';
import { useI18n } from 'vue-i18n';
import TaskCard from '@/components/TaskCard.vue';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { useWorkspaceStore } from '@/stores/workspace';
import type { ActiveColumn, Task, UserType } from '@/types/task';

interface Props {
  tasksByGroup: Record<string, Task[]>;
  activeColumns: ActiveColumn[];
  groupBy: 'status' | 'priority' | 'assignee' | 'dueDate';
  cardSettings: {
    assignee: boolean;
    dueDate: boolean;
    priority: boolean;
    project: boolean;
    subtasks: boolean;
    description: boolean;
  };
  teamMembers: UserType[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'refresh', updatedTask?: Task): void;
  (e: 'refresh-stats'): void;
  (e: 'open-add-dialog', colId: string): void;
  (e: 'open-detail', task: Task): void;
  (e: 'open-profile', userId: string): void;
  (
    e: 'update-subtask',
    parentId: string,
    subtaskIndex: number,
    fields: Record<string, unknown>,
  ): void;
  (e: 'drag-subtask', parentId: string, subtaskIndex: number, columnId: string): void;
}>();

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const inlineTitles = ref<Record<string, string>>({});

/* Collapsed columns (persisted): typically DONE/CANCELLED to keep the board tight */
const loadCollapsedColumns = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem('task_collapsed_columns') || '{}');
  } catch {
    return {};
  }
};
const collapsedColumns = ref<Record<string, boolean>>(loadCollapsedColumns());
const isColumnCollapsed = (colId: string) => Boolean(collapsedColumns.value[colId]);
const toggleColumnCollapse = (colId: string) => {
  collapsedColumns.value = { ...collapsedColumns.value, [colId]: !collapsedColumns.value[colId] };
  localStorage.setItem('task_collapsed_columns', JSON.stringify(collapsedColumns.value));
};

/* Light-weight WIP signal: highlight the IN_PROGRESS column count when overloaded */
const IN_PROGRESS_WIP_LIMIT = 5;
const isColumnOverloaded = (colId: string, count: number): string => {
  const base = 'bg-slate-100 dark:bg-white/5 text-slate-500';
  if (props.groupBy === 'status' && colId === 'IN_PROGRESS' && count > IN_PROGRESS_WIP_LIMIT) {
    return 'bg-orange-500/15 text-orange-500 animate-pulse';
  }
  return base;
};

interface DragChangeEvent {
  added?: {
    element: Task;
  };
}

const onDragChange = async (event: DragChangeEvent, columnId: string) => {
  if (event.added) {
    const task = event.added.element;
    if (task.isSubtask && task.parentId) {
      emit('drag-subtask', task.parentId, task.subtaskIndex ?? 0, columnId);
      return;
    }
    /* Front-end guard: block dragging into DONE while dependencies are unfinished.
       The backend enforces the same rule; this gives immediate feedback + rollback. */
    if (
      props.groupBy === 'status' &&
      columnId === 'DONE' &&
      task.dependencies?.some((d) => d.dependsOn?.status !== 'DONE')
    ) {
      ElMessage.warning(t('tasks.blockedDragWarning'));
      emit('refresh');
      return;
    }
    try {
      const cleanPayload = {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        tags: task.tags,
        dueDate: task.dueDate,
        assigneeId: task.assigneeId,
        projectId: task.projectId,
        subtasks: task.subtasks,
        participantIds: task.participants ? task.participants.map((p) => p.userId) : [],
      };

      if (props.groupBy === 'status') {
        cleanPayload.status = columnId;
      } else if (props.groupBy === 'priority') {
        cleanPayload.priority = columnId;
      } else if (props.groupBy === 'assignee') {
        cleanPayload.assigneeId = columnId === 'unassigned' ? null : columnId;
      } else if (props.groupBy === 'dueDate') {
        const today = new Date();
        if (columnId === 'today') {
          cleanPayload.dueDate = today.toISOString();
        } else if (columnId === 'tomorrow') {
          const tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);
          cleanPayload.dueDate = tomorrow.toISOString();
        } else if (columnId === 'week') {
          const endOfWeek = new Date(today);
          // "本周截止" groups tasks due within the next 7 days (matches getDueDateGroup)
          endOfWeek.setDate(today.getDate() + 7);
          cleanPayload.dueDate = endOfWeek.toISOString();
        } else if (columnId === 'future') {
          const futureDate = new Date(today);
          futureDate.setDate(today.getDate() + 10);
          cleanPayload.dueDate = futureDate.toISOString();
        } else {
          cleanPayload.dueDate = null;
        }
      }

      const res = await api.put(`/api/tasks/${task.id}`, cleanPayload);

      if (props.groupBy === 'status') {
        const labels: Record<string, string> = {
          TODO: t('tasks.todo'),
          IN_PROGRESS: t('tasks.inProgress'),
          DONE: t('tasks.done'),
        };
        ElMessage.success(t('tasks.movedTo', { status: labels[columnId] || columnId }));
      } else if (props.groupBy === 'priority') {
        const labels: Record<string, string> = {
          URGENT: t('tasks.urgent'),
          HIGH: t('tasks.high'),
          MEDIUM: t('tasks.medium'),
          LOW: t('tasks.low'),
          NONE: t('tasks.none'),
        };
        ElMessage.success(t('tasks.priorityUpdated', { priority: labels[columnId] || columnId }));
      } else if (props.groupBy === 'assignee') {
        ElMessage.success('负责人已更新');
      } else if (props.groupBy === 'dueDate') {
        ElMessage.success('截止日期已更新');
      }
      emit('refresh-stats');
      emit('refresh', res.data);
    } catch (error: unknown) {
      ElMessage.error(getApiErrorMessage(error, t('tasks.updateFailed')));
      emit('refresh');
    }
  }
};

const handleInlineAdd = async (columnId: string) => {
  const title = inlineTitles.value[columnId]?.trim();
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
      projectId: null,
      participantIds: [],
    };

    const res = await api.post('/api/tasks', payload);
    ElMessage.success(t('tasks.quickCreateSuccess'));
    inlineTitles.value[columnId] = '';
    emit('refresh', res.data);
    emit('refresh-stats');
  } catch {
    ElMessage.error(t('tasks.quickCreateFailed'));
  }
};

const openAddDialogByCol = (colId: string) => {
  emit('open-add-dialog', colId);
};

const openDetailDrawer = (task: Task) => {
  emit('open-detail', task);
};

const openUserProfile = (userId: string) => {
  emit('open-profile', userId);
};
</script>

<template>
  <div class="mobile-adaptive flex-1 overflow-hidden p-1 sm:p-4">
    <div
      class="mobile-row overflow-x-auto md:gap-4 gap-1.5 sm:gap-2.5 h-full flex w-full scrollbar-hide"
    >
      <div
        v-for="col in activeColumns"
        :key="col.id"
        class="task-board-column flex flex-col h-full rounded-lg sm:rounded-xl transition-colors duration-300 overflow-hidden relative border glass-real-physical select-none"
        :class="
          isColumnCollapsed(col.id)
            ? 'w-10 min-w-[40px] sm:min-w-[40px]'
            : 'flex-1 min-w-[240px] sm:min-w-[260px]'
        "
      >
        <!-- Collapsed strip: click to expand -->
        <button
          v-if="isColumnCollapsed(col.id)"
          type="button"
          class="w-full h-full flex flex-col items-center gap-2 pt-3 pb-2 cursor-pointer group/col select-none"
          :title="t('tasks.expandColumn')"
          @click="toggleColumnCollapse(col.id)"
        >
          <ChevronRight
            class="w-3.5 h-3.5 text-slate-400 group-hover/col:text-accent transition-colors"
          />
          <span
            class="text-[10px] font-black uppercase tracking-widest select-none"
            style="writing-mode: vertical-rl; color: var(--text-primary)"
          >
            {{ col.title }}
          </span>
          <span class="text-[10px] font-bold text-slate-500 select-none">
            {{ tasksByGroup[col.id]?.length || 0 }}
          </span>
        </button>

        <!-- Column Header -->
        <div
          v-if="!isColumnCollapsed(col.id)"
          class="px-1.5 sm:px-4 pt-1.5 sm:pt-3 pb-1 sm:pb-2.5 select-none"
          :class="'bg-gradient-to-b ' + col.headerBg"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1 sm:gap-1.5 min-w-0">
              <div class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0" :class="col.color"></div>
              <h2
                class="text-[10px] sm:text-xs font-black uppercase tracking-wider truncate"
                style="color: var(--text-primary)"
              >
                {{ col.title }}
              </h2>
              <span
                class="hidden sm:inline-block text-[10px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-sm select-none"
                :class="isColumnOverloaded(col.id, tasksByGroup[col.id]?.length || 0)"
              >
                {{ tasksByGroup[col.id]?.length || 0 }}
              </span>
            </div>
            <button
              type="button"
              class="hidden sm:inline-flex p-1 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-all shrink-0"
              :title="t('tasks.collapseColumn')"
              @click="toggleColumnCollapse(col.id)"
            >
              <ChevronLeft class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              class="hidden sm:inline-flex p-1 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-all shrink-0"
              @click="openAddDialogByCol(col.id)"
            >
              <Plus class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Draggable Task List -->
        <draggable
          v-if="!isColumnCollapsed(col.id)"
          :list="tasksByGroup[col.id] || []"
          group="tasks"
          item-key="id"
          class="flex-1 overflow-y-auto space-y-1 sm:space-y-2 px-1 sm:px-3 pb-3 scrollbar-hide min-h-[100px] select-none"
          :animation="250"
          ghost-class="drag-ghost"
          :delay="100"
          :delay-on-touch-only="true"
          :touch-start-threshold="5"
          @change="(e: DragChangeEvent) => onDragChange(e, col.id)"
        >
          <template #item="{ element: task }">
            <div class="select-none">
              <TaskCard
                :task="task"
                layout="board"
                :config="cardSettings"
                :team-members="teamMembers"
                @click="openDetailDrawer"
                @user-click="openUserProfile"
                @refresh="(val) => emit('refresh', val)"
                @refresh-stats="emit('refresh-stats')"
                @update-subtask="(pId, sIdx, fields) => emit('update-subtask', pId, sIdx, fields)"
              />
            </div>
          </template>
        </draggable>

        <!-- Inline Column Quick Add -->
        <div
          v-if="!isColumnCollapsed(col.id)"
          class="px-1 pb-1.5 pt-1 border-t shrink-0 bg-slate-50/30 dark:bg-white/2"
          style="border-color: var(--border-base)"
        >
          <div class="relative flex items-center">
            <input
              v-model="inlineTitles[col.id]"
              type="text"
              :placeholder="t('tasks.quickAddPlaceholder')"
              class="w-full px-1.5 sm:px-2.5 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800/70 focus:bg-white dark:focus:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 focus:border-accent/40 rounded-lg text-[10px] sm:text-[10px] focus:outline-none transition-all pr-8"
              style="color: var(--text-primary)"
              @keyup.enter="handleInlineAdd(col.id)"
            />
            <button
              v-show="inlineTitles[col.id]?.trim()"
              type="button"
              class="absolute right-1 p-0.5 sm:p-1 bg-accent/10 hover:bg-accent hover:text-white text-accent rounded-md transition-all"
              @click="handleInlineAdd(col.id)"
            >
              <Plus class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="
            !isColumnCollapsed(col.id) &&
            (!tasksByGroup[col.id] || tasksByGroup[col.id].length === 0)
          "
          class="absolute inset-x-3 top-16 bottom-14 flex flex-col items-center justify-center border-2 border-dashed rounded-lg sm:rounded-xl opacity-20 hover:opacity-100 hover:border-accent hover:text-accent cursor-pointer transition-all pointer-events-none"
          style="border-color: var(--border-base)"
        >
          <Plus class="w-4 h-4 sm:w-6 sm:h-6 mb-1 sm:mb-2" />
          <p class="hidden sm:block text-[10px] font-bold">{{ t('tasks.dragOrClickToCreate') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-board-column {
  user-select: none;
  -webkit-user-select: none;
}

.drag-ghost {
  opacity: 0.3 !important;
  transform: scale(0.95);
  box-shadow: 0 0 0 2px var(--accent) !important;
  border-radius: var(--radius-section) !important;
  pointer-events: none;
}
</style>
