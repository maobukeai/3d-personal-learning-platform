<script setup lang="ts">
import FileDropZone from '@/components/FileDropZone.vue';
import type { PublishFormData } from '@/composables/usePublishWork';

const props = defineProps<{
  formData: PublishFormData;
}>();
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
        >材质包/贴图压缩包 (.zip, .sbsar) *</label
      >
      <FileDropZone
        v-model="formData.file"
        label="拖拽或点击上传材质包/贴图压缩包"
        accept=".zip,.sbsar,.rar,.7z"
      />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
          >贴图分辨率</label
        >
        <select
          v-model="formData.resolution"
          class="w-full h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-accent"
        >
          <option value="1K">1K 分辨率</option>
          <option value="2K">2K 分辨率</option>
          <option value="4K">4K 高清</option>
          <option value="8K">8K 超清</option>
        </select>
      </div>

      <div class="flex items-center gap-2 pt-5">
        <input type="checkbox" id="procedural" v-model="formData.isProcedural" />
        <label for="procedural" class="text-xs text-[var(--text-secondary)] cursor-pointer"
          >程序化材质 (Procedural)</label
        >
      </div>
    </div>
  </div>
</template>
