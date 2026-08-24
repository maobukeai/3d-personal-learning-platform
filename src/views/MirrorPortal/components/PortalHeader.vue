<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Sparkles,
  Search,
  Crown,
  User as UserIcon,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  ShieldCheck,
  Zap,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useMirrorStore } from '@/stores/mirror';
import { preferences } from '@/utils/preferences';
import { getPlanName } from '@/utils/plans';

const emit = defineEmits<{
  (e: 'open-login'): void;
  (e: 'open-billing'): void;
  (e: 'open-user'): void;
}>();

const router = useRouter();
const authStore = useAuthStore();
const mirrorStore = useMirrorStore();

const isStationDropdownOpen = ref(false);
const isDark = ref(
  typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark') || preferences.getTheme() === 'glass-dark'
    : false,
);

function toggleTheme() {
  isDark.value = !isDark.value;
  if (typeof document !== 'undefined') {
    if (isDark.value) {
      document.documentElement.classList.add('dark');
      preferences.setTheme('glass-dark');
    } else {
      document.documentElement.classList.remove('dark');
      preferences.setTheme('glass-light');
    }
  }
}

const currentStationName = computed(() => {
  return (
    mirrorStore.currentStation?.displayName || mirrorStore.currentStation?.name || '镜像资源站'
  );
});

function handleSelectStation(id: string) {
  isStationDropdownOpen.value = false;
  router.push(`/portal/mirror/${id}`);
}

onMounted(() => {
  if (mirrorStore.stations.length === 0) {
    mirrorStore.fetchStations();
  }
});
</script>

<template>
  <header
    class="portal-header sticky top-0 z-40 w-full h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 md:px-8 flex items-center justify-between gap-4 transition-colors"
  >
    <!-- Left: Brand / Station Switcher -->
    <div class="flex items-center gap-3 shrink-0">
      <router-link to="/portal" class="flex items-center gap-2.5 group">
        <div
          class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform"
        >
          <Sparkles class="w-5 h-5" />
        </div>
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="text-base font-black text-slate-900 dark:text-white tracking-tight">
              {{ currentStationName }}
            </span>
            <span
              class="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
              >专享代理站</span
            >
          </div>
          <span class="text-[10px] text-slate-400 font-medium">高速海量数字资源库</span>
        </div>
      </router-link>

      <!-- Multi-Station Dropdown if more than 1 station -->
      <div v-if="mirrorStore.stations.length > 1" class="relative ml-2">
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
          @click="isStationDropdownOpen = !isStationDropdownOpen"
        >
          <span>切换节点</span>
          <ChevronDown class="w-3 h-3" />
        </button>

        <div
          v-if="isStationDropdownOpen"
          class="absolute left-0 mt-1.5 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95"
        >
          <button
            v-for="st in mirrorStore.stations"
            :key="st.id"
            type="button"
            class="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 flex items-center justify-between"
            @click="handleSelectStation(st.id)"
          >
            <span>{{ st.displayName || st.name }}</span>
            <span
              v-if="st.id === mirrorStore.currentStation?.id"
              class="w-1.5 h-1.5 rounded-full bg-blue-600"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- Right: Auth, Membership, User -->
    <div class="flex items-center gap-2.5 shrink-0">
      <!-- Dark / Light mode toggle -->
      <button
        type="button"
        class="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        @click="toggleTheme"
      >
        <Sun v-if="isDark" class="w-4 h-4 text-amber-400" />
        <Moon v-else class="w-4 h-4" />
      </button>

      <!-- If Logged In -->
      <template v-if="authStore.isAuthenticated">
        <!-- Membership Badge / Upgrade Button -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-bold shadow-sm shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
          @click="emit('open-billing')"
        >
          <Crown class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">
            {{ getPlanName(authStore.user?.subscription?.plan?.priority ?? 0) }}
          </span>
          <span class="inline sm:hidden">VIP</span>
          <span
            v-if="!authStore.user?.subscription?.plan?.priority"
            class="px-1.5 py-0.2 bg-white/20 rounded-full text-[10px]"
            >升级</span
          >
        </button>

        <!-- User Profile Trigger -->
        <button
          type="button"
          class="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/60 transition-all cursor-pointer"
          @click="emit('open-user')"
        >
          <div
            class="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center"
          >
            {{ (authStore.user?.name || authStore.user?.email || 'U').slice(0, 1).toUpperCase() }}
          </div>
          <span
            class="text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[90px] truncate hidden md:inline-block"
          >
            {{ authStore.user?.name || '个人中心' }}
          </span>
        </button>
      </template>

      <!-- If Guest (Not Logged In) -->
      <template v-else>
        <button
          type="button"
          class="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold shadow-xs shadow-blue-500/20 transition-all cursor-pointer"
          @click="emit('open-login')"
        >
          登录 / 注册
        </button>
      </template>
    </div>
  </header>
</template>
