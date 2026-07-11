<script setup lang="ts">
interface Props {
  modelValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showInput?: boolean;
}

withDefaults(defineProps<Props>(), {
  modelValue: 0,
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  showInput: false,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: number): void;
  (event: 'change', value: number): void;
}>();

const update = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value);
  emit('update:modelValue', value);
  emit('change', value);
};
</script>

<template>
  <div class="flex items-center gap-3">
    <input
      type="range"
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      class="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--border-strong)] accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      @input="update"
    />
    <output v-if="showInput" class="min-w-10 text-right text-sm text-[var(--text-secondary)]">
      {{ modelValue }}
    </output>
  </div>
</template>
