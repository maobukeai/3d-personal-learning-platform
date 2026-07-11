<script setup lang="ts">
import { inject } from 'vue';
import {
  Box,
  ChevronsLeft,
  ChevronsRight,
  HelpCircle,
  Settings,
  ShieldCheck,
} from 'lucide-vue-next';
import Tooltip from '@/components/ui/Tooltip.vue';
import SidebarMenuSection from './SidebarMenuSection.vue';
import { SidebarMenuStateKey } from '../composables/useSidebarMenuState';
const state = inject(SidebarMenuStateKey)!;
const emit = defineEmits<{ (e: 'report-bug'): void }>();
</script>
<template>
  <div class="workspace-sidebar__rail">
    <div class="rail-top">
      <Tooltip
        :content="
          state.isExpanded.value
            ? state.collapseNavigationLabel.value
            : state.expandNavigationLabel.value
        "
        placement="right"
        :show-after="120"
        popper-class="sidebar-tooltip"
      >
        <button
          type="button"
          class="rail-link rail-action-button rail-toggle"
          :aria-label="
            state.isExpanded.value
              ? state.collapseNavigationLabel.value
              : state.expandNavigationLabel.value
          "
          :title="
            state.isExpanded.value
              ? state.collapseNavigationLabel.value
              : state.expandNavigationLabel.value
          "
          style="margin-bottom: 12px"
          @click="state.toggleSidebar"
        >
          <ChevronsLeft v-if="state.isExpanded.value" class="rail-icon" />
          <ChevronsRight v-else class="rail-icon" />
        </button>
      </Tooltip>
      <Tooltip
        :content="state.sidebarTitle.value"
        placement="right"
        :show-after="120"
        popper-class="sidebar-tooltip"
      >
        <div class="rail-badge" :class="{ 'rail-badge--admin': state.isAdmin.value }">
          <ShieldCheck v-if="state.isAdmin.value" /> <Box v-else />
        </div>
      </Tooltip>
    </div>
    <nav class="rail-nav scrollbar-hide" aria-label="Primary">
      <SidebarMenuSection
        v-for="(group, groupIndex) in state.preparedGroups.value"
        :key="group.key"
        :group="group"
        :show-divider="groupIndex > 0"
      />
    </nav>
    <div class="rail-actions">
      <Tooltip
        :content="$t('sidebar.settingsOption')"
        placement="right"
        :show-after="120"
        popper-class="sidebar-tooltip"
      >
        <RouterLink
          :to="state.settingsPath.value"
          class="rail-link"
          :class="{ 'rail-link--active': state.isRouteActive(state.settingsPath.value) }"
          :aria-label="$t('sidebar.settingsOption')"
          :title="$t('sidebar.settingsOption')"
        >
          <Settings class="rail-icon" />
        </RouterLink>
      </Tooltip>
      <Tooltip
        :content="$t('sidebar.feedbackOption')"
        placement="right"
        :show-after="120"
        popper-class="sidebar-tooltip"
      >
        <button
          type="button"
          class="rail-link rail-action-button"
          :aria-label="$t('sidebar.feedbackOption')"
          :title="$t('sidebar.feedbackOption')"
          @click="emit('report-bug')"
        >
          <HelpCircle class="rail-icon" />
        </button>
      </Tooltip>
      <div class="rail-signature">{{ state.isAdmin.value ? 'ADMIN' : 'APP' }}</div>
    </div>
  </div>
</template>
<style scoped>
.workspace-sidebar__rail {
  width: var(--sidebar-rail-width);
  flex: 0 0 var(--sidebar-rail-width);
  display: flex;
  flex-direction: column;
  min-height: 0;
} /* Hide rail when sidebar is expanded — the panel takes over */
.workspace-sidebar--expanded .workspace-sidebar__rail {
  display: none;
}
.rail-top {
  padding: 10px 8px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.rail-badge {
  height: 40px;
  width: 40px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--sidebar-accent) 28%, transparent);
  border-radius: 8px;
  color: var(--sidebar-accent);
  background: color-mix(in srgb, var(--sidebar-accent) 10%, transparent);
}
.rail-badge--admin {
  background: rgba(225, 29, 72, 0.1);
}
.rail-badge svg {
  width: 18px;
  height: 18px;
}
.rail-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 7px 8px;
}
.rail-actions {
  display: grid;
  gap: 4px;
  padding: 8px 7px;
  border-top: 1px solid var(--border-base);
}
.rail-action-button {
  appearance: none;
}
.rail-toggle {
  color: var(--sidebar-accent);
  background: color-mix(in srgb, var(--sidebar-accent) 9%, transparent);
}
.rail-signature {
  padding-top: 4px;
  color: color-mix(in srgb, var(--text-muted) 45%, transparent);
  font-size: 8px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0;
  text-align: center;
  user-select: none;
} /* ==================== Shared rail-link styles (apply to all rail links, including those rendered by SidebarMenuItem via :deep) ==================== */
:deep(.rail-link) {
  position: relative;
  width: 44px;
  height: 38px;
  margin: 0 auto;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;
}
:deep(.rail-link:hover) {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--sidebar-accent) 8%, transparent);
}
:deep(.rail-link--active) {
  color: #ffffff;
  background: var(--sidebar-accent);
  box-shadow: 0 10px 20px -16px rgba(var(--sidebar-accent-rgb), 0.8);
}
:deep(.rail-active-bar) {
  position: absolute;
  left: -8px;
  top: 9px;
  bottom: 9px;
  width: 4px;
  border-radius: 0 999px 999px 0;
  background: var(--sidebar-accent);
}
:deep(.rail-link--active .rail-active-bar) {
  background: var(--sidebar-accent);
}
:deep(.rail-badge-count) {
  position: absolute;
  top: -3px;
  right: 0;
  min-width: 17px;
  height: 17px;
  display: grid;
  place-items: center;
  padding: 0 4px;
  border-radius: 999px;
  color: #ffffff;
  background: #ef4444;
  font-size: 9px;
  font-weight: 900;
  line-height: 1;
  box-shadow: 0 0 0 2px var(--bg-sidebar);
}
:deep(.rail-icon) {
  width: 18px;
  height: 18px;
}
</style>
