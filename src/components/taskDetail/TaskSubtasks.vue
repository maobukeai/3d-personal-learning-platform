<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
  CheckCircle2,
  Trash2,
  X,
  MessageSquare,
  Send,
  CheckSquare,
  Plus
} from 'lucide-vue-next';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
interface SubtaskComment {
  id: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
  content: string;
  createdAt: string;
}

interface Subtask {
  id: string;
  text: string;
  done: boolean;
  assigneeId?: string | null;
  description?: string;
  comments?: SubtaskComment[];
}
import Modal from '@/components/ui/Modal.vue';
import { parseCommentContent, isImageUrl } from './helpers';

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

const authStore = useAuthStore();
const localSubtasks = ref<Subtask[]>([]);
const newSubtaskText = ref('');

watch(
  () => props.subtasks,
  (newVal) => {
    // Keep internal sync
    localSubtasks.value = newVal ? [...newVal] : [];
  },
  { immediate: true, deep: true }
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

// Subtask detail states & methods
const isSubtaskDetailOpen = ref(false);
const editingSubtask = ref<Subtask | null>(null);
const editingSubtaskIndex = ref<number>(-1);
const newSubtaskCommentText = ref('');
const isEditingSubtaskDescription = ref(false);
const tempSubtaskDescriptionImages = ref<string[]>([]);
const tempUploadedSubtaskImages = ref<string[]>([]);

const openSubtaskDetail = (sub: Subtask, index: number) => {
  editingSubtaskIndex.value = index;
  editingSubtask.value = JSON.parse(JSON.stringify(sub));
  if (!editingSubtask.value!.comments) {
    editingSubtask.value!.comments = [];
  }

  // Parse subtask description into clean text and images
  const parsed = parseCommentContent(editingSubtask.value!.description || '');
  editingSubtask.value!.description = parsed.text;
  tempSubtaskDescriptionImages.value = [...parsed.images];

  newSubtaskCommentText.value = '';
  tempUploadedSubtaskImages.value = [];
  isEditingSubtaskDescription.value = false;
  isSubtaskDetailOpen.value = true;
};

const saveSubtaskChanges = () => {
  if (editingSubtaskIndex.value === -1 || !editingSubtask.value) return;

  // Concatenate description and images back to markdown
  let finalDesc = (editingSubtask.value.description || '').trim();
  if (tempSubtaskDescriptionImages.value.length > 0) {
    finalDesc +=
      (finalDesc ? '\n' : '') +
      tempSubtaskDescriptionImages.value.map((url) => `![图片](${url})`).join('\n');
  }

  localSubtasks.value[editingSubtaskIndex.value] = {
    ...localSubtasks.value[editingSubtaskIndex.value],
    ...editingSubtask.value,
    description: finalDesc,
  };
  emit('update:subtasks', localSubtasks.value);
};

const handleSaveSubtaskAndClose = () => {
  saveSubtaskChanges();
  isSubtaskDetailOpen.value = false;
};

const handleCancelSubtaskEdit = () => {
  isSubtaskDetailOpen.value = false;
};

const addSubtaskComment = () => {
  const content = newSubtaskCommentText.value.trim();
  if (!content && tempUploadedSubtaskImages.value.length === 0) return;
  if (!editingSubtask.value) return;

  let finalContent = content;
  if (tempUploadedSubtaskImages.value.length > 0) {
    finalContent +=
      '\n' + tempUploadedSubtaskImages.value.map((url) => `![图片](${url})`).join('\n');
  }

  const newComment: SubtaskComment = {
    id: Math.random().toString(36).substring(2, 11),
    content: finalContent,
    userId: authStore.user?.id || 'unknown',
    userName: authStore.user?.name || '未知用户',
    userAvatarUrl: authStore.user?.avatarUrl || null,
    createdAt: new Date().toISOString(),
  };

  editingSubtask.value.comments = editingSubtask.value.comments || [];
  editingSubtask.value.comments.push(newComment);
  newSubtaskCommentText.value = '';
  tempUploadedSubtaskImages.value = [];
  saveSubtaskChanges();
};

const handlePasteSubtaskComment = async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  let hasImage = false;
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      hasImage = true;
      break;
    }
  }

  if (hasImage) {
    event.preventDefault();
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (!file) continue;

        const formData = new FormData();
        formData.append('task_image', file);
        try {
          ElMessage.info('图片上传中...');
          const response = await api.post('/api/tasks/upload-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const imageUrl = response.data.url;
          tempUploadedSubtaskImages.value.push(imageUrl);
          ElMessage.success('图片上传成功');
        } catch {
          ElMessage.error('图片上传失败');
        }
      }
    }
    return;
  }

  // Check if pasted text is an image URL
  const pastedText = event.clipboardData.getData('text');
  if (pastedText && isImageUrl(pastedText)) {
    event.preventDefault();
    tempUploadedSubtaskImages.value.push(pastedText.trim());
    ElMessage.success('图片链接已识别');
  }
};

