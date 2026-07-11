<script setup lang="ts">
import { inject } from 'vue';
import { DropdownMenuItem, DropdownMenuSeparator } from 'radix-vue';
import { dropdownContextKey } from './dropdownContext';

interface Props {
  command?: string | number;
  disabled?: boolean;
  divided?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  command: undefined,
  disabled: false,
  divided: false,
});

const emit = defineEmits<{ (event: 'click', value: MouseEvent): void }>();
const dropdown = inject(dropdownContextKey, null);

const onSelect = (event: Event) => {
  emit('click', event as MouseEvent);
  dropdown?.select(props.command);
};
</script>

<template>
  <DropdownMenuSeparator v-if="divided" class="my-1 h-px bg-[var(--border-base)]" />
  <DropdownMenuItem
    :disabled="disabled"
    class="flex min-h-9 cursor-pointer items-center rounded-[var(--radius-control)] px-3 text-sm text-[var(--text-primary)] outline-none data-[highlighted]:bg-[var(--bg-hover)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
    @select="onSelect"
  >
    <slot />
  </DropdownMenuItem>
</template>
