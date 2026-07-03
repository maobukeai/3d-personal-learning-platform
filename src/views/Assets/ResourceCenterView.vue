<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type Component,
  defineAsyncComponent,
} from 'vue';
import { useRouter } from 'vue-router';
import { Box, Cpu, Grid3X3, Layers, LayoutList, MonitorPlay } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';

const PublishWorkDialog = defineAsyncComponent(() => import('@/components/PublishWorkDialog.vue'));
import ResourceCenterHeader from './components/ResourceCenterHeader.vue';
import ResourceFeedPanel from './components/ResourceFeedPanel.vue';
import ResourceInsightRail from './components/ResourceInsightRail.vue';
import {
  type KindFilter,
  type ResourceFeedMeta,
  type ResourceFeedResponse,
  type ResourceItem,
  type ResourceKind,
  type ResourceLibrary,
  type ResourceOverview,
  type SortMode,
  type StatusFilter,
} from './resourceCenterModel';

const router = useRouter();

type PublishCategory = 'model' | 'asset' | 'work' | 'plugin';

const overview = ref<ResourceOverview | null>(null);
const isLoading = ref(false);
const isFeedLoading = ref(false);
const isPublishDialogOpen = ref(false);
const publishCategory = ref<PublishCategory>('work');
const searchQuery = ref('');
const activeKind = ref<KindFilter>('all');
const activeStatus = ref<StatusFilter>('all');
const sortMode = ref<SortMode>('updated');
const viewMode = ref<'grid' | 'list'>('grid');
const feedItems = ref<ResourceItem[]>([]);
const feedMeta = ref<ResourceFeedMeta | null>(null);
const currentPage = ref(1);
const pageSize = 40;
let overviewRequestId = 0;
let feedRequestId = 0;
let searchTimer: number | ReturnType<typeof setTimeout> | null = null;

const kindMeta: Record<
  ResourceKind,
  { label: string; icon: Component; tone: string; path: string }
> = {
  asset: { label: '资源', icon: Box, tone: 'blue', path: '/assets' },
  material: { label: '材质', icon: Layers, tone: 'amber', path: '/materials' },
  plugin: { label: '插件', icon: Cpu, tone: 'violet', path: '/plugins' },
  showcase: { label: '展示', icon: MonitorPlay, tone: 'green', path: '/showcase' },
};

const viewModeOptions = computed(() => [
  { value: 'grid' as const, icon: Grid3X3 },
  { value: 'list' as const, icon: LayoutList },
]);

const isAdminOverview = computed(() => overview.value?.scope === 'admin');

const kindFilters = computed(() => {
  const counts = feedMeta.value?.kindCounts;

  return [
    { key: 'all' as const, label: '全部', icon: undefined, count: counts?.all || 0 },
    ...Object.entries(kindMeta).map(([key, meta]) => ({
      key: key as ResourceKind,
      label: meta.label,
      icon: meta.icon,
      count: counts?.[key as ResourceKind] || 0,
    })),
  ];
});

const statusFilters = computed(() => {
  const counts = feedMeta.value?.statusCounts;
  const countByStatus = (status: StatusFilter) => counts?.[status] || 0;

  return [
    { key: 'all' as const, label: '全部状态', count: countByStatus('all') },
    { key: 'APPROVED' as const, label: '已发布', count: countByStatus('APPROVED') },
    { key: 'PENDING' as const, label: '审核中', count: countByStatus('PENDING') },
    { key: 'REJECTED' as const, label: '需修改', count: countByStatus('REJECTED') },
  ];
});

const kindTabOptions = computed(() => {
  return kindFilters.value.map((filter) => ({
    label: `${filter.label} ${filter.count}`,
    value: filter.key,
    icon: filter.icon,
  }));
});

const statusTabOptions = computed(() => {
  return statusFilters.value.map((filter) => ({
    label: `${filter.label} ${filter.count}`,
    value: filter.key,
  }));
});

const totalPages = computed(() => {
  const meta = feedMeta.value;
  if (!meta?.total) return 1;
  return Math.max(1, Math.ceil(meta.total / meta.limit));
});

const resultTotal = computed(() => feedMeta.value?.total ?? feedItems.value.length);

const materialLibrary = computed(() =>
  overview.value?.libraries.find(
    (library) => library.key === 'materials' || library.key === 'material',
  ),
);

