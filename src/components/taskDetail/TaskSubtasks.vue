<script setup lang="ts">
import { ref, watch } from 'vue';
import { CheckCircle2, Trash2, MessageSquare, CheckSquare, GripVertical } from 'lucide-vue-next';
import Tooltip from '@/components/ui/Tooltip.vue';
import type { Subtask } from '@/types/task';
import SubtaskDetailModal from './SubtaskDetailModal.vue';

interface Member {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

const props = defineProps<{
  subtasks: Subtask[];
  teamMembers: Member[];
}>();

const emit = defineEmits<{
  (e: 'update:subtasks', subtasks: Subtask[]): void;
  (e: 'image-click', url: string): void;
}>();

const localSubtasks = ref<Subtask[]>([]);
const newSubtaskText = ref('');

// Handle-only dragging
const activeDragSubtaskId = ref<string | null>(null);
const draggedSubtaskId = ref<string | null>(null);

watch(
  () => props.subtasks,
  (newVal) => {
    localSubtasks.value = newVal ? [...newVal] : [];
  },
  { immediate: true, deep: true },
);

const getMemberById = (id: string | null | undefined) => {
  if (!id) return null;
  return props.teamMembers?.find((m) => m.id === id) || null;
};

const addSubtask = () => {
  const text = newSubtaskText.value.trim();
  if (!text) return;
  localSubtasks.value.push({
    id: Math.random().toString(36).substring(2, 11),
    text,
    done: false,
    comments: [],
  });
  newSubtaskText.value = '';
  emit('update:subtasks', localSubtasks.value);
};

const toggleSubtask = (subtask: Subtask) => {
  subtask.done = !subtask.done;
  emit('update:subtasks', localSubtasks.value);
};

const removeSubtask = (index: number) => {
  localSubtasks.value.splice(index, 1);
  emit('update:subtasks', localSubtasks.value);
};

// Modal state
const isSubtaskDetailOpen = ref(false);
const editingSubtask = ref<Subtask | null>(null);
const editingSubtaskIndex = ref<number>(-1);

const openSubtaskDetail = (sub: Subtask, index: number) => {
  editingSubtaskIndex.value = index;
  editingSubtask.value = JSON.parse(JSON.stringify(sub));
  isSubtaskDetailOpen.value = true;
};

const openSubtaskDetailById = (subtaskId: string) => {
  const index = localSubtasks.value.findIndex((s) => s.id === subtaskId);
  if (index !== -1) {
    openSubtaskDetail(localSubtasks.value[index], index);
  }
};

const handleSaveSubtaskModal = (updatedSubtask: Subtask) => {
  if (editingSubtaskIndex.value !== -1 && editingSubtaskIndex.value < localSubtasks.value.length) {
    localSubtasks.value[editingSubtaskIndex.value] = updatedSubtask;
    emit('update:subtasks', localSubtasks.value);
  }
};

// Handle press triggers draggable state
const activateDragHandle = (subId: string) => {
  activeDragSubtaskId.value = subId;
};

const deactivateDragHandle = () => {
  activeDragSubtaskId.value = null;
};

// Drag and Drop handlers using Subtask IDs
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

const onDrop = (e: DragEvent, targetSubId: string) => {
  e.preventDefault();
  const sourceId = draggedSubtaskId.value;
  draggedSubtaskId.value = null;
  activeDragSubtaskId.value = null;

  if (!sourceId || sourceId === targetSubId) return;

  const list = [...localSubtasks.value];
  const sourceIndex = list.findIndex((s) => s.id === sourceId);
  const targetIndex = list.findIndex((s) => s.id === targetSubId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  const [movedItem] = list.splice(sourceIndex, 1);
  list.splice(targetIndex, 0, movedItem);

  localSubtasks.value = list;
  emit('update:subtasks', localSubtasks.value);
};

const onDragEnd = () => {
  draggedSubtaskId.value = null;
  activeDragSubtaskId.value = null;
};

defineExpose({
  openSubtaskDetail,
  openSubtaskDetailById,
});
</script>

<template>
  <div class="pt-4 border-t" style="border-color: var(--border-base)">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <CheckSquare class="w-4 h-4 text-accent" />
        <h3 class="text-sm font-bold" style="color: var(--text-primary)">子任务清单</h3>
        <span v-if="localSubtasks.length > 0" class="text-xs text-slate-400 font-bold">
          ({{ localSubtasks.filter((s) => s.done).length }}/{{ localSubtasks.length }})
        </span>
      </div>
    </div>

    <!-- Subtask Progress Bar -->
    <div
      v-if="localSubtasks.length > 0"
      class="w-full bg-slate-100 dark:bg-white/10 h-1.5 rounded-full mb-4 overflow-hidden"
    >
      <div
        class="bg-accent h-full transition-all duration-300"
        :style="{
          width: `${(localSubtasks.filter((s) => s.done).length / localSubtasks.length) * 100}%`,
        }"
      ></div>
    </div>

