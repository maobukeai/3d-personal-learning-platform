import { computed, ref } from 'vue';
import { TaskStatus } from '@/types';
import type { Task as BaseTask, Subtask, UserType } from '@/types/task';
import api from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import { useAuthStore } from '@/stores/auth';
import { parseCommentContent } from '@/components/taskDetail/helpers';

export interface Task extends BaseTask {
  isSubtask?: boolean;
  parentId?: string | null;
  subtaskIndex?: number;
}

export interface CardConfig {
  cover?: boolean;
  assignee?: boolean;
  dueDate?: boolean;
  priority?: boolean;
  project?: boolean;
  subtasks?: boolean;
  description?: boolean;
  timeTracking?: boolean;
}

export interface TaskCardProps {
  task: Task;
  layout?: 'board' | 'list';
  config?: CardConfig;
  teamMembers?: UserType[];
}

export interface TaskCardEmits {
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
}

export const parseSubtasksHelper = (subtasksStr: string | null | undefined): Subtask[] => {
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

export const useTaskCardState = (props: TaskCardProps, emit: TaskCardEmits) => {
  const authStore = useAuthStore();

  const isBlocked = computed(() => {
    return Boolean(
      props.task.dependencies &&
      props.task.dependencies.some((d) => d.dependsOn?.status !== 'DONE'),
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

  const parsedSubtasks = computed((): Subtask[] => {
    if (props.task.parsedSubtasks && Array.isArray(props.task.parsedSubtasks)) {
      return props.task.parsedSubtasks.map(
        (s, idx): Subtask => ({
          ...s,
          id: s.id || `subtask-legacy-${idx}`,
        }),
      );
    }
    return parseSubtasksHelper(props.task.subtasks);
  });

  const hasSubtasks = computed(() => parsedSubtasks.value.length > 0);
  const subtasksProgress = computed(() => {
    const total = parsedSubtasks.value.length;
    const completed = parsedSubtasks.value.filter((s: Subtask) => s.done).length;
    return `${completed}/${total}`;
  });

  const subtasksPercent = computed(() => {
    if (!parsedSubtasks.value || parsedSubtasks.value.length === 0) return 0;
    const doneCount = parsedSubtasks.value.filter((s) => s.done).length;
    return Math.round((doneCount / parsedSubtasks.value.length) * 100);
  });

  const uncompletedSubtasks = computed(() => {
    return (parsedSubtasks.value || []).filter((s) => !s.done);
  });

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
    let subtasksList: Subtask[];
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
    if ((props.task as any).coverImage) {
      return (props.task as any).coverImage;
    }
    if (props.task.description) {
      const parsed = parseCommentContent(props.task.description);
      if (parsed.images.length > 0) {
        return parsed.images[0];
      }
    }
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

  return {
    authStore,
    isBlocked,
    timeEstimateHours,
    timeSpentHours,
    timePercent,
    parsedSubtasks,
    hasSubtasks,
    subtasksProgress,
    subtasksPercent,
    uncompletedSubtasks,
    updatePriority,
    updateDueDate,
    handleSubtaskStatusChange,
    handleReorderSubtasks,
    isSubtaskPanelOpen,
    isHoverCardOpen,
    toggleSubtaskPanelOpen,
    handlePillMouseEnter,
    handlePillMouseLeave,
    activeSubtaskPanelIndex,
    newCommentTexts,
    toggleSubtaskPanel,
    handleAddSubtaskComment,
    handleUploadSubtaskImage,
    activePreviewImage,
    cardCoverImage,
  };
};
