<script setup lang="ts">
import { computed, watch, ref, onMounted, nextTick, type CSSProperties } from 'vue';
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
import { getAssetUrl } from '@/utils/api';
import { preferences, type SidebarMode } from '@/utils/preferences';
import type { SidebarMenuGroup, SidebarMenuItem } from '../composables/useSidebarMenus';
import { useSidebarPreferences } from '../composables/useSidebarPreferences';
import { useLabel } from '@/utils/i18n';

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
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

const getInitialMode = (): SidebarMode => {
  if (preferences.hasSidebarMode()) return preferences.getSidebarMode();
  return route.path.startsWith('/admin') ? 'rail' : 'expanded';
};

const {
  sidebarMode,
  collapsedGroupKeys,
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

const label = useLabel();

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
  return '';
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
  const [basePath, queryStr] = path.split('?');

  // Parse query parameters
  const query: Record<string, string> = {};
  if (queryStr) {
    queryStr.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k) query[k] = v || '';
    });
  }

  // Check if paths match (direct match or subpath)
  let currentPath = route.path;
  let matches = false;

  if (currentPath.startsWith('/mirror/resource/') && basePath.startsWith('/mirror/source/')) {
    // If we are on mirror resource detail page, it belongs to the active source
    const activeSourceId = workspaceStore.currentWorkspace?.mirrorSourceId;
    if (activeSourceId && basePath === `/mirror/source/${activeSourceId}`) {
      matches = true;
    }
  } else if (
    currentPath.startsWith('/manual/resource/') &&
    basePath.startsWith('/manual/station/')
  ) {
    // If we are on manual resource detail page, it belongs to the active station
    const activeStationId = workspaceStore.currentWorkspace?.manualStationId;
    if (activeStationId && basePath === `/manual/station/${activeStationId}`) {
      matches = true;
    }
  } else {
    matches =
      currentPath === basePath || (basePath !== '/' && currentPath.startsWith(`${basePath}/`));
  }

  if (!matches) return false;

  // If the path has a categoryId query, the route must match it exactly
  if (query.categoryId) {
    return route.query.categoryId === query.categoryId;
  }

  // If the path is a station/source home page (e.g. /mirror/source/:id or /manual/station/:id),
  // it should only be active if there is no categoryId in route query (i.e. viewing "All")
  if (basePath.includes('/mirror/source/') || basePath.includes('/manual/station/')) {
    return !route.query.categoryId;
  }

  // For other query parameters, match them if specified
  if (queryStr) {
    return Object.keys(query).every((k) => route.query[k] === query[k]);
  }

  return true;
};

const isGroupActive = (group: PreparedSidebarGroup) =>
  group.items.some((item) => isRouteActive(item.path));

const isGroupOpen = (group: PreparedSidebarGroup) => !collapsedGroupKeys.value.has(group.key);



const activeIndicatorStyle = ref<CSSProperties>({
  opacity: 0,
});
const isActiveResource = ref(false);
const isMounted = ref(false);

const updateActiveIndicator = () => {
  nextTick(() => {
    const activeEl = document.querySelector('.panel-groups .panel-link--active');
    if (!activeEl) {
      activeIndicatorStyle.value = { opacity: 0 };
      isActiveResource.value = false;
      return;
    }
    const containerEl = document.querySelector('.panel-groups');
    if (!containerEl) return;

    isActiveResource.value = activeEl.classList.contains('panel-link--resource');

    const activeRect = activeEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();

    activeIndicatorStyle.value = {
      position: 'absolute',
      top: `${activeRect.top - containerRect.top + containerEl.scrollTop}px`,
      left: `${activeRect.left - containerRect.left}px`,
      width: `${activeRect.width}px`,
      height: `${activeRect.height}px`,
      opacity: 1,
      pointerEvents: 'none',
    };
  });
};

const getSavedWidth = () => {
  try {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('sidebarCustomWidth');
      return saved ? Number(saved) : 232;
    }
  } catch (_e) {}
  return 232;
};

