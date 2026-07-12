<script setup lang="ts">
const platform = usePlatformApi();
const config = useRuntimeConfig();
const { data: home } = await useAsyncData('website-home', () => platform.getHome());
const { data: mirrors } = await useAsyncData('website-mirrors', () => platform.getMirrors());

const copy = computed(() => ({
  eyebrow: String(home.value?.eyebrow || 'PERSONAL LEARNING PLATFORM'),
  title: String(home.value?.title || '把每一次学习，\n变成看得见的成长。'),
  subtitle: String(
    home.value?.subtitle ||
      '一个将课程、资源、3D 创作与协作串联起来的个人学习空间。更专注，也更自由。',
  ),
}));
useSeoMeta({
  title: '首页',
  description: '聚合学习、3D 资源与创作协作的一体化个人学习平台。',
});
</script>

<template>
  <section class="hero section-wrap">
    <div class="hero-copy">
      <p class="eyebrow">{{ copy.eyebrow }}</p>
      <h1>{{ copy.title }}</h1>
      <p class="hero-subtitle">{{ copy.subtitle }}</p>
      <div class="hero-actions">
        <a class="button button-primary" :href="config.public.appBase">开始学习 <span>→</span></a>
        <NuxtLink class="button button-quiet" to="/resources">探索资源</NuxtLink>
      </div>
    </div>
    <div class="hero-art" aria-label="学习工作台示意图">
      <div class="orb orb-a"></div>
      <div class="orb orb-b"></div>
      <div class="glass-device">
        <span class="device-dot"></span>
        <div class="device-line wide"></div>
        <div class="device-line"></div>
        <div class="device-grid"><i></i><i></i><i></i></div>
      </div>
      <div class="floating-card card-one"><b>01</b><span>学习路径</span></div>
      <div class="floating-card card-two"><b>∞</b><span>持续积累</span></div>
    </div>
  </section>

  <section class="section-wrap intro-grid">
    <p class="eyebrow">ONE QUIET PLACE</p>
    <h2>从灵感，到掌握。<br />不必切换场景。</h2>
    <p>整理课程、沉淀笔记、管理 3D 资源，在同一个简洁、连贯的工作空间里持续前进。</p>
  </section>

  <section class="section-wrap feature-grid">
    <article>
      <span>01</span>
      <h3>学习路径</h3>
      <p>以清晰进度连接目标、课程与笔记，让学习自然形成系统。</p>
    </article>
    <article>
      <span>02</span>
      <h3>资源沉淀</h3>
      <p>集中管理模型、素材与插件，资源不再散落在不同角落。</p>
    </article>
    <article>
      <span>03</span>
      <h3>协作创作</h3>
      <p>让个人积累在需要时成为团队可以共享、讨论和推进的成果。</p>
    </article>
  </section>

  <section class="section-wrap mirror-preview">
    <div class="section-heading">
      <div>
        <p class="eyebrow">MIRROR NETWORK</p>
        <h2>值得反复访问的资源。</h2>
      </div>
      <NuxtLink to="/mirrors">查看全部 <span>→</span></NuxtLink>
    </div>
    <div class="mirror-cards">
      <NuxtLink
        v-for="mirror in mirrors?.slice(0, 3)"
        :key="mirror.id"
        class="mirror-card"
        :to="`/mirrors/${mirror.id}`"
      >
        <img v-if="mirror.iconUrl" :src="mirror.iconUrl" :alt="mirror.displayName" /><span
          v-else
          class="card-icon"
          >✦</span
        >
        <h3>{{ mirror.displayName }}</h3>
        <p>{{ mirror.description || '持续同步的精选学习资源。' }}</p>
        <small>{{ mirror.totalResources.toLocaleString() }} 项资源</small>
      </NuxtLink>
      <div v-if="!mirrors?.length" class="mirror-empty">镜像站正在准备中，敬请期待。</div>
    </div>
  </section>
</template>
