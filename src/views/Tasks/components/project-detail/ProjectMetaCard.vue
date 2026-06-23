<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface Props {
  dueDate?: string | null;
  progress: number;
}

defineProps<Props>();
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <div
      class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border text-left"
      style="border-color: var(--border-base)"
    >
      <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
        {{ t('tasks.dueDate') }}
      </div>
      <span class="text-xs font-bold" style="color: var(--text-primary)">
        {{ dueDate ? new Date(dueDate).toLocaleDateString() : t('common.notSet') }}
      </span>
    </div>
    <div
      class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border text-left"
      style="border-color: var(--border-base)"
    >
      <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
        {{ t('projects.projectProgress') }}
      </div>
      <div class="flex items-center gap-2">
        <div class="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
          <div
            class="h-full rounded-full bg-accent transition-all duration-500"
            :style="{ width: progress + '%' }"
          ></div>
        </div>
        <span class="text-[10px] font-black text-accent">{{ progress }}%</span>
      </div>
    </div>
  </div>
</template>
