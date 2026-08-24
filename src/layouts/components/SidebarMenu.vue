<script setup lang="ts">
import { computed, provide, toRef } from 'vue';
import type { SidebarMenuGroup } from '../composables/useSidebarMenus';
import { useSidebarMenuState, SidebarMenuStateKey } from '../composables/useSidebarMenuState';
import SidebarMenuRail from './SidebarMenuRail.vue';
import SidebarMenuPanel from './SidebarMenuPanel.vue';

const props = defineProps<{
  menuGroups: SidebarMenuGroup[];
}>();

const emit = defineEmits<{
  (e: 'report-bug'): void;
}>();

const state = useSidebarMenuState(toRef(props, 'menuGroups'));
provide(SidebarMenuStateKey, state);

const isTopMode = computed(() => state.sidebarMode.value === 'top');
</script>

<template>
  <aside
    v-if="!isTopMode"
    class="workspace-sidebar hidden lg:flex h-full shrink-0 relative overflow-hidden select-none border-r border-[var(--border-base)] bg-[var(--bg-sidebar)] transition-all duration-200"
    :class="[
      `workspace-sidebar--${state.navTone.value}`,
      state.isExpanded.value ? 'workspace-sidebar--expanded' : 'workspace-sidebar--rail',
      state.isResizing.value ? 'is-resizing' : '',
    ]"
    :style="
      state.isExpanded.value
        ? {
            width: state.customWidth.value + 'px',
            '--sidebar-panel-width': state.customWidth.value + 'px',
          }
        : {
            width: '56px',
            '--sidebar-rail-width': '56px',
          }
    "
  >
    <!-- Rail (56px Mini Icon Rail) -->
    <SidebarMenuRail v-if="!state.isExpanded.value" @report-bug="emit('report-bug')" />

    <!-- Panel (Expanded Tree Panel) -->
    <SidebarMenuPanel v-else @report-bug="emit('report-bug')" />

    <!-- Resize Handle for expanded mode -->
    <div
      v-if="state.isExpanded.value"
      class="sidebar-resize-handle absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/40 transition-colors z-20"
      @mousedown="state.handleMousedown"
    ></div>
  </aside>
</template>

<style scoped>
:global(.theme-glass) .workspace-sidebar {
  background: rgba(248, 250, 252, 0.35) !important;
  backdrop-filter: var(--glass-blur, blur(16px)) !important;
  -webkit-backdrop-filter: var(--glass-blur, blur(16px)) !important;
}

:global(.theme-glass.dark) .workspace-sidebar {
  background: rgba(7, 10, 19, 0.45) !important;
  backdrop-filter: var(--glass-blur, blur(16px)) !important;
  -webkit-backdrop-filter: var(--glass-blur, blur(16px)) !important;
}

.workspace-sidebar {
  --sidebar-accent: var(--accent);
  --sidebar-accent-rgb: var(--accent-rgb, 245, 121, 42);
}

.workspace-sidebar--admin {
  --sidebar-accent: #e11d48;
  --sidebar-accent-rgb: 225, 29, 72;
}

.workspace-sidebar--resource {
  --sidebar-accent: #2563eb;
  --sidebar-accent-rgb: 37, 99, 235;
}
</style>
