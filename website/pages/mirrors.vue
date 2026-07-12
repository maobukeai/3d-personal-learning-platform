<script setup lang="ts">
const platform = usePlatformApi();
const { data: mirrors } = await useAsyncData('all-mirrors', () => platform.getMirrors());
useSeoMeta({
  title: '镜像站 — 3D Personal Learning Platform',
  description: '浏览已接入的学习资源镜像站。',
});
</script>

<template>
  <section class="page-heading section-wrap">
    <p class="eyebrow">MIRROR NETWORK</p>
    <h1>连接每一处有价值的知识。</h1>
    <p>所有镜像站由同一套后台统一维护、同步和展示。</p>
  </section>
  <section class="section-wrap mirrors-list">
    <NuxtLink
      v-for="(mirror, index) in mirrors"
      :id="mirror.id"
      :key="mirror.id"
      class="mirror-row"
      :to="`/mirrors/${mirror.id}`"
      ><span>0{{ index + 1 }}</span
      ><img v-if="mirror.iconUrl" :src="mirror.iconUrl" :alt="mirror.displayName" /><i v-else>✦</i>
      <div>
        <h2>{{ mirror.displayName }}</h2>
        <p>{{ mirror.description || '持续维护的资源镜像站。' }}</p>
      </div>
      <strong>{{ mirror.totalResources.toLocaleString() }}<small>资源</small></strong></NuxtLink
    >
    <p v-if="!mirrors?.length" class="empty-copy">镜像站正在准备中。</p>
  </section>
</template>
