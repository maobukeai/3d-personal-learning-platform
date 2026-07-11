<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import type { TaskActivity } from '@/types/task';
import { formatActivityTime, parseCommentContent } from './helpers';

const props = defineProps<{
  taskId: string | undefined;
}>();

const activities = ref<TaskActivity[]>([]);
const isActivitiesLoading = ref(false);

const fetchActivities = async () => {
  if (!props.taskId) {
    activities.value = [];
    return;
  }
  isActivitiesLoading.value = true;
  try {
    const response = await api.get(`/api/tasks/${props.taskId}/activities`);
    activities.value = response.data;
  } catch {
    ElMessage.error('获取任务动态失败');
  } finally {
    isActivitiesLoading.value = false;
  }
};

watch(
  () => props.taskId,
  (newId) => {
    if (newId) {
      fetchActivities();
    } else {
      activities.value = [];
    }
  },
  { immediate: true },
);

const emit = defineEmits<{
  (e: 'image-click', url: string): void;
}>();

defineExpose({
  refresh: fetchActivities,
});
</script>

<template>
  <div class="pt-4 border-t space-y-3" style="border-color: var(--border-base)">
    <h3
      class="text-xs font-black uppercase tracking-widest text-slate-400 pb-1 border-b"
      style="border-color: var(--border-base)"
    >
      任务动态
    </h3>

    <div v-if="isActivitiesLoading" class="flex justify-center py-4">
      <span class="text-xs text-slate-400 animate-pulse">加载动态中...</span>
    </div>
    <div
      v-else-if="activities.length === 0"
      class="text-center py-4 text-xs text-slate-400/70 border border-dashed border-slate-200/50 dark:border-slate-800 rounded-xl"
    >
      暂无动态
    </div>
    <div v-else class="max-h-[300px] overflow-y-auto pr-1 space-y-3 scrollbar-hide text-xs">
      <div v-for="act in activities" :key="act.id" class="flex gap-2.5 items-start">
        <img
          v-if="act.user?.avatarUrl"
          :src="act.user.avatarUrl"
          alt=""
          class="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5 border"
          style="border-color: var(--border-base)"
        />
        <div
          v-else
          class="w-5 h-5 rounded-full bg-gradient-to-br from-accent/20 to-indigo-600/20 text-accent dark:text-indigo-400 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5 border"
          style="border-color: var(--border-base)"
        >
          {{ act.user?.name?.substring(0, 1) || '系' }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex justify-between items-baseline gap-2">
            <span class="font-bold shrink-0" style="color: var(--text-primary)">
              {{ act.user?.name || '系统' }}
            </span>
            <span class="text-[9px] text-slate-400 tracking-tight whitespace-nowrap">
              {{ formatActivityTime(act.createdAt) }}
            </span>
          </div>
          <p class="text-slate-500 dark:text-slate-400 leading-normal mt-0.5 break-all">
            {{ parseCommentContent(act.description).text }}
          </p>
          <div
            v-if="parseCommentContent(act.description).images.length > 0"
            class="flex flex-wrap gap-1 mt-1.5"
          >
            <img
              v-for="img in parseCommentContent(act.description).images"
              :key="img"
              :src="img"
              class="w-12 h-12 rounded-lg border object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
              style="border-color: var(--border-base)"
              @click.stop="emit('image-click', img)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
