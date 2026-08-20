<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Zap, X, Loader2 } from 'lucide-vue-next';
import api from '@/utils/api';
import { ElMessage } from '@/utils/feedbackBridge';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * 移动端全局快速捕获：任何页面 3 秒记一条学习任务。
 * 仅在移动端（<md）且展开时可见；回车提交，可连续添加。
 */

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();

const isOpen = ref(false);
const title = ref('');
const priority = ref('MEDIUM');
const isSubmitting = ref(false);

const priorityChoices = [
  {
    value: 'LOW',
    label: t('tasks.quickCapture.priorityLow'),
    cls: 'bg-slate-500/15 text-slate-500',
  },
  {
    value: 'MEDIUM',
    label: t('tasks.quickCapture.priorityMedium'),
    cls: 'bg-amber-500/15 text-amber-500',
  },
  {
    value: 'HIGH',
    label: t('tasks.quickCapture.priorityHigh'),
    cls: 'bg-rose-500/15 text-rose-500',
  },
] as const;

const open = () => {
  isOpen.value = true;
  title.value = '';
};

const close = () => {
  isOpen.value = false;
  title.value = '';
};

const submit = async () => {
  const trimmed = title.value.trim();
  if (!trimmed || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    await api.post('/api/tasks', {
      title: trimmed,
      description: '',
      status: 'TODO',
      priority: priority.value,
      tags: null,
      subtasks: '[]',
      dueDate: null,
      assigneeId: null,
      projectId: null,
      teamId: workspaceStore.activeTeamId || null,
      participantIds: [],
    });
    ElMessage.success(t('tasks.quickCapture.saved'));
    title.value = ''; // keep the panel open for consecutive captures
  } catch {
    ElMessage.error(t('tasks.quickCapture.failed'));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <!-- Mobile-only floating quick capture button -->
  <button
    v-if="!isOpen"
    type="button"
    class="md:hidden fixed right-4 flex items-center justify-center w-12 h-12 rounded-full bg-accent text-white shadow-lg shadow-accent/30 active:scale-95 transition-transform cursor-pointer"
    :style="{
      bottom: 'calc(4.75rem + env(safe-area-inset-bottom))',
      zIndex: 'var(--z-index-sticky)',
    }"
    :title="t('tasks.quickCapture.button')"
    @click="open"
  >
    <Zap class="w-5 h-5" />
  </button>

  <!-- Expanded capture card -->
  <div
    v-else
    class="md:hidden fixed left-3 right-3 rounded-xl border p-3 shadow-2xl glass-real-physical"
    style="border-color: var(--border-base); z-index: var(--z-index-sticky)"
    :style="{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }"
  >
    <div class="flex items-center gap-2 mb-2">
      <Zap class="w-3.5 h-3.5 text-accent shrink-0" />
      <span
        class="text-[10px] font-black uppercase tracking-widest"
        style="color: var(--text-primary)"
      >
        {{ t('tasks.quickCapture.title') }}
      </span>
      <button
        type="button"
        class="ml-auto p-1 rounded-lg text-slate-400 hover:text-accent transition-colors cursor-pointer"
        @click="close"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <div class="flex items-center gap-2">
      <input
        v-model="title"
        type="text"
        :placeholder="t('tasks.quickCapture.placeholder')"
        class="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 focus:border-accent/50 focus:outline-none transition-colors"
        style="color: var(--text-primary)"
        autofocus
        @keyup.enter="submit"
        @keyup.esc="close"
      />
      <button
        type="button"
        class="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-accent text-white disabled:opacity-50 transition-all cursor-pointer"
        :disabled="!title.trim() || isSubmitting"
        @click="submit"
      >
        <Loader2 v-if="isSubmitting" class="w-4 h-4 animate-spin" />
        <Zap v-else class="w-4 h-4" />
      </button>
    </div>

    <div class="flex items-center gap-1.5 mt-2">
      <button
        v-for="choice in priorityChoices"
        :key="choice.value"
        type="button"
        class="px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border"
        :class="
          priority === choice.value
            ? choice.cls + ' border-current'
            : 'border-transparent text-slate-400 bg-slate-100/60 dark:bg-white/5'
        "
        @click="priority = choice.value"
      >
        {{ choice.label }}
      </button>
      <span class="ml-auto text-[10px] text-slate-400">{{ t('tasks.quickCapture.hint') }}</span>
    </div>
  </div>
</template>
