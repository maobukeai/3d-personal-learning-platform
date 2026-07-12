<script setup lang="ts">
const config = useRuntimeConfig();
const platform = usePlatformApi();
const { data: platformSettings } = await useAsyncData('platform-settings', () =>
  platform.getSettings(),
);
const siteName = computed(
  () => platformSettings.value?.PLATFORM_NAME || '3D Personal Learning Platform',
);
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
        <span class="brand-mark">S</span>
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
