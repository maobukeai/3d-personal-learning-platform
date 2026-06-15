<script setup lang="ts">
/**
 * MasonryGrid Component
 * Uses CSS columns for a lightweight, responsive masonry layout.
 */
interface Props {
  gap?: string;
  columns?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
}

const props = withDefaults(defineProps<Props>(), {
  gap: '1.25rem',
  columns: () => ({
    default: 2,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
    '2xl': 6,
  }),
});
</script>

<template>
  <div
    class="masonry-grid-container"
    :style="{
      '--grid-gap': props.gap,
    }"
  >
    <slot></slot>
  </div>
</template>

<style scoped>
.masonry-grid-container {
  column-gap: var(--grid-gap);
  width: 100%;

  /* Responsive columns */
  column-count: v-bind('props.columns.default');
}

@media (min-width: 640px) {
  .masonry-grid-container {
    column-count: v-bind('props.columns.sm');
  }
}

@media (min-width: 768px) {
  .masonry-grid-container {
    column-count: v-bind('props.columns.md');
  }
}

@media (min-width: 1024px) {
  .masonry-grid-container {
    column-count: v-bind('props.columns.lg');
  }
}

@media (min-width: 1280px) {
  .masonry-grid-container {
    column-count: v-bind('props.columns.xl');
  }
}

@media (min-width: 1536px) {
  .masonry-grid-container {
    column-count: v-bind('props.columns["2xl"]');
  }
}

/* Base styles for slotted items to ensure they behave correctly in masonry */
:deep(> *) {
  break-inside: avoid;
  margin-bottom: var(--grid-gap);
  display: block;
  width: 100%;
}
</style>
