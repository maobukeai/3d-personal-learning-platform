<script setup lang="ts">
import type { ResourceDetail, ResourceItem } from '~/composables/usePlatformApi';
import type { Ref } from 'vue';

const platform = usePlatformApi();
const { data: homeSettings } = await useAsyncData('website-home', () => platform.getHome());
const { data: allMirrors } = await useAsyncData('all-mirrors', () => platform.getMirrors());

const sourceId = computed(() => {
  const configured = homeSettings.value?.featuredMirrorId;
  if (configured && typeof configured === 'string') {
    return configured;
  }
  const list = allMirrors.value;
  return Array.isArray(list) && list.length > 0 ? list[0].id : '';
});

const categoryId = ref<string | undefined>();
const groupId = ref<string | undefined>();
const mobileFilterOpen = ref(false);
const parentCategoryContainer = ref<HTMLElement | null>(null);
const childCategoryContainer = ref<HTMLElement | null>(null);
const parentIndicatorStyle = ref({ left: '0px', width: '0px', opacity: 0 });
const childIndicatorStyle = ref({ left: '0px', width: '0px', opacity: 0 });
const query = ref('');
const page = ref(1);
const selected = ref<ResourceDetail | null>(null);
const detailLoading = ref(false);

const { data: mirror } = await useAsyncData(
  () => `mirror-${sourceId.value}`,
  () => (sourceId.value ? platform.getMirror(sourceId.value) : Promise.resolve(null)),
  { watch: [sourceId] },
);

const { data: categories } = await useAsyncData(
  () => `mirror-categories-${sourceId.value}`,
  () => (sourceId.value ? platform.getMirrorCategories(sourceId.value) : Promise.resolve([])),
  { watch: [sourceId] },
);

const categoryGroups = computed(() => {
  const rules = [
    {
      id: 'three-d',
      label: '\u4e09\u7ef4\u521b\u4f5c',
      test: /3d|\u5efa\u6a21|\u6a21\u578b|\u6e32\u67d3|\u5ba4\u5185|\u6750\u8d28|\u573a\u666f/i,
    },
    {
      id: 'visual',
      label: '\u89c6\u89c9\u8bbe\u8ba1',
      test: /ui|\u5e73\u9762|\u8bbe\u8ba1|\u4fee\u56fe|\u6444\u5f71|\u7ed8\u753b|\u63d2\u753b|\u7535\u5546/i,
    },
    {
      id: 'media',
      label: '\u5f71\u89c6\u4e0e AIGC',
      test: /aigc|\u526a\u8f91|\u52a8\u753b|\u540e\u671f|\u5f71\u89c6|\u89c6\u9891/i,
    },
    { id: 'tools', label: '\u8f6f\u4ef6\u4e0e\u5176\u4ed6', test: /\u8f6f\u4ef6/i },
  ];
  const remaining = [...(categories.value || [])];
  const groups = rules
    .map((rule) => {
      const items = remaining.filter((category) => rule.test.test(category.name));
      items.forEach((category) => remaining.splice(remaining.indexOf(category), 1));
      return { id: rule.id, label: rule.label, categories: items };
    })
    .filter((group) => group.categories.length);
  if (remaining.length)
    groups.push({ id: 'other', label: '\u5176\u4ed6\u8d44\u6e90', categories: remaining });
  return groups;
});
const activeGroup = computed(() =>
  categoryGroups.value.find((group) => group.id === groupId.value),
);
const groupCategoryIds = computed(() =>
  activeGroup.value?.categories.map((category) => category.id).join(','),
);
watch(
  categoryGroups,
  (groups) => {
    if (!groupId.value && groups.length) groupId.value = groups[0].id;
  },
  { immediate: true },
);
const updateCategoryIndicators = () => {
  nextTick(() => {
    const measure = (
      container: HTMLElement | null,
      target: Ref<{ left: string; width: string; opacity: number }>,
    ) => {
      const active = container?.querySelector<HTMLElement>('button.active');
      if (!active || !container) return;
      const parentRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      target.value = {
        left: `${activeRect.left - parentRect.left + container.scrollLeft}px`,
        width: `${activeRect.width}px`,
        opacity: 1,
      };
    };
    measure(parentCategoryContainer.value, parentIndicatorStyle);
    measure(childCategoryContainer.value, childIndicatorStyle);
  });
};
watch([groupId, categoryId], updateCategoryIndicators);
onMounted(() => {
  updateCategoryIndicators();
  window.addEventListener('resize', updateCategoryIndicators);
});
onBeforeUnmount(() => window.removeEventListener('resize', updateCategoryIndicators));

const { data: result, refresh } = await useAsyncData(
  () => `mirror-resources-${sourceId.value}`,
  () =>
    sourceId.value
      ? platform.getMirrorResources(sourceId.value, {
          page: page.value,
          pageSize: 20,
          categoryId: categoryId.value,
          categoryIds: groupCategoryIds.value,
          q: query.value,
        })
      : Promise.resolve(null),
  { watch: [sourceId, categoryId, groupId, page] },
);

