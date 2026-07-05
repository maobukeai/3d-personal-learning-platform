<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Activity, Box, FileArchive, Grid3X3, LayoutList, UsersRound, Plus, RefreshCw, Eye, EyeOff, MessageSquare } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
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
import AssetFilterPanel from './components/AssetFilterPanel.vue';
import AssetContentPanel from './components/AssetContentPanel.vue';

const PublishWorkDialog = defineAsyncComponent(() => import('@/components/PublishWorkDialog.vue'));
const AssetDetailModal = defineAsyncComponent(() => import('./components/AssetDetailModal.vue'));
const EditWorkDialog = defineAsyncComponent(() => import('./components/EditWorkDialog.vue'));
import { normalizeAssetWork } from './myWorksModel';
import type { UnifiedWork } from './myWorksModel';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import Button from '@/components/ui/Button.vue';

const router = useRouter();
const route = useRoute();
const label = useLabel();
const searchQuery = ref('');
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
const isFilterCollapsed = ref(false);
const isLoading = ref(false);

// Edit Work dialog state
const isEditDialogOpen = ref(false);
const isSaving = ref(false);
const selectedWork = ref<UnifiedWork | null>(null);
interface EditFormType {
  title: string;
  description: string;
  tags: string;
  categoryId: string;
  materialCategory: string;
  resolution: string;
  isProcedural: boolean;
  pluginCategory: string;
  pluginVersion: string;
  pluginCompatibility: string;
  showcaseType: string;
  videoUrl: string;
  originality: string;
  originalAuthor: string;
  originalLink: string;
  license: string;
  isFree: boolean;
  meshType: string;
  uvUnwrapped: boolean;
  uvOverlapping: boolean;
  pbrChannels: string[];
  rigged: boolean;
  gameReady: boolean;
  linkedCourseId: string;
  linkedLessonId: string;
  installGuide: string;
  file: File | null;
  packageFile: File | null;
  thumbnail: File | null;
  downloadType: 'local' | 'external';
  externalUrl: string;
  extractionCode: string;
  tempAssetPath?: string;
  tempPackagePath?: string;
  tempThumbnailPath?: string;
  tempMaterialPath?: string;
  tempPluginPath?: string;
  tempPreviewPath?: string;
  packageFilesList?: string;
  fileSize?: number;
  packageSize?: number;
}

const editForm = ref<EditFormType>({
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
  pbrChannels: [],
  rigged: false,
  gameReady: false,
  linkedCourseId: '',
  linkedLessonId: '',
  installGuide: '',
  file: null,
  packageFile: null,
  thumbnail: null,
  downloadType: 'local',
  externalUrl: '',
  extractionCode: '',
});
const isUploadDialogOpen = ref(false);

const selectedFavoriteCategory = ref('all');
const favoritedIds = ref<string[]>([]);
const favoriteCategoriesList = ref<string[]>([]);

// Category Modal states
const showCategoryModal = ref(false);
const categoryModalType = ref<'create' | 'rename'>('create');
const categoryModalInputValue = ref('');
const categoryModalOldValue = ref('');
const categoryModalError = ref('');

const categoryModalTitle = computed(() => {
  return categoryModalType.value === 'create'
    ? label('新建分类', 'New Category')
    : label('重命名分类', 'Rename Category');
});

const categoryModalLabel = computed(() => {
  return categoryModalType.value === 'create'
    ? label('请输入新分类名称', 'Please enter a new category name')
    : label(
        `请输入「${categoryModalOldValue.value}」的新名称`,
        `Please enter a new name for "${categoryModalOldValue.value}"`,
      );
});

const assets = ref<AssetListItem[]>([]);
const categories = ref<AssetInsightCategory[]>([]);
const insights = ref<AssetInsights | null>(null);
const searchTimer = ref<number | undefined>();

// Help requests states
interface HelpRequest {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
  userId: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  _count: { replies: number };
}

interface HelpRequestReply {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  linkedAsset?: {
    id: string;
    title: string;
    type: string;
    thumbnail: string | null;
    downloads: number;
  } | null;
}

