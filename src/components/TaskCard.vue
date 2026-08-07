<script setup lang="ts">
import { computed, ref } from 'vue';
import { TaskStatus } from '@/types';
import type { Task as BaseTask, Subtask, UserType, SubtaskComment } from '@/types/task';
import {
  Calendar,
  User,
  Eye,
  CheckCircle2,
  Trash2,
  FolderOpen,
  CheckSquare,
  Clock,
  MessageSquare,
  Image as ImageIcon,
  Upload,
} from 'lucide-vue-next';
import { parseTags, getTagClass } from '@/utils/tags';
import {
  getPriorityOption,
  getPriorityColorClass,
  getPriorityBadgeClass,
  formatDueDate,
  isOverdue,
} from '@/utils/taskDisplay';
import api from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import UserAvatar from '@/components/UserAvatar.vue';
import CardSubtasksSection from '@/components/card/CardSubtasksSection.vue';
import { useAuthStore } from '@/stores/auth';
import { parseCommentContent } from '@/components/taskDetail/helpers';

interface Task extends BaseTask {
  isSubtask?: boolean;
  parentId?: string | null;
  subtaskIndex?: number;
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
  teamMembers?: UserType[];
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
  return (
    props.task.dependencies && props.task.dependencies.some((d) => d.dependsOn?.status !== 'DONE')
  );
});

const timeEstimateHours = computed(() =>
  props.task.timeEstimate ? props.task.timeEstimate / 60 : 0,
);
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
      return (parsed as Subtask[]).map((s, idx) => ({
        ...s,
        id: s.id || `subtask-legacy-${idx}`,
      }));
    }
    return [];
  } catch {
    return [];
  }
};

