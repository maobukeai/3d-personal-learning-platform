<script setup lang="ts">
import Input from '@/components/ui/Input.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import type { PublishFormData } from '@/composables/usePublishWork';

const props = defineProps<{
  formData: PublishFormData;
}>();

const emit = defineEmits<{
  (e: 'update:formData', value: PublishFormData): void;
}>();

const updateField = <K extends keyof PublishFormData>(key: K, value: PublishFormData[K]) => {
  emit('update:formData', { ...props.formData, [key]: value });
};

const onFileChange = (value: File | File[] | null) => {
  updateField('file', Array.isArray(value) ? (value[0] ?? null) : value);
};
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
        >插件安装包/脚本文件 (.zip, .py) *</label
      >
      <FileDropZone
        :model-value="formData.file"
        label="拖拽或点击上传插件/扩展包"
        accept=".zip,.py,.addon,.exe,.dmg"
        @update:model-value="onFileChange"
      />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
          >插件版本</label
        >
        <Input
          :model-value="formData.pluginVersion"
          placeholder="例: 1.2.0"
          @update:model-value="(v) => updateField('pluginVersion', v)"
        />
      </div>

      <div>
        <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
          >兼容环境</label
        >
        <Input
          :model-value="formData.pluginCompatibility"
          placeholder="例: Blender 4.x / 5.x"
          @update:model-value="(v) => updateField('pluginCompatibility', v)"
        />
      </div>
    </div>
  </div>
</template>