const tags = computed(() => {
  try {
    return JSON.parse(selected.value?.tags || '[]') as string[];
  } catch {
    return [];
  }
});

watch(sourceId, () => {
  categoryId.value = undefined;
  groupId.value = undefined;
  page.value = 1;
});

const selectCategory = (next?: string) => {
  categoryId.value = next;
  page.value = 1;
};
const selectGroup = (next?: string) => {
  groupId.value = next;
  categoryId.value = undefined;
  page.value = 1;
};

const search = () => {
  page.value = 1;
  refresh();
};

const showDetail = async (resource: ResourceItem) => {
  if (!sourceId.value) return;
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
  <div v-if="sourceId">
    <section class="mirror-hero section-wrap">
      <p class="eyebrow">PUBLIC RESOURCE ARCHIVE</p>
      <h1>{{ mirror?.displayName }}</h1>
      <p>
        {{ mirror?.description || '可公开浏览的资源归档。资源仅供预览与了解，不提供链接提取。' }}
      </p>
    </section>
    <section class="mirror-browser section-wrap">
      <header class="browser-header">
        <div>
          <strong>{{ result?.total ?? mirror?.totalResources ?? 0 }}</strong>
          <span> 项已归档内容</span>
        </div>
        <form class="resource-search" @submit.prevent="search">
          <input v-model="query" placeholder="搜索资源" /><button type="submit">搜索</button>
        </form>
      </header>
      <div class="category-browser" aria-label="\u8d44\u6e90\u5206\u7c7b">
        <div ref="parentCategoryContainer" class="category-rail category-parents">
          <div class="mirror-tab-indicator" :style="parentIndicatorStyle"></div>
          <button :class="{ active: !categoryId && !groupId }" @click="selectGroup()">
            全部 <small>{{ mirror?.totalResources || 0 }}</small>
          </button>
          <button
            v-for="group in categoryGroups"
            :key="group.id"
            :class="{ active: groupId === group.id }"
            @click="selectGroup(group.id)"
          >
            {{ group.label }}
            <small>{{
              group.categories.reduce((total, category) => total + category.resourceCount, 0)
            }}</small>
          </button>
        </div>
        <Transition name="subcategory-slide">
          <div v-if="activeGroup" class="category-children">
            <span class="category-level-label">{{ activeGroup.label }}</span>
            <div ref="childCategoryContainer" class="category-rail">
              <div class="mirror-tab-indicator" :style="childIndicatorStyle"></div>
              <button :class="{ active: !categoryId }" @click="selectCategory()">
                全部{{ activeGroup.label }}
              </button>
              <button
                v-for="category in activeGroup.categories"
                :key="category.id"
                :class="{ active: categoryId === category.id }"
                @click="selectCategory(category.id)"
              >
                {{ category.name }} <small>{{ category.resourceCount }}</small>
              </button>
            </div>
          </div>
        </Transition>
      </div>
      <button class="mobile-filter-trigger" type="button" @click="mobileFilterOpen = true">
        筛选分类 · {{ activeGroup?.label || '全部' }}
      </button>
      <Teleport to="body">
        <div
          v-if="mobileFilterOpen"
          class="mobile-filter-backdrop"
          @click.self="mobileFilterOpen = false"
        >
          <div class="mobile-filter-sheet">
            <div class="mobile-filter-head">
              <strong>筛选资源</strong
              ><button type="button" @click="mobileFilterOpen = false">关闭</button>
            </div>
            <div class="mobile-filter-groups">
              <button
                v-for="group in categoryGroups"
                :key="group.id"
                :class="{ active: groupId === group.id }"
                type="button"
                @click="selectGroup(group.id)"
              >
                {{ group.label }}
              </button>
            </div>
            <div v-if="activeGroup" class="mobile-filter-children">
              <button
                :class="{ active: !categoryId }"
                type="button"
                @click="
                  selectCategory();
                  mobileFilterOpen = false;
                "
              >
                全部{{ activeGroup.label }}</button
              ><button
                v-for="category in activeGroup.categories"
                :key="category.id"
                :class="{ active: categoryId === category.id }"
                type="button"
                @click="
                  selectCategory(category.id);
                  mobileFilterOpen = false;
                "
              >
                {{ category.name }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
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
            loading="lazy"
            decoding="async"
          />
          <div v-else class="resource-placeholder">✦</div>
          <p>{{ resource.category?.name || resource.resourceType || 'RESOURCE' }}</p>
          <h2>{{ resource.title }}</h2>
          <small class="resource-stats"
            >{{ resource.viewCount || 0 }} 次浏览 ·
            {{
              resource.publishedAt
                ? new Date(resource.publishedAt).toLocaleDateString()
                : '最近更新'
            }}</small
          >
          <span>{{ resource.description || '点击查看资源介绍与预览。' }}</span>
        </button>
      </div>
      <p v-if="!result?.resources?.length" class="empty-copy">没有符合条件的资源。</p>
      <div v-if="result && result.totalPages > 1" class="pagination">
        <button :disabled="page <= 1" @click="page--">上一页</button>
        <span>{{ page }} / {{ result.totalPages }}</span>
        <button :disabled="page >= result.totalPages" @click="page++">下一页</button>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="selected" class="modal-backdrop" @click.self="selected = null">
        <article class="detail-modal">
          <button class="close" aria-label="关闭详情" @click="selected = null">×</button>
          <div class="modal-cover">
            <img
              v-if="selected.thumbnailUrl"
              :src="secureImageUrl(selected.thumbnailUrl)"
              :alt="selected.title"
              decoding="async"
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
            <div
              v-else-if="selected.contentHtml"
              class="article-content"
              v-html="selected.contentHtml"
            ></div>
          </div>
        </article>
      </div>
    </Teleport>
  </div>
  <div v-else class="section-wrap mirror-empty-container">
    <p class="empty-copy">镜像站正在准备中，敬请期待。</p>
  </div>
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
  position: relative;
  display: flex;
  gap: 8px;
  overflow: auto;
  margin: 28px 0 20px;
  padding-bottom: 4px;
}
.mirror-tab-indicator {
  position: absolute;
  z-index: 0;
  top: 0;
  height: 100%;
  border-radius: 99px;
  background: var(--ink);
  pointer-events: none;
  opacity: 0;
  transition:
    left 0.18s cubic-bezier(0.22, 0.8, 0.3, 1),
    width 0.18s cubic-bezier(0.22, 0.8, 0.3, 1),
    opacity 0.12s ease;
}
.category-browser {
  margin: 28px 0 20px;
  padding: 10px;
  border: 1px solid rgba(24, 25, 30, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.38);
}
.category-browser .category-rail {
  margin: 0;
}
.category-parents {
  padding-bottom: 1px;
}
.category-children {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 10px;
  padding: 10px 0 0;
  border-top: 1px solid rgba(24, 25, 30, 0.08);
}
.category-children .category-rail {
  flex: 1;
}
.category-level-label {
  flex: 0 0 auto;
  padding: 7px 9px;
  border-radius: 8px;
  color: #5d6b9b;
  background: #e7ecfb;
  font-size: 11px;
  font-weight: 700;
}
.subcategory-slide-enter-active,
.subcategory-slide-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.16s cubic-bezier(0.22, 0.8, 0.3, 1);
}
.subcategory-slide-enter-from,
.subcategory-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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
  border-color: transparent;
  color: #fff;
  background: transparent;
  position: relative;
  z-index: 1;
}
.category-rail small {
  margin-left: 5px;
  opacity: 0.7;
}
.resource-stats {
  display: block;
  margin-top: 9px;
  color: #8a91a6;
  font-size: 11px;
}
.mobile-filter-trigger,
.mobile-filter-backdrop {
  display: none;
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
  grid-template-columns: minmax(240px, 0.75fr) 1.25fr;
  max-width: 940px;
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
.mirror-empty-container {
  padding: 120px 0;
  text-align: center;
}
@media (max-width: 900px) {
  .resource-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (max-width: 720px) {
  .category-browser {
    display: none;
  }
  .mobile-filter-trigger {
    display: block;
    width: 100%;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    color: var(--ink);
    background: rgba(255, 255, 255, 0.65);
    font: inherit;
    text-align: left;
  }
  .mobile-filter-backdrop {
    position: fixed;
    z-index: 1200;
    inset: 0;
    display: flex;
    align-items: flex-end;
    background: rgba(20, 22, 30, 0.28);
    backdrop-filter: blur(5px);
  }
  .mobile-filter-sheet {
    width: 100%;
    max-height: 72vh;
    overflow: auto;
    padding: 20px;
    border-radius: 24px 24px 0 0;
    background: #fafbff;
    box-shadow: 0 -20px 60px rgba(20, 25, 45, 0.18);
  }
  .mobile-filter-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .mobile-filter-head button {
    border: 0;
    color: var(--muted);
    background: transparent;
    font: inherit;
  }
  .mobile-filter-groups,
  .mobile-filter-children {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .mobile-filter-children {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }
  .mobile-filter-groups button,
  .mobile-filter-children button {
    padding: 9px 12px;
    border: 1px solid var(--line);
    border-radius: 99px;
    color: var(--muted);
    background: #fff;
    font: inherit;
    font-size: 13px;
  }
  .mobile-filter-groups button.active,
  .mobile-filter-children button.active {
    color: #fff;
    border-color: var(--ink);
    background: var(--ink);
  }
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
  .detail-modal {
    grid-template-columns: 1fr;
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
