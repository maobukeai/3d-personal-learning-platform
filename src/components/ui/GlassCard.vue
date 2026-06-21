<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  hoverable?: boolean;
  clickable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  hoverable: false,
  clickable: false,
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
    class="glass-card rounded-2xl relative flex flex-col overflow-hidden border transition-all duration-500 cubic-bezier-card"
    :class="[
      paddingClass,
      hoverable ? 'hover:-translate-y-1 hover:shadow-card-hover hover:border-strong dark:hover:border-slate-700' : '',
      clickable ? 'cursor-pointer select-none active:scale-[0.99]' : '',
    ]"
  >
    <div class="relative z-10 flex-1 flex flex-col">
      <div v-if="$slots.header" class="premium-card__header mb-3 pb-3 border-b border-white/10 dark:border-white/10">
        <slot name="header"></slot>
      </div>

      <div class="premium-card__body flex-1 flex flex-col">
        <slot></slot>
      </div>

      <div v-if="$slots.footer" class="premium-card__footer mt-3 pt-3 border-t border-white/10 dark:border-white/10">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cubic-bezier-card {
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
