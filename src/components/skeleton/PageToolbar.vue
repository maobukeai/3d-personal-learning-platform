<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Search, SlidersHorizontal } from 'lucide-vue-next';
import Input from '@/components/ui/Input.vue';
import Drawer from '@/components/ui/Drawer.vue';
import { useMobile } from '@/composables/useMobile';
interface Props {
  searchValue?: string;
  searchPlaceholder?: string;
  showSearch?: boolean;
  bulkMode?: boolean;
  /** * On mobile, wrap toolbar children (default) — or, when `collapseOnMobile` * is set, hide the inline toolbar behind a trigger that opens a Drawer. */ collapseOnMobile?: boolean;
  /** Trigger label shown on mobile when `collapseOnMobile` is enabled. */ collapseLabel?: string;
}
const props = withDefaults(defineProps<Props>(), {
  searchValue: '',
  searchPlaceholder: 'Search...',
  showSearch: true,
  bulkMode: false,
  collapseOnMobile: false,
  collapseLabel: 'Filters',
});
const emit = defineEmits<{
  (e: 'update:searchValue', value: string): void;
  (e: 'update:bulkMode', value: boolean): void;
}>();
const { isMobile } = useMobile(768); /** Drawer visibility for the mobile collapsed toolbar. */
const drawerOpen =
  ref(false); /** When collapsed on mobile, the inline toolbar is replaced by a trigger. */
const collapsed = computed(() => props.collapseOnMobile && isMobile.value && !props.bulkMode); // Local mirror of the search value so typing stays responsive while the
// emitted update is debounced. Kept in sync with the prop when the parent
// changes it externally.
const localSearch = ref(props.searchValue);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => props.searchValue,
  (next) => {
    if (next !== localSearch.value) {
      localSearch.value = next;
    }
  },
);
const onSearchInput = (value: string) => {
  localSearch.value = value;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('update:searchValue', localSearch.value);
  }, 250);
};
const exitBulkMode = () => {
  emit('update:bulkMode', false);
};
</script>
<template>
  <!-- Collapsed mobile affordance: a trigger that opens a Drawer -->
  <button
    v-if="collapsed"
    type="button"
    class="page-toolbar__trigger"
    :aria-expanded="drawerOpen"
    @click="drawerOpen = true"
  >
    <SlidersHorizontal class="page-toolbar__trigger-icon" />
    <span class="page-toolbar__trigger-label">{{ collapseLabel }}</span>
  </button>
  <Drawer
    v-if="collapseOnMobile"
    :model-value="collapsed && drawerOpen"
    direction="btt"
    size="auto"
    :with-header="true"
    :title="collapseLabel"
    @update:model-value="(v: boolean) => (drawerOpen = v)"
  >
    <div class="page-toolbar page-toolbar--drawer" :class="{ 'is-bulk': bulkMode }">
      <!-- Leading: search (kept available in bulk mode for filtering) -->
      <div v-if="showSearch" class="page-toolbar__search shrink-0">
        <Input
          :model-value="localSearch"
          :placeholder="searchPlaceholder"
          :icon="Search"
          icon-position="left"
          :clearable="true"
          :glass="false"
          input-class="py-2 pl-9 pr-9 text-sm h-9"
          @update:model-value="onSearchInput"
        />
      </div>
      <div v-if="!bulkMode && $slots.filters" class="page-toolbar__filters">
        <slot name="filters" />
      </div>
      <div v-if="!bulkMode && $slots['view-switch']" class="page-toolbar__view shrink-0">
        <slot name="view-switch" />
      </div>
      <div v-if="!bulkMode && $slots.actions" class="page-toolbar__actions shrink-0">
        <slot name="actions" />
      </div>
      <div v-if="bulkMode && $slots['bulk-actions']" class="page-toolbar__bulk shrink-0">
        <slot name="bulk-actions" />
      </div>
      <button
        v-if="bulkMode && !$slots['bulk-actions']"
        type="button"
        class="page-toolbar__exit shrink-0"
        @click="exitBulkMode"
      >
        Cancel
      </button>
    </div>
  </Drawer>
  <!-- Default inline toolbar (desktop, or mobile when not collapsed) -->
  <section v-if="!collapsed" class="page-toolbar" :class="{ 'is-bulk': bulkMode }">
    <!-- Leading: search (kept available in bulk mode for filtering) -->
    <div v-if="showSearch" class="page-toolbar__search shrink-0">
      <Input
        :model-value="localSearch"
        :placeholder="searchPlaceholder"
        :icon="Search"
        icon-position="left"
        :clearable="true"
        :glass="false"
        input-class="py-2 pl-9 pr-9 text-sm h-9"
        @update:model-value="onSearchInput"
      />
    </div>
    <!-- Filters slot (hidden in bulk mode) -->
    <div v-if="!bulkMode && $slots.filters" class="page-toolbar__filters">
      <slot name="filters" />
    </div>
    <!-- View switch slot (hidden in bulk mode) -->
    <div v-if="!bulkMode && $slots['view-switch']" class="page-toolbar__view shrink-0">
      <slot name="view-switch" />
    </div>
    <!-- Primary actions slot (hidden in bulk mode) -->
    <div v-if="!bulkMode && $slots.actions" class="page-toolbar__actions shrink-0">
      <slot name="actions" />
    </div>
    <!-- Bulk actions slot (shown only in bulk mode) -->
    <div v-if="bulkMode && $slots['bulk-actions']" class="page-toolbar__bulk shrink-0">
      <slot name="bulk-actions" />
    </div>
    <!-- Default exit affordance when in bulk mode without a custom bulk-actions slot -->
    <button
      v-if="bulkMode && !$slots['bulk-actions']"
      type="button"
      class="page-toolbar__exit shrink-0"
      @click="exitBulkMode"
    >
      Cancel
    </button>
  </section>
</template>
<style scoped>
/* Solid (non-glass) surface: a toolbar is page chrome, not nav/overlay/3D. All spacing/radius/colors come from CSS variables. */
.page-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--surface-solid-border);
  border-radius: var(--radius-lg);
  background-color: var(--surface-solid);
  color: var(--text-on-solid-primary);
  flex-wrap: wrap;
  min-height: 48px;
}
.page-toolbar--drawer {
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-3);
  padding: var(--space-4);
  border: none;
  background: transparent;
}
.page-toolbar__search {
  width: 240px;
  max-width: 32vw;
}
.page-toolbar__filters {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}
.page-toolbar__actions,
.page-toolbar__bulk,
.page-toolbar__view {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.page-toolbar__exit {
  height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-solid-border);
  background: transparent;
  color: var(--text-on-solid-secondary);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.page-toolbar__exit:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
  color: var(--text-on-solid-primary);
} /* Mobile collapsed trigger button */
.page-toolbar__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  height: 40px;
  padding: 0 var(--space-4);
  border: 1px solid var(--surface-solid-border);
  border-radius: var(--radius-lg);
  background-color: var(--surface-solid);
  color: var(--text-on-solid-secondary);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}
.page-toolbar__trigger:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
  color: var(--text-on-solid-primary);
}
.page-toolbar__trigger-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.page-toolbar__trigger-label {
  white-space: nowrap;
} /* Mobile: toolbar wraps by default. When not collapsed, keep children legible without horizontal scrolling. */
@media (max-width: 768px) {
  .page-toolbar__search {
    width: 100%;
    max-width: none;
    flex-basis: 100%;
  }
  .page-toolbar__filters,
  .page-toolbar__actions,
  .page-toolbar__bulk,
  .page-toolbar__view {
    flex-shrink: 0;
  }
}
</style>
