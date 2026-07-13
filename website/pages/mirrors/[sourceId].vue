<script setup lang="ts">
import type { ResourceDetail, ResourceItem } from '~/composables/usePlatformApi';

const route = useRoute();
const platform = usePlatformApi();
const sourceId = computed(() => String(route.params.sourceId));
const categoryId = ref<string | undefined>();
const query = ref('');
const page = ref(1);
const selected = ref<ResourceDetail | null>(null);
const detailLoading = ref(false);

const { data: mirror } = await useAsyncData(`mirror-${sourceId.value}`, () =>
  platform.getMirror(sourceId.value),
);
const { data: categories } = await useAsyncData(`mirror-categories-${sourceId.value}`, () =>
  platform.getMirrorCategories(sourceId.value),
);
const tags = computed(() => {
  try {
    return JSON.parse(selected.value?.tags || '[]') as string[];
  } catch {
    return [];
  }
});
const { data: result, refresh } = await useAsyncData(
  `mirror-resources-${sourceId.value}`,
  () =>
    platform.getMirrorResources(sourceId.value, {
      page: page.value,
      pageSize: 20,
      categoryId: categoryId.value,
      q: query.value,
    }),
  {
    watch: [categoryId, page],
  },
);
const selectCategory = (next?: string) => {
  categoryId.value = next;
  page.value = 1;
};
const search = () => {
  page.value = 1;
  refresh();
};
const showDetail = async (resource: ResourceItem) => {
  detailLoading.value = true;
  selected.value = {
    ...resource,
    source: { id: sourceId.value, displayName: mirror.value?.displayName || '' },
  };
  try {
    selected.value = await platform.getMirrorResource(sourceId.value, resource.id);
  } finally {
    detailLoading.value = false;
  }
};
const cleanContentHtml = computed(() => {
  const html = selected.value?.contentHtml || '';
  return html.replace(
    /<!-- MANUAL_DOWNLOAD_LINK_START -->[\s\S]*?<!-- MANUAL_DOWNLOAD_LINK_END -->/g,
    '',
  );
});
const secureImageUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.includes('/uploads/')) {
    const match = url.match(/\/uploads\/.+/);
    if (match) return match[0];
  }
  return url.replace(/^http:\/\//, 'https://');
};
useSeoMeta({
  title: () => mirror.value?.displayName || '镜像站',
});
</script>

<template>
  <section class="mirror-hero section-wrap">
    <NuxtLink class="back-link" to="/mirrors">← 返回镜像站</NuxtLink>
    <p class="eyebrow">PUBLIC RESOURCE ARCHIVE</p>
    <h1>{{ mirror?.displayName }}</h1>
    <p>{{ mirror?.description || '可公开浏览的资源归档。资源仅供预览与了解，不提供链接提取。' }}</p>
  </section>
  <section class="mirror-browser section-wrap">
    <header class="browser-header">
      <div>
        <strong>{{ result?.total ?? mirror?.totalResources ?? 0 }}</strong
        ><span> 项已归档内容</span>
      </div>
      <form class="resource-search" @submit.prevent="search">
        <input v-model="query" placeholder="搜索资源" /><button type="submit">搜索</button>
      </form>
    </header>
    <div class="category-rail">
      <button :class="{ active: !categoryId }" type="button" @click="selectCategory()">
        全部 <small>{{ mirror?.totalResources || 0 }}</small>
      </button>
      <button
        v-for="category in categories"
        :key="category.id"
        :class="{ active: categoryId === category.id }"
        type="button"
        @click="selectCategory(category.id)"
      >
        {{ category.name }} <small>{{ category.resourceCount }}</small>
      </button>
    </div>
    <div class="resource-grid">
      <button
        v-for="resource in result?.resources"
        :key="resource.id"
        class="resource-card"
        @click="showDetail(resource)"
      >
        <img
          v-if="resource.thumbnailUrl"
          :src="secureImageUrl(resource.thumbnailUrl)"
          :alt="resource.title"
        />
        <div v-else class="resource-placeholder">✦</div>
        <p>{{ resource.category?.name || resource.resourceType || 'RESOURCE' }}</p>
        <h2>{{ resource.title }}</h2>
        <span>{{ resource.description || '点击查看资源介绍与预览。' }}</span>
      </button>
    </div>
    <p v-if="!result?.resources?.length" class="empty-copy">没有符合条件的资源。</p>
    <div v-if="result && result.totalPages > 1" class="pagination">
      <button :disabled="page <= 1" @click="page--">上一页</button
      ><span>{{ page }} / {{ result.totalPages }}</span
      ><button :disabled="page >= result.totalPages" @click="page++">下一页</button>
    </div>
  </section>

  <Teleport to="body"
    ><div v-if="selected" class="modal-backdrop" @click.self="selected = null">
      <article class="detail-modal">
        <button class="close" aria-label="关闭详情" @click="selected = null">×</button>
        <div class="modal-cover">
          <img
            v-if="selected.thumbnailUrl"
            :src="secureImageUrl(selected.thumbnailUrl)"
            :alt="selected.title"
          /><span v-else>✦</span>
        </div>
        <div class="modal-body">
          <p class="eyebrow">
            {{ selected.category?.name || selected.resourceType || 'RESOURCE' }}
          </p>
          <h2>{{ selected.title }}</h2>
          <p class="description">{{ selected.description || '暂无资源简介。' }}</p>
          <div v-if="tags.length" class="tags">
            <span v-for="tag in tags" :key="tag">{{ tag }}</span>
          </div>
          <p class="browse-only">公开详情仅提供介绍与预览，不包含资源链接或提取功能。</p>
          <p v-if="detailLoading" class="loading">正在加载详情…</p>
          <div v-else-if="cleanContentHtml" class="article-content" v-html="cleanContentHtml"></div>
        </div>
      </article></div
  ></Teleport>
