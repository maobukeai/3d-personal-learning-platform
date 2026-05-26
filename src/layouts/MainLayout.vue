<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Menu,
  ChevronDown,
  Plus,
  LogOut,
  User as UserIcon,
  CreditCard,
  Bell,
  Settings,
  Search,
  Share2,
  ExternalLink,
  Box,
  ShieldCheck,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import AISprite from '@/components/AISprite.vue';

// Async sub-dialogs/components
import { defineAsyncComponent } from 'vue';
const CreateTeamDialog = defineAsyncComponent(() => import('@/components/CreateTeamDialog.vue'));
const ExploreGroupsDialog = defineAsyncComponent(() => import('@/components/ExploreGroupsDialog.vue'));
const InvitationDialog = defineAsyncComponent(() => import('@/components/InvitationDialog.vue'));
const AssetDetailsDrawer = defineAsyncComponent(() => import('@/components/AssetDetailsDrawer.vue'));

// Extracted Sub-components
import GlobalSearchDialog from './components/GlobalSearchDialog.vue';
import NotificationCenter from './components/NotificationCenter.vue';
import SidebarMenu from './components/SidebarMenu.vue';
import MobileSidebar from './components/MobileSidebar.vue';

// Composables
import { useSidebarMenus } from './composables/useSidebarMenus';
import { useLayoutSocket } from './composables/useLayoutSocket';

import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { useWorkspaceStore } from '@/stores/workspace';
import type { Workspace } from '@/stores/workspace';
import { getAssetUrl } from '@/utils/api';
import { fetchUnreadMessageCount } from '@/services/message.service';
import type { AppNotification } from '@/services/notification.service';
import { applyAccentColorToDocument, applyThemeToDocument } from '@/composables/useAppearance';
import { preferences, type ThemePreference } from '@/utils/preferences';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
const workspaceStore = useWorkspaceStore();

const { menuGroups, mobileNavItems } = useSidebarMenus();

const isCreateTeamVisible = ref(false);
const isExploreGroupsVisible = ref(false);
const isInvitationVisible = ref(false);
const activeInvitationId = ref<string | null>(null);

const isSearchVisible = ref(false);
const isMobileSidebarOpen = ref(false);
const isMobile = ref(window.innerWidth < 768);

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

const handleShare = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    ElMessage.success('页面链接已复制');
  } catch (_err) {
    ElMessage.error('复制失败');
  }
};

const handleExternalLink = () => {
  window.open(window.location.href, '_blank', 'noopener,noreferrer');
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

const handleSwitchWorkspace = (ws: Workspace, event?: Event) => {
  if (event) {
    const target = event.target as HTMLElement;
    if (target.closest('button')?.querySelector('.lucide-settings') || target.closest('.lucide-settings')) {
      return;
    }
  }
  workspaceStore.setWorkspace(ws);
  if (ws.type === 'admin') {
    router.push('/admin/dashboard');
  } else if (ws.type === 'mirror') {
    if (ws.mirrorSourceId) {
      router.push(`/mirror/source/${ws.mirrorSourceId}`);
    } else {
      router.push('/mirror');
    }
  } else if (ws.type === 'manual') {
    if (ws.manualStationId) {
      router.push(`/manual/station/${ws.manualStationId}`);
    } else {
      router.push('/academy');
    }
  } else {
    router.push('/dashboard');
  }
};

const handleQuickSettings = (ws: Workspace) => {
  if (ws.type === 'admin') {
    router.push('/admin/settings');
  } else if (ws.type === 'mirror') {
    router.push({ path: '/admin/mirror', query: { sourceId: ws.mirrorSourceId } });
  } else if (ws.type === 'manual') {
    router.push({ path: '/admin/manual', query: { stationId: ws.manualStationId } });
  } else if (ws.type === 'personal') {
    router.push({ path: '/settings', query: { tab: 'profile' } });
  } else {
    router.push({ path: `/team/${ws.id}`, query: { tab: 'settings' } });
  }
};

const handleProfileClick = (type: string) => {
  if (type === 'profile') {
    router.push({ path: '/settings', query: { tab: 'profile' } });
  } else if (type === 'notifications') {
    router.push('/notifications');
  } else if (type === 'billing') {
    router.push('/billing');
  } else if (type === 'logout') {
    handleLogout();
  }
};

const handleReportBug = () => {
  router.push('/report-bug');
};

const handleLogout = async () => {
  authStore.logout();
  ElMessage.success('已成功退出登录');
  router.push('/login');
};

const currentTheme = ref<ThemePreference>(preferences.getTheme());

const applyTheme = (theme: ThemePreference) => {
  currentTheme.value = theme;
  applyThemeToDocument(theme);
};

const applyAccentColor = (color: string) => {
  applyAccentColorToDocument(color);
};

const handleThemeChangeExternal = (e: Event) => {
  applyTheme((e as CustomEvent<ThemePreference>).detail);
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
  window.addEventListener('theme-changed', handleThemeChangeExternal);

  applyTheme(preferences.getTheme());
  applyAccentColor(preferences.getAccentColor());

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

  if (authStore.user?.role === 'ADMIN') {
    workspaceStore.fetchAdminStats();
  }
});

