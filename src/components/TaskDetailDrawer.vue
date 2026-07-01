<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import {
  CheckCircle2,
  Copy,
  Maximize2,
  Minimize2,
  Trash2,
  X,
  Link2,
  Clock,
  Plus,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { parseTags, getTagClass } from '@/utils/tags';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { isAxiosError } from 'axios';
import type { Task, TaskUpdatePayload, Subtask as BaseSubtask } from '@/types/task';
import Modal from '@/components/ui/Modal.vue';

// Import split components & helpers
import TaskSubtasks from './taskDetail/TaskSubtasks.vue';
import TaskComments from './taskDetail/TaskComments.vue';
import TaskActivities from './taskDetail/TaskActivities.vue';
import { parseCommentContent, isImageUrl } from './taskDetail/helpers';

interface Member {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface Project {
  id: string;
  title: string;
}

interface PriorityOption {
  id: string;
  label: string;
  color: string;
  textColor: string;
}

interface Props {
  modelValue: boolean;
  task: Task | null;
  teamMembers: Member[];
  projects: Project[];
  priorityOptions: PriorityOption[];
  statusColumns: { id: string; title: string }[];
  viewMode: 'drawer' | 'modal';
  activeSubtaskId?: string | null;
}

const props = defineProps<Props>();

interface SubtaskComment {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
  createdAt: string;
}

interface Subtask extends BaseSubtask {
  description?: string;
  comments?: SubtaskComment[];
}

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:viewMode', value: 'drawer' | 'modal'): void;
  (e: 'close'): void;
  (e: 'delete', task: Task): void;
  (e: 'save', payload: TaskUpdatePayload | Task): void;
  (e: 'user-click', userId: string): void;
  (e: 'update:activeSubtaskId', value: string | null): void;
}>();

const drawerForm = ref({
  title: '',
  description: '',
  status: '',
  priority: 'MEDIUM',
  tags: [] as string[],
  dueDate: '',
  assigneeId: '',
  projectId: '',
  teamId: '',
  participantIds: [] as string[],
  timeEstimateHours: 0,
  timeSpentHours: 0,
});

const drawerSubtasks = ref<Subtask[]>([]);
const detailDrawerTagInput = ref('');

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
  } catch {
    return [];
  }
};

// Initialize form from task prop
watch(
  () => props.task?.id,
  () => {
    const newTask = props.task;
    if (newTask) {
      drawerForm.value = {
        title: newTask.title,
        description: newTask.description || '',
        status: newTask.status,
        priority: newTask.priority || 'MEDIUM',
        tags: parseTags(newTask.tags),
        dueDate: newTask.dueDate || '',
        assigneeId: newTask.assigneeId || '',
        projectId: newTask.projectId || '',
        teamId: newTask.teamId || '',
        participantIds: newTask.participants?.map((p) => p.userId) || [],
        timeEstimateHours: newTask.timeEstimate ? newTask.timeEstimate / 60 : 0,
        timeSpentHours: newTask.timeSpent ? newTask.timeSpent / 60 : 0,
      };
      drawerSubtasks.value = parseSubtasks(newTask.subtasks);
      detailDrawerTagInput.value = '';
    }
  },
  { immediate: true },
);

const triggerSave = () => {
  emit('save', {
    title: drawerForm.value.title,
    description: drawerForm.value.description,
    status: drawerForm.value.status,
    priority: drawerForm.value.priority,
    dueDate: drawerForm.value.dueDate || null,
    assigneeId: drawerForm.value.assigneeId || null,
    projectId: drawerForm.value.projectId || null,
    teamId: drawerForm.value.teamId || null,
    tags: drawerForm.value.tags.length > 0 ? JSON.stringify(drawerForm.value.tags) : null,
    subtasks: JSON.stringify(drawerSubtasks.value),
    participantIds: drawerForm.value.participantIds,
    timeEstimate: Math.round((drawerForm.value.timeEstimateHours || 0) * 60),
    timeSpent: Math.round((drawerForm.value.timeSpentHours || 0) * 60),
  });
};

