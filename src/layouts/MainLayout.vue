<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage } from '@/utils/feedbackBridge';
import { logError } from '@/utils/error';
import {
  Menu,
  ExternalLink,
  LogOut,
  Search,
  Box,
  ShieldCheck,
  LayoutDashboard,
  FolderTree,
  MonitorPlay,
  Megaphone,
  Sun,
  Moon,
  ClipboardList,
  BookOpen,
} from 'lucide-vue-next';

// AISprite is heavy (pulls in md-editor-v3 styles & three.js deps) and not
// needed on first paint — load it lazily so it stays out of the MainLayout chunk.
const AISprite = defineAsyncComponent(() => import('@/components/AISprite.vue'));

// Async sub-dialogs/components
const CreateTeamDialog = defineAsyncComponent(() => import('@/components/CreateTeamDialog.vue'));
const ExploreGroupsDialog = defineAsyncComponent(
  () => import('@/components/ExploreGroupsDialog.vue'),
);
const InvitationDialog = defineAsyncComponent(() => import('@/components/InvitationDialog.vue'));
const AssetDetailsDrawer = defineAsyncComponent(
  () => import('@/components/AssetDetailsDrawer.vue'),
);

// Extracted Sub-components
const GlobalSearchDialog = defineAsyncComponent(
  () => import('./components/GlobalSearchDialog.vue'),
);
const MobileSidebar = defineAsyncComponent(() => import('./components/MobileSidebar.vue'));
import NotificationCenter from './components/NotificationCenter.vue';
import SidebarMenu from './components/SidebarMenu.vue';
import WorkspaceSwitcher from './components/WorkspaceSwitcher.vue';
import UserDropdown from './components/UserDropdown.vue';

// Composables
import { useSidebarMenus } from './composables/useSidebarMenus';
import { useLayoutSocket } from './composables/useLayoutSocket';

import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { useWorkspaceStore } from '@/stores/workspace';
import { authReady } from '@/stores/authReady';
import api, { getAssetUrl } from '@/utils/api';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { formatDateTime as formatDate } from '@/utils/format';
import { renderMarkdown } from '@/utils/aiHelpers';
import { fetchUnreadMessageCount } from '@/services/message.service';
import type { AppNotification } from '@/services/notification.service';
import { useThemeManager } from './composables/useThemeManager';
import Tabs from '@/components/ui/Tabs.vue';
import { preferences } from '@/utils/preferences';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
const workspaceStore = useWorkspaceStore();
const { t } = useI18n();

const { menuGroups, mobileNavItems } = useSidebarMenus();
const { currentTheme, currentBackground, isDark, applyTheme, initTheme, cleanupTheme } =
  useThemeManager();

const blobStyles = ref([
  { style: {} as Record<string, string> },
  { style: {} as Record<string, string> },
  { style: {} as Record<string, string> },
]);

const randomizeBlobs = () => {
  // Blob 1: Bottom-Left quadrant (do not appear in top-left to keep header/sidebar clean)
  const bottom1 = Math.floor(Math.random() * 40) - 20; // -20% to 20%
  const left1 = Math.floor(Math.random() * 40) - 20; // -20% to 20%
  const size1 = Math.floor(Math.random() * 20) + 45; // 45% to 65%
  const duration1 = Math.floor(Math.random() * 10) + 15; // 15s to 25s

  // Blob 2: Bottom-Right quadrant
  const bottom2 = Math.floor(Math.random() * 40) - 25; // -25% to 15%
  const right2 = Math.floor(Math.random() * 40) - 25; // -25% to 15%
  const size2 = Math.floor(Math.random() * 20) + 40; // 40% to 60%
  const duration2 = Math.floor(Math.random() * 12) + 18; // 18s to 30s

  // Blob 3: Top/Middle-Right
  const top3 = Math.floor(Math.random() * 50) + 10; // 10% to 60%
  const right3 = Math.floor(Math.random() * 40) - 10; // -10% to 30%
  const size3 = Math.floor(Math.random() * 15) + 35; // 35% to 50%
  const duration3 = Math.floor(Math.random() * 8) + 6; // 6s to 14s

  blobStyles.value = [
    {
      style: {
        bottom: `${bottom1}%`,
        left: `${left1}%`,
        width: `${size1}%`,
        height: `${size1}%`,
        animationDuration: `${duration1}s`,
      },
    },
    {
      style: {
        bottom: `${bottom2}%`,
        right: `${right2}%`,
        width: `${size2}%`,
        height: `${size2}%`,
        animationDuration: `${duration2}s`,
      },
    },
    {
      style: {
        top: `${top3}%`,
        right: `${right3}%`,
        width: `${size3}%`,
        height: `${size3}%`,
        animationDuration: `${duration3}s`,
      },
    },
  ];
};