async function fetchOverview() {
  const requestId = ++overviewRequestId;
  isLoading.value = true;
  try {
    const { data } = await api.get('/api/resources/overview');
    if (requestId !== overviewRequestId) return;
    overview.value = {
      ...data,
      libraries: data.libraries || [],
      hotTags: data.hotTags || [],
      recentItems: data.recentItems || [],
      topItems: data.topItems || [],
      reviewQueue: data.reviewQueue || [],
    };
  } catch (error) {
    if (requestId !== overviewRequestId) return;
    ElMessage.error(getApiErrorMessage(error, '资源中心加载失败'));
  } finally {
    if (requestId === overviewRequestId) {
      isLoading.value = false;
    }
  }
}

async function fetchFeed() {
  const requestId = ++feedRequestId;
  isFeedLoading.value = true;
  try {
    const { data } = await api.get<ResourceFeedResponse>('/api/resources/feed', {
      params: {
        kind: activeKind.value,
        status: activeStatus.value,
        sort: sortMode.value,
        q: searchQuery.value.trim() || undefined,
        page: currentPage.value,
        limit: pageSize,
      },
    });
    if (requestId !== feedRequestId) return;
    feedItems.value = data.items || [];
    feedMeta.value = data.meta || null;
  } catch (error) {
    if (requestId !== feedRequestId) return;
    ElMessage.error(getApiErrorMessage(error, '资源列表加载失败'));
  } finally {
    if (requestId === feedRequestId) {
      isFeedLoading.value = false;
    }
  }
}

async function refreshAll() {
  await Promise.all([fetchOverview(), fetchFeed()]);
}

function openLibrary(library: ResourceLibrary) {
  router.push(library.path);
}

function openItem(item: ResourceItem) {
  router.push(item.path);
}

function openReviewItem(item: ResourceItem) {
  router.push(isAdminOverview.value ? item.reviewPath || item.path : item.path);
}

function openMaterialLibrary() {
  router.push(materialLibrary.value?.path || '/materials');
}

function openPublishDialog(category: PublishCategory = 'work') {
  publishCategory.value = category;
  isPublishDialogOpen.value = true;
}

function setPage(page: number) {
  currentPage.value = page;
  fetchFeed();
}

watch([activeKind, activeStatus, sortMode], () => {
  currentPage.value = 1;
  fetchFeed();
});

watch(searchQuery, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    currentPage.value = 1;
    fetchFeed();
  }, 260);
});

onMounted(refreshAll);

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <div class="resource-center-page mobile-adaptive flex flex-col h-full overflow-hidden">
    <ResourceCenterHeader
      v-model:search-query="searchQuery"
      :is-loading="isLoading"
      :is-feed-loading="isFeedLoading"
      @refresh="refreshAll"
      @publish="openPublishDialog('work')"
    />

    <div class="flex-1 overflow-y-auto p-4 pt-2.5 flex flex-col gap-3">

      <section class="resource-workbench">
        <ResourceFeedPanel
          v-model:active-kind="activeKind"
          v-model:active-status="activeStatus"
          v-model:sort-mode="sortMode"
          v-model:view-mode="viewMode"
          :feed-items="feedItems"
          :feed-meta="feedMeta"
          :is-feed-loading="isFeedLoading"
          :current-page="currentPage"
          :page-size="pageSize"
          :total-pages="totalPages"
          :result-total="resultTotal"
          :kind-tab-options="kindTabOptions"
          :status-tab-options="statusTabOptions"
          :view-mode-options="viewModeOptions"
          @set-page="setPage"
          @open-item="openItem"
          @open-material-library="openMaterialLibrary"
          @open-publish-dialog="openPublishDialog('work')"
        />

        <ResourceInsightRail
          :overview="overview"
          :kind-meta="kindMeta"
          @open-item="openItem"
          @open-review-item="openReviewItem"
          @open-publish-dialog="openPublishDialog"
          @navigate="(path) => router.push(path)"
          @search="(query) => (searchQuery = query)"
        />
      </section>
    </div>

    <PublishWorkDialog
      v-if="isPublishDialogOpen"
      v-model="isPublishDialogOpen"
      :default-category="publishCategory"
      @published="refreshAll"
    />
  </div>
</template>

<style scoped>
.resource-center-page {
  height: 100%;
  background: transparent !important;
  color: var(--text-primary);
}

.resource-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  min-height: 0;
}

@media (max-width: 1180px) {
  .resource-workbench {
    grid-template-columns: 1fr;
  }
}
</style>
