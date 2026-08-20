<script setup lang="ts">
import FileDropZone from '@/components/FileDropZone.vue';
import type { PublishFormData } from '@/composables/usePublishWork';

const props = defineProps<{
  formData: PublishFormData;
  assetCategories: { id: string; name: string }[];
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

const onCategoryChange = (e: Event) => {
  updateField('assetCategory', (e.target as HTMLSelectElement).value);
};
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
        >3D 资产文件 (.glb, .gltf, .zip, .fbx) *</label
      >
      <FileDropZone
        :model-value="formData.file"
        label="拖拽或点击上传 3D 模型文件"
        accept=".glb,.gltf,.zip,.fbx,.obj"
        @update:model-value="onFileChange"
      />
    </div>

    <div>
      <label class="block text-xs font-semibold text-[var(--text-secondary)] mb-1"
        >所属资产分类</label
      >
      <select
        :value="formData.assetCategory"
        class="w-full h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-3 text-xs text-[var(--text-primary)] focus:outline-none focus:border-accent"
        @change="onCategoryChange"
      >
        <option v-for="cat in assetCategories" :key="cat.id" :value="cat.id">
          {{ cat.name }}
        </option>
      </select>
    </div>
  </div>
</template>