onMounted(() => {
  randomizeBlobs();
});

watch(currentBackground, (bg) => {
  if (bg === 'blobs') {
    randomizeBlobs();
  }
});

const toggleTheme = () => {
  const nextTheme = isDark.value ? 'glass-light' : 'glass-dark';
  preferences.setTheme(nextTheme);
  applyTheme(nextTheme);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: nextTheme }));
};

const latestBroadcast = ref<AppNotification | null>(null);
const showBroadcastPopup = ref(false);

const fetchLatestBroadcast = async () => {
  if (!authStore.isAuthenticated) return;
  try {
    const { data } = await api.get('/api/notifications/latest-broadcast');
    if (data) {
      latestBroadcast.value = data;
      showBroadcastPopup.value = true;
    }
  } catch (error) {
    logError(error, { operation: 'layout.fetchLatestBroadcast', component: 'MainLayout' });
  }
};

const handleNavigateToLink = (url: string) => {
  showBroadcastPopup.value = false;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    router.push(url);
  }
};

const topNavTabs = computed(() => [
  {
    key: 'tasks',
    label: t('sidebar.work'),
    icon: ClipboardList,
    path: '/work',
    active: route.path.startsWith('/work'),
  },
  {
    key: 'notes',
    label: t('sidebar.notes'),
    icon: BookOpen,
    path: '/notes',
    active: route.path.startsWith('/notes'),
  },
  {
    key: 'resources',
    label: t('sidebar.resourceCenter'),
    icon: Box,
    path: '/resources',
    active:
      route.path === '/resources' ||
      route.path.startsWith('/assets') ||
      route.path.startsWith('/materials') ||
      route.path.startsWith('/plugins') ||
      route.path.startsWith('/softwares'),
  },
  {
    key: 'projects',
    label: t('sidebar.projects'),
    icon: FolderTree,
    path: '/projects',
    active: route.path.startsWith('/projects') || route.path.startsWith('/project/'),
  },
  {
    key: 'showcase',
    label: t('sidebar.showcase'),
    icon: MonitorPlay,
    path: '/showcase',
    active: route.path.startsWith('/showcase') || route.path.startsWith('/my-works'),
  },
]);

const topNavTabsOptions = computed(() =>
  topNavTabs.value.map((tab) => ({
    label: tab.label,
    value: tab.path,
    icon: tab.icon,
  })),
);

const activeTabKey = computed({
  get() {
    const activeTab = topNavTabs.value.find((t) => t.active);
    return activeTab ? activeTab.path : '';
  },
  set(newPath) {
    if (newPath) {
      router.push(newPath);
    }
  },
});

const showTopTabs = computed(() => {
  // Show top tabs only in normal workspace (not admin/mirror/manual)
  return (
    !route.path.startsWith('/admin') &&
    !route.path.startsWith('/mirror') &&
    !route.path.startsWith('/manual')
  );
});

const isCreateTeamVisible = ref(false);
const isExploreGroupsVisible = ref(false);
const isInvitationVisible = ref(false);
const activeInvitationId = ref<string | null>(null);

const isSearchVisible = ref(false);
const isMobileSidebarOpen = ref(false);
const isMobile = ref(window.innerWidth < 768);
const logoLoadFailed = ref(false);

interface NotificationCenterExpose {
  fetchNotifications: () => Promise<void> | void;
  addNotification: (notification: AppNotification) => void;
}

const notificationCenterRef = ref<NotificationCenterExpose | null>(null);

const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 768;
};

const handleSearch = () => {
  isSearchVisible.value = true;
};

watch(
  () => systemStore.settings.PLATFORM_LOGO_URL,
  () => {
    logoLoadFailed.value = false;
  },
);

