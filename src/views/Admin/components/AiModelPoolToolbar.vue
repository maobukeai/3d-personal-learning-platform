<script setup lang="ts">
import { ref } from 'vue';
import { Plus, Download, Upload } from 'lucide-vue-next';

const props = defineProps<{
  total: number;
  enabled: number;
}>();

const emit = defineEmits<{
  'add-model': [];
  'add-category': [];
  'export-config': [];
  'import-file': [Event];
}>();

const importAiFileInputRef = ref<HTMLInputElement | null>(null);

const triggerImport = () => {
  importAiFileInputRef.value?.click();
};
</script>

<template>
  <div class="flex items-center justify-between mb-2">
    <div>
      <h3 class="text-sm font-black" style="color: var(--text-primary)">
        {{ $t('admin.model_pool_configuration') }}
      </h3>
      <p class="text-[11px] mt-0.5" style="color: var(--text-muted)">
        {{
          $t('admin.ai_models_status_count', {
            total: props.total,
            enabled: props.enabled,
          })
        }}
      </p>
    </div>
    <div class="flex items-center gap-2">
      <input
        ref="importAiFileInputRef"
        type="file"
        accept=".json"
        class="hidden"
        @change="(e: Event) => emit('import-file', e)"
      />
      <button
        type="button"
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer shrink-0"
        style="border-color: var(--border-base); color: var(--text-secondary)"
        title="一键导出所有 AI 相关配置"
        @click="emit('export-config')"
      >
        <Download class="w-3.5 h-3.5" />
        <span>导出AI配置</span>
      </button>
      <button
        type="button"
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer shrink-0"
        style="border-color: var(--border-base); color: var(--text-secondary)"
        title="一键从文件导入 AI 配置"
        @click="triggerImport"
      >
        <Upload class="w-3.5 h-3.5" />
        <span>导入AI配置</span>
      </button>
      <button
        type="button"
        class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer shrink-0"
        style="border-color: var(--border-base); color: var(--text-secondary)"
        @click="emit('add-category')"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>新建自定义分类</span>
      </button>
      <button
        type="button"
        class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shrink-0"
        style="
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
          box-shadow: 0 2px 12px rgba(99, 102, 241, 0.35);
        "
        @click="emit('add-model')"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>{{ $t('admin.add_model') }}</span>
      </button>
    </div>
  </div>
</template>
