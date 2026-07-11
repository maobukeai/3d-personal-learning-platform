<script setup lang="ts">
import { computed, inject } from 'vue';
import { radioGroupKey } from './radioContext';

interface Props {
  label?: string | number | boolean;
  value?: string | number | boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), { disabled: false });
const radio = inject(radioGroupKey, null);
const actualLabel = computed(() => props.label ?? props.value ?? '');
const selected = computed(() => radio?.modelValue.value === actualLabel.value);
const disabled = computed(() => props.disabled || radio?.disabled.value || false);

const select = () => {
  if (!disabled.value) radio?.changeValue(actualLabel.value);
};
</script>

<template>
  <button
    type="button"
    role="radio"
    :aria-checked="selected"
    :disabled="disabled"
    class="min-h-9 border-r border-[var(--border-base)] px-3 text-sm text-[var(--text-secondary)] transition-colors last:border-r-0 disabled:cursor-not-allowed disabled:opacity-50"
    :class="
      selected ? 'bg-[var(--accent-subtle)] text-[var(--accent)]' : 'hover:bg-[var(--bg-hover)]'
    "
    @click="select"
  >
    <slot>{{ actualLabel }}</slot>
  </button>
</template>
