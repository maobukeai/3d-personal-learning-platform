<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
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
  Box,
  ShieldCheck,
  LayoutDashboard,
  GraduationCap,
  MessageSquare,
  Briefcase,
  MonitorPlay,
  Lock,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import AISprite from '@/components/AISprite.vue';

// Async sub-dialogs/components
import { defineAsyncComponent } from 'vue';
const CreateTeamDialog = defineAsyncComponent(() => import('@/components/CreateTeamDialog.vue'));
const ExploreGroupsDialog = defineAsyncComponent(
  () => import('@/components/ExploreGroupsDialog.vue'),
);
const InvitationDialog = defineAsyncComponent(() => import('@/components/InvitationDialog.vue'));
const AssetDetailsDrawer = defineAsyncComponent(
  () => import('@/components/AssetDetailsDrawer.vue'),
);

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
const { t } = useI18n();

const { menuGroups, mobileNavItems } = useSidebarMenus();

// Top navigation tabs (Blender-club style center nav)
const topNavTabs = computed(() => [
  {
    key: 'dashboard',
    label: t('sidebar.dashboard'),
    icon: LayoutDashboard,
    path: '/dashboard',
    active: route.path === '/dashboard' || route.path.startsWith('/work') || route.path.startsWith('/notes'),
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
    label: t('sidebar.teamTasks'),
    icon: Briefcase,
    path: '/team-tasks',
    active: route.path.startsWith('/team-tasks') || route.path.startsWith('/team/'),
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
    active: route.path.startsWith('/showcase') || route.path.startsWith('/my-works') || route.path.startsWith('/assets'),
  },
]);

const showTopTabs = computed(() => {
  // Show top tabs only in normal workspace (not admin/mirror/manual)
  return !route.path.startsWith('/admin') &&
         !route.path.startsWith('/mirror') &&
         !route.path.startsWith('/manual');
});

const normalWorkspaces = computed(() => {
  return workspaceStore.workspaces.filter((ws) => ws.type !== 'admin');
});

