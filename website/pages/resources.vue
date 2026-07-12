<script setup lang="ts">
import type { PlatformPreviewItem } from '~/composables/usePlatformApi';

const config = useRuntimeConfig();
const platform = usePlatformApi();

const { data: previewData } = await useAsyncData('website-resource-preview', async () => {
  const [assets, materials, plugins] = await Promise.allSettled([
    platform.getAssets(),
    platform.getMaterials(),
    platform.getPlugins(),
  ]);
  return {
    assets: assets.status === 'fulfilled' ? assets.value.assets || [] : [],
    materials: materials.status === 'fulfilled' ? materials.value.items || [] : [],
    plugins: plugins.status === 'fulfilled' ? plugins.value.plugins || [] : [],
  };
});

const activeLibrary = ref('assets');
const libraries = computed(() => [
  {
    id: 'assets',
    number: '01',
    title: '模型库',
    description: '模型、场景与可复用的 3D 创作资产。',
    path: '/assets',
    label: '3D ASSETS',
    items: previewData.value?.assets || [],
  },
  {
    id: 'materials',
    number: '02',
    title: '材料库',
    description: '材质、贴图与创作过程中需要的视觉素材。',
    path: '/materials',
    label: 'MATERIALS',
    items: previewData.value?.materials || [],
  },
  {
    id: 'plugins',
    number: '03',
    title: '插件库',
    description: '沉淀高频工作流里真正好用的工具与扩展。',
    path: '/plugins',
    label: 'PLUGINS',
    items: previewData.value?.plugins || [],
  },
  {
    id: 'softwares',
    number: '04',
    title: '软件库',
    description: '常用软件、版本与配套工具的统一入口。',
    path: '/softwares',
    label: 'SOFTWARE',
    items: [] as PlatformPreviewItem[],
  },
]);

const currentLibrary = computed(
  () => libraries.value.find((library) => library.id === activeLibrary.value) || libraries.value[0],
);
const visibleItems = computed(() => currentLibrary.value.items.slice(0, 4));
const secureImageUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.includes('/uploads/')) {
    const match = url.match(/\/uploads\/.+/);
    if (match) return match[0];
  }
  return url.replace(/^http:\/\//, 'https://');
};
const previewImage = (item: PlatformPreviewItem) =>
  secureImageUrl(item.previewUrl || item.thumbnail);
const itemHref = (item: PlatformPreviewItem) => {
  const path = currentLibrary.value.path;
  if (currentLibrary.value.id === 'assets') return `${config.public.appBase}/assets/${item.id}`;
  return `${config.public.appBase}${path}/${item.id}`;
};

useSeoMeta({
  title: '资源中心',
  description: '浏览模型、材料、插件与软件库中的精选资源。',
});
</script>

<template>
  <section class="page-heading section-wrap">
    <p class="eyebrow">RESOURCE CENTER</p>
    <h1>把每一份积累，<br />留在恰当的位置。</h1>
    <p>从模型到材料，从插件到软件。用更直观的预览找到下一件要使用的资源。</p>
  </section>

  <section class="resource-showcase section-wrap">
    <div class="library-tabs" role="tablist" aria-label="资源库分类">
      <button
        v-for="library in libraries"
        :key="library.id"
        :class="{ active: activeLibrary === library.id }"
        type="button"
        role="tab"
        :aria-selected="activeLibrary === library.id"
        @click="activeLibrary = library.id"
      >
        <small>{{ library.number }}</small
        >{{ library.title }}
      </button>
    </div>

    <div class="library-heading">
      <div>
        <p class="eyebrow">{{ currentLibrary.label }}</p>
        <h2>{{ currentLibrary.title }}</h2>
        <p>{{ currentLibrary.description }}</p>
      </div>
      <a :href="`${config.public.appBase}${currentLibrary.path}`"
        >进入{{ currentLibrary.title }} <span>→</span></a
      >
    </div>

    <div v-if="visibleItems.length" class="library-grid">
      <a v-for="item in visibleItems" :key="item.id" class="library-card" :href="itemHref(item)">
        <img
          v-if="previewImage(item)"
          :src="previewImage(item)"
          :alt="item.title"
          loading="lazy"
          decoding="async"
        />
        <div v-else class="library-cover">
          <span>{{ currentLibrary.label }}</span>
        </div>
        <div class="library-card-copy">
          <p>{{ item.category || item.resolution || currentLibrary.title }}</p>
          <h3>{{ item.title }}</h3>
          <span>{{ item.description || '查看资源详情与使用信息。' }}</span>
        </div>
      </a>
    </div>
    <a v-else class="library-empty" :href="`${config.public.appBase}${currentLibrary.path}`">
      <span>{{ currentLibrary.label }}</span>
      <strong>{{ currentLibrary.title }}正在整理中</strong>
      <p>进入平台查看最新内容，或添加你的第一份资源。</p>
      <em>打开{{ currentLibrary.title }} →</em>
    </a>
  </section>
</template>

<style scoped>
.resource-showcase {
  padding: 30px 0 120px;
}
.library-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 7px;
}
.library-tabs button {
  flex: 0 0 auto;
  padding: 11px 15px;
  border: 1px solid var(--line);
  border-radius: 99px;
  color: var(--muted);
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
}
.library-tabs button.active {
  border-color: var(--ink);
  color: #fff;
  background: var(--ink);
}
.library-tabs small {
  margin-right: 8px;
  opacity: 0.65;
}
.library-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 30px;
  padding: 48px 0 28px;
}
.library-heading .eyebrow {
  margin-bottom: 10px;
}
.library-heading h2 {
  font-size: clamp(31px, 4vw, 48px);
}
.library-heading > div > p:last-child {
  max-width: 480px;
  margin: 13px 0 0;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.65;
}
.library-heading > a {
  flex: 0 0 auto;
  color: var(--ink);
  font-size: 14px;
  text-decoration: none;
}
.library-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.library-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  color: var(--ink);
  background: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}
.library-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 40px rgba(24, 29, 50, 0.08);
}
.library-card img,
.library-cover {
  display: block;
  width: 100%;
  height: 145px;
  object-fit: cover;
  background: linear-gradient(135deg, #cbd8ff, #f0f4ff 60%, #b8c8fa);
}
.library-cover {
  display: grid;
  place-items: center;
  color: #52679f;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.13em;
}
.library-card-copy {
  padding: 15px;
}
.library-card-copy p {
  margin: 0 0 7px;
  color: #7d8391;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.library-card-copy h3 {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  font-size: 16px;
  line-height: 1.3;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.library-card-copy span {
  display: -webkit-box;
  min-height: 37px;
  overflow: hidden;
  margin-top: 8px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.55;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.library-empty {
  display: grid;
  min-height: 330px;
  place-content: center;
  gap: 11px;
  border: 1px solid var(--line);
  border-radius: 22px;
  color: var(--ink);
  background: linear-gradient(135deg, #e3eaff, #fbfbfc 68%);
  text-align: center;
  text-decoration: none;
}
.library-empty span {
  color: #7887bb;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
}
.library-empty strong {
  font-size: 22px;
}
.library-empty p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
}
.library-empty em {
  font-size: 13px;
  font-style: normal;
}
@media (max-width: 900px) {
  .library-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 720px) {
  .library-heading {
    align-items: start;
    flex-direction: column;
    padding-top: 36px;
  }
}
</style>
