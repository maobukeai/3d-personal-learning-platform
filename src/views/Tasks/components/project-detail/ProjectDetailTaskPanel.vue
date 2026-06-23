<script setup lang="ts">
import { ref } from 'vue';
import { Layers, Plus } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import Button from '@/components/ui/Button.vue';
import ProjectDetailTaskTable from '../ProjectDetailTaskTable.vue';
import type { ProjectTask, ProjectUser } from './types';

const { t } = useI18n();

interface Props {
  tasks: ProjectTask[];
  teamMembers: ProjectUser[];
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'quick-add', title: string): void;
  (e: 'batch-open'): void;
  (e: 'update-status', task: ProjectTask, newStatus: string): void;
  (e: 'change-assignee', task: ProjectTask, assigneeId: string | null): void;
  (e: 'delete-task', taskId: string): void;
}>();

const quickTaskTitle = ref('');

const handleQuickAdd = () => {
  const title = quickTaskTitle.value.trim();
  if (!title) return;
  emit('quick-add', title);
  quickTaskTitle.value = '';
};
</script>

<template>
  <div class="space-y-4">
    <div class="mobile-row flex items-center justify-between">
      <h4
        class="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"
      >
        <Layers class="w-4 h-4" /> {{ t('projects.projectTasks') }} ({{ tasks.length }})
      </h4>
      <div class="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          :icon="Plus"
          class="!h-7 !text-[10px] !px-2"
          @click="emit('batch-open')"
        >
          {{ t('projects.batchAdd') }}
        </Button>
      </div>
    </div>

    <div class="relative flex items-center">
      <input
        v-model="quickTaskTitle"
        type="text"
        :placeholder="t('projects.quickTaskPlaceholder')"
        class="w-full pl-4 pr-12 py-2 bg-slate-50 dark:bg-slate-800/30 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
        style="border-color: var(--border-base); color: var(--text-primary)"
        @keydown.enter="handleQuickAdd"
      />
      <button
        type="button"
        class="absolute right-1.5 p-1.5 bg-accent text-white rounded-lg hover:scale-105 transition-all border-none cursor-pointer"
        @click="handleQuickAdd"
      >
        <Plus class="w-3 h-3 text-white" />
      </button>
    </div>

    <ProjectDetailTaskTable
      :tasks="tasks"
      :team-members="teamMembers"
      @update-status="(task, status) => emit('update-status', task, status)"
      @change-assignee="(task, assigneeId) => emit('change-assignee', task, assigneeId)"
      @delete-task="(taskId) => emit('delete-task', taskId)"
    />
  </div>
</template>