const adminWorkspace = computed(() => {
  return workspaceStore.workspaces.find((ws) => ws.type === 'admin');
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

const handleSwitchWorkspace = (ws: Workspace, event?: Event) => {
  if (event) {
    const target = event.target as HTMLElement;
    if (
      target.closest('button')?.querySelector('.lucide-settings') ||
      target.closest('.lucide-settings')
    ) {
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
  ElMessage.success(t('layout.logoutSuccess'));
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

  // Apply stored theme (defaults to 'glass-dark') and accent color
  const storedTheme = preferences.getTheme();
  applyTheme(storedTheme);
  applyAccentColor('#F5792A');

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
      class="topbar h-14 flex items-center justify-between px-3 md:px-4 shrink-0 z-30 glass-header"
    >
      <!-- Left: Brand Logo + Brand Name & Workspace Switcher -->
      <div class="flex items-center gap-2.5 min-w-0 lg:w-[300px] shrink-0">
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
            <span class="text-sm font-black whitespace-nowrap leading-tight" style="color: var(--text-primary)">
              {{ systemStore.settings.PLATFORM_NAME || 'Platform' }}
            </span>
            <span v-if="systemStore.settings.PLATFORM_SUBTITLE" class="text-[9px] font-medium whitespace-nowrap leading-none mt-0.5" style="color: var(--text-muted)">
              {{ systemStore.settings.PLATFORM_SUBTITLE }}
            </span>
          </div>
        </RouterLink>

        <!-- Workspace Switcher next to logo -->
        <template v-if="authStore.isAuthenticated">
          <div v-if="!workspaceStore.isInitialized" class="flex items-center gap-2.5 animate-pulse">
            <div class="w-7 h-7 rounded bg-slate-200/50 dark:bg-white/10"></div>
          </div>
          <el-dropdown
            v-else-if="workspaceStore.currentWorkspace"
            trigger="click"
            placement="bottom-start"
          >
            <div
              class="workspace-switcher-badge min-h-8 h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 flex items-center gap-2 cursor-pointer hover:bg-slate-200/50 dark:hover:bg-white/8 transition-colors animate-in fade-in duration-300"
            >
              <div class="relative shrink-0">
                <img
                  v-if="workspaceStore.currentWorkspace?.avatarUrl"
                  alt=""
                  :src="getAssetUrl(workspaceStore.currentWorkspace.avatarUrl)"
                  class="w-5.5 h-5.5 rounded object-cover border border-slate-200/50 dark:border-white/10"
                />
                <div
                  v-else
                  class="w-5.5 h-5.5 rounded-full text-white flex items-center justify-center font-bold text-[10px] shrink-0"
                  :class="workspaceStore.currentWorkspace.type === 'personal' ? 'bg-slate-900 border border-white/5' : workspaceStore.currentWorkspace.color"
                >
                  <svg v-if="workspaceStore.currentWorkspace.type === 'personal'" class="w-4.5 h-4.5" viewBox="0 0 128 128" fill="none">
                    <path d="M66.332 70.032c.24-4.242 2.327-7.987 5.485-10.634 3.094-2.602 7.248-4.193 11.809-4.193 4.537 0 8.69 1.59 11.78 4.193 3.163 2.647 5.237 6.392 5.485 10.634.24 4.35-1.523 8.41-4.605 11.417-3.158 3.05-7.627 4.977-12.66 4.977-5.037 0-9.526-1.915-12.664-4.977-3.094-3.006-4.853-7.044-4.606-11.397zm0 0" fill="#235785"/>
                    <path d="M39.245 79.002c.028 1.66.564 4.89 1.36 7.404 1.682 5.336 4.537 10.273 8.49 14.599 4.062 4.465 9.074 8.055 14.85 10.61 6.073 2.67 12.665 4.037 19.505 4.037 6.84-.009 13.432-1.4 19.504-4.102 5.776-2.582 10.79-6.168 14.85-10.657 3.974-4.374 6.82-9.307 8.491-14.647a37 37 0 001.595-8.163c.208-2.69.12-5.405-.263-8.12a37.535 37.535 0 00-5.417-14.714c-2.574-4.15-5.916-7.76-9.89-10.813l.012-.004-39.955-30.506c-.036-.028-.068-.056-.104-.08-2.619-2.002-7.044-1.994-9.91.008-2.914 2.031-3.25 5.385-.656 7.496l-.012.008 16.682 13.484-50.789.051h-.068c-4.197.004-8.239 2.739-9.03 6.213-.82 3.521 2.035 6.46 6.412 6.46l-.008.016 25.736-.048L4.58 82.524c-.056.044-.12.088-.176.132C.069 85.95-1.33 91.446 1.4 94.9c2.778 3.522 8.666 3.546 13.047.02L39.505 74.51s-.368 2.758-.336 4.397zm64.56 9.219c-5.168 5.228-12.416 8.21-20.227 8.21-7.831.012-15.079-2.918-20.248-8.142-2.526-2.559-4.377-5.473-5.528-8.591a22.202 22.202 0 01-1.271-9.602 22.446 22.446 0 012.778-9.039c1.507-2.714 3.59-5.18 6.14-7.267 5.033-4.058 11.42-6.28 18.1-6.28 6.709-.008 13.097 2.174 18.13 6.236 2.55 2.075 4.625 4.529 6.14 7.243a22.302 22.302 0 012.774 9.043 22.313 22.313 0 01-1.271 9.598c-1.147 3.142-3.002 6.056-5.533 8.615zm0 0" fill="#F5792A"/>
                  </svg>
                  <span v-else>{{ workspaceStore.currentWorkspace.name.charAt(0) }}</span>
                </div>
              </div>
              <span class="text-xs font-bold text-slate-600 dark:text-slate-200 truncate max-w-[120px] hidden md:block">
                {{ workspaceStore.currentWorkspace.name }}
              </span>
              <ChevronDown class="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </div>
            <template #dropdown>
              <el-dropdown-menu class="w-72 p-2 rounded-xl border shadow-lg">
                <div
                  class="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                >
                  {{ $t('layout.switchWorkspace') }}
                </div>
                
                <!-- Normal workspaces loop -->
                <el-dropdown-item
                  v-for="ws in normalWorkspaces"
                  :key="ws.id"
                  class="rounded-lg my-1 p-2 group transition-all duration-200 relative overflow-hidden pl-3"
                  :class="workspaceStore.activeWorkspaceId === ws.id ? 'bg-accent/5' : ''"
                  @click="handleSwitchWorkspace(ws, $event)"
                >
                  <!-- Active vertical indicator pill on the left of item -->
                  <div 
                    v-if="workspaceStore.activeWorkspaceId === ws.id" 
                    class="absolute left-0 top-1 bottom-1 w-[3px] bg-accent rounded-r"
                  ></div>
                  
                  <div class="flex items-center justify-between w-full">
                    <div class="flex items-center gap-3">
                      <div class="relative shrink-0">
                        <img
                          v-if="ws.avatarUrl && ws.type !== 'personal'"
                          alt=""
                          :src="getAssetUrl(ws.avatarUrl)"
                          class="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-200/50 dark:border-white/10"
                        />
                        <!-- Custom styled icons per type -->
                        <div 
                          v-else-if="ws.type === 'personal'" 
                          class="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-900 shrink-0 border border-white/5 shadow-inner"
                        >
                          <svg class="w-6 h-6" viewBox="0 0 128 128" fill="none">
                            <path d="M66.332 70.032c.24-4.242 2.327-7.987 5.485-10.634 3.094-2.602 7.248-4.193 11.809-4.193 4.537 0 8.69 1.59 11.78 4.193 3.163 2.647 5.237 6.392 5.485 10.634.24 4.35-1.523 8.41-4.605 11.417-3.158 3.05-7.627 4.977-12.66 4.977-5.037 0-9.526-1.915-12.664-4.977-3.094-3.006-4.853-7.044-4.606-11.397zm0 0" fill="#235785"/>
                            <path d="M39.245 79.002c.028 1.66.564 4.89 1.36 7.404 1.682 5.336 4.537 10.273 8.49 14.599 4.062 4.465 9.074 8.055 14.85 10.61 6.073 2.67 12.665 4.037 19.505 4.037 6.84-.009 13.432-1.4 19.504-4.102 5.776-2.582 10.79-6.168 14.85-10.657 3.974-4.374 6.82-9.307 8.491-14.647a37 37 0 001.595-8.163c.208-2.69.12-5.405-.263-8.12a37.535 37.535 0 00-5.417-14.714c-2.574-4.15-5.916-7.76-9.89-10.813l.012-.004-39.955-30.506c-.036-.028-.068-.056-.104-.08-2.619-2.002-7.044-1.994-9.91.008-2.914 2.031-3.25 5.385-.656 7.496l-.012.008 16.682 13.484-50.789.051h-.068c-4.197.004-8.239 2.739-9.03 6.213-.82 3.521 2.035 6.46 6.412 6.46l-.008.016 25.736-.048L4.58 82.524c-.056.044-.12.088-.176.132C.069 85.95-1.33 91.446 1.4 94.9c2.778 3.522 8.666 3.546 13.047.02L39.505 74.51s-.368 2.758-.336 4.397zm64.56 9.219c-5.168 5.228-12.416 8.21-20.227 8.21-7.831.012-15.079-2.918-20.248-8.142-2.526-2.559-4.377-5.473-5.528-8.591a22.202 22.202 0 01-1.271-9.602 22.446 22.446 0 012.778-9.039c1.507-2.714 3.59-5.18 6.14-7.267 5.033-4.058 11.42-6.28 18.1-6.28 6.709-.008 13.097 2.174 18.13 6.236 2.55 2.075 4.625 4.529 6.14 7.243a22.302 22.302 0 012.774 9.043 22.313 22.313 0 01-1.271 9.598c-1.147 3.142-3.002 6.056-5.533 8.615zm0 0" fill="#F5792A"/>
                          </svg>
                        </div>
                        <div 
                          v-else-if="ws.type === 'mirror'" 
                          class="w-8 h-8 rounded-lg flex items-center justify-center bg-[#EAB308] shrink-0 border border-yellow-400/20 shadow-inner"
                        >
                          <GraduationCap class="w-4.5 h-4.5 text-white" />
                        </div>
                        <div 
                          v-else-if="ws.type === 'manual'" 
                          class="w-8 h-8 rounded-lg flex items-center justify-center bg-[#3B82F6] shrink-0 border border-blue-400/20 shadow-inner"
                        >
                          <Box class="w-4.5 h-4.5 text-white" />
                        </div>
                        <div 
                          v-else-if="ws.type === 'team'" 
                          class="w-8 h-8 rounded-lg flex items-center justify-center bg-[#A855F7] shrink-0 border border-purple-400/20 shadow-inner"
                        >
                          <Briefcase class="w-4.5 h-4.5 text-white" />
                        </div>
                        <div
                          v-if="ws.badgeCount"
                          class="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-slate-900 px-1"
                        >
                          {{ ws.badgeCount > 99 ? '99+' : ws.badgeCount }}
                        </div>
                      </div>
                      <div class="flex flex-col text-left">
                        <span
                          class="font-semibold text-xs"
                          :class="
                            workspaceStore.activeWorkspaceId === ws.id
                              ? 'text-accent'
                              : 'text-slate-700 dark:text-slate-200'
                          "
                        >
                          {{ ws.name }}
                        </span>
                        <span class="text-[9px] text-slate-500 font-medium">
                          {{ ws.description }}
                        </span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        v-if="ws.type === 'personal' || ws.type === 'team'"
                        type="button"
                        class="p-1.5 rounded-md hover:bg-white/8 text-slate-400 hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
                        @click.stop="handleQuickSettings(ws)"
                      >
                        <Settings class="w-3.5 h-3.5" />
                      </button>
                      <div
                        v-if="workspaceStore.activeWorkspaceId === ws.id"
                        class="w-1 h-1 rounded-full bg-accent"
                      ></div>
                    </div>
                  </div>
                </el-dropdown-item>
                
                <!-- Divider and Admin Workspace (if exists) -->
                <template v-if="adminWorkspace">
                  <div class="border-t border-slate-100 dark:border-white/6 my-2"></div>
                  
                  <el-dropdown-item
                    :key="adminWorkspace.id"
                    class="rounded-lg my-1 p-2 group transition-all duration-200 relative overflow-hidden pl-3"
                    :class="workspaceStore.activeWorkspaceId === adminWorkspace.id ? 'bg-accent/5' : ''"
                    @click="handleSwitchWorkspace(adminWorkspace, $event)"
                  >
                    <!-- Active vertical indicator pill for admin -->
                    <div 
                      v-if="workspaceStore.activeWorkspaceId === adminWorkspace.id" 
                      class="absolute left-0 top-1 bottom-1 w-[3px] bg-accent rounded-r"
                    ></div>
                    
                    <div class="flex items-center justify-between w-full">
                      <div class="flex items-center gap-3">
                        <div class="relative shrink-0">
                          <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-[#10B981] shrink-0 border border-emerald-400/20 shadow-inner">
                            <UserIcon class="w-4.5 h-4.5 text-white" />
                          </div>
                          <div
                            v-if="adminWorkspace.badgeCount"
                            class="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-slate-900 px-1"
                          >
                            {{ adminWorkspace.badgeCount > 99 ? '99+' : adminWorkspace.badgeCount }}
                          </div>
                        </div>
                        <div class="flex flex-col text-left">
                          <span
                            class="font-semibold text-xs"
                            :class="
                              workspaceStore.activeWorkspaceId === adminWorkspace.id
                                ? 'text-accent'
                                : 'text-slate-700 dark:text-slate-200'
                            "
                          >
                            管理工作区 (仅管理员)
                          </span>
                          <span class="text-[9px] text-slate-500 font-medium">
                            {{ adminWorkspace.description }}
                          </span>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <Lock class="w-3.5 h-3.5 text-slate-500" />
                        <div
                          v-if="workspaceStore.activeWorkspaceId === adminWorkspace.id"
                          class="w-1 h-1 rounded-full bg-accent"
                        ></div>
                      </div>
                    </div>
                  </el-dropdown-item>
                </template>
                
                <div class="border-t border-slate-100 dark:border-white/6 my-2"></div>
                <el-dropdown-item class="rounded-lg my-0.5" @click="router.push('/explore-teams')">
                  <div class="flex items-center gap-3 py-1 text-slate-500">
                    <Plus class="w-4 h-4" />
                    <span class="font-medium">{{ $t('layout.createOrJoinTeam') }}</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </div>

      <!-- Center: Main Nav Tabs (Blender-club style) on desktop, Search on narrow screens -->
      <div class="flex-1 flex items-center justify-center px-2">
        <!-- Top Navigation Tabs — desktop only, normal workspace -->
        <nav
          v-if="showTopTabs && !isMobile"
          class="hidden lg:flex items-center gap-4"
        >
          <RouterLink
            v-for="tab in topNavTabs"
            :key="tab.key"
            :to="tab.path"
            class="topbar-tab flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
            :class="
              tab.active
                ? 'active text-accent'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/5'
            "
          >
            <component :is="tab.icon" class="w-3.5 h-3.5 shrink-0" />
            <span>{{ tab.label }}</span>
          </RouterLink>
        </nav>
        <!-- Search bar on medium screens (no tabs visible) -->
        <div
          v-else
          class="topbar-search hidden md:flex items-center gap-2 w-[260px] xl:w-[380px] h-9 px-3 rounded-lg border cursor-pointer transition-colors"
          style="background-color: var(--bg-subtle); border-color: var(--border-base)"
          @click="handleSearch"
        >
          <Search class="w-4 h-4 text-slate-400" />
          <span class="text-xs text-slate-400 flex-1">{{ $t('layout.searchPlaceholder') }}</span>
          <kbd
            class="text-[10px] px-2 py-0.5 rounded border font-mono hidden lg:inline-block"
            style="border-color: var(--border-base); color: var(--text-muted)"
            >Ctrl+K</kbd
          >
        </div>
      </div>

      <!-- Right: Actions + Avatar -->
      <div class="flex items-center justify-end gap-1.5 md:gap-2 lg:w-[300px] xl:w-[360px] shrink-0">
        <!-- Search bar for desktop mode when tabs are visible -->
        <div
          v-if="showTopTabs && !isMobile"
          class="topbar-search hidden lg:flex items-center gap-2 w-[180px] xl:w-[240px] h-8.5 px-3 rounded-lg border cursor-pointer transition-colors"
          style="background-color: var(--bg-subtle); border-color: var(--border-base)"
          @click="handleSearch"
        >
          <Search class="w-3.5 h-3.5 text-slate-400" />
          <span class="text-xs text-slate-400 flex-1">{{ $t('layout.searchPlaceholder') }}</span>
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

        <!-- User Avatar or Login Button -->
        <template v-if="authStore.isAuthenticated">
          <el-dropdown trigger="click" placement="bottom-end" @command="handleProfileClick">
            <button
              type="button"
              class="flex items-center gap-0 p-0.5 rounded-full hover:ring-2 hover:ring-accent/30 transition-all cursor-pointer outline-none"
            >
              <UserAvatar :user="authStore.user ?? undefined" size="md" />
            </button>
            <template #dropdown>
              <el-dropdown-menu class="w-56 p-2 rounded-xl border shadow-lg">
                <div class="px-3 py-2 border-b mb-1" style="border-color: var(--border-base)">
                  <p class="text-sm font-bold" style="color: var(--text-primary)">
                    {{ authStore.user?.name || '未命名用户' }}
                  </p>
                  <p class="text-[10px]" style="color: var(--text-muted)">
                    {{ authStore.user?.email }}
                  </p>
                </div>
                <el-dropdown-item command="profile" class="rounded-lg my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <UserIcon class="w-4 h-4 text-slate-400" /><span
                      class="font-medium"
                      style="color: var(--text-secondary)"
                      >{{ $t('layout.profile') }}</span
                    >
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="notifications" class="rounded-lg my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <Bell class="w-4 h-4 text-slate-400" /><span class="font-medium" style="color: var(--text-secondary)"
                      >{{ $t('layout.notifications') }}</span
                    >
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="billing" class="rounded-lg my-0.5">
                  <div class="flex items-center gap-3 py-1">
                    <CreditCard class="w-4 h-4 text-slate-400" /><span
                      class="font-medium"
                      style="color: var(--text-secondary)"
                      >{{ $t('layout.billing') }}</span
                    >
                  </div>
                </el-dropdown-item>
                <div class="border-t border-white/8 my-2"></div>
                <el-dropdown-item command="logout" class="rounded-lg my-0.5 text-rose-500">
                  <div class="flex items-center gap-3 py-1">
                    <LogOut class="w-4 h-4" /><span class="font-bold">{{ $t('layout.logout') }}</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
        style="background-color: var(--bg-app)"
      >
        <div
          v-if="systemStore.settings.MAINTENANCE_MODE && authStore.user?.role === 'ADMIN'"
          class="bg-rose-600 text-white px-6 py-2 flex items-center justify-between shrink-0 z-50 shadow-lg"
        >
          <div class="flex items-center gap-3">
            <ShieldCheck class="w-4 h-4 animate-pulse" />
            <span class="text-xs font-bold uppercase tracking-wider"
              >{{ $t('layout.maintenanceMode') }}</span
            >
          </div>
          <RouterLink
            to="/admin/settings"
            class="text-[10px] font-black underline hover:opacity-80 transition-opacity"
            >{{ $t('layout.goToDisable') }}</RouterLink
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
    <MobileSidebar
      v-model="isMobileSidebarOpen"
      :menu-groups="menuGroups"
      @report-bug="handleReportBug"
    />
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
.topbar-icon-btn:hover,
.topbar-search:hover {
  background-color: var(--bg-subtle);
}

.topbar-icon-btn {
  border-radius: var(--radius-md);
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.topbar-search {
  box-shadow: inset 0 0 0 1px transparent;
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

:deep(.mobile-search-dialog) {
  margin-bottom: 0 !important;
  border-radius: 10px !important;
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