</template>

<style scoped>
.mirror-hero {
  padding: 38px 0 24px;
  border-bottom: 1px solid var(--line);
}
.mirror-hero h1 {
  margin: 6px 0 10px;
  font-size: clamp(28px, 3.5vw, 42px);
  letter-spacing: -0.05em;
}
.mirror-hero > p:not(.eyebrow) {
  max-width: 600px;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}
.back-link {
  display: inline-block;
  margin-bottom: 24px;
  color: var(--muted);
  font-size: 13px;
  text-decoration: none;
}
.mirror-browser {
  padding: 34px 0 120px;
}
.browser-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 25px;
}
.browser-header strong {
  font-size: 28px;
  letter-spacing: -0.06em;
}
.browser-header span {
  margin-left: 6px;
  color: var(--muted);
  font-size: 13px;
}
.resource-search {
  display: flex;
  gap: 8px;
}
.resource-search input {
  width: 240px;
  padding: 11px 13px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.6);
  font: inherit;
  outline: none;
}
.resource-search button,
.pagination button {
  padding: 0 15px;
  border: 0;
  border-radius: 11px;
  color: #fff;
  background: var(--ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.category-rail {
  display: flex;
  gap: 8px;
  overflow: auto;
  margin: 28px 0 20px;
  padding-bottom: 4px;
}
.category-rail button {
  white-space: nowrap;
  padding: 9px 12px;
  border: 1px solid var(--line);
  border-radius: 99px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.45);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.category-rail button.active {
  border-color: var(--ink);
  color: #fff;
  background: var(--ink);
}
.category-rail small {
  margin-left: 5px;
  opacity: 0.7;
}
.resource-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 13px;
}
.resource-card {
  min-height: 264px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 17px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.45);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}
.resource-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 38px rgba(24, 29, 50, 0.08);
}
.resource-card img,
.resource-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 112px;
  border-radius: 10px;
  object-fit: cover;
  color: #7484c5;
  font-size: 20px;
  background: linear-gradient(135deg, #d8e0fb, #eef4ff);
}
.resource-card p {
  margin: 15px 0 6px;
  color: #81838b;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.resource-card h2 {
  display: -webkit-box;
  overflow: hidden;
  font-size: 16px;
  line-height: 1.3;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.resource-card > span {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 7px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.pagination {
  display: flex;
  justify-content: center;
  gap: 15px;
  align-items: center;
  margin-top: 35px;
  color: var(--muted);
  font-size: 13px;
}
.pagination button {
  height: 36px;
}
.pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.modal-backdrop {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(20, 22, 30, 0.3);
  backdrop-filter: blur(8px);
}
.detail-modal {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  max-width: 600px;
  width: 100%;
  height: min(760px, calc(100vh - 48px));
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 24px;
  background: #fafafb;
  box-shadow: 0 30px 100px rgba(0, 0, 0, 0.22);
}
.close {
  position: absolute;
  z-index: 200;
  right: 14px;
  top: 12px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  color: #444;
  background: rgba(255, 255, 255, 0.82);
  font-size: 25px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition:
    background 0.15s,
    transform 0.15s;
}
.close:hover {
  transform: scale(1.05);
  background: rgba(255, 255, 255, 0.95);
}
.modal-cover {
  display: none;
  height: 100%;
  overflow: hidden;
  background: #edf1ff;
}
.modal-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.modal-cover span {
  display: grid;
  place-items: center;
  height: 100%;
  color: #8291c8;
  font-size: 32px;
}
.modal-body {
  padding: 42px 38px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.modal-body h2 {
  margin: 0;
  font-size: 30px;
  line-height: 1.2;
}
.description {
  margin: 0;
  color: var(--muted);
  line-height: 1.75;
}
.tags {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.tags span {
  padding: 5px 8px;
  border-radius: 99px;
  color: #66709a;
  background: #e8ecf8;
  font-size: 11px;
}
.browse-only {
  margin: 0;
  padding: 12px;
  border: 1px solid #dce3f9;
  border-radius: 11px;
  color: #596583;
  background: #f2f5ff;
  font-size: 12px;
  line-height: 1.6;
}
.loading {
  color: var(--muted);
  font-size: 13px;
}
.article-content {
  padding-top: 15px;
  color: #363942;
  font-size: 14px;
  line-height: 1.8;
}
.article-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
}
.article-content :deep(a) {
  pointer-events: none;
  color: inherit;
  text-decoration: none;
}
@media (max-width: 900px) {
  .resource-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 720px) {
  .browser-header {
    align-items: stretch;
    flex-direction: column;
  }
  .resource-search input {
    width: 100%;
  }
  .resource-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .category-children {
    align-items: stretch;
    flex-direction: column;
  }
  .category-children .category-rail {
    width: 100%;
  }
  .detail-modal {
    grid-template-columns: 1fr;
    max-width: 100%;
  }
  .modal-cover {
    display: block;
  }
  .modal-cover img {
    max-height: 220px;
    min-height: 0;
  }
  .modal-body {
    padding: 30px 22px;
  }
  .modal-body h2 {
    font-size: 27px;
  }
}
</style>
