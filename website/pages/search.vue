<script setup lang="ts">
const platform = usePlatformApi();
const route = useRoute();
const query = ref(String(route.query.q || ''));
const type = ref(String(route.query.type || 'all'));
const category = ref(String(route.query.category || ''));
const tag = ref(String(route.query.tag || ''));
const page = ref(1);
const {
  data: response,
  pending,
  refresh,
} = await useAsyncData(
  'website-search',
  () =>
    platform.searchWebsite({
      q: query.value,
      type: type.value,
      category: category.value,
      tag: tag.value,
      page: page.value,
      pageSize: 18,
    }),
  { watch: [page] },
);
const hashQuery = async (value: string) => {
  if (!value || !import.meta.client || !window.crypto?.subtle) return undefined;
  const bytes = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value.trim().toLowerCase()),
  );
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
const submit = async () => {
  page.value = 1;
  void platform.trackWebsiteEvent({ event: 'search', queryHash: await hashQuery(query.value) });
  await navigateTo({
    path: '/search',
    query: {
      q: query.value || undefined,
      type: type.value !== 'all' ? type.value : undefined,
      category: category.value || undefined,
      tag: tag.value || undefined,
    },
  });
  await refresh();
};
const hrefFor = (item: any) =>
  item.type === 'mirror'
    ? `/mirrors/${item.sourceId}/resources/${item.id}`
    : `/resources/${item.type}/${item.id}`;
useSeoMeta({ title: '全站搜索', description: '搜索公开课程、模型、材料、插件、软件和镜像资源' });
</script>
<template>
  <section class="search-page section-wrap">
    <p class="eyebrow">PUBLIC SEARCH</p>
    <h1>找到下一份灵感</h1>
    <p class="search-intro">搜索官网公开展示的课程、3D 资源与镜像内容。</p>
    <form class="search-form" @submit.prevent="submit">
      <input v-model="query" autofocus placeholder="搜索标题、描述或标签" /><button>搜索</button>
    </form>
    <div class="search-filters">
      <select v-model="type">
        <option value="all">全部类型</option>
        <option value="course">课程</option>
        <option value="asset">模型</option>
        <option value="material">材料</option>
        <option value="plugin">插件</option>
        <option value="software">软件</option>
        <option value="mirror">镜像资源</option></select
      ><input v-model="category" placeholder="分类（可选）" /><input
        v-model="tag"
        placeholder="标签（可选）"
      /><button type="button" @click="submit">应用筛选</button>
    </div>
    <div class="search-result-head">
      <span v-if="response">找到 {{ response.total }} 条结果</span
      ><span v-else>输入关键词开始搜索</span>
    </div>
    <div v-if="pending" class="search-empty">正在搜索…</div>
    <div v-else-if="response?.items?.length" class="discovery-grid">
      <NuxtLink
        v-for="item in response.items"
        :key="`${item.type}-${item.id}`"
        class="discovery-card"
        :to="hrefFor(item)"
        @click="
          platform.trackWebsiteEvent({
            event: 'resource_click',
            resourceType: item.type,
            resourceId: item.id,
            sourceId: item.sourceId,
          })
        "
        ><div class="discovery-cover">
          <img
            v-if="item.officialPreviewUrl || item.thumbnail"
            :src="item.officialPreviewUrl || item.thumbnail || ''"
            :alt="item.title"
          /><span v-else>{{ item.type.toUpperCase() }}</span>
        </div>
        <div class="discovery-copy">
          <div>
            <span>{{ item.type }}</span
            ><small>{{ item.category || '公开资源' }}</small>
          </div>
          <h3>{{ item.title }}</h3>
          <p>{{ item.description || '查看公开资源介绍与预览。' }}</p>
        </div></NuxtLink
      >
    </div>
    <div v-else class="search-empty">
      <strong>没有找到匹配内容</strong>
      <p>试试更短的关键词，或清除类型和分类筛选。</p>
    </div>
    <div v-if="response && response.totalPages > 1" class="search-pagination">
      <button :disabled="page <= 1" @click="page--">上一页</button
      ><span>{{ page }} / {{ response.totalPages }}</span
      ><button :disabled="page >= response.totalPages" @click="page++">下一页</button>
    </div>
  </section>
</template>
<style scoped>
.search-page {
  padding: 52px 0 120px;
}
.search-page h1 {
  margin: 10px 0;
  font-size: clamp(38px, 6vw, 72px);
  letter-spacing: -0.07em;
}
.search-intro {
  color: var(--muted);
}
.search-form {
  display: flex;
  gap: 10px;
  margin: 36px 0 12px;
}
.search-form input {
  flex: 1;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.7);
  font: inherit;
  outline: none;
}
.search-form button,
.search-filters button {
  border: 0;
  border-radius: 14px;
  padding: 0 22px;
  color: white;
  background: var(--ink);
  font: inherit;
  cursor: pointer;
}
.search-filters {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}
.search-filters input,
.search-filters select {
  min-width: 150px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.55);
  font: inherit;
}
.search-filters button {
  padding: 10px 15px;
  font-size: 13px;
}
.search-result-head {
  margin: 38px 0 14px;
  color: var(--muted);
  font-size: 13px;
}
.search-empty {
  padding: 80px 0;
  color: var(--muted);
  text-align: center;
}
.search-empty strong {
  display: block;
  color: var(--ink);
  font-size: 18px;
}
.search-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 30px;
  color: var(--muted);
}
.search-pagination button {
  padding: 9px 14px;
  border: 0;
  border-radius: 10px;
  background: var(--ink);
  color: #fff;
}
.search-pagination button:disabled {
  opacity: 0.35;
}
</style>