const helpRequests = ref<HelpRequest[]>([]);
const helpRequestsCount = ref(0);
const isHelpRequestsLoading = ref(false);
const showHelpRequestPostDialog = ref(false);
const newHelpRequestForm = ref({ title: '', description: '' });
const isSubmittingHelpRequest = ref(false);

const selectedHelpRequest = ref<HelpRequest | null>(null);
const showHelpRequestDetailModal = ref(false);
const helpRequestReplies = ref<HelpRequestReply[]>([]);
const isHelpRepliesLoading = ref(false);
const newHelpReplyContent = ref('');
const linkedAssetIdForReply = ref('');
const isSubmittingReply = ref(false);
const approvedAssetsForLinking = ref<{ id: string; title: string }[]>([]);

type LibraryTab = 'explore' | 'favorites' | 'mine' | 'drafts' | 'requests';
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

const activeTab = ref<LibraryTab>('explore');
const myStatusFilter = ref<StatusFilter>('all');

const libraryTabs = computed(() => [
  {
    key: 'explore' as const,
    label: label('模型广场', 'Explore'),
    count: insights.value?.summary.total || 0,
  },
  {
    key: 'favorites' as const,
    label: label('我的收藏', 'Favorites'),
    count: insights.value?.summary.myLikes || 0,
  },
  {
    key: 'mine' as const,
    label: label('我的模型', 'My Uploads'),
    count: insights.value?.summary.myUploads || 0,
  },
  {
    key: 'drafts' as const,
    label: label('草稿箱', 'Drafts'),
    count: insights.value?.summary.myDrafts || 0,
  },
  {
    key: 'requests' as const,
    label: label('模型求助', 'Help Requests'),
    count: helpRequestsCount.value,
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
    label('全部模型', 'All Models'),
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

watch([activeCategoryId, sortKey, activeTab, myStatusFilter, selectedFavoriteCategory], () => {
  pagination.value.page = 1;
  fetchAssets();
});

const isBatchMode = ref(false);
const selectedAssetIds = ref<Set<string>>(new Set());

const toggleAssetSelect = (id: string) => {
  const next = new Set(selectedAssetIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedAssetIds.value = next;
};

const selectAllAssets = () => {
  if (selectedAssetIds.value.size === assets.value.length && assets.value.length > 0) {
    selectedAssetIds.value = new Set();
  } else {
    selectedAssetIds.value = new Set(assets.value.map((a) => a.id));
  }
};

const handleBulkDelete = async () => {
  if (selectedAssetIds.value.size === 0) {
    ElMessage.warning(label('请选择要删除的资源', 'Please select assets to delete'));
    return;
  }

  try {
    await ElMessageBox.confirm(
      label(
        `确定要物理删除选中的 ${selectedAssetIds.value.size} 个资源/草稿吗？关联文件也将被同步清除，此操作不可撤销！`,
        `Are you sure you want to delete ${selectedAssetIds.value.size} selected assets? Associated files will also be deleted!`,
      ),
      label('批量删除确认', 'Confirm Bulk Delete'),
      {
        confirmButtonText: label('确定删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    const ids = Array.from(selectedAssetIds.value);
    await api.post('/api/assets/bulk-delete', { ids });

    ElMessage.success(label(`成功删除 ${ids.length} 个资源`, `Successfully deleted ${ids.length} assets`));
    selectedAssetIds.value = new Set();
    fetchAssets();
    fetchInsights();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(getApiErrorMessage(err, label('批量删除失败', 'Failed to bulk delete assets')));
    }
  }
};

const handleBulkUnfavorite = async () => {
  if (selectedAssetIds.value.size === 0) {
    ElMessage.warning(label('请选择要取消收藏的资源', 'Please select assets to unfavorite'));
    return;
  }

  try {
    await ElMessageBox.confirm(
      label(
        `确定要批量取消收藏选中的 ${selectedAssetIds.value.size} 个资源吗？`,
        `Are you sure you want to unfavorite ${selectedAssetIds.value.size} selected assets?`,
      ),
      label('批量取消收藏确认', 'Confirm Bulk Unfavorite'),
      {
        confirmButtonText: label('确定', 'Confirm'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    const ids = Array.from(selectedAssetIds.value);
    await api.post('/api/assets/bulk/favorite', { ids, favorite: false });

    ElMessage.success(label(`成功取消收藏 ${ids.length} 个资源`, `Successfully unfavorited ${ids.length} assets`));
    selectedAssetIds.value = new Set();
    isBatchMode.value = false;
    fetchAssets();
    fetchInsights();
    fetchFavorites();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(getApiErrorMessage(err, label('批量取消收藏失败', 'Failed to bulk unfavorite assets')));
    }
  }
};

watch(activeTab, () => {
  selectedFavoriteCategory.value = 'all';
  isBatchMode.value = false;
  selectedAssetIds.value = new Set();
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
        mine: activeTab.value === 'mine' || activeTab.value === 'drafts' ? 'true' : undefined,
        favoritesOnly: activeTab.value === 'favorites' ? 'true' : undefined,
        favoriteCategory:
          activeTab.value === 'favorites' && selectedFavoriteCategory.value !== 'all'
            ? selectedFavoriteCategory.value
            : undefined,
        status:
          activeTab.value === 'drafts'
            ? 'PENDING'
            : activeTab.value === 'mine' && myStatusFilter.value !== 'all'
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

const fetchFavorites = async () => {
  try {
    const { data } = await api.get('/api/assets/favorites');
    favoritedIds.value = data.ids || [];
    favoriteCategoriesList.value = data.categories || [];
  } catch (error) {
    logError(error, { operation: 'fetchAssetFavorites', view: 'AssetsView' });
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
  selectedFavoriteCategory.value = 'all';
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
  { immediate: true },
);

const handleContainerClick = (e: MouseEvent) => {
  if (!isBatchMode.value) return;
  const target = e.target as HTMLElement;
  if (!target) return;
  if (target.closest('article, .unified-card, button, input, .el-select, .el-popper, a, select')) {
    return;
  }
  isBatchMode.value = false;
  selectedAssetIds.value = new Set();
};

const goToDetail = (asset: AssetListItem) => {
  if (isBatchMode.value) {
    toggleAssetSelect(asset.id);
    return;
  }
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

  const fileUrl = rawAsset.url || '';
  const isExternal = fileUrl.startsWith('http://') || fileUrl.startsWith('https://') ? !fileUrl.includes('/uploads/') : false;
  let extUrl = '';
  let extCode = '';
  if (isExternal) {
    const match = fileUrl.match(/(.*?)(?:\s+提取码[:：]\s*(\w+)|提取码[:：]\s*(\w+)|$)/i);
    if (match) {
      extUrl = match[1].trim();
      extCode = (match[2] || match[3] || '').trim();
    } else {
      extUrl = fileUrl.trim();
    }
  }

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
    downloadType: isExternal ? 'external' : 'local',
    externalUrl: extUrl,
    extractionCode: extCode,
  };
  isEditDialogOpen.value = true;
};

const handleSaveEdit = async () => {
  if (!selectedWork.value || !editForm.value.title.trim()) {
    ElMessage.warning(label('请填写作品名称', 'Please fill in the work name'));
    return;
  }
  if (editForm.value.downloadType === 'external' && !editForm.value.externalUrl.trim()) {
    ElMessage.warning('请填写网盘链接或外部下载链接');
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

    if (editForm.value.downloadType === 'local') {
      if (editForm.value.tempAssetPath) {
        formData.append('tempAssetPath', editForm.value.tempAssetPath);
      } else if (editForm.value.file) {
        formData.append('asset', editForm.value.file);
      }
    } else {
      let finalUrl = editForm.value.externalUrl.trim();
      if (editForm.value.extractionCode?.trim()) {
        finalUrl += ` 提取码: ${editForm.value.extractionCode.trim()}`;
      }
      formData.append('externalUrl', finalUrl);
    }
    if (editForm.value.tempPackagePath) {
      formData.append('tempPackagePath', editForm.value.tempPackagePath);
    } else if (editForm.value.packageFile) {
      formData.append('package', editForm.value.packageFile);
    }
    if (editForm.value.tempThumbnailPath) {
      formData.append('tempThumbnailPath', editForm.value.tempThumbnailPath);
    } else if (editForm.value.thumbnail) {
      formData.append('thumbnail', editForm.value.thumbnail);
    }
    if (editForm.value.fileSize !== undefined) {
      formData.append('fileSize', String(editForm.value.fileSize));
    }
    if (editForm.value.packageSize !== undefined) {
      formData.append('packageSize', String(editForm.value.packageSize));
    }
    if (editForm.value.packageFilesList) {
      formData.append('packageFilesList', editForm.value.packageFilesList);
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
    const isFav = favoritedIds.value.includes(asset.id);
    let category = '默认';

    if (!isFav && selectedFavoriteCategory.value !== 'all') {
      category = selectedFavoriteCategory.value;
    }

    const { data } = await api.post(`/api/assets/${asset.id}/like`, {
      category,
    });
    asset.likes = data.likes;

    if (data.liked) {
      if (!favoritedIds.value.includes(asset.id)) favoritedIds.value.push(asset.id);
    } else {
      favoritedIds.value = favoritedIds.value.filter((id) => id !== asset.id);
    }

    ElMessage.success(
      data.liked
        ? label('已收藏到喜欢列表', 'Added to favorites')
        : label('已取消喜欢', 'Removed from favorites'),
    );
    await fetchInsights();
    await fetchFavorites();
    if (activeTab.value === 'favorites') {
      await fetchAssets();
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('操作失败', 'Operation failed')));
  }
};

const handleCreateFavoriteCategory = () => {
  categoryModalType.value = 'create';
  categoryModalInputValue.value = '';
  categoryModalOldValue.value = '';
  categoryModalError.value = '';
  showCategoryModal.value = true;
};

const handleRenameFavoriteCategory = (cat: string) => {
  categoryModalType.value = 'rename';
  categoryModalInputValue.value = cat;
  categoryModalOldValue.value = cat;
  categoryModalError.value = '';
  showCategoryModal.value = true;
};

const handleCategoryModalSubmit = async () => {
  const val = categoryModalInputValue.value.trim();
  if (!val) {
    categoryModalError.value = label('请输入分类名称', 'Please enter category name');
    return;
  }
  if (val === '默认') {
    categoryModalError.value = label('不能命名为默认分类', 'Cannot name as default');
    return;
  }

  if (categoryModalType.value === 'create') {
    if (favoriteCategoriesList.value.includes(val)) {
      categoryModalError.value = label('分类已存在', 'Category already exists');
      return;
    }
    try {
      await api.post('/api/assets/favorites/categories', {
        category: val,
      });
      ElMessage.success(label('分类创建成功', 'Category created successfully'));
      selectedFavoriteCategory.value = val;
      showCategoryModal.value = false;
      await fetchFavorites();
      await fetchAssets();
    } catch (error) {
      ElMessage.error(
        getApiErrorMessage(error, label('创建分类失败', 'Failed to create category')),
      );
    }
  } else {
    // rename
    if (val === categoryModalOldValue.value) {
      showCategoryModal.value = false;
      return;
    }
    try {
      await api.put('/api/assets/favorites/categories', {
        oldCategory: categoryModalOldValue.value,
        newCategory: val,
      });
      ElMessage.success(label('分类重命名成功', 'Category renamed successfully'));
      if (selectedFavoriteCategory.value === categoryModalOldValue.value) {
        selectedFavoriteCategory.value = val;
      }
      showCategoryModal.value = false;
      await fetchFavorites();
      await fetchAssets();
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, label('重命名失败', 'Rename failed')));
    }
  }
};

const handleDeleteFavoriteCategory = async (cat: string) => {
  try {
    await ElMessageBox.confirm(
      label(
        `确认删除收藏夹分类「${cat}」？此操作将取消该分类下所有资产的收藏。`,
        `Delete favorite folder "${cat}"? This will remove all favorites inside this folder.`,
      ),
      label('删除分类', 'Delete Category'),
      {
        confirmButtonText: label('删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    await api.delete(`/api/assets/favorites/categories/${encodeURIComponent(cat)}`);

    ElMessage.success(label('分类删除成功', 'Category deleted successfully'));
    if (selectedFavoriteCategory.value === cat) {
      selectedFavoriteCategory.value = 'all';
    }
    await fetchFavorites();
    await fetchAssets();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
    }
  }
};

const fetchHelpRequests = async () => {
  try {
    isHelpRequestsLoading.value = true;
    const { data } = await api.get('/api/assets/requests');
    helpRequests.value = data.requests || [];
    helpRequestsCount.value = data.pagination?.total || helpRequests.value.length;
  } catch (err) {
    logError(err, { operation: 'fetch help requests' });
  } finally {
    isHelpRequestsLoading.value = false;
  }
};

const fetchApprovedAssetsForLinking = async () => {
  try {
    const { data } = await api.get('/api/assets/public', { params: { pageSize: 100 } });
    const list = data.assets || [];
    approvedAssetsForLinking.value = list.map((a: any) => ({ id: a.id, title: a.title }));
  } catch (err) {
    logError(err, { operation: 'fetch assets for linking' });
  }
};

const openHelpRequestDetail = async (req: HelpRequest) => {
  selectedHelpRequest.value = req;
  showHelpRequestDetailModal.value = true;
  newHelpReplyContent.value = '';
  linkedAssetIdForReply.value = '';

  isHelpRepliesLoading.value = true;
  try {
    const { data } = await api.get(`/api/assets/requests/${req.id}`);
    helpRequestReplies.value = data.replies || [];
  } catch (err) {
    logError(err, { operation: 'load replies' });
  } finally {
    isHelpRepliesLoading.value = false;
  }

  fetchApprovedAssetsForLinking();
};

const handlePostHelpRequest = async () => {
  if (!newHelpRequestForm.value.title.trim() || !newHelpRequestForm.value.description.trim())
    return;
  isSubmittingHelpRequest.value = true;
  try {
    await api.post('/api/assets/requests', {
      title: newHelpRequestForm.value.title.trim(),
      description: newHelpRequestForm.value.description.trim(),
    });
    ElMessage.success(label('求助帖发布成功', 'Help request posted successfully'));
    newHelpRequestForm.value = { title: '', description: '' };
    showHelpRequestPostDialog.value = false;
    await fetchHelpRequests();
  } catch (err) {
    logError(err, { operation: 'post help request' });
    ElMessage.error(label('发布失败', 'Failed to post'));
  } finally {
    isSubmittingHelpRequest.value = false;
  }
};

const handlePostReply = async () => {
  if (!selectedHelpRequest.value || !newHelpReplyContent.value.trim()) return;
  isSubmittingReply.value = true;
  try {
    const { data } = await api.post(
      `/api/assets/requests/${selectedHelpRequest.value.id}/replies`,
      {
        content: newHelpReplyContent.value.trim(),
        linkedAssetId: linkedAssetIdForReply.value || undefined,
      },
    );
    helpRequestReplies.value.push(data);
    newHelpReplyContent.value = '';
    linkedAssetIdForReply.value = '';
    ElMessage.success(label('回复发表成功', 'Reply posted successfully'));
    selectedHelpRequest.value._count = selectedHelpRequest.value._count || { replies: 0 };
    selectedHelpRequest.value._count.replies += 1;
    fetchHelpRequests();
  } catch (err) {
    logError(err, { operation: 'post reply' });
    ElMessage.error(label('回复失败', 'Failed to reply'));
  } finally {
    isSubmittingReply.value = false;
  }
};

const handleResolveRequest = async (requestId: string) => {
  try {
    await api.post(`/api/assets/requests/${requestId}/resolve`);
    ElMessage.success(label('求助帖已解决并关闭', 'Request marked as resolved'));
    if (selectedHelpRequest.value) {
      selectedHelpRequest.value.status = 'RESOLVED';
    }
    await fetchHelpRequests();
  } catch (err) {
    logError(err, { operation: 'resolve request' });
    ElMessage.error(label('操作失败', 'Action failed'));
  }
};

const openLinkedAsset = (assetId: string) => {
  showHelpRequestDetailModal.value = false;
  const asset = assets.value.find((item) => item.id === assetId);
  if (asset) {
    goToDetail(asset);
  } else {
    window.location.hash = `#/assets?asset=${assetId}`;
    window.location.reload();
  }
};

watch(activeTab, (newTab) => {
  if (newTab === 'requests') {
    fetchHelpRequests();
  }
});

onMounted(() => {
  fetchAssets();
  fetchInsights();
  fetchCategories();
  fetchFavorites();
  fetchHelpRequests();
});

onUnmounted(() => {
  if (searchTimer.value) window.clearTimeout(searchTimer.value);
});
</script>

<template>
  <div class="asset-library-page mobile-adaptive flex flex-col h-full overflow-hidden" @click="handleContainerClick">
    <AssetLibraryHeader
      v-model:search-query="searchQuery"
      @upload="isUploadDialogOpen = true"
      @success="fetchAssets"
    />

    <div class="flex-1 overflow-y-auto p-4 pt-2.5 flex flex-col gap-3">

      <section class="workspace-shell" :class="{ 'single-col': activeTab === 'requests', 'collapsed-shell': isFilterCollapsed }">
        <AssetFilterPanel
          v-if="activeTab !== 'requests'"
          :is-open="isFilterOpen"
          v-model:collapsed="isFilterCollapsed"
          :active-category-id="activeCategoryId"
          :selected-format="selectedFormat"
          :selected-tag="selectedTag"
          :my-status-filter="myStatusFilter"
          :active-tab="activeTab"
          :category-tab-options="categoryTabOptions"
          :format-tab-options="formatTabOptions"
          :status-tab-options="statusTabOptions"
          :hot-tags="insights?.hotTags || []"
          :favorite-categories="favoriteCategoriesList"
          :selected-favorite-category="selectedFavoriteCategory"
          @update:active-category-id="activeCategoryId = $event"
          @update:selected-format="selectedFormat = $event"
          @update:selected-tag="selectedTag = $event"
          @update:my-status-filter="myStatusFilter = $event as StatusFilter"
          @update:selected-favorite-category="selectedFavoriteCategory = $event"
          @rename-category="handleRenameFavoriteCategory"
          @delete-category="handleDeleteFavoriteCategory"
          @create-category="handleCreateFavoriteCategory"
        />

        <AssetContentPanel
          :active-tab="activeTab"
          :sort-key="sortKey"
          :view-mode="viewMode"
          :is-filter-open="isFilterOpen"
          :is-filter-collapsed="isFilterCollapsed"
          @toggle-filter-collapse="isFilterCollapsed = false"
          :is-loading="isLoading"
          :visible-assets="visibleAssets"
          :pagination="pagination"
          :library-tab-options="libraryTabOptions"
          :view-mode-options="viewModeOptions"
          :active-filter-chips="activeFilterChips"
          :is-batch-mode="isBatchMode"
          :selected-ids="Array.from(selectedAssetIds)"
          :help-requests="helpRequests"
          :is-help-requests-loading="isHelpRequestsLoading"
          @update:active-tab="activeTab = $event"
          @update:sort-key="sortKey = $event"
          @update:view-mode="viewMode = $event"
          @update:is-batch-mode="isBatchMode = $event; if (!$event) selectedAssetIds = new Set();"
          @select="toggleAssetSelect"
          @select-all="selectAllAssets"
          @bulk-delete="handleBulkDelete"
          @bulk-unfavorite="handleBulkUnfavorite"
          @toggle-filter="isFilterOpen = !isFilterOpen"
          @page-change="handlePageChange"
          @clear-filter="clearFilter"
          @reset-filters="resetFilters"
          @go-to-detail="goToDetail"
          @like="(asset, event) => handleLike(asset, event)"
          @download="(asset, event) => handleDownload(asset, event)"
          @upload="isUploadDialogOpen = true"
          @open-help-request-detail="openHelpRequestDetail"
          @create-help-request="showHelpRequestPostDialog = true"
        />
      </section>
    </div>

    <PublishWorkDialog
      v-if="isUploadDialogOpen"
      v-model="isUploadDialogOpen"
      default-category="asset"
      @published="
        fetchAssets();
        fetchInsights();
      "
    />

    <AssetDetailModal
      v-if="isAssetDetailOpen"
      :show="isAssetDetailOpen"
      :asset-id="selectedAssetId"
      @close="closeDetailModal"
      @update="
        fetchAssets();
        fetchInsights();
      "
      @edit="handleDetailEdit"
    />

    <EditWorkDialog
      v-if="isEditDialogOpen"
      v-model:show="isEditDialogOpen"
      v-model:form="editForm"
      :work="selectedWork"
      :is-saving="isSaving"
      :asset-categories="categories"
      :material-categories="[]"
      :plugin-categories="[]"
      @save="handleSaveEdit"
    />

    <!-- Help Request Detail Modal -->
    <HelpRequestDetailModal
      :show="showHelpRequestDetailModal"
      :request="selectedHelpRequest"
      :replies="helpRequestReplies"
      :is-replies-loading="isHelpRepliesLoading"
      :is-submitting-reply="isSubmittingReply"
      :approved-items-for-linking="approvedAssetsForLinking"
      :link-label="label('关联模型：', 'Link Model:')"
      @close="
        showHelpRequestDetailModal = false;
        selectedHelpRequest = null;
      "
      @post-reply="handlePostReply"
      @resolve="handleResolveRequest"
      @open-linked-item="openLinkedAsset"
    />

    <!-- Help Request Post Modal -->
    <HelpRequestPostModal
      :show="showHelpRequestPostDialog"
      :is-submitting="isSubmittingHelpRequest"
      :modal-title="label('发布新模型求助帖', 'Create Help Request')"
      :title-placeholder="label('例如：寻找写实科幻飞船模型', 'e.g. looking for sci-fi spaceship model')"
      :desc-placeholder="label('请详细描述您需要的模型规格、格式或参考，让大家能更精准地帮您找到！', 'Describe model details...')"
      @close="showHelpRequestPostDialog = false"
      @submit="handlePostHelpRequest"
    />

    <!-- Favorite Category Create/Rename Modal -->
    <Modal :show="showCategoryModal" size="sm" @close="showCategoryModal = false">
      <template #header>
        <h3 class="text-sm font-bold text-[var(--text-primary)]">{{ categoryModalTitle }}</h3>
      </template>

      <div class="flex flex-col gap-4 text-left">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
          >
            {{ categoryModalLabel }}
          </label>
          <Input
            v-model="categoryModalInputValue"
            type="text"
            placeholder="例如：游戏模型、写实建筑"
            required
            @input="categoryModalError = ''"
            @keyup.enter="handleCategoryModalSubmit"
          />
          <p v-if="categoryModalError" class="text-xs text-rose-500 mt-1.5 ml-1">
            {{ categoryModalError }}
          </p>
        </div>

        <div class="flex justify-end gap-2 mt-2">
          <Button variant="secondary" size="sm" @click="showCategoryModal = false">{{
            label('取消', 'Cancel')
          }}</Button>
          <Button
            variant="primary"
            size="sm"
            :disabled="!categoryModalInputValue.trim()"
            @click="handleCategoryModalSubmit"
            >{{ label('确定', 'Confirm') }}</Button
          >
        </div>
      </div>
    </Modal>
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
  grid-template-columns: 156px minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  flex: 1;
  transition: grid-template-columns 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.workspace-shell.collapsed-shell {
  grid-template-columns: 1fr;
}

.workspace-shell.single-col {
  grid-template-columns: 1fr;
}

@media (max-width: 860px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
}
</style>
