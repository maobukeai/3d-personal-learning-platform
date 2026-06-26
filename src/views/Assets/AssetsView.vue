<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Activity, Box, FileArchive, Grid3X3, LayoutList, UsersRound } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import type { Category } from '@/types';
import { useLabel } from '@/utils/i18n';
import {
  buildActiveAssetFilterChips,
  buildAssetCategoryOptions,
  buildAssetFormatOptions,
  filterVisibleAssets,
  type AssetInsights,
  type AssetInsightCategory,
  type AssetListItem,
  type AssetSortKey as SortKey,
  type AssetViewMode as ViewMode,
} from './assetLibraryModel';
import { formatCompactNumber, formatFileSize } from './resourceUtils';
import AssetLibraryHeader from './components/AssetLibraryHeader.vue';
import AssetStatsPanel from './components/AssetStatsPanel.vue';
import AssetFilterPanel from './components/AssetFilterPanel.vue';
import AssetContentPanel from './components/AssetContentPanel.vue';
import AssetInsightPanel from './components/AssetInsightPanel.vue';
import PublishWorkDialog from '@/components/PublishWorkDialog.vue';
import AssetDetailModal from './components/AssetDetailModal.vue';
import EditWorkDialog from './components/EditWorkDialog.vue';
import { normalizeAssetWork } from './myWorksModel';
import type { UnifiedWork } from './myWorksModel';

const router = useRouter();
const route = useRoute();
const label = useLabel();
const searchQuery = ref('');
const isStatsExpanded = ref(false);
const activeCategoryId = ref('all');
const selectedFormat = ref('all');
const selectedTag = ref('all');
const sortKey = ref<SortKey>('latest');
const viewMode = ref<ViewMode>('grid');
const viewModeOptions = computed(() => [
  { value: 'grid' as ViewMode, label: '', icon: Grid3X3 },
  { value: 'list' as ViewMode, label: '', icon: LayoutList },
]);
const isFilterOpen = ref(false);
const isLoading = ref(false);


// Edit Work dialog state
const isEditDialogOpen = ref(false);
const isSaving = ref(false);
const selectedWork = ref<UnifiedWork | null>(null);
const editForm = ref({
  title: '',
  description: '',
  tags: '',
  categoryId: '',
  materialCategory: '',
  resolution: '4K',
  isProcedural: false,
  pluginCategory: '',
  pluginVersion: '1.0.0',
  pluginCompatibility: '',
  showcaseType: 'IMAGE',
  videoUrl: '',
  originality: 'ORIGINAL',
  originalAuthor: '',
  originalLink: '',
  license: 'CC_BY',
  isFree: true,
  meshType: 'LOW_POLY',
  uvUnwrapped: true,
  uvOverlapping: false,
  pbrChannels: [] as string[],
  rigged: false,
  gameReady: false,
  linkedCourseId: '',
  linkedLessonId: '',
  installGuide: '',
  file: null as File | null,
  packageFile: null as File | null,
  thumbnail: null as File | null,
});
const isUploadDialogOpen = ref(false);
const assets = ref<AssetListItem[]>([]);
const categories = ref<AssetInsightCategory[]>([]);
const insights = ref<AssetInsights | null>(null);
const searchTimer = ref<number | undefined>();

type LibraryTab = 'explore' | 'favorites' | 'mine';
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

const activeTab = ref<LibraryTab>('explore');
const myStatusFilter = ref<StatusFilter>('all');

const libraryTabs = computed(() => [
  {
    key: 'explore' as const,
    label: label('资源广场', 'Explore'),
    count: insights.value?.summary.total || 0,
  },
  {
    key: 'favorites' as const,
    label: label('我的收藏', 'Favorites'),
    count: insights.value?.summary.myLikes || 0,
  },
  {
    key: 'mine' as const,
    label: label('我的资源', 'My Uploads'),
    count: insights.value?.summary.myUploads || 0,
  },
]);

const libraryTabOptions = computed(() => {
  return libraryTabs.value.map((tab) => ({
    label: `${tab.label} ${tab.count}`,
    value: tab.key,
  }));
});

const statusTabOptions = computed(() => [
  { label: label('全部状态', 'All Statuses'), value: 'all' },
  { label: label('待审核', 'Pending'), value: 'PENDING' },
  { label: label('已发布', 'Approved'), value: 'APPROVED' },
  { label: label('未通过', 'Rejected'), value: 'REJECTED' },
]);

const pagination = ref({
  total: 0,
  page: 1,
  limit: 24,
  totalPages: 0,
});



const categoryOptions = computed(() =>
  buildAssetCategoryOptions(
    categories.value,
    insights.value,
    pagination.value.total,
    label('全部资源', 'All Assets'),
  ),
);

