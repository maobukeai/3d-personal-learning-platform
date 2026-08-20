<script setup lang="ts">
import { ref } from 'vue';
import { GripVertical, MessageSquare, Image as ImageIcon, Upload, Check } from 'lucide-vue-next';
import { parseCommentContent } from '@/components/taskDetail/helpers';
import type { Subtask } from '@/types/task';

const props = defineProps<{
  parsedSubtasks: Subtask[];
  subtasksProgress: string;
  hasSubtasks: boolean;
  configSubtasks?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update-subtask', index: number, done: boolean): void;
  (e: 'reorder-subtasks', newSubtasks: Subtask[]): void;
  (e: 'upload-image', index: number, event: Event): void;
  (e: 'add-comment', index: number, text: string): void;
  (e: 'preview-image', url: string): void;
}>();

const isSubtasksExpanded = ref(false);
const activeSubtaskPanelIndex = ref<number | null>(null);
const newCommentTexts = ref<Record<number, string>>({});

// Handle-only dragging control
const activeDragSubtaskId = ref<string | null>(null);
const draggedSubtaskId = ref<string | null>(null);

const toggleSubtasksExpand = () => {
  isSubtasksExpanded.value = !isSubtasksExpanded.value;
};

const toggleSubtaskPanel = (idx: number) => {
  activeSubtaskPanelIndex.value = activeSubtaskPanelIndex.value === idx ? null : idx;
};

const handleAddComment = (idx: number) => {
  const text = newCommentTexts.value[idx]?.trim();
  if (!text) return;
  emit('add-comment', idx, text);
  newCommentTexts.value[idx] = '';
};

// Handle press triggers draggable state
const activateDragHandle = (subId: string) => {
  activeDragSubtaskId.value = subId;
};

const deactivateDragHandle = () => {
  activeDragSubtaskId.value = null;
};

// Drag and drop reordering using real Subtask IDs
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

  const fullList = [...props.parsedSubtasks];
  const sourceIndex = fullList.findIndex((s) => s.id === sourceId);
  const targetIndex = fullList.findIndex((s) => s.id === targetSubId);

  if (sourceIndex === -1 || targetIndex === -1) return;

  const [movedItem] = fullList.splice(sourceIndex, 1);
  fullList.splice(targetIndex, 0, movedItem);

  emit('reorder-subtasks', fullList);
};

const onDragEnd = () => {
  draggedSubtaskId.value = null;
  activeDragSubtaskId.value = null;
};
</script>