const handleLogoError = () => {
  logoLoadFailed.value = true;
};

const handleTeamCreated = (team: { id: string }) => {
  workspaceStore.fetchWorkspaces();
  router.push(`/team/${team.id}`);
};

const handleInvitationSuccess = (data: { accept: boolean; teamId?: string }) => {
  if (data.accept && data.teamId) {
    workspaceStore.fetchWorkspaces();
    router.push(`/team/${data.teamId}`);
  }
};

const handleReportBug = () => {
  router.push('/report-bug');
};

const handleLogout = async () => {
  authStore.logout();
  ElMessage.success(t('layout.logoutSuccess'));
  router.push('/login');
};

const handleOpenInNewTab = () => {
  window.open(window.location.href, '_blank');
};

const fetchNotifications = async () => {
  if (notificationCenterRef.value) {
    await notificationCenterRef.value.fetchNotifications();
  }
};

const fetchUnreadMessagesCount = async () => {
  if (!authStore.isAuthenticated) return;
  try {
    authStore.setUnreadMessagesCount(await fetchUnreadMessageCount());
  } catch (error) {
    logError(error, { operation: 'layout.fetchUnreadMessages', component: 'MainLayout' });
  }
};

// Hook up WebSockets
useLayoutSocket({
  fetchNotifications,
  fetchUnreadMessagesCount,
  onNewNotificationCallback: (notification) => {
    if (notificationCenterRef.value) {
      notificationCenterRef.value.addNotification(notification);
    }
  },
});

const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    handleSearch();
  }
};

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('resize', updateIsMobile);

  // Apply stored theme and accent color
  initTheme();

  if (!systemStore.isInitialized) {
    systemStore.fetchSettings();
  }

  // ── Auth bootstrap (MUST happen before workspace init) ──────────────────
  // `authStore.accessToken` starts as null on every page load (it is never
  // persisted). fetchMe() will 401 → the axios interceptor calls
  // refreshAccessToken() → stores the token → retries fetchMe().
  // Only after this cycle is `accessToken` non-null, so all subsequent
  // requests (workspace, views) can attach the Authorization header.
  if (authStore.user) {
    await authStore.fetchMe();
    // Explicit refresh as a safety net: if fetchMe succeeded via a still-valid
    // access-token cookie but the interceptor didn't run (no 401), we still
    // need an in-memory token for the Bearer-header injection in api.ts.
    if (!authStore.accessToken) {
      try {
        await authStore.refreshAccessToken();
      } catch {
        // refresh failure → logout() already called inside refreshAccessToken
      }
    }
  }
  // Signal that auth is settled. RouterView is gated behind this flag so
  // child views (TaskBoard, MaterialsView, …) cannot mount until the
  // Bearer token is in memory.
  authReady.value = true;

  // ── Workspace & data init (safe now — token is available) ───────────────
  await workspaceStore.initialize(route.path);

  fetchNotifications();
  fetchUnreadMessagesCount();
  fetchLatestBroadcast();

  if (authStore.user?.role === 'ADMIN') {
    workspaceStore.fetchAdminStats();
  }

  // Load heavy AI assistant lazily to optimize initial load performance
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      setTimeout(() => {
        renderAiSprite.value = true;
      }, 1000);
    });
  } else {
    setTimeout(() => {
      renderAiSprite.value = true;
    }, 2000);
  }
});

// Watch for auth changes to re-initialize workspaces
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      authReady.value = true;
      workspaceStore.initialize(route.path);
      fetchLatestBroadcast();
    }
  },
);

// Watch for workspace changes to refresh stats
watch(
  () => workspaceStore.activeWorkspaceId,
  (id) => {
    if (id === 'admin-workspace') {
      workspaceStore.fetchAdminStats();
    }
  },
);

