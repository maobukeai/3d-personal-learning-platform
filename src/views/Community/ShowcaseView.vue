<script setup lang="ts">
import { formatCompactNumber as formatNumber } from '@/utils/format';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Award,
  Box,
  Clock,
  Download,
  Eye,
  Filter,
  Flame,
  Grid3X3,
  Heart,
  Image,
  LayoutList,
  Layers3,
  MessageCircle,
  MonitorPlay,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Type,
  Users,
  Video,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { useAuthStore } from '@/stores/auth';
import { parseTags } from '@/utils/tags';

import PageHeader from '@/components/PageHeader.vue';
import PublishShowcaseDialog from '@/components/PublishShowcaseDialog.vue';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import ShowcaseDetail from './components/ShowcaseDetail.vue';
import Button from '@/components/ui/Button.vue';
import ShowcaseFilterPanel from './components/ShowcaseFilterPanel.vue';
import ShowcaseControls from './components/ShowcaseControls.vue';
import ShowcaseGrid from './components/ShowcaseGrid.vue';
import ShowcaseRail from './components/ShowcaseRail.vue';
import type {
  ShowcaseSortKey,
  ShowcaseScope,
  ShowcaseBucket,
  ShowcaseType,
  ShowcaseItem,
  ShowcaseStats,
  ShowcaseUser,
} from './components/showcaseTypes';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isAdmin = computed(() => authStore.user?.role === 'ADMIN');
const isPublishDialogOpen = ref(false);
const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const searchInput = ref('');
const searchQuery = ref('');
const activeSort = ref<ShowcaseSortKey>('trending');
const activeType = ref<ShowcaseType | 'all'>('all');
const activeScope = ref<ShowcaseScope>('all');
const activeBucket = ref<ShowcaseBucket>('all');
const viewMode = ref<'grid' | 'list'>('grid');
const viewModeOptions = computed<Array<{ value: 'grid' | 'list'; label: string; icon: Component }>>(
  () => [
    { value: 'grid', label: '', icon: Grid3X3 },
    { value: 'list', label: '', icon: LayoutList },
  ],
);
const showInsights = ref(false);
const isFilterOpen = ref(false);
const showcases = ref<ShowcaseItem[]>([]);
const page = ref(1);
const total = ref(0);
const hasMore = ref(false);
const isLoading = ref(false);
const isLoadingMore = ref(false);
const statsLoading = ref(false);
const stats = ref<ShowcaseStats | null>(null);

const isDetailOpen = ref(false);
const detailItem = ref<ShowcaseItem | null>(null);

const sortOptions: Array<{
  value: ShowcaseSortKey;
  label: string;
  hint: string;
  icon: Component;
}> = [
  { value: 'trending', label: '趋势', hint: '近期互动热度', icon: TrendingUp },
  { value: 'popular', label: '热门', hint: '点赞优先', icon: Flame },
  { value: 'featured', label: '精选', hint: '综合评分', icon: Award },
  { value: 'newest', label: '最新', hint: '发布时间', icon: Clock },
  { value: 'viewed', label: '浏览', hint: '访问最多', icon: Eye },
  { value: 'discussed', label: '讨论', hint: '评论最多', icon: MessageCircle },
];

const scopeOptions: Array<{ value: ShowcaseScope; label: string; icon: Component }> = [
  { value: 'all', label: '全站', icon: Users },
  { value: 'my', label: '我的发布', icon: Sparkles },
  { value: 'liked', label: '我赞过', icon: Heart },
];

const typeOptions: Array<{ value: ShowcaseType | 'all'; label: string; icon: Component }> = [
  { value: 'all', label: '全部', icon: Filter },
  { value: 'IMAGE', label: '图片', icon: Image },
  { value: 'VIDEO', label: '视频', icon: Video },
  { value: 'MODEL', label: '3D模型', icon: Box },
  { value: 'TEXT', label: '文本', icon: Type },
  { value: 'OTHER', label: '其他', icon: Layers3 },
];

let searchTimer: ReturnType<typeof setTimeout> | undefined;

const getRouteWorkId = () => {
  const work = route.query.work;
  return Array.isArray(work) ? work[0] : work;
};

const setWorkQuery = (workId: string | null) => {
  const query = { ...route.query };
  if (workId) {
    query.work = workId;
  } else {
    delete query.work;
  }
  router.replace({ query }).catch(() => undefined);
};

const pendingReviewCount = computed(() => stats.value?.myPendingWorks ?? 0);

