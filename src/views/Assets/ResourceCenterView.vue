<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue';
import { useRouter } from 'vue-router';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Box,
  Clock3,
  Cpu,
  Eye,
  EyeOff,
  FileStack,
  Flame,
  Heart,
  Grid3X3,
  LayoutList,
  Layers,
  MonitorPlay,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tags,
  TrendingUp,
  UploadCloud,
  XCircle,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import PublishWorkDialog from '@/components/PublishWorkDialog.vue';
import Input from '@/components/ui/Input.vue';
import Tabs from '@/components/ui/Tabs.vue';
import UnifiedCard from '@/components/UnifiedCard.vue';
import {
  formatResourceNumber as formatNumber,
  formatResourceStorage as formatStorage,
  formatResourceTime as formatTime,
  getLibraryProgress,
  getResourceStatusLabel as getStatusLabel,
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
const viewModeOptions = computed(() => [
  { value: 'grid', icon: Grid3X3 },
  { value: 'list', icon: LayoutList },
]);
const feedItems = ref<ResourceItem[]>([]);
const feedMeta = ref<ResourceFeedMeta | null>(null);
const currentPage = ref(1);
const isStatsExpanded = ref(false);
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

const summaryCards = computed(() => {
  const summary = overview.value?.summary;
  const pressure = overview.value?.reviewPressure;
  const isAdminScope = overview.value?.scope === 'admin';
  return [
    {
      label: isAdminScope ? '全站公开' : '公开内容',
      value: formatNumber(summary?.totalPublic || 0),
      meta: `本周 +${formatNumber(summary?.weekAdded || 0)}`,
      icon: FileStack,
      tone: 'blue',
    },
    {
      label: isAdminScope ? '运营对象' : '我的提交',
      value: formatNumber(summary?.myItems || 0),
      meta: isAdminScope
        ? `${formatNumber(summary?.pendingReview || 0)} 待审 / ${formatNumber(summary?.rejectedReview || 0)} 已打回`
        : `${formatNumber(summary?.pendingReview || 0)} 个待审核`,
      icon: PackageCheck,
      tone: 'green',
    },
    {
      label: isAdminScope ? '审核压力' : '通过率',
      value: isAdminScope
        ? formatNumber(pressure?.pending || summary?.pendingReview || 0)
        : `${summary?.readyRate ?? 100}%`,
      meta: isAdminScope
        ? `${formatNumber(pressure?.stale || 0)} 个超 ${pressure?.staleThresholdHours || 48} 小时`
        : `${formatNumber(summary?.reviewPressure || 0)} 个待处理`,
      icon: Eye,
      tone: pressure?.level === 'high' || (summary?.reviewPressure || 0) > 0 ? 'amber' : 'green',
    },
    {
      label: '全站互动',
      value: formatNumber(summary?.interactions || 0),
      meta: '下载 / 浏览 / 收藏 / 评论',
      icon: TrendingUp,
      tone: 'rose',
    },
    {
      label: isAdminScope ? '占用统计' : '我的存储',
      value: formatStorage(summary?.storageMb || 0),
      meta: `${formatNumber(summary?.rejectedReview || 0)} 个需处理`,
      icon: BarChart3,
      tone: 'amber',
    },
  ];
});

const recentItems = computed(() => feedItems.value);
const reviewPressure = computed(() => overview.value?.reviewPressure);
const isAdminOverview = computed(() => overview.value?.scope === 'admin');
const hasReviewPressure = computed(() => {
  const pressure = reviewPressure.value;
  return Boolean(pressure && pressure.level !== 'none' && (pressure.pending || pressure.rejected));
});
const totalPages = computed(() => {
  const meta = feedMeta.value;
  if (!meta?.total) return 1;
  return Math.max(1, Math.ceil(meta.total / meta.limit));
});
const resultTotal = computed(() => feedMeta.value?.total ?? recentItems.value.length);

const kindFilters = computed(() => {
  const counts = feedMeta.value?.kindCounts;

  return [
    { key: 'all' as const, label: '全部', icon: Sparkles, count: counts?.all || 0 },
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

const filteredRecentItems = computed(() => recentItems.value);
const isMaterialFeed = computed(() => activeKind.value === 'material');
const materialFeedItems = computed(() =>
  filteredRecentItems.value.filter((item) => item.kind === 'material'),
);
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

function getMaterialCategory(item: ResourceItem) {
  return item.category || item.subtitle.split('/')[0]?.trim() || '材质';
}

function getMaterialResolution(item: ResourceItem) {
  if (item.resolution) return item.resolution;
  const tagResolution = item.tags.find((tag) => /^(2k|4k|8k|16k|sbsar)$/i.test(tag));
  if (tagResolution) return tagResolution.toUpperCase();
  const subtitleResolution = item.subtitle.match(/\b(?:2K|4K|8K|16K|SBSAR)\b/i)?.[0];
  return subtitleResolution?.toUpperCase() || '未标注';
}

function getMaterialSizeLabel(item: ResourceItem) {
  return item.fileSize ? formatStorage(item.fileSize) : '未标注';
}

function getMaterialDownloads(item: ResourceItem) {
  return item.downloads ?? (item.metricLabel === '下载' ? item.metric : 0);
}

function getMaterialFavorites(item: ResourceItem) {
  return item.favorites ?? (item.metricLabel === '收藏' ? item.metric : 0);
}

function isProceduralMaterial(item: ResourceItem) {
  const text = `${item.title} ${item.subtitle} ${item.tags.join(' ')}`.toLowerCase();
  return Boolean(
    item.isProcedural ||
    text.includes('procedural') ||
    text.includes('程序化') ||
    text.includes('sbsar'),
  );
}

function getMaterialType(item: ResourceItem) {
  return isProceduralMaterial(item) ? '程序化' : 'PBR 贴图包';
}

function getMaterialChannels(item: ResourceItem) {
  if (isProceduralMaterial(item)) return ['SBSAR', '参数', '噪声'];

  const text = `${item.title} ${item.subtitle} ${item.tags.join(' ')}`.toLowerCase();
  const channels = [
    { label: 'BaseColor', pattern: /base.?color|albedo|漫反射|颜色/ },
    { label: 'Normal', pattern: /normal|法线/ },
    { label: 'Roughness', pattern: /roughness|粗糙/ },
    { label: 'Metallic', pattern: /metallic|metalness|金属/ },
    { label: 'AO', pattern: /\bao\b|ambient|遮蔽/ },
  ]
    .filter((channel) => channel.pattern.test(text))
    .map((channel) => channel.label);

  return channels.length ? channels.slice(0, 4) : ['Albedo', 'Normal', 'Roughness'];
}

function resetFilters() {
  searchQuery.value = '';
  activeKind.value = 'all';
  activeStatus.value = 'all';
  sortMode.value = 'updated';
  currentPage.value = 1;
}

function setPage(page: number) {
  const nextPage = Math.min(Math.max(page, 1), totalPages.value);
  if (nextPage === currentPage.value) return;
  currentPage.value = nextPage;
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
  <div class="resource-center-page">
    <header class="page-header">
      <div class="title-block">
        <div class="title-icon">
          <FileStack class="icon-sm" />
        </div>
        <div>
          <h1>资源中心</h1>
          <p>统一查看资源、材质、插件和作品展示的运营状态。</p>
        </div>
      </div>

      <div class="header-actions">
        <button type="button" class="ghost-button" @click="isStatsExpanded = !isStatsExpanded">
          <component :is="isStatsExpanded ? EyeOff : Eye" class="icon-sm" />
          {{ isStatsExpanded ? '收起指标' : '数据指标' }}
        </button>
        <button
          type="button"
          class="ghost-button"
          :disabled="isLoading || isFeedLoading"
          @click="refreshAll"
        >
          <RefreshCw class="icon-sm" :class="{ spinning: isLoading || isFeedLoading }" />
          刷新
        </button>
        <button type="button" class="primary-button" @click="openPublishDialog('work')">
          <UploadCloud class="icon-sm" />
          发布内容
        </button>
      </div>
    </header>

    <section v-show="isStatsExpanded" class="kpi-strip">
      <article
        v-for="card in summaryCards"
        :key="card.label"
        class="kpi-card"
        :data-tone="card.tone"
      >
        <component :is="card.icon" class="icon-sm" />
        <div>
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.meta }}</small>
        </div>
      </article>
    </section>

    <section
      v-if="reviewPressure && isStatsExpanded"
      class="pressure-banner"
      :data-level="reviewPressure.level"
    >
      <div>
        <AlertTriangle class="icon-md" />
        <span>{{ isAdminOverview ? '审核压力' : '我的审核状态' }}</span>
        <strong>{{ reviewPressure.message }}</strong>
      </div>
      <button
        v-if="hasReviewPressure"
        type="button"
        class="ghost-button"
        @click="router.push(reviewPressure.ctaPath)"
      >
        {{ isAdminOverview ? '进入审核中心' : '查看我的内容' }}
        <ArrowRight class="icon-sm" />
      </button>
    </section>

    <section v-show="isStatsExpanded" class="library-grid">
      <button
        v-for="library in overview?.libraries || []"
        :key="library.key"
        type="button"
        class="library-card"
        @click="openLibrary(library)"
      >
        <div class="library-head">
          <span>{{ library.label }}</span>
          <strong>{{ formatNumber(library.total) }}</strong>
        </div>
        <div class="library-metrics">
          <span>我的 {{ formatNumber(library.mine) }}</span>
          <span>本周 +{{ formatNumber(library.weekAdded) }}</span>
          <span>{{ library.metricLabel }} {{ formatNumber(library.metric) }}</span>
        </div>
        <div class="quality-line" :aria-label="`${library.label} 通过占比`">
          <i :style="{ width: `${getLibraryProgress(library)}%` }"></i>
        </div>
        <div class="library-foot">
          <span :class="{ warning: library.pending > 0 }">
            <Clock3 class="icon-xs" />{{ library.pending }} 待审核
          </span>
          <span :class="{ danger: library.rejected > 0 }">
            <XCircle class="icon-xs" />{{ library.rejected }} 需修改
          </span>
        </div>
      </button>
    </section>

    <section class="resource-workbench">
      <main class="feed-panel">
        <div class="feed-toolbar">
          <div class="toolbar-left">
            <Tabs v-model="activeKind" :options="kindTabOptions" size="sm" />
            <Tabs v-model="activeStatus" :options="statusTabOptions" size="sm" />
          </div>

          <div class="toolbar-center">
            <Input
              v-model="searchQuery"
              type="search"
              placeholder="搜索最近内容、作者或标签"
              :icon="Search"
              clearable
              input-class="!py-1.5 !h-8.5 !rounded-lg"
              class="w-full max-w-[180px]"
            />
          </div>

          <div class="toolbar-right">
            <select v-model="sortMode" class="sort-select" aria-label="资源排序">
              <option value="updated">按最近更新</option>
              <option value="created">按发布时间</option>
              <option value="metric">按热度指标</option>
              <option value="review">按审核压力</option>
              <option value="title">按名称</option>
            </select>
            <Tabs v-model="viewMode" :options="viewModeOptions" size="sm" />
            <div class="result-count">
              <span>{{ resultTotal }} 条结果</span>
            </div>
          </div>
        </div>

        <div v-if="isMaterialFeed" class="material-mode-bar">
          <div>
            <Layers class="icon-sm" />
            <strong>材质样本</strong>
            <span>{{ formatNumber(resultTotal) }} 个 / PBR / SBSAR / 纹理包</span>
          </div>
          <button type="button" @click="openMaterialLibrary">
            完整材质库
            <ArrowRight class="icon-xs" />
          </button>
        </div>

        <div v-if="isFeedLoading && isMaterialFeed" class="material-board">
          <article
            v-for="index in 8"
            :key="index"
            class="material-swatch-card material-skeleton"
          ></article>
        </div>

        <div v-else-if="isFeedLoading" class="feed-list" :class="viewMode">
          <div v-for="index in 8" :key="index" class="feed-row skeleton-row"></div>
        </div>

        <div v-else-if="isMaterialFeed && materialFeedItems.length" class="material-board">
          <button
            v-for="item in materialFeedItems"
            :key="`${item.kind}:${item.id}`"
            type="button"
            class="material-swatch-card"
            :data-status="item.status"
            @click="openItem(item)"
          >
            <div class="material-thumb">
              <img v-if="item.previewUrl" :src="getAssetUrl(item.previewUrl)" :alt="item.title" />
              <div v-else class="material-thumb-fallback">
                <Layers class="icon-md" />
              </div>
              <span class="material-kind-chip">{{ getMaterialType(item) }}</span>
              <span class="status-pill" :data-status="item.status">{{
                getStatusLabel(item.status)
              }}</span>
            </div>
            <div class="material-card-body">
              <div class="material-card-head">
                <span>{{ getMaterialCategory(item) }}</span>
                <strong>{{ item.title }}</strong>
              </div>

              <div class="material-spec-row">
                <span>{{ getMaterialResolution(item) }}</span>
                <span>{{ getMaterialSizeLabel(item) }}</span>
                <span>{{ formatTime(item.updatedAt || item.createdAt) }}</span>
              </div>

              <div class="material-channel-row">
                <span v-for="channel in getMaterialChannels(item)" :key="channel">{{
                  channel
                }}</span>
              </div>

              <div class="material-tags">
                <span v-for="tag in item.tags.slice(0, 3)" :key="tag">#{{ tag }}</span>
              </div>

              <footer class="material-card-footer">
                <span>{{ item.author }}</span>
                <div>
                  <span
                    ><ArrowDownToLine class="icon-xs" />{{
                      formatNumber(getMaterialDownloads(item))
                    }}</span
                  >
                  <span
                    ><Heart class="icon-xs" />{{ formatNumber(getMaterialFavorites(item)) }}</span
                  >
                </div>
              </footer>
              <em v-if="item.rejectReason">{{ item.rejectReason }}</em>
            </div>
          </button>
        </div>

        <div v-else-if="filteredRecentItems.length" class="feed-list" :class="viewMode">
          <UnifiedCard
            v-for="item in filteredRecentItems"
            :key="`${item.kind}:${item.id}`"
            :item="item"
            :kind="item.kind"
            :view-mode="viewMode"
            @click="openItem(item)"
          />
        </div>

        <div v-else class="empty-state">
          <Sparkles class="empty-icon" />
          <h2>没有匹配的资源动态</h2>
          <p>换一个筛选条件，或发布新的资源、材质、插件和展示作品。</p>
          <button type="button" class="primary-button" @click="openPublishDialog('work')">
            <Plus class="icon-sm" />
            发布内容
          </button>
        </div>

        <footer v-if="resultTotal > pageSize" class="feed-pagination">
          <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
          <div>
            <button
              type="button"
              :disabled="currentPage === 1 || isFeedLoading"
              @click="setPage(currentPage - 1)"
            >
              上一页
            </button>
            <button
              type="button"
              :disabled="currentPage === totalPages || isFeedLoading"
              @click="setPage(currentPage + 1)"
            >
              下一页
            </button>
          </div>
        </footer>
      </main>

      <aside class="insight-rail">
        <section class="review-panel" :class="{ active: hasReviewPressure }">
          <div class="rail-title">
            <PackageCheck class="icon-sm" />
            审核与返修
          </div>
          <div v-if="overview?.reviewQueue.length" class="rail-list">
            <button
              v-for="item in overview.reviewQueue"
              :key="`${item.kind}:review:${item.id}`"
              type="button"
              class="compact-row"
              @click="openReviewItem(item)"
            >
              <span>{{ getStatusLabel(item.status) }}</span>
              <strong>{{ item.title }}</strong>
              <small>
                {{ kindMeta[item.kind].label }}
                <template v-if="item.reviewAgeHours"> / {{ item.reviewAgeHours }}h</template>
              </small>
            </button>
          </div>
          <p v-else class="rail-empty">当前没有待审核或被驳回内容。</p>
        </section>

        <section>
          <div class="rail-title">
            <Flame class="icon-sm" />
            热门内容
          </div>
          <div class="rail-list">
            <button
              v-for="(item, index) in overview?.topItems || []"
              :key="`${item.kind}:top:${item.id}`"
              type="button"
              class="rank-row"
              @click="openItem(item)"
            >
              <span class="rank-badge" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
              <component :is="kindMeta[item.kind].icon" class="icon-sm" />
              <span class="rank-title">{{ item.title }}</span>
              <strong class="rank-value">{{ formatNumber(item.metric) }}</strong>
            </button>
          </div>
        </section>

        <section>
          <div class="rail-title">
            <Tags class="icon-sm" />
            跨库热标签
          </div>
          <div class="tag-cloud">
            <button
              v-for="tag in overview?.hotTags || []"
              :key="tag.label"
              type="button"
              @click="searchQuery = tag.label"
            >
              #{{ tag.label }}
              <span>{{ tag.count }}</span>
            </button>
          </div>
        </section>

        <section>
          <div class="rail-title">
            <Eye class="icon-sm" />
            快速动作
          </div>
          <div class="quick-grid">
            <button type="button" @click="openPublishDialog('work')">
              <PackageCheck class="icon-sm" />
              发布作品
            </button>
            <button type="button" @click="openPublishDialog('asset')">
              <ArrowDownToLine class="icon-sm" />
              上传模型
            </button>
            <button type="button" @click="router.push('/materials?create=1')">
              <Layers class="icon-sm" />
              上传材质
            </button>
            <button type="button" @click="openPublishDialog('plugin')">
              <Cpu class="icon-sm" />
              上传插件
            </button>
          </div>
        </section>
      </aside>
    </section>

    <PublishWorkDialog
      v-model="isPublishDialogOpen"
      :default-category="publishCategory"
      @published="refreshAll"
    />
  </div>
</template>

<style scoped>
.resource-center-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-app);
  color: var(--text-primary);
}

h1,
h2,
p {
  margin: 0;
}

button,
input,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* Flex alignments */
.page-header,
.title-block,
.header-actions,
.pressure-banner,
.pressure-banner > div,
.kpi-card,
.library-head,
.library-foot,
.feed-toolbar,
.feed-subtoolbar,
.item-badge-row,
.item-meta-row,
.item-tags-row,
.feed-pagination,
.rail-title,
.quick-grid button {
  display: flex;
  align-items: center;
}

.page-header {
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
}

.title-block {
  min-width: 0;
  gap: 8px;
}

.title-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-subtle);
}

