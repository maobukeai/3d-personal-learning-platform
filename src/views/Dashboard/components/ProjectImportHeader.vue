<script setup lang="ts">
import { computed } from 'vue';
import { Sparkles, X } from 'lucide-vue-next';
import type { ImportMode } from './importDialogTypes';

const props = defineProps<{
  importMode: ImportMode;
  importStep: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:importMode', mode: ImportMode): void;
}>();

const title = computed(() => {
  if (props.importMode === 'traditional') return '传统文本解析导入';
  if (props.importMode === 'ai_assistant') return 'AI 智能规划助手';
  return '百度网盘智能解析';
});
</script>

<template>
  <div
    class="mobile-row flex items-center justify-between shrink-0 pb-4 border-b"
    style="border-color: var(--border-base)"
  >
    <div class="flex items-center gap-2">
      <div class="p-1.5 bg-gradient-to-br from-accent to-indigo-600 rounded-lg text-white">
        <Sparkles class="w-4 h-4" />
      </div>
      <h3 class="text-md sm:text-lg font-black tracking-tight" style="color: var(--text-primary)">
        {{ title }}
      </h3>
    </div>

    <!-- Segmented Switch: only visible in step 1 and when not in traditional import mode -->
    <div
      v-if="importStep === 1 && importMode !== 'traditional'"
      class="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl"
    >
      <button
        type="button"
        class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
        :class="
          importMode === 'ai_assistant'
            ? 'bg-white dark:bg-slate-800 text-accent shadow-sm'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        "
        @click="emit('update:importMode', 'ai_assistant')"
      >
        智能规划助手
      </button>
      <button
        type="button"
        class="px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
        :class="
          importMode === 'netdisk'
            ? 'bg-white dark:bg-slate-800 text-accent shadow-sm'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        "
        @click="emit('update:importMode', 'netdisk')"
      >
        网盘智能解析
      </button>
    </div>

    <button
      type="button"
      class="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
      style="color: var(--text-secondary)"
      @click="emit('close')"
    >
      <X class="w-5 h-5" />
    </button>
  </div>
</template>