const scopeTabOptions = computed(() =>
  scopeOptions.map((option) => ({
    label: option.label,
    value: option.value,
    icon: option.icon,
  })),
);

const smartFilterTabOptions = computed<
  Array<{
    value: ShowcaseBucket;
    label: string;
    hint: string;
    metric: string;
    icon: Component;
  }>
>(() => [
  {
    value: 'all',
    label: '全部作品',
    hint: '当前结果',
    metric: formatNumber(total.value || stats.value?.totalWorks || showcases.value.length),
    icon: MonitorPlay,
  },
  {
    value: 'fresh',
    label: '本周上新',
    hint: '7 天内发布',
    metric: formatNumber(stats.value?.weekWorks ?? 0),
    icon: Clock,
  },
  {
    value: 'downloadable',
    label: '可下载',
    hint: '含关联资源',
    metric: formatNumber(
      stats.value?.downloadableWorks ??
        showcases.value.filter((item) => item.assetId || item.asset).length,
    ),
    icon: Download,
  },
  {
    value: 'discussed',
    label: '有讨论',
    hint: '已产生评论',
    metric: formatNumber(
      stats.value?.discussedWorks ??
        showcases.value.filter((item) => item.commentsCount > 0).length,
    ),
    icon: MessageCircle,
  },
  {
    value: 'pending',
    label: '待审核',
    hint: '我的队列',
    metric: formatNumber(stats.value?.myPendingWorks ?? 0),
    icon: ShieldCheck,
  },
]);

const typeTabOptions = computed(() =>
  typeOptions.map((option) => ({
    label: option.label,
    value: option.value,
    icon: option.icon,
  })),
);

const sortTabOptions = computed(() =>
  sortOptions.map((option) => ({
    label: option.label,
    value: option.value,
    icon: option.icon,
  })),
);

const resetFilters = () => {
  searchInput.value = '';
  searchQuery.value = '';
  activeScope.value = 'all';
  activeType.value = 'all';
  activeBucket.value = 'all';
  activeSort.value = 'trending';
};

const setBucket = (bucket: ShowcaseBucket) => {
  activeBucket.value = bucket;
  if (bucket === 'pending' || bucket === 'rejected') {
    activeScope.value = 'my';
  }
};

const topTags = computed(() => {
  if (stats.value?.topTags.length) return stats.value.topTags;
  const usage = new Map<string, number>();
  showcases.value.forEach((item) => {
    parseTags(item.tags).forEach((tag) => usage.set(tag, (usage.get(tag) ?? 0) + 1));
  });
  return Array.from(usage.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
});

const topCreators = computed(() => stats.value?.topCreators ?? []);
const recentActivity = computed(() => stats.value?.recentActivity ?? []);

const typeBreakdown = computed(() => {
  const groups = stats.value?.typeBreakdown ?? [];
  const totalCount = groups.reduce((sum, group) => sum + group.count, 0);
  return typeOptions
    .filter((option) => option.value !== 'all')
    .map((option) => {
      const group = groups.find((item) => item.type === option.value);
      const count =
        group?.count ?? showcases.value.filter((item) => item.type === option.value).length;
      return {
        ...option,
        count,
        percent: totalCount ? Math.round((count / totalCount) * 100) : 0,
      };
    });
});

const resultSummary = computed(() => {
  const shown = showcases.value.length;
  const count = total.value || shown;
  if (searchQuery.value) return `搜索「${searchQuery.value}」共 ${formatNumber(count)} 个结果`;
  return `已展示 ${formatNumber(shown)} / ${formatNumber(count)} 个作品`;
});

const fetchStats = async () => {
  statsLoading.value = true;
  try {
    const response = await api.get('/api/showcase/stats');
    stats.value = response.data;
  } catch (error) {
    logError(error, { operation: 'showcase.fetchStats', component: 'ShowcaseView' });
  } finally {
    statsLoading.value = false;
  }
};

const fetchShowcases = async (append = false) => {
  if (append) {
    isLoadingMore.value = true;
  } else {
    isLoading.value = true;
  }
  const nextPage = append ? page.value + 1 : 1;
  try {
    const response = await api.get('/api/showcase', {
      params: {
        sort: activeSort.value,
        type: activeType.value,
        scope: activeScope.value,
        bucket: activeBucket.value,
        q: searchQuery.value,
        page: nextPage,
        limit: viewMode.value === 'list' ? 60 : 36,
        withMeta: true,
      },
    });
    const payload = response.data;
    const items: ShowcaseItem[] = Array.isArray(payload) ? payload : (payload.items ?? []);
    showcases.value = append ? [...showcases.value, ...items] : items;
    page.value = payload.meta?.page ?? nextPage;
    total.value = payload.meta?.total ?? showcases.value.length;
    hasMore.value = payload.meta?.hasMore ?? false;

    const routeWorkId = getRouteWorkId();
    if (!append && routeWorkId && detailItem.value?.id !== routeWorkId) {
      const item = showcases.value.find((work) => work.id === routeWorkId);
      if (item) {
        await openDetail(item, false);
      } else {
        await loadDetail(routeWorkId, false);
      }
    }
  } catch {
    ElMessage.error('作品集加载失败，请稍后重试');
  } finally {
    isLoading.value = false;
    isLoadingMore.value = false;
  }
};

const refreshAll = async () => {
  await Promise.all([fetchShowcases(), fetchStats()]);
};

const openPublishDialog = () => {
  isPublishDialogOpen.value = true;
};

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleStartChat = async (user: ShowcaseUser) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    ElMessage.success('会话已创建');
  } catch {
    ElMessage.error('发起会话失败');
  }
};

