<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Activity, Box, FileArchive, Grid3X3, LayoutList, UsersRound } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import type { Category } from '@/types';
import { useLabel } from '@/utils/i18n';
import {
  ASSET_UPLOAD_FORMAT_OPTIONS,
  buildActiveAssetFilterChips,
  buildAssetCategoryOptions,
  buildAssetFormatOptions,
  buildAssetUploadFormData,
  createAssetUploadForm,
  filterVisibleAssets,
  isAssetUploadReady,
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
import AssetUploadModal from './components/AssetUploadModal.vue';

const router = useRouter();
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
const isUploading = ref(false);
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
    label: label('我的提交', 'My Uploads'),
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

const uploadForm = ref(createAssetUploadForm());
const uploadFormatOptions = ASSET_UPLOAD_FORMAT_OPTIONS;

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

const uploadCanSubmit = computed(() => isAssetUploadReady(uploadForm.value));

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

const goToDetail = (asset: AssetListItem) => {
  router.push({ name: 'AssetDetail', params: { id: asset.id } });
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

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploadForm.value.file = file;
  if (!uploadForm.value.title.trim()) {
    uploadForm.value.title = file.name.replace(/\.[^.]+$/, '');
  }
};

const handleThumbnailChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) uploadForm.value.thumbnail = file;
};

const resetUploadForm = () => {
  uploadForm.value = createAssetUploadForm();
};

const submitUpload = async () => {
  if (!uploadCanSubmit.value) {
    ElMessage.warning(
      label('请补全资源名称、分类和文件来源', 'Please complete asset name, category, and source'),
    );
    return;
  }

  const formData = buildAssetUploadFormData(uploadForm.value);

  try {
    isUploading.value = true;
    await api.post('/api/assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success(label('资源已提交审核', 'Asset submitted for review'));
    isUploadDialogOpen.value = false;
    resetUploadForm();
    await Promise.all([fetchAssets(), fetchInsights(), fetchCategories()]);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('上传失败', 'Upload failed')));
  } finally {
    isUploading.value = false;
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
  <div class="asset-library-page mobile-adaptive">
    <AssetLibraryHeader
      v-model:search-query="searchQuery"
      :is-stats-expanded="isStatsExpanded"
      @toggle-stats="isStatsExpanded = !isStatsExpanded"
      @refresh-stats="fetchInsights"
      @upload="isUploadDialogOpen = true"
    />

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

    <AssetUploadModal
      :show="isUploadDialogOpen"
      :upload-form="uploadForm"
      :is-uploading="isUploading"
      :upload-can-submit="uploadCanSubmit"
      :categories="categories"
      :upload-format-options="uploadFormatOptions"
      @close="isUploadDialogOpen = false"
      @submit="submitUpload"
      @update:upload-form="uploadForm = $event"
      @file-change="handleFileChange"
      @thumbnail-change="handleThumbnailChange"
    />
  </div>
</template>

<style scoped>
.asset-library-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
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
  .asset-library-page {
    padding: 12px;
  }

  .workspace-shell {
    grid-template-columns: 1fr;
  }
}
</style>