<template>
  <div
    v-if="hasSubtasks && configSubtasks"
    class="mt-2.5 pt-2.5 border-t border-dashed rounded-xl p-2 bg-slate-50/40 dark:bg-white/1 glass-real-physical shadow-inner"
    style="border-color: var(--border-base)"
    @click.stop
  >
    <div
      class="flex items-center justify-between text-[10px] sm:text-[10px] font-bold text-slate-400 mb-2 select-none px-0.5"
    >
      <span class="tracking-wide">子任务清单 ({{ subtasksProgress }})</span>
      <button
        v-if="parsedSubtasks.length > 3"
        type="button"
        class="hover:text-accent transition-colors focus:outline-none flex items-center gap-0.5 cursor-pointer font-bold"
        @click="toggleSubtasksExpand"
      >
        <span>{{ isSubtasksExpanded ? '折叠' : `展开其余 ${parsedSubtasks.length - 3} 项` }}</span>
      </button>
    </div>

    <div class="space-y-1.5">
      <div
        v-for="(sub, displayIdx) in isSubtasksExpanded
          ? parsedSubtasks
          : parsedSubtasks.slice(0, 3)"
        :key="sub.id"
        class="flex flex-col gap-1"
        :draggable="activeDragSubtaskId === sub.id"
        @dragstart="(e) => onDragStart(e, sub.id)"
        @dragover="onDragOver"
        @drop="(e) => onDrop(e, sub.id)"
        @dragend="onDragEnd"
      >
        <div
          class="flex items-center gap-1.5 text-[10px] sm:text-[10px] w-full group/sub p-1.5 rounded-lg transition-all hover:bg-slate-100/80 dark:hover:bg-white/5 border border-transparent hover:border-slate-200/50 dark:hover:border-white/5"
          :class="
            draggedSubtaskId === sub.id ? 'opacity-40 border border-dashed border-accent' : ''
          "
        >
          <!-- Drag handle icon (Drag trigger) -->
          <div
            class="p-0.5 hover:text-accent cursor-grab active:cursor-grabbing shrink-0 select-none opacity-40 hover:opacity-100 transition-opacity"
            title="按住拖拽排序"
            @mousedown="activateDragHandle(sub.id)"
            @mouseup="deactivateDragHandle"
            @mouseleave="deactivateDragHandle"
          >
            <GripVertical class="w-3 h-3 text-slate-400 dark:text-slate-500" />
          </div>

          <!-- Spring Bounce Animated Checkbox Button -->
          <button
            type="button"
            class="w-3.5 h-3.5 rounded border flex items-center justify-center transition-all duration-200 shrink-0 cursor-pointer active:scale-125 select-none"
            :class="
              sub.done
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                : 'border-slate-300 dark:border-slate-600 hover:border-accent bg-white/50 dark:bg-black/20'
            "
            @click="
              emit(
                'update-subtask',
                parsedSubtasks.findIndex((s) => s.id === sub.id),
                !sub.done,
              )
            "
          >
            <Check
              v-if="sub.done"
              class="w-2.5 h-2.5 stroke-[3] transition-transform duration-200 scale-100 animate-in zoom-in-50"
            />
          </button>

          <!-- Title with smooth strikethrough transition -->
          <span
            class="truncate flex-1 select-none cursor-pointer hover:text-accent transition-all duration-300 font-semibold"
            :class="{
              'line-through opacity-45 text-slate-400 dark:text-slate-500 italic': sub.done,
            }"
            :style="{ color: 'var(--text-primary)' }"
            :title="sub.text"
            @click="toggleSubtaskPanel(displayIdx)"
          >
            {{ sub.text }}
          </span>

          <!-- Inline triggers -->
          <div
            class="flex items-center gap-1 shrink-0 opacity-40 group-hover/sub:opacity-100 transition-opacity"
          >
            <button
              type="button"
              class="hover:text-accent flex items-center gap-0.5 p-0.5 cursor-pointer transition-colors"
              :class="{ 'text-accent font-bold opacity-100': sub.comments?.length }"
              title="评论"
              @click="toggleSubtaskPanel(displayIdx)"
            >
              <MessageSquare class="w-2.5 h-2.5 shrink-0" />
              <span v-if="sub.comments?.length" class="text-[10px]">{{ sub.comments.length }}</span>
            </button>
            <button
              type="button"
              class="hover:text-accent flex items-center gap-0.5 p-0.5 cursor-pointer transition-colors"
              :class="{ 'text-accent font-bold opacity-100': sub.images?.length }"
              title="成果图"
              @click="toggleSubtaskPanel(displayIdx)"
            >
              <ImageIcon class="w-2.5 h-2.5 shrink-0" />
              <span v-if="sub.images?.length" class="text-[10px]">{{ sub.images.length }}</span>
            </button>
          </div>
        </div>

        <!-- Inline Discussion Panel -->
        <div
          v-if="activeSubtaskPanelIndex === displayIdx"
          class="ml-4 p-2 rounded-xl border border-dashed text-[10px] sm:text-[10px] flex flex-col gap-2 glass-real-physical shadow-sm"
          style="border-color: var(--border-base)"
          @click.stop
        >
          <!-- Image Gallery -->
          <div class="flex flex-col gap-1">
            <span class="font-bold text-slate-400">成果图 ({{ sub.images?.length || 0 }})</span>
            <div class="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-hide">
              <!-- Upload trigger -->
              <label
                class="w-10 h-10 rounded border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:text-accent transition-colors shrink-0"
              >
                <Upload class="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="
                    (e) =>
                      emit(
                        'upload-image',
                        parsedSubtasks.findIndex((s) => s.id === sub.id),
                        e,
                      )
                  "
                />
              </label>
              <div
                v-for="(imgUrl, imgIdx) in sub.images"
                :key="imgIdx"
                class="w-10 h-10 rounded border overflow-hidden shrink-0 relative group/img cursor-zoom-in"
                style="border-color: var(--border-base)"
                @click="emit('preview-image', imgUrl)"
              >
                <img
                  :src="imgUrl"
                  class="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-200"
                />
              </div>
            </div>
          </div>

          <!-- Comment Section -->
          <div
            class="flex flex-col gap-1 border-t border-dashed pt-1.5"
            style="border-color: var(--border-base)"
          >
            <span class="font-bold text-slate-400">讨论 ({{ sub.comments?.length || 0 }})</span>
            <div
              v-if="sub.comments && sub.comments.length > 0"
              class="space-y-1 max-h-[80px] overflow-y-auto scrollbar-hide"
            >
              <div
                v-for="cmt in sub.comments"
                :key="cmt.id"
                class="flex flex-col bg-slate-50/70 dark:bg-white/5 p-1.5 rounded-lg border border-slate-100/50 dark:border-white/5"
              >
                <div class="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                  <span class="font-bold text-slate-600 dark:text-slate-300">{{
                    cmt.userName
                  }}</span>
                  <span>{{
                    new Date(cmt.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  }}</span>
                </div>
                <p class="text-[10px] leading-snug font-medium" style="color: var(--text-primary)">
                  {{ parseCommentContent(cmt.content || cmt.text || '').text }}
                </p>
                <div
                  v-if="parseCommentContent(cmt.content || cmt.text || '').images.length > 0"
                  class="flex flex-wrap gap-1 mt-1"
                >
                  <img
                    v-for="img in parseCommentContent(cmt.content || cmt.text || '').images"
                    :key="img"
                    :src="img"
                    class="max-w-[80px] max-h-[60px] rounded border object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                    style="border-color: var(--border-base)"
                    @click.stop="emit('preview-image', img)"
                  />
                </div>
              </div>
            </div>
            <!-- Mini Input -->
            <div class="flex items-center gap-1 mt-1">
              <input
                v-model="newCommentTexts[displayIdx]"
                type="text"
                placeholder="说点什么，回车发送..."
                class="flex-1 px-2 py-1 bg-slate-100 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800/70 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-[10px] sm:text-[10px] focus:outline-none transition-colors"
                style="color: var(--text-primary)"
                @keyup.enter="handleAddComment(parsedSubtasks.findIndex((s) => s.id === sub.id))"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
