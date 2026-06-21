<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  popperClass?: string;
  menuClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  popperClass: '',
  menuClass: '',
});

const finalPopperClass = computed(() => `glass-card ${props.popperClass}`.trim());
const finalMenuClass = computed(() => `glass-dropdown-menu ${props.menuClass}`.trim());
</script>

<template>
  <el-dropdown
    transition="fast-fade"
    v-bind="$attrs"
    :popper-class="finalPopperClass"
  >
    <slot name="trigger"></slot>
    <template #dropdown>
      <el-dropdown-menu :class="finalMenuClass">
        <slot></slot>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.glass-dropdown-menu {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}
</style>
