<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import {
  Box,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  HelpCircle,
  MonitorPlay,
  PanelLeftClose,
  Settings,
  ShieldCheck,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { preferences, type SidebarMode } from '@/utils/preferences';
import type { SidebarMenuGroup, SidebarMenuItem } from '../composables/useSidebarMenus';
import { useSidebarPreferences } from '../composables/useSidebarPreferences';

interface PreparedSidebarItem extends SidebarMenuItem {
  tooltip: string;
}

interface PreparedSidebarGroup {
  key: string;
  title: string;
  items: PreparedSidebarItem[];
}

const props = defineProps<{
  menuGroups: SidebarMenuGroup[];
}>();

const emit = defineEmits<{
  (e: 'report-bug'): void;
}>();

const route = useRoute();
const { locale } = useI18n();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

const getInitialMode = (): SidebarMode => {
  if (preferences.hasSidebarMode()) return preferences.getSidebarMode();
  return route.path.startsWith('/admin') ? 'rail' : 'expanded';
};

const {
  sidebarMode,
  expandedGroupKeys,
  cloudPreferenceLoaded,
  isSavingPreference,
  setSidebarMode,
  syncAvailableGroupKeys,
  toggleGroupKey,
  expandGroupKey,
} = useSidebarPreferences({
  initialMode: getInitialMode(),
  isAuthenticated: computed(() => authStore.isAuthenticated),
});

const label = (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);

const quickLinks = computed(() => [
  {
    path: '/showcase',
    icon: MonitorPlay,
    labelKey: 'sidebar.showcase',
    hint: label('灵感展厅', 'Inspiration'),
  },
  {
    path: '/my-works',
    icon: Box,
    labelKey: 'sidebar.myWorks',
    hint: label('创作档案', 'Portfolio'),
  },
]);

const isExpanded = computed(() => sidebarMode.value === 'expanded');
const isAdmin = computed(() => workspaceStore.isAdminWorkspace);
const isResourceWorkspace = computed(
  () =>
    workspaceStore.currentWorkspace?.type === 'mirror' ||
    workspaceStore.currentWorkspace?.type === 'manual',
);

const navTone = computed(() => {
  if (isAdmin.value) return 'admin';
  if (isResourceWorkspace.value) return 'resource';
  return 'workspace';
});

const sidebarTitle = computed(() => {
  if (workspaceStore.currentWorkspace?.name) return workspaceStore.currentWorkspace.name;
  return isAdmin.value ? label('管理工作区', 'Admin') : label('工作区', 'Workspace');
});

const sidebarSubtitle = computed(() => {
  if (isAdmin.value) return label('控制中枢', 'Control center');
  if (isResourceWorkspace.value) return label('资源导航', 'Resource navigator');
  return label('学习工作台', 'Learning workspace');
});

const settingsPath = computed(() => (isAdmin.value ? '/admin/settings' : '/settings'));

const settingStateLabel = computed(() => {
  if (isSavingPreference.value) return label('保存中', 'Saving');
  if (!authStore.isAuthenticated) return label('本地模式', 'Local');
  return cloudPreferenceLoaded.value ? label('已同步', 'Synced') : label('本地优先', 'Local first');
});

const settingStateCaption = computed(() => label('偏好状态', 'Preferences'));

const collapseNavigationLabel = computed(() => label('收起导航', 'Collapse navigation'));
const expandNavigationLabel = computed(() => label('展开导航', 'Expand navigation'));

const panelScopeLabel = computed(() => {
  if (isAdmin.value) return label('模块', 'modules');
  if (isResourceWorkspace.value) return label('资源组', 'sets');
  return label('分区', 'sections');
});

const getGroupKey = (group: SidebarMenuGroup, index: number) => `${index}:${group.title || 'main'}`;

const preparedGroups = computed<PreparedSidebarGroup[]>(() =>
  props.menuGroups
    .map((group, index) => {
      const items = isAdmin.value
        ? group.items.filter((item) => item.path !== '/admin/settings')
        : group.items;

      return {
        key: getGroupKey(group, index),
        title: group.title,
        items: items.map((item) => ({
          ...item,
          tooltip: item.name,
        })),
      };
    })
    .filter((group) => group.items.length > 0),
);

const showQuickLinks = computed(
  () =>
    !isAdmin.value &&
    !isResourceWorkspace.value &&
    workspaceStore.currentWorkspace?.type !== 'manual',
);

const isRouteActive = (path: string) => {
  const [basePath, query] = path.split('?');
  if (query) return route.fullPath === path;
  return route.path === basePath || route.path.startsWith(`${basePath}/`);
};

const isGroupActive = (group: PreparedSidebarGroup) =>
  group.items.some((item) => isRouteActive(item.path));

const isGroupOpen = (group: PreparedSidebarGroup) =>
  expandedGroupKeys.value.has(group.key);

const resourceGroupPaths = new Set([
  '/resources',
  '/my-works',
  '/assets',
  '/materials',
  '/plugins',
]);

const isResourceGroup = (group: PreparedSidebarGroup) =>
  !isAdmin.value && group.items.some((item) => resourceGroupPaths.has(item.path));

const toggleSidebar = () => {
  setSidebarMode(isExpanded.value ? 'rail' : 'expanded');
};

const toggleGroup = (group: PreparedSidebarGroup) => {
  toggleGroupKey(group.key);
};

watch(
  preparedGroups,
  (groups) => {
    syncAvailableGroupKeys(groups.map((group) => group.key));
  },
  { immediate: true },
);

watch(
  [() => route.path, preparedGroups],
  () => {
    preparedGroups.value.forEach((group) => {
      if (isGroupActive(group)) {
        expandGroupKey(group.key);
      }
    });
  },
  { immediate: true },
);
</script>

<template>
  <aside
    class="workspace-sidebar hidden lg:flex h-full shrink-0 glass-sidebar"
    :class="[
      `workspace-sidebar--${navTone}`,
      isExpanded ? 'workspace-sidebar--expanded' : 'workspace-sidebar--rail',
    ]"
  >
    <div class="workspace-sidebar__rail">
      <div class="rail-top">
        <el-tooltip
          :content="sidebarTitle"
          placement="right"
          :show-after="120"
          popper-class="sidebar-tooltip"
        >
          <div class="rail-badge" :class="{ 'rail-badge--admin': isAdmin }">
            <ShieldCheck v-if="isAdmin" />
            <Box v-else />
          </div>
        </el-tooltip>
      </div>

      <nav class="rail-nav scrollbar-hide" aria-label="Primary">
        <div v-for="(group, groupIndex) in preparedGroups" :key="group.key" class="rail-group">
          <div v-if="groupIndex > 0" class="rail-divider"></div>
          <ul class="rail-list">
            <li v-for="item in group.items" :key="item.path">
              <el-tooltip
                :content="item.tooltip"
                placement="right"
                :show-after="120"
                popper-class="sidebar-tooltip"
              >
                <RouterLink
                  :to="item.path"
                  class="rail-link"
                  :class="{ 'rail-link--active': isRouteActive(item.path) }"
                  :aria-label="item.tooltip"
                  :title="item.tooltip"
                >
                  <span v-if="isRouteActive(item.path)" class="rail-active-bar"></span>
                  <component :is="item.icon" class="rail-icon" />
                  <span v-if="item.badge && item.badge > 0" class="rail-badge-count">
                    {{ item.badge > 99 ? '99+' : item.badge }}
                  </span>
                </RouterLink>
              </el-tooltip>
            </li>
          </ul>
        </div>
      </nav>

      <div class="rail-actions">
        <el-tooltip
          :content="isExpanded ? collapseNavigationLabel : expandNavigationLabel"
          placement="right"
          :show-after="120"
          popper-class="sidebar-tooltip"
        >
          <button
            type="button"
            class="rail-link rail-action-button rail-toggle"
            :aria-label="isExpanded ? collapseNavigationLabel : expandNavigationLabel"
            :title="isExpanded ? collapseNavigationLabel : expandNavigationLabel"
            @click="toggleSidebar"
          >
            <ChevronsLeft v-if="isExpanded" class="rail-icon" />
            <ChevronsRight v-else class="rail-icon" />
          </button>
        </el-tooltip>

        <el-tooltip
          :content="$t('sidebar.settingsOption')"
          placement="right"
          :show-after="120"
          popper-class="sidebar-tooltip"
        >
          <RouterLink
            :to="settingsPath"
            class="rail-link"
            :class="{ 'rail-link--active': isRouteActive(settingsPath) }"
            :aria-label="$t('sidebar.settingsOption')"
            :title="$t('sidebar.settingsOption')"
          >
            <Settings class="rail-icon" />
          </RouterLink>
        </el-tooltip>

        <el-tooltip
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
        </el-tooltip>

        <div class="rail-signature">
          {{ isAdmin ? 'ADMIN' : 'APP' }}
        </div>
      </div>
    </div>

    <Transition name="sidebar-panel">
      <section v-if="isExpanded" class="workspace-sidebar__panel" aria-label="Expanded navigation">
        <header class="panel-header">
          <div class="panel-hero-main">
            <div class="panel-mark" :class="{ 'panel-mark--admin': isAdmin }">
              <ShieldCheck v-if="isAdmin" />
              <Box v-else />
            </div>
            <div class="panel-title-block">
              <span class="panel-kicker">{{ sidebarSubtitle }}</span>
              <strong>{{ sidebarTitle }}</strong>
              <div class="panel-meta-row">
                <span class="panel-meta-chip"
                  >{{ preparedGroups.length }} {{ panelScopeLabel }}</span
                >
                <span class="panel-meta-chip panel-meta-chip--state">{{ settingStateLabel }}</span>
              </div>
            </div>
          </div>
          <el-tooltip
            :content="collapseNavigationLabel"
            placement="bottom"
            :show-after="120"
            popper-class="sidebar-tooltip"
          >
            <button
              type="button"
              class="panel-icon-button"
              :aria-label="collapseNavigationLabel"
              :title="collapseNavigationLabel"
              @click="setSidebarMode('rail')"
            >
              <PanelLeftClose />
            </button>
          </el-tooltip>
        </header>

        <div v-if="showQuickLinks" class="quick-zone">
          <p class="sidebar-section-label">{{ $t('sidebar.groups.quickNav') }}</p>
          <div class="quick-grid">
            <RouterLink
              v-for="quick in quickLinks"
              :key="quick.path"
              :to="quick.path"
              class="quick-tile"
              :class="{ 'quick-tile--active': isRouteActive(quick.path) }"
            >
              <span class="quick-tile__icon">
                <component :is="quick.icon" />
              </span>
              <span class="quick-tile__copy">
                <strong>{{ $t(quick.labelKey) }}</strong>
                <small>{{ quick.hint }}</small>
              </span>
            </RouterLink>
          </div>
        </div>

        <div class="panel-groups scrollbar-hide">
          <section v-for="group in preparedGroups" :key="group.key" class="panel-group">
            <button
              type="button"
              class="group-trigger"
              :class="{ 'group-trigger--active': isGroupActive(group) }"
              :aria-expanded="isGroupOpen(group)"
              @click="toggleGroup(group)"
            >
              <span class="group-trigger__title">{{ group.title }}</span>
              <span class="group-trigger__meta">
                <span class="group-count">{{ group.items.length }}</span>
                <ChevronDown :class="{ 'rotate-180': isGroupOpen(group) }" />
              </span>
            </button>

            <Transition name="group-list">
              <ul
                v-if="isGroupOpen(group)"
                class="panel-list"
                :class="{ 'panel-list--resource-grid': isResourceGroup(group) }"
              >
                <li v-for="item in group.items" :key="item.path">
                  <RouterLink
                    :to="item.path"
                    class="panel-link"
                    :class="{
                      'panel-link--active': isRouteActive(item.path),
                      'panel-link--resource': isResourceGroup(group),
                    }"
                  >
                    <span class="panel-link-icon-wrap">
                      <component :is="item.icon" class="panel-link-icon" />
                    </span>
                    <span class="panel-link-label">{{ item.name }}</span>
                    <strong v-if="item.badge && item.badge > 0" class="panel-badge">
                      {{ item.badge > 99 ? '99+' : item.badge }}
                    </strong>
                  </RouterLink>
                </li>
              </ul>
            </Transition>
          </section>
        </div>

        <footer class="panel-footer">
          <div class="sync-state">
            <i :class="{ 'sync-state__dot--saving': isSavingPreference }"></i>
            <span class="sync-state__copy">
              <strong>{{ settingStateLabel }}</strong>
              <small>{{ settingStateCaption }}</small>
            </span>
          </div>
          <RouterLink
            :to="settingsPath"
            class="footer-action"
            :class="{ 'footer-action--active': isRouteActive(settingsPath) }"
          >
            <Settings />
            <span>{{ $t('sidebar.settingsOption') }}</span>
          </RouterLink>
          <button type="button" class="footer-action" @click="emit('report-bug')">
            <HelpCircle />
            <span>{{ $t('sidebar.feedbackOption') }}</span>
          </button>
        </footer>
      </section>
    </Transition>
  </aside>