const copyToClipboard = (text: string) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success('任务ID已复制到剪贴板');
    })
    .catch(() => {
      ElMessage.error('复制失败');
    });
};

const toggleDetailViewMode = () => {
  const nextMode = props.viewMode === 'drawer' ? 'modal' : 'drawer';
  emit('update:viewMode', nextMode);
};

const handleDelete = () => {
  if (props.task) {
    emit('delete', props.task);
  }
};

const handleClose = () => {
  emit('close');
};

const drawerAddTag = () => {
  const tag = detailDrawerTagInput.value.trim();
  if (tag && !drawerForm.value.tags.includes(tag)) {
    drawerForm.value.tags.push(tag);
    triggerSave();
  }
  detailDrawerTagInput.value = '';
};

const drawerRemoveTag = (tag: string) => {
  drawerForm.value.tags = drawerForm.value.tags.filter((t) => t !== tag);
  triggerSave();
};

// Child components refs
const subtasksRef = ref<InstanceType<typeof TaskSubtasks> | null>(null);
const commentsRef = ref<InstanceType<typeof TaskComments> | null>(null);
const activitiesRef = ref<InstanceType<typeof TaskActivities> | null>(null);

const handleSubtasksUpdate = (newSubtasks: Subtask[]) => {
  drawerSubtasks.value = newSubtasks;
  triggerSave();
};

const isImagePreviewOpen = ref(false);
const previewImageUrl = ref('');

const openImageModal = (url: string) => {
  previewImageUrl.value = url;
  isImagePreviewOpen.value = true;
};

// Description edit states
const isEditingDescription = ref(false);
const originalDescription = ref('');
const tempDescriptionImages = ref<string[]>([]);
const originalDescriptionImages = ref<string[]>([]);

const startEditingDescription = () => {
  const parsed = parseCommentContent(drawerForm.value.description);
  drawerForm.value.description = parsed.text;
  tempDescriptionImages.value = [...parsed.images];
  originalDescription.value = parsed.text;
  originalDescriptionImages.value = [...parsed.images];
  isEditingDescription.value = true;
};

const saveDescription = () => {
  let finalDesc = (drawerForm.value.description || '').trim();
  if (tempDescriptionImages.value.length > 0) {
    finalDesc +=
      (finalDesc ? '\n' : '') +
      tempDescriptionImages.value.map((url) => `![图片](${url})`).join('\n');
  }
  drawerForm.value.description = finalDesc;
  isEditingDescription.value = false;
  triggerSave();
};

const cancelEditingDescription = () => {
  let originalDesc = originalDescription.value.trim();
  if (originalDescriptionImages.value.length > 0) {
    originalDesc +=
      (originalDesc ? '\n' : '') +
      originalDescriptionImages.value.map((url) => `![图片](${url})`).join('\n');
  }
  drawerForm.value.description = originalDesc;
  isEditingDescription.value = false;
};

const handlePasteMainDescription = async (event: ClipboardEvent) => {
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
          tempDescriptionImages.value.push(imageUrl);
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
    tempDescriptionImages.value.push(pastedText.trim());
    ElMessage.success('图片链接已识别');
  }
};

// Dependency management logic
const projectTasks = ref<Task[]>([]);
const selectedDepTaskId = ref('');
const isDependencyLoading = ref(false);

const fetchProjectTasks = async () => {
  if (!props.task?.projectId) {
    projectTasks.value = [];
    return;
  }
  try {
    const response = await api.get('/api/tasks', {
      params: { projectId: props.task.projectId },
    });
    projectTasks.value = response.data;
  } catch (error) {
    logError(error, { operation: 'task.fetchProjectTasks', component: 'TaskDetailDrawer' });
  }
};