const categoryTabOptions = computed(() => {
  return categoryOptions.value.map((cat) => ({
    label: cat.name,
    value: cat.id,
    badge: cat.count,
  }));
});

const formatOptions = computed(() => buildAssetFormatOptions(insights.value));

const formatTabOptions = computed(() => {
  return formatOptions.value.map((fmt) => ({
    label: fmt.label === 'all' ? label('全部格式', 'All Formats') : fmt.label.toUpperCase(),
    value: fmt.label,
    badge: fmt.count,
  }));
});

const statCards = computed(() => [
  {
    label: label('资源总量', 'Total Assets'),
    value: insights.value?.summary.total || pagination.value.total,
    meta: label(
      `${formatCompactNumber(insights.value?.summary.downloads)} 次下载`,
      `${formatCompactNumber(insights.value?.summary.downloads)} downloads`,
    ),
    icon: Box,
    tone: 'blue',
  },
  {
    label: label('团队贡献', 'Team Contributions'),
    value: insights.value?.summary.myUploads || 0,
    meta: label(
      `${insights.value?.summary.pending || 0} 个待审核`,
      `${insights.value?.summary.pending || 0} pending`,
    ),
    icon: UsersRound,
    tone: 'green',
  },
  {
    label: label('可动画模型', 'Animated Models'),
    value: insights.value?.summary.animated || 0,
    meta: label(
      `${insights.value?.summary.optimized || 0} 个轻量网格`,
      `${insights.value?.summary.optimized || 0} optimized`,
    ),
    icon: Activity,
    tone: 'orange',
  },
  {
    label: label('平均体积', 'Average Size'),
    value: formatFileSize(insights.value?.summary.averageSize || 0, '0 MB'),
    meta: label(
      `累计 ${formatFileSize(insights.value?.summary.totalSize || 0, '0 MB')}`,
      `Total ${formatFileSize(insights.value?.summary.totalSize || 0, '0 MB')}`,
    ),
    icon: FileArchive,
    tone: 'teal',
  },
]);

const visibleAssets = computed(() => {
  return filterVisibleAssets(
    assets.value,
    {
      selectedFormat: selectedFormat.value,
      selectedTag: selectedTag.value,
    },
    {
      creatorLabel: label('创作者', 'Creator'),
      uncategorizedLabel: label('未分类', 'Uncategorized'),
    },
  );
});

const activeFilterChips = computed(() => {
  return buildActiveAssetFilterChips({
    activeCategoryId: activeCategoryId.value,
    categoryOptions: categoryOptions.value,
    currentCategoryLabel: label('当前分类', 'Current Category'),
    selectedFormat: selectedFormat.value,
    selectedTag: selectedTag.value,
    searchQuery: searchQuery.value,
  });
});



watch([activeCategoryId, sortKey, activeTab, myStatusFilter], () => {
  pagination.value.page = 1;
  fetchAssets();
});

watch(searchQuery, () => {
  if (searchTimer.value) window.clearTimeout(searchTimer.value);
  searchTimer.value = window.setTimeout(() => {
    pagination.value.page = 1;
    fetchAssets();
  }, 320);
});

const fetchAssets = async () => {
  isLoading.value = true;
  try {
    const { data } = await api.get('/api/assets/public', {
      params: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        search: searchQuery.value.trim() || undefined,
        categoryId: activeCategoryId.value,
        sort: sortKey.value,
        mine: activeTab.value === 'mine' ? 'true' : undefined,
        favoritesOnly: activeTab.value === 'favorites' ? 'true' : undefined,
        status:
          activeTab.value === 'mine' && myStatusFilter.value !== 'all'
            ? myStatusFilter.value
            : undefined,
      },
    });
    assets.value = data.assets || [];
    pagination.value = data.pagination || pagination.value;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('资源列表加载失败', 'Failed to load assets')));
  } finally {
    isLoading.value = false;
  }
};

const fetchInsights = async () => {
  try {
    const { data } = await api.get('/api/assets/insights');
    insights.value = data;
    categories.value = data.categories || [];
  } catch (error) {
    logError(error, { operation: 'fetchAssetInsights', view: 'AssetsView' });
  }
};

const fetchCategories = async () => {
  try {
    const { data } = await api.get('/api/assets/categories');
    const mapped = (data || []).map((category: Category) => ({
      id: category.id,
      name: category.name,
      count: category._count?.assets || 0,
    }));
    if (!categories.value.length) categories.value = mapped;
  } catch (error) {
    logError(error, { operation: 'fetchCategories', view: 'AssetsView' });
  }
};

const handlePageChange = (page: number) => {
  if (page < 1 || page > pagination.value.totalPages) return;
  pagination.value.page = page;
  fetchAssets();
};