.title-block h1 {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.title-block p {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.2;
}

.header-actions {
  gap: 8px;
}

/* Base button styles */
.primary-button,
.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  transition: all 0.15s ease;
  border: 1px solid var(--border-base);
}

.primary-button {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
}

.primary-button:hover {
  background: var(--accent-hover);
  transform: translateY(-0.5px);
}

.ghost-button {
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.icon-md {
  width: 18px;
  height: 18px;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.icon-xs {
  width: 11px;
  height: 11px;
}

/* KPI Cards */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.kpi-card {
  display: flex;
  gap: 10px;
  min-height: 54px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 8px 12px;
  box-shadow: var(--shadow-card);
  transition: all 0.18s ease;
}

.kpi-card:hover {
  transform: translateY(-1.5px);
  border-color: var(--tone-color, var(--accent));
  box-shadow: var(--shadow-card-hover);
}

.kpi-card > svg {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  padding: 5px;
  background: var(--bg-app);
  color: var(--tone-color);
  flex: 0 0 auto;
}

/* KPI tones */
.kpi-card[data-tone='blue'],
.feed-row[data-tone='blue'] {
  --tone-color: #2563eb;
}

.kpi-card[data-tone='green'],
.feed-row[data-tone='green'] {
  --tone-color: #059669;
}

.kpi-card[data-tone='rose'] {
  --tone-color: #e11d48;
}

.kpi-card[data-tone='amber'],
.feed-row[data-tone='amber'] {
  --tone-color: #d97706;
}

.feed-row[data-tone='violet'] {
  --tone-color: #7c3aed;
}

.kpi-card span {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.kpi-card strong {
  display: block;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
  margin-top: 1px;
}

.kpi-card small {
  display: block;
  color: var(--text-muted);
  font-size: 10px;
  margin-top: 1px;
}

/* Library Grid */
.library-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.library-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 10px;
  text-align: left;
  transition: all 0.18s ease;
  box-shadow: var(--shadow-card);
}

.library-card:nth-child(1) {
  --tone-color: #2563eb;
}
.library-card:nth-child(2) {
  --tone-color: #d97706;
}
.library-card:nth-child(3) {
  --tone-color: #7c3aed;
}
.library-card:nth-child(4) {
  --tone-color: #059669;
}

.library-card:hover {
  transform: translateY(-1.5px);
  border-color: var(--tone-color, var(--accent));
  box-shadow: var(--shadow-card-hover);
}

.library-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.library-head span {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.library-head strong {
  color: var(--tone-color);
  font-size: 15px;
  font-weight: 700;
}

.library-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.library-metrics span {
  border-radius: 4px;
  background: var(--bg-app);
  padding: 2px 6px;
  font-size: 10px;
  color: var(--text-secondary);
}

.quality-line {
  overflow: hidden;
  height: 3px;
  border-radius: 999px;
  background: var(--bg-app);
  margin: 2px 0;
}

.quality-line i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--tone-color);
}

.library-foot {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
}

.library-foot span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-muted);
}

