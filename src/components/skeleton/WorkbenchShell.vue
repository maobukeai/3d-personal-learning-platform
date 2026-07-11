<script setup lang="ts">
import { computed, ref, useSlots, type Component } from 'vue';
import { PanelRightClose, PanelRightOpen, Menu } from 'lucide-vue-next';
import Drawer from '@/components/ui/Drawer.vue';
import { useMobile } from '@/composables/useMobile';
interface WorkbenchNavItem {
  id: string;
  label: string;
  icon?: Component;
  badge?: string | number;
  disabled?: boolean;
}
const props = withDefaults(
  defineProps<{
    /** Left navigation items */ navItems: WorkbenchNavItem[];
    /** Active nav item id */ activeNav?: string;
    /** Show right inspector panel (v-model:showInspector) */ showInspector?: boolean;
    /** Inspector title */ inspectorTitle?: string;
    /** Collapsible inspector (default true) */ inspectorCollapsible?: boolean;
    /** Inspector default open (default true on desktop, false on mobile) */ inspectorDefaultOpen?: boolean;
    /** Nav panel width (default 240px) */ navWidth?: string;
    /** Inspector width (default 320px) */ inspectorWidth?: string;
  }>(),
  {
    activeNav: undefined,
    showInspector: undefined,
    inspectorTitle: '',
    inspectorCollapsible: true,
    inspectorDefaultOpen: undefined,
    navWidth: '240px',
    inspectorWidth: '320px',
  },
);
const emit = defineEmits<{
  (e: 'update:activeNav', value: string): void;
  (e: 'update:showInspector', value: boolean): void;
}>();
const slots =
  useSlots(); /* ------------------------------------------------------------------ * * Responsive breakpoints * useMobile covers a single threshold, so we invoke it for both the * mobile (768) and desktop (1024) splits. * ------------------------------------------------------------------ */
const { isMobile } = useMobile(768);
const { isMobile: isBelowDesktop } = useMobile(1024);
const isDesktop = computed(
  () => !isBelowDesktop.value,
); /* ------------------------------------------------------------------ * * Inspector open state — controlled by `showInspector` with an * uncontrolled fallback defaulting to open on desktop, closed elsewhere. * ------------------------------------------------------------------ */
const uncontrolledOpen = ref<boolean>(props.inspectorDefaultOpen ?? isDesktop.value);
const inspectorOpen = computed<boolean>({
  get: () => props.showInspector ?? uncontrolledOpen.value,
  set: (v) => {
    uncontrolledOpen.value = v;
    emit('update:showInspector', v);
  },
});
const setInspectorOpen = (v: boolean) => {
  inspectorOpen.value = v;
};
const toggleInspector = () => {
  if (!props.inspectorCollapsible) return;
  setInspectorOpen(!inspectorOpen.value);
}; // When the inspector is non-collapsible, prevent the mobile drawer from
// being dismissed via overlay / escape / X.
const guardInspectorClose = (done: () => void) => {
  if (props.inspectorCollapsible) done();
}; /* ------------------------------------------------------------------ * * Mobile navigation drawer * ------------------------------------------------------------------ */
const mobileNavOpen =
  ref(
    false,
  ); /* ------------------------------------------------------------------ * * Nav interaction * ------------------------------------------------------------------ */
