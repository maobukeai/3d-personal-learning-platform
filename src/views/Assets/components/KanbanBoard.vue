<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { Calendar, UserPlus } from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import api from '@/utils/api';
import { ElMessage } from 'element-plus';
import { getTaskDayIndex, getTaskTime } from '@/utils/taskSort';
import type { Project, Task } from '@/types';

const props = defineProps<{
  project: Project | null;
  isMember: boolean;
  searchQuery: string;
  dateFilter: string;
  assigneeFilter: string;
  sortBy?: 'natural' | 'createdAt_asc' | 'createdAt_desc';
}>();

const emit = defineEmits<{
  (e: 'edit-task', task: Task): void;
  (e: 'open-profile', userId: string): void;
  (e: 'refresh'): void;
}>();

const authStore = useAuthStore();
const draggedTask = ref<Task | null>(null);
const dragOverColumn = ref<string | null>(null);
type TaskStatus = Task['status'];

const updateTaskStatus = async (task: Task, newStatus: Task['status']) => {
  if (task.status === newStatus) return;
  const originalStatus = task.status;
  task.status = newStatus;
  try {
    await api.put(`/api/projects/tasks/${task.id}`, {
      ...task,
      status: newStatus,
    });
    emit('refresh');
  } catch {
    task.status = originalStatus;
    ElMessage.error('更新状态失败');
  }
};

const onDragStart = (task: Task, event: DragEvent) => {
  draggedTask.value = task;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.dropEffect = 'move';
    event.dataTransfer.setData('text/plain', task.id);
  }
};

const onDragOver = (columnId: string, event: DragEvent) => {
  event.preventDefault();
  dragOverColumn.value = columnId;
};

const onDrop = (columnId: string, event: DragEvent) => {
  event.preventDefault();
  dragOverColumn.value = null;
  if (draggedTask.value && draggedTask.value.status !== columnId) {
    updateTaskStatus(draggedTask.value, columnId as Task['status']);
  }
  draggedTask.value = null;
};

const onDragEnd = () => {
  draggedTask.value = null;
  dragOverColumn.value = null;
};

const tasksByStatus = computed<Record<TaskStatus, Task[]>>(() => {
  if (!props.project?.tasks) return { TODO: [], IN_PROGRESS: [], DONE: [] };

  let filtered = props.project.tasks;

  // Search Filter
  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (t: Task) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q),
    );
  }

  // Date Filter
  if (props.dateFilter !== 'all') {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (props.dateFilter === 'overdue') {
      filtered = filtered.filter(
        (t: Task) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE',
      );
    } else if (props.dateFilter === 'today') {
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (t: Task) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= endOfDay,
      );
    } else if (props.dateFilter === 'week') {
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + 7);
      filtered = filtered.filter(
        (t: Task) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= endOfWeek,
      );
    }
  }

  // Assignee Filter
  if (props.assigneeFilter === 'me' && authStore.user) {
    filtered = filtered.filter((t: Task) => t.assigneeId === authStore.user?.id);
  }

  // Apply sorting
  const activeSort = props.sortBy || 'natural';
  if (activeSort === 'natural') {
    filtered = [...filtered].sort((a, b) => {
      const dayA = a && a.title ? getTaskDayIndex(a.title) : Infinity;
      const dayB = b && b.title ? getTaskDayIndex(b.title) : Infinity;
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      return getTaskTime(a) - getTaskTime(b);
    });
  } else if (activeSort === 'createdAt_asc') {
    filtered = [...filtered].sort((a, b) => getTaskTime(a) - getTaskTime(b));
  } else if (activeSort === 'createdAt_desc') {
    filtered = [...filtered].sort((a, b) => getTaskTime(b) - getTaskTime(a));
  }

  return {
    TODO: filtered.filter((t: Task) => t.status === 'TODO'),
    IN_PROGRESS: filtered.filter((t: Task) => t.status === 'IN_PROGRESS'),
    DONE: filtered.filter((t: Task) => t.status === 'DONE'),
  };
});
</script>

<template>
  <div class="absolute inset-0 p-3 md:p-8 overflow-y-auto md:overflow-x-auto">
    <div
      class="flex flex-col md:flex-row gap-4 md:gap-8 md:h-full pb-4 items-stretch md:min-w-max mobile-adaptive"
    >
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
        class="w-full md:w-[340px] flex flex-col bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl md:rounded-[2rem] border-t-4 transition-all md:h-full"
        :class="[
          col.color,
          dragOverColumn === col.id ? 'bg-slate-200/50 dark:bg-slate-700/50 scale-[1.02]' : '',
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
            class="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-xs font-bold text-slate-500 shadow-sm border border-[var(--border-base)]"
            >{{ tasksByStatus[col.id as TaskStatus].length }}</span
          >
        </div>

        <!-- Column Body (Task List) -->
        <div class="flex-1 overflow-y-auto px-4 pb-4 space-y-4 scrollbar-hide">
          <div
            v-for="task in tasksByStatus[col.id as TaskStatus]"
            :key="task.id"
            draggable="true"
            class="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border hover:shadow-xl hover:-translate-y-1 transition-all cursor-grab active:cursor-grabbing group"
            style="border-color: var(--border-base)"
            @dragstart="onDragStart(task, $event)"
            @dragend="onDragEnd"
            @click="emit('edit-task', task)"
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
                  @click.stop="emit('open-profile', task.assignee.id)"
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
                  v-if="task.assignee && task.participants && task.participants.length > 0"
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
                    @click.stop="p.user && emit('open-profile', p.user.id)"
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
            v-if="tasksByStatus[col.id as TaskStatus].length === 0"
            class="h-20 md:h-32 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 text-xs font-bold opacity-50"
          >
            拖拽任务至此
          </div>
        </div>
      </div>
    </div>
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
</style>