const clearFilter = (key: string) => {
  if (key === 'category') activeCategoryId.value = 'all';
  if (key === 'format') selectedFormat.value = 'all';
  if (key === 'tag') selectedTag.value = 'all';
  if (key === 'search') searchQuery.value = '';
};

const resetFilters = () => {
  activeCategoryId.value = 'all';
  selectedFormat.value = 'all';
  selectedTag.value = 'all';
  searchQuery.value = '';
};

const isAssetDetailOpen = ref(false);
const selectedAssetId = ref<string | null>(null);

watch(
  () => route.query.id,
  (newId) => {
    if (newId) {
      selectedAssetId.value = String(newId);
      isAssetDetailOpen.value = true;
    } else {
      isAssetDetailOpen.value = false;
      selectedAssetId.value = null;
    }
  },
  { immediate: true }
);

const goToDetail = (asset: AssetListItem) => {
  router.push({ path: '/assets', query: { id: asset.id } });
};

const closeDetailModal = () => {
  isAssetDetailOpen.value = false;
  selectedAssetId.value = null;
  router.push({ path: '/assets' });
};

const handleDetailEdit = (asset: any) => {
  isAssetDetailOpen.value = false;
  selectedAssetId.value = null;
  const work = normalizeAssetWork(asset);
  selectedWork.value = work;
  const rawAsset = work.raw as any;
  editForm.value = {
    title: work.title,
    description: work.description || '',
    tags: work.tags.join(', '),
    categoryId: rawAsset.categoryId || '',
    materialCategory: '',
    resolution: '4K',
    isProcedural: false,
    pluginCategory: '',
    pluginVersion: '1.0.0',
    pluginCompatibility: '',
    showcaseType: 'IMAGE',
    videoUrl: '',
    originality: rawAsset.originality || 'ORIGINAL',
    originalAuthor: rawAsset.originalAuthor || '',
    originalLink: rawAsset.originalLink || '',
    license: rawAsset.license || 'CC_BY',
    isFree: rawAsset.isFree !== false,
    meshType: rawAsset.meshType || 'LOW_POLY',
    uvUnwrapped: rawAsset.uvUnwrapped !== false,
    uvOverlapping: !!rawAsset.uvOverlapping,
    pbrChannels: rawAsset.pbrChannels || [],
    rigged: !!rawAsset.rigged,
    gameReady: !!rawAsset.gameReady,
    linkedCourseId: rawAsset.linkedCourseId || '',
    linkedLessonId: rawAsset.linkedLessonId || '',
    installGuide: '',
    file: null,
    packageFile: null,
    thumbnail: null,
  };
  isEditDialogOpen.value = true;
};

