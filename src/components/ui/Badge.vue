<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'blender';
  outline?: boolean;
  dot?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  outline: false,
  dot: false,
});

const variantClasses = computed(() => {
  if (props.outline) {
    switch (props.variant) {
      case 'success':
        return 'border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5';
      case 'warning':
        return 'border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/5';
      case 'danger':
        return 'border border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5';
      case 'info':
        return 'border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 bg-cyan-500/5';
      case 'blender':
        return 'border border-[var(--blender-orange)]/35 text-[var(--blender-orange)] bg-[var(--blender-orange)]/5';
      case 'primary':
      default:
        return 'border border-accent/30 text-accent bg-accent/5';
    }
  } else {
    switch (props.variant) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20';
      case 'danger':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 dark:bg-red-500/20';
      case 'info':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 dark:bg-cyan-500/20';
      case 'blender':
        return 'bg-[var(--blender-orange-subtle)] text-[var(--blender-orange)] border border-[var(--blender-orange)]/10';
      case 'primary':
      default:
        return 'bg-accent-subtle text-accent border border-accent/10';
    }
  }
});

const dotClasses = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
    case 'warning':
      return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
    case 'danger':
      return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
    case 'info':
      return 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]';
    case 'blender':
      return 'bg-[var(--blender-orange)] shadow-[0_0_8px_rgba(245,121,42,0.6)]';
    case 'primary':
    default:
      return 'bg-accent shadow-[0_0_8px_rgba(37,99,235,0.6)]';
  }
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase select-none transition-colors duration-200"
    :class="variantClasses"
  >
    <!-- Optional Pulsing Dot -->
    <span
      v-if="dot"
      class="h-1.5 w-1.5 rounded-full animate-pulse shrink-0"
      :class="dotClasses"
    ></span>

    <slot></slot>
  </span>
</template>
