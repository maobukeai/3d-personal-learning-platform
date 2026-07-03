<script setup lang="ts">
import { UploadCloud, Puzzle } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    modelValue: File | File[] | null;
    accept?: string;
    multiple?: boolean;
    label: string;
    sublabel?: string;
    heightClass?: string; // e.g. 'h-32'
    hoverClass?: string; // e.g. 'group-hover:border-indigo-500 group-hover:bg-indigo-500/5'
    iconType?: 'upload' | 'puzzle';
    progress?: number | null;
    previewUrl?: string;
  }>(),
  {
    accept: '*',
    multiple: false,
    sublabel: '',
    heightClass: 'h-32',
    hoverClass: 'group-hover:border-indigo-500 group-hover:bg-indigo-500/5',
    iconType: 'upload',
    progress: null,
    previewUrl: '',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: File | File[] | null): void;
  (e: 'change', event: Event): void;
}>();

import { ref, watch, onUnmounted, computed } from 'vue';
import { getAssetUrl } from '@/utils/api';

const objectUrl = ref('');

watch(() => props.modelValue, (newVal) => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = '';
  }
  const fileVal = Array.isArray(newVal) ? newVal[0] : newVal;
  if (fileVal instanceof File && fileVal.type.startsWith('image/')) {
    objectUrl.value = URL.createObjectURL(fileVal);
  }
}, { immediate: true });

onUnmounted(() => {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value);
  }
});

const displayPreviewUrl = computed(() => {
  if (objectUrl.value) return objectUrl.value;
  return props.previewUrl ? getAssetUrl(props.previewUrl) : '';
});

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (props.multiple) {
    const files = Array.from(target.files || []);
    emit('update:modelValue', files);
  } else {
    const file = target.files?.[0] || null;
    emit('update:modelValue', file);
  }
  emit('change', e);
};
</script>

<template>
  <div class="relative group w-full" :class="[heightClass, progress !== null && progress < 100 ? 'pointer-events-none' : '']">
    <input
      v-if="progress === null || progress >= 100"
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      @change="handleFileChange"
    />
    <div
      class="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 transition-all relative overflow-hidden"
      :class="hoverClass"
      style="border-color: var(--border-base)"
    >
      <!-- Progress Bar Background Overlay -->
      <div 
        v-if="progress !== null" 
        class="absolute left-0 bottom-0 top-0 bg-indigo-500/10 dark:bg-indigo-400/5 transition-all duration-300 ease-out z-10"
        :style="{ width: progress + '%' }"
      ></div>

      <!-- Image Preview Background -->
      <img
        v-if="displayPreviewUrl"
        :src="displayPreviewUrl"
        class="absolute inset-0 w-full h-full object-cover opacity-30 dark:opacity-40 pointer-events-none group-hover:scale-105 transition-transform duration-300"
      />

      <!-- Icon & Text -->
      <component
        :is="iconType === 'puzzle' ? Puzzle : UploadCloud"
        class="w-6 h-6 z-10"
        :class="iconType === 'puzzle' ? 'text-violet-400/60' : 'text-indigo-500/40'"
      />
      <p
        class="text-xs font-medium px-4 truncate max-w-full animate-fade z-10"
        style="color: var(--text-secondary)"
      >
        <slot name="label">
          {{ label }}
        </slot>
      </p>
      <p v-if="sublabel && progress === null" class="text-[10px] z-10" style="color: var(--text-muted)">
        {{ sublabel }}
      </p>

      <!-- Progress Text/Bar -->
      <div v-if="progress !== null" class="w-4/5 mt-1 bg-slate-200/50 dark:bg-slate-700/50 h-1.5 rounded-full overflow-hidden z-10">
        <div class="bg-indigo-500 h-full transition-all duration-300" :style="{ width: progress + '%' }"></div>
      </div>
      <p v-if="progress !== null" class="text-[10px] font-bold text-indigo-500 z-10 mt-0.5">
        {{ progress === 100 ? '已上传，正在解析...' : `正在上传 ${progress}%` }}
      </p>
    </div>
  </div>
</template>
