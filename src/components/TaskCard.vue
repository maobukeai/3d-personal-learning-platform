<script setup lang="ts">
import { computed } from 'vue';
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
} from 'lucide-vue-next';

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
}

interface Props {
  task: Task;
  layout?: 'board' | 'list';
}

const props = withDefaults(defineProps<Props>(), {
  layout: 'board',
});

const parseSubtasks = (subtasksStr: string | null | undefined) => {
  if (!subtasksStr) return [];
  try {
    return JSON.parse(subtasksStr);
  } catch (e) {
    return [];
  }
};

const parsedSubtasks = computed(() => parseSubtasks(props.task.subtasks));
const hasSubtasks = computed(() => parsedSubtasks.value.length > 0);
const subtasksProgress = computed(() => {
  const total = parsedSubtasks.value.length;
  const completed = parsedSubtasks.value.filter((s: any) => s.done).length;
  return `${completed}/${total}`;
});

const emit = defineEmits<{
  (e: 'click', task: Task): void;
  (e: 'edit', task: Task): void;
  (e: 'delete', task: Task): void;
  (e: 'status-change', task: Task, newStatus: string): void;
  (e: 'user-click', userId: string): void;
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

const parseTags = (tagsStr: string | null | undefined) => {
  if (!tagsStr) return [];
  try {
    return JSON.parse(tagsStr);
  } catch (e) {
    return tagsStr.split(',').map((t) => t.trim()).filter((t) => t);
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
        <h3
          class="text-[10px] sm:text-xs font-bold leading-snug group-hover:text-accent transition-colors line-clamp-2"
          style="color: var(--text-primary)"
        >
          {{ task.title }}
        </h3>
      </div>
    </div>

    <!-- Description -->
    <p
      v-if="task.description"
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

    <!-- Footer: Date + Subtasks + Priority + Assignee -->
    <div
      v-if="task.dueDate || hasSubtasks || (task.priority && task.priority !== 'NONE') || task.assignee"
      class="flex items-center justify-between pt-1 mt-1 border-t"
      style="border-color: var(--border-base)"
    >
      <div class="flex flex-wrap items-center gap-0.5 sm:gap-2 min-w-0">
        <!-- Due Date -->
        <div
          v-if="task.dueDate"
          class="flex items-center gap-0.5 text-[8px] sm:text-[9px] font-semibold shrink-0"
          :class="isOverdue(task.dueDate, task.status) ? 'text-rose-500' : 'text-slate-400'"
        >
          <Calendar class="w-2 h-2 sm:w-2.5 sm:h-2.5" />
          <span class="hidden sm:inline">{{ formatDueDate(task.dueDate) }}</span>
          <span class="sm:hidden">{{ new Date(task.dueDate).getMonth() + 1 }}/{{ new Date(task.dueDate).getDate() }}</span>
        </div>

        <!-- Subtasks Progress -->
        <div
          v-if="hasSubtasks"
          class="flex items-center gap-0.5 text-[8px] sm:text-[9px] font-semibold text-slate-400 shrink-0"
          title="子任务进度"
        >
          <CheckSquare class="w-2 h-2 sm:w-2.5 sm:h-2.5" />
          <span>{{ subtasksProgress }}</span>
        </div>

        <!-- Priority Badge (In footer to save space) -->
        <span
          v-if="task.priority && task.priority !== 'NONE'"
          class="inline-flex items-center gap-0.5 px-0.5 sm:px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-bold shrink-0"
          :class="
            getPriorityConfig(task.priority).color +
            '/10 ' +
            getPriorityConfig(task.priority).textColor
          "
        >
          <component :is="getPriorityConfig(task.priority).icon" class="w-1.5 h-1.5 sm:w-2 sm:h-2" />
          <span>{{ getPriorityConfig(task.priority).label }}</span>
        </span>
      </div>

      <!-- Assignee Avatar -->
      <div v-if="task.assignee" class="shrink-0 ml-0.5">
        <div
          class="relative cursor-pointer hover:ring-1 hover:ring-accent rounded-md transition-all"
          @click.stop="emit('user-click', task.assignee.id)"
        >
          <img
            v-if="task.assignee.avatarUrl"
            :src="task.assignee.avatarUrl"
            class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-md object-cover"
            :alt="task.assignee.name"
          />
          <div
            v-else
            class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-md bg-accent/10 flex items-center justify-center"
          >
            <User class="w-2 h-2 text-accent" />
          </div>
        </div>
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
          task.status === 'TODO'
            ? 'bg-slate-500/10 text-slate-500'
            : task.status === 'IN_PROGRESS'
              ? 'bg-accent/10 text-accent'
              : 'bg-emerald-500/10 text-emerald-500'
        "
      >
        {{ task.status === 'TODO' ? '待办' : task.status === 'IN_PROGRESS' ? '进行中' : '已完成' }}
      </span>

      <span
        class="text-xs sm:text-sm font-bold truncate group-hover:text-accent transition-colors"
        style="color: var(--text-primary)"
      >
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

      <!-- Assignee -->
      <div
        v-if="task.assignee"
        class="flex items-center gap-1.5 cursor-pointer group/as"
        @click.stop="emit('user-click', task.assignee.id)"
      >
        <img
          v-if="task.assignee.avatarUrl"
          :src="task.assignee.avatarUrl"
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
        class="p-1.5 rounded-md text-slate-400 hover:text-accent hover:bg-accent/10 transition-all"
        title="查看详情"
        @click.stop="emit('click', task)"
      >
        <Eye class="w-3.5 h-3.5" />
      </button>
      <button
        v-if="task.status !== 'DONE'"
        class="p-1.5 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
        title="标记完成"
        @click.stop="emit('status-change', task, 'DONE')"
      >
        <CheckCircle2 class="w-3.5 h-3.5" />
      </button>
      <button
        class="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
        title="删除"
        @click.stop="emit('delete', task)"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>
