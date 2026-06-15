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
  }>(),
  {
    accept: '*',
    multiple: false,
    sublabel: '',
    heightClass: 'h-32',
    hoverClass: 'group-hover:border-indigo-500 group-hover:bg-indigo-500/5',
    iconType: 'upload',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: File | File[] | null): void;
  (e: 'change', event: Event): void;
}>();

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
  <div class="relative group w-full" :class="heightClass">
    <input
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      @change="handleFileChange"
    />
    <div
      class="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-1 transition-all"
      :class="hoverClass"
      style="border-color: var(--border-base)"
    >
      <component
        :is="iconType === 'puzzle' ? Puzzle : UploadCloud"
        class="w-6 h-6"
        :class="iconType === 'puzzle' ? 'text-violet-400/60' : 'text-indigo-500/40'"
      />
      <p
        class="text-xs font-medium px-4 truncate max-w-full animate-fade"
        style="color: var(--text-secondary)"
      >
        <slot name="label">
          {{ label }}
        </slot>
      </p>
      <p v-if="sublabel" class="text-[10px]" style="color: var(--text-muted)">
        {{ sublabel }}
      </p>
    </div>
  </div>
</template>
