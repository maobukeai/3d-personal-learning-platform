<script setup lang="ts">
import { ref, watch, computed, type Component, onMounted, onUnmounted } from 'vue';
import {
  CheckCircle2,
  Copy,
  Maximize2,
  Minimize2,
  Trash2,
  X,
  CheckSquare,
  MessageSquare,
  Send,
  Link2,
  Clock,
  Plus,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { parseTags } from '@/utils/tags';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';

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
  icon?: Component;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority?: string;
  tags?: string | null;
  subtasks?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  participants?: { userId: string }[];
  timeEstimate?: number | null;
  timeSpent?: number | null;
  dependencies?: {
    id: string;
    dependsOnId: string;
    dependsOn: { id: string; title: string; status: string };
  }[];
  dependents?: { id: string; task: { id: string; title: string; status: string } }[];
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

export interface TaskUpdatePayload {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assigneeId: string | null;
  projectId: string | null;
  teamId: string | null;
  tags: string | null;
  subtasks: string;
  participantIds: string[];
  timeEstimate?: number;
  timeSpent?: number;
}

interface SubtaskComment {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
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
const newSubtaskText = ref('');
const detailDrawerTagInput = ref('');

const isImageUrl = (url: string): boolean => {
  const clean = url.trim();
  if (
    !clean.startsWith('http://') &&
    !clean.startsWith('https://') &&
    !clean.startsWith('data:image/')
  )
    return false;
  if (clean.startsWith('data:image/')) return true;

  try {
    const urlObj = new URL(clean);
    const pathname = urlObj.pathname.toLowerCase();
    const cleanUrl = clean.toLowerCase();

    // Check extension in pathname
    if (
      pathname.endsWith('.png') ||
      pathname.endsWith('.jpg') ||
      pathname.endsWith('.jpeg') ||
      pathname.endsWith('.gif') ||
      pathname.endsWith('.webp') ||
      pathname.endsWith('.svg') ||
      pathname.endsWith('.bmp') ||
      pathname.endsWith('.tiff') ||
      pathname.endsWith('.ico')
    ) {
      return true;
    }

    // Check keywords anywhere in the URL (case-insensitive)
    if (
      cleanUrl.includes('/uploads/') ||
      cleanUrl.includes('/image') ||
      cleanUrl.includes('/img/') ||
      cleanUrl.includes('/avatar') ||
      cleanUrl.includes('/photo') ||
      cleanUrl.includes('/pic/') ||
      cleanUrl.includes('placeholder')
    ) {
      return true;
    }

    // Check query params for format
    const format = urlObj.searchParams.get('format') || urlObj.searchParams.get('fmt');
    if (format && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(format.toLowerCase())) {
      return true;
    }
  } catch (e) {
    const lower = clean.toLowerCase();
    return (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp')
    );
  }

  return false;
};

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

// Initialize form from task prop — react to identity change (task switch)
// rather than deep-watching every nested property, which would overwrite
// in-progress edits whenever any subfield mutates.
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
        participantIds: newTask.participants ? newTask.participants.map((p) => p.userId) : [],
        timeEstimateHours: newTask.timeEstimate ? newTask.timeEstimate / 60 : 0,
        timeSpentHours: newTask.timeSpent ? newTask.timeSpent / 60 : 0,
      };
      drawerSubtasks.value = parseSubtasks(newTask.subtasks);
      newSubtaskText.value = '';
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

const addSubtask = () => {
  const text = newSubtaskText.value.trim();
  if (!text) return;
  drawerSubtasks.value.push({
    id: Math.random().toString(36).substring(2, 11),
    text,
    done: false,
  });
  newSubtaskText.value = '';
  triggerSave();
};

const toggleSubtask = (subtask: Subtask) => {
  subtask.done = !subtask.done;
  triggerSave();
};

const removeSubtask = (index: number) => {
  drawerSubtasks.value.splice(index, 1);
  triggerSave();
};

const updateSubtaskText = (index: number, text: string) => {
  drawerSubtasks.value[index].text = text;
  triggerSave();
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

const tagColorMap: Record<string, string> = {
  设计: 'bg-pink-500/10 text-pink-500',
  开发: 'bg-blue-500/10 text-blue-500',
  学习: 'bg-emerald-500/10 text-emerald-500',
  '3D': 'bg-violet-500/10 text-violet-500',
  建模: 'bg-cyan-500/10 text-cyan-500',
  渲染: 'bg-amber-500/10 text-amber-500',
  动画: 'bg-rose-500/10 text-rose-500',
  研究: 'bg-indigo-500/10 text-indigo-500',
  文档: 'bg-teal-500/10 text-teal-500',
  优化: 'bg-lime-500/10 text-lime-500',
};

const defaultTagClass = 'bg-slate-500/10 text-slate-500';

const getTagClass = (tag: string) => tagColorMap[tag] || defaultTagClass;

// Comments logic
const authStore = useAuthStore();
const comments = ref<any[]>([]);
const newCommentText = ref('');
const isCommentsLoading = ref(false);

const fetchComments = async () => {
  if (!props.task?.id) return;
  isCommentsLoading.value = true;
  try {
    const response = await api.get(`/api/tasks/${props.task.id}/comments`);
    comments.value = response.data;
  } catch (error) {
    ElMessage.error('获取评论失败');
  } finally {
    isCommentsLoading.value = false;
  }
};

const tempUploadedImages = ref<string[]>([]);

const handleAddComment = async () => {
  const content = newCommentText.value.trim();
  if (!content && tempUploadedImages.value.length === 0) return;
  if (!props.task?.id) return;
  try {
    let finalContent = content;
    if (tempUploadedImages.value.length > 0) {
      finalContent += '\n' + tempUploadedImages.value.map((url) => `![图片](${url})`).join('\n');
    }
    const response = await api.post(`/api/tasks/${props.task.id}/comments`, {
      content: finalContent,
    });
    comments.value.push(response.data);
    newCommentText.value = '';
    tempUploadedImages.value = [];
    ElMessage.success('发表评论成功');
  } catch (error) {
    ElMessage.error('发表评论失败');
  }
};

const handleDeleteComment = async (commentId: string) => {
  if (!props.task?.id) return;
  try {
    await api.delete(`/api/tasks/${props.task.id}/comments/${commentId}`);
    comments.value = comments.value.filter((c) => c.id !== commentId);
    ElMessage.success('评论删除成功');
  } catch (error) {
    ElMessage.error('删除评论失败');
  }
};

const handlePasteComment = async (event: ClipboardEvent) => {
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
          tempUploadedImages.value.push(imageUrl);
          ElMessage.success('图片上传成功');
        } catch (error) {
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
    tempUploadedImages.value.push(pastedText.trim());
    ElMessage.success('图片链接已识别');
  }
};

const parseCommentContent = (content: string) => {
  if (!content) return { text: '', images: [] };
  const regex = /!\[.*?\]\((.*?)\)/g;
  const images: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    images.push(match[1]);
  }
  const cleanText = content.replace(regex, '').trim();
  return {
    text: cleanText,
    images,
  };
};

