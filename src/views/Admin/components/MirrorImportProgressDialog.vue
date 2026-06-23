<script setup lang="ts">
import { Upload, RefreshCw, Check, X } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps<{
  importProgress: number;
  importStatusText: string;
  importError: string | null;
  importTaskStatus: string;
}>();

const show = defineModel<boolean>('show', { required: true });

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Modal :show="show" size="sm" glass-card padding="md" @close="emit('close')">
    <template #header>
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <Upload class="w-5 h-5 text-cyan-500" />
        导入镜像源
      </h2>
    </template>

    <div class="text-center">
      <!-- Status Icons -->
      <div class="flex justify-center mb-4">
        <div
          v-if="
            importTaskStatus === 'uploading' ||
            importTaskStatus === 'processing' ||
            importTaskStatus === 'extracting' ||
            importTaskStatus === 'importing_metadata' ||
            importTaskStatus === 'copying_files'
          "
          class="p-3 bg-cyan-50 dark:bg-cyan-500/15 rounded-full text-cyan-500"
        >
          <RefreshCw class="w-8 h-8 animate-spin" />
        </div>
        <div
          v-else-if="importTaskStatus === 'completed'"
          class="p-3 bg-emerald-50 dark:bg-emerald-500/15 rounded-full text-emerald-500"
        >
          <Check class="w-8 h-8" />
        </div>
        <div
          v-else-if="importTaskStatus === 'failed'"
          class="p-3 bg-rose-50 dark:bg-rose-500/15 rounded-full text-rose-500"
        >
          <X class="w-8 h-8" />
        </div>
      </div>

      <!-- Status Title -->
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">
        <span v-if="importTaskStatus === 'uploading'">正在上传镜像包...</span>
        <span v-else-if="importTaskStatus === 'completed'">导入成功</span>
        <span v-else-if="importTaskStatus === 'failed'">导入失败</span>
        <span v-else>正在同步数据中...</span>
      </h3>

      <!-- Status Text & Details -->
      <p
        class="text-sm text-slate-500 dark:text-slate-400 mb-4 min-h-[40px] flex items-center justify-center text-center break-words"
      >
        {{ importStatusText }}
      </p>

      <!-- Progress Bar -->
      <div
        v-if="importTaskStatus !== 'failed'"
        class="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden mb-2"
      >
        <div
          class="bg-cyan-500 h-2.5 rounded-full transition-all duration-300"
          :style="{ width: importProgress + '%' }"
        ></div>
      </div>
      <div
        v-if="importTaskStatus !== 'failed'"
        class="text-xs text-slate-400 dark:text-slate-500 text-right mb-6"
      >
        {{ importProgress }}%
      </div>

      <!-- Error Message Alert -->
      <div
        v-if="importTaskStatus === 'failed' && importError"
        class="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-400 text-sm text-left mb-6 break-all"
      >
        {{ importError }}
      </div>
    </div>

    <template #footer>
      <button
        v-if="importTaskStatus === 'completed' || importTaskStatus === 'failed'"
        type="button"
        class="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
        @click="emit('close')"
      >
        确定
      </button>
    </template>
  </Modal>
</template>
