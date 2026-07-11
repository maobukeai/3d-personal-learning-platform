<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ExternalLink,
  LogOut,
  Search,
  Box,
  LayoutDashboard,
  GraduationCap,
  MessageSquare,
  FolderTree,
  MonitorPlay,
  Sun,
  Moon,
  Menu,
} from 'lucide-vue-next';
import { toast } from '@/utils/feedbackAdapter';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { getAssetUrl } from '@/utils/api';
import NotificationCenter from './components/NotificationCenter.vue';
import WorkspaceSwitcher from './components/WorkspaceSwitcher.vue';
import UserDropdown from './components/UserDropdown.vue';
import Tabs from '@/components/ui/Tabs.vue';
import { useAppLayout } from '@/composables/useAppLayout';
import type { AppNotification } from '@/services/notification.service';
/** * Topbar * ------ * Top navigation bar: brand + workspace switcher, center nav tabs, search * trigger, theme toggle, notification center, user menu. All shell overlay * interactions (open search / open mobile sidebar) go through `useAppLayout` * so the AppShell overlay stack stays coordinated. */ defineProps<{
  /** Whether the dark theme is currently active (drives the toggle icon). */ isDark: boolean;
  /** Toggle the theme. Owned by AppShell (which owns useThemeManager). */ toggleTheme: () => void;
}>();
const emit = defineEmits<{ (e: 'show-invitation', invitationId: string): void }>();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
const { t } = useI18n();
const { isMobile, openMobileSidebar, openSearch } = useAppLayout();
const logoLoadFailed = ref(false);
watch(
  () => systemStore.settings.PLATFORM_LOGO_URL,
  () => {
    logoLoadFailed.value = false;
  },
);
const handleLogoError = () => {
  logoLoadFailed.value = true;
}; // Top navigation tabs (Blender-club style center nav)
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
  topNavTabs.value.map((tab) => ({ label: tab.label, value: tab.path, icon: tab.icon })),
);
const activeTabKey = computed({
  get() {
    const activeTab = topNavTabs.value.find((tab) => tab.active);
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
const handleLogout = async () => {
  authStore.logout();
  toast.success(t('layout.logoutSuccess'));
  router.push('/login');
};
const handleOpenInNewTab = () => {
  window.open(window.location.href, '_blank');
}; /* ---------- Notification center bridge ---------- */
interface NotificationCenterExpose {
  fetchNotifications: () => Promise<void> | void;
  addNotification: (notification: AppNotification) => void;
}
const notificationCenterRef = ref<NotificationCenterExpose | null>(null); // Expose the notification center API so AppShell can drive it from the
// Socket coordination layer without owning the component directly.
defineExpose({
  fetchNotifications: () => notificationCenterRef.value?.fetchNotifications(),
  addNotification: (notification: AppNotification) =>
    notificationCenterRef.value?.addNotification(notification),
});
</script>
<template>
  <header
    class="topbar h-12 lg:h-14 flex items-center justify-between px-3 md:px-4 shrink-0 z-30 glass-header"
  >
    <!-- Left: Brand Logo + Brand Name & Workspace Switcher -->
    <div
      class="flex items-center gap-2.5 min-w-0 lg:w-auto lg:min-w-[260px] xl:w-auto xl:min-w-[280px] shrink-0"
    >
      <button
        type="button"
        aria-label="Open menu"
        class="topbar-icon-btn w-9 h-9 flex items-center justify-center lg:hidden shrink-0 -ml-1"
        @click="openMobileSidebar()"
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
            class="typo-caption whitespace-nowrap leading-none mt-0.5"
            style="color: var(--text-secondary); font-size: 9px"
          >
            {{ systemStore.settings.PLATFORM_SUBTITLE }}
          </span>
        </div>
      </RouterLink>
      <!-- Workspace Switcher next to logo -->
      <template v-if="authStore.isAuthenticated"> <WorkspaceSwitcher /> </template>
    </div>
    <!-- Center: Main Nav Tabs (Blender-club style) on desktop, Search on narrow screens -->
    <div class="flex-1 flex items-center justify-center px-2">
      <!-- Top Navigation Tabs — desktop only, normal workspace -->
      <div v-if="showTopTabs && !isMobile" class="hidden lg:block">
        <Tabs
          v-model="activeTabKey"
          :options="topNavTabsOptions"
          size="sm"
          class="bg-transparent border-none"
        />
      </div>
      <!-- Search bar on medium screens (no tabs visible) -->
      <div
        v-else
        class="search-box hidden md:flex cursor-pointer w-[260px] xl:w-[380px] h-9"
        @click="openSearch()"
      >
        <Search /> <span class="text-xs flex-1 truncate">{{ $t('layout.searchPlaceholder') }}</span>
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
        class="search-box hidden lg:flex cursor-pointer w-[180px] xl:w-[240px] h-8.5"
        @click="openSearch()"
      >
        <Search /> <span class="text-xs flex-1 truncate">{{ $t('layout.searchPlaceholder') }}</span>
        <kbd
          class="text-[9px] px-1.5 py-0.5 rounded border font-mono hidden xl:inline-block"
          style="border-color: var(--border-base); color: var(--text-muted)"
          >Ctrl+K</kbd
        >
      </div>
      <!-- Search icon button for smaller screens / non-desktop tabs mode -->
      <button
        type="button"
        aria-label="Search"
        class="topbar-icon-btn w-9 h-9 items-center justify-center cursor-pointer"
        :class="showTopTabs && !isMobile ? 'lg:hidden flex' : 'flex md:hidden'"
        @click="openSearch()"
      >
        <Search class="w-4.5 h-4.5" style="color: var(--text-muted)" />
      </button>
      <!-- Theme Toggle Button -->
      <button
        type="button"
        class="topbar-icon-btn w-9 h-9 flex items-center justify-center cursor-pointer transition-colors"
        :title="isDark ? '切换到浅色主题' : '切换到深色主题'"
        :aria-label="isDark ? '切换到浅色主题' : '切换到深色主题'"
        @click="toggleTheme()"
      >
        <Sun v-if="isDark" class="w-4.5 h-4.5" style="color: var(--text-muted)" />
        <Moon v-else class="w-4.5 h-4.5" style="color: var(--text-muted)" />
      </button>
      <!-- Notification Bell Center Dropdown -->
      <NotificationCenter
        ref="notificationCenterRef"
        @show-invitation="(id: string) => emit('show-invitation', id)"
      />
      <!-- Open Current Page in New Tab Icon Button -->
      <button
        type="button"
        class="topbar-icon-btn w-9 h-9 flex items-center justify-center cursor-pointer transition-colors"
        title="在新标签页打开当前页面"
        aria-label="在新标签页打开当前页面"
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
        :aria-label="$t('layout.logout')"
        @click="handleLogout"
      >
        <LogOut class="w-4.5 h-4.5" style="color: var(--text-muted)" />
      </button>
      <!-- User Avatar or Login Button -->
      <template v-if="authStore.isAuthenticated"> <UserDropdown /> </template>
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
</template>
<style scoped>
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
</style>
