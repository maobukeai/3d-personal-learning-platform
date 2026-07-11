<script setup lang="ts">
interface Props {
  modelValue?: string | number | Date | null;
  type?: 'date' | 'datetime' | 'month' | 'year';
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
}

withDefaults(defineProps<Props>(), {
  modelValue: null,
  type: 'date',
  placeholder: '',
  disabled: false,
  clearable: true,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string | undefined): void;
  (event: 'change', value: string | undefined): void;
}>();

const inputType = (type: Props['type']) => {
  if (type === 'datetime') return 'datetime-local';
  if (type === 'month') return 'month';
  return type === 'year' ? 'number' : 'date';
};

const update = (event: Event) => {
  const value = (event.target as HTMLInputElement).value || undefined;
  emit('update:modelValue', value);
  emit('change', value);
};
</script>

<template>
  <input
    :type="inputType(type)"
    :value="modelValue instanceof Date ? modelValue.toISOString().slice(0, 10) : (modelValue ?? '')"
    :placeholder="placeholder"
    :disabled="disabled"
    class="h-10 w-full rounded-[var(--radius-field)] border border-[var(--border-base)] bg-[var(--surface-solid)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
    @input="update"
  />
</template>
