<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import {
  ChevronDown,
  User as UserIcon,
  CreditCard,
  Bell,
  LogOut,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const { t } = useI18n();

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

const handleLogout = async () => {
  authStore.logout();
  ElMessage.success(t('layout.logoutSuccess'));
  router.push('/login');
};
</script>

<template>
  <el-dropdown trigger="click" placement="bottom-end" @command="handleProfileClick">
    <button
      type="button"
      class="flex items-center gap-2 p-0.5 sm:px-2.5 sm:py-1 rounded-full sm:rounded-lg hover:bg-slate-100/5 dark:hover:bg-white/5 border border-transparent hover:border-slate-200/10 dark:hover:border-white/5 transition-all cursor-pointer outline-none"
    >
      <UserAvatar :user="authStore.user ?? undefined" size="md" />
      <div class="flex flex-col text-left leading-tight hidden sm:flex">
        <span class="text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[90px] truncate">
          {{ authStore.user?.name || '未命名用户' }}
        </span>
        <div class="mt-0.5 flex items-center">
          <span
            class="text-[9px] font-bold text-amber-600 dark:text-amber-500 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/35 dark:border-amber-500/25 rounded-full px-1.5 py-0.2 select-none leading-none scale-90 origin-left"
          >
            Lv.{{ authStore.userLevel }}
          </span>
        </div>
      </div>
      <ChevronDown class="w-3.5 h-3.5 text-slate-400 shrink-0 hidden sm:block" />
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
