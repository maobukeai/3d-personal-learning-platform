<script setup lang="ts">
import { computed } from 'vue';
import { TaskStatus } from '@/types';
import {
  Calendar,
  User,
  Eye,
  CheckCircle2,
  Trash2,
  FolderOpen,
  Flame,
  ArrowDown,
  ArrowUp,
  Minus,
  HelpCircle,
  CheckSquare,
  Clock,
} from 'lucide-vue-next';
import { parseTags } from '@/utils/tags';
import api from '@/utils/api';
import { ElMessage } from 'element-plus';

interface Assignee {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface Project {
  id: string;
  title: string;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority?: string;
  tags?: string | null;
  subtasks?: string | null;
  dueDate?: string | null;
  status: string;
  assignee?: Assignee | null;
  project?: Project | null;
  timeEstimate?: number | null;
  timeSpent?: number | null;
  dependencies?: { id: string; dependsOnId: string; dependsOn: { id: string; title: string; status: string } }[];
}

interface Subtask {
  id?: string;
  text?: string;
  done?: boolean;
}

interface CardConfig {
  assignee?: boolean;
  dueDate?: boolean;
  priority?: boolean;
  project?: boolean;
  subtasks?: boolean;
  description?: boolean;
  timeTracking?: boolean;
}

interface Props {
  task: Task;
  layout?: 'board' | 'list';
  config?: CardConfig;
  teamMembers?: Assignee[];
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'board',
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

const isBlocked = computed(() => {
  return props.task.dependencies && props.task.dependencies.some((d) => d.dependsOn?.status !== 'DONE');
});

const timeEstimateHours = computed(() => (props.task.timeEstimate ? props.task.timeEstimate / 60 : 0));
const timeSpentHours = computed(() => (props.task.timeSpent ? props.task.timeSpent / 60 : 0));
const timePercent = computed(() => {
  if (!props.task.timeEstimate) return 0;
  const pct = ((props.task.timeSpent || 0) / props.task.timeEstimate) * 100;
  return Math.min(100, Math.round(pct));
});

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
  } catch (_e) {
    return [];
  }
};

const parsedSubtasks = computed(() => parseSubtasks(props.task.subtasks));
const hasSubtasks = computed(() => parsedSubtasks.value.length > 0);
const subtasksProgress = computed(() => {
  const total = parsedSubtasks.value.length;
  const completed = parsedSubtasks.value.filter((s) => s.done).length;
  return `${completed}/${total}`;
});

const emit = defineEmits<{
  (e: 'click', task: Task): void;
  (e: 'edit', task: Task): void;
  (e: 'delete', task: Task): void;
  (e: 'status-change', task: Task, newStatus: string): void;
  (e: 'user-click', userId: string): void;
  (e: 'refresh', updatedTask?: Task): void;
  (e: 'refresh-stats'): void;
  (e: 'update-subtask', parentId: string, subtaskIndex: number, fields: Record<string, any>): void;
}>();

const getPriorityConfig = (priority?: string) => {
  switch (priority) {
    case 'URGENT':
      return { label: '紧急', color: 'bg-rose-500', textColor: 'text-rose-500', icon: Flame };
    case 'HIGH':
      return { label: '高', color: 'bg-orange-500', textColor: 'text-orange-500', icon: ArrowUp };
    case 'MEDIUM':
      return { label: '中', color: 'bg-amber-500', textColor: 'text-amber-500', icon: Minus };
    case 'LOW':
      return { label: '低', color: 'bg-blue-500', textColor: 'text-blue-500', icon: ArrowDown };
    default:
      return { label: '无', color: 'bg-slate-400', textColor: 'text-slate-400', icon: HelpCircle };
  }
};

const getTagClass = (tag: string) => {
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    'bg-blue-500/10 text-blue-500',
    'bg-purple-500/10 text-purple-500',
    'bg-pink-500/10 text-pink-500',
    'bg-indigo-500/10 text-indigo-500',
    'bg-teal-500/10 text-teal-500',
  ];
  return colors[hash % colors.length];
};

const formatDueDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = dDate.getTime() - nowDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return '今天截止';
  if (diffDays === 1) return '明天截止';
  if (diffDays <= 7) return `${diffDays} 天后截止`;
  return d.toLocaleDateString();
};

const isOverdue = (dateStr: string | null | undefined, status: string) => {
  if (!dateStr || status === 'DONE') return false;
  return new Date(dateStr) < new Date();
};

const updatePriority = async (priority: string) => {
  if ((props.task as any).isSubtask && (props.task as any).parentId) {
    try {
      const res = await api.put(`/api/tasks/${(props.task as any).parentId}`, { priority });
      ElMessage.success('优先级已更新');
      emit('refresh', res.data);
      emit('refresh-stats');
    } catch {
      ElMessage.error('更新优先级失败');
    }
    return;
  }
  try {
    const res = await api.put(`/api/tasks/${props.task.id}`, { priority });
    ElMessage.success('优先级已更新');
    emit('refresh', res.data);
    emit('refresh-stats');
  } catch {
    ElMessage.error('更新优先级失败');
  }
};

const updateAssignee = async (assigneeId: string | null) => {
  if ((props.task as any).isSubtask && (props.task as any).parentId) {
    emit('update-subtask', (props.task as any).parentId, (props.task as any).subtaskIndex, { assigneeId });
    return;
  }
  try {
    const res = await api.put(`/api/tasks/${props.task.id}`, { assigneeId: assigneeId || null });
    ElMessage.success('负责人已更新');
    emit('refresh', res.data);
    emit('refresh-stats');
  } catch {
    ElMessage.error('更新负责人失败');
  }
};

const updateDueDate = async (val: any) => {
  if ((props.task as any).isSubtask && (props.task as any).parentId) {
    try {
      const dueDateVal = val ? new Date(val).toISOString() : null;
      const res = await api.put(`/api/tasks/${(props.task as any).parentId}`, { dueDate: dueDateVal });
      ElMessage.success('截止日期已更新');
      emit('refresh', res.data);
      emit('refresh-stats');
    } catch {
      ElMessage.error('更新截止日期失败');
    }
    return;
  }
  try {
    const dueDateVal = val ? new Date(val).toISOString() : null;
    const res = await api.put(`/api/tasks/${props.task.id}`, { dueDate: dueDateVal });
    ElMessage.success('截止日期已更新');
    emit('refresh', res.data);
    emit('refresh-stats');
  } catch {
    ElMessage.error('更新截止日期失败');
  }
};
</script>

