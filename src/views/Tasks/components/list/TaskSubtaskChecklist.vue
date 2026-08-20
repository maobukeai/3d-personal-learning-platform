<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircle2, X, Plus, GripVertical } from 'lucide-vue-next';
import Dropdown from '@/components/ui/Dropdown.vue';
import SubtaskDetailModal from '@/components/taskDetail/SubtaskDetailModal.vue';
import api from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import { TaskStatus } from '@/types/task';
import type { Task, Subtask, UserType } from '@/types/task';

const props = defineProps<{
  task: Task;
  teamMembers: UserType[];
}>();

const emit = defineEmits<{
  (e: 'refresh', updatedTask?: Task): void;
}>();

const { t } = useI18n();
const newSubtaskText = ref('');
const isSubtaskModalOpen = ref(false);
const editingSubtask = ref<Subtask | null>(null);
const editingSubtaskIndex = ref<number>(-1);

// Handle-only dragging
const activeDragSubtaskId = ref<string | null>(null);
const draggedSubtaskId = ref<string | null>(null);

const parseSubtasks = (subtasksStr: string | null | undefined): Subtask[] => {
  if (!subtasksStr) return [];
  try {
    const parsed = JSON.parse(subtasksStr);
    if (Array.isArray(parsed)) {
      return parsed.map((s: Subtask, idx: number) => ({
        ...s,
        id: s.id || `subtask-legacy-${idx}`,
        done: Boolean(s.done),
      }));
    }
  } catch {
    // Return empty list on JSON error
  }
  return [];
};

const getUserById = (userId: string | null | undefined) => {
  if (!userId) return null;
  return props.teamMembers.find((m) => m.id === userId) || null;
};

const openSubtaskDetail = (sub: Subtask, index: number) => {
  editingSubtaskIndex.value = index;
  editingSubtask.value = JSON.parse(JSON.stringify(sub));
  isSubtaskModalOpen.value = true;
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
      ElMessage.success('所有子任务已完成，已自动更新主任务为已完成！');
      emit('refresh');
    } catch {
      // Ignore background status sync error
    }
  } else if (!allDone && props.task.status === TaskStatus.DONE) {
    try {
      await api.put(`/api/tasks/${props.task.id}`, {
        title: props.task.title,
        status: TaskStatus.IN_PROGRESS,
      });
      ElMessage.info('有子任务重新开启，主任务已自动恢复为进行中');
      emit('refresh');
    } catch {
      // Ignore background status sync error
    }
  }
};

const handleSaveSubtaskModal = async (updatedSubtask: Subtask) => {
  const list = parseSubtasks(props.task.subtasks);
  if (editingSubtaskIndex.value !== -1 && editingSubtaskIndex.value < list.length) {
    list[editingSubtaskIndex.value] = updatedSubtask;
    try {
      const subtasksStr = JSON.stringify(list);
      const response = await api.put(`/api/tasks/${props.task.id}`, {
        title: props.task.title,
        subtasks: subtasksStr,
      });
      emit('refresh', response.data);
      ElMessage.success('子任务更新成功');
      checkAndSyncParentStatus(list);
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || t('tasks.updateSubtaskFailed');
      ElMessage.error(errMsg);
    }
  }
};

const toggleSubtaskInline = async (subIdx: number) => {
  const list = parseSubtasks(props.task.subtasks);
  if (list[subIdx]) {
    list[subIdx].done = !list[subIdx].done;
    try {
      const subtasksStr = JSON.stringify(list);
      const response = await api.put(`/api/tasks/${props.task.id}`, {
        title: props.task.title,
        subtasks: subtasksStr,
      });
      emit('refresh', response.data);
      checkAndSyncParentStatus(list);
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || t('tasks.updateSubtaskFailed');
      ElMessage.error(errMsg);
    }
  }
};

