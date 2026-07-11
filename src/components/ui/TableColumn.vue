<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, useSlots } from 'vue';
import { tableContextKey } from './tableContext';

interface Props {
  label?: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  width: undefined,
  align: 'left',
});

const context = inject(tableContextKey, null);
const slots = useSlots();
const id = Symbol('table-column');

onMounted(() =>
  context?.register({ id, label: props.label, width: props.width, align: props.align, slots }),
);
onBeforeUnmount(() => context?.unregister(id));
</script>

<template><span class="hidden" aria-hidden="true" /></template>
