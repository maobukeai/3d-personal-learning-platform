<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'radix-vue';
import { dropdownContextKey } from './dropdownContext';

interface Props {
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  align?: 'left' | 'right';
  widthClass?: string;
  disabled?: boolean;
  trigger?: 'click' | 'hover' | 'contextmenu';
  popperClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'bottom-end',
  align: undefined,
  widthClass: '',
  disabled: false,
  trigger: 'click',
  popperClass: '',
});

const emit = defineEmits<{
  (event: 'visible-change', open: boolean): void;
  (event: 'command', command: string | number | undefined): void;
}>();

const open = ref(false);
const resolvedPlacement = computed(() => {
  if (props.align) return props.align === 'left' ? 'bottom-start' : 'bottom-end';
  return props.placement;
});
const side = computed(() => (resolvedPlacement.value.startsWith('top') ? 'top' : 'bottom'));
const dropdownAlign = computed(() => (resolvedPlacement.value.endsWith('start') ? 'start' : 'end'));

const updateOpen = (value: boolean) => {
  open.value = value;
  emit('visible-change', value);
};

const select = (command: string | number | undefined) => {
  emit('command', command);
  updateOpen(false);
};

provide(dropdownContextKey, { select });

defineExpose({
  handleOpen: () => updateOpen(true),
  handleClose: () => updateOpen(false),
});
</script>

<template>
  <DropdownMenuRoot :open="open" :modal="false" @update:open="updateOpen">
    <DropdownMenuTrigger as-child :disabled="disabled" class="dropdown-trigger-btn">
      <slot name="trigger">
        <slot />
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :side="side"
        :align="dropdownAlign"
        :side-offset="6"
        class="glass-popover z-[var(--z-dropdown)] min-w-40 p-1 outline-none"
        :class="[popperClass, widthClass]"
      >
        <div
          class="max-h-72 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent"
        >
          <slot name="dropdown">
            <slot name="content" />
          </slot>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
