<script setup lang="ts">
import { computed } from 'vue';
import { Loader2 } from 'lucide-vue-next';

interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'link' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  icon?: any;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
  icon: null,
  iconPosition: 'left',
  fullWidth: false,
});

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

const handleClick = (event: MouseEvent) => {
  if (props.disabled || props.loading) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  emit('click', event);
};

const baseClasses =
  'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] shrink-0';

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'bg-accent text-white shadow-sm hover:bg-accent-hover hover:shadow-[0_0_12px_rgba(var(--accent-rgb),0.3)] focus-visible:ring-accent/50 focus-visible:ring-offset-bg-app border border-transparent';
    case 'outline':
      return 'bg-transparent text-secondary border border-strong hover:bg-hover hover:text-primary focus-visible:ring-strong/50 focus-visible:ring-offset-bg-app';
    case 'danger':
      return 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white hover:border-transparent focus-visible:ring-red-500/50 focus-visible:ring-offset-bg-app dark:bg-red-500/20';
    case 'link':
      return 'bg-transparent text-secondary hover:text-primary p-0 rounded-none border-b border-transparent hover:border-current active:scale-100 disabled:hover:border-transparent';
    case 'glass':
      return 'bg-white/10 dark:bg-white/5 text-primary border border-white/20 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 hover:border-white/30 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.1)] focus-visible:ring-white/30';
    case 'secondary':
    default:
      // Premium glass look mapping to tokens.css variables
      return 'bg-subtle text-secondary border border-base hover:bg-hover hover:text-primary hover:border-strong focus-visible:ring-base/50 focus-visible:ring-offset-bg-app';
  }
});

const sizeClasses = computed(() => {
  if (props.variant === 'link') return '';
  switch (props.size) {
    case 'sm':
      return 'px-3 py-1.5 text-xs gap-1.5 h-8';
    case 'lg':
      return 'px-5 py-2.5 text-base gap-2.5 h-11';
    case 'md':
    default:
      return 'px-4 py-2 text-sm gap-2 h-9.5';
  }
});

const iconSize = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'w-3.5 h-3.5';
    case 'lg':
      return 'w-5 h-5';
    case 'md':
    default:
      return 'w-4 h-4';
  }
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[baseClasses, variantClasses, sizeClasses, fullWidth ? 'w-full flex' : '']"
    @click="handleClick"
  >
    <!-- Loading spinner -->
    <Loader2 v-if="loading" class="animate-spin shrink-0" :class="iconSize" />

    <!-- Icon on Left -->
    <component
      :is="icon"
      v-if="icon && iconPosition === 'left' && !loading"
      class="shrink-0"
      :class="iconSize"
    />

    <!-- Content slot -->
    <span v-if="$slots.default" class="truncate">
      <slot></slot>
    </span>

    <!-- Icon on Right -->
    <component
      :is="icon"
      v-if="icon && iconPosition === 'right' && !loading"
      class="shrink-0"
      :class="iconSize"
    />
  </button>
</template>
