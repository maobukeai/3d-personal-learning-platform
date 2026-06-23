<script setup lang="ts">
import { ref } from 'vue';
import {
  Settings,
  Save,
  RefreshCw,
  Upload,
  Download,
  AlertTriangle,
  RotateCcw,
} from 'lucide-vue-next';

defineProps<{
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}>();

const emit = defineEmits<{
  (e: 'save'): void;
  (e: 'reset-to-defaults'): void;
  (e: 'export'): void;
  (e: 'import-file', event: Event): void;
}>();

const importFileInputRef = ref<HTMLInputElement | null>(null);

const triggerImport = () => {
  importFileInputRef.value?.click();
};
</script>

<template>
  <div
    class="border-b px-4 py-3 sm:px-6 shrink-0 transition-colors duration-300"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-accent bg-accent/10">
          <Settings class="w-5 h-5" />
        </div>
        <div>
          <h1 class="text-sm sm:text-base font-black" style="color: var(--text-primary)">
            {{ $t('admin.system_control_center') }}
          </h1>
          <p class="text-[10px] sm:text-xs mt-0.5" style="color: var(--text-muted)">
            {{ $t('admin.manage_global_variables_mail') }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 self-end sm:self-auto">
        <div
          v-if="hasUnsavedChanges"
          class="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-[10px] font-bold animate-pulse"
        >
          <AlertTriangle class="w-3.5 h-3.5" />
          <span>{{ $t('admin.there_are_unsaved_changes') }}</span>
        </div>
        <input
          ref="importFileInputRef"
          type="file"
          accept=".json"
          class="hidden"
          @change="emit('import-file', $event)"
        />
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
          style="border-color: var(--border-base); color: var(--text-secondary)"
          title="一键导出所有系统配置"
          @click="emit('export')"
        >
          <Download class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">导出配置</span>
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
          style="border-color: var(--border-base); color: var(--text-secondary)"
          title="一键从文件导入配置"
          @click="triggerImport"
        >
          <Upload class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">导入配置</span>
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
          style="border-color: var(--border-base); color: var(--text-secondary)"
          :title="$t('admin.restore_default')"
          @click="emit('reset-to-defaults')"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ $t('admin.restore_default') }}</span>
        </button>
        <button
          type="button"
          :disabled="isSaving"
          class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-indigo-600 text-white rounded-xl font-bold text-[11px] hover:bg-indigo-700 transition-all disabled:opacity-50 shrink-0 whitespace-nowrap shadow-sm cursor-pointer"
          :title="isSaving ? $t('admin.saving_1') : $t('admin.save_global_settings')"
          @click="emit('save')"
        >
          <Save v-if="!isSaving" class="w-3.5 h-3.5" />
          <RefreshCw v-else class="w-3.5 h-3.5 animate-spin" />
          <span class="hidden sm:inline">{{
            isSaving ? $t('admin.saving_1') : $t('admin.save_global_settings')
          }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
