<script setup lang="ts">
import { computed, provide } from 'vue';
import { checkboxGroupKey } from './checkboxContext';

interface Props {
  modelValue: (string | number | boolean)[];
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), { disabled: false });
const emit = defineEmits<{
  (event: 'update:modelValue', value: (string | number | boolean)[]): void;
  (event: 'change', value: (string | number | boolean)[]): void;
}>();

const modelValue = computed(() => props.modelValue);
const disabled = computed(() => props.disabled);
const toggleValue = (value: string | number | boolean) => {
  if (props.disabled) return;
  const next = props.modelValue.includes(value)
    ? props.modelValue.filter((item) => item !== value)
    : [...props.modelValue, value];
  emit('update:modelValue', next);
  emit('change', next);
};

provide(checkboxGroupKey, {
  modelValue,
  disabled,
  toggleValue,
  isChecked: (value) => props.modelValue.includes(value),
});
</script>

<template>
  <div class="flex flex-wrap gap-3"><slot /></div>
</template>
