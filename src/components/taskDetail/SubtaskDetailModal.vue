<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import { Trash2, X, Send } from 'lucide-vue-next';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import Modal from '@/components/ui/Modal.vue';
import Select from '@/components/ui/Select.vue';
import SelectOption from '@/components/ui/SelectOption.vue';
import Button from '@/components/ui/Button.vue';
import type { Subtask, SubtaskComment } from '@/types/task';
import { parseCommentContent, isImageUrl } from './helpers';

interface Member {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

const props = defineProps<{
  show: boolean;
  subtask: Subtask | null;
  teamMembers: Member[];
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'save', updatedSubtask: Subtask): void;
  (e: 'image-click', url: string): void;
}>();

const authStore = useAuthStore();
const editingSubtask = ref<Subtask | null>(null);
const newSubtaskCommentText = ref('');
const isEditingSubtaskDescription = ref(false);
const tempSubtaskDescriptionImages = ref<string[]>([]);
const tempUploadedSubtaskImages = ref<string[]>([]);

watch(
  () => props.subtask,
  (newSub) => {
    if (newSub) {
      editingSubtask.value = JSON.parse(JSON.stringify(newSub));
      if (!editingSubtask.value!.comments) {
        editingSubtask.value!.comments = [];
      }
      const parsed = parseCommentContent(editingSubtask.value!.description || '');
      editingSubtask.value!.description = parsed.text;
      tempSubtaskDescriptionImages.value = [...parsed.images];
      newSubtaskCommentText.value = '';
      tempUploadedSubtaskImages.value = [];
      isEditingSubtaskDescription.value = false;
    } else {
      editingSubtask.value = null;
    }
  },
  { immediate: true, deep: true },
);

const handleSaveSubtaskAndClose = () => {
  if (!editingSubtask.value) return;

  let finalDesc = (editingSubtask.value.description || '').trim();
  if (tempSubtaskDescriptionImages.value.length > 0) {
    finalDesc +=
      (finalDesc ? '\n' : '') +
      tempSubtaskDescriptionImages.value.map((url) => `![图片](${url})`).join('\n');
  }

  const result: Subtask = {
    ...editingSubtask.value,
    description: finalDesc,
  };
  emit('save', result);
  emit('update:show', false);
};

const handleCancelSubtaskEdit = () => {
  emit('update:show', false);
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

  handleSaveSubtaskAndClose();
};

const deleteSubtaskComment = (cmtIndex: number) => {
  if (!editingSubtask.value || !editingSubtask.value.comments) return;
  editingSubtask.value.comments.splice(cmtIndex, 1);
  handleSaveSubtaskAndClose();
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

  const pastedText = event.clipboardData.getData('text');
  if (pastedText && isImageUrl(pastedText)) {
    event.preventDefault();
    tempSubtaskDescriptionImages.value.push(pastedText.trim());
    ElMessage.success('图片链接已识别');
  }
};
</script>

