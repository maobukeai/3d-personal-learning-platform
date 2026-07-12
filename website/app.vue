<script setup lang="ts">
import { computed, ref } from 'vue';

const config = useRuntimeConfig();
const platform = usePlatformApi();

const { data: platformSettings } = await useAsyncData('platform-settings', () =>
  platform.getSettings(),
);

const siteName = computed(
  () => platformSettings.value?.PLATFORM_NAME || '3D Personal Learning Platform',
);

const logoLoadFailed = ref(false);

const getAssetUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const path = url.startsWith('/') ? url : `/${url}`;
  if (path.startsWith('/uploads/')) {
    return path;
  }
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
  if (faviconUrl.value) {
    const mimeType = getFaviconMimeType(faviconUrl.value);
    // Primary icon tag
    link.push({
      rel: 'icon',
      type: mimeType,
      href: faviconUrl.value,
    });
    // Shortcut icon for older browsers
    link.push({
      rel: 'shortcut icon',
      type: mimeType,
      href: faviconUrl.value,
    });
    // Apple touch icon
    link.push({
      rel: 'apple-touch-icon',
      href: faviconUrl.value,
    });
  } else {
    link.push({
      rel: 'icon',
      type: 'image/svg+xml',
      href: '/favicon.svg',
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
      <nav aria-label="主导航">
        <NuxtLink v-for="item in nav" :key="item.to" :to="item.to">{{ item.label }}</NuxtLink>
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
