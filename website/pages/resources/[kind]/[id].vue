<script setup lang="ts">
import type { WebsitePreviewItem } from '~/composables/usePlatformApi';

const route = useRoute();
const platform = usePlatformApi();
const kind = computed(() => String(route.params.kind));
const id = computed(() => String(route.params.id));
const { data: item, error } = await useAsyncData(
  () => `public-catalog-${kind.value}-${id.value}`,
  () => platform.getPublicCatalogItem(kind.value, id.value),
);
const imageFailed = ref(false);
const tags = computed(() => {
  try {
    return JSON.parse(item.value?.tags || '[]') as string[];
  } catch {
    return [];
  }
});
const previewUrl = computed(() => item.value?.officialPreviewUrl || item.value?.thumbnail || '');
useSeoMeta({
  title: () => item.value?.title || '公开资源详情',
  description: () => item.value?.description || '公开资源预览',
});
useHead(() => {
  const url = `${import.meta.client ? window.location.origin : ''}/resources/${kind.value}/${id.value}`;
  return {
    link: [{ rel: 'canonical', href: url }],
    meta: [
      { property: 'og:title', content: item.value?.title || '公开资源' },
      { property: 'og:description', content: item.value?.description || '公开资源预览' },
      { property: 'og:image', content: previewUrl.value },
      { property: 'og:url', content: url },
    ],
    script: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': kind.value === 'course' ? 'Course' : 'CreativeWork',
          name: item.value?.title,
          description: item.value?.description,
          image: previewUrl.value,
          url,
        }),
      },
    ],
  };
});
</script>

<template>
  <section v-if="item && !error" class="public-detail section-wrap">
    <NuxtLink class="detail-back" to="/resources">← 返回资源中心</NuxtLink>
    <div class="public-detail-layout">
      <div class="public-detail-cover">
        <img
          v-if="previewUrl && !imageFailed"
          :src="previewUrl"
          :alt="item.title"
          @error="imageFailed = true"
        />
        <span v-else>{{ item.type.toUpperCase() }}</span>
      </div>
      <article class="public-detail-copy">
        <div class="detail-kicker">
          <span>{{ item.type }}</span
          ><small>{{ item.category || '公开资源' }}</small>
        </div>
        <h1>{{ item.title }}</h1>
        <p class="detail-description">{{ item.description || '暂无详细介绍。' }}</p>
        <div v-if="tags.length" class="detail-tags">
          <span v-for="tag in tags" :key="tag">{{ tag }}</span>
        </div>
        <dl class="detail-meta">
          <div>
            <dt>分类</dt>
            <dd>{{ item.category || '未分类' }}</dd>
          </div>
          <div>
            <dt>更新时间</dt>
            <dd>{{ item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—' }}</dd>
          </div>
          <div>
            <dt>浏览热度</dt>
            <dd>{{ item.popularity || 0 }}</dd>
          </div>
        </dl>
        <p class="browse-note">官网仅提供公开介绍与预览，不包含下载链接或文件提取功能。</p>
      </article>
    </div>
    <section v-if="item.related?.length" class="related-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">RELATED RESOURCES</p>
          <h2>你可能还喜欢</h2>
        </div>
      </div>
      <div class="discovery-grid">
        <NuxtLink
          v-for="related in item.related"
          :key="related.id"
          class="discovery-card"
          :to="`/resources/${related.type}/${related.id}`"
          ><div class="discovery-cover">
            <img
              v-if="related.officialPreviewUrl"
              :src="related.officialPreviewUrl"
              :alt="related.title"
            />
          </div>
          <div class="discovery-copy">
            <h3>{{ related.title }}</h3>
          </div></NuxtLink
        >
      </div>
    </section>
  </section>
  <section v-else class="section-wrap public-empty">
    <h1>资源暂不可用</h1>
    <p>该资源不存在、尚未公开或已经下架。</p>
    <NuxtLink to="/resources">返回资源中心</NuxtLink>
  </section>
</template>

<style scoped>
.public-detail {
  padding: 42px 0 120px;
}
.detail-back {
  color: var(--muted);
  font-size: 13px;
  text-decoration: none;
}
.public-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 48px;
  align-items: center;
  padding: 42px 0 70px;
}
.public-detail-cover {
  display: grid;
  place-items: center;
  aspect-ratio: 1.25;
  overflow: hidden;
  border-radius: 28px;
  background: linear-gradient(135deg, #dfe6ff, #f5f7ff);
  color: #6676b5;
  font-size: 18px;
  letter-spacing: 0.16em;
}
.public-detail-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.detail-kicker {
  display: flex;
  gap: 14px;
  color: #6676b5;
  font-size: 12px;
  text-transform: uppercase;
}
.detail-kicker small {
  color: var(--muted);
  text-transform: none;
}
.public-detail-copy h1 {
  margin: 13px 0;
  font-size: clamp(32px, 5vw, 58px);
  letter-spacing: -0.06em;
  line-height: 1.08;
}
.detail-description {
  color: var(--muted);
  line-height: 1.8;
}
.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 22px;
}
.detail-tags span {
  padding: 6px 10px;
  border-radius: 99px;
  background: #eef1fb;
  color: #6372a8;
  font-size: 12px;
}
.detail-meta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 28px 0;
}
.detail-meta div {
  padding: 13px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.5);
}
.detail-meta dt {
  color: var(--muted);
  font-size: 11px;
}
.detail-meta dd {
  margin: 7px 0 0;
  font-size: 13px;
}
.browse-note {
  padding: 13px 15px;
  border-left: 3px solid #aab8e8;
  color: var(--muted);
  background: rgba(232, 237, 255, 0.5);
  font-size: 12px;
  line-height: 1.6;
}
.related-section {
  padding-top: 30px;
}
.public-empty {
  padding: 100px 0;
  text-align: center;
}
.public-empty p {
  color: var(--muted);
}
.public-empty a {
  color: var(--ink);
}
@media (max-width: 720px) {
  .public-detail-layout {
    grid-template-columns: 1fr;
    gap: 28px;
    padding-top: 28px;
  }
  .public-detail-copy h1 {
    font-size: 36px;
  }
  .detail-meta {
    gap: 7px;
  }
  .detail-meta div {
    padding: 10px;
  }
}
</style>