const handlePasteSubtaskDescription = async (event: ClipboardEvent) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  let hasImage = false;
  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      hasImage = true;
      break;
    }
  }

  if (hasImage) {
    event.preventDefault();
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (!file) continue;

        const formData = new FormData();
        formData.append('task_image', file);
        try {
          ElMessage.info('图片上传中...');
          const response = await api.post('/api/tasks/upload-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const imageUrl = response.data.url;
          tempSubtaskDescriptionImages.value.push(imageUrl);
          ElMessage.success('图片上传成功');
        } catch {
          ElMessage.error('图片上传失败');
        }
      }
    }
    return;
  }

  // Check if pasted text is an image URL
  const pastedText = event.clipboardData.getData('text');
  if (pastedText && isImageUrl(pastedText)) {
    event.preventDefault();
    tempSubtaskDescriptionImages.value.push(pastedText.trim());
    ElMessage.success('图片链接已识别');
  }
};

const deleteSubtaskComment = (cmtIndex: number) => {
  if (!editingSubtask.value || !editingSubtask.value.comments) return;
  editingSubtask.value.comments.splice(cmtIndex, 1);
  saveSubtaskChanges();
};

defineExpose({
  openSubtaskDetail,
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
        class="flex items-center gap-3 group/sub p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <!-- Toggle Checkbox -->
        <button
          type="button"
          class="w-4 h-4 rounded-md border flex items-center justify-center transition-colors shrink-0"
          :class="
            sub.done
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-slate-300 dark:border-slate-600 hover:border-accent'
          "
          @click="toggleSubtask(sub)"
        >
          <CheckCircle2 v-if="sub.done" class="w-3.5 h-3.5" />
        </button>

        <!-- Clickable Subtask Text -->
        <div
          class="flex-1 text-xs transition-all font-medium cursor-pointer hover:text-accent hover:underline py-1 truncate"
          :class="
            sub.done
              ? 'line-through text-slate-400 dark:text-slate-500'
              : 'text-slate-700 dark:text-slate-200'
          "
          @click="openSubtaskDetail(sub, index)"
        >
          {{ sub.text }}
        </div>

        <!-- Subtask Info Badges (Assignee + Comments) -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Assignee Avatar -->
          <template v-if="sub.assigneeId && getMemberById(sub.assigneeId)">
            <el-tooltip
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
            </el-tooltip>
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
          @click="openSubtaskDetail(sub, index)"
        >
          <MessageSquare class="w-3.5 h-3.5" />
        </button>

        <!-- Delete Button -->
        <button
          type="button"
          class="opacity-0 group-hover/sub:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded transition-opacity cursor-pointer"
          @click="removeSubtask(index)"
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
  </div>

  <!-- Subtask Detail Modal -->
  <Modal
    :show="isSubtaskDetailOpen"
    title="子任务详情"
    size="md"
    @close="handleCancelSubtaskEdit"
  >
    <div v-if="editingSubtask" class="space-y-4 py-2 text-left">
      <!-- Title -->
      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
          子任务标题
        </label>
        <input
          v-model="editingSubtask.text"
          type="text"
          class="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-accent/45 transition-all"
          style="color: var(--text-primary)"
        />
      </div>

      <!-- Assignee -->
      <div>
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
          负责人
        </label>
        <el-select
          v-model="editingSubtask.assigneeId"
          clearable
          placeholder="选择负责人"
          class="!w-full custom-select-small"
        >
          <el-option v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
            <div class="flex items-center gap-2">
              <img
                v-if="m.avatarUrl"
                alt=""
                :src="m.avatarUrl"
                class="w-4 h-4 rounded-lg object-cover"
              />
              <span class="text-xs">{{ m.name }}</span>
            </div>
          </el-option>
        </el-select>
      </div>

      <!-- Description -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label
            class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-accent"></span> 详细描述
          </label>
          <button
            v-if="!isEditingSubtaskDescription"
            type="button"
            class="text-[10px] font-bold text-accent hover:underline cursor-pointer"
            @click="isEditingSubtaskDescription = true"
          >
            编辑描述
          </button>
        </div>

        <!-- Edit Mode -->
        <div v-if="isEditingSubtaskDescription" class="space-y-2">
          <textarea
            v-model="editingSubtask.description"
            placeholder="输入子任务描述... (支持粘贴图片)"
            rows="3"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-accent/45 transition-all resize-y"
            style="color: var(--text-primary)"
            @paste="handlePasteSubtaskDescription"
          ></textarea>

          <!-- Image Previews during Editing -->
          <div
            v-if="tempSubtaskDescriptionImages.length > 0"
            class="flex flex-wrap gap-1.5 p-1.5 bg-slate-50/50 dark:bg-white/2 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <div
              v-for="(img, idx) in tempSubtaskDescriptionImages"
              :key="img"
              class="relative group w-12 h-12 rounded border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <img
                :src="img"
                class="w-full h-full object-cover cursor-zoom-in"
                @click="emit('image-click', img)"
              />
              <button
                type="button"
                class="absolute top-0.5 right-0.5 p-0.5 bg-black/55 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer flex items-center justify-center"
                @click="tempSubtaskDescriptionImages.splice(idx, 1)"
              >
                <X class="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-lg hover:opacity-80 transition-all cursor-pointer"
              @click="isEditingSubtaskDescription = false"
            >
              确定
            </button>
          </div>
        </div>

        <!-- Preview Mode -->
        <div
          v-else
          class="px-3 py-2 bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-xl min-h-[60px] cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/5 transition-all relative"
          @click="isEditingSubtaskDescription = true"
        >
          <div
            v-if="!editingSubtask.description"
            class="text-xs text-slate-400 dark:text-slate-500 italic py-2 text-center select-none"
          >
            + 点击添加详细描述...
          </div>
          <div
            v-else
            class="text-xs leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300 space-y-2"
          >
            <p>{{ editingSubtask.description }}</p>
            <div v-if="tempSubtaskDescriptionImages.length > 0" class="flex flex-wrap gap-2 pt-1">
              <img
                v-for="img in tempSubtaskDescriptionImages"
                :key="img"
                :src="img"
                class="max-w-full max-h-[150px] rounded-lg border object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                style="border-color: var(--border-base)"
                @click.stop="emit('image-click', img)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Comments Section -->
      <div class="border-t pt-4" style="border-color: var(--border-base)">
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
          评论和反馈 ({{ editingSubtask.comments?.length || 0 }})
        </label>

        <!-- Subtask Comment List -->
        <div class="space-y-3 max-h-[160px] overflow-y-auto pr-1 mb-3 scrollbar-hide">
          <div
            v-if="!editingSubtask.comments || editingSubtask.comments.length === 0"
            class="text-center py-6 text-slate-400 text-xs italic"
          >
            暂无评论
          </div>
          <div
            v-for="(cmt, cIdx) in editingSubtask.comments"
            :key="cmt.id"
            class="flex gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-white/2 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors relative group/subcmt"
          >
            <!-- Avatar -->
            <img
              v-if="cmt.userAvatarUrl"
              :src="cmt.userAvatarUrl"
              class="w-5 h-5 rounded-full object-cover shrink-0"
              alt=""
            />
            <div
              v-else
              class="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-[8px] shrink-0"
            >
              {{ cmt.userName?.[0] || 'U' }}
            </div>
            <!-- Body -->
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-center gap-2 mb-0.5">
                <span class="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                  {{ cmt.userName }}
                </span>
                <span class="text-[8px] text-slate-400">
                  {{ new Date(cmt.createdAt).toLocaleString() }}
                </span>
              </div>
              <p
                class="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap mb-1"
              >
                {{ parseCommentContent(cmt.content).text }}
              </p>
              <div
                v-if="parseCommentContent(cmt.content).images.length > 0"
                class="flex flex-wrap gap-1.5 mt-1"
              >
                <img
                  v-for="img in parseCommentContent(cmt.content).images"
                  :key="img"
                  :src="img"
                  class="max-w-[120px] max-h-[90px] rounded border object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                  style="border-color: var(--border-base)"
                  @click="emit('image-click', img)"
                />
              </div>
            </div>
            <!-- Delete -->
            <button
              v-if="cmt.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'"
              type="button"
              class="opacity-0 group-hover/subcmt:opacity-100 absolute right-2 top-2 p-0.5 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer"
              @click="deleteSubtaskComment(cIdx)"
            >
              <Trash2 class="w-3 h-3" />
            </button>
          </div>
        </div>

        <!-- Add Comment Input -->
        <div class="space-y-2">
          <!-- Pasted Image Preview List -->
          <div
            v-if="tempUploadedSubtaskImages.length > 0"
            class="flex flex-wrap gap-1.5 p-1.5 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <div
              v-for="(url, idx) in tempUploadedSubtaskImages"
              :key="url"
              class="relative group w-12 h-12 rounded border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <img :src="url" class="w-full h-full object-cover" />
              <button
                type="button"
                class="absolute top-0.5 right-0.5 p-0.5 bg-black/55 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer flex items-center justify-center"
                @click="tempUploadedSubtaskImages.splice(idx, 1)"
              >
                <X class="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          <div class="flex gap-2 items-end">
            <textarea
              v-model="newSubtaskCommentText"
              rows="1.5"
              placeholder="写下子任务反馈... (支持粘贴图片)"
              class="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-accent/40 focus:border-solid transition-all resize-none"
              style="color: var(--text-primary)"
              @keyup.enter.exact.prevent="addSubtaskComment"
              @paste="handlePasteSubtaskComment"
            ></textarea>
            <button
              type="button"
              class="p-2 bg-accent hover:opacity-85 text-white rounded-lg transition-all flex items-center justify-center shrink-0 cursor-pointer"
              @click="addSubtaskComment"
            >
              <Send class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2 pt-2 border-t w-full" style="border-color: var(--border-base)">
        <el-button size="small" @click="handleCancelSubtaskEdit">取消</el-button>
        <el-button type="primary" size="small" @click="handleSaveSubtaskAndClose">确定</el-button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