const parsedSubtasks = computed((): Subtask[] => {
  if (props.task.parsedSubtasks && Array.isArray(props.task.parsedSubtasks)) {
    return props.task.parsedSubtasks.map(
      (s, idx): Subtask => ({
        ...s,
        id: s.id || `subtask-legacy-${idx}`,
      }),
    );
  }
  return parseSubtasks(props.task.subtasks);
});
const hasSubtasks = computed(() => parsedSubtasks.value.length > 0);
const subtasksProgress = computed(() => {
  const total = parsedSubtasks.value.length;
  const completed = parsedSubtasks.value.filter((s: Subtask) => s.done).length;
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
  (
    e: 'update-subtask',
    parentId: string,
    subtaskIndex: number,
    fields: Record<string, unknown>,
  ): void;
}>();

const updatePriority = async (priority: string) => {
  if (props.task.isSubtask && props.task.parentId) {
    try {
      const res = await api.put(`/api/tasks/${props.task.parentId}`, { priority });
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

const updateDueDate = async (val: string | Date | null | undefined) => {
  if (props.task.isSubtask && props.task.parentId) {
    try {
      const dueDateVal = val ? new Date(val).toISOString() : null;
      const res = await api.put(`/api/tasks/${props.task.parentId}`, {
        dueDate: dueDateVal,
      });
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

const checkAndSyncParentStatus = async (subtasksList: Subtask[]) => {
  if (subtasksList.length === 0) return;
  const allDone = subtasksList.every((s) => s.done);
  if (allDone && props.task.status !== TaskStatus.DONE) {
    try {
      await api.put(`/api/tasks/${props.task.id}`, {
        title: props.task.title,
        status: TaskStatus.DONE,
      });
      props.task.status = TaskStatus.DONE;
      ElMessage.success('所有子任务已完成，已自动更新主任务为已完成！');
      emit('refresh');
    } catch {
      // Ignore background status auto sync error
    }
  } else if (!allDone && props.task.status === TaskStatus.DONE) {
    try {
      await api.put(`/api/tasks/${props.task.id}`, {
        title: props.task.title,
        status: TaskStatus.IN_PROGRESS,
      });
      props.task.status = TaskStatus.IN_PROGRESS;
      ElMessage.info('有子任务重新开启，主任务已自动恢复为进行中');
      emit('refresh');
    } catch {
      // Ignore background status auto sync error
    }
  }
};

const handleSubtaskStatusChange = (index: number, done: boolean) => {
  const list = [...parsedSubtasks.value];
  if (list[index]) {
    list[index].done = done;
    emit('update-subtask', props.task.id, index, { done });
    checkAndSyncParentStatus(list);
  }
};

const handleReorderSubtasks = async (newList: Subtask[]) => {
  try {
    const subtasksStr = JSON.stringify(newList);
    const res = await api.put(`/api/tasks/${props.task.id}`, {
      title: props.task.title,
      subtasks: subtasksStr,
    });
    props.task.subtasks = subtasksStr;
    emit('refresh', res.data);
    ElMessage.success('子任务排序已更新');
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message || '更新子任务排序失败';
    ElMessage.error(msg);
  }
};

const isSubtaskPanelOpen = ref(false);
const isHoverCardOpen = ref(false);
let hoverTimer: ReturnType<typeof setTimeout> | null = null;

const toggleSubtaskPanelOpen = () => {
  isSubtaskPanelOpen.value = !isSubtaskPanelOpen.value;
  isHoverCardOpen.value = false;
};

const handlePillMouseEnter = () => {
  if (isSubtaskPanelOpen.value) return;
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    isHoverCardOpen.value = true;
  }, 300);
};

const handlePillMouseLeave = () => {
  if (hoverTimer) clearTimeout(hoverTimer);
  isHoverCardOpen.value = false;
};

const subtasksPercent = computed(() => {
  if (!parsedSubtasks.value || parsedSubtasks.value.length === 0) return 0;
  const doneCount = parsedSubtasks.value.filter((s) => s.done).length;
  return Math.round((doneCount / parsedSubtasks.value.length) * 100);
});

const uncompletedSubtasks = computed(() => {
  return (parsedSubtasks.value || []).filter((s) => !s.done);
});

const authStore = useAuthStore();
const activeSubtaskPanelIndex = ref<number | null>(null);
const newCommentTexts = ref<Record<number, string>>({});

const toggleSubtaskPanel = (index: number) => {
  if (activeSubtaskPanelIndex.value === index) {
    activeSubtaskPanelIndex.value = null;
  } else {
    activeSubtaskPanelIndex.value = index;
  }
};

const handleAddSubtaskComment = async (subIndex: number) => {
  const text = newCommentTexts.value[subIndex]?.trim();
  if (!text) return;

  const parent = props.task;
  let subtasksList: Subtask[] = [];
  if (parent.subtasks) {
    try {
      subtasksList = JSON.parse(parent.subtasks as string);
    } catch {
      subtasksList = JSON.parse(JSON.stringify(parent.parsedSubtasks || []));
    }
  } else {
    subtasksList = JSON.parse(JSON.stringify(parent.parsedSubtasks || []));
  }

  const targetSub = subtasksList[subIndex];
  if (targetSub) {
    if (!targetSub.comments) targetSub.comments = [];
    targetSub.comments.push({
      id: Math.random().toString(36).substring(2, 9),
      userId: authStore.user?.id || 'guest',
      userName: authStore.user?.name || '匿名用户',
      userAvatar: authStore.user?.avatarUrl || null,
      userAvatarUrl: authStore.user?.avatarUrl || null,
      text,
      content: text,
      createdAt: new Date().toISOString(),
    });
  }

  emit('update-subtask', parent.id, subIndex, {
    subtasks: JSON.stringify(subtasksList),
  });
  newCommentTexts.value[subIndex] = '';
};

const handleUploadSubtaskImage = async (subIndex: number, event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  const formData = new FormData();
  formData.append('task_image', file);

  try {
    ElMessage.info('图片上传中...');
    const response = await api.post('/api/tasks/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const imageUrl = response.data.url;

    const parent = props.task;
    let subtasksList: Subtask[] = [];
    if (parent.subtasks) {
      try {
        subtasksList = JSON.parse(parent.subtasks as string);
      } catch {
        subtasksList = JSON.parse(JSON.stringify(parent.parsedSubtasks || []));
      }
    } else {
      subtasksList = JSON.parse(JSON.stringify(parent.parsedSubtasks || []));
    }

    const targetSub = subtasksList[subIndex];
    if (targetSub) {
      if (!targetSub.images) targetSub.images = [];
      targetSub.images.push(imageUrl);
    }

    emit('update-subtask', parent.id, subIndex, {
      subtasks: JSON.stringify(subtasksList),
    });
    ElMessage.success('成果图上传成功');
  } catch {
    ElMessage.error('成果图上传失败');
  } finally {
    target.value = '';
  }
};

const activePreviewImage = ref<string | null>(null);

const cardCoverImage = computed(() => {
  // 1. Explicit cover image property
  if ((props.task as any).coverImage) {
    return (props.task as any).coverImage;
  }

  // 2. Parse first image from task description markdown
  if (props.task.description) {
    const parsed = parseCommentContent(props.task.description);
    if (parsed.images.length > 0) {
      return parsed.images[0];
    }
  }

  // 3. Fallback: Parse first image from subtask images or subtask comments
  if (parsedSubtasks.value && parsedSubtasks.value.length > 0) {
    for (const sub of parsedSubtasks.value) {
      if (sub.images && sub.images.length > 0) {
        return sub.images[0];
      }
      if (sub.description) {
        const pDesc = parseCommentContent(sub.description);
        if (pDesc.images.length > 0) return pDesc.images[0];
      }
      if (sub.comments && sub.comments.length > 0) {
        for (const cmt of sub.comments) {
          const pCmt = parseCommentContent(cmt.content || cmt.text || '');
          if (pCmt.images.length > 0) return pCmt.images[0];
        }
      }
    }
  }

  return null;
});
</script>

<template>
  <!-- Layout 1: Board (Kanban) Mode -->
  <div
    v-if="layout === 'board'"
    class="group p-1 sm:p-2.5 rounded-lg sm:rounded-xl border shadow-sm hover:shadow-md hover:border-accent/30 transition-all cursor-grab active:cursor-grabbing relative glass-real-physical glass-panel-extreme overflow-hidden"
    @click="emit('click', task)"
  >
    <!-- Card Cover Header -->
    <div
      v-if="cardCoverImage && (config.cover ?? true)"
      class="-mx-1 -mt-1 sm:-mx-2.5 sm:-mt-2.5 mb-2 h-24 sm:h-28 overflow-hidden rounded-t-lg sm:rounded-t-xl relative group/cardCover cursor-zoom-in border-b"
      style="border-color: var(--border-base)"
      @click.stop="activePreviewImage = cardCoverImage"
    >
      <img
        :src="cardCoverImage"
        class="w-full h-full object-cover group-hover/cardCover:scale-105 transition-transform duration-500"
        alt="Card Cover"
      />
      <div
        class="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent opacity-80 pointer-events-none"
      ></div>
    </div>

    <!-- Priority + Title Row -->
    <div class="flex justify-between items-start mb-1 sm:mb-1.5">
      <div class="flex items-start gap-1 sm:gap-2 flex-1 min-w-0">
        <div
          v-if="task.priority && task.priority !== 'NONE'"
          class="shrink-0 w-1 h-1 sm:w-2 sm:h-2 rounded-full mt-1.5 sm:mt-1"
          :class="getPriorityColorClass(task.priority)"
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
            v-if="task.isSubtask"
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
      <div
        class="flex items-center justify-between text-[8px] font-bold text-slate-400 dark:text-slate-500 mb-1"
      >
        <span class="flex items-center gap-0.5">
          <Clock class="w-2.5 h-2.5 shrink-0" />
          <span>工时追踪: {{ timePercent }}%</span>
        </span>
        <span>{{ timeSpentHours.toFixed(1) }}h / {{ timeEstimateHours.toFixed(1) }}h</span>
      </div>
      <div
        class="w-full bg-slate-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden border border-slate-200/20 dark:border-white/5"
      >
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="timeSpentHours > timeEstimateHours ? 'bg-amber-500' : 'bg-emerald-500'"
          :style="{ width: `${timePercent}%` }"
        ></div>
      </div>
    </div>

    <!-- Card Embedded Subtasks Checklist (Collapsible) -->
    <transition name="slide-fade">
      <CardSubtasksSection
        v-if="hasSubtasks && config.subtasks && isSubtaskPanelOpen"
        :parsed-subtasks="parsedSubtasks"
        :subtasks-progress="subtasksProgress"
        :has-subtasks="hasSubtasks"
        :config-subtasks="config.subtasks"
        @update-subtask="handleSubtaskStatusChange"
        @reorder-subtasks="handleReorderSubtasks"
        @upload-image="handleUploadSubtaskImage"
        @add-comment="handleAddSubtaskComment"
        @preview-image="(url) => (activePreviewImage = url)"
      />
    </transition>

    <!-- Footer: Date + Subtasks + Priority + Assignee -->
    <div
      v-if="
        (task.dueDate && config.dueDate) ||
        hasSubtasks ||
        (task.priority && task.priority !== 'NONE' && config.priority) ||
        config.assignee
      "
      class="flex items-center justify-between pt-1 mt-1 border-t"
      style="border-color: var(--border-base)"
    >
      <div class="flex flex-wrap items-center gap-0.5 sm:gap-2 min-w-0">
        <!-- Due Date with native Picker -->
        <div
          v-if="config.dueDate"
          class="relative flex items-center gap-0.5 text-[8px] sm:text-[9px] font-semibold shrink-0 cursor-pointer hover:text-accent transition-colors"
          :class="
            task.dueDate && isOverdue(task.dueDate, task.status)
              ? 'text-rose-500'
              : 'text-slate-400'
          "
          @click.stop
        >
          <input
            type="date"
            :value="task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''"
            class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10 pointer-events-auto"
            @change="(e) => updateDueDate((e.target as HTMLInputElement).value)"
          />
          <Calendar class="w-2.5 h-2.5 text-slate-400 shrink-0" />
          <span v-if="task.dueDate" class="hidden sm:inline">{{
            formatDueDate(task.dueDate)
          }}</span>
          <span v-if="task.dueDate" class="sm:hidden">
            {{ new Date(task.dueDate).getMonth() + 1 }}/{{ new Date(task.dueDate).getDate() }}
          </span>
          <span
            v-else
            class="text-[8px] sm:text-[9px] text-slate-400 hover:text-accent font-semibold"
          >
            + 日期
          </span>
        </div>

        <!-- Subtasks Progress Pill Badge with HoverCard Preview -->
        <div class="relative shrink-0">
          <button
            v-if="hasSubtasks && config.subtasks"
            type="button"
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-extrabold bg-gradient-to-r from-slate-100/90 via-slate-50/80 to-slate-100/90 dark:from-white/10 dark:via-white/5 dark:to-white/10 hover:from-accent/20 hover:to-accent/10 hover:text-accent border border-slate-200/60 dark:border-white/10 transition-all duration-200 select-none group/pill shadow-sm cursor-pointer"
            :class="{
              'bg-accent/20 text-accent border-accent/40 shadow-accent/10': isSubtaskPanelOpen,
            }"
            @mouseenter="handlePillMouseEnter"
            @mouseleave="handlePillMouseLeave"
            @click.stop="toggleSubtaskPanelOpen"
          >
            <CheckSquare
              class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent shrink-0 group-hover/pill:scale-110 transition-transform"
            />
            <span>{{ subtasksProgress }}</span>
            <div
              class="w-6 sm:w-8 h-1 bg-slate-200/80 dark:bg-slate-700/80 rounded-full overflow-hidden shrink-0 ml-0.5"
            >
              <div
                class="h-full bg-gradient-to-r from-accent to-emerald-400 transition-all duration-300 rounded-full"
                :style="{ width: `${subtasksPercent}%` }"
              ></div>
            </div>
          </button>

          <!-- Floating HoverCard Preview (300ms hover trigger) -->
          <transition name="fade">
            <div
              v-if="isHoverCardOpen && !isSubtaskPanelOpen && hasSubtasks"
              class="absolute bottom-full left-0 mb-2 w-48 p-2.5 rounded-2xl glass-real-physical shadow-2xl border border-white/20 dark:border-white/10 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
            >
              <div
                class="flex items-center justify-between text-[9px] font-bold text-slate-400 border-b border-dashed pb-1.5 mb-1.5"
                style="border-color: var(--border-base)"
              >
                <span>未完成子任务 ({{ uncompletedSubtasks.length }})</span>
                <span class="text-[8px] text-accent">点击展开全量</span>
              </div>
              <div v-if="uncompletedSubtasks.length > 0" class="space-y-1.5">
                <div
                  v-for="sub in uncompletedSubtasks.slice(0, 2)"
                  :key="sub.id"
                  class="flex items-center gap-1.5 text-[9px] font-semibold text-slate-600 dark:text-slate-200 truncate"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-accent shrink-0"></div>
                  <span class="truncate">{{ sub.text }}</span>
                </div>
                <div v-if="uncompletedSubtasks.length > 2" class="text-[8px] text-slate-400 italic">
                  + 仍有 {{ uncompletedSubtasks.length - 2 }} 项未完成
                </div>
              </div>
              <div
                v-else
                class="text-[9px] text-emerald-500 font-bold flex items-center gap-1 py-0.5"
              >
                <span>🎉 全部子任务已完成</span>
              </div>
            </div>
          </transition>
        </div>

        <!-- Priority Badge with Dropdown -->
        <Dropdown
          v-if="task.priority && task.priority !== 'NONE' && config.priority"
          trigger="click"
          @command="(cmd) => updatePriority(cmd as any)"
          @click.stop
        >
          <span
            class="inline-flex items-center gap-0.5 px-0.5 sm:px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-bold shrink-0 cursor-pointer hover:opacity-85"
            :class="getPriorityBadgeClass(task.priority)"
          >
            <component
              :is="getPriorityOption(task.priority).icon"
              class="w-1.5 h-1.5 sm:w-2 sm:h-2"
            />
            <span>{{ getPriorityOption(task.priority).label }}</span>
          </span>
          <template #dropdown>
            <DropdownMenu>
              <DropdownItem command="URGENT">紧急</DropdownItem>
              <DropdownItem command="HIGH">高</DropdownItem>
              <DropdownItem command="MEDIUM">中</DropdownItem>
              <DropdownItem command="LOW">低</DropdownItem>
              <DropdownItem command="NONE">无</DropdownItem>
            </DropdownMenu>
          </template>
        </Dropdown>
      </div>

      <!-- Assignee Avatar Stack -->
      <div v-if="config.assignee" class="shrink-0 ml-0.5 flex items-center">
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
            class="text-[9px] font-black text-slate-400 pl-1"
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
    </div>
  </div>

  <!-- Layout 2: List Mode -->
  <div
    v-else-if="layout === 'list'"
    class="group flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 px-3 py-2 sm:py-2.5 rounded-xl border hover:border-accent/30 hover:shadow-sm transition-all cursor-pointer glass-real-physical"
    @click="emit('click', task)"
  >
    <!-- Top Row: Priority + Status + Title -->
    <div class="flex items-center gap-2 sm:gap-4 min-w-0">
      <!-- Priority Dot -->
      <div
        class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0"
        :class="getPriorityColorClass(task.priority)"
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
          v-if="task.isSubtask"
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

      <!-- Assignee Avatar Stack -->
      <div v-if="config.assignee" class="shrink-0 flex items-center">
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
            class="text-[9px] font-black text-slate-400 pl-1"
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

  <!-- Subtask Image Lightbox Zoom -->
  <teleport to="body">
    <div
      v-if="activePreviewImage"
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm cursor-zoom-out"
      @click="activePreviewImage = null"
    >
      <img
        :src="activePreviewImage"
        class="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl transition-transform duration-300"
      />
    </div>
  </teleport>
</template>
