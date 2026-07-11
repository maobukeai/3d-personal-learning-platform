<script setup lang="ts">
import Dropdown from './Dropdown.vue';
import DropdownMenu from './DropdownMenu.vue';

interface Props {
  popperClass?: string;
  menuClass?: string;
}

withDefaults(defineProps<Props>(), {
  popperClass: '',
  menuClass: '',
});
</script>

<template>
  <Dropdown v-bind="$attrs" :popper-class="popperClass">
    <template #trigger><slot name="trigger" /></template>
    <template #dropdown>
      <DropdownMenu :class="menuClass"><slot /></DropdownMenu>
    </template>
  </Dropdown>
</template>