const isImagePreviewOpen = ref(false);
const previewImageUrl = ref('');

const openImageModal = (url: string) => {
  previewImageUrl.value = url;
  isImagePreviewOpen.value = true;
};

const closeImageModal = () => {
  isImagePreviewOpen.value = false;
  previewImageUrl.value = '';
};

// Subtask detail view states & methods
const isSubtaskDetailOpen = ref(false);
const editingSubtask = ref<Subtask | null>(null);
const editingSubtaskIndex = ref<number>(-1);
const newSubtaskCommentText = ref('');
const isEditingSubtaskDescription = ref(false);
const tempSubtaskDescriptionImages = ref<string[]>([]);

const getMemberById = (id: string | null | undefined) => {
  if (!id) return null;
  return props.teamMembers?.find((m) => m.id === id) || null;
};

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

  drawerSubtasks.value[editingSubtaskIndex.value] = {
    ...drawerSubtasks.value[editingSubtaskIndex.value],
    ...editingSubtask.value,
    description: finalDesc,
  };
  triggerSave();
};

const handleSaveSubtaskAndClose = () => {
  saveSubtaskChanges();
  isSubtaskDetailOpen.value = false;
};

const handleCancelSubtaskEdit = () => {
  isSubtaskDetailOpen.value = false;
};