const loadDetail = async (id: string, syncQuery = true) => {
  if (syncQuery) setWorkQuery(id);
  isDetailOpen.value = true;
  detailItem.value = null;
  try {
    const response = await api.get(`/api/showcase/${id}`);
    detailItem.value = response.data;
    const idx = showcases.value.findIndex((item) => item.id === id);
    if (idx !== -1) {
      showcases.value[idx] = {
        ...showcases.value[idx],
        views: response.data.views,
        isLiked: response.data.isLiked,
        likesCount: response.data.likesCount,
        commentsCount: response.data.commentsCount,
      };
    }
  } catch {
    ElMessage.error('作品详情加载失败');
    closeDetail();
  }
};

const openDetail = async (item: ShowcaseItem, syncQuery = true) => {
  await loadDetail(item.id, syncQuery);
};

const closeDetail = () => {
  isDetailOpen.value = false;
  detailItem.value = null;
  setWorkQuery(null);
};

const updateLikeState = (id: string, liked: boolean, likesCount?: number) => {
  const updateItem = (item: ShowcaseItem) => {
    if (typeof likesCount === 'number') {
      item.likesCount = likesCount;
    } else if (item.isLiked !== liked) {
      item.likesCount = Math.max(0, item.likesCount + (liked ? 1 : -1));
    }
    item.isLiked = liked;
  };
  const target = showcases.value.find((item) => item.id === id);
  if (target) updateItem(target);
  if (detailItem.value?.id === id) updateItem(detailItem.value);
};

const toggleLike = async (item: ShowcaseItem) => {
  try {
    const response = await api.post(`/api/showcase/${item.id}/like`);
    updateLikeState(item.id, response.data.liked, response.data.likesCount);
    void fetchStats();
  } catch {
    ElMessage.error('操作失败，请稍后重试');
  }
};

const handleShare = async (item?: ShowcaseItem | null) => {
  const workId = item?.id ?? detailItem.value?.id;
  const url = new URL(window.location.href);
  if (workId) url.searchParams.set('work', workId);
  try {
    await navigator.clipboard.writeText(url.toString());
    ElMessage.success('链接已复制');
  } catch {
    ElMessage.error('复制失败，请手动复制浏览器地址');
  }
};

const handlePublished = async () => {
  activeScope.value = 'my';
  activeBucket.value = 'pending';
  activeSort.value = 'newest';
  await refreshAll();
};

const selectTag = (tag: string) => {
  searchInput.value = tag;
  searchQuery.value = tag;
  activeScope.value = 'all';
  activeBucket.value = 'all';
};

const openActivity = async (activity: { showcase: { id: string } }) => {
  const item = showcases.value.find((work) => work.id === activity.showcase.id);
  if (item) {
    await openDetail(item);
  } else {
    await loadDetail(activity.showcase.id);
  }
};

watch(searchInput, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery.value = searchInput.value.trim();
  }, 260);
});

watch(isDetailOpen, (val) => {
  if (!val) {
    setWorkQuery(null);
  }
});

watch([activeSort, activeType, activeScope, activeBucket, searchQuery, viewMode], () => {
  void fetchShowcases();
});

