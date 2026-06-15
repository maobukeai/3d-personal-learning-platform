<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  align?: 'left' | 'right';
  widthClass?: string;
}

withDefaults(defineProps<Props>(), {
  align: 'right',
  widthClass: 'w-48',
});

const isOpen = ref(false);
const dropdownRef = ref<any>(null);

const toggle = () => {
  if (dropdownRef.value) {
    if (isOpen.value) dropdownRef.value.handleClose();
    else dropdownRef.value.handleOpen();
  }
};

const close = () => {
  if (dropdownRef.value) {
    dropdownRef.value.handleClose();
  }
};

const onVisibleChange = (val: boolean) => {
  isOpen.value = val;
};

defineExpose({ toggle, close, isOpen });
</script>

<template>
  <el-dropdown
    ref="dropdownRef"
    trigger="click"
    :placement="align === 'right' ? 'bottom-end' : 'bottom-start'"
    @visible-change="onVisibleChange"
  >
    <div class="cursor-pointer outline-none">
      <slot name="trigger" :is-open="isOpen"></slot>
    </div>
    <template #dropdown>
      <el-dropdown-menu
        class="!p-1.5 !rounded-2xl !shadow-lg !border !border-slate-200 dark:!border-slate-700 glass-panel !overflow-hidden"
        :class="widthClass"
      >
        <div class="flex flex-col gap-0.5 outline-none" @click="close">
          <slot name="content"></slot>
        </div>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style>
/* Clean up Element Plus dropdown wrapper border-radius and outline effects */
.el-dropdown__popper.el-popper {
  border-radius: 1rem !important;
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
}
.el-dropdown__popper.el-popper .el-popper__arrow::before {
  border: 1px solid var(--el-border-color-light) !important;
  background: var(--el-bg-color-overlay) !important;
}
.dark .el-dropdown__popper.el-popper .el-popper__arrow::before {
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  background: #1e293b !important;
}
.el-dropdown-menu {
  background-color: transparent !important;
}
</style>
