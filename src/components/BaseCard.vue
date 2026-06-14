<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    hoverable?: boolean;
    clickable?: boolean;
    glass?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
  }>(),
  {
    hoverable: true,
    clickable: false,
    glass: false,
    padding: 'none', // Default to none since most card components handle their own padding
  }
);

const paddingClass = computed(() => {
  if (props.padding === 'none') return 'p-0';
  if (props.padding === 'sm') return 'p-3';
  if (props.padding === 'lg') return 'p-6';
  return 'p-4.5';
});
</script>

<template>
  <div
    class="base-card transition-all duration-300"
    :class="[
      paddingClass,
      glass
        ? 'bg-white/5 dark:bg-slate-950/20 backdrop-blur-md border border-white/10'
        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80',
      hoverable ? 'hover:shadow-md hover:border-slate-350 dark:hover:border-slate-700 hover:-translate-y-0.5' : '',
      clickable ? 'cursor-pointer' : '',
    ]"
    style="border-color: var(--border-base)"
  >
    <div v-if="$slots.header" class="base-card__header mb-2.5">
      <slot name="header"></slot>
    </div>
    <div class="base-card__body flex-1 flex flex-col">
      <slot></slot>
    </div>
    <div v-if="$slots.footer" class="base-card__footer mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-800/80">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<style scoped>
.base-card {
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}
</style>