</template>

<style scoped>
.workspace-sidebar {
  --sidebar-accent: var(--accent);
  --sidebar-accent-rgb: var(--accent-rgb, 245, 121, 42);
  --sidebar-rail-width: 60px;
  --sidebar-panel-width: 232px;
  width: var(--sidebar-rail-width);
  overflow: hidden;
  border-right: 1px solid var(--border-base);
  background: var(--bg-sidebar);
  transition: width 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.workspace-sidebar--expanded {
  width: var(--sidebar-panel-width);
}

.workspace-sidebar--admin {
  --sidebar-accent: #e11d48;
  --sidebar-accent-rgb: 225, 29, 72;
}

.workspace-sidebar--resource {
  --sidebar-accent: #2563eb;
  --sidebar-accent-rgb: 37, 99, 235;
}

.workspace-sidebar__rail {
  width: var(--sidebar-rail-width);
  flex: 0 0 var(--sidebar-rail-width);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.workspace-sidebar--expanded .workspace-sidebar__rail {
  display: none;
}

.rail-top {
  padding: 10px 8px 8px;
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

.rail-badge svg,
.rail-icon,
.panel-mark svg,
.panel-icon-button svg,
.quick-tile svg,
.group-trigger svg,
.panel-link-icon,
.footer-action svg {
  width: 18px;
  height: 18px;
}

.rail-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 7px 8px;
}

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

.rail-link {
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

.rail-link:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--sidebar-accent) 8%, transparent);
}

