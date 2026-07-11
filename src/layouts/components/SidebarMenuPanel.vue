<script setup lang="ts">
import { inject } from 'vue';
import { Box, HelpCircle, PanelLeftClose, Settings, ShieldCheck } from 'lucide-vue-next';
import Tooltip from '@/components/ui/Tooltip.vue';
import SidebarMenuGroup from './SidebarMenuGroup.vue';
import { getAssetUrl } from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { SidebarMenuStateKey } from '../composables/useSidebarMenuState';
const state = inject(SidebarMenuStateKey)!;
const workspaceStore = useWorkspaceStore();
const emit = defineEmits<{ (e: 'report-bug'): void }>();
</script>
<template>
  <section
    class="workspace-sidebar__panel"
    :class="{
      'is-very-narrow-sidebar': state.isVeryNarrowSidebar.value,
      'is-narrow-sidebar': state.isNarrowSidebar.value,
      'is-wide-sidebar': state.isWideSidebar.value,
    }"
    aria-label="Expanded navigation"
  >
    <header class="panel-header">
      <div class="panel-hero-main">
        <div class="panel-mark" :class="{ 'panel-mark--admin': state.isAdmin.value }">
          <img
            v-if="workspaceStore.currentWorkspace?.avatarUrl"
            :src="getAssetUrl(workspaceStore.currentWorkspace.avatarUrl)"
            class="panel-mark-avatar"
            alt="Workspace Avatar"
          />
          <template v-else>
            <ShieldCheck v-if="state.isAdmin.value" :size="12" /> <Box v-else :size="12" />
          </template>
        </div>
        <div class="panel-title-block">
          <span class="panel-kicker">{{ state.sidebarSubtitle.value }}</span>
          <strong>{{ state.sidebarTitle.value }}</strong>
          <div class="panel-meta-row">
            <span class="panel-meta-chip"
              >{{ state.preparedGroups.value.length }} {{ state.panelScopeLabel.value }}</span
            >
            <span class="panel-meta-chip panel-meta-chip--state">{{
              state.settingStateLabel.value
            }}</span>
          </div>
        </div>
      </div>
      <Tooltip
        :content="state.collapseNavigationLabel.value"
        placement="bottom"
        :show-after="120"
        popper-class="sidebar-tooltip"
      >
        <button
          type="button"
          class="panel-icon-button"
          :aria-label="state.collapseNavigationLabel.value"
          :title="state.collapseNavigationLabel.value"
          @click="state.setSidebarMode('rail')"
        >
          <PanelLeftClose :size="14" />
        </button>
      </Tooltip>
    </header>
    <div class="panel-groups scrollbar-hide">
      <div
        class="active-indicator-bg"
        :class="{
          'active-indicator-bg--resource': state.isActiveResource.value,
          'active-indicator-bg--mounted': state.isMounted.value,
        }"
        :style="state.activeIndicatorStyle.value"
      ></div>
      <SidebarMenuGroup
        v-for="group in state.preparedGroups.value"
        :key="group.key"
        :group="group"
      />
    </div>
    <footer class="panel-footer">
      <div class="sync-state">
        <i :class="{ 'sync-state__dot--saving': state.isSavingPreference.value }"></i>
        <span class="sync-state__copy">
          <strong>{{ state.settingStateLabel.value }}</strong>
          <small>{{ state.settingStateCaption.value }}</small>
        </span>
      </div>
      <RouterLink
        :to="state.settingsPath.value"
        class="footer-action"
        :class="{ 'footer-action--active': state.isRouteActive(state.settingsPath.value) }"
      >
        <Settings /> <span>{{ $t('sidebar.settingsOption') }}</span>
      </RouterLink>
      <button type="button" class="footer-action" @click="emit('report-bug')">
        <HelpCircle /> <span>{{ $t('sidebar.feedbackOption') }}</span>
      </button>
    </footer>
  </section>
</template>
<style scoped>
.workspace-sidebar__panel {
  position: relative;
  width: var(--sidebar-panel-width);
  flex: 0 0 var(--sidebar-panel-width);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}