const customWidth = ref(getSavedWidth());
const isResizing = ref(false);

const handleMousedown = (e: MouseEvent) => {
  e.preventDefault();
  isResizing.value = true;

  const startX = e.clientX;
  const isCurrentlyExpanded = isExpanded.value;
  const startWidth = isCurrentlyExpanded ? customWidth.value : 60;

  const handleMousemove = (moveEvent: MouseEvent) => {
    const deltaX = moveEvent.clientX - startX;
    let newWidth = startWidth + deltaX;

    // Constrain the width
    if (newWidth < 200) {
      if (newWidth < 130) {
        if (sidebarMode.value !== 'rail') {
          setSidebarMode('rail');
        }
        return;
      }
      newWidth = 200;
    }

    if (newWidth >= 130 && sidebarMode.value !== 'expanded') {
      setSidebarMode('expanded');
    }

    customWidth.value = newWidth;
    localStorage.setItem('sidebarCustomWidth', String(newWidth));
    updateActiveIndicator();
  };

  const handleMouseup = () => {
    isResizing.value = false;
    window.removeEventListener('mousemove', handleMousemove);
    window.removeEventListener('mouseup', handleMouseup);
  };

  window.addEventListener('mousemove', handleMousemove);
  window.addEventListener('mouseup', handleMouseup);
};

onMounted(() => {
  updateActiveIndicator();
  nextTick(() => {
    setTimeout(() => {
      isMounted.value = true;
    }, 50);
  });
});

const toggleSidebar = () => {
  setSidebarMode(isExpanded.value ? 'rail' : 'expanded');
};

const toggleGroup = (group: PreparedSidebarGroup) => {
  toggleGroupKey(group.key);
  updateActiveIndicator();
};

watch(
  preparedGroups,
  (groups) => {
    syncAvailableGroupKeys(groups.map((group) => group.key));
    updateActiveIndicator();
  },
  { immediate: true },
);

watch(
  () => route.fullPath,
  (newFullPath, oldFullPath) => {
    const newPath = newFullPath.split('?')[0];
    const oldPath = oldFullPath?.split('?')[0];
    if (oldPath && newPath !== oldPath) {
      preparedGroups.value.forEach((group) => {
        if (isGroupActive(group)) {
          expandGroupKey(group.key);
        }
      });
    }
    updateActiveIndicator();
  },
);

watch(isExpanded, (val) => {
  if (val) {
    nextTick(() => {
      updateActiveIndicator();
    });
  }
});
</script>

<template>
  <aside
    class="workspace-sidebar hidden lg:flex h-full shrink-0 glass-sidebar"
    :class="[
      `workspace-sidebar--${navTone}`,
      isExpanded ? 'workspace-sidebar--expanded' : 'workspace-sidebar--rail',
      isResizing ? 'is-resizing' : ''
    ]"
    :style="isExpanded ? {
      width: customWidth + 'px',
      '--sidebar-panel-width': customWidth + 'px'
    } : {}"
  >
    <div class="workspace-sidebar__rail">
      <div class="rail-top">
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
            style="margin-bottom: 12px;"
          >
            <ChevronsLeft v-if="isExpanded" class="rail-icon" />
            <ChevronsRight v-else class="rail-icon" />
          </button>
        </el-tooltip>

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
              <img
                v-if="workspaceStore.currentWorkspace?.avatarUrl"
                :src="getAssetUrl(workspaceStore.currentWorkspace.avatarUrl)"
                class="panel-mark-avatar"
                alt="Workspace Avatar"
              />
              <template v-else>
                <ShieldCheck v-if="isAdmin" />
                <Box v-else />
              </template>
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
          <div
            class="active-indicator-bg"
            :class="{
              'active-indicator-bg--resource': isActiveResource,
              'active-indicator-bg--mounted': isMounted,
            }"
            :style="activeIndicatorStyle"
          ></div>
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
                class="panel-list panel-list--resource-grid"
                :class="group.items.length % 2 === 1 ? 'panel-list--resource-grid-odd' : 'panel-list--resource-grid-even'"
              >
                <li v-for="item in group.items" :key="item.path">
                  <RouterLink
                    :to="item.path"
                    class="panel-link panel-link--resource"
                    :class="{
                      'panel-link--active': isRouteActive(item.path)
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
    <!-- Resize Handle -->
    <div
      class="sidebar-resize-handle"
      @mousedown="handleMousedown"
    ></div>
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
}

