<script setup lang="ts">
import { computed } from 'vue';
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'radix-vue';

interface Props {
  content?: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
  openDelay?: number;
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  placement: 'top',
  disabled: false,
  openDelay: 300,
});

const delayDuration = computed(() => (props.disabled ? 0 : props.openDelay));
</script>

<template>
  <TooltipProvider :delay-duration="delayDuration">
    <TooltipRoot :disabled="disabled">
      <TooltipTrigger as-child><slot /></TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="placement"
          :side-offset="6"
          class="glass-popover z-[var(--z-popover)] max-w-64 px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
        >
          <slot name="content">{{ content }}</slot>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