<template>
  <!-- Layout 1: Board (Kanban) Mode -->
  <div
    v-if="layout === 'board'"
    class="group p-1 sm:p-2.5 rounded-lg sm:rounded-xl border shadow-sm hover:shadow-md hover:border-accent/30 transition-all cursor-grab active:cursor-grabbing relative"
    style="background-color: var(--bg-app); border-color: var(--border-base)"
    @click="emit('click', task)"
  >
    <!-- Priority + Title Row -->
    <div class="flex justify-between items-start mb-1 sm:mb-1.5">
      <div class="flex items-start gap-1 sm:gap-2 flex-1 min-w-0">
        <div
          v-if="task.priority && task.priority !== 'NONE'"
          class="shrink-0 w-1 h-1 sm:w-2 sm:h-2 rounded-full mt-1.5 sm:mt-1"
          :class="getPriorityConfig(task.priority).color"
        ></div>
        <span
          v-if="isBlocked"
          class="shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[8px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider scale-90 origin-left"
          title="等待前置任务完成"
        >
          等待依赖
        </span>
        <h3
          class="text-[10px] sm:text-xs font-bold leading-snug group-hover:text-accent transition-colors line-clamp-2"
          style="color: var(--text-primary)"
        >
          <span
            v-if="(task as any).isSubtask"
            class="shrink-0 inline-flex items-center px-1.5 py-0.2 rounded text-[7px] font-black bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase tracking-wider scale-90 mr-1 select-none"
          >
            子任务
          </span>
          {{ task.title }}
        </h3>
      </div>
    </div>

    <!-- Project Tag (Board view) -->
    <div
      v-if="task.project && config.project"
      class="flex items-center gap-1 text-[9px] font-semibold text-accent mb-1.5 truncate"
    >
      <FolderOpen class="w-2.5 h-2.5 text-accent shrink-0" />
      <span>{{ task.project.title }}</span>
    </div>

    <!-- Description -->
    <p
      v-if="task.description && config.description"
      class="hidden sm:block text-[10px] mb-1.5 line-clamp-1 leading-relaxed"
      style="color: var(--text-secondary)"
    >
      {{ task.description }}
    </p>

    <!-- Tags (if any in board mode, parsed) -->
    <div v-if="parseTags(task.tags).length > 0" class="hidden sm:flex flex-wrap gap-1 mb-1.5">
      <span
        v-for="tag in parseTags(task.tags)"
        :key="tag"
        class="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold"
        :class="getTagClass(tag)"
      >
        {{ tag }}
      </span>
    </div>

    <!-- Time Tracking Progress Bar -->
    <div
      v-if="task.timeEstimate && config.timeTracking"
      class="hidden sm:block mt-2 mb-2"
      @click.stop
    >
      <div class="flex items-center justify-between text-[8px] font-bold text-slate-400 dark:text-slate-500 mb-1">
        <span class="flex items-center gap-0.5">
          <Clock class="w-2.5 h-2.5 shrink-0" />
          <span>工时追踪: {{ timePercent }}%</span>
        </span>
        <span>{{ timeSpentHours.toFixed(1) }}h / {{ timeEstimateHours.toFixed(1) }}h</span>
      </div>
      <div class="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden border border-slate-200/20 dark:border-white/5">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="timeSpentHours > timeEstimateHours ? 'bg-amber-500' : 'bg-emerald-500'"
          :style="{ width: `${timePercent}%` }"
        ></div>
      </div>
    </div>

    <!-- Footer: Date + Subtasks + Priority + Assignee -->
    <div
      v-if="
        (task.dueDate && config.dueDate) || hasSubtasks || (task.priority && task.priority !== 'NONE' && config.priority) || config.assignee
      "
      class="flex items-center justify-between pt-1 mt-1 border-t"
      style="border-color: var(--border-base)"
    >
      <div class="flex flex-wrap items-center gap-0.5 sm:gap-2 min-w-0">
        <!-- Due Date with native Picker -->
        <div
          v-if="config.dueDate"
          class="relative flex items-center gap-0.5 text-[8px] sm:text-[9px] font-semibold shrink-0 cursor-pointer hover:text-accent transition-colors"
          :class="task.dueDate && isOverdue(task.dueDate, task.status) ? 'text-rose-500' : 'text-slate-400'"
          @click.stop
        >
          <input
            type="date"
            :value="task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''"
            class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 pointer-events-auto"
            @change="(e) => updateDueDate((e.target as HTMLInputElement).value)"
          />
          <Calendar class="w-2.5 h-2.5 text-slate-400 shrink-0" />
          <span v-if="task.dueDate" class="hidden sm:inline">{{ formatDueDate(task.dueDate) }}</span>
          <span v-if="task.dueDate" class="sm:hidden"
            >{{ new Date(task.dueDate).getMonth() + 1 }}/{{
              new Date(task.dueDate).getDate()
            }}</span
          >
          <span v-else class="text-[8px] sm:text-[9px] text-slate-400 hover:text-accent font-semibold">+ 日期</span>
        </div>

        <!-- Subtasks Progress -->
        <div
          v-if="hasSubtasks && config.subtasks"
          class="flex items-center gap-0.5 text-[8px] sm:text-[9px] font-semibold text-slate-400 shrink-0"
          title="子任务进度"
        >
          <CheckSquare class="w-2.5 h-2.5 text-slate-400 shrink-0" />
          <span>{{ subtasksProgress }}</span>
        </div>

        <!-- Priority Badge with Dropdown -->
        <el-dropdown
          v-if="task.priority && task.priority !== 'NONE' && config.priority"
          trigger="click"
          @command="updatePriority"
          @click.stop
        >
          <span
            class="inline-flex items-center gap-0.5 px-0.5 sm:px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-bold shrink-0 cursor-pointer hover:opacity-85"
            :class="
              getPriorityConfig(task.priority).color +
              '/10 ' +
              getPriorityConfig(task.priority).textColor
            "
          >
            <component
              :is="getPriorityConfig(task.priority).icon"
              class="w-1.5 h-1.5 sm:w-2 sm:h-2"
            />
            <span>{{ getPriorityConfig(task.priority).label }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="URGENT">紧急</el-dropdown-item>
              <el-dropdown-item command="HIGH">高</el-dropdown-item>
              <el-dropdown-item command="MEDIUM">中</el-dropdown-item>
              <el-dropdown-item command="LOW">低</el-dropdown-item>
              <el-dropdown-item command="NONE">无</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>

      <!-- Assignee Avatar with Dropdown -->
      <div v-if="config.assignee" class="shrink-0 ml-0.5" @click.stop>
        <el-dropdown trigger="click" @command="updateAssignee">
          <div
            class="relative cursor-pointer hover:ring-1 hover:ring-accent rounded-md transition-all"
          >
            <img
              v-if="task.assignee"
              :src="task.assignee.avatarUrl || ''"
              loading="lazy"
              class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-md object-cover"
              :alt="task.assignee.name"
            />
            <div
              v-else
              class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-md bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-dashed border-slate-300 hover:border-accent"
              title="指派负责人"
            >
              <User class="w-2.5 h-2.5 text-slate-400" />
            </div>
          </div>
          <template #dropdown>
            <el-dropdown-menu class="max-h-60 overflow-y-auto">
              <el-dropdown-item command="">清除指派</el-dropdown-item>
              <el-dropdown-item
                v-for="m in teamMembers"
                :key="m.id"
                :command="m.id"
              >
                <div class="flex items-center gap-2 py-0.5">
                  <img
                    v-if="m.avatarUrl"
                    :src="m.avatarUrl"
                    class="w-4 h-4 rounded-full object-cover"
                  />
                  <span>{{ m.name }}</span>
                </div>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>

  <!-- Layout 2: List Mode -->
  <div
    v-else-if="layout === 'list'"
    class="group flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 px-3 py-2 sm:py-2.5 rounded-xl border hover:border-accent/30 hover:shadow-sm transition-all cursor-pointer"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
    @click="emit('click', task)"
  >
    <!-- Top Row: Priority + Status + Title -->
    <div class="flex items-center gap-2 sm:gap-4 min-w-0">
      <!-- Priority Dot -->
      <div
        class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0"
        :class="getPriorityConfig(task.priority).color"
      ></div>

      <!-- Status Badge -->
      <span
        class="shrink-0 px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold"
        :class="
          task.status === TaskStatus.TODO
            ? 'bg-slate-500/10 text-slate-500'
            : task.status === TaskStatus.IN_PROGRESS
              ? 'bg-accent/10 text-accent'
              : 'bg-emerald-500/10 text-emerald-500'
        "
      >
        {{
          task.status === TaskStatus.TODO
            ? '待办'
            : task.status === TaskStatus.IN_PROGRESS
              ? '进行中'
              : '已完成'
        }}
      </span>

      <span
        v-if="isBlocked"
        class="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 uppercase tracking-wider"
        title="等待前置任务完成"
      >
        等待依赖
      </span>

      <span
        class="text-xs sm:text-sm font-bold truncate group-hover:text-accent transition-colors"
        style="color: var(--text-primary)"
      >
        <span
          v-if="(task as any).isSubtask"
          class="shrink-0 inline-flex items-center px-1.5 py-0.2 rounded text-[7px] font-black bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase tracking-wider scale-90 mr-1 select-none"
        >
          子任务
        </span>
        {{ task.title }}
      </span>
    </div>

    <!-- Metadata -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-1 sm:justify-end min-w-0">
      <!-- Tags -->
      <div v-if="parseTags(task.tags).length > 0" class="hidden md:flex flex-wrap gap-1">
        <span
          v-for="tag in parseTags(task.tags)"
          :key="tag"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold"
          :class="getTagClass(tag)"
        >
          {{ tag }}
        </span>
      </div>

      <!-- Project -->
      <div
        v-if="task.project"
        class="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-accent max-w-[120px] truncate"
      >
        <FolderOpen class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        {{ task.project.title }}
      </div>

      <!-- Subtasks -->
      <div
        v-if="hasSubtasks"
        class="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-slate-400 shrink-0"
        title="子任务进度"
      >
        <CheckSquare class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        <span>{{ subtasksProgress }}</span>
      </div>

      <!-- Time Tracking Indicator (List Mode) -->
      <div
        v-if="task.timeEstimate && config.timeTracking"
        class="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-medium text-slate-400 shrink-0"
        :title="`预计工时: ${timeEstimateHours.toFixed(1)}h / 已用: ${timeSpentHours.toFixed(1)}h`"
      >
        <Clock class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
        <span :class="timeSpentHours > timeEstimateHours ? 'text-amber-500 font-bold' : ''">
          {{ timeSpentHours.toFixed(1) }}h/{{ timeEstimateHours.toFixed(1) }}h
        </span>
      </div>

      <!-- Assignee -->
      <div
        v-if="task.assignee"
        class="flex items-center gap-1.5 cursor-pointer group/as"
        @click.stop="emit('user-click', task.assignee.id)"
      >
        <img
          v-if="task.assignee.avatarUrl"
          alt=""
          :src="task.assignee.avatarUrl"
          loading="lazy"
          class="w-4 h-4 sm:w-5 sm:h-5 rounded-lg object-cover group-hover/as:ring-2 group-hover/as:ring-accent transition-all"
        />
        <div
          v-else
          class="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-accent/10 flex items-center justify-center group-hover/as:bg-accent group-hover/as:text-white transition-all"
        >
          <User class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent group-hover/as:text-white" />
        </div>
        <span
          class="text-[9px] sm:text-[10px] text-slate-400 font-medium group-hover/as:text-accent transition-colors"
        >
          {{ task.assignee.name }}
        </span>
      </div>

      <!-- Due Date -->
      <div
        v-if="task.dueDate"
        class="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium"
        :class="isOverdue(task.dueDate, task.status) ? 'text-rose-500' : 'text-slate-400'"
      >
        <Calendar class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
        <span class="whitespace-nowrap">{{ new Date(task.dueDate).toLocaleDateString() }}</span>
      </div>
    </div>

    <!-- Quick Actions -->
    <div
      class="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity justify-end sm:justify-start"
    >
      <button
        type="button"
        class="p-1.5 rounded-md text-slate-400 hover:text-accent hover:bg-accent/10 transition-all"
        title="查看详情"
        @click.stop="emit('click', task)"
      >
        <Eye class="w-3.5 h-3.5" />
      </button>
      <button
        v-if="task.status !== 'DONE'"
        type="button"
        class="p-1.5 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
        title="标记完成"
        @click.stop="emit('status-change', task, 'DONE')"
      >
        <CheckCircle2 class="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        class="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
        title="删除"
        @click.stop="emit('delete', task)"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