.rail-link--active {
  color: #ffffff;
  background: var(--sidebar-accent);
  box-shadow: 0 10px 20px -16px rgba(var(--sidebar-accent-rgb), 0.8);
}

.rail-active-bar {
  position: absolute;
  left: -8px;
  top: 9px;
  bottom: 9px;
  width: 4px;
  border-radius: 0 999px 999px 0;
  background: var(--sidebar-accent);
}

.rail-link--active .rail-active-bar {
  background: var(--sidebar-accent);
}

.rail-badge-count {
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
}

.workspace-sidebar__panel {
  position: relative;
  width: var(--sidebar-panel-width);
  flex: 0 0 var(--sidebar-panel-width);
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--sidebar-accent) 5%, transparent),
      transparent 160px
    ),
    color-mix(in srgb, var(--bg-sidebar) 96%, transparent);
}

.workspace-sidebar__panel::before {
  position: absolute;
  inset: 0;
  content: '';
  pointer-events: none;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--sidebar-accent) 12%, transparent),
    transparent 34%
  );
  opacity: 0.65;
  mask-image: linear-gradient(180deg, #000 0, transparent 58%);
}

.workspace-sidebar__panel > * {
  position: relative;
  z-index: 1;
}

.workspace-sidebar--rail .workspace-sidebar__panel {
  display: none;
  pointer-events: none;
  visibility: hidden;
}