// Watch for auth changes to re-initialize workspaces
watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      workspaceStore.initialize(route.path);
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
    }
  },
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('resize', updateIsMobile);
  window.removeEventListener('theme-changed', handleThemeChangeExternal);
});
</script>

<template>
  <div
    class="flex flex-col h-screen h-dvh w-full overflow-hidden text-sm relative"
    style="background-color: var(--bg-app); color: var(--text-primary)"
  >
    <!-- Global Glass Theme Animated Background Glowing Blobs -->
    <div
      v-show="currentTheme === 'glass' && !isMobile"
      class="absolute inset-0 overflow-hidden pointer-events-none z-0"
      style="contain: strict"
    >
      <div
        class="absolute w-[45vw] h-[45vw] rounded-full top-[-15%] left-[-15%] animate-float-blob"
        style="
          will-change: transform;
          background: radial-gradient(
            circle at center,
            color-mix(in srgb, var(--accent) 15%, transparent) 0%,
            transparent 70%
          );
        "
      ></div>
      <div
        class="absolute w-[50vw] h-[50vw] rounded-full bottom-[-20%] right-[-15%] animate-float-blob-reverse"
        style="
          will-change: transform;
          background: radial-gradient(
            circle at center,
            rgba(99, 102, 241, 0.12) 0%,
            transparent 70%
          );
        "
      ></div>
      <div
        class="absolute w-[35vw] h-[35vw] rounded-full top-[30%] right-[15%] animate-pulse-slow"
        style="
          will-change: transform, opacity;
          background: radial-gradient(
            circle at center,
            rgba(236, 72, 153, 0.1) 0%,
            transparent 70%
          );
        "
      ></div>
    </div>

    <!-- Top Navigation Bar -->
    <header
      class="topbar h-14 flex items-center justify-between px-4 md:px-6 shrink-0 z-30 glass-header"
    >
      <!-- Left: Hamburger + Workspace Switcher / Logo -->
      <div class="flex items-center gap-1 md:gap-3">
        <button type="button" class="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors lg:hidden shrink-0 -ml-1" @click="isMobileSidebarOpen = true">
          <Menu class="w-5 h-5" style="color: var(--text-muted)" />
        </button>

        <template v-if="!workspaceStore.isInitialized && authStore.isAuthenticated">
          <div class="flex items-center gap-2.5 ml-2 md:ml-4 animate-pulse">
            <div class="w-7 h-7 rounded-xl bg-slate-200/50 dark:bg-white/10"></div>
            <div class="w-24 h-4 rounded-md bg-slate-200/50 dark:bg-white/10"></div>
          </div>
        </template>
        <template v-else>
          <el-dropdown
            v-if="workspaceStore.currentWorkspace"
            trigger="click"
            placement="bottom-start"
          >
            <div
              class="min-h-10 px-1 rounded-lg flex items-center gap-2 md:gap-2.5 cursor-pointer hover:opacity-80 ml-1 md:ml-4 transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
              :style="{
                transform: `translateX(${
                  workspaceStore.currentWorkspace?.type === 'personal'
                    ? 0
                    : workspaceStore.currentWorkspace?.type === 'team'
                      ? isMobile
                        ? 4
                        : 12
                      : isMobile
                        ? 8
                        : 24
                }px)`,
              }"
            >
              <div class="relative">
                <img v-if="workspaceStore.currentWorkspace?.avatarUrl" alt="" :src="getAssetUrl(workspaceStore.currentWorkspace.avatarUrl)" class="w-7 h-7 rounded-xl object-cover shrink-0 shadow-sm border border-white/25 dark:border-white/10" />
                <div
                  v-else
                  class="w-7 h-7 rounded-xl text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] backdrop-blur-md border border-white/20 shadow-[inset_0_1px_rgba(255,255,255,0.4)]"
                  :class="
                    workspaceStore.isAdminWorkspace ? '' : workspaceStore.currentWorkspace.color
                  "
                  :style="
                    workspaceStore.isAdminWorkspace
                      ? {
                          background: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
                          boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)',
                        }
                      : {}
                  "
                >
                  {{ workspaceStore.currentWorkspace.name.charAt(0) }}
                </div>
                <!-- Active Workspace Badge -->
                <div
                  v-if="workspaceStore.currentWorkspace?.badgeCount"
                  class="absolute -top-1 -right-1 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--bg-sidebar)] px-1 animate-in zoom-in duration-300"
                >
                  {{
                    workspaceStore.currentWorkspace.badgeCount > 99
                      ? '99+'
                      : workspaceStore.currentWorkspace.badgeCount
                  }}
                </div>
              </div>
              <span
                class="text-sm font-bold truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px] transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
                :class="{ 'tracking-wide': workspaceStore.isAdminWorkspace }"
                style="color: var(--text-primary)"
              >
                {{ workspaceStore.currentWorkspace.name }}
              </span>
              <ChevronDown
                class="w-4 h-4 text-slate-400 shrink-0 transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
                :class="{ 'text-rose-400': workspaceStore.isAdminWorkspace }"
              />
            </div>
            <template #dropdown>
              <el-dropdown-menu class="w-72 p-2 rounded-2xl border-none shadow-2xl">
                <div
                  class="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                >
                  切换工作空间
                </div>
                <el-dropdown-item
                  v-for="ws in workspaceStore.workspaces"
                  :key="ws.id"
                  class="rounded-2xl my-1 p-2 group transition-all duration-200"
                  :class="workspaceStore.activeWorkspaceId === ws.id ? 'bg-accent/5' : ''"
                  @click="handleSwitchWorkspace(ws, $event)"
                >
                  <div class="flex items-center justify-between w-full">
                    <div class="flex items-center gap-3">
                      <!-- 玻璃质感头像 / 团队头像 -->
                      <div class="relative">
                        <img v-if="ws.avatarUrl" alt="" :src="getAssetUrl(ws.avatarUrl)" class="w-8 h-8 rounded-xl object-cover shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 border border-slate-200/50 dark:border-white/10" />
                        <div
                          v-else
                          class="w-8 h-8 rounded-xl text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 backdrop-blur-md border border-white/20 shadow-[inset_0_1px_rgba(255,255,255,0.4)]"
                          :class="ws.color"
                        >
                          {{ ws.name.charAt(0) }}
                        </div>
                        <!-- 徽标 -->
                        <div
                          v-if="ws.badgeCount"
                          class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 px-1"
                        >
                          {{ ws.badgeCount > 99 ? '99+' : ws.badgeCount }}
                        </div>
                      </div>
                      <!-- 文字信息 -->
                      <div class="flex flex-col text-left">
                        <span
                          class="font-semibold text-sm"
                          :class="
                            workspaceStore.activeWorkspaceId === ws.id
                              ? 'text-accent'
                              : 'text-slate-700 dark:text-slate-200'
                          "
                        >
                          {{ ws.name }}
                        </span>
                        <span class="text-[10px] text-slate-400">
                          {{ ws.description }}
                        </span>
                      </div>
                    </div>
                    <!-- 快捷按钮 -->
                    <div class="flex items-center gap-2">
                      <button v-if="ws.type === 'personal' || ws.type === 'team' || (['admin', 'mirror', 'manual'].includes(ws.type) && authStore.user?.role === 'ADMIN')" type="button" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-accent transition-all duration-200 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0" @click.stop="handleQuickSettings(ws)">
                        <Settings class="w-4 h-4" />
                      </button>
                      <div
                        v-if="workspaceStore.activeWorkspaceId === ws.id"
                        class="w-1.5 h-1.5 rounded-full bg-accent"
                      ></div>
                    </div>
                  </div>
                </el-dropdown-item>
                <div class="border-t border-slate-100 dark:border-slate-800 my-2"></div>
                <el-dropdown-item class="rounded-xl my-0.5" @click="router.push('/explore-teams')">
                  <div class="flex items-center gap-3 py-1 text-slate-500">
                    <Plus class="w-4 h-4" />
                    <span class="font-medium">创建或加入团队</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <div v-else class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden"
              :class="systemStore.settings.PLATFORM_LOGO_URL ? 'bg-transparent' : 'bg-accent'"
            >
              <img v-if="systemStore.settings.PLATFORM_LOGO_URL" alt="" :src="getAssetUrl(systemStore.settings.PLATFORM_LOGO_URL)" class="w-full h-full object-contain" />
              <Box v-else class="w-4 h-4 text-white" />
            </div>
            <span class="text-sm font-bold" style="color: var(--text-primary)">{{
              systemStore.settings.PLATFORM_NAME
            }}</span>
          </div>
        </template>
      </div>

      <!-- Center: Search Bar -->
      <div
        class="topbar-search hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer hover:border-[var(--border-strong)] transition-colors"
        style="background-color: var(--bg-card); border-color: var(--border-base); min-width: 240px; lg:min-width: 320px"
        @click="handleSearch"
      >
        <Search class="w-4 h-4 text-slate-400" />
        <span class="text-xs text-slate-400 flex-1">搜索功能、作品或文档...</span>
        <kbd
          class="text-[10px] px-2 py-0.5 rounded border font-mono hidden lg:inline-block"
          style="border-color: var(--border-base); color: var(--text-muted)"
          >Ctrl+K</kbd
        >
      </div>

      <!-- Right: Actions + Avatar -->
      <div class="flex items-center gap-2 md:gap-3">
        <!-- Mobile Search Button -->
        <button type="button" class="md:hidden w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" @click="handleSearch">
          <Search class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>
        <!-- Share -->
        <button type="button" class="topbar-icon-btn hidden sm:flex w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" @click="handleShare">
          <Share2 class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>
        <!-- External Link -->
        <button type="button" class="topbar-icon-btn hidden sm:flex w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" @click="handleExternalLink">
          <ExternalLink class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        </button>

        <!-- Notification Bell Center Dropdown -->
        <NotificationCenter ref="notificationCenterRef" @show-invitation="(id) => { activeInvitationId = id; isInvitationVisible = true; }" />

        <!-- User Avatar or Login Button -->
        <template v-if="authStore.isAuthenticated">
          <el-dropdown trigger="click" placement="bottom-end" @command="handleProfileClick">
            <button type="button" class="flex items-center gap-0 p-0.5 rounded-full hover:ring-2 hover:ring-accent/30 transition-all cursor-pointer outline-none">
              <UserAvatar :user="authStore.user ?? undefined" size="md" />
            </button>
            <template #dropdown>
              <el-dropdown-menu class="w-56 p-2 rounded-2xl border-none shadow-2xl">
                <div class="px-3 py-2 border-b mb-1" style="border-color: var(--border-base)">
                  <p class="text-sm font-bold" style="color: var(--text-primary)">
                    {{ authStore.user?.name || '未命名用户' }}
                  </p>
                  <p class="text-[10px]" style="color: var(--text-muted)">
                    {{ authStore.user?.email }}
                  </p>
                </div>
                <el-dropdown-item command="profile" class="rounded-xl my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <UserIcon class="w-4 h-4 text-slate-400" /><span
                      class="font-medium text-slate-600"
                      >个人资料</span
                    >
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="notifications" class="rounded-xl my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <Bell class="w-4 h-4 text-slate-400" /><span class="font-medium text-slate-600"
                      >消息通知</span
                    >
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="billing" class="rounded-xl my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <CreditCard class="w-4 h-4 text-slate-400" /><span
                      class="font-medium text-slate-600"
                      >订阅与账单</span
                    >
                  </div>
                </el-dropdown-item>
                <div class="border-t border-slate-100 my-2"></div>
                <el-dropdown-item command="logout" class="rounded-xl my-0.5 text-rose-600">
                  <div class="flex items-center gap-3 py-1">
                    <LogOut class="w-4 h-4" /><span class="font-bold">退出登录</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
        <template v-else>
          <button type="button" class="px-4 py-1.5 bg-accent text-white text-xs font-bold rounded-xl shadow-lg shadow-accent/20 hover:shadow-xl transition-all" @click="router.push({ path: '/login', query: { redirect: route.fullPath } })">
            登录
          </button>
        </template>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Desktop Sidebar Menu component -->
      <SidebarMenu :menu-groups="menuGroups" @report-bug="handleReportBug" />

      <!-- Main Content Area -->
      <main
        class="flex-1 flex flex-col overflow-hidden relative mobile-main-content lg:pb-0"
        style="background-color: var(--bg-app)"
      >
        <div
          v-if="systemStore.settings.MAINTENANCE_MODE && authStore.user?.role === 'ADMIN'"
          class="bg-rose-600 text-white px-6 py-2 flex items-center justify-between shrink-0 z-50 shadow-lg"
        >
          <div class="flex items-center gap-3">
            <ShieldCheck class="w-4 h-4 animate-pulse" />
            <span class="text-xs font-bold uppercase tracking-wider"
              >系统维护模式已开启 - 仅管理员可访问</span
            >
          </div>
          <RouterLink
            to="/admin/settings"
            class="text-[10px] font-black underline hover:opacity-80 transition-opacity"
            >前往关闭</RouterLink
          >
        </div>
        <RouterView v-slot="{ Component }">
          <Transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <!-- Mobile Bottom Tab Bar -->
    <nav
      class="lg:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 mobile-bottom-nav border-t bg-white/95 dark:bg-slate-900/95"
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
    <CreateTeamDialog v-model:visible="isCreateTeamVisible" @success="handleTeamCreated" />

    <InvitationDialog
      v-model:visible="isInvitationVisible"
      :invitation-id="activeInvitationId"
      @success="handleInvitationSuccess"
    />

    <ExploreGroupsDialog v-model:visible="isExploreGroupsVisible" />

    <!-- Global Search Dialog component -->
    <GlobalSearchDialog v-model="isSearchVisible" :is-mobile="isMobile" />

    <!-- Asset Details Drawer -->
    <AssetDetailsDrawer />

    <!-- Mobile Sidebar Drawer component -->
    <MobileSidebar v-model="isMobileSidebarOpen" :menu-groups="menuGroups" @report-bug="handleReportBug" />
    <!-- Floating AI Sprite -->
    <AISprite />
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

/* Fade Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

:deep(.mobile-search-dialog) {
  margin-bottom: 0 !important;
  border-radius: 16px !important;
}
:deep(.mobile-search-dialog .el-dialog__header) {
  padding: 12px 16px !important;
  margin-right: 0;
  border-bottom: none !important;
}
:deep(.mobile-search-dialog .el-dialog__body) {
  padding: 8px 16px 20px !important;
}
:deep(.mobile-search-dialog .el-dialog__headerbtn) {
  top: 12px !important;
  right: 12px !important;
}

@media (max-width: 1023px) {
  .mobile-main-content {
    padding-bottom: calc(4rem + env(safe-area-inset-bottom)) !important;
  }
  .mobile-bottom-nav {
    height: calc(4rem + env(safe-area-inset-bottom)) !important;
    padding-bottom: env(safe-area-inset-bottom) !important;
  }
}
</style>
