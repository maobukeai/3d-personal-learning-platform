<script setup lang="ts">
import { computed } from 'vue';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'radix-vue';

interface Props {
  placement?:
    | 'top'
    | 'top-start'
    | 'top-end'
    | 'bottom'
    | 'bottom-start'
    | 'bottom-end'
    | 'left'
    | 'left-start'
    | 'left-end'
    | 'right'
    | 'right-start'
    | 'right-end';
  width?: string | number;
  popperClass?: string;
  title?: string;
  content?: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'bottom',
  width: undefined,
  popperClass: '',
  title: '',
  content: '',
  disabled: false,
});

const side = computed(() => props.placement.split('-')[0] as 'top' | 'bottom' | 'left' | 'right');
const align = computed(() => {
  const suffix = props.placement.split('-')[1];
  return suffix === 'start' || suffix === 'end' ? suffix : 'center';
});
const widthStyle = computed(() =>
  props.width == null
    ? undefined
    : { width: typeof props.width === 'number' ? `${props.width}px` : props.width },
);
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child :disabled="disabled"><slot name="reference" /></PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :side="side"
        :align="align"
        :side-offset="6"
        :style="widthStyle"
        class="glass-popover z-[var(--z-popover)] p-3 text-sm outline-none"
        :class="popperClass"
      >
        <slot>
          <div v-if="title" class="mb-1 font-semibold text-[var(--text-primary)]">{{ title }}</div>
          <div v-if="content" class="text-[var(--text-secondary)]">{{ content }}</div>
        </slot>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