onMounted(() => {
  void refreshAll();
});

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <div class="showcase-view mobile-adaptive">
    <PageHeader title="创意作品集" :icon="MonitorPlay">
      <template #center>
        <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
          <Search />
          <input v-model="searchInput" type="text" placeholder="搜索作品、作者、标签..." />
        </label>
      </template>

      <div class="showcase-header-actions mobile-row">
        <Button
          variant="outline"
          size="sm"
          class="!w-8.5 !h-8.5 !p-0 !rounded-lg shrink-0"
          title="刷新作品集"
          @click="refreshAll"
        >
          <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isLoading || statsLoading }" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="!w-8.5 !h-8.5 !p-0 !rounded-lg shrink-0"
          :title="showInsights ? '收起洞察面板' : '打开洞察面板'"
          @click="showInsights = !showInsights"
        >
          <component :is="showInsights ? PanelRightClose : PanelRightOpen" class="w-4 h-4" />
        </Button>
        <Button
          variant="primary"
          size="sm"
          :icon="Plus"
          class="!h-8.5 !rounded-lg shrink-0 font-bold"
          @click="openPublishDialog"
        >
          发布
        </Button>
      </div>
    </PageHeader>

    <div class="showcase-layout" :class="{ 'showcase-layout--with-rail': showInsights }">
      <ShowcaseFilterPanel
        :is-open="isFilterOpen"
        :active-scope="activeScope"
        :active-bucket="activeBucket"
        :active-type="activeType"
        :scope-options="scopeTabOptions"
        :bucket-options="smartFilterTabOptions"
        :type-options="typeTabOptions"
        @update:active-scope="activeScope = $event"
        @update:active-bucket="setBucket($event)"
        @update:active-type="activeType = $event"
      />

      <main class="showcase-main">
        <ShowcaseControls
          v-model:active-sort="activeSort"
          v-model:view-mode="viewMode"
          :active-scope="activeScope"
          :active-type="activeType"
          :active-bucket="activeBucket"
          :search-query="searchQuery"
          :pending-review-count="pendingReviewCount"
          :result-summary="resultSummary"
          :sort-options="sortTabOptions"
          :view-mode-options="viewModeOptions"
          @reset-filters="resetFilters"
          @set-bucket="setBucket"
          @toggle-filter="isFilterOpen = !isFilterOpen"
        />

        <ShowcaseGrid
          :showcases="showcases"
          :view-mode="viewMode"
          :is-loading="isLoading"
          :is-loading-more="isLoadingMore"
          :has-more="hasMore"
          @open-detail="openDetail"
          @toggle-like="toggleLike"
          @share="handleShare"
          @user-click="openUserProfile"
          @load-more="fetchShowcases(true)"
          @publish="openPublishDialog"
        />
      </main>

      <ShowcaseRail
        v-if="showInsights"
        :stats="stats"
        :top-tags="topTags"
        :top-creators="topCreators"
        :recent-activity="recentActivity"
        :type-breakdown="typeBreakdown"
        @open-user-profile="openUserProfile"
        @select-tag="selectTag"
        @open-activity="openActivity"
        @select-type="activeType = $event"
      />
    </div>

    <ShowcaseDetail
      v-model:is-open="isDetailOpen"
      v-model:item="detailItem"
      :is-admin="isAdmin"
      :showcases="showcases"
      @select-tag="selectTag"
      @refresh-list="fetchShowcases"
      @user-profile="openUserProfile"
    />

    <PublishShowcaseDialog v-model="isPublishDialogOpen" @published="handlePublished" />

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleStartChat"
    />
  </div>
</template>

<style scoped>
.showcase-view {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: transparent !important;
}

.showcase-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  width: min(720px, 100%);
}

.showcase-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
  flex: 1;
  padding: 16px;
  overflow: hidden;
}

.showcase-layout--with-rail {
  grid-template-columns: 180px minmax(0, 1fr) minmax(290px, 330px);
}

.showcase-main {
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

@media (max-width: 1100px) {
  .showcase-layout {
    display: block;
    overflow-y: auto;
  }

  .showcase-main {
    overflow: visible;
  }
}

@media (max-width: 900px) {
  .showcase-layout {
    padding: 8px;
  }
}

@media (max-width: 640px) {
  .showcase-header-actions {
    width: 100%;
    flex-wrap: nowrap;
  }
}

@media (max-width: 767px) {
  .showcase-view {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  .showcase-layout {
    padding: 8px;
    gap: 8px;
  }

  .showcase-main {
    padding-right: 0;
  }
}
</style>