// Sync workspace with route
watch(
  () => route.path,
  (path) => {
    isMobileSidebarOpen.value = false;
    if (path.startsWith('/team/')) {
      const id = path.split('/')[2];
      workspaceStore.setWorkspaceById(id);
    } else if (path.startsWith('/admin/')) {
      workspaceStore.setWorkspaceById('admin-workspace');
    } else if (path.startsWith('/mirror/source/')) {
      const sourceId = path.split('/')[3];
      workspaceStore.setWorkspaceById(`mirror-${sourceId}`);
    } else if (path.startsWith('/manual/station/')) {
      const stationId = path.split('/')[3];
      workspaceStore.setWorkspaceById(`manual-${stationId}`);
    } else if (path.startsWith('/mirror/resource/')) {
      // Keep mirror workspace if already active
    } else if (path.startsWith('/manual/resource/')) {
      // Keep manual workspace if already active
    } else {
      // For general routes (dashboard, softwares, assets, etc.), if the active workspace is admin, mirror, or manual,
      // switch it back to a personal/team workspace.
      const isSpecialWorkspace =
        workspaceStore.activeWorkspaceId === 'admin-workspace' ||
        workspaceStore.activeWorkspaceId?.startsWith('mirror-') ||
        workspaceStore.activeWorkspaceId?.startsWith('manual-');
      if (isSpecialWorkspace) {
        const personalWs =
          workspaceStore.rawWorkspaces.find((ws) => ws.type === 'personal') ||
          workspaceStore.rawWorkspaces.find((ws) => ws.type === 'team') ||
          workspaceStore.rawWorkspaces.find(
            (ws) => ws.type !== 'admin' && ws.type !== 'mirror' && ws.type !== 'manual',
          );
        if (personalWs) {
          workspaceStore.setWorkspaceById(personalWs.id);
        }
      }
    }
  },
);

// Lazy component rendering triggers to preserve exit transitions
const hasLoadedCreateTeam = ref(false);
watch(isCreateTeamVisible, (val) => {
  if (val) hasLoadedCreateTeam.value = true;
});

const hasLoadedInvitation = ref(false);
watch(isInvitationVisible, (val) => {
  if (val) hasLoadedInvitation.value = true;
});

const hasLoadedExploreGroups = ref(false);
watch(isExploreGroupsVisible, (val) => {
  if (val) hasLoadedExploreGroups.value = true;
});

const hasLoadedSearch = ref(false);
watch(isSearchVisible, (val) => {
  if (val) hasLoadedSearch.value = true;
});

const hasLoadedMobileSidebar = ref(false);
watch(isMobileSidebarOpen, (val) => {
  if (val) hasLoadedMobileSidebar.value = true;
});

const hasLoadedAssetDetails = ref(false);
watch(
  () => workspaceStore.isDetailDrawerOpen,
  (val) => {
    if (val) hasLoadedAssetDetails.value = true;
  },
);

const renderAiSprite = ref(false);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', updateIsMobile);
  cleanupTheme();
});
</script>

