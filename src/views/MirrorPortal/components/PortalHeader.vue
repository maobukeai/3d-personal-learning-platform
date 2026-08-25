<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Search,
  Crown,
  ChevronDown,
  Moon,
  Sun,
  Layers,
  X,
  SlidersHorizontal,
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
    mirrorStore.currentStation?.displayName || mirrorStore.currentStation?.name || '数字资源中心'
  );
});

const currentStationSubtitle = computed(() => {
  try {
    const cfg = (mirrorStore.currentStation as any)?.syncConfig
      ? JSON.parse((mirrorStore.currentStation as any).syncConfig)
      : {};
    if (cfg.proxyConfig?.brandSubtitle) return cfg.proxyConfig.brandSubtitle;
  } catch {}
  return '资源资产索引与分发中心';
});

function getStationRoutePath(station: any) {
  if (!station) return '/portal';
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== 'mao.591595.xyz') {
      return '/portal';
    }
  }
  try {
    const cfg = station.syncConfig ? JSON.parse(station.syncConfig) : {};
    if (cfg.proxyConfig?.customSlug?.trim()) {
      return `/portal/${cfg.proxyConfig.customSlug.trim()}`;
    }
  } catch {}
  return `/portal/mirror/${station.id}`;
}

const currentStationHomePath = computed(() => {
  return getStationRoutePath(mirrorStore.currentStation);
});

function handleSelectStation(id: string) {
  isStationDropdownOpen.value = false;
  const target = mirrorStore.stations.find((s) => s.id === id);
  router.push(getStationRoutePath(target || { id }));
}

function handleTopSearch() {
  const targetStation = mirrorStore.currentStation;
  const targetId = targetStation?.id;
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
    router.push({ path: getStationRoutePath(targetStation), query });
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
    class="portal-header shrink-0 h-15 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-40 px-4 md:px-6 flex items-center justify-between gap-4 transition-colors"
  >
    <!-- Brand / Title & Station Selector -->
    <div class="flex items-center gap-3 shrink-0">
      <router-link :to="currentStationHomePath" class="flex items-center gap-3 group">
        <div
          class="w-8.5 h-8.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm shadow-xs overflow-hidden border border-slate-200 dark:border-slate-800 transition-transform group-hover:scale-102"
        >
          <img
            v-if="currentStationLogo"
            :src="getAssetUrl(currentStationLogo)"
            alt="Logo"
            class="w-full h-full object-cover"
          />
          <Layers v-else class="w-4.5 h-4.5" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1
              class="font-bold text-sm md:text-base text-slate-900 dark:text-slate-100 tracking-tight leading-none"
            >
              {{ currentStationName }}
            </h1>
          </div>
          <p
            class="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5 leading-none hidden sm:block"
          >
            {{ currentStationSubtitle }}
          </p>
        </div>
      </router-link>

      <!-- Multi-Station Dropdown if more than 1 station -->
      <div v-if="mirrorStore.stations.length > 1" class="relative ml-1 hidden md:block">
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700/70 transition-colors cursor-pointer"
          @click="isStationDropdownOpen = !isStationDropdownOpen"
        >
          <SlidersHorizontal class="w-3 h-3 text-slate-400" />
          <span>切换资源库</span>
          <ChevronDown class="w-3 h-3 text-slate-400" />
        </button>

        <div
          v-if="isStationDropdownOpen"
          class="absolute left-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 animate-in fade-in zoom-in-95"
        >
          <button
            v-for="st in mirrorStore.stations"
            :key="st.id"
            type="button"
            class="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50 flex items-center justify-between transition-colors cursor-pointer"
            @click="handleSelectStation(st.id)"
          >
            <span>{{ st.displayName || st.name }}</span>
            <span
              v-if="st.id === mirrorStore.currentStation?.id"
              class="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white"
            />
          </button>
        </div>
      </div>
    </div>

    <!-- Center: Refined Minimal Search Bar -->
    <div class="flex-1 max-w-lg mx-2 md:mx-4 min-w-0">
      <div class="relative flex items-center group w-full">
        <Search
          class="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-800 dark:group-focus-within:text-slate-200 transition-colors pointer-events-none"
        />
        <input
          :value="mirrorStore.searchQuery"
          type="text"
          placeholder="搜索资源、模型、材质或插件 (Enter)..."
          class="w-full h-9 pl-9.5 pr-8 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-slate-300 dark:focus:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 transition-all shadow-2xs"
          @input="mirrorStore.setSearchQuery(($event.target as HTMLInputElement).value)"
          @keyup.enter="handleTopSearch"
        />
        <button
          v-if="mirrorStore.searchQuery"
          type="button"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          @click="
            mirrorStore.setSearchQuery('');
            handleTopSearch();
          "
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Right: Auth, Membership, User -->
    <div class="flex items-center gap-2 shrink-0">
      <!-- Dark / Light mode toggle -->
      <button
        type="button"
        class="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title="切换主题"
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
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs active:scale-98 transition-all cursor-pointer"
          @click="emit('open-billing')"
        >
          <Crown class="w-3.5 h-3.5 text-amber-400 dark:text-amber-500" />
          <span>
            {{ getPlanName(authStore.user?.subscription?.plan?.priority ?? 0) }}
          </span>
          <span
            v-if="!authStore.user?.subscription?.plan?.priority"
            class="px-1.5 py-0.2 bg-white/20 dark:bg-black/10 rounded-md text-[10px]"
            >升级</span
          >
        </button>

        <!-- User Profile Trigger -->
        <button
          type="button"
          class="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/60 dark:border-slate-700/60 transition-all cursor-pointer"
          @click="emit('open-user')"
        >
          <div
            class="w-6 h-6 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center"
          >
            {{ (authStore.user?.name || authStore.user?.email || 'U').slice(0, 1).toUpperCase() }}
          </div>
          <span
            class="text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[90px] truncate hidden md:inline-block"
          >
            {{ authStore.user?.name || '个人中心' }}
          </span>
        </button>
      </template>

      <!-- If Guest (Not Logged In) -->
      <template v-else>
        <button
          type="button"
          class="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white active:scale-98 text-white dark:text-slate-900 text-xs font-bold shadow-xs transition-all cursor-pointer"
          @click="emit('open-login')"
        >
          登录 / 注册
        </button>
      </template>
    </div>
  </header>
</template>
