<script setup lang="ts">
import { computed, ref } from 'vue';

interface Props {
  modelValue?: number;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  disabled?: boolean;
  placeholder?: string;
  controls?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  min: undefined,
  max: undefined,
  step: 1,
  precision: undefined,
  disabled: false,
  placeholder: '',
  controls: true,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: number | undefined): void;
  (event: 'change', value: number | undefined): void;
}>();

const input = ref<HTMLInputElement | null>(null);
const value = computed(() => (props.modelValue == null ? '' : String(props.modelValue)));

const update = (event: Event) => {
  const raw = (event.target as HTMLInputElement).value;
  const next = raw === '' ? undefined : Number(raw);
  const valid = next == null || Number.isFinite(next) ? next : props.modelValue;
  emit('update:modelValue', valid);
  emit('change', valid);
};

defineExpose({
  focus: () => input.value?.focus(),
  blur: () => input.value?.blur(),
});
</script>

<template>
  <input
    ref="input"
    type="number"
    :value="value"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :placeholder="placeholder"
    class="h-10 w-full rounded-[var(--radius-field)] border border-[var(--border-base)] bg-[var(--surface-solid)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
    @input="update"
  />
</template>