<template>
  <div
    class="app-shell flex flex-col h-screen h-dvh w-full overflow-hidden text-sm relative"
    style="background-color: var(--bg-app); color: var(--text-primary)"
  >
    <!-- Subtle enterprise canvas for glass mode -->
    <div
      v-show="currentTheme.startsWith('glass') && !isMobile"
      :class="[
        'enterprise-canvas absolute inset-0 overflow-hidden pointer-events-none z-0',
        'bg-style-' + currentBackground,
      ]"
      style="contain: strict"
    >
      <!-- Restored beautiful floating blobs -->
      <div
        v-if="currentBackground === 'blobs'"
        class="absolute inset-0 overflow-hidden pointer-events-none"
      >
        <div
          class="absolute bg-[var(--accent)]/18 blur-[120px] rounded-full animate-float-blob"
          :style="blobStyles[0].style"
        ></div>
        <div
          class="absolute bg-[var(--accent)]/14 blur-[100px] rounded-full animate-float-blob-reverse"
          :style="blobStyles[1].style"
        ></div>
        <div
          class="absolute bg-[var(--accent)]/10 blur-[100px] rounded-full animate-pulse-slow"
          :style="blobStyles[2].style"
        ></div>
      </div>
    </div>

    <!-- Top Navigation Bar -->
    <header
      class="topbar h-12 lg:h-14 flex items-center justify-between px-3 md:px-4 shrink-0 z-30 glass-header"
    >
      <!-- Left: Brand Logo + Brand Name & Workspace Switcher -->
      <div
        class="flex items-center gap-2.5 min-w-0 lg:w-auto lg:min-w-[260px] xl:w-auto xl:min-w-[280px] shrink-0"
      >
        <button
          type="button"
          class="topbar-icon-btn w-9 h-9 flex items-center justify-center lg:hidden shrink-0 -ml-1"
          @click="isMobileSidebarOpen = true"
        >
          <Menu class="w-5 h-5" style="color: var(--text-muted)" />
        </button>

        <!-- Brand Logo & Name (Always visible) -->
        <RouterLink to="/" class="flex items-center gap-2 mr-2 shrink-0">
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
            :class="
              systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed
                ? 'bg-transparent'
                : 'bg-accent'
            "
          >
            <img
              v-if="systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed"
              alt="Logo"
              :src="getAssetUrl(systemStore.settings.PLATFORM_LOGO_URL)"
              class="w-full h-full object-contain"
              @error="handleLogoError"
            />
            <Box v-else class="w-4 h-4 text-white" />
          </div>
          <div class="hidden sm:flex flex-col justify-center leading-none">
            <span
              class="text-sm font-black whitespace-nowrap leading-tight"
              style="color: var(--text-primary)"
            >
              {{ systemStore.settings.PLATFORM_NAME || 'Platform' }}
            </span>
            <span
              v-if="systemStore.settings.PLATFORM_SUBTITLE"
              class="text-[9px] font-medium whitespace-nowrap leading-none mt-0.5"
              style="color: var(--text-muted)"
            >
              {{ systemStore.settings.PLATFORM_SUBTITLE }}
            </span>
          </div>
        </RouterLink>

        <!-- Workspace Switcher next to logo -->
        <template v-if="authStore.isAuthenticated">
          <WorkspaceSwitcher />
        </template>
      </div>

      <!-- Center: Main Nav Tabs (Blender-club style) on desktop, Search on narrow screens -->
      <div class="flex-1 flex items-center justify-center px-2">
        <!-- Top Navigation Tabs — desktop only, normal workspace -->
        <div v-if="showTopTabs && !isMobile" class="hidden lg:block">
          <Tabs
            v-model="activeTabKey"
            :options="topNavTabsOptions"
            size="sm"
            class="!bg-transparent border-none"
          />
        </div>
        <!-- Search bar on medium screens (no tabs visible) -->
        <div
          v-else
          class="search-box !hidden md:!flex cursor-pointer w-[260px] xl:w-[380px] h-9"
          @click="handleSearch"
        >
          <Search />
          <span class="text-xs flex-1 truncate">{{ $t('layout.searchPlaceholder') }}</span>
          <kbd
            class="text-[10px] px-2 py-0.5 rounded border font-mono hidden lg:inline-block"
            style="border-color: var(--border-base); color: var(--text-muted)"
            >Ctrl+K</kbd
          >
        </div>
      </div>

      <!-- Right: Actions + Avatar -->
      <div
        class="flex items-center justify-end gap-3 sm:gap-4 lg:w-auto lg:min-w-[380px] xl:w-auto xl:min-w-[440px] shrink-0 min-w-0"
      >
        <!-- Search bar for desktop mode when tabs are visible -->
        <div
          v-if="showTopTabs && !isMobile"
          class="search-box !hidden lg:!flex cursor-pointer w-[180px] xl:w-[240px] h-8.5"
          @click="handleSearch"
        >
          <Search />
          <span class="text-xs flex-1 truncate">{{ $t('layout.searchPlaceholder') }}</span>
          <kbd
            class="text-[9px] px-1.5 py-0.5 rounded border font-mono hidden xl:inline-block"
            style="border-color: var(--border-base); color: var(--text-muted)"
            >Ctrl+K</kbd
          >
        </div>

        <!-- Search icon button for smaller screens / non-desktop tabs mode -->
        <button
          type="button"
          class="topbar-icon-btn w-9 h-9 items-center justify-center cursor-pointer"
          :class="showTopTabs && !isMobile ? 'lg:hidden flex' : 'flex md:hidden'"
          @click="handleSearch"
        >
          <Search class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>

        <!-- Theme Toggle Button -->
        <button
          type="button"
          class="topbar-icon-btn w-9 h-9 flex items-center justify-center cursor-pointer transition-colors"
          :title="isDark ? '切换到浅色主题' : '切换到深色主题'"
          @click="toggleTheme"
        >
          <Sun v-if="isDark" class="w-4.5 h-4.5" style="color: var(--text-muted)" />
          <Moon v-else class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>

        <!-- Notification Bell Center Dropdown -->
        <NotificationCenter
          ref="notificationCenterRef"
          @show-invitation="
            (id) => {
              activeInvitationId = id;
              isInvitationVisible = true;
            }
          "
        />

        <!-- Open Current Page in New Tab Icon Button -->
        <button
          type="button"
          class="topbar-icon-btn w-9 h-9 flex items-center justify-center cursor-pointer transition-colors"
          title="在新标签页打开当前页面"
          @click="handleOpenInNewTab"
        >
          <ExternalLink class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>

        <!-- Direct Logout/Exit Icon Button -->
        <button
          v-if="authStore.isAuthenticated"
          type="button"
          class="topbar-icon-btn w-9 h-9 hidden sm:flex items-center justify-center cursor-pointer transition-colors relative"
          :title="$t('layout.logout')"
          @click="handleLogout"
        >
          <LogOut class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>

        <!-- User Avatar or Login Button -->
        <template v-if="authStore.isAuthenticated">
          <UserDropdown />
        </template>
        <template v-else>
          <button
            type="button"
            class="px-4 py-2 bg-accent text-white text-xs font-bold rounded-lg shadow-sm hover:bg-accent-hover transition-colors"
            @click="router.push({ path: '/login', query: { redirect: route.fullPath } })"
          >
            {{ $t('layout.login') }}
          </button>
        </template>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Desktop Sidebar Menu component -->
      <SidebarMenu :menu-groups="menuGroups" @report-bug="handleReportBug" />

      <!-- Main Content Area -->
      <main
        class="content-surface flex-1 flex flex-col overflow-hidden relative mobile-main-content lg:pb-0"
      >
        <div
          v-if="systemStore.settings.MAINTENANCE_MODE && authStore.user?.role === 'ADMIN'"
          class="bg-rose-600 text-white px-6 py-2 flex items-center justify-between shrink-0 z-50 shadow-lg"
        >
          <div class="flex items-center gap-3">
            <ShieldCheck class="w-4 h-4 animate-pulse" />
            <span class="text-xs font-bold uppercase tracking-wider">{{
              $t('layout.maintenanceMode')
            }}</span>
          </div>
          <RouterLink
            to="/admin/settings"
            class="text-[10px] font-black underline hover:opacity-80 transition-opacity"
            >{{ $t('layout.goToDisable') }}</RouterLink
          >
        </div>
        <!-- Gate child views behind auth bootstrap so views like TaskBoard
             don't fire authenticated requests before the Bearer token is set -->
        <RouterView v-if="authReady" v-slot="{ Component, route: routeSlot }">
          <Transition name="page-fade" mode="out-in">
            <keep-alive
              :include="[
                'DashboardView',
                'AcademyView',
                'ResourceCenterView',
                'AssetsView',
                'MyWorksView',
                'TaskBoard',
                'DiscussionsView',
                'RoadmapsView',
                'ProjectsView',
                'MaterialsView',
                'PluginsView',
                'ShowcaseView',
                'MessagesView',
                'MirrorSourceView',
                'ManualStationView',
              ]"
            >
              <component :is="Component" :key="routeSlot.path" />
            </keep-alive>
          </Transition>
        </RouterView>
      </main>
    </div>

    <!-- Mobile Bottom Tab Bar -->
    <nav
      class="lg:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 mobile-bottom-nav border-t"
      style="border-color: var(--border-base)"
    >
      <RouterLink
        v-for="item in mobileNavItems"
        :key="item.path"
        :to="item.path"
        class="min-h-14 flex flex-col items-center justify-center gap-0.5 px-2 py-1 transition-colors relative"
        :class="item.active(route.path) ? 'text-accent' : ''"
        :style="item.active(route.path) ? {} : { color: 'var(--text-muted)' }"
      >
        <component :is="item.icon" class="w-5 h-5" />
        <span class="text-[10px] font-semibold">{{ item.name }}</span>
        <div
          v-if="item.badge && item.badge > 0"
          class="absolute -top-0.5 right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1"
        >
          {{ item.badge > 99 ? '99+' : item.badge }}
        </div>
        <div
          v-if="item.active(route.path)"
          class="absolute -bottom-0.5 w-1 h-1 rounded-full bg-accent"
        ></div>
      </RouterLink>
    </nav>

    <!-- Create Team Dialog -->
    <CreateTeamDialog
      v-if="hasLoadedCreateTeam"
      v-model:visible="isCreateTeamVisible"
      @success="handleTeamCreated"
    />

    <InvitationDialog
      v-if="hasLoadedInvitation"
      v-model:visible="isInvitationVisible"
      :invitation-id="activeInvitationId"
      @success="handleInvitationSuccess"
    />

    <ExploreGroupsDialog v-if="hasLoadedExploreGroups" v-model:visible="isExploreGroupsVisible" />

    <!-- Global Search Dialog component -->
    <GlobalSearchDialog v-if="hasLoadedSearch" v-model="isSearchVisible" :is-mobile="isMobile" />

    <!-- Asset Details Drawer -->
    <AssetDetailsDrawer v-if="hasLoadedAssetDetails" />

    <!-- Mobile Sidebar Drawer component -->
    <MobileSidebar
      v-if="hasLoadedMobileSidebar"
      v-model="isMobileSidebarOpen"
      :menu-groups="menuGroups"
      @report-bug="handleReportBug"
    />
    <!-- Floating AI Sprite -->
    <AISprite v-if="renderAiSprite" />

    <Modal
      :show="showBroadcastPopup"
      size="lg"
      :close-on-outside-click="true"
      @close="showBroadcastPopup = false"
    >
      <template #header>
        <div class="flex flex-col text-left">
          <span
            class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest"
          >
            系统公告 / System Announcement
          </span>
        </div>
      </template>

      <div class="flex items-center gap-4 p-1">
        <!-- Megaphone icon with beautiful gradient background box matching WorkspaceSwitcher aesthetics -->
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/20 shrink-0"
        >
          <Megaphone class="w-6 h-6 text-white" />
        </div>
        <div class="flex flex-col text-left min-w-0">
          <span class="font-bold text-base text-[var(--text-primary)] truncate">
            {{ latestBroadcast?.title }}
          </span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            发布时间: {{ latestBroadcast ? formatDate(String(latestBroadcast.createdAt)) : '' }}
          </span>
        </div>
      </div>

      <!-- eslint-disable vue/no-v-html -->
      <div
        class="mt-4 bg-subtle/30 border border-base rounded-xl p-4 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-h-[500px] overflow-y-auto"
        v-html="renderMarkdown(latestBroadcast?.content || '')"
      ></div>
      <!-- eslint-enable vue/no-v-html -->

      <template #footer>
        <Button
          v-if="latestBroadcast?.link"
          variant="primary"
          size="sm"
          :icon="ExternalLink"
          @click="handleNavigateToLink(latestBroadcast.link)"
        >
          立即前往
        </Button>
        <Button variant="secondary" size="sm" @click="showBroadcastPopup = false">
          我知道了
        </Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.app-shell {
  isolation: isolate;
}

