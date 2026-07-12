<script setup lang="ts">
const config = useRuntimeConfig();
const destinations = [
  {
    number: '01',
    title: '3D 资产',
    description: '沉淀模型、场景与可复用的创作资产。',
    path: '/assets',
    mark: '◇',
  },
  {
    number: '02',
    title: '学习素材',
    description: '收藏教程、参考与创作过程中需要的素材。',
    path: '/materials',
    mark: '○',
  },
  {
    number: '03',
    title: '插件工具',
    description: '管理工作流中真正好用的插件与软件。',
    path: '/plugins',
    mark: '＋',
  },
  {
    number: '04',
    title: '临时网盘',
    description: '安全地存放、整理和分享阶段性文件。',
    path: '/temporary-netdisk',
    mark: '□',
  },
];
useSeoMeta({
  title: '资源中心',
  description: '进入个人学习平台，管理所有创作与学习资源。',
});
</script>

<template>
  <section class="page-heading section-wrap">
    <p class="eyebrow">RESOURCE CENTER</p>
    <h1>把每一份积累，<br />留在恰当的位置。</h1>
    <p>资源中心服务于你的个人学习和创作工作台。镜像站的公开资源则独立陈列在“镜像站”页面。</p>
  </section>
  <section class="section-wrap destination-grid">
    <a
      v-for="item in destinations"
      :key="item.path"
      class="destination-card"
      :href="`${config.public.appBase}${item.path}`"
      ><span>{{ item.number }}</span
      ><i>{{ item.mark }}</i>
      <h2>{{ item.title }}</h2>
      <p>{{ item.description }}</p>
      <b>进入工作台 →</b></a
    >
  </section>
</template>

<style scoped>
.destination-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  padding: 50px 0 120px;
}
.destination-card {
  position: relative;
  min-height: 265px;
  padding: 25px;
  border: 1px solid var(--line);
  border-radius: 21px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.42);
  text-decoration: none;
  overflow: hidden;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}
.destination-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 45px rgba(24, 29, 50, 0.08);
}
.destination-card > span {
  color: #80838d;
  font-size: 12px;
}
.destination-card i {
  position: absolute;
  right: 25px;
  top: 14px;
  color: #d0d8f5;
  font-size: 70px;
  font-style: normal;
  font-weight: 200;
}
.destination-card h2 {
  margin: 75px 0 8px;
  font-size: 27px;
}
.destination-card p {
  max-width: 290px;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.65;
}
.destination-card b {
  display: block;
  margin-top: 18px;
  font-size: 13px;
}
@media (max-width: 720px) {
  .destination-grid {
    grid-template-columns: 1fr;
  }
}
</style>
