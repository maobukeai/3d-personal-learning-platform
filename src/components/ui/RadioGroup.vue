<script setup lang="ts">
import { computed, provide } from 'vue';
import { radioGroupKey } from './radioContext';

interface Props {
  modelValue: string | number | boolean;
  size?: 'large' | 'default' | 'small';
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default',
  disabled: false,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string | number | boolean): void;
  (event: 'change', value: string | number | boolean): void;
}>();

const modelValue = computed(() => props.modelValue);
const size = computed(() => props.size);
const disabled = computed(() => props.disabled);

provide(radioGroupKey, {
  modelValue,
  size,
  disabled,
  changeValue: (value) => {
    if (props.disabled) return;
    emit('update:modelValue', value);
    emit('change', value);
  },
});
</script>

<template>
  <div
    class="inline-flex overflow-hidden rounded-[var(--radius-field)] border border-[var(--border-base)]"
  >
    <slot />
  </div>
</template>
