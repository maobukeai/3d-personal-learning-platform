<script setup lang="ts">
import Input from '@/components/ui/Input.vue';
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
        >插件安装包/脚本文件 (.zip, .py) *</label
      >
      <FileDropZone
        v-model="formData.file"
        label="拖拽或点击上传插件/扩展包"
        accept=".zip,.py,.addon,.exe,.dmg"
      />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
          >插件版本</label
        >
        <Input v-model="formData.pluginVersion" placeholder="例: 1.2.0" />
      </div>

      <div>
        <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
          >兼容环境</label
        >
        <Input v-model="formData.pluginCompatibility" placeholder="例: Blender 4.x / 5.x" />
      </div>
    </div>
  </div>
</template>
