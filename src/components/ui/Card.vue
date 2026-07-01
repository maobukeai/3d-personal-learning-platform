<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  hoverable?: boolean;
  clickable?: boolean;
  glass?: boolean;
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  hoverable: false,
  clickable: false,
  glass: false,
  glow: false,
  padding: 'md',
});

const paddingClass = computed(() => {
  switch (props.padding) {
    case 'none':
      return 'p-0';
    case 'sm':
      return 'p-3';
    case 'lg':
      return 'p-6';
    case 'md':
    default:
      return 'p-4 sm:p-5';
  }
});
</script>

<template>
  <div
    class="premium-card rounded-xl relative flex flex-col overflow-hidden border transition-all duration-500 cubic-bezier-card"
    :class="[
      paddingClass,
      glass ? 'glass-panel shadow-sm' : 'bg-card border-base shadow-card',
      hoverable
        ? 'hover:-translate-y-1 hover:shadow-card-hover hover:border-strong dark:hover:border-slate-700'
        : '',
      glow && hoverable
        ? 'hover:border-accent/30 dark:hover:border-accent/40 hover:shadow-[0_12px_24px_-8px_rgba(var(--accent-rgb),0.15),_0_0_20px_-3px_rgba(var(--accent-rgb),0.1)] dark:hover:shadow-[0_12px_24px_-8px_rgba(var(--accent-rgb),0.25),_0_0_24px_-4px_rgba(var(--accent-rgb),0.15)]'
        : '',
      clickable ? 'cursor-pointer select-none active:scale-[0.99]' : '',
    ]"
  >
    <!-- Spotlight reflection overlay -->
    <div
      class="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 transition-opacity duration-500 mix-blend-overlay z-0"
      :class="hoverable ? 'group-hover:opacity-100' : 'opacity-100'"
    ></div>

    <!-- Top accent glow line for hoverable/glow cards -->
    <div
      v-if="glow"
      class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 transition-opacity duration-500 z-10"
      :class="hoverable ? 'group-hover:opacity-100' : 'opacity-100'"
    ></div>

    <div class="relative z-10 flex-1 flex flex-col">
      <div v-if="$slots.header" class="premium-card__header mb-3 pb-3 border-b border-base/40">
        <slot name="header"></slot>
      </div>

      <div class="premium-card__body flex-1 flex flex-col">
        <slot></slot>
      </div>

      <div v-if="$slots.footer" class="premium-card__footer mt-3 pt-3 border-t border-base/40">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.premium-card {
  box-sizing: border-box;
  /* Top bevel lighting effect (inner shadow) */
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.4),
    var(--shadow-card);
}

.dark .premium-card {
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.05),
    var(--shadow-card);
}

/* .cubic-bezier-card provided globally by src/styles/components.css */
</style>