const addDependency = async () => {
  if (!selectedDepTaskId.value || !props.task?.id) return;
  isDependencyLoading.value = true;
  try {
    const response = await api.post(`/api/tasks/${props.task.id}/dependencies`, {
      dependsOnId: selectedDepTaskId.value,
    });
    emit('save', response.data);
    selectedDepTaskId.value = '';
    ElMessage.success('成功添加前置任务依赖');
  } catch (error) {
    const msg = isAxiosError(error)
      ? error.response?.data?.error || '添加依赖失败'
      : '添加依赖失败';
    ElMessage.error(msg);
  } finally {
    isDependencyLoading.value = false;
  }
};

const deleteDependency = async (dependsOnId: string) => {
  if (!props.task?.id) return;
  isDependencyLoading.value = true;
  try {
    const response = await api.delete(`/api/tasks/${props.task.id}/dependencies/${dependsOnId}`);
    emit('save', response.data);
    ElMessage.success('成功移除前置任务依赖');
  } catch (error) {
    const msg = isAxiosError(error)
      ? error.response?.data?.error || '移除依赖失败'
      : '移除依赖失败';
    ElMessage.error(msg);
  } finally {
    isDependencyLoading.value = false;
  }
};

const availableTasksForDependency = computed(() => {
  if (!props.task) return [];
  let list = projectTasks.value.filter((t) => t.id !== props.task!.id);
  const existingDepIds = new Set(props.task.dependencies?.map((d) => d.dependsOnId) || []);
  list = list.filter((t) => !existingDepIds.has(t.id));
  return list;
});

const isBlockedByDependencies = computed(() => {
  if (!props.task?.dependencies) return false;
  return props.task.dependencies.some((d) => d.dependsOn?.status !== 'DONE');
});

const unfinishedDependencies = computed(() => {
  if (!props.task?.dependencies) return [];
  return props.task.dependencies
    .filter((d) => d.dependsOn?.status !== 'DONE')
    .map((d) => d.dependsOn);
});

const fetchComments = () => {
  commentsRef.value?.refresh();
};

const fetchActivities = () => {
  activitiesRef.value?.refresh();
};

watch(
  [() => props.task?.id, () => props.task?.projectId, () => props.modelValue],
  ([newTaskId, newProjectId, isOpen]) => {
    if (isOpen && newTaskId) {
      fetchComments();
      fetchActivities();
      if (newProjectId) {
        fetchProjectTasks();
      } else {
        projectTasks.value = [];
      }
    }
  },
  { immediate: true },
);

