import {
  computed,
  onMounted,
  nextTick,
  ref,
  watch,
  type CSSProperties,
  type InjectionKey,
  type Ref,
} from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { preferences, type SidebarMode } from '@/utils/preferences';
import { useLabel } from '@/utils/i18n';
import { useSidebarPreferences } from './useSidebarPreferences';
import type { SidebarMenuGroup } from './useSidebarMenus';
import {
  getGroupKey,
  type PreparedSidebarGroup,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_EXPAND_THRESHOLD,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_NARROW_THRESHOLD,
  SIDEBAR_RAIL_THRESHOLD,
  SIDEBAR_RAIL_WIDTH,
  SIDEBAR_VERY_NARROW_THRESHOLD,
  SIDEBAR_WIDE_THRESHOLD,
} from '../components/sidebarMenuSchema';

export function useSidebarMenuState(menuGroups: Ref<SidebarMenuGroup[]>) {
  const route = useRoute();
  const authStore = useAuthStore();
  const workspaceStore = useWorkspaceStore();
  const label = useLabel();

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
    return 'default';
  });

  const sidebarTitle = computed(() => {
    if (isAdmin.value) return label('系统管理后台', 'System Admin');
    return workspaceStore.currentWorkspace?.name || label('未命名空间', 'Workspace');
  });

  const sidebarSubtitle = computed(() => {
    if (isAdmin.value) return label('平台维护', 'Maintenance');
    const type = workspaceStore.currentWorkspace?.type || 'personal';
    const typeMap: Record<string, string> = {
      personal: label('个人沙箱', 'Sandbox'),
      team: label('协作环境', 'Teamspace'),
      mirror: label('云资产镜像', 'Mirror'),
      manual: label('物理工作站', 'Station'),
    };
    return typeMap[type] || label('工作空间', 'Workspace');
  });

  const settingsPath = computed(() => {
    if (isAdmin.value) return '/admin/settings';
    return '/workspace/settings';
  });

  const settingStateLabel = computed(() => {
    if (isSavingPreference.value) return label('正在同步...', 'Syncing...');
    if (cloudPreferenceLoaded.value) return label('云同步已开启', 'Synced');
    return label('本地运行', 'Local Mode');
  });

  const settingStateCaption = computed(() => {
    if (isSavingPreference.value) return label('首选项正保存至云端', 'Saving to cloud');
    if (cloudPreferenceLoaded.value) return label('配置已与云端保持实时同步', 'Config in sync');
    return label('正在使用本地偏好设置运行', 'Local storage active');
  });

  const collapseNavigationLabel = computed(() => label('折叠导航栏', 'Collapse menu'));
  const expandNavigationLabel = computed(() => label('展开导航栏', 'Expand menu'));
  const panelScopeLabel = computed(() => label('个模块', 'modules'));

  const isRouteActive = (basePath: string) => {
    const currentPath = route.path;
    const query = route.query;
    const queryStr = Object.keys(query).length > 0;

    let matches = false;
    if (currentPath.startsWith('/mirror/resource/') && basePath.startsWith('/mirror/source/')) {
      const activeSourceId = workspaceStore.currentWorkspace?.mirrorSourceId;
      if (activeSourceId && basePath === `/mirror/source/${activeSourceId}`) {
        matches = true;
      }
    } else if (
      currentPath.startsWith('/manual/resource/') &&
      basePath.startsWith('/manual/station/')
    ) {
      const activeStationId = workspaceStore.currentWorkspace?.manualStationId;
      if (activeStationId && basePath === `/manual/station/${activeStationId}`) {
        matches = true;
      }
    } else {
      matches =
        currentPath === basePath || (basePath !== '/' && currentPath.startsWith(`${basePath}/`));
    }

    if (!matches) return false;
    if (query.categoryId) {
      return route.query.categoryId === query.categoryId;
    }
    if (basePath.includes('/mirror/source/') || basePath.includes('/manual/station/')) {
      return !route.query.categoryId;
    }
    if (queryStr) {
      return Object.keys(query).every((k) => route.query[k] === query[k]);
    }
    return true;
  };

  const preparedGroups = computed<PreparedSidebarGroup[]>(() =>
    menuGroups.value
      .map((group, index) => {
        const items = isAdmin.value
          ? group.items.filter((item) => item.path !== '/admin/settings')
          : group.items;
        const preparedItems = items.map((item) => ({
          ...item,
          tooltip: item.name,
          isActive: isRouteActive(item.path),
        }));
        return {
          key: getGroupKey(group, index),
          title: group.title,
          items: preparedItems,
          isActive: preparedItems.some((item) => item.isActive),
        };
      })
      .filter((group) => group.items.length > 0),
  );

  const isGroupOpen = (group: PreparedSidebarGroup) => !collapsedGroupKeys.value.has(group.key);

  // --- Active indicator (floating highlight that follows the active link) ---
  const activeIndicatorStyle = ref<CSSProperties>({ opacity: 0 });
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

  // --- Manual resize drag ---
  const getSavedWidth = (): number => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('sidebarCustomWidth');
        if (saved) {
          const val = Number(saved);
          if (val >= SIDEBAR_MIN_WIDTH && val <= SIDEBAR_MAX_WIDTH) {
            return val;
          }
        }
        return SIDEBAR_DEFAULT_WIDTH;
      }
    } catch {}
    return SIDEBAR_DEFAULT_WIDTH;
  };

  const customWidth = ref(getSavedWidth());
  const isResizing = ref(false);
  const isVeryNarrowSidebar = computed(() => customWidth.value < SIDEBAR_VERY_NARROW_THRESHOLD);
  const isNarrowSidebar = computed(
    () =>
      customWidth.value >= SIDEBAR_VERY_NARROW_THRESHOLD &&
      customWidth.value < SIDEBAR_NARROW_THRESHOLD,
  );
  const isWideSidebar = computed(() => customWidth.value >= SIDEBAR_WIDE_THRESHOLD);

  const handleMousedown = (e: MouseEvent) => {
    e.preventDefault();
    isResizing.value = true;
    const startX = e.clientX;
    const isCurrentlyExpanded = isExpanded.value;
    const startWidth = isCurrentlyExpanded ? customWidth.value : SIDEBAR_RAIL_WIDTH;

    const handleMousemove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth + deltaX;
      if (newWidth < SIDEBAR_MIN_WIDTH) {
        if (newWidth < SIDEBAR_RAIL_THRESHOLD) {
          if (sidebarMode.value !== 'rail') {
            setSidebarMode('rail');
          }
          return;
        }
        newWidth = SIDEBAR_MIN_WIDTH;
      }
      if (newWidth >= SIDEBAR_EXPAND_THRESHOLD && sidebarMode.value !== 'expanded') {
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

  const toggleSidebar = () => {
    setSidebarMode(isExpanded.value ? 'rail' : 'expanded');
  };

  const toggleGroup = (group: PreparedSidebarGroup) => {
    toggleGroupKey(group.key);
    updateActiveIndicator();
  };

  // --- Lifecycle & watchers ---
  onMounted(() => {
    updateActiveIndicator();
    nextTick(() => {
      setTimeout(() => {
        isMounted.value = true;
      }, 50);
    });
  });

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
          if (group.isActive) {
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

  return {
    // preferences
    sidebarMode,
    isExpanded,
    isSavingPreference,
    setSidebarMode,
    // workspace
    isAdmin,
    isResourceWorkspace,
    navTone,
    sidebarTitle,
    sidebarSubtitle,
    settingsPath,
    settingStateLabel,
    settingStateCaption,
    collapseNavigationLabel,
    expandNavigationLabel,
    panelScopeLabel,
    // groups
    preparedGroups,
    isRouteActive,
    isGroupOpen,
    toggleGroup,
    toggleSidebar,
    // active indicator
    activeIndicatorStyle,
    isActiveResource,
    isMounted,
    updateActiveIndicator,
    // resize
    customWidth,
    isResizing,
    isVeryNarrowSidebar,
    isNarrowSidebar,
    isWideSidebar,
    handleMousedown,
  };
}

export type SidebarMenuState = ReturnType<typeof useSidebarMenuState>;
export const SidebarMenuStateKey: InjectionKey<SidebarMenuState> = Symbol('SidebarMenuState');