watch(
  [() => props.activeSubtaskId, () => drawerSubtasks.value],
  ([subId, subtasks]) => {
    if (subId && subtasks && subtasks.length > 0) {
      let idx = subtasks.findIndex((s) => s.id === subId);
      if (idx === -1 && subId.includes('_sub_')) {
        const parts = subId.split('_sub_');
        const indexStr = parts[parts.length - 1];
        const index = parseInt(indexStr, 10);
        if (!isNaN(index) && index >= 0 && index < subtasks.length) {
          idx = index;
        }
      }
      if (idx !== -1) {
        openSubtaskDetail(subtasks[idx], idx);
      }
    } else if (!subId) {
      isSubtaskDetailOpen.value = false;
    }
  },
  { immediate: true },
);

watch(isSubtaskDetailOpen, (newVal) => {
  if (!newVal) {
    emit('update:activeSubtaskId', null);
  }
});

const tempUploadedSubtaskImages = ref<string[]>([]);

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
        } catch (error) {
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

const deleteSubtaskComment = (cmtIndex: number) => {
  if (!editingSubtask.value || !editingSubtask.value.comments) return;
  editingSubtask.value.comments.splice(cmtIndex, 1);
  saveSubtaskChanges();
};

// Dark theme observer for MdEditor
const isDark = ref(document.documentElement.classList.contains('dark'));
let themeObserver: MutationObserver | null = null;

onMounted(() => {
  themeObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark');
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});

onUnmounted(() => {
  themeObserver?.disconnect();
});

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
        } catch (error) {
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
        } catch (error) {
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

// Dependency management logic
const projectTasks = ref<any[]>([]);
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
    console.error('Failed to fetch project tasks for dependencies:', error);
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
  } catch (error: any) {
    const msg = error.response?.data?.error || '添加依赖失败';
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
  } catch (error: any) {
    const msg = error.response?.data?.error || '移除依赖失败';
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

watch(
  [() => props.task?.id, () => props.task?.projectId, () => props.modelValue],
  ([newTaskId, newProjectId, isOpen]) => {
    if (isOpen && newTaskId) {
      fetchComments();
      if (newProjectId) {
        fetchProjectTasks();
      } else {
        projectTasks.value = [];
      }
    }
  },
  { immediate: true },
);
</script>

<template>
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
        class="task-detail-content relative shadow-2xl flex flex-col overflow-hidden transition-all duration-300 border-[var(--border-base)] bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl"
        :class="[
          viewMode === 'drawer'
            ? 'w-full sm:w-[85%] md:w-[75%] lg:w-[65%] xl:w-[55%] h-full'
            : 'w-full max-w-4xl h-[90vh] md:h-[85vh] rounded-2xl border',
        ]"
        :style="{
          borderColor: 'var(--border-base)',
          borderLeftWidth: viewMode === 'drawer' ? '1px' : '0px',
        }"
      >
        <!-- Header -->
        <div
          class="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-center gap-2 text-slate-400">
            <CheckCircle2 class="w-4 h-4 text-accent" />
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400">任务详情</span>
            <div
              class="flex items-center gap-1 px-2 py-0.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded text-[10px] font-mono font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-slate-600 dark:text-slate-300"
              title="点击复制任务ID"
              @click="copyToClipboard(task.id)"
            >
              <span>#{{ task.id.substring(0, 8) }}</span>
              <Copy class="w-3 h-3 text-slate-400" />
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
              <component :is="viewMode === 'drawer' ? Maximize2 : Minimize2" class="w-4.5 h-4.5" />
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
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer"
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
                class="w-full text-xl sm:text-2xl font-black bg-transparent border-b border-transparent focus:border-accent/30 focus:outline-none py-1.5 transition-all text-primary"
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
            <div class="pt-4 border-t" style="border-color: var(--border-base)">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <CheckSquare class="w-4 h-4 text-accent" />
                  <h3 class="text-sm font-bold" style="color: var(--text-primary)">子任务清单</h3>
                  <span v-if="drawerSubtasks.length > 0" class="text-xs text-slate-400 font-bold">
                    ({{ drawerSubtasks.filter((s) => s.done).length }}/{{ drawerSubtasks.length }})
                  </span>
                </div>
              </div>

              <!-- Subtask Progress Bar -->
              <div
                v-if="drawerSubtasks.length > 0"
                class="w-full bg-slate-100 dark:bg-white/10 h-1.5 rounded-full mb-4 overflow-hidden"
              >
                <div
                  class="bg-accent h-full transition-all duration-300"
                  :style="{
                    width: `${(drawerSubtasks.filter((s) => s.done).length / drawerSubtasks.length) * 100}%`,
                  }"
                ></div>
              </div>

              <!-- Checklist Items -->
              <div class="space-y-2 mb-4">
                <div
                  v-for="(sub, index) in drawerSubtasks"
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
                  class="px-3 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:opacity-85 transition-all"
                  @click="addSubtask"
                >
                  添加
                </button>
              </div>
            </div>

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
            <div class="pt-6 border-t" style="border-color: var(--border-base)">
              <div class="flex items-center gap-2 mb-4">
                <MessageSquare class="w-4 h-4 text-accent" />
                <h3 class="text-sm font-bold" style="color: var(--text-primary)">评论讨论区</h3>
                <span v-if="comments.length > 0" class="text-xs text-slate-400 font-bold">
                  ({{ comments.length }})
                </span>
              </div>

              <!-- Comment List -->
              <div class="space-y-4 mb-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
                <div v-if="isCommentsLoading" class="text-center py-4 text-xs text-slate-400">
                  加载评论中...
                </div>
                <div
                  v-else-if="comments.length === 0"
                  class="text-center py-4 text-xs text-slate-400 dark:text-slate-500"
                >
                  暂无讨论，发表第一条评论吧！
                </div>
                <div
                  v-for="comment in comments"
                  v-else
                  :key="comment.id"
                  class="flex gap-3 group/comment p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <!-- Avatar -->
                  <div class="shrink-0">
                    <img
                      v-if="comment.user?.avatarUrl"
                      :src="comment.user.avatarUrl"
                      class="w-7 h-7 rounded-full object-cover"
                      alt=""
                    />
                    <div
                      v-else
                      class="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xs"
                    >
                      {{ comment.user?.name?.[0] || 'U' }}
                    </div>
                  </div>

                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <span class="text-xs font-bold" style="color: var(--text-primary)">
                        {{ comment.user?.name || '未知用户' }}
                      </span>
                      <div class="flex items-center gap-2">
                        <span class="text-[10px] text-slate-400">
                          {{ new Date(comment.createdAt).toLocaleString() }}
                        </span>
                        <!-- Delete Action -->
                        <button
                          v-if="
                            comment.userId === authStore.user?.id ||
                            authStore.user?.role === 'ADMIN'
                          "
                          type="button"
                          class="opacity-0 group-hover/comment:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 rounded transition-opacity"
                          @click="handleDeleteComment(comment.id)"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div class="space-y-1.5">
                      <p
                        v-if="parseCommentContent(comment.content).text"
                        class="text-xs whitespace-pre-wrap leading-relaxed text-slate-600 dark:text-slate-300"
                      >
                        {{ parseCommentContent(comment.content).text }}
                      </p>
                      <div
                        v-if="parseCommentContent(comment.content).images.length > 0"
                        class="flex flex-wrap gap-2 pt-1"
                      >
                        <img
                          v-for="img in parseCommentContent(comment.content).images"
                          :key="img"
                          :src="img"
                          class="max-w-[200px] max-h-[150px] rounded-lg border object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                          style="border-color: var(--border-base)"
                          @click="openImageModal(img)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Comment Input -->
              <div class="space-y-2">
                <!-- Pasted Image Preview List -->
                <div
                  v-if="tempUploadedImages.length > 0"
                  class="flex flex-wrap gap-2 p-2 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <div
                    v-for="(url, idx) in tempUploadedImages"
                    :key="url"
                    class="relative group w-16 h-16 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
                  >
                    <img :src="url" class="w-full h-full object-cover" />
                    <button
                      type="button"
                      class="absolute top-1 right-1 p-0.5 bg-black/55 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer flex items-center justify-center"
                      @click="tempUploadedImages.splice(idx, 1)"
                    >
                      <X class="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div class="flex gap-2 items-end">
                  <textarea
                    v-model="newCommentText"
                    rows="2"
                    placeholder="输入评论或反馈，按 Enter 发送... (支持粘贴图片)"
                    class="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-accent/40 focus:border-solid transition-all resize-none"
                    style="color: var(--text-primary)"
                    @keyup.enter.exact.prevent="handleAddComment"
                    @paste="handlePasteComment"
                  ></textarea>
                  <button
                    type="button"
                    class="p-2.5 bg-accent hover:opacity-85 text-white rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer"
                    @click="handleAddComment"
                  >
                    <Send class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Metadata Sidebar -->
          <div
            class="w-full lg:w-[320px] xl:w-[360px] shrink-0 space-y-5 p-4 md:p-5 bg-slate-50/50 dark:bg-white/2 rounded-2xl border"
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

              <!-- Assignee selector -->
              <div>
                <label
                  class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5"
                  >负责人</label
                >
                <el-select
                  v-model="drawerForm.assigneeId"
                  clearable
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
              <div class="col-span-2">
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
                >参与人员</label
              >
              <el-select
                v-model="drawerForm.participantIds"
                multiple
                placeholder="无其他参与人"
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

            <!-- Final Manual Save Feedback -->
            <div class="pt-4 border-t" style="border-color: var(--border-base)">
              <button
                type="button"
                class="w-full py-2.5 bg-accent text-white rounded-xl font-bold text-xs shadow-md shadow-accent/25 hover:shadow-lg hover:shadow-accent/35 transition-all"
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

  <!-- Image Preview Dialog -->
  <el-dialog
    v-model="isImagePreviewOpen"
    :show-close="true"
    align-center
    width="fit-content"
    style="background: transparent; box-shadow: none"
  >
    <img
      v-if="previewImageUrl"
      :src="previewImageUrl"
      class="max-w-[85vw] max-h-[80vh] rounded-xl object-contain border"
      style="border-color: var(--border-base)"
    />
  </el-dialog>

  <!-- Subtask Detail Modal -->
  <el-dialog
    v-model="isSubtaskDetailOpen"
    :title="'子任务详情'"
    width="500px"
    align-center
    class="custom-subtask-dialog"
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
                @click="openImageModal(img)"
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
                @click.stop="openImageModal(img)"
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
                  @click="openImageModal(img)"
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
      <div class="flex justify-end gap-2 pt-2 border-t" style="border-color: var(--border-base)">
        <el-button size="small" @click="handleCancelSubtaskEdit">取消</el-button>
        <el-button type="primary" size="small" @click="handleSaveSubtaskAndClose">确定</el-button>
      </div>
    </template>
  </el-dialog>
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
