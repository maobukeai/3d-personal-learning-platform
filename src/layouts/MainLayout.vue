<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import {
  Menu,
  ExternalLink,
  Search,
  Box,
  ShieldCheck,
  LayoutDashboard,
  GraduationCap,
  MessageSquare,
  FolderTree,
  MonitorPlay,
  Megaphone,
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
import { getAssetUrl } from '@/utils/api';
import api from '@/utils/api';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { formatDateTime as formatDate } from '@/utils/format';
import { fetchUnreadMessageCount } from '@/services/message.service';
import type { AppNotification } from '@/services/notification.service';
import { useThemeManager } from './composables/useThemeManager';
import Tabs from '@/components/ui/Tabs.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
const workspaceStore = useWorkspaceStore();
const { t } = useI18n();

const { menuGroups, mobileNavItems } = useSidebarMenus();
const { currentTheme, initTheme, cleanupTheme } = useThemeManager();

const latestBroadcast = ref<any>(null);
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
    console.error('Fetch latest broadcast error:', error);
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

// Top navigation tabs (Blender-club style center nav)
const topNavTabs = computed(() => [
  {
    key: 'dashboard',
    label: t('sidebar.dashboard'),
    icon: LayoutDashboard,
    path: '/dashboard',
    active:
      route.path === '/dashboard' ||
      route.path.startsWith('/work') ||
      route.path.startsWith('/notes'),
  },
  {
    key: 'learning',
    label: t('sidebar.academy'),
    icon: GraduationCap,
    path: '/academy',
    active: route.path.startsWith('/academy') || route.path.startsWith('/roadmaps'),
  },
  {
    key: 'team',
    label: t('sidebar.projects'),
    icon: FolderTree,
    path: '/projects',
    active: route.path.startsWith('/projects') || route.path.startsWith('/project/'),
  },
  {
    key: 'community',
    label: t('sidebar.discussions'),
    icon: MessageSquare,
    path: '/discussions',
    active: route.path.startsWith('/discussions') || route.path.startsWith('/messages'),
  },
  {
    key: 'showcase',
    label: t('sidebar.showcase'),
    icon: MonitorPlay,
    path: '/showcase',
    active:
      route.path.startsWith('/showcase') ||
      route.path.startsWith('/my-works') ||
      route.path.startsWith('/assets'),
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
    console.error('Fetch unread messages count error:', error);
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

  // Initialize workspaces first (loads public mirror/manual sources for guests too)
  await workspaceStore.initialize(route.path);

  // Only verify session if there is a stored user (previously logged in).
  // For anonymous guests (no stored user), skip fetchMe to avoid the race condition
  // where fetchMe's 401 failure would trigger logout() → workspaceStore.reset(),
  // which destroys the guest's freshly-loaded public workspace state.
  if (authStore.user) {
    await authStore.fetchMe();
  }

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
    } else if (workspaceStore.activeWorkspaceId === 'admin-workspace') {
      const personalWs =
        workspaceStore.rawWorkspaces.find((ws) => ws.type === 'personal') ||
        workspaceStore.rawWorkspaces.find((ws) => ws.type !== 'admin');
      if (personalWs) {
        workspaceStore.setWorkspaceById(personalWs.id);
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
      v-show="(currentTheme === 'glass-light' || currentTheme === 'glass-dark') && !isMobile"
      class="enterprise-canvas absolute inset-0 overflow-hidden pointer-events-none z-0"
      style="contain: strict"
    ></div>

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
          class="search-box hidden md:flex cursor-pointer w-[260px] xl:w-[380px] h-9"
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
        class="flex items-center justify-end gap-1.5 md:gap-2 lg:w-auto lg:min-w-[380px] xl:w-auto xl:min-w-[440px] shrink-0 min-w-0"
      >
        <!-- Search bar for desktop mode when tabs are visible -->
        <div
          v-if="showTopTabs && !isMobile"
          class="search-box hidden lg:flex cursor-pointer w-[180px] xl:w-[240px] h-8.5"
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

        <!-- Direct Logout/Exit Icon Button -->
        <button
          v-if="authStore.isAuthenticated"
          type="button"
          class="topbar-icon-btn w-9 h-9 flex items-center justify-center transition-colors relative"
          :title="$t('layout.logout')"
          @click="handleLogout"
        >
          <ExternalLink class="w-4.5 h-4.5" style="color: var(--text-muted)" />
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
        <RouterView v-slot="{ Component, route }">
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
              <component :is="Component" :key="route.path" />
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

    <!-- Premium Broadcast Modal -->
    <Modal
      :show="showBroadcastPopup"
      size="md"
      glass-card
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
            发布时间: {{ latestBroadcast ? formatDate(latestBroadcast.createdAt) : '' }}
          </span>
        </div>
      </div>

      <div
        class="mt-4 bg-subtle/30 border border-base rounded-xl p-4 text-xs sm:text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto"
      >
        {{ latestBroadcast?.content }}
      </div>

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
  background-image:
    linear-gradient(var(--border-base) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-base) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.2;
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
    padding-bottom: calc(3.25rem + env(safe-area-inset-bottom)) !important;
  }
  .mobile-bottom-nav {
    height: calc(3.25rem + env(safe-area-inset-bottom)) !important;
    padding-bottom: env(safe-area-inset-bottom) !important;
  }
}
</style>
