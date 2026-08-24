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
  Globe,
  X,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useMirrorStore } from '@/stores/mirror';
import { preferences } from '@/utils/preferences';
import { getPlanName } from '@/utils/plans';
import { getAssetUrl } from '@/utils/api';

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

const currentStationLogo = computed(() => {
  try {
    const cfg = (mirrorStore.currentStation as any)?.syncConfig
      ? JSON.parse((mirrorStore.currentStation as any).syncConfig)
      : {};
    if (cfg.proxyConfig?.brandLogoUrl) return cfg.proxyConfig.brandLogoUrl;
  } catch {}
  return mirrorStore.currentStation?.iconUrl || '';
});

const currentStationName = computed(() => {
  try {
    const cfg = (mirrorStore.currentStation as any)?.syncConfig
      ? JSON.parse((mirrorStore.currentStation as any).syncConfig)
      : {};
    if (cfg.proxyConfig?.brandName) return cfg.proxyConfig.brandName;
  } catch {}
  return (
    mirrorStore.currentStation?.displayName || mirrorStore.currentStation?.name || '镜像资源站'
  );
});

const currentStationSubtitle = computed(() => {
  try {
    const cfg = (mirrorStore.currentStation as any)?.syncConfig
      ? JSON.parse((mirrorStore.currentStation as any).syncConfig)
      : {};
    if (cfg.proxyConfig?.brandSubtitle) return cfg.proxyConfig.brandSubtitle;
  } catch {}
  return '高速海量数字资源库';
});

function handleSelectStation(id: string) {
  isStationDropdownOpen.value = false;
  router.push(`/portal/mirror/${id}`);
}

function handleTopSearch() {
  const targetId = mirrorStore.currentStation?.id;
  if (!targetId) return;

  const currentRoute = router.currentRoute.value;
  const query = {
    ...currentRoute.query,
    search: mirrorStore.searchQuery ? mirrorStore.searchQuery.trim() : undefined,
    page: '1',
  };

  if (currentRoute.name === 'MirrorPortalStation' || currentRoute.name === 'MirrorPortalSlug') {
    router.replace({ query });
  } else {
    router.push({ path: `/portal/mirror/${targetId}`, query });
  }

  mirrorStore.fetchResources(targetId, {
    search: mirrorStore.searchQuery ? mirrorStore.searchQuery.trim() : undefined,
    categoryId: mirrorStore.activeCategoryId || undefined,
    sort: mirrorStore.sortBy,
    page: 1,
  });
}

onMounted(() => {
  if (mirrorStore.stations.length === 0) {
    mirrorStore.fetchStations();
  }
});
</script>

<template>
  <header
    class="portal-header shrink-0 h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between gap-3"
  >
    <!-- Brand / Title & Station Selector -->
    <div class="flex items-center gap-3 shrink-0">
      <router-link to="/portal" class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 overflow-hidden border border-blue-500/30"
        >
          <img
            v-if="currentStationLogo"
            :src="getAssetUrl(currentStationLogo)"
            alt="Logo"
            class="w-full h-full object-cover"
          />
          <Zap v-else class="w-5 h-5" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1
              class="font-black text-sm md:text-base text-slate-900 dark:text-white tracking-tight leading-none"
            >
              {{ currentStationName }}
            </h1>
            <span
              class="hidden lg:inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20"
            >
              专享代理站
            </span>
          </div>
          <p class="text-[11px] text-slate-400 font-medium mt-0.5 leading-none hidden sm:block">
            {{ currentStationSubtitle }}
          </p>
        </div>
      </router-link>

      <!-- Multi-Station Dropdown if more than 1 station -->
      <div v-if="mirrorStore.stations.length > 1" class="relative ml-1 hidden md:block">
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

    <!-- Center: Top Placed Full-Featured Search Bar -->
    <div class="flex-1 max-w-xl mx-2 md:mx-4 min-w-0">
      <div class="relative flex items-center group w-full">
        <Search
          class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none"
        />
        <input
          :value="mirrorStore.searchQuery"
          type="text"
          placeholder="搜索资源、课件、材质或模型 (按 Enter 搜索)..."
          class="w-full h-9.5 pl-10 pr-9 text-xs md:text-sm rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-slate-900 transition-all shadow-xs"
          @input="mirrorStore.setSearchQuery(($event.target as HTMLInputElement).value)"
          @keyup.enter="handleTopSearch"
        />
        <button
          v-if="mirrorStore.searchQuery"
          type="button"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          @click="
            mirrorStore.setSearchQuery('');
            handleTopSearch();
          "
        >
          <X class="w-3.5 h-3.5" />
        </button>
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