.panel-header {
  position: relative;
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 8px 8px 6px;
  padding: 8px 40px 8px 8px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--sidebar-accent) 25%, var(--border-base));
  border-radius: 8px;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--sidebar-accent) 15%, var(--bg-card)),
      color-mix(in srgb, var(--bg-card) 92%, transparent)
    ),
    var(--bg-card);
  box-shadow:
    0 12px 26px -24px rgba(var(--sidebar-accent-rgb), 0.72),
    inset 0 1px 0 color-mix(in srgb, #ffffff 64%, transparent);
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
  gap: 8px;
  padding-right: 0;
}

.panel-mark {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, #ffffff 42%, transparent);
  border-radius: 8px;
  color: #ffffff;
  background: linear-gradient(
    135deg,
    var(--sidebar-accent),
    color-mix(in srgb, var(--sidebar-accent) 64%, #111827)
  );
  box-shadow: 0 12px 24px -16px rgba(var(--sidebar-accent-rgb), 0.96);
}

.panel-mark--admin {
  background: linear-gradient(135deg, #e11d48, #7f1232);
}

.panel-title-block {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.panel-title-block strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-kicker,
.sidebar-section-label,
.sync-state {
  color: var(--text-muted);
  font-size: 10px;
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
  position: absolute;
  top: 10px;
  right: 8px;
  z-index: 2;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--sidebar-accent) 18%, var(--border-base));
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-card) 82%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    color 0.16s ease,
    background-color 0.16s ease,
    transform 0.16s ease;
}

