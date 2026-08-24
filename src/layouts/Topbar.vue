<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Box,
  Search,
  Menu,
  ClipboardList,
  BookOpen,
  FolderTree,
  MonitorPlay,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { getAssetUrl } from '@/utils/api';
import { preferences, type SidebarMode } from '@/utils/preferences';
import WorkspaceSwitcher from './components/WorkspaceSwitcher.vue';
import TopNavMenu from './components/TopNavMenu.vue';
import TopRightActions from './components/TopRightActions.vue';
import Tabs from '@/components/ui/Tabs.vue';
import { useAppLayout } from '@/composables/useAppLayout';
import type { AppNotification } from '@/services/notification.service';

defineProps<{
  isDark: boolean;
  toggleTheme: () => void;
}>();

const emit = defineEmits<{
  (e: 'show-invitation', invitationId: string): void;
  (e: 'search'): void;
  (e: 'open-mobile-sidebar'): void;
}>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const systemStore = useSystemStore();
const { t } = useI18n();
const { isMobile, openMobileSidebar, openSearch } = useAppLayout();
const logoLoadFailed = ref(false);

const sidebarMode = ref<SidebarMode>(preferences.getSidebarMode());

const updateSidebarMode = (e?: Event) => {
  if (e && (e as CustomEvent).detail?.mode) {
    sidebarMode.value = (e as CustomEvent).detail.mode;
  } else {
    sidebarMode.value = preferences.getSidebarMode();
  }
};

onMounted(() => {
  window.addEventListener('sidebar-mode-changed', updateSidebarMode);
  window.addEventListener('storage', updateSidebarMode);
});

onUnmounted(() => {
  window.removeEventListener('sidebar-mode-changed', updateSidebarMode);
  window.removeEventListener('storage', updateSidebarMode);
});

const isTopMode = computed(() => sidebarMode.value === 'top');

watch(
  () => systemStore.settings.PLATFORM_LOGO_URL,
  () => {
    logoLoadFailed.value = false;
  },
);

const handleLogoError = () => {
  logoLoadFailed.value = true;
};

const handleMenuClick = () => {
  openMobileSidebar();
  emit('open-mobile-sidebar');
};

const handleSearchClick = () => {
  openSearch();
  emit('search');
};

// Standard center navigation tabs (when not in full topbar mode)
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
  return (
    !route.path.startsWith('/admin') &&
    !route.path.startsWith('/mirror') &&
    !route.path.startsWith('/manual')
  );
});

interface TopRightActionsExpose {
  fetchNotifications: () => Promise<void> | void;
  addNotification: (notification: AppNotification) => void;
}
const rightActionsRef = ref<TopRightActionsExpose | null>(null);

defineExpose({
  fetchNotifications: () => rightActionsRef.value?.fetchNotifications(),
  addNotification: (notification: AppNotification) =>
    rightActionsRef.value?.addNotification(notification),
});
</script>

<template>
  <header
    class="topbar h-12 lg:h-14 flex items-center justify-between px-3 md:px-4 shrink-0 z-30 glass-header"
  >
    <!-- Left: Brand Logo + Brand Name & Workspace Switcher -->
    <div class="flex items-center gap-2 min-w-0 shrink-0">
      <button
        type="button"
        aria-label="Open menu"
        class="topbar-icon-btn w-9 h-9 flex items-center justify-center lg:hidden shrink-0 -ml-1"
        @click="handleMenuClick"
      >
        <Menu class="w-5 h-5" style="color: var(--text-muted)" />
      </button>

      <!-- Brand Logo & Name -->
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
            style="color: var(--text-secondary); font-size: 10px"
          >
            {{ systemStore.settings.PLATFORM_SUBTITLE }}
          </span>
        </div>
      </RouterLink>

      <!-- Workspace Switcher -->
      <template v-if="authStore.isAuthenticated">
        <WorkspaceSwitcher />
      </template>
    </div>

    <!-- Center: Categorized Top Nav (in Top Mode) OR Main Nav Tabs (in standard mode) -->
    <div class="flex-1 flex items-center justify-center px-2">
      <!-- In Full Topbar Mode: Show Full Categorized Navigation Menu -->
      <div v-if="isTopMode && !isMobile" class="hidden lg:flex items-center gap-2">
        <TopNavMenu />
      </div>

      <!-- In Standard / Classic Mode: Show Center Tabs -->
      <div v-else-if="showTopTabs && !isMobile" class="hidden lg:block">
        <Tabs
          v-model="activeTabKey"
          :options="topNavTabsOptions"
          size="sm"
          class="bg-transparent border-none"
        />
      </div>

      <!-- Search bar on medium screens -->
      <div
        v-else
        class="search-box hidden md:flex cursor-pointer w-[260px] xl:w-[380px] h-9"
        @click="handleSearchClick"
      >
        <Search />
        <span class="text-xs flex-1 truncate">{{ $t('layout.searchPlaceholder') }}</span>
        <kbd
          class="text-[10px] px-2 py-0.5 rounded border font-mono hidden lg:inline-block"
          style="border-color: var(--border-base); color: var(--text-muted)"
        >
          Ctrl+K
        </kbd>
      </div>
    </div>

    <!-- Right: Actions + App Launcher + Avatar -->
    <TopRightActions
      ref="rightActionsRef"
      :is-dark="isDark"
      :toggle-theme="toggleTheme"
      @search="emit('search')"
      @show-invitation="(id: string) => emit('show-invitation', id)"
    />
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
