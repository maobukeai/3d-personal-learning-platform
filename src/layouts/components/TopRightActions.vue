<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ExternalLink, LogOut, Search, Sun, Moon } from 'lucide-vue-next';
import { toast } from '@/utils/feedbackAdapter';
import { useAuthStore } from '@/stores/auth';
import NotificationCenter from './NotificationCenter.vue';
import UserDropdown from './UserDropdown.vue';
import TopAppLauncher from './TopAppLauncher.vue';
import { useAppLayout } from '@/composables/useAppLayout';
import type { AppNotification } from '@/services/notification.service';

defineProps<{
  isDark: boolean;
  toggleTheme: () => void;
}>();

const emit = defineEmits<{
  (e: 'show-invitation', invitationId: string): void;
  (e: 'search'): void;
}>();

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { t } = useI18n();
const { isMobile, openSearch } = useAppLayout();

const handleSearchClick = () => {
  openSearch();
  emit('search');
};

const handleLogout = async () => {
  authStore.logout();
  toast.success(t('layout.logoutSuccess'));
  router.push('/login');
};

const handleOpenInNewTab = () => {
  window.open(window.location.href, '_blank');
};

interface NotificationCenterExpose {
  fetchNotifications: () => Promise<void> | void;
  addNotification: (notification: AppNotification) => void;
}
const notificationCenterRef = ref<NotificationCenterExpose | null>(null);

defineExpose({
  fetchNotifications: () => notificationCenterRef.value?.fetchNotifications(),
  addNotification: (notification: AppNotification) =>
    notificationCenterRef.value?.addNotification(notification),
});
</script>

<template>
  <div class="flex items-center justify-end gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
    <!-- All Apps Launcher Matrix (Always available) -->
    <TopAppLauncher />

    <!-- Search bar for desktop mode -->
    <div
      v-if="!isMobile"
      class="search-box hidden lg:flex cursor-pointer w-[160px] xl:w-[200px] h-8.5"
      @click="handleSearchClick"
    >
      <Search />
      <span class="text-xs flex-1 truncate">{{ $t('layout.searchPlaceholder') }}</span>
      <kbd
        class="text-[10px] px-1.5 py-0.5 rounded border font-mono hidden xl:inline-block"
        style="border-color: var(--border-base); color: var(--text-muted)"
      >
        Ctrl+K
      </kbd>
    </div>

    <!-- Search icon button for smaller screens -->
    <button
      type="button"
      aria-label="Search"
      class="topbar-icon-btn w-8.5 h-8.5 flex lg:hidden items-center justify-center cursor-pointer"
      @click="handleSearchClick"
    >
      <Search class="w-4 h-4" style="color: var(--text-muted)" />
    </button>

    <!-- Theme Toggle Button -->
    <button
      type="button"
      class="topbar-icon-btn w-8.5 h-8.5 flex items-center justify-center cursor-pointer transition-colors"
      :title="isDark ? '切换到浅色主题' : '切换到深色主题'"
      :aria-label="isDark ? '切换到浅色主题' : '切换到深色主题'"
      @click="toggleTheme()"
    >
      <Sun v-if="isDark" class="w-4 h-4" style="color: var(--text-muted)" />
      <Moon v-else class="w-4 h-4" style="color: var(--text-muted)" />
    </button>

    <!-- Notification Bell Center Dropdown -->
    <NotificationCenter
      ref="notificationCenterRef"
      @show-invitation="(id: string) => emit('show-invitation', id)"
    />

    <!-- Open Current Page in New Tab -->
    <button
      type="button"
      class="topbar-icon-btn w-8.5 h-8.5 flex items-center justify-center cursor-pointer transition-colors"
      title="在新标签页打开当前页面"
      aria-label="在新标签页打开当前页面"
      @click="handleOpenInNewTab"
    >
      <ExternalLink class="w-4 h-4" style="color: var(--text-muted)" />
    </button>

    <!-- Direct Logout Button -->
    <button
      v-if="authStore.isAuthenticated"
      type="button"
      class="topbar-icon-btn w-8.5 h-8.5 hidden sm:flex items-center justify-center cursor-pointer transition-colors relative"
      :title="$t('layout.logout')"
      :aria-label="$t('layout.logout')"
      @click="handleLogout"
    >
      <LogOut class="w-4 h-4" style="color: var(--text-muted)" />
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
</template>

<style scoped>
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