.panel-icon-button:hover {
  border-color: color-mix(in srgb, var(--sidebar-accent) 40%, var(--border-base));
  color: var(--sidebar-accent);
  transform: translateY(-1px);
}

.quick-zone {
  padding: 0 8px 6px;
}

.sidebar-section-label {
  margin: 0 2px 5px;
  text-transform: uppercase;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.quick-tile {
  position: relative;
  isolation: isolate;
  min-width: 0;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--sidebar-accent) 12%, var(--border-base));
  border-radius: 8px;
  background: linear-gradient(
    145deg,
    color-mix(in srgb, var(--bg-card) 88%, transparent),
    color-mix(in srgb, var(--sidebar-accent) 7%, var(--bg-card))
  );
  color: var(--text-secondary);
  padding: 0 8px;
  text-align: left;
  transition:
    border-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease,
    box-shadow 0.16s ease;
}

.quick-tile::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  content: '';
  background: var(--sidebar-accent);
  opacity: 0.42;
}

.quick-tile__icon {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--sidebar-accent) 12%, transparent);
  color: var(--sidebar-accent);
}

.quick-tile__copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.quick-tile:hover,
.quick-tile--active {
  border-color: color-mix(in srgb, var(--sidebar-accent) 55%, var(--border-base));
  color: var(--sidebar-accent);
  box-shadow: 0 12px 26px -22px rgba(var(--sidebar-accent-rgb), 0.9);
  transform: translateY(-1px);
}

.quick-tile__copy strong,
.quick-tile__copy small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-tile__copy strong {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 900;
  line-height: 1.12;
}

.quick-tile__copy small {
  display: none;
}

.panel-groups {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 3px 8px 8px;
}

.panel-group + .panel-group {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--border-base) 48%, transparent);
}

.group-trigger {
  width: 100%;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0 6px 0 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  text-align: left;
  text-transform: uppercase;
}

.group-trigger:hover,
.group-trigger--active {
  border-color: color-mix(in srgb, var(--sidebar-accent) 14%, transparent);
  color: var(--sidebar-accent);
  background: color-mix(in srgb, var(--sidebar-accent) 7%, transparent);
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
  gap: 5px;
  flex: 0 0 auto;
}

.group-count {
  min-width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  padding: 0 5px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--sidebar-accent) 10%, transparent);
  color: color-mix(in srgb, var(--text-muted) 78%, var(--sidebar-accent));
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.group-trigger--active .group-count,
.group-trigger:hover .group-count {
  background: color-mix(in srgb, var(--sidebar-accent) 18%, transparent);
  color: var(--sidebar-accent);
}

