<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

const config = useRuntimeConfig();
const platform = usePlatformApi();
const route = useRoute();

const { data: platformSettings } = await useAsyncData('platform-settings', () =>
  platform.getSettings(),
);

const siteName = computed(
  () => platformSettings.value?.PLATFORM_NAME || '3D Personal Learning Platform',
);

const logoLoadFailed = ref(false);
const menuOpen = ref(false);
const isDropdownOpen = ref(false);

// Automatically close mobile menu and dropdowns when navigating to another page
watch(
  () => route.path,
  () => {
    menuOpen.value = false;
    isDropdownOpen.value = false;
  },
);

const navContainer = ref<HTMLElement | null>(null);
const navLinks = ref<any[]>([]);
const dropdownLink = ref<HTMLElement | null>(null);

const activeIndex = computed(() => {
  const path = route.path;
  if (path === '/') return 0;
  if (path.startsWith('/resources')) return 1;
  if (path.startsWith('/mirrors')) return 2;
  if (path.startsWith('/temporary-netdisk')) return 3;
  return -1;
});

const hoverIndex = ref<number | null>(null);
const targetIndex = computed(() => {
  return hoverIndex.value !== null ? hoverIndex.value : activeIndex.value;
});

interface IndicatorStyle {
  left: string;
  width: string;
  opacity: number;
}

const indicatorStyle = ref<IndicatorStyle>({
  left: '0px',
  width: '0px',
  opacity: 0,
});

const updateIndicator = () => {
  if (!import.meta.client) return;
  const idx = targetIndex.value;
  if (idx === -1) {
    indicatorStyle.value = {
      left: '0px',
      width: '0px',
      opacity: 0,
    };
    return;
  }

  nextTick(() => {
    let targetEl: HTMLElement | null = null;
    if (idx >= 0 && idx < 3) {
      const refVal = navLinks.value[idx];
      if (refVal) {
        targetEl = refVal.$el || refVal;
      }
    } else if (idx === 3) {
      targetEl = dropdownLink.value;
    }

    if (targetEl && navContainer.value) {
      const containerRect = navContainer.value.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      indicatorStyle.value = {
        left: `${targetRect.left - containerRect.left}px`,
        width: `${targetRect.width}px`,
        opacity: 1,
      };
    } else {
      indicatorStyle.value = {
        left: '0px',
        width: '0px',
        opacity: 0,
      };
    }
  });
};

watch(targetIndex, () => {
  updateIndicator();
});

watch(
  () => route.path,
  () => {
    updateIndicator();
  },
);

onMounted(() => {
  updateIndicator();
  window.addEventListener('resize', updateIndicator);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIndicator);
});

const getAssetUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.includes('/uploads/')) {
    const match = url.match(/\/uploads\/.+/);
    if (match) return match[0];
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${config.public.apiBase}${path}`;
};

const faviconUrl = computed(() => {
  const settings = platformSettings.value;
  const url = settings?.PLATFORM_FAVICON_URL || settings?.PLATFORM_LOGO_URL;
  const resolved = getAssetUrl(url);
  if (!resolved) return '';
  // Use a stable hash of the path as cache-busting key to avoid SSR/hydration mismatch.
  // This busts the cache when the setting changes (different filename) but stays stable per URL.
  const hash = resolved.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
  const sep = resolved.includes('?') ? '&' : '?';
  return `${resolved}${sep}v=${hash}`;
});

const getFaviconMimeType = (url: string): string => {
  const ext = url.split('?')[0].toLowerCase().split('.').pop();
  switch (ext) {
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'ico':
      return 'image/x-icon';
    default:
      return 'image/x-icon';
  }
};

useHead(() => {
  const link: Array<Record<string, string>> = [];
  const settings = platformSettings.value;
  const logo = settings?.PLATFORM_LOGO_URL;
  const icon = settings?.PLATFORM_FAVICON_URL;

  if (icon || logo) {
    const mimeType = getFaviconMimeType(faviconUrl.value);
    link.push({
      rel: 'icon',
      type: mimeType,
      href: faviconUrl.value,
    });
    link.push({
      rel: 'shortcut icon',
      type: mimeType,
      href: faviconUrl.value,
    });
  } else {
    link.push({
      rel: 'icon',
      type: 'image/svg+xml',
      href: '/favicon.svg',
    });
  }

  if (logo) {
    link.push({
      rel: 'apple-touch-icon',
      href: faviconUrl.value,
    });
  }
  return {
    // Dynamic title template: each page sets their own title, this appends the platform name
    titleTemplate: (pageTitle) => (pageTitle ? `${pageTitle} — ${siteName.value}` : siteName.value),
    link,
  };
});

const nav = [
  { label: '首页', to: '/' },
  { label: '资源中心', to: '/resources' },
  { label: '镜像站', to: '/mirrors' },
];
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <NuxtLink class="brand" to="/" aria-label="返回首页">
        <div
          v-if="platformSettings?.PLATFORM_LOGO_URL && !logoLoadFailed"
          class="brand-mark-logo-container"
        >
          <img
            alt="Logo"
            :src="getAssetUrl(platformSettings.PLATFORM_LOGO_URL)"
            class="brand-mark-logo"
            @error="logoLoadFailed = true"
          />
        </div>
        <span v-else class="brand-mark">S</span>
        <span>{{ siteName }}</span>
      </NuxtLink>
      <button
        class="menu-toggle"
        type="button"
        :aria-expanded="menuOpen"
        aria-controls="site-navigation"
        aria-label="切换主导航"
        @click="menuOpen = !menuOpen"
      >
        <span></span><span></span><span></span>
      </button>
      <nav
        id="site-navigation"
        ref="navContainer"
        :class="{ 'is-open': menuOpen }"
        aria-label="主导航"
        @mouseleave="hoverIndex = null"
      >
        <div class="nav-indicator" :style="indicatorStyle"></div>

        <NuxtLink
          v-for="(item, index) in nav"
          :key="item.to"
          :to="item.to"
          ref="navLinks"
          @click="menuOpen = false"
          @mouseenter="hoverIndex = index"
          >{{ item.label }}</NuxtLink
        >

        <!-- Desktop tools hover dropdown -->
        <div
          class="nav-dropdown"
          ref="dropdownLink"
          @mouseenter="
            isDropdownOpen = true;
            hoverIndex = 3;
          "
          @mouseleave="isDropdownOpen = false"
        >
          <button
            class="dropdown-trigger"
            :class="{ active: isDropdownOpen || route.path.startsWith('/temporary-netdisk') }"
            type="button"
          >
            工具 <span class="arrow-icon">▼</span>
          </button>
          <div class="dropdown-panel" :class="{ show: isDropdownOpen }">
            <NuxtLink to="/temporary-netdisk">临时网盘</NuxtLink>
          </div>
        </div>

        <!-- Mobile inline tools menu -->
        <div class="mobile-tools-group">
          <div class="mobile-tools-title">工具</div>
          <NuxtLink to="/temporary-netdisk" class="mobile-sub-link" @click="menuOpen = false"
            >临时网盘</NuxtLink
          >
        </div>
      </nav>
      <a class="header-action" :href="config.public.appBase">进入平台 <span>↗</span></a>
    </header>

    <main><NuxtPage /></main>

    <footer class="site-footer">
      <span>© {{ new Date().getFullYear() }} {{ siteName }}</span>
      <span>为持续学习而设计</span>
    </footer>
  </div>
</template>

<style scoped>
.brand-mark-logo-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  overflow: hidden;
  border-radius: 8px;
  background: transparent;
}
.brand-mark-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
