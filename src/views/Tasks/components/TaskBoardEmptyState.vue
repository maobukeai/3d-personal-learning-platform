<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { SlidersHorizontal, CheckCircle2 } from 'lucide-vue-next';
import EmptyState from '@/components/EmptyState.vue';

interface Props {
  type: 'no-tasks' | 'no-matching';
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'add-task'): void;
  (e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>

<template>
  <!-- Global Empty State -->
  <EmptyState
    v-if="props.type === 'no-tasks'"
    :icon="CheckCircle2"
    :title="t('tasks.noTasks')"
    :description="t('tasks.clickNewTaskTip')"
    :action-text="t('tasks.newTask')"
    @action="emit('add-task')"
  />

  <!-- Filtered Empty State -->
  <EmptyState
    v-else
    :icon="SlidersHorizontal"
    :title="t('tasks.noMatchingTasks')"
    :description="t('tasks.noMatchingTasksTip')"
    :action-text="t('tasks.resetAllFilters')"
    @action="emit('reset-filters')"
  />
</template>