const removeSubtaskInline = async (subIdx: number) => {
  const list = parseSubtasks(props.task.subtasks);
  list.splice(subIdx, 1);
  try {
    const subtasksStr = JSON.stringify(list);
    const response = await api.put(`/api/tasks/${props.task.id}`, {
      title: props.task.title,
      subtasks: subtasksStr,
    });
    emit('refresh', response.data);
    ElMessage.success(t('tasks.subtaskDeleted'));
    checkAndSyncParentStatus(list);
  } catch {
    ElMessage.error(t('tasks.deleteSubtaskFailed'));
  }
};

const handleAssigneeChange = async (subIdx: number, assigneeId: string | null) => {
  const list = parseSubtasks(props.task.subtasks);
  if (list[subIdx]) {
    list[subIdx].assigneeId = assigneeId;
    try {
      const subtasksStr = JSON.stringify(list);
      const response = await api.put(`/api/tasks/${props.task.id}`, {
        title: props.task.title,
        subtasks: subtasksStr,
      });
      emit('refresh', response.data);
    } catch {
      ElMessage.error(t('tasks.assignSubtaskAssigneeFailed'));
    }
  }
};

const addSubtaskInline = async () => {
  const text = newSubtaskText.value.trim();
  if (!text) return;
  const list = parseSubtasks(props.task.subtasks);
  list.push({
    id: Math.random().toString(36).substring(2, 11),
    text,
    done: false,
    assigneeId: null,
  });
  try {
    const subtasksStr = JSON.stringify(list);
    const response = await api.put(`/api/tasks/${props.task.id}`, {
      title: props.task.title,
      subtasks: subtasksStr,
    });
    newSubtaskText.value = '';
    emit('refresh', response.data);
    ElMessage.success(t('tasks.subtaskAdded'));
    checkAndSyncParentStatus(list);
  } catch {
    ElMessage.error(t('tasks.addSubtaskFailed'));
  }
};

// Handle press triggers draggable state
const activateDragHandle = (subId: string) => {
  activeDragSubtaskId.value = subId;
};

const deactivateDragHandle = () => {
  activeDragSubtaskId.value = null;
};

// Drag and drop handlers using Subtask IDs
const onDragStart = (e: DragEvent, subId: string) => {
  draggedSubtaskId.value = subId;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', subId);
  }
};

const onDragOver = (e: DragEvent) => {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
};