watch(
  () => props.task?.updatedAt,
  (newVal, oldVal) => {
    if (newVal !== oldVal && props.modelValue && props.task?.id) {
      fetchActivities();
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition :name="viewMode === 'drawer' ? 'drawer-slide' : 'modal-fade'">
      <div
        v-if="modelValue && task"
        class="fixed inset-0 z-50 flex transition-all duration-300"
        :class="
          viewMode === 'drawer'
            ? 'justify-end'
            : 'items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-md'
        "
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 cursor-pointer"
          :class="viewMode === 'drawer' ? 'bg-black/40 backdrop-blur-md' : ''"
          @click="handleClose"
        ></div>

        <!-- Drawer/Modal Content Container -->
        <div
          class="task-detail-content relative shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
          :class="[
            viewMode === 'drawer'
              ? 'w-full sm:w-[85%] md:w-[75%] lg:w-[65%] xl:w-[55%] h-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-[var(--border-base)]'
              : 'modal-content glass-panel w-full max-w-4xl h-[90vh] md:h-[85vh] rounded-3xl',
          ]"
          :style="
            viewMode === 'drawer'
              ? {
                  borderColor: 'var(--border-base)',
                  borderLeftWidth: '1px',
                }
              : {}
          "
        >
          <!-- Header -->
          <div
            class="px-6 py-4 border-b flex items-center justify-between shrink-0"
            style="border-color: var(--border-base)"
          >
            <div class="flex items-center gap-2">
              <div class="p-1.5 bg-gradient-to-br from-accent to-indigo-600 rounded-lg text-white">
                <CheckCircle2 class="w-4 h-4" />
              </div>
              <h3 class="text-sm font-black tracking-tight" style="color: var(--text-primary)">
                任务详情
              </h3>
              <div
                class="flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 rounded text-[10px] font-mono font-bold cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-slate-600 dark:text-slate-300"
                title="点击复制任务ID"
                @click="copyToClipboard(task.id)"
              >
                <span>#{{ task.id.substring(0, 8) }}</span>
                <Copy class="w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>
            <div class="flex items-center gap-3">
              <!-- View Mode Toggle (Drawer vs Modal) -->
              <button
                type="button"
                class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all text-slate-500 dark:text-slate-400 cursor-pointer"
                :title="viewMode === 'drawer' ? '切换为弹窗模式' : '切换为抽屉模式'"
                @click="toggleDetailViewMode"
              >
                <component
                  :is="viewMode === 'drawer' ? Maximize2 : Minimize2"
                  class="w-4.5 h-4.5"
                />
              </button>

              <button
                type="button"
                class="px-3 py-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all flex items-center gap-1 cursor-pointer"
                @click="handleDelete"
              >
                <Trash2 class="w-3.5 h-3.5" /> 删除任务
              </button>
              <button
                type="button"
                class="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                style="color: var(--text-secondary)"
                @click="handleClose"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Content Body -->
          <div
            class="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col lg:flex-row gap-6 md:gap-8 scrollbar-hide"
          >
            <!-- Left Column: Title, Description, Subtasks Checklist -->
            <div class="flex-1 space-y-6 min-w-0">
              <!-- Title Input -->
              <div>
                <label
                  class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                  >任务标题</label
                >
                <input
                  v-model="drawerForm.title"
                  type="text"
                  class="w-full text-xl sm:text-2xl font-black bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 transition-all text-primary !rounded-xl !px-4 !py-3 focus:outline-none focus:border-accent/45"
                  placeholder="未命名任务"
                  style="color: var(--text-primary)"
                  @blur="triggerSave"
                />
              </div>

              <!-- Dependency Blocker Warning Banner -->
              <div
                v-if="isBlockedByDependencies"
                class="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-2xl flex items-start gap-2.5"
              >
                <span class="text-rose-500 text-sm mt-0.5">⚠️</span>
                <div>
                  <h4 class="text-xs font-bold text-rose-700 dark:text-rose-400">
                    此任务目前被以下前置任务阻塞：
                  </h4>
                  <div class="flex flex-wrap gap-1.5 mt-2">
                    <span
                      v-for="dep in unfinishedDependencies"
                      :key="dep.id"
                      class="px-2 py-0.5 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold rounded-lg"
                    >
                      {{ dep.title }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Description Textarea -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-accent"></span> 详细描述
                  </label>
                  <button
                    v-if="!isEditingDescription"
                    type="button"
                    class="text-[10px] font-bold text-accent hover:underline cursor-pointer"
                    @click="startEditingDescription"
                  >
                    编辑描述
                  </button>
                </div>

                <!-- Plain Editor Mode -->
                <div v-if="isEditingDescription" class="space-y-2">
                  <textarea
                    v-model="drawerForm.description"
                    placeholder="输入任务描述、参考资料或笔记... (支持粘贴图片)"
                    class="w-full min-h-[160px] p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs focus:outline-none focus:border-accent/40 focus:border-solid transition-all resize-y"
                    style="color: var(--text-primary)"
                    @paste="handlePasteMainDescription"
                  ></textarea>

                  <!-- Image Previews during Editing -->
                  <div
                    v-if="tempDescriptionImages.length > 0"
                    class="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl"
                  >
                    <div
                      v-for="(img, idx) in tempDescriptionImages"
                      :key="img"
                      class="relative group w-20 h-20 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                    >
                      <img
                        :src="img"
                        class="w-full h-full object-cover cursor-zoom-in"
                        @click="openImageModal(img)"
                      />
                      <button
                        type="button"
                        class="absolute top-1 right-1 p-1 bg-black/55 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer flex items-center justify-center"
                        @click="tempDescriptionImages.splice(idx, 1)"
                      >
                        <X class="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl hover:opacity-80 transition-all cursor-pointer"
                      @click="cancelEditingDescription"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1.5 bg-accent text-white text-xs font-bold rounded-xl hover:opacity-85 transition-all cursor-pointer"
                      @click="saveDescription"
                    >
                      保存描述
                    </button>
                  </div>
                </div>

                <!-- Preview Mode (Click to Edit) -->
                <div
                  v-else
                  class="px-4 py-3 bg-slate-50 dark:bg-white/2 border border-slate-200 dark:border-white/5 rounded-2xl min-h-[120px] cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/5 transition-all group/desc relative"
                  @click="startEditingDescription"
                >
                  <div
                    v-if="!drawerForm.description"
                    class="text-xs text-slate-400 dark:text-slate-500 italic py-4 text-center select-none"
                  >
                    + 点击添加详细描述、参考资料或笔记...
                  </div>
                  <div
                    v-else
                    class="text-xs leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300 space-y-2"
                  >
                    <p>{{ parseCommentContent(drawerForm.description).text }}</p>
                    <div
                      v-if="parseCommentContent(drawerForm.description).images.length > 0"
                      class="flex flex-wrap gap-2 pt-1"
                    >
                      <img
                        v-for="img in parseCommentContent(drawerForm.description).images"
                        :key="img"
                        :src="img"
                        class="max-w-full max-h-[300px] rounded-lg border object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                        style="border-color: var(--border-base)"
                        @click.stop="openImageModal(img)"
                      />
                    </div>
                  </div>
                  <div
                    class="absolute right-3 top-3 opacity-0 group-hover/desc:opacity-100 text-[10px] text-accent font-bold transition-all bg-white dark:bg-slate-800 px-2 py-0.5 rounded shadow border"
                    style="border-color: var(--border-base)"
                  >
                    点击编辑
                  </div>
                </div>
              </div>

              <!-- Subtasks Checklist Section -->
              <TaskSubtasks
                ref="subtasksRef"
                :subtasks="drawerSubtasks"
                :team-members="teamMembers"
                @update:subtasks="handleSubtasksUpdate"
                @image-click="openImageModal"
              />

              <!-- Dependencies Section -->
              <div class="pt-6 border-t" style="border-color: var(--border-base)">
                <div class="flex items-center gap-2 mb-4">
                  <Link2 class="w-4 h-4 text-accent" />
                  <h3 class="text-sm font-bold" style="color: var(--text-primary)">任务依赖关系</h3>
                </div>

                <div class="space-y-4">
                  <!-- Dependencies List (Waiting on) -->
                  <div>
                    <h4 class="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2">
                      前置依赖 (等待以下任务完成)
                    </h4>
                    <div
                      v-if="!task.dependencies || task.dependencies.length === 0"
                      class="text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-white/2 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center"
                    >
                      暂无前置依赖任务
                    </div>
                    <div v-else class="space-y-1.5">
                      <div
                        v-for="dep in task.dependencies"
                        :key="dep.id"
                        class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5"
                      >
                        <div class="flex items-center gap-2 min-w-0">
                          <span
                            class="w-1.5 h-1.5 rounded-full shrink-0"
                            :class="
                              dep.dependsOn?.status === 'DONE' ? 'bg-emerald-500' : 'bg-amber-500'
                            "
                          ></span>
                          <span
                            class="text-xs font-medium truncate"
                            :style="{ color: 'var(--text-primary)' }"
                            >{{ dep.dependsOn?.title }}</span
                          >
                          <span
                            class="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                            :class="
                              dep.dependsOn?.status === 'DONE'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : dep.dependsOn?.status === 'IN_PROGRESS'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : 'bg-slate-500/10 text-slate-500'
                            "
                          >
                            {{
                              dep.dependsOn?.status === 'DONE'
                                ? '已完成'
                                : dep.dependsOn?.status === 'IN_PROGRESS'
                                  ? '进行中'
                                  : '待办'
                            }}
                          </span>
                        </div>
                        <button
                          type="button"
                          class="p-1 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                          @click="deleteDependency(dep.dependsOnId)"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Dependents List (Blocking) -->
                  <div v-if="task.dependents && task.dependents.length > 0">
                    <h4 class="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2">
                      后置依赖 (正在阻塞以下任务)
                    </h4>
                    <div class="space-y-1.5">
                      <div
                        v-for="dep in task.dependents"
                        :key="dep.id"
                        class="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 min-w-0"
                      >
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                        <span
                          class="text-xs font-medium truncate"
                          :style="{ color: 'var(--text-primary)' }"
                          >{{ dep.task?.title }}</span
                        >
                        <span
                          class="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
                          :class="
                            dep.task?.status === 'DONE'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : dep.task?.status === 'IN_PROGRESS'
                                ? 'bg-blue-500/10 text-blue-500'
                                : 'bg-slate-500/10 text-slate-500'
                          "
                        >
                          {{
                            dep.task?.status === 'DONE'
                              ? '已完成'
                              : dep.task?.status === 'IN_PROGRESS'
                                ? '进行中'
                                : '待办'
                          }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Add Dependency Control -->
                  <div v-if="task.projectId" class="flex items-center gap-2">
                    <el-select
                      v-model="selectedDepTaskId"
                      filterable
                      placeholder="添加前置任务依赖..."
                      class="flex-1 custom-select-small"
                      :loading="isDependencyLoading"
                    >
                      <el-option
                        v-for="t in availableTasksForDependency"
                        :key="t.id"
                        :label="t.title"
                        :value="t.id"
                      />
                    </el-select>
                    <button
                      type="button"
                      class="px-3.5 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:opacity-85 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                      :disabled="!selectedDepTaskId || isDependencyLoading"
                      @click="addDependency"
                    >
                      <Plus class="w-3.5 h-3.5" /> 添加
                    </button>
                  </div>
                </div>
              </div>

              <!-- Comments Section -->
              <TaskComments
                ref="commentsRef"
                :task-id="task?.id"
                @comments-changed="activitiesRef?.refresh()"
                @image-click="openImageModal"
              />
            </div>

            <!-- Right Column: Metadata Sidebar -->
            <div
              class="w-full lg:w-[320px] xl:w-[360px] shrink-0 h-fit space-y-5 p-4 md:p-5 bg-slate-500/5 dark:bg-white/[0.02] rounded-2xl border"
              style="border-color: var(--border-base)"
            >
              <h3
                class="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 pb-2 border-b"
                style="border-color: var(--border-base)"
              >
                任务属性
              </h3>

              <!-- Grid container for compact metadata -->
              <div class="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <!-- Status selector -->
                <div>
                  <label
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                    >当前状态</label
                  >
                  <el-select
                    v-model="drawerForm.status"
                    class="!w-full custom-select-small"
                    @change="triggerSave"
                  >
                    <el-option
                      v-for="c in statusColumns"
                      :key="c.id"
                      :label="c.title"
                      :value="c.id"
                    />
                  </el-select>
                </div>

                <!-- Priority selector -->
                <div>
                  <label
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                    >优先级</label
                  >
                  <el-select
                    v-model="drawerForm.priority"
                    class="!w-full custom-select-small"
                    @change="triggerSave"
                  >
                    <el-option
                      v-for="p in priorityOptions"
                      :key="p.id"
                      :label="p.label"
                      :value="p.id"
                    >
                      <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full" :class="p.color"></div>
                        <span class="text-xs">{{ p.label }}</span>
                      </div>
                    </el-option>
                  </el-select>
                </div>

                <!-- Due Date picker -->
                <div>
                  <label
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                    >截止日期</label
                  >
                  <el-date-picker
                    v-model="drawerForm.dueDate"
                    type="date"
                    placeholder="无截止日期"
                    class="!w-full custom-date-picker-small"
                    @change="triggerSave"
                  />
                </div>

                <!-- Project selector -->
                <div>
                  <label
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                    >关联项目</label
                  >
                  <el-select
                    v-model="drawerForm.projectId"
                    clearable
                    placeholder="未关联"
                    class="!w-full custom-select-small"
                    @change="triggerSave"
                  >
                    <el-option v-for="p in projects" :key="p.id" :label="p.title" :value="p.id" />
                  </el-select>
                </div>

                <!-- 预计工时 (小时) -->
                <div>
                  <label
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"
                  >
                    <Clock class="w-3 h-3 text-slate-400" /> 预计工时 (时)
                  </label>
                  <el-input-number
                    v-model="drawerForm.timeEstimateHours"
                    :min="0"
                    :precision="1"
                    :step="0.5"
                    placeholder="0.0"
                    class="!w-full custom-input-number-small"
                    @change="triggerSave"
                  />
                </div>

                <!-- 已耗工时 (小时) -->
                <div>
                  <label
                    class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"
                  >
                    <Clock class="w-3 h-3 text-slate-400" /> 已耗工时 (时)
                  </label>
                  <el-input-number
                    v-model="drawerForm.timeSpentHours"
                    :min="0"
                    :precision="1"
                    :step="0.5"
                    placeholder="0.0"
                    class="!w-full custom-input-number-small"
                    @change="triggerSave"
                  />
                </div>
              </div>

              <!-- Co-participants selector -->
              <div>
                <label
                  class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                  >负责人</label
                >
                <el-select
                  v-model="drawerForm.participantIds"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  placeholder="未指派"
                  class="!w-full custom-select-small"
                  @change="triggerSave"
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

              <!-- Tags selector / edit -->
              <div>
                <label
                  class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                  >标签</label
                >
                <div class="flex flex-wrap gap-1 mb-2">
                  <span
                    v-for="tag in drawerForm.tags"
                    :key="tag"
                    class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[8px] font-bold"
                    :class="getTagClass(tag)"
                  >
                    # {{ tag }}
                    <button type="button" @click="drawerRemoveTag(tag)">
                      <X class="w-2 h-2 hover:opacity-75" />
                    </button>
                  </span>
                </div>
                <div class="flex gap-1.5">
                  <input
                    v-model="detailDrawerTagInput"
                    type="text"
                    placeholder="新建标签..."
                    class="flex-1 px-2.5 py-1 bg-slate-100 dark:bg-white/5 border-none rounded-lg text-[10px] focus:outline-none"
                    @keyup.enter="drawerAddTag"
                  />
                  <button
                    type="button"
                    class="p-1 bg-slate-100 dark:bg-white/5 hover:text-accent rounded-lg text-xs"
                    @click="drawerAddTag"
                  >
                    +
                  </button>
                </div>
              </div>

              <!-- Task Activities (任务动态) -->
              <TaskActivities ref="activitiesRef" :task-id="task?.id" />

              <!-- Final Manual Save Feedback -->
              <div class="pt-4 border-t" style="border-color: var(--border-base)">
                <button
                  type="button"
                  class="w-full py-2.5 bg-gradient-to-r from-accent to-indigo-600 hover:from-accent hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-accent/20 hover:shadow-accent/35 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  @click="handleClose"
                >
                  关闭并保存所有更改
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Image Preview Dialog -->
  <Modal :show="isImagePreviewOpen" size="xl" padding="none" @close="isImagePreviewOpen = false">
    <div class="flex items-center justify-center p-2">
      <img
        v-if="previewImageUrl"
        :src="previewImageUrl"
        class="max-w-full max-h-[80vh] rounded-xl object-contain"
      />
    </div>
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