const handleSaveEdit = async () => {
  if (!selectedWork.value || !editForm.value.title.trim()) {
    ElMessage.warning(label('请填写作品名称', 'Please fill in the work name'));
    return;
  }
  isSaving.value = true;
  try {
    const work = selectedWork.value;
    const formData = new FormData();
    formData.append('title', editForm.value.title);
    formData.append('description', editForm.value.description);
    formData.append('categoryId', editForm.value.categoryId || '');
    formData.append('tags', editForm.value.tags);
    formData.append('originality', editForm.value.originality || 'ORIGINAL');
    formData.append('originalAuthor', editForm.value.originalAuthor || '');
    formData.append('originalLink', editForm.value.originalLink || '');
    formData.append('license', editForm.value.license || 'CC_BY');
    formData.append('isFree', String(editForm.value.isFree !== false));
    formData.append('meshType', editForm.value.meshType || 'LOW_POLY');
    formData.append('uvUnwrapped', String(editForm.value.uvUnwrapped !== false));
    formData.append('uvOverlapping', String(!!editForm.value.uvOverlapping));
    formData.append('pbrChannels', JSON.stringify(editForm.value.pbrChannels || []));
    formData.append('rigged', String(!!editForm.value.rigged));
    formData.append('gameReady', String(!!editForm.value.gameReady));
    formData.append('linkedCourseId', editForm.value.linkedCourseId || '');
    formData.append('linkedLessonId', editForm.value.linkedLessonId || '');

    if (editForm.value.file) {
      formData.append('asset', editForm.value.file);
    }
    if (editForm.value.packageFile) {
      formData.append('package', editForm.value.packageFile);
    }
    if (editForm.value.thumbnail) {
      formData.append('thumbnail', editForm.value.thumbnail);
    }

    await api.patch(`/api/assets/${work.id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    ElMessage.success(label('保存成功', 'Saved successfully'));
    isEditDialogOpen.value = false;
    fetchAssets();
    fetchInsights();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('保存失败', 'Save failed')));
  } finally {
    isSaving.value = false;
  }
};

const handleDownload = async (asset: AssetListItem, event?: Event) => {
  event?.stopPropagation();
  if (!asset.url) return;
  try {
    const { data } = await api.post(`/api/assets/${asset.id}/download`);
    asset.downloads = data.downloads;
  } catch (error) {
    logError(error, { operation: 'recordAssetDownload', view: 'AssetsView' });
  }
  window.open(getAssetUrl(asset.url), '_blank', 'noopener,noreferrer');
};

const handleLike = async (asset: AssetListItem, event?: Event) => {
  event?.stopPropagation();
  try {
    const { data } = await api.post(`/api/assets/${asset.id}/like`);
    asset.likes = data.likes;
    ElMessage.success(
      data.liked
        ? label('已收藏到喜欢列表', 'Added to favorites')
        : label('已取消喜欢', 'Removed from favorites'),
    );
    fetchInsights();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('操作失败', 'Operation failed')));
  }
};



onMounted(() => {
  fetchAssets();
  fetchInsights();
  fetchCategories();
});

onUnmounted(() => {
  if (searchTimer.value) window.clearTimeout(searchTimer.value);
});
</script>

<template>
  <div class="asset-library-page mobile-adaptive flex flex-col h-full overflow-hidden">
    <AssetLibraryHeader
      v-model:search-query="searchQuery"
      :is-stats-expanded="isStatsExpanded"
      @toggle-stats="isStatsExpanded = !isStatsExpanded"
      @refresh-stats="fetchInsights"
      @upload="isUploadDialogOpen = true"
    />

    <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
      <AssetStatsPanel :is-expanded="isStatsExpanded" :stat-cards="statCards" />

      <section class="workspace-shell">
        <AssetFilterPanel
          :is-open="isFilterOpen"
          :active-category-id="activeCategoryId"
          :selected-format="selectedFormat"
          :selected-tag="selectedTag"
          :my-status-filter="myStatusFilter"
          :active-tab="activeTab"
          :category-tab-options="categoryTabOptions"
          :format-tab-options="formatTabOptions"
          :status-tab-options="statusTabOptions"
          :hot-tags="insights?.hotTags || []"
          @update:active-category-id="activeCategoryId = $event"
          @update:selected-format="selectedFormat = $event"
          @update:selected-tag="selectedTag = $event"
          @update:my-status-filter="myStatusFilter = $event as StatusFilter"
        />

        <AssetContentPanel
          :active-tab="activeTab"
          :sort-key="sortKey"
          :view-mode="viewMode"
          :is-filter-open="isFilterOpen"
          :is-loading="isLoading"
          :visible-assets="visibleAssets"
          :pagination="pagination"
          :library-tab-options="libraryTabOptions"
          :view-mode-options="viewModeOptions"
          :active-filter-chips="activeFilterChips"
          @update:active-tab="activeTab = $event"
          @update:sort-key="sortKey = $event"
          @update:view-mode="viewMode = $event"
          @toggle-filter="isFilterOpen = !isFilterOpen"
          @page-change="handlePageChange"
          @clear-filter="clearFilter"
          @reset-filters="resetFilters"
          @go-to-detail="goToDetail"
          @like="(asset, event) => handleLike(asset, event)"
          @download="(asset, event) => handleDownload(asset, event)"
          @upload="isUploadDialogOpen = true"
        />

        <AssetInsightPanel
          :top-downloads="insights?.topDownloads || []"
          :latest="insights?.latest || []"
          @go-to-detail="goToDetail"
        />
      </section>
    </div>

    <PublishWorkDialog
      v-model="isUploadDialogOpen"
      default-category="asset"
      @published="fetchAssets(); fetchInsights();"
    />

    <AssetDetailModal
      :show="isAssetDetailOpen"
      :asset-id="selectedAssetId"
      @close="closeDetailModal"
      @update="fetchAssets(); fetchInsights();"
      @edit="handleDetailEdit"
    />

    <EditWorkDialog
      v-model:show="isEditDialogOpen"
      v-model:form="editForm"
      :work="selectedWork"
      :is-saving="isSaving"
      :asset-categories="categories"
      :material-categories="[]"
      :plugin-categories="[]"
      @save="handleSaveEdit"
    />
  </div>
</template>

<style scoped>
.asset-library-page {
  height: 100%;
  background: transparent !important;
  color: var(--text-primary);
}

.workspace-shell {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr) 280px;
  gap: 12px;
  min-height: 0;
  flex: 1;
}

@media (max-width: 1180px) {
  .workspace-shell {
    grid-template-columns: 190px minmax(0, 1fr);
  }
}

@media (max-width: 860px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
}
</style>