<template>
  <Modal
    :show="show"
    title="子任务详情"
    size="xl"
    :surface-style="{ maxWidth: '1024px' }"
    @close="handleCancelSubtaskEdit"
  >
    <div
      v-if="editingSubtask"
      class="grid grid-cols-1 md:grid-cols-12 gap-6 py-2 text-left items-start"
    >
      <!-- Left Column: Fields -->
      <div class="md:col-span-6 space-y-4">
        <!-- Title -->
        <div>
          <label
            class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
          >
            子任务标题
          </label>
          <input
            v-model="editingSubtask.text"
            type="text"
            class="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/12 transition-all"
            style="color: var(--text-primary)"
          />
        </div>

        <!-- Assignee -->
        <div>
          <label
            class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
          >
            负责人
          </label>
          <Select
            v-model="editingSubtask.assigneeId"
            clearable
            placeholder="选择负责人"
            :options="teamMembers.map((m) => ({ label: m.name, value: m.id }))"
            class="!w-full custom-select-small"
          >
            <SelectOption v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
              <div class="flex items-center gap-2">
                <img
                  v-if="m.avatarUrl"
                  alt=""
                  :src="m.avatarUrl"
                  class="w-4 h-4 rounded-lg object-cover"
                />
                <span class="text-xs">{{ m.name }}</span>
              </div>
            </SelectOption>
          </Select>
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
              rows="5"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/12 transition-all resize-y"
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
            class="px-3 py-2 bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-xl min-h-[140px] cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/5 transition-all relative flex flex-col justify-center"
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
      </div>

      <!-- Right Column: Comments & Timeline -->
      <div
        class="md:col-span-6 flex flex-col h-full border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6"
        style="border-color: var(--border-base)"
      >
        <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
          评论和反馈 ({{ editingSubtask.comments?.length || 0 }})
        </label>

        <!-- Subtask Comment List (Timeline Layout) -->
        <div class="relative max-h-[420px] overflow-y-auto pr-1 mb-3 scrollbar-hide">
          <div
            v-if="!editingSubtask.comments || editingSubtask.comments.length === 0"
            class="text-center py-6 text-slate-400 text-xs italic"
          >
            暂无评论
          </div>
          <div v-else class="space-y-4 pt-2 pb-2 pl-3.5 pr-1.5 relative">
            <div
              class="absolute left-6 top-4 bottom-6 w-0.5 border-l border-dashed border-slate-200 dark:border-white/10 pointer-events-none"
            ></div>

            <div
              v-for="(cmt, cIdx) in editingSubtask.comments"
              :key="cmt.id"
              class="flex gap-3 relative group/subcmt items-start"
            >
              <img
                v-if="cmt.userAvatarUrl"
                :src="cmt.userAvatarUrl"
                class="w-5 h-5 rounded-full object-cover shrink-0 z-10 ring-4 ring-white dark:ring-slate-900"
                alt=""
              />
              <div
                v-else
                class="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-[10px] shrink-0 z-10 ring-4 ring-white dark:ring-slate-900"
              >
                {{ cmt.userName?.[0] || 'U' }}
              </div>

              <div
                class="flex-1 min-w-0 bg-slate-100/35 dark:bg-white/3 hover:bg-slate-100/60 dark:hover:bg-white/6 p-2 rounded-xl border border-transparent hover:border-slate-200/50 dark:hover:border-white/5 transition-all"
              >
                <div class="flex justify-between items-center gap-2 mb-1">
                  <span class="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {{ cmt.userName }}
                  </span>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-[7.5px] text-slate-400">
                      {{ new Date(cmt.createdAt).toLocaleString() }}
                    </span>
                    <button
                      v-if="cmt.userId === authStore.user?.id || authStore.user?.role === 'ADMIN'"
                      type="button"
                      class="opacity-0 group-hover/subcmt:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition-opacity cursor-pointer flex items-center justify-center"
                      @click="deleteSubtaskComment(cIdx)"
                    >
                      <Trash2 class="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                <p
                  class="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap mb-1 font-medium"
                >
                  {{ parseCommentContent(cmt.content || cmt.text || '').text }}
                </p>
                <div
                  v-if="parseCommentContent(cmt.content || cmt.text || '').images.length > 0"
                  class="flex flex-wrap gap-1.5 mt-1.5"
                >
                  <img
                    v-for="img in parseCommentContent(cmt.content || cmt.text || '').images"
                    :key="img"
                    :src="img"
                    class="max-w-[120px] max-h-[90px] rounded-lg border object-cover cursor-zoom-in hover:opacity-90 transition-opacity shadow-sm"
                    style="border-color: var(--border-base)"
                    @click="emit('image-click', img)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Add Comment Input -->
        <div class="space-y-2">
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
              class="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:outline-none focus:border-accent/60 focus:border-solid focus:ring-2 focus:ring-accent/12 transition-all resize-none"
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
      <div
        class="flex justify-end gap-2 pt-2 border-t w-full"
        style="border-color: var(--border-base)"
      >
        <Button size="sm" @click="handleCancelSubtaskEdit">取消</Button>
        <Button variant="primary" size="sm" @click="handleSaveSubtaskAndClose">确定</Button>
      </div>
    </template>
  </Modal>
</template>