.enterprise-canvas {
  --canvas-line: color-mix(in srgb, var(--border-base) 74%, transparent);
  --canvas-glow: color-mix(in srgb, var(--accent) 30%, transparent);
  transition:
    opacity 0.35s ease,
    background 0.5s ease;
}

.enterprise-canvas::before,
.enterprise-canvas::after {
  content: '';
  position: absolute;
  inset: -18%;
  pointer-events: none;
}

.topbar {
  box-shadow: 0 1px 2px rgb(16 24 40 / 0.04);
}

.workspace-switcher:hover,
.topbar-icon-btn:hover {
  background-color: var(--bg-subtle);
}

.topbar-icon-btn {
  border-radius: var(--radius-md);
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.content-surface {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-app) 75%, white) 0, var(--bg-app) 180px),
    var(--bg-app);
}

.dark .content-surface {
  background: var(--bg-app);
}

.mobile-bottom-nav {
  background-color: color-mix(in srgb, var(--bg-card) 96%, transparent);
  box-shadow: 0 -8px 22px rgb(16 24 40 / 0.08);
}

/* Fade Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 1023px) {
  .mobile-main-content {
    padding-bottom: calc(3.25rem + env(safe-area-inset-bottom));
  }
  .mobile-bottom-nav {
    height: calc(3.25rem + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
