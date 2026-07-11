<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Component } from 'vue';
import { X, ChevronRight } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Drawer from '@/components/ui/Drawer.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import { useMobile } from '@/composables/useMobile';
import { cn } from '@/utils/cn'; /** * ResourceDetailShell — unified detail surface for asset / material / plugin * detail views. Consolidates the verbatim header + tabs + content + comments * structure previously triplicated across AssetDetailModal, MaterialDetailPanel * and UnifiedDetailModal. * * Variants: * - `modal` : wraps <Modal> (radix Dialog, ~80vw via size="xxl") * - `drawer` : wraps <Drawer> (right side, 50vw desktop / full mobile) * - `page` : renders inline (no chrome) * * Escape closes modal/drawer via the underlying radix Dialog primitives. * * Provided slots (all optional; prop-driven defaults are used when a slot is * absent so existing consumers keep working unchanged): * - `header` : replaces the entire header block when provided * - `title` : overrides the prop-driven title text * - `metadata` : overrides the prop-driven metadata grid * - `actions` : header action buttons (scoped slot: emit-action) * - `share` : share affordance rendered alongside header actions * - `preview` : preview / media block rendered at the top of the body * - `activity` : activity / history feed rendered after the main content * - default : main tab-agnostic content * - `tab-{id}` : per-tab panel content * - `sidebar` : sticky right-rail content * - `comments` : discussion section rendered at the bottom */
interface TabItem {
  id: string;
  label: string;
  icon?: Component;
}
interface MetadataItem {
  label: string;
  value: string;
}
type StatusType = 'success' | 'warning' | 'danger' | 'info';
type Variant = 'modal' | 'drawer' | 'page';
interface Props {
  title: string;
  subtitle?: string;
  image?: string;
  /** Optional lucide icon component rendered before the title block. */ icon?: Component;
  status?: string;
  statusType?: StatusType;
  metadata?: MetadataItem[];
  tabs?: TabItem[];
  activeTab?: string;
  loading?: boolean;
  variant?: Variant;
  /** When false, the modal chrome uses a solid Card instead of GlassCard. */ glass?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  subtitle: '',
  image: '',
  icon: undefined,
  status: '',
  statusType: 'info',
  metadata: () => [],
  tabs: () => [],
  activeTab: '',
  loading: false,
  variant: 'modal',
  glass: true,
});
const emit = defineEmits<{
  (e: 'update:activeTab', value: string): void;
  (e: 'action', payload: { type: string; [key: string]: unknown }): void;
  (e: 'close'): void;
}>();
const { isMobile } = useMobile();
const tabsList = computed(() => props.tabs ?? []);
const currentTab = computed(() => {
  if (props.activeTab) return props.activeTab;
  return tabsList.value.length ? tabsList.value[0].id : '';
});
const drawerSize = computed(() => (isMobile.value ? '100%' : '50vw'));
const statusColorVar = computed(() => {
  switch (props.statusType) {
    case 'success':
      return 'var(--success)';
    case 'warning':
      return 'var(--warning)';
    case 'danger':
      return 'var(--danger)';
    case 'info':
    default:
      return 'var(--info)';
  }
});
const sidebarOpen = ref(false);
const showSidebar = computed(() => !isMobile.value || sidebarOpen.value);
const wrapperComponent = computed<Component | string>(() => {
  if (props.variant === 'modal') return Modal;
  if (props.variant === 'drawer') return Drawer;
  return 'div';
});
const wrapperBindings = computed<Record<string, unknown>>(() => {
  if (props.variant === 'modal') {
    return {
      show: true,
      size: 'xxl',
      padding: 'md',
      variant: props.glass ? 'glass' : 'solid',
      closeOnEscape: true,
      closeOnOutsideClick: true,
      onClose: handleClose,
    };
  }
  if (props.variant === 'drawer') {
    return {
      modelValue: true,
      direction: 'rtl',
      size: drawerSize.value,
      withHeader: false,
      'onUpdate:modelValue': handleClose,
    };
  }
  return {};
});
function handleClose() {
  emit('close');
}
function selectTab(tabId: string) {
  emit('update:activeTab', tabId);
}
function emitAction(type: string, payload: Record<string, unknown> = {}) {
  emit('action', { type, ...payload });
}
</script>
<template>
  <component :is="wrapperComponent" v-bind="wrapperBindings">
    <div :class="cn('shell-root', `shell-${props.variant}`)">
      <!-- Loading skeleton -->
      <div v-if="props.loading" class="shell-loading">
        <div class="shell-header shell-header--loading">
          <Skeleton width="64px" height="64px" circle />
          <div class="shell-loading-titles">
            <Skeleton width="42%" height="1.5rem" /> <Skeleton width="64%" height="0.875rem" />
          </div>
        </div>
        <div class="shell-loading-meta">
          <Skeleton v-for="i in 4" :key="i" width="100%" height="2.75rem" />
        </div>
        <div class="shell-loading-content">
          <Skeleton width="100%" height="1rem" /> <Skeleton width="92%" height="1rem" />
          <Skeleton width="78%" height="1rem" /> <Skeleton width="100%" height="8rem" />
        </div>
      </div>
      <!-- Content -->
      <template v-else>
        <!-- Header -->
        <header v-if="$slots.header" class="shell-header">
          <slot name="header" :close="handleClose" :emit-action="emitAction" />
        </header>
        <header v-else class="shell-header">
          <div class="shell-header-main">
            <div class="shell-title-row">
              <img v-if="props.image" :src="props.image" :alt="props.title" class="shell-image" />
              <component :is="props.icon" v-else-if="props.icon" class="shell-header-icon" />
              <div class="shell-title-block">
                <div class="shell-title-line">
                  <h2 class="shell-title">
                    <slot name="title">{{ props.title }}</slot>
                  </h2>
                  <span
                    v-if="props.status"
                    class="shell-status-badge"
                    :style="{ '--status-color': statusColorVar }"
                  >
                    <span class="shell-status-dot"></span> {{ props.status }}
                  </span>
                </div>
                <p v-if="props.subtitle" class="shell-subtitle">{{ props.subtitle }}</p>
              </div>
            </div>
            <div class="shell-header-actions">
              <slot name="share" /> <slot name="actions" :emit-action="emitAction" />
              <button
                v-if="props.variant !== 'page'"
                type="button"
                class="shell-close-btn"
                aria-label="Close"
                @click="handleClose"
              >
                <X class="shell-icon" />
              </button>
            </div>
          </div>
          <dl v-if="$slots.metadata" class="shell-metadata"><slot name="metadata" /></dl>
          <dl v-else-if="props.metadata.length" class="shell-metadata">
            <div v-for="item in props.metadata" :key="item.label" class="shell-metadata-item">
              <dt class="shell-metadata-label">{{ item.label }}</dt>
              <dd class="shell-metadata-value">{{ item.value }}</dd>
            </div>
          </dl>
        </header>
        <!-- Tabs -->
        <nav v-if="tabsList.length" class="shell-tabs">
          <button
            v-for="tab in tabsList"
            :key="tab.id"
            type="button"
            :class="cn('shell-tab', { 'shell-tab--active': tab.id === currentTab })"
            @click="selectTab(tab.id)"
          >
            <component :is="tab.icon" v-if="tab.icon" class="shell-tab-icon" />
            <span>{{ tab.label }}</span>
          </button>
        </nav>
        <!-- Body -->
        <div class="shell-body" :class="{ 'shell-body--with-sidebar': $slots.sidebar }">
          <div class="shell-content">
            <slot name="preview" /> <slot />
            <template v-for="tab in tabsList" :key="tab.id">
              <div v-if="currentTab === tab.id" class="shell-tab-panel">
                <slot :name="`tab-${tab.id}`" />
              </div>
            </template>
            <section v-if="$slots.activity" class="shell-activity">
              <slot name="activity" />
            </section>
          </div>
          <aside v-if="$slots.sidebar" class="shell-sidebar" :data-open="showSidebar">
            <slot name="sidebar" />
          </aside>
        </div>
        <!-- Mobile sidebar toggle -->
        <button
          v-if="$slots.sidebar && isMobile"
          type="button"
          class="shell-sidebar-toggle"
          @click="sidebarOpen = !sidebarOpen"
        >
          <ChevronRight class="shell-icon" :class="{ 'shell-icon--flip': sidebarOpen }" />
          <span>{{ sidebarOpen ? 'Hide Details' : 'Show Details' }}</span>
        </button>
        <!-- Comments -->
        <section v-if="$slots.comments" class="shell-comments"><slot name="comments" /></section>
      </template>
    </div>
  </component>