.panel-header {
  position: relative;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 12px 16px 10px;
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
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, #ffffff 42%, transparent);
  border-radius: 6px;
  color: #ffffff;
  background: linear-gradient(
    135deg,
    var(--sidebar-accent),
    color-mix(in srgb, var(--sidebar-accent) 64%, #111827)
  );
  box-shadow: 0 8px 18px -14px rgba(var(--sidebar-accent-rgb), 0.96);
}

.panel-mark svg {
  width: 14px !important;
  height: 14px !important;
}

.panel-mark-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 5px;
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

.panel-kicker,
.sidebar-section-label,
.sync-state {
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
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    color 0.16s ease,
    background-color 0.16s ease;
}

.panel-icon-button svg {
  width: 14px !important;
  height: 14px !important;
}

.panel-icon-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.quick-zone {
  padding: 0 6px 4px;
}

.sidebar-section-label {
  margin: 0 2px 4px;
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
  height: 32px;
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
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: color-mix(in srgb, var(--sidebar-accent) 12%, transparent);
  color: var(--sidebar-accent);
}

.quick-tile__icon svg {
  width: 14px !important;
  height: 14px !important;
}

.quick-tile__copy {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.quick-tile:hover,
.quick-tile--active {
  border-color: color-mix(in srgb, var(--sidebar-accent) 55%, var(--border-base));
  color: var(--sidebar-accent);
  box-shadow: 0 8px 18px -14px rgba(var(--sidebar-accent-rgb), 0.9);
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
  font-size: 10px;
  font-weight: 900;
  line-height: 1.12;
}

.quick-tile__copy small {
  display: none;
}

.panel-groups {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 6px 6px;
}

.panel-group + .panel-group {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--border-base) 48%, transparent);
}

.group-trigger {
  width: 100%;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 9.5px;
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
  gap: 5px;
  flex: 0 0 auto;
}

.group-count {
  min-width: 14px;
  height: 14px;
  display: grid;
  place-items: center;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-muted);
  font-size: 8.5px;
  font-weight: 900;
  line-height: 1;
}

.group-trigger:hover .group-count,
.group-trigger--active .group-count {
  background: color-mix(in srgb, var(--sidebar-accent) 8%, transparent);
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
  margin: 2px 0 0;
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
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 !important;
  padding-left: 0;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.015);
  margin: 6px 4px 4px 4px;
}

.panel-list--resource-grid::before {
  display: none;
}

/* All grid cells get a bottom border by default */
.panel-list--resource-grid li {
  border-bottom: 1px solid var(--border-base);
}

/* ==================== ODD ITEM COUNT LAYOUT ==================== */
/* First child spans full width */
.panel-list--resource-grid-odd li:first-child {
  grid-column: 1 / -1;
  border-bottom: 1px solid var(--border-base);
}

/* Centering styles for the first full-width header item in the grid */
.panel-list--resource-grid-odd li:first-child 
.panel-link {
  position: relative;
  z-index: 2;
  min-width: 0;
  min-height: 25px;
  display: flex;
  align-items: center;
  gap: 5px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0 5px;
  color: var(--text-secondary);
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease,
    box-shadow 0.16s ease;
}

.panel-link:hover:not(.panel-link--active) {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--sidebar-accent) 7%, transparent);
}

.panel-link--active {
  color: var(--text-primary);
  font-weight: 900;
}

