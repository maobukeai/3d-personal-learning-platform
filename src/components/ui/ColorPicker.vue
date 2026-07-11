<script setup lang="ts">
interface Props {
  modelValue?: string;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), { modelValue: '#000000', disabled: false });
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'change', value: string): void;
}>();
const update = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  emit('update:modelValue', value);
  emit('change', value);
};
</script>

<template>
  <input
    type="color"
    :value="modelValue"
    :disabled="disabled"
    class="h-9 w-12 cursor-pointer rounded-[var(--radius-control)] border border-[var(--border-base)] bg-transparent p-1 disabled:cursor-not-allowed"
    @input="update"
  />
</template>