</template>
<style scoped>
.shell-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: var(--space-4);
  color: var(--text-primary);
  font-family: inherit;
}
.shell-drawer {
  padding: var(--space-5);
}
.shell-page {
  padding: 0;
} /* ---------- Header ---------- */
.shell-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-base);
}
.shell-header-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.shell-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  flex: 1;
}
.shell-image {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--bg-hover);
}
.shell-header-icon {
  width: 20px;
  height: 20px;
  color: var(--accent, #6366f1);
  flex-shrink: 0;
}
.shell-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.shell-title-line {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.shell-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.shell-subtitle {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.4;
  color: var(--text-secondary);
}
.shell-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--status-color);
  background: color-mix(in srgb, var(--status-color) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--status-color) 24%, transparent);
}
.shell-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--status-color);
}
.shell-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
.shell-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}
.shell-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.shell-icon {
  width: 18px;
  height: 18px;
}
.shell-metadata {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
  margin: 0;
}
.shell-metadata-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3);
  border-radius: 10px;
  background: var(--bg-hover);
}
.shell-metadata-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
.shell-metadata-value {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  word-break: break-word;
} /* ---------- Tabs ---------- */
.shell-tabs {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border-base);
  overflow-x: auto;
}
.shell-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition:
    color 0.2s ease,
    background 0.2s ease;
}
.shell-tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.shell-tab--active {
  color: var(--text-primary);
}
.shell-tab--active::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
}
.shell-tab-icon {
  width: 15px;
  height: 15px;
} /* ---------- Body ---------- */
.shell-body {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-5);
}
@media (min-width: 768px) {
  .shell-body--with-sidebar {
    grid-template-columns: minmax(0, 1fr) 300px;
  }
}
.shell-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}
.shell-tab-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.shell-sidebar {
  min-width: 0;
}
@media (max-width: 767px) {
  .shell-sidebar[data-open='false'] {
    display: none;
  }
}
.shell-sidebar-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 8px 14px;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-card);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}
.shell-sidebar-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.shell-icon--flip {
  transform: rotate(180deg);
}
.shell-comments {
  padding-top: var(--space-5);
  border-top: 1px solid var(--border-base);
}
.shell-activity {
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-base);
} /* ---------- Loading ---------- */
.shell-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.shell-header--loading {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-base);
}
.shell-loading-titles {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}
.shell-loading-meta {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}
.shell-loading-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
