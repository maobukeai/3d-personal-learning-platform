<script setup lang="ts">
const route = useRoute();
const platform = usePlatformApi();
const sourceId = computed(() => String(route.params.sourceId));
const resourceId = computed(() => String(route.params.resourceId));
const { data: resource, error } = await useAsyncData(
  () => `mirror-public-resource-${sourceId.value}-${resourceId.value}`,
  () => platform.getMirrorResource(sourceId.value, resourceId.value),
);
const tags = computed(() => {
  try {
    return JSON.parse(resource.value?.tags || '[]') as string[];
  } catch {
    return [];
  }
});
const failed = ref(false);
useSeoMeta({ title: () => resource.value?.title || '镜像资源详情' });
useHead(() => ({
  meta: [
    { property: 'og:title', content: resource.value?.title || '镜像资源详情' },
    { property: 'og:description', content: resource.value?.description || '公开镜像资源预览' },
    { property: 'og:image', content: resource.value?.thumbnailUrl || '' },
  ],
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: resource.value?.title,
        description: resource.value?.description,
      }),
    },
  ],
}));
</script>
<template>
  <section v-if="resource && !error" class="mirror-detail section-wrap">
    <NuxtLink class="detail-back" :to="`/mirrors/${sourceId}`">← 返回镜像站</NuxtLink>
    <div class="mirror-detail-layout">
      <div class="mirror-detail-cover">
        <img
          v-if="resource.thumbnailUrl && !failed"
          :src="resource.thumbnailUrl"
          :alt="resource.title"
          @error="failed = true"
        /><span v-else>RESOURCE</span>
      </div>
      <article>
        <p class="eyebrow">
          {{ resource.source.displayName }} · {{ resource.category?.name || resource.resourceType }}
        </p>
        <h1>{{ resource.title }}</h1>
        <p class="description">{{ resource.description || '暂无资源介绍。' }}</p>
        <div v-if="tags.length" class="detail-tags">
          <span v-for="tag in tags" :key="tag">{{ tag }}</span>
        </div>
        <div class="mirror-meta">
          <span>浏览 {{ resource.viewCount || 0 }}</span
          ><span>{{
            resource.publishedAt ? new Date(resource.publishedAt).toLocaleDateString() : '最近更新'
          }}</span>
        </div>
        <p class="browse-note">公开详情仅供介绍与预览，不包含资源链接或提取功能。</p>
      </article>
    </div>
    <div v-if="resource.contentHtml" class="mirror-article" v-html="resource.contentHtml"></div>
  </section>
  <section v-else class="section-wrap public-empty">
    <h1>资源暂不可用</h1>
    <NuxtLink :to="`/mirrors/${sourceId}`">返回镜像站</NuxtLink>
  </section>
</template>
<style scoped>
.mirror-detail {
  padding: 42px 0 120px;
}
.detail-back {
  color: var(--muted);
  font-size: 13px;
  text-decoration: none;
}
.mirror-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 45px;
  align-items: center;
  padding: 40px 0 60px;
}
.mirror-detail-cover {
  display: grid;
  place-items: center;
  aspect-ratio: 1.35;
  overflow: hidden;
  border-radius: 25px;
  background: linear-gradient(135deg, #e1e8ff, #f7f8ff);
  color: #6d7cba;
}
.mirror-detail-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mirror-detail h1 {
  margin: 12px 0;
  font-size: clamp(32px, 5vw, 58px);
  letter-spacing: -0.06em;
}
.description {
  color: var(--muted);
  line-height: 1.8;
}
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin: 22px 0;
}
.detail-tags span {
  padding: 6px 10px;
  border-radius: 99px;
  color: #6372a8;
  background: #eef1fb;
  font-size: 12px;
}
.mirror-meta {
  display: flex;
  gap: 18px;
  color: var(--muted);
  font-size: 12px;
}
.browse-note {
  margin-top: 22px;
  padding: 12px 14px;
  border-left: 3px solid #aab8e8;
  color: var(--muted);
  background: #f0f3ff;
  font-size: 12px;
}
.mirror-article {
  max-width: 760px;
  padding-top: 28px;
  border-top: 1px solid var(--line);
  line-height: 1.8;
}
.public-empty {
  padding: 100px 0;
  text-align: center;
}
.public-empty a {
  color: var(--ink);
}
@media (max-width: 720px) {
  .mirror-detail-layout {
    grid-template-columns: 1fr;
    gap: 25px;
  }
  .mirror-detail h1 {
    font-size: 36px;
  }
}
</style>