    <!-- Checklist Items -->
    <div class="space-y-2 mb-4">
      <div
        v-for="(sub, index) in localSubtasks"
        :key="sub.id"
        class="flex items-center gap-2.5 group/sub p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
        :class="draggedSubtaskId === sub.id ? 'opacity-40 border border-dashed border-accent' : ''"
        :draggable="activeDragSubtaskId === sub.id"
        @dragstart="(e) => onDragStart(e, sub.id)"
        @dragover="onDragOver"
        @drop="(e) => onDrop(e, sub.id)"
        @dragend="onDragEnd"
        @click="openSubtaskDetail(sub, index)"
      >
        <!-- Drag Handle Icon (Only handle triggers HTML5 drag) -->
        <div
          class="p-0.5 hover:text-accent cursor-grab active:cursor-grabbing shrink-0 select-none opacity-40 hover:opacity-100 transition-opacity"
          title="按住拖拽排序"
          @mousedown="activateDragHandle(sub.id)"
          @mouseup="deactivateDragHandle"
          @mouseleave="deactivateDragHandle"
        >
          <GripVertical class="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
        </div>

        <!-- Toggle Checkbox -->
        <button
          type="button"
          class="w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          :class="
            sub.done
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-slate-300 dark:border-slate-600 hover:border-accent'
          "
          @click.stop="toggleSubtask(sub)"
        >
          <CheckCircle2 v-if="sub.done" class="w-3.5 h-3.5" />
        </button>

        <!-- Clickable Subtask Text -->
        <div
          class="flex-1 text-xs transition-all font-medium hover:text-accent hover:underline py-1 truncate"
          :class="
            sub.done
              ? 'line-through text-slate-400 dark:text-slate-500'
              : 'text-slate-700 dark:text-slate-200'
          "
        >
          {{ sub.text }}
        </div>

        <!-- Subtask Info Badges (Assignee + Comments) -->
        <div class="flex items-center gap-2 shrink-0" @click.stop>
          <!-- Assignee Avatar -->
          <template v-if="sub.assigneeId && getMemberById(sub.assigneeId)">
            <Tooltip
              :content="getMemberById(sub.assigneeId)?.name"
              placement="top"
              :show-after="500"
            >
              <img
                v-if="getMemberById(sub.assigneeId)?.avatarUrl"
                :src="getMemberById(sub.assigneeId)?.avatarUrl || undefined"
                class="w-4.5 h-4.5 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
              <div
                v-else
                class="w-4.5 h-4.5 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-[8px]"
              >
                {{ getMemberById(sub.assigneeId)?.name?.[0] || 'U' }}
              </div>
            </Tooltip>
          </template>

          <!-- Comments count badge -->
          <div
            v-if="sub.comments && sub.comments.length > 0"
            class="flex items-center gap-0.5 text-[10px] text-slate-400"
            title="子任务评论数"
          >
            <MessageSquare class="w-3 h-3 text-slate-400" />
            <span>{{ sub.comments.length }}</span>
          </div>
        </div>

        <!-- Subtask Details / Comment button -->
        <button
          type="button"
          class="opacity-0 group-hover/sub:opacity-100 p-1 text-slate-400 hover:text-accent rounded transition-opacity cursor-pointer"
          @click.stop="openSubtaskDetail(sub, index)"
        >
          <MessageSquare class="w-3.5 h-3.5" />
        </button>

        <!-- Delete Button -->
        <button
          type="button"
          class="opacity-0 group-hover/sub:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded transition-opacity cursor-pointer"
          @click.stop="removeSubtask(index)"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Add Subtask Form -->
    <div class="flex gap-2">
      <input
        v-model="newSubtaskText"
        type="text"
        placeholder="+ 添加子任务..."
        class="flex-1 px-4 py-2 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-accent/40 focus:border-solid transition-all"
        style="color: var(--text-primary)"
        @keyup.enter="addSubtask"
      />
      <button
        type="button"
        class="px-3 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:opacity-85 transition-all cursor-pointer"
        @click="addSubtask"
      >
        添加
      </button>
    </div>

    <!-- Subtask Detail Modal -->
    <SubtaskDetailModal
      v-model:show="isSubtaskDetailOpen"
      :subtask="editingSubtask"
      :team-members="teamMembers"
      @save="handleSaveSubtaskModal"
      @image-click="(url) => emit('image-click', url)"
    />
  </div>
</template>

<style scoped>
/* .scrollbar-hide utility provided globally by src/styles/layout.css */
</style>