.library-foot .warning {
  color: var(--warning);
  font-weight: 500;
}

.library-foot .danger {
  color: var(--danger);
  font-weight: 500;
}

/* Pressure Banner */
.pressure-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 6px 12px;
  border: 1px solid rgba(5, 150, 105, 0.2);
  border-radius: 6px;
  background: rgba(5, 150, 105, 0.04);
}

.pressure-banner[data-level='watch'] {
  border-color: rgba(217, 119, 6, 0.25);
  background: rgba(217, 119, 6, 0.05);
}

.pressure-banner[data-level='high'] {
  border-color: rgba(220, 38, 38, 0.25);
  background: rgba(220, 38, 38, 0.05);
}

.pressure-banner > div {
  min-width: 0;
  gap: 6px;
}

.pressure-banner svg {
  flex: 0 0 auto;
  color: var(--warning);
}

.pressure-banner span {
  flex: 0 0 auto;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.pressure-banner strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Workbench Layout */
.resource-workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  min-height: 0;
}

.feed-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

/* Toolbar & Subtoolbar */
.feed-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: var(--bg-card);
  padding: 6px 12px;
  border-radius: 12px;
  border: 1px solid var(--border-base);
  backdrop-filter: blur(12px);
  flex-wrap: nowrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.toolbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 200px;
}

