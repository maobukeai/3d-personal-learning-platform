<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue?: boolean;
  disabled?: boolean;
  id?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  disabled: false,
  id: () => `switch-${Math.random().toString(36).substring(2, 9)}`,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'change', value: boolean): void;
}>();

const toggle = () => {
  if (props.disabled) return;
  const newValue = !props.modelValue;
  emit('update:modelValue', newValue);
  emit('change', newValue);
};

const trackClasses = computed(() => {
  return [
    'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out outline-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:ring-offset-2',
    props.disabled ? 'opacity-50 cursor-not-allowed' : '',
    props.modelValue ? 'bg-accent' : 'bg-slate-200 dark:bg-slate-800 border-white/10',
  ];
});

const thumbClasses = computed(() => {
  return [
    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out',
    props.modelValue ? 'translate-x-5' : 'translate-x-0',
  ];
});
</script>

<template>
  <div class="inline-flex items-center gap-3 font-sans text-sm select-none">
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="modelValue"
      :aria-disabled="disabled"
      :class="trackClasses"
      @click="toggle"
    >
      <span :class="thumbClasses" />
    </button>

    <!-- Label Slot -->
    <label
      v-if="$slots.default"
      :for="id"
      class="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
      :class="{ 'opacity-50 pointer-events-none': disabled }"
      @click="toggle"
    >
      <slot></slot>
    </label>
  </div>
</template>
