<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/utils/cn';

interface Props {
  hoverable?: boolean;
  clickable?: boolean;
  /**
   * Legacy glass flag (dashboard panels).
   * @deprecated Prefer `surface="glass"`. Internally mapped to `surface="glass"`.
   */
  glass?: boolean;
  /** @deprecated Ignore glow to prevent multiple feedback channels */
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Surface variant. 'glass' applies the frosted-glass surface. */
  surface?: 'base' | 'raised' | 'glass';
  /** Glass tier (only meaningful when surface="glass"). */
  tier?: 'panel' | 'elevated';
  /** Single-channel hover feedback type. Default is 'border'. */
  hoverChannel?: 'border' | 'background' | 'offset';
}

const props = withDefaults(defineProps<Props>(), {
  hoverable: false,
  clickable: false,
  glass: false,
  glow: false,
  padding: 'md',
  surface: 'base',
  tier: 'panel',
  hoverChannel: 'border',
});

const isGlassSurface = computed(() => props.surface === 'glass' || props.glass);

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

const cardClasses = computed(() => {
  const base = 'relative flex flex-col overflow-hidden border transition-all duration-300 ease-out';

  const hoverClass = (() => {
    if (!props.hoverable) return '';
    switch (props.hoverChannel) {
      case 'background':
        return 'card-hover-bg';
      case 'offset':
        return 'card-hover-offset';
      case 'border':
      default:
        return 'card-hover-border';
    }
  })();

  if (isGlassSurface.value) {
    return cn(
      base,
      'rounded-xl glass-real-physical', // 12px rounding for glass floaters
      paddingClass.value,
      hoverClass,
      props.clickable && 'cursor-pointer select-none active:translate-y-[1px]',
    );
  }

  // base / raised surface card: border/radius/color come from utility styles
  const surfaceClass =
    props.surface === 'raised'
      ? 'bg-card text-card-foreground border-[var(--border-strong)] shadow-md'
      : 'bg-card text-card-foreground border-[var(--border-base)] shadow-sm';

  return cn(
    base,
    'rounded-md', // 8px rounding for base cards
    surfaceClass,
    paddingClass.value,
    hoverClass,
    props.clickable && 'cursor-pointer select-none active:translate-y-[1px]',
  );
});
</script>

<template>
  <div :class="cardClasses">
    <div class="relative z-10 flex-1 flex flex-col">
      <div v-if="$slots.header" class="premium-card__header mb-3 pb-3 border-b border-border/40">
        <slot name="header"></slot>
      </div>

      <div class="premium-card__body flex-1 flex flex-col">
        <slot></slot>
      </div>

      <div v-if="$slots.footer" class="premium-card__footer mt-3 pt-3 border-t border-border/40">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>