.result-count {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
}

.reset-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  background: transparent;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 0 8px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-muted);
  padding: 0 10px;
  transition: all 0.15s ease;
}

.search-box:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-subtle);
}

.search-box input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
}

.sort-select {
  height: 32px;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 0 24px 0 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sort-select:hover {
  border-color: var(--border-strong);
}

.sort-select:focus {
  border-color: var(--accent);
  outline: 0;
}

/* Segmented Controls for Switches */
.kind-switch,
.status-switch {
  display: flex;
  gap: 2px;
  background: var(--bg-hover);
  padding: 2px;
  border-radius: 6px;
  border: 1px solid var(--border-base);
}

.kind-switch button,
.status-switch button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  padding: 0 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.kind-switch button:hover,
.status-switch button:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.4);
}

.dark .kind-switch button:hover,
.dark .status-switch button:hover {
  background: rgba(255, 255, 255, 0.06);
}

.kind-switch button.active,
.status-switch button.active {
  background: var(--bg-card);
  color: var(--accent);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-weight: 600;
}

.kind-switch strong,
.status-switch strong {
  margin-left: 2px;
  color: var(--text-muted);
  font-size: 10px;
}

.kind-switch button.active strong,
.status-switch button.active strong {
  color: var(--accent);
}

.result-count {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.result-count button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 0 8px;
  font-size: 10px;
  transition: all 0.15s ease;
}

