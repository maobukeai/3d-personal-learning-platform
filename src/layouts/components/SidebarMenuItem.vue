<script setup lang="ts">
import Tooltip from '@/components/ui/Tooltip.vue';
import type { PreparedSidebarItem } from './sidebarMenuSchema';
withDefaults(defineProps<{ item: PreparedSidebarItem; variant?: 'rail' | 'panel' }>(), {
  variant: 'rail',
});
</script>
<template>
  <Tooltip
    v-if="variant === 'rail'"
    :content="item.tooltip"
    placement="right"
    :show-after="120"
    popper-class="sidebar-tooltip"
  >
    <RouterLink
      :to="item.path"
      class="rail-link"
      :class="{ 'rail-link--active': item.isActive }"
      :aria-label="item.tooltip"
      :title="item.tooltip"
    >
      <span v-if="item.isActive" class="rail-active-bar"></span>
      <component :is="item.icon" class="rail-icon" />
      <span v-if="item.badge && item.badge > 0" class="rail-badge-count">
        {{ item.badge > 99 ? '99+' : item.badge }}
      </span>
    </RouterLink>
  </Tooltip>
  <RouterLink
    v-else
    :to="item.path"
    class="panel-link panel-link--resource"
    :class="{ 'panel-link--active': item.isActive }"
  >
    <span class="panel-link-icon-wrap">
      <component :is="item.icon" class="panel-link-icon" />
    </span>
    <span class="panel-link-label">{{ item.name }}</span>
    <strong v-if="item.badge && item.badge > 0" class="panel-badge">
      {{ item.badge > 99 ? '99+' : item.badge }}
    </strong>
  </RouterLink>
</template>
<style scoped>
/* Rail-link base styles are owned by SidebarMenuRail.vue (the rail container) via :deep() so they also apply to the toggle/settings/feedback buttons rendered directly by the rail. This keeps the shared class in one place. */ /* ==================== Panel link (expanded view) ==================== */
.panel-link:hover:not(.panel-link--active) {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--sidebar-accent) 7%, transparent);
}
.panel-link--active {
  color: var(--text-primary);
  font-weight: 900;
}
.panel-link-icon-wrap {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}
.panel-link:hover .panel-link-icon-wrap {
  color: var(--sidebar-accent);
  background: color-mix(in srgb, var(--sidebar-accent) 8%, transparent);
}
.panel-link--active .panel-link-icon-wrap {
  color: #ffffff;
  background: var(--sidebar-accent);
  box-shadow: 0 8px 14px -10px rgba(var(--sidebar-accent-rgb), 0.9);
}
.panel-link-icon {
  width: 11px;
  height: 11px;
  color: currentColor;
}
.panel-link-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 9.5px;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.panel-link--resource {
  justify-content: center;
} /* Centering styles for the first full-width header item in the grid */
.panel-list--resource-grid-odd li:first-child .panel-link {
  position: relative;
  z-index: 2;
  min-width: 0;
  min-height: 23px;
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid transparent;
  border-radius: 5px;
  padding: 0 4px;
  color: var(--text-secondary);
  transition: all 0.18s ease;
}
.panel-list--resource-grid-odd li:first-child .panel-link-label {
  flex: 0 0 auto;
}
.panel-link--resource {
  position: relative;
  isolation: isolate;
  height: 23px;
  display: flex;
  align-items: center;
  gap: 3.5px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 4.5px;
  background: color-mix(in srgb, var(--text-primary) 2%, transparent);
  color: var(--text-secondary);
  padding: 0 4px;
  transition: all 0.18s ease;
} /* Style first child of odd layout as header bento card. Values are driven by CSS variables so width variants (very-narrow / wide) can reset the header look without fighting specificity. */
.panel-list--resource-grid-odd li:first-child .panel-link--resource {
  height: var(--resource-first-height, 24px);
  background: var(
    --resource-first-bg,
    color-mix(
      in srgb,
      var(--sidebar-accent) 5%,
      color-mix(in srgb, var(--text-primary) 2.5%, transparent)
    )
  );
  border-color: var(
    --resource-first-border,
    color-mix(in srgb, var(--sidebar-accent) 10%, transparent)
  );
}
.panel-link--resource::before {
  display: none;
}
.panel-link--resource .panel-link-icon-wrap {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-muted);
  box-shadow: none;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}
.panel-link--resource .panel-link-label {
  color: var(--text-secondary);
  font-size: 9.5px;
  font-weight: 600;
  line-height: 1.1;
  transition: color 0.16s ease;
} /* Hover / active selectors are scoped under the grid + li so their specificity (0,3,1) naturally outranks the first-child header rule and wins by source order, avoiding forced declarations. */
.panel-list--resource-grid li .panel-link--resource:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--sidebar-accent) 7%, transparent);
  border-color: color-mix(in srgb, var(--sidebar-accent) 18%, transparent);
  transform: translateY(-0.5px);
}
.panel-link--resource:hover .panel-link-icon-wrap {
  color: var(--sidebar-accent);
  background: color-mix(in srgb, var(--sidebar-accent) 10%, transparent);
}
.panel-link--resource:hover .panel-link-label {
  color: var(--text-primary);
}
.panel-list--resource-grid li .panel-link--resource.panel-link--active {
  color: var(--sidebar-accent);
  background: transparent;
}
.panel-link--resource.panel-link--active::before {
  display: none;
}
.panel-link--resource.panel-link--active .panel-link-icon-wrap {
  color: #ffffff;
  background: var(--sidebar-accent);
  box-shadow: 0 4px 10px -6px rgba(var(--sidebar-accent-rgb), 0.8);
}
.panel-link--resource.panel-link--active .panel-link-label {
  color: var(--text-primary);
  font-weight: 800;
}
.panel-badge {
  min-width: 15px;
  height: 15px;
  display: grid;
  place-items: center;
  padding: 0 4px;
  border-radius: 999px;
  color: #ffffff;
  background: #ef4444;
  font-size: 8.5px;
  font-weight: 900;
  line-height: 1;
} /* ==================== RESPONSIVE WIDTH VARIANTS ==================== */
.is-very-narrow-sidebar .panel-list--resource-grid-odd li:first-child .panel-link--resource {
  --resource-first-height: 23px;
  --resource-first-bg: color-mix(in srgb, var(--text-primary) 2%, transparent);
  --resource-first-border: transparent;
}
.is-narrow-sidebar .panel-link--resource {
  padding: 0 2px;
  gap: 2px;
}
.is-narrow-sidebar .panel-link--resource .panel-link-icon-wrap {
  width: 13px;
  height: 13px;
}
.is-narrow-sidebar .panel-link--resource .panel-link-icon {
  width: 9px;
  height: 9px;
}
.is-narrow-sidebar .panel-link--resource .panel-link-label {
  font-size: 8.2px;
}
.is-wide-sidebar .panel-list--resource-grid-odd li:first-child .panel-link--resource {
  --resource-first-height: 23px;
  --resource-first-bg: color-mix(in srgb, var(--text-primary) 2%, transparent);
  --resource-first-border: transparent;
}
</style>
