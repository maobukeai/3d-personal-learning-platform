<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { PRIORITY_OPTIONS, getPriorityColorClass } from '@/utils/taskDisplay';
import type { ProjectUser, BatchTaskPayload } from './types';

const { t } = useI18n();

interface Props {
  show: boolean;
  teamMembers: ProjectUser[];
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'submit', payload: { tasks: BatchTaskPayload[] }): void;
}>();

const batchTaskText = ref('');
const batchAssigneeId = ref('');
const batchPriority = ref('MEDIUM');
const batchDueDate = ref<string | Date | null>('');

const priorityOptions = PRIORITY_OPTIONS;

const parsedBatchTasks = computed(() => {
  if (!batchTaskText.value.trim()) return [];
  return batchTaskText.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
});

const handleSubmit = () => {
  const lines = parsedBatchTasks.value;
  if (lines.length === 0) return;

  const payloadTasks: BatchTaskPayload[] = lines.map((title) => ({
    title,
    priority: batchPriority.value,
    dueDate: batchDueDate.value || null,
    assigneeId: batchAssigneeId.value || null,
  }));

  emit('submit', { tasks: payloadTasks });
  resetForm();
};

const handleClose = () => {
  emit('update:show', false);
};

const resetForm = () => {
  batchTaskText.value = '';
  batchAssigneeId.value = '';
  batchDueDate.value = '';
  batchPriority.value = 'MEDIUM';
};
</script>

<template>
  <Modal :show="show" size="md" @close="handleClose">
    <template #header>
      <h3 class="text-lg sm:text-xl font-bold" style="color: var(--text-primary)">
        {{ t('projects.batchAddTask') }}
      </h3>
    </template>

    <div class="space-y-4 text-left">
      <div>
        <label
          class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
          >{{ t('projects.batchTaskTitleList') }}</label
        >
        <textarea
          v-model="batchTaskText"
          rows="6"
          class="w-full px-4 py-2.5 sm:py-3 bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none leading-relaxed"
          style="color: var(--text-primary)"
          :placeholder="t('projects.batchTaskPlaceholder')"
        ></textarea>
      </div>

      <div v-if="parsedBatchTasks.length > 0" class="space-y-1.5 sm:space-y-2">
        <label class="block text-[10px] sm:text-xs font-bold uppercase text-slate-400 ml-1">{{
          t('projects.batchTaskPreview', { count: parsedBatchTasks.length })
        }}</label>
        <div
          class="max-h-24 overflow-y-auto border rounded-xl p-2.5 space-y-1 bg-slate-50 dark:bg-slate-800/10 scrollbar-hide"
          style="border-color: var(--border-base)"
        >
          <div
            v-for="(tTask, index) in parsedBatchTasks"
            :key="index"
            class="flex items-center justify-between text-[11px] font-bold py-0.5 border-b last:border-0"
            style="border-color: var(--border-base)"
          >
            <span class="truncate flex-1 pr-4" style="color: var(--text-primary)">
              {{ index + 1 }}. {{ tTask }}
            </span>
            <span
              class="px-1 py-0.2 bg-accent/10 text-accent rounded text-[7px] uppercase font-black tracking-wider shrink-0"
              >{{ t('projects.toBeCreated') }}</span
            >
          </div>
        </div>
      </div>

      <div class="batch-form-grid grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label
            class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
            >{{ t('projects.batchAssignee') }}</label
          >
          <Select
            v-model="batchAssigneeId"
            clearable
            :placeholder="t('projects.selectAssignee')"
            class="!w-full custom-select"
          >
            <SelectOption
              v-for="m in teamMembers"
              :key="m.id"
              :label="m.name || m.email"
              :value="m.id"
            >
              <div class="flex items-center gap-2">
                <UserAvatar :user="m" size="sm" />
                <span class="text-xs sm:text-sm">{{ m.name || m.email }}</span>
              </div>
            </SelectOption>
          </Select>
        </div>
        <div>
          <label
            class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
            >{{ t('projects.batchPriority') }}</label
          >
          <Select v-model="batchPriority" class="!w-full custom-select">
            <SelectOption
              v-for="p in priorityOptions"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            >
              <div class="flex items-center gap-2">
                <div
                  class="w-2 h-2 rounded-full"
                  :class="getPriorityColorClass(p.value, 'bg')"
                ></div>
                <span class="text-xs sm:text-sm font-bold">{{ p.label }}</span>
              </div>
            </SelectOption>
          </Select>
        </div>
      </div>

      <div>
        <label
          class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
          >{{ t('projects.batchDueDate') }}</label
        >
        <DatePicker
          v-model="batchDueDate"
          type="date"
          :placeholder="t('tasks.dueDate')"
          class="!w-full !rounded-2xl custom-date-picker"
          popper-class="custom-date-popper"
        />
      </div>
    </div>

    <template #footer>
      <Button type="button" variant="primary" size="lg" full-width @click="handleSubmit">
        {{ t('projects.batchCreateButton') }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
@media (max-width: 767px) {
  .batch-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
