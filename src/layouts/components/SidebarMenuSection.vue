<script setup lang="ts">
import SidebarMenuItem from './SidebarMenuItem.vue';
import type { PreparedSidebarGroup } from './sidebarMenuSchema';
defineProps<{ group: PreparedSidebarGroup; showDivider?: boolean }>();
</script>
<template>
  <div class="rail-group">
    <div v-if="showDivider" class="rail-divider"></div>
    <ul class="rail-list">
      <li v-for="item in group.items" :key="item.path">
        <SidebarMenuItem :item="item" variant="rail" />
      </li>
    </ul>
  </div>
</template>
<style scoped>
.rail-group {
  padding: 2px 0;
}
.rail-divider {
  height: 1px;
  width: 38px;
  margin: 8px auto;
  background: var(--border-base);
  opacity: 0.65;
}
.rail-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
