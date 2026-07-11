<script setup lang="ts">
import { computed, inject } from 'vue';
import { checkboxGroupKey } from './checkboxContext';

interface Props {
  modelValue?: boolean;
  disabled?: boolean;
  label?: string | number | boolean;
  id?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false,
  label: undefined,
  id: () => `checkbox-${Math.random().toString(36).substring(2, 9)}`,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'change', value: boolean): void;
}>();

const checkboxGroup = inject(checkboxGroupKey, null);
const checked = computed(() =>
  checkboxGroup && props.label !== undefined
    ? checkboxGroup.isChecked(props.label)
    : props.modelValue,
);
const isDisabled = computed(() => props.disabled || checkboxGroup?.disabled.value || false);

const toggleCheck = () => {
  if (isDisabled.value) return;
  if (checkboxGroup && props.label !== undefined) {
    checkboxGroup.toggleValue(props.label);
    return;
  }
  const newValue = !props.modelValue;
  emit('update:modelValue', newValue);
  emit('change', newValue);
};

const classes = computed(() => {
  return [
    'w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-300 select-none cursor-pointer',
    isDisabled.value ? 'opacity-50 cursor-not-allowed' : '',
    checked.value
      ? 'bg-accent border-accent shadow-[0_0_12px_rgba(var(--accent-rgb),0.25)]'
      : 'glass-input border-white/20 dark:border-white/10 hover:border-accent/40',
  ];
});
</script>

<template>
  <div class="inline-flex items-center gap-2.5 select-none font-sans text-sm">
    <div
      :id="id"
      role="checkbox"
      :aria-checked="checked"
      :aria-disabled="isDisabled"
      tabindex="0"
      :class="classes"
      @click="toggleCheck"
      @keydown.space.prevent="toggleCheck"
      @keydown.enter.prevent="toggleCheck"
    >
      <svg
        class="w-3.5 h-3.5 text-white transition-transform duration-300"
        :class="checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="3.5"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>

    <!-- Label Slot -->
    <label
      v-if="$slots.default"
      :for="id"
      class="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
      :class="{ 'opacity-50 pointer-events-none': isDisabled }"
      @click="toggleCheck"
    >
      <slot></slot>
    </label>
  </div>
</template>