.group-trigger svg {
  width: 14px;
  height: 14px;
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
  margin: 3px 0 0;
  padding: 0 0 0 6px;
  list-style: none;
}

.panel-list::before {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 2px;
  width: 2px;
  content: '';
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--sidebar-accent) 42%, transparent),
    color-mix(in srgb, var(--border-base) 42%, transparent)
  );
}

.panel-list--resource-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding-left: 0;
}

.panel-list--resource-grid::before {
  display: none;
}

.panel-list--resource-grid li:first-child {
  grid-column: 1 / -1;
}

.panel-link {
  position: relative;
  min-width: 0;
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 0 7px;
  color: var(--text-secondary);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.panel-link:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--sidebar-accent) 7%, transparent);
}

.panel-link--active {
  border-color: color-mix(in srgb, var(--sidebar-accent) 26%, var(--border-base));
  color: var(--text-primary);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--sidebar-accent) 14%, transparent),
    color-mix(in srgb, var(--bg-card) 60%, transparent)
  );
  font-weight: 900;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sidebar-accent) 10%, transparent);
}

.panel-link--active::before {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: -7px;
  width: 3px;
  content: '';
  border-radius: 999px;
  background: var(--sidebar-accent);
}

.panel-link-icon-wrap {
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: color-mix(in srgb, var(--sidebar-accent) 8%, transparent);
  color: var(--text-muted);
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.panel-link:hover .panel-link-icon-wrap {
  color: var(--sidebar-accent);
}

.panel-link--active .panel-link-icon-wrap {
  color: #ffffff;
  background: var(--sidebar-accent);
  box-shadow: 0 10px 18px -14px rgba(var(--sidebar-accent-rgb), 0.9);
}

.panel-link-icon {
  width: 13px;
  height: 13px;
  color: currentColor;
}

.panel-link-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-link--resource {
  min-height: 28px;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--sidebar-accent) 10%, var(--border-base));
  background: color-mix(in srgb, var(--bg-card) 58%, transparent);
  padding: 0 8px;
}

.panel-link--resource:hover,
.panel-link--resource.panel-link--active {
  border-color: color-mix(in srgb, var(--sidebar-accent) 36%, var(--border-base));
  background: color-mix(in srgb, var(--sidebar-accent) 12%, transparent);
}

.panel-link--resource.panel-link--active::before {
  display: none;
}

.panel-link--resource .panel-link-icon {
  width: 15px;
  height: 15px;
}

.panel-link--resource .panel-link-icon-wrap {
  width: 24px;
  height: 24px;
}

.panel-link--resource .panel-link-label {
  font-size: 11px;
  font-weight: 900;
}

.panel-badge {
  min-width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  color: #ffffff;
  background: #ef4444;
  font-size: 9px;
  font-weight: 900;
  line-height: 1;
}

.panel-footer {
  display: grid;
  gap: 5px;
  padding: 8px;
  border-top: 1px solid color-mix(in srgb, var(--border-base) 72%, transparent);
  background:
    linear-gradient(180deg, transparent, color-mix(in srgb, var(--sidebar-accent) 5%, transparent)),
    color-mix(in srgb, var(--bg-sidebar) 92%, transparent);
}

.footer-action {
  width: 100%;
  min-height: 30px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  padding: 0 9px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
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
  width: 16px;
  height: 16px;
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
  gap: 8px;
  min-height: 32px;
  margin-bottom: 2px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--sidebar-accent) 14%, var(--border-base));
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-card) 74%, transparent);
}

.sync-state i {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: #10b981;
  box-shadow: 0 0 0 4px color-mix(in srgb, #10b981 12%, transparent);
}

.sync-state__copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.sync-state__copy strong,
.sync-state__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-state__copy strong {
  color: var(--text-primary);
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.sync-state__copy small {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

.sync-state__dot--saving {
  background: #f59e0b !important;
  animation: sync-pulse 0.85s ease-in-out infinite;
}

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