const navRef = ref<HTMLElement | null>(null);
const isActive = (item: WorkbenchNavItem) => item.id === props.activeNav;
const selectNav = (item: WorkbenchNavItem) => {
  if (item.disabled) return;
  emit('update:activeNav', item.id);
  if (isMobile.value) mobileNavOpen.value = false;
};
const getNavButtons = (): HTMLButtonElement[] => {
  const nav = navRef.value;
  if (!nav) return [];
  return Array.from(nav.querySelectorAll<HTMLButtonElement>('[data-nav-item]:not([disabled])'));
}; // Roving-tabindex keyboard navigation: arrows / Home / End move focus.
// Enter / Space are handled natively by <button> → click → selectNav.
const onNavKeydown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null;
  if (!target || !target.dataset.navItem) return;
  const btns = getNavButtons();
  const idx = btns.indexOf(target as HTMLButtonElement);
  if (idx === -1) return;
  let targetBtn: HTMLButtonElement | undefined;
  switch (e.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      e.preventDefault();
      targetBtn = btns[(idx + 1) % btns.length];
      break;
    case 'ArrowUp':
    case 'ArrowLeft':
      e.preventDefault();
      targetBtn = btns[(idx - 1 + btns.length) % btns.length];
      break;
    case 'Home':
      e.preventDefault();
      targetBtn = btns[0];
      break;
    case 'End':
      e.preventDefault();
      targetBtn = btns[btns.length - 1];
      break;
    default:
      return;
  }
  targetBtn?.focus();
}; /* ------------------------------------------------------------------ * * Derived layout flags * ------------------------------------------------------------------ */
const navStyle = computed(() => ({ width: props.navWidth }));
const inspectorStyle = computed(() => ({ width: props.inspectorWidth })); // Inline (desktop) inspector is visible only on desktop when open.
const inlineInspectorVisible = computed(() => isDesktop.value && inspectorOpen.value); // The "open inspector" affordance is needed whenever the inline panel
// is not showing (desktop-collapsed, tablet, mobile).
const needsInspectorToggle = computed(
  () => props.inspectorCollapsible && !inlineInspectorVisible.value,
); // Top chrome row hosts the mobile menu button, the toolbar slot, and the
// inspector toggle. Rendered whenever any of those is required.
const showChromeRow = computed(
  () => isMobile.value || !!slots.toolbar || needsInspectorToggle.value,
);
</script>
<template>
  <div class="workbench-layout">
    <!-- ============ Left navigation (desktop / tablet, inline) ============ -->
    <nav
      v-if="!isMobile"
      ref="navRef"
      class="workbench-nav"
      aria-label="Workbench navigation"
      :style="navStyle"
      @keydown="onNavKeydown"
    >
      <div v-if="slots['nav-header']" class="workbench-nav__header"><slot name="nav-header" /></div>
      <div class="workbench-nav__list">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          :data-nav-item="item.id"
          class="workbench-nav__item"
          :class="{ 'is-active': isActive(item), 'is-disabled': item.disabled }"
          :disabled="item.disabled"
          :aria-current="isActive(item) ? 'page' : undefined"
          :tabindex="isActive(item) ? 0 : -1"
          @click="selectNav(item)"
        >
          <component
            :is="item.icon"
            v-if="item.icon"
            class="workbench-nav__icon"
            aria-hidden="true"
          />
          <span class="workbench-nav__label">{{ item.label }}</span>
          <span v-if="item.badge !== undefined" class="workbench-nav__badge">
            {{ item.badge }}
          </span>
        </button>
      </div>
      <div v-if="slots['nav-footer']" class="workbench-nav__footer"><slot name="nav-footer" /></div>
    </nav>
    <!-- ============ Main area ============ -->
    <div class="workbench-main">
      <div v-if="showChromeRow" class="workbench-chrome">
        <button
          v-if="isMobile"
          type="button"
          class="workbench-icon-btn"
          aria-label="Open navigation"
          :aria-expanded="mobileNavOpen"
          @click="mobileNavOpen = true"
        >
          <Menu />
        </button>
        <div class="workbench-chrome__toolbar"><slot name="toolbar" /></div>
        <button
          v-if="needsInspectorToggle"
          type="button"
          class="workbench-icon-btn"
          aria-label="Open inspector"
          :aria-expanded="inspectorOpen"
          @click="setInspectorOpen(true)"
        >
          <PanelRightOpen />
        </button>
      </div>
      <div class="workbench-content"><slot /></div>
    </div>
    <!-- ============ Right inspector (desktop, inline) ============ -->
    <aside
      v-if="inlineInspectorVisible"
      class="workbench-inspector"
      aria-label="Inspector"
      :style="inspectorStyle"
    >
      <div class="workbench-inspector__header">
        <h2 class="workbench-inspector__title">{{ inspectorTitle || 'Inspector' }}</h2>
        <button
          v-if="inspectorCollapsible"
          type="button"
          class="workbench-icon-btn"
          aria-label="Collapse inspector"
          @click="toggleInspector"
        >
          <PanelRightClose />
        </button>
      </div>
      <div class="workbench-inspector__body"><slot name="inspector" /></div>
    </aside>
    <!-- ============ Right inspector (tablet / mobile, overlay drawer) ============ -->
    <Drawer
      v-if="!isDesktop"
      :model-value="inspectorOpen"
      direction="rtl"
      :size="isMobile ? '100%' : inspectorWidth"
      :with-header="true"
      :title="inspectorTitle || 'Inspector'"
      :before-close="guardInspectorClose"
      @update:model-value="setInspectorOpen"
    >
      <slot name="inspector" />
    </Drawer>
    <!-- ============ Left navigation (mobile, overlay drawer) ============ -->
    <Drawer
      v-if="isMobile"
      :model-value="mobileNavOpen"
      direction="ltr"
      :size="navWidth"
      :with-header="true"
      title="Navigation"
      @update:model-value="mobileNavOpen = $event"
    >
      <nav
        ref="navRef"
        class="workbench-nav workbench-nav--drawer"
        aria-label="Workbench navigation"
        @keydown="onNavKeydown"
      >
        <div v-if="slots['nav-header']" class="workbench-nav__header">
          <slot name="nav-header" />
        </div>
        <div class="workbench-nav__list">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            :data-nav-item="item.id"
            class="workbench-nav__item"
            :class="{ 'is-active': isActive(item), 'is-disabled': item.disabled }"
            :disabled="item.disabled"
            :aria-current="isActive(item) ? 'page' : undefined"
            :tabindex="isActive(item) ? 0 : -1"
            @click="selectNav(item)"
          >
            <component
              :is="item.icon"
              v-if="item.icon"
              class="workbench-nav__icon"
              aria-hidden="true"
            />
            <span class="workbench-nav__label">{{ item.label }}</span>
            <span v-if="item.badge !== undefined" class="workbench-nav__badge">
              {{ item.badge }}
            </span>
          </button>
        </div>
        <div v-if="slots['nav-footer']" class="workbench-nav__footer">
          <slot name="nav-footer" />
        </div>
      </nav>
    </Drawer>
  </div>