.workspace-sidebar__panel::before {
  display: none;
}
.workspace-sidebar__panel > * {
  position: relative;
  z-index: 1;
}
.workspace-sidebar--rail .workspace-sidebar__panel {
  display: none;
  pointer-events: none;
  visibility: hidden;
} /* ==================== Panel header ==================== */
.panel-header {
  position: relative;
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin: 0;
  padding: 6px 10px 4px;
  border-bottom: 1px solid var(--border-base);
  background: transparent;
  box-shadow: none;
}
.panel-header::before {
  display: none;
}
.panel-header::after {
  display: none;
}
.panel-hero-main {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 0;
}
.panel-mark {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--text-primary) 12%, transparent);
  border-radius: 6px;
  overflow: hidden;
  color: #ffffff;
  background: linear-gradient(
    135deg,
    var(--sidebar-accent),
    color-mix(in srgb, var(--sidebar-accent) 64%, #111827)
  );
  box-shadow: 0 2px 6px -3px rgba(var(--sidebar-accent-rgb), 0.5);
}
.panel-mark-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.panel-mark--admin {
  background: linear-gradient(135deg, #e11d48, #7f1232);
}
.panel-title-block {
  min-width: 0;
  display: grid;
  gap: 1px;
}
.panel-title-block strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.panel-kicker {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
}
.panel-meta-row {
  display: none;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 3px;
}
.panel-meta-chip {
  max-width: 100%;
  height: 20px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--sidebar-accent) 20%, var(--border-base));
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-card) 72%, transparent);
  color: color-mix(in srgb, var(--text-primary) 76%, var(--sidebar-accent));
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}
.panel-meta-chip--state::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #10b981;
  content: '';
  box-shadow: 0 0 0 3px color-mix(in srgb, #10b981 14%, transparent);
}
.panel-icon-button {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    color 0.16s ease,
    background-color 0.16s ease;
}
.panel-icon-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
} /* ==================== Panel groups (scroll area) ==================== */
.panel-groups {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1px 4px 4px;
}
.active-indicator-bg {
  position: absolute;
  pointer-events: none;
  z-index: 1;
  border-radius: 5px;
  background: color-mix(in srgb, var(--sidebar-accent) 10%, transparent);
  opacity: 0;
}
.active-indicator-bg--mounted {
  transition:
    top 0.22s cubic-bezier(0.25, 1, 0.5, 1),
    left 0.22s cubic-bezier(0.25, 1, 0.5, 1),
    width 0.22s cubic-bezier(0.25, 1, 0.5, 1),
    height 0.22s cubic-bezier(0.25, 1, 0.5, 1),
    opacity 0.18s ease;
}
.active-indicator-bg::before {
  display: none;
}
.active-indicator-bg--resource {
  opacity: 1;
  border-radius: 5px;
  background: color-mix(in srgb, var(--sidebar-accent) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--sidebar-accent) 22%, transparent);
  box-shadow: 0 3px 8px -6px rgba(var(--sidebar-accent-rgb), 0.3);
}
.active-indicator-bg--resource::before {
  display: none;
} /* ==================== Panel footer ==================== */
.panel-footer {
  display: grid;
  gap: 4px;
  padding: 6px;
  border-top: 1px solid color-mix(in srgb, var(--border-base) 72%, transparent);
  background:
    linear-gradient(180deg, transparent, color-mix(in srgb, var(--sidebar-accent) 5%, transparent)),
    color-mix(in srgb, var(--bg-sidebar) 92%, transparent);
}
.footer-action {
  width: 100%;
  min-height: 26px;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  text-align: left;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}
.footer-action:hover,
.footer-action--active {
  border-color: color-mix(in srgb, var(--sidebar-accent) 14%, transparent);
  color: var(--sidebar-accent);
  background: color-mix(in srgb, var(--sidebar-accent) 8%, transparent);
}
.footer-action svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}
.footer-action span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sync-state {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  margin-bottom: 2px;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--sidebar-accent) 14%, var(--border-base));
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-card) 74%, transparent);
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
}
.sync-state i {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #10b981;
  box-shadow: 0 0 0 3px color-mix(in srgb, #10b981 12%, transparent);
}
.sync-state__copy {
  min-width: 0;
  display: grid;
  gap: 1px;
}
.sync-state__copy strong,
.sync-state__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sync-state__copy strong {
  color: var(--text-primary);
  font-size: 9px;
  font-weight: 900;
  line-height: 1;
}
.sync-state__copy small {
  color: var(--text-muted);
  font-size: 8.5px;
  font-weight: 800;
  line-height: 1;
}
.sync-state .sync-state__dot--saving {
  background: #f59e0b;
  animation: sync-pulse 0.85s ease-in-out infinite;
} /* ==================== Transitions ==================== */
.sidebar-panel-enter-active,
.sidebar-panel-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.sidebar-panel-enter-from,
.sidebar-panel-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
@keyframes sync-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}
</style>