.active-indicator-bg {
  position: absolute;
  pointer-events: none;
  z-index: 1;
  border-radius: 6px;
  background: color-mix(in srgb, var(--sidebar-accent) 10%, transparent);
  opacity: 0;
}

.active-indicator-bg--mounted {
  transition:
    top 0.25s cubic-bezier(0.25, 1, 0.5, 1),
    left 0.25s cubic-bezier(0.25, 1, 0.5, 1),
    width 0.25s cubic-bezier(0.25, 1, 0.5, 1),
    height 0.25s cubic-bezier(0.25, 1, 0.5, 1),
    opacity 0.18s ease;
}

.active-indicator-bg::before {
  display: none;
}

.active-indicator-bg--resource {
  opacity: 1 !important;
  border-radius: 6px;
  background: color-mix(in srgb, var(--sidebar-accent) 9%, transparent) !important;
}

.active-indicator-bg--resource::before {
  display: none;
}

.panel-link-icon-wrap {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 5px;
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
  font-size: 10px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.panel-link--resource {
  justify-content: center;
}
.panel-list--resource-grid-odd li:first-child .panel-link--resource .panel-link-label {
  flex: 0 0 auto;
}

/* Left column items are even indices: 2, 4, 6... */
.panel-list--resource-grid-odd li:nth-child(2n) {
  border-right: 1px solid var(--border-base);
}

/* Remove bottom borders from last row (1 or 2 items) */
.panel-list--resource-grid-odd li:last-child {
  border-bottom: none !important;
}
.panel-list--resource-grid-odd li:nth-child(2n):nth-last-child(2) {
  border-bottom: none !important;
}

/* ==================== EVEN ITEM COUNT LAYOUT ==================== */
/* Left column items are odd indices: 1, 3, 5... */
.panel-list--resource-grid-even li:nth-child(2n-1) {
  border-right: 1px solid var(--border-base);
}

/* Remove bottom borders from last row (always exactly 2 items) */
.panel-list--resource-grid-even li:last-child,
.panel-list--resource-grid-even li:nth-last-child(2) {
  border-bottom: none !important;
}

.panel-link--resource {
  position: relative;
  isolation: isolate;
  height: 30px;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: var(--text-secondary);
  padding: 0 8px;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.panel-link--resource::before {
  display: none;
}

.panel-link--resource .panel-link-icon-wrap {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-muted);
  box-shadow: none;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.panel-link--resource .panel-link-icon {
  width: 11px !important;
  height: 11px !important;
  color: currentColor;
}

.panel-link--resource .panel-link-label {
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.12;
  transition: color 0.16s ease;
}

.panel-link--resource:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--sidebar-accent) 6%, transparent) !important;
}

.panel-link--resource:hover .panel-link-icon-wrap {
  color: var(--sidebar-accent);
  background: color-mix(in srgb, var(--sidebar-accent) 10%, transparent);
}

.panel-link--resource:hover .panel-link-label {
  color: var(--text-primary);
}

.panel-link--resource.panel-link--active {
  color: var(--sidebar-accent);
  background: transparent !important;
}

.panel-link--resource.panel-link--active::before {
  display: none;
}

.panel-link--resource.panel-link--active .panel-link-icon-wrap {
  color: #ffffff !important;
  background: var(--sidebar-accent) !important;
  box-shadow: 0 5px 10px -7px rgba(var(--sidebar-accent-rgb), 0.8) !important;
}

.panel-link--resource.panel-link--active .panel-link-label {
  color: var(--text-primary) !important;
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
}

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

/* Sidebar manual resize styles */
.workspace-sidebar.is-resizing {
  transition: none !important;
}

.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 50;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

.sidebar-resize-handle:hover,
.workspace-sidebar.is-resizing .sidebar-resize-handle {
  background-color: var(--sidebar-accent, var(--accent));
  opacity: 0.35;
}



</style>
