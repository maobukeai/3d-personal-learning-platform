<script setup lang="ts">
import { inject } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import SidebarMenuItem from './SidebarMenuItem.vue';
import type { PreparedSidebarGroup } from './sidebarMenuSchema';
import { SidebarMenuStateKey } from '../composables/useSidebarMenuState';
const props = defineProps<{ group: PreparedSidebarGroup }>();
const state = inject(SidebarMenuStateKey)!;
</script>
<template>
  <section class="panel-group">
    <button
      type="button"
      class="group-trigger"
      :class="{ 'group-trigger--active': props.group.isActive }"
      :aria-expanded="state.isGroupOpen(props.group)"
      @click="state.toggleGroup(props.group)"
    >
      <span class="group-trigger__title">{{ props.group.title }}</span>
      <span class="group-trigger__meta">
        <span class="group-count">{{ props.group.items.length }}</span>
        <ChevronDown :class="{ 'rotate-180': state.isGroupOpen(props.group) }" />
      </span>
    </button>
    <Transition name="group-list">
      <ul
        v-if="state.isGroupOpen(props.group)"
        class="panel-list panel-list--resource-grid"
        :class="
          props.group.items.length % 2 === 1
            ? 'panel-list--resource-grid-odd'
            : 'panel-list--resource-grid-even'
        "
      >
        <li v-for="item in props.group.items" :key="item.path">
          <SidebarMenuItem :item="item" variant="panel" />
        </li>
      </ul>
    </Transition>
  </section>
</template>
<style scoped>
.panel-group + .panel-group {
  margin-top: 1px;
  padding-top: 1px;
  border-top: 1px solid color-mix(in srgb, var(--border-base) 35%, transparent);
}
.group-trigger {
  width: 100%;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 4px;
}
.group-trigger:hover {
  color: var(--text-primary);
}
.group-trigger--active {
  color: var(--text-primary);
  font-weight: 900;
}
.group-trigger__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-trigger__meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
}
.group-count {
  min-width: 13px;
  height: 13px;
  display: grid;
  place-items: center;
  padding: 0 3px;
  border-radius: 3px;
  background: var(--bg-hover);
  color: var(--text-muted);
  font-size: 8px;
  font-weight: 900;
  line-height: 1;
}
.group-trigger:hover .group-count,
.group-trigger--active .group-count {
  background: color-mix(in srgb, var(--sidebar-accent) 8%, transparent);
  color: var(--sidebar-accent);
}
.group-trigger svg {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  transition: transform 0.18s ease;
}
.rotate-180 {
  transform: rotate(180deg);
}
.panel-list {
  position: relative;
  display: grid;
  gap: 2px;
  margin: 1px 0 0;
  padding: 0 0 0 4px;
  list-style: none;
}
.panel-list::before {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 1px;
  width: 1px;
  content: '';
  border-radius: 999px;
  background: var(--border-base);
  opacity: 0.35;
}
.panel-list--resource-grid {
  --sidebar-grid-cols: 2;
  --sidebar-link-gap: 2px;
  display: grid;
  grid-template-columns: repeat(var(--sidebar-grid-cols), minmax(0, 1fr));
  gap: var(--sidebar-link-gap);
  padding: 2px;
  border: 1px solid color-mix(in srgb, var(--text-primary) 5%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-card) 45%, transparent);
  backdrop-filter: blur(8px);
  margin: 1px 0 2px;
}
.panel-list--resource-grid::before {
  display: none;
} /* Remove all cell borders for Bento look */
.panel-list--resource-grid li {
  border-bottom: none;
  border-right: none;
} /* ==================== ODD ITEM COUNT LAYOUT ==================== */
/* First child spans full width */
.panel-list--resource-grid-odd li:first-child {
  grid-column: 1 / -1;
  border-bottom: none;
} /* ==================== EVEN ITEM COUNT LAYOUT ==================== */
/* Left column items are odd indices: 1, 3, 5... */
.panel-list--resource-grid-even li:nth-child(2n-1) {
  border-right: none;
} /* Remove bottom borders from last row */
.panel-list--resource-grid-even li:last-child,
.panel-list--resource-grid-even li:nth-last-child(2) {
  border-bottom: none;
} /* ==================== Width variant overrides for grid ==================== */
.is-very-narrow-sidebar .panel-list--resource-grid {
  --sidebar-grid-cols: 1;
}
.is-wide-sidebar .panel-list--resource-grid-odd {
  --sidebar-grid-cols: 3;
}
.is-wide-sidebar .panel-list--resource-grid-odd li:first-child {
  grid-column: auto;
}
.is-wide-sidebar .panel-list--resource-grid-even {
  --sidebar-grid-cols: 4;
} /* ==================== Transitions ==================== */
.group-list-enter-active,
.group-list-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}
.group-list-enter-from,
.group-list-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