const onDrop = async (e: DragEvent, targetSubId: string) => {
  e.preventDefault();
  const sourceId = draggedSubtaskId.value;
  draggedSubtaskId.value = null;
  activeDragSubtaskId.value = null;

  if (!sourceId || sourceId === targetSubId) return;

  const list = parseSubtasks(props.task.subtasks);
  const sourceIndex = list.findIndex((s) => s.id === sourceId);
  const targetIndex = list.findIndex((s) => s.id === targetSubId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  const [movedItem] = list.splice(sourceIndex, 1);
  list.splice(targetIndex, 0, movedItem);

  try {
    const subtasksStr = JSON.stringify(list);
    const response = await api.put(`/api/tasks/${props.task.id}`, {
      title: props.task.title,
      subtasks: subtasksStr,
    });
    emit('refresh', response.data);
    ElMessage.success('子任务排序已更新');
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message || '更新排序失败';
    ElMessage.error(msg);
  }
};

const onDragEnd = () => {
  draggedSubtaskId.value = null;
  activeDragSubtaskId.value = null;
};
</script>

<template>
  <div
    class="pl-12 pr-4 py-3 bg-slate-50/30 dark:bg-white/1 space-y-2 border-t border-b border-slate-100/50 dark:border-white/5"
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
        class="flex items-center justify-between py-1.5 px-2 bg-slate-100/50 dark:bg-white/2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-xs text-slate-600 dark:text-slate-300 cursor-pointer group/item"
        :class="draggedSubtaskId === sub.id ? 'opacity-40 border border-dashed border-accent' : ''"
        :draggable="activeDragSubtaskId === sub.id"
        @dragstart="(e) => onDragStart(e, sub.id)"
        @dragover="onDragOver"
        @drop="(e) => onDrop(e, sub.id)"
        @dragend="onDragEnd"
        @click="openSubtaskDetail(sub, index)"
      >
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <!-- Grip Handle (Only dragging handle triggers HTML5 drag) -->
          <div
            class="p-0.5 hover:text-accent cursor-grab active:cursor-grabbing shrink-0 select-none opacity-40 hover:opacity-100 transition-opacity"
            title="按住拖拽排序"
            @mousedown="activateDragHandle(sub.id)"
            @mouseup="deactivateDragHandle"
            @mouseleave="deactivateDragHandle"
          >
            <GripVertical class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          </div>

          <!-- Subtask Checklist checkbox -->
          <button
            type="button"
            class="w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            :class="
              sub.done
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/10'
            "
            @click.stop="toggleSubtaskInline(index)"
          >
            <CheckCircle2
              class="w-3 h-3 transition-colors"
              :class="sub.done ? 'text-emerald-500' : 'text-transparent hover:text-emerald-500'"
            />
          </button>

          <!-- Subtask title text -->
          <span
            class="truncate font-medium text-xs hover:text-accent hover:underline transition-all"
            :class="sub.done ? 'line-through text-slate-400 dark:text-slate-500' : ''"
          >
            {{ sub.text }}
          </span>
        </div>

        <!-- Subtask Actions -->
        <div class="flex items-center gap-3 shrink-0 ml-4" @click.stop>
          <!-- Subtask Assignee -->
          <Dropdown align="right" width-class="w-48">
            <template #trigger>
              <span
                class="inline-flex items-center gap-1 cursor-pointer hover:text-accent text-[10px] text-slate-400"
              >
                <template v-if="sub.assigneeId">
                  <img
                    v-if="getUserById(sub.assigneeId)?.avatarUrl"
                    alt=""
                    :src="getUserById(sub.assigneeId)?.avatarUrl || undefined"
                    class="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                  />
                  <span class="max-w-[70px] truncate">{{
                    getUserById(sub.assigneeId)?.name || t('common.unknownMember')
                  }}</span>
                </template>
                <span v-else class="text-slate-400 text-[10px] hover:text-accent font-semibold"
                  >+ {{ t('tasks.assignMember') }}</span
                >
              </span>
            </template>
            <template #content>
              <button
                type="button"
                class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs text-rose-500 hover:bg-rose-500/10 border-none bg-transparent cursor-pointer transition-colors"
                @click="handleAssigneeChange(index, null)"
              >
                {{ t('tasks.clearMember') }}
              </button>
              <div class="h-[1px] my-1 bg-slate-100 dark:bg-white/10"></div>
              <button
                v-for="m in teamMembers"
                :key="m.id"
                type="button"
                class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors flex items-center gap-2"
                @click="handleAssigneeChange(index, m.id)"
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
            class="p-1 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-md transition-all shrink-0 cursor-pointer"
            @click.stop="removeSubtaskInline(index)"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Inline Quick Add Subtask -->
    <div class="relative flex items-center max-w-md pt-2 mt-1" @click.stop>
      <input
        v-model="newSubtaskText"
        type="text"
        :placeholder="t('tasks.quickAddSubtaskPlaceholder')"
        class="w-full px-2.5 py-1.5 bg-transparent border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent/40 focus:border-solid rounded-lg text-xs focus:outline-none transition-all pr-8"
        style="color: var(--text-primary)"
        @keyup.enter="addSubtaskInline"
      />
      <button
        v-show="newSubtaskText.trim()"
        type="button"
        class="absolute right-1.5 p-1 bg-accent/10 hover:bg-accent hover:text-white text-accent rounded-md transition-all cursor-pointer"
        @click="addSubtaskInline"
      >
        <Plus class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Subtask Detail Modal -->
    <SubtaskDetailModal
      v-model:show="isSubtaskModalOpen"
      :subtask="editingSubtask"
      :team-members="teamMembers"
      @save="handleSaveSubtaskModal"
    />
  </div>
</template>