.result-count button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

/* Feed List rows */
.feed-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feed-row {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 10px 14px;
  text-align: left;
  transition: all 0.15s ease;
  box-shadow: var(--shadow-card);
}

.feed-row:hover {
  transform: translateY(-1px);
  border-color: var(--tone-color, var(--accent));
  box-shadow: var(--shadow-card-hover);
}

.item-preview {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 64px;
  height: 48px;
  overflow: hidden;
  border-radius: 6px;
  color: #fff;
  background: color-mix(in srgb, var(--tone-color, var(--accent)) 75%, #0f172a);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.item-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-badge-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kind-pill,
.status-pill {
  border-radius: 999px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 600;
}

.kind-pill {
  color: var(--tone-color, var(--accent));
  background: color-mix(in srgb, var(--tone-color, var(--accent)) 10%, transparent);
}

.status-pill {
  color: var(--text-secondary);
  background: var(--bg-app);
}

.status-pill[data-status='PENDING'] {
  color: var(--warning);
  background: rgba(217, 119, 6, 0.1);
}

.status-pill[data-status='REJECTED'] {
  color: var(--danger);
  background: rgba(220, 38, 38, 0.1);
}

.status-pill[data-status='APPROVED'] {
  color: var(--success);
  background: rgba(5, 150, 105, 0.1);
}

.item-title {
  display: block;
  min-width: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta-row {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-muted);
  font-size: 11px;
}

.item-meta-row .bullet {
  color: var(--border-strong);
  font-size: 8px;
}

.item-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.tag-badge {
  color: var(--text-secondary);
  background: var(--bg-app);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 500;
  transition: all 0.12s ease;
}

.feed-row:hover .tag-badge {
  background: var(--bg-hover);
}

.item-reject {
  display: block;
  min-width: 0;
  margin-top: 2px;
  overflow: hidden;
  color: var(--danger);
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-metric {
  flex: 0 0 68px;
  text-align: right;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.metric-value {
  display: block;
  color: var(--tone-color, var(--accent));
  font-size: 15px;
  font-weight: 700;
}

.metric-label {
  display: block;
  color: var(--text-muted);
  font-size: 10px;
}

/* Material Switch Section */
.material-mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
  margin-top: 4px;
  border: 1px solid rgba(217, 119, 6, 0.2);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(217, 119, 6, 0.06), rgba(15, 118, 110, 0.03)), var(--bg-card);
  padding: 6px 12px;
}

.material-mode-bar > div {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 6px;
}

.material-mode-bar strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.material-mode-bar span {
  min-width: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-mode-bar svg {
  flex: 0 0 auto;
  color: var(--warning);
}

.material-mode-bar button {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  height: 26px;
  border: 1px solid rgba(217, 119, 6, 0.25);
  border-radius: 6px;
  background: rgba(217, 119, 6, 0.05);
  color: #b45309;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.material-mode-bar button:hover {
  background: rgba(217, 119, 6, 0.1);
  border-color: rgba(217, 119, 6, 0.4);
}

/* Material Board (Grid) */
.material-board {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 10px;
}

.material-swatch-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  text-align: left;
  transition: all 0.18s ease;
}

.material-swatch-card:hover {
  transform: translateY(-2px);
  border-color: rgba(217, 119, 6, 0.45);
  box-shadow: var(--shadow-card-hover);
}

.material-swatch-card[data-status='PENDING'] {
  border-color: rgba(217, 119, 6, 0.2);
}

.material-swatch-card[data-status='REJECTED'] {
  border-color: rgba(220, 38, 38, 0.2);
}

.material-thumb {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background:
    radial-gradient(circle at 32% 28%, rgba(255, 255, 255, 0.1), transparent 28%),
    linear-gradient(135deg, #1f2937, #111827);
}

.material-thumb img,
.material-thumb-fallback {
  width: 100%;
  height: 100%;
}

.material-thumb img {
  display: block;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.material-swatch-card:hover .material-thumb img {
  transform: scale(1.04);
}

.material-thumb-fallback {
  display: grid;
  place-items: center;
  color: rgba(255, 255, 255, 0.6);
}

.material-kind-chip,
.material-thumb .status-pill {
  position: absolute;
  z-index: 1;
  backdrop-filter: blur(4px);
}

.material-kind-chip {
  left: 6px;
  top: 6px;
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.75);
  color: #fff;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 600;
}

.material-thumb .status-pill {
  right: 6px;
  top: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: #111827;
}

.dark .material-thumb .status-pill {
  background: rgba(15, 23, 42, 0.9);
  color: #f3f3f3;
}

.material-card-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  flex: 1;
}

.material-card-head {
  min-width: 0;
}

.material-card-head span {
  display: block;
  color: #b45309;
  font-size: 9px;
  font-weight: 600;
}

.material-card-head strong {
  display: block;
  min-width: 0;
  margin-top: 1px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-spec-row,
.material-channel-row,
.material-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.material-spec-row span,
.material-channel-row span,
.material-tags span {
  border-radius: 4px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 2px 5px;
  font-size: 9px;
  font-weight: 500;
}

.material-channel-row span {
  background: rgba(15, 118, 110, 0.08);
  color: #0f766e;
}

.material-tags {
  min-height: 18px;
}

.material-tags span {
  color: var(--text-muted);
}

.material-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 6px;
  border-top: 1px solid var(--border-base);
  margin-top: auto;
}

.material-card-footer > span {
  min-width: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-card-footer > div {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 10px;
}

.material-card-footer > div span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.material-card-body em {
  overflow: hidden;
  color: var(--danger);
  font-size: 10px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.material-skeleton {
  min-height: 230px;
  background:
    linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.15), transparent), var(--bg-card);
  background-size:
    220px 100%,
    auto;
  animation: shimmer 1.2s linear infinite;
}

/* Insight Rail (Right Sidebar) */
.insight-rail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.insight-rail section {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 12px;
  box-shadow: var(--shadow-card);
}

.review-panel.active {
  border-color: rgba(217, 119, 6, 0.3);
  background: rgba(217, 119, 6, 0.02);
}

.rail-title {
  gap: 6px;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.rail-title svg {
  color: var(--accent);
}

.rail-empty {
  color: var(--text-muted);
  font-size: 11px;
  padding: 4px;
}

.rail-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Sidebar List Buttons (Remove Borders) */
.compact-row,
.rank-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 6px 8px;
  text-align: left;
  transition: all 0.15s ease;
}

.compact-row:hover,
.rank-row:hover {
  background: var(--bg-hover);
  transform: translateY(-0.5px);
}

/* Add dotted bottom dividers for sidebar items, except the last one */
.rail-list > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.compact-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
}

.compact-row span {
  color: #b45309;
  font-size: 10px;
  font-weight: 600;
  background: rgba(217, 119, 6, 0.1);
  padding: 1px 5px;
  border-radius: 4px;
}

.compact-row strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-row small {
  color: var(--text-muted);
  font-size: 10px;
}

.rank-row {
  display: grid;
  grid-template-columns: 18px 16px minmax(0, 1fr) auto;
  gap: 8px;
}

.rank-row svg {
  color: var(--text-secondary);
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.rank-badge.rank-1 {
  background: #f59e0b;
  color: #fff;
}

.rank-badge.rank-2 {
  background: #94a3b8;
  color: #fff;
}

.rank-badge.rank-3 {
  background: #a16207;
  color: #fff;
}

.rank-badge:not(.rank-1):not(.rank-2):not(.rank-3) {
  background: var(--bg-app);
  color: var(--text-muted);
}

.rank-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-value {
  color: var(--tone-color, var(--accent));
  font-size: 12px;
  font-weight: 600;
}

/* Tag Cloud */
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-cloud button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  border: 0;
  border-radius: 9999px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 0 10px;
  font-size: 10px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.tag-cloud button:hover {
  background: var(--bg-active);
  color: var(--accent);
  transform: translateY(-0.5px);
}

.tag-cloud span {
  color: var(--text-muted);
  font-size: 9px;
  margin-left: 2px;
}

/* Quick Actions */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.quick-grid button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.quick-grid button:hover {
  background: var(--bg-active);
  color: var(--accent);
  border-color: var(--accent);
  transform: translateY(-1px);
}

/* Empty State */
.empty-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  min-height: 280px;
  margin-top: 4px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  text-align: center;
}

.empty-state h2 {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.empty-state p {
  color: var(--text-secondary);
  font-size: 11px;
}

.empty-icon {
  width: 32px;
  height: 32px;
  color: var(--accent);
  opacity: 0.5;
}

/* Pagination */
.feed-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.feed-pagination > div {
  display: flex;
  gap: 6px;
}

.feed-pagination button {
  height: 28px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-primary);
  padding: 0 10px;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.feed-pagination button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.skeleton-row {
  min-height: 62px;
  background:
    linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.15), transparent), var(--bg-card);
  background-size:
    220px 100%,
    auto;
  animation: shimmer 1.2s linear infinite;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes shimmer {
  from {
    background-position:
      -220px 0,
      0 0;
  }
  to {
    background-position:
      calc(100% + 220px) 0,
      0 0;
  }
}

/* Media Queries */
@media (max-width: 1180px) {
  .library-grid,
  .kpi-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .resource-workbench {
    grid-template-columns: 1fr;
  }

  .insight-rail {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .page-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 10px;
    min-height: auto;
  }

  .feed-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .toolbar-left,
  .toolbar-right {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
  }

  .toolbar-center {
    width: 100%;
  }

  .toolbar-center :deep(.ui-input-wrapper) {
    max-width: none;
    width: 100%;
  }

  .sort-select {
    width: 100%;
  }

  .result-count {
    justify-content: space-between;
    white-space: normal;
  }

  .header-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    width: 100%;
  }

  .pressure-banner {
    display: grid;
    grid-template-columns: 1fr;
  }

  .pressure-banner strong {
    white-space: normal;
  }

  .primary-button,
  .ghost-button {
    width: 100%;
    min-width: 0;
    height: 38px;
  }

  .material-mode-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .material-mode-bar button {
    justify-content: center;
    width: 100%;
    height: 32px;
  }

  .material-board {
    grid-template-columns: 1fr;
  }

  .library-grid,
  .kpi-strip,
  .insight-rail,
  .feed-list.grid {
    grid-template-columns: 1fr;
  }

  .feed-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .item-metric {
    align-items: flex-start;
    text-align: left;
    margin-left: 78px;
    flex: none;
  }
}

/* Grid display for feed list */
.feed-list.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.feed-list.grid .feed-row {
  flex-direction: column;
  align-items: stretch;
  padding: 12px;
  gap: 8px;
  height: 100%;
}

.feed-list.grid .item-preview {
  width: 100%;
  height: 120px;
  border-radius: 6px;
}

.feed-list.grid .item-main {
  width: 100%;
  flex: 1;
}

.feed-list.grid .item-metric {
  margin-top: auto;
  border-top: 1px solid var(--border-base);
  padding-top: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.feed-list.grid .item-metric .metric-value {
  font-size: 13px;
}
</style>
