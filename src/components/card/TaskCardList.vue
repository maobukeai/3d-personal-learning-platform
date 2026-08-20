<script setup lang="ts">
import {
  Calendar,
  Eye,
  CheckCircle2,
  Trash2,
  FolderOpen,
  CheckSquare,
  Clock,
  Repeat,
  User,
} from 'lucide-vue-next';
import { TaskStatus } from '@/types';
import { parseTags, getTagClass } from '@/utils/tags';
import { getPriorityColorClass, isOverdue } from '@/utils/taskDisplay';
import UserAvatar from '@/components/UserAvatar.vue';
import { useTaskCardState, type TaskCardProps, type TaskCardEmits } from './useTaskCardState';

const props = withDefaults(defineProps<TaskCardProps>(), {
  layout: 'list',
  config: () => ({
    assignee: true,
    dueDate: true,
    priority: true,
    project: true,
    subtasks: true,
    description: true,
    timeTracking: true,
  }),
  teamMembers: () => [],
});

const emit = defineEmits<TaskCardEmits>();

const { isBlocked, timeEstimateHours, timeSpentHours, hasSubtasks, subtasksProgress } =
  useTaskCardState(props, emit);
</script>

<template>
  <div
    class="group flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 px-3 py-2 sm:py-2.5 rounded-xl border hover:border-accent/30 hover:shadow-sm transition-all cursor-pointer glass-real-physical select-none"
    @click="emit('click', task)"
  >
    <!-- Top Row: Priority + Status + Title -->
    <div class="flex items-center gap-2 sm:gap-4 min-w-0 select-none">
      <!-- Priority Dot -->
      <div
        class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0"
        :class="getPriorityColorClass(task.priority)"
      ></div>

      <!-- Status Badge -->
      <span
        class="shrink-0 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[10px] font-bold select-none"
        :class="
          task.status === TaskStatus.TODO
            ? 'bg-slate-500/10 text-slate-500'
            : task.status === TaskStatus.IN_PROGRESS
              ? 'bg-accent/10 text-accent'
              : task.status === TaskStatus.CANCELLED
                ? 'bg-zinc-500/10 text-zinc-500'
                : 'bg-emerald-500/10 text-emerald-500'
        "
      >
        {{
          task.status === TaskStatus.TODO
            ? '待办'
            : task.status === TaskStatus.IN_PROGRESS
              ? '进行中'
              : task.status === TaskStatus.CANCELLED
                ? '已取消'
                : '已完成'
        }}
      </span>

      <span
        v-if="isBlocked"
        class="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider select-none"
        title="等待前置任务完成"
      >
        等待依赖
      </span>

      <span
        v-if="task.recurrence"
        class="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-violet-500/10 text-violet-500 border border-violet-500/20 uppercase tracking-wider select-none"
        :title="`循环任务（${
          task.recurrence === 'DAILY' ? '每天' : task.recurrence === 'WEEKLY' ? '每周' : '每月'
        }）完成后自动生成下一期`"
      >
        <Repeat class="w-2.5 h-2.5" />
      </span>

      <span
        class="text-xs sm:text-sm font-bold truncate group-hover:text-accent transition-colors select-none"
        :class="task.status === TaskStatus.CANCELLED ? 'line-through opacity-60' : ''"
        style="color: var(--text-primary)"
      >
        <span
          v-if="task.isSubtask"
          class="shrink-0 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase tracking-wider scale-90 mr-1 select-none"
        >
          子任务
        </span>
        {{ task.title }}
      </span>
    </div>

    <!-- Metadata -->
    <div
      class="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-1 sm:justify-end min-w-0 select-none"
    >
      <!-- Tags -->
      <div
        v-if="parseTags(task.tags).length > 0"
        class="hidden md:flex flex-wrap gap-1 select-none"
      >
        <span
          v-for="tag in parseTags(task.tags)"
          :key="tag"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
          :class="getTagClass(tag)"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Project -->
      <div
        v-if="task.project"
        class="flex items-center gap-1 text-[10px] sm:text-[10px] font-medium text-accent max-w-[120px] truncate select-none"
      >
        <FolderOpen class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        {{ task.project.title }}
      </div>

      <!-- Subtasks -->
      <div
        v-if="hasSubtasks"
        class="flex items-center gap-1 text-[10px] sm:text-[10px] font-medium text-slate-400 shrink-0 select-none"
        title="子任务进度"
      >
        <CheckSquare class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        <span>{{ subtasksProgress }}</span>
      </div>

      <!-- Time Tracking Indicator (List Mode) -->
      <div
        v-if="task.timeEstimate && config.timeTracking"
        class="flex items-center gap-1.5 text-[10px] sm:text-[10px] font-medium text-slate-400 shrink-0 select-none"
        :title="`预计工时: ${timeEstimateHours.toFixed(1)}h / 已用: ${timeSpentHours.toFixed(1)}h`"
      >
        <Clock class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
        <span :class="timeSpentHours > timeEstimateHours ? 'text-amber-500 font-bold' : ''">
          {{ timeSpentHours.toFixed(1) }}h/{{ timeEstimateHours.toFixed(1) }}h
        </span>
      </div>

      <!-- Assignee Avatar Stack -->
      <div v-if="config.assignee" class="shrink-0 flex items-center select-none">
        <div
          v-if="task.assigneeId && task.participants && task.participants.length > 0"
          class="flex items-center -space-x-1.5"
        >
          <UserAvatar
            v-for="p in task.participants.slice(0, 3)"
            :key="p.userId"
            :user="p.user"
            size="xs"
            borderless
            class="ring-2 ring-white dark:ring-slate-900 cursor-pointer hover:z-10 hover:scale-105 transition-all"
            :title="p.user?.name"
          />
          <span
            v-if="task.participants.length > 3"
            class="text-[10px] font-black text-slate-400 pl-1 select-none"
          >
            +{{ task.participants.length - 3 }}
          </span>
        </div>
        <div v-else-if="task.assigneeId && task.assignee" class="flex items-center">
          <UserAvatar
            :user="task.assignee"
            size="xs"
            borderless
            class="ring-2 ring-white dark:ring-slate-900 cursor-pointer hover:z-10 hover:scale-105 transition-all"
            :title="task.assignee.name"
          />
        </div>
        <div
          v-else
          class="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-dashed border-slate-300 dark:border-white/10"
          title="未指派负责人"
        >
          <User class="w-2.5 h-2.5 text-slate-400" />
        </div>
      </div>

      <!-- Due Date -->
      <div
        v-if="task.dueDate"
        class="flex items-center gap-1 text-[10px] sm:text-[10px] font-medium select-none"
        :class="isOverdue(task.dueDate, task.status) ? 'text-rose-500' : 'text-slate-400'"
      >
        <Calendar class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        <span class="whitespace-nowrap">{{ new Date(task.dueDate).toLocaleDateString() }}</span>
      </div>
    </div>

    <!-- Quick Actions -->
    <div
      class="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity justify-end sm:justify-start select-none"
    >
      <button
        type="button"
        class="p-1.5 rounded-md text-slate-400 hover:text-accent hover:bg-accent/10 transition-all cursor-pointer"
        title="查看详情"
        @click.stop="emit('click', task)"
      >
        <Eye class="w-3.5 h-3.5" />
      </button>
      <button
        v-if="task.status !== 'DONE'"
        type="button"
        class="p-1.5 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all cursor-pointer"
        title="标记完成"
        @click.stop="emit('status-change', task, 'DONE')"
      >
        <CheckCircle2 class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
        title="删除"
        @click.stop="emit('delete', task)"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