</template>
<style scoped>
.workbench-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-app);
} /* ---------------- Left navigation ---------------- */
.workbench-nav {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-base);
  overflow: hidden;
}
.workbench-nav--drawer {
  width: 100%;
  height: auto;
  min-height: 100%;
  border-right: none;
  background: transparent;
}
.workbench-nav__header {
  flex-shrink: 0;
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-base);
}
.workbench-nav__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-height: 0;
  padding: var(--space-2);
  overflow-y: auto;
}
.workbench-nav__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
}
.workbench-nav__item:hover:not(.is-disabled):not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.workbench-nav__item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.workbench-nav__item.is-active {
  background: var(--bg-active);
  color: var(--text-primary);
  font-weight: 600;
}
.workbench-nav__item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: var(--space-1);
  bottom: var(--space-1);
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
}
.workbench-nav__item.is-disabled,
.workbench-nav__item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.workbench-nav__icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: currentColor;
}
.workbench-nav__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.workbench-nav__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 var(--space-1);
  flex-shrink: 0;
  border-radius: 9999px;
  background: var(--accent-subtle);
  color: var(--accent);
  font-size: var(--text-xs);
  font-weight: 600;
  line-height: 1;
}
.workbench-nav__footer {
  flex-shrink: 0;
  padding: var(--space-2);
  border-top: 1px solid var(--border-base);
} /* ---------------- Main area ---------------- */
.workbench-main {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}
.workbench-chrome {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 48px;
  flex-shrink: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-base);
}
.workbench-chrome__toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}
.workbench-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
} /* ---------------- Shared icon button ---------------- */
.workbench-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard);
}
.workbench-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.workbench-icon-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.workbench-icon-btn :deep(svg) {
  width: 18px;
  height: 18px;
} /* ---------------- Right inspector (inline) ---------------- */
.workbench-inspector {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
  background: var(--bg-card);
  border-left: 1px solid var(--border-base);
  overflow: hidden;
}
.workbench-inspector__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-shrink: 0;
  padding: var(--space-3);
  border-bottom: 1px solid var(--border-base);
}
.workbench-inspector__title {
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
}
.workbench-inspector__body {
  flex: 1;
  min-height: 0;
  padding: var(--space-3);
  overflow-y: auto;
}
</style>
