<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import {
  Box,
  Bone,
  CheckCircle2,
  Grid3X3,
  Import,
  Layers,
  LayoutList,
  Package,
  Puzzle,
  ShieldCheck,
  Sun,
  Wrench,
  Plus,
  ExternalLink,
  RefreshCw,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useSystemStore } from '@/stores/system';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import { useAuthStore } from '@/stores/auth';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { parseTags } from './resourceUtils';
import { useLabel } from '@/utils/i18n';
import SoftwarePageHeader from './components/SoftwarePageHeader.vue';
import SoftwareFiltersPanel from './components/SoftwareFiltersPanel.vue';
import SoftwareToolbar from './components/SoftwareToolbar.vue';
import SoftwareCatalog from './components/SoftwareCatalog.vue';

const UnifiedDetailModal = defineAsyncComponent(() => import('./components/UnifiedDetailModal.vue'));
const PublishWorkDialog = defineAsyncComponent(() => import('@/components/PublishWorkDialog.vue'));
const EditWorkDialog = defineAsyncComponent(() => import('./components/EditWorkDialog.vue'));
import { normalizeSoftwareWork } from './myWorksModel';
import type { UnifiedWork } from './myWorksModel';

type SoftwareStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type SortMode = 'latest' | 'popular' | 'name';

interface SoftwareUser {
  id?: string;
  name?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}

interface SoftwareItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  version: string;
  compatibility: string;
  downloads: number;
  fileUrl?: string | null;
  fileSize?: number | null;
  previewUrl?: string | null;
  installGuide: string;
  status: SoftwareStatus;
  rejectReason?: string | null;
  createdAt: string;
  user?: SoftwareUser | null;
  bilibiliUrl?: string | null;
}

interface SoftwareInsights {
  summary: {
    total: number;
    pending: number;
    myPending?: number;
    downloads: number;
    categories: number;
    favoriteCount: number;
    averageSize: number;
    myUploads?: number;
  };
  categories: { name: string; count: number; downloads: number }[];
  hotTags: { label: string; count: number }[];
  topDownloads: SoftwareItem[];
  latest: SoftwareItem[];
  favoriteIds: string[];
}

interface StarterSoftwareTemplate {
  title: string;
  description: string;
  category: string;
  compatibility: string;
  tags: string[];
  packageType: string;
  Icon: Component;
  tone: string;
}

interface MarketplaceSignal {
  title: string;
  description: string;
  Icon: Component;
}

const CATEGORY_ALL = '全部软件';
const CATEGORY_OTHER = '其他工具';

const { locale } = useI18n();
const route = useRoute();

const label = useLabel();

const categoryLabel = (category?: string | null) => {
  const normalized = category || CATEGORY_OTHER;
  const englishLabels: Record<string, string> = {
    [CATEGORY_ALL]: 'All Softwares',
    [CATEGORY_OTHER]: 'Other Tools',
    '3D 建模与雕刻软件': '3D Modeling & Sculpting',
    '渲染引擎与渲染器': 'Rendering Engines',
    '后期与图像处理': 'Post & Image Processing',
    '游戏与交互引擎': 'Game & Interactive Engines',
  };
  return locale.value === 'en-US' ? englishLabels[normalized] || normalized : normalized;
};

const systemStore = useSystemStore();
const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

function isSoftwareOwner(software: SoftwareItem) {
  return Boolean(
    currentUserId.value &&
    (software.user?.id === currentUserId.value || (software as any).userId === currentUserId.value),
  );
}

function canEditSoftware(software: SoftwareItem) {
  return isAdmin.value || isSoftwareOwner(software);
}
const softwaresList = ref<SoftwareItem[]>([]);
const searchQuery = ref('');
const activeCategory = ref(CATEGORY_ALL);
const selectedTag = ref('all');
const sortBy = ref<SortMode>('latest');
const viewMode = ref<'grid' | 'list'>('grid');
const viewModeOptions = computed<{ value: 'grid' | 'list'; label: string; icon: Component }[]>(
  () => [
    { value: 'grid', label: '', icon: Grid3X3 },
    { value: 'list', label: '', icon: LayoutList },
  ],
);
const showFavoritesOnly = ref(false);
const favoritedIds = ref<string[]>([]);
const insights = ref<SoftwareInsights | null>(null);

type LibraryTab = 'explore' | 'favorites' | 'mine' | 'drafts' | 'requests';
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

const activeTab = ref<LibraryTab>('explore');
const myStatusFilter = ref<StatusFilter>('all');

// Favorites categories list
const selectedFavoriteCategory = ref('all');
const favoriteCategoriesList = ref<string[]>([]);

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
  linkedSoftware?: {
    id: string;
    title: string;
    version: string;
    previewUrl: string | null;
    downloads: number;
  } | null;
}

const helpRequests = ref<HelpRequest[]>([]);
const helpRequestsCount = ref(0);
const isHelpRequestsLoading = ref(false);
const showHelpRequestPostDialog = ref(false);
const newHelpRequestForm = ref({ title: '', description: '' });
const isSubmittingHelpRequest = ref(false);

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
    ? label('请输入新建收藏夹分类的名称', 'Please enter a name for the new favorite folder')
    : label(
        `请输入「${categoryModalOldValue.value}」的新名称`,
        `Please enter a new name for "${categoryModalOldValue.value}"`,
      );
});

const selectedHelpRequest = ref<HelpRequest | null>(null);
const showHelpRequestDetailModal = ref(false);
const helpRequestReplies = ref<HelpRequestReply[]>([]);
const isHelpRepliesLoading = ref(false);
const newHelpReplyContent = ref('');
const linkedSoftwareIdForReply = ref('');
const isSubmittingReply = ref(false);
const approvedSoftwaresForLinking = ref<{ id: string; title: string }[]>([]);

const libraryTabs = computed(() => [
  {
    key: 'explore' as const,
    label: label('插件广场', 'Explore'),
    count: insights.value?.summary.total || 0,
  },
  {
    key: 'favorites' as const,
    label: label('我的收藏', 'Favorites'),
    count: insights.value?.summary.favoriteCount || favoritedIds.value.length,
  },
  {
    key: 'mine' as const,
    label: label('我的插件', 'My Uploads'),
    count: insights.value?.summary.myUploads || 0,
  },
  {
    key: 'drafts' as const,
    label: label('草稿箱', 'Drafts'),
    count: insights.value?.summary.myPending || 0,
  },
  {
    key: 'requests' as const,
    label: label('插件求助', 'Help Requests'),
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
const downloadingIds = ref<Record<string, boolean>>({});
const isLoading = ref(false);

const isUploadDialogOpen = ref(false);
const initialPublishData = ref<any>(null);
watch(isUploadDialogOpen, (val) => {
  if (!val) {
    initialPublishData.value = null;
  }
});
const isDetailDialogOpen = ref(false);

const isBatchMode = ref(false);
const selectedSoftwareIds = ref<Set<string>>(new Set());

const toggleSoftwareSelect = (id: string) => {
  const next = new Set(selectedSoftwareIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedSoftwareIds.value = next;
};

const selectAllSoftwares = () => {
  if (selectedSoftwareIds.value.size === visibleSoftwares.value.length && visibleSoftwares.value.length > 0) {
    selectedSoftwareIds.value = new Set();
  } else {
    selectedSoftwareIds.value = new Set(visibleSoftwares.value.map((p) => p.id));
  }
};

const handleBulkDeleteSoftwares = async () => {
  if (selectedSoftwareIds.value.size === 0) {
    ElMessage.warning(label('请选择要删除的插件', 'Please select softwares to delete'));
    return;
  }

  try {
    await ElMessageBox.confirm(
      label(
        `确定要物理删除选中的 ${selectedSoftwareIds.value.size} 个插件/草稿吗？关联文件也将被同步清除，此操作不可撤销！`,
        `Are you sure you want to delete ${selectedSoftwareIds.value.size} selected softwares? Associated files will also be deleted!`,
      ),
      label('批量删除确认', 'Confirm Bulk Delete'),
      {
        confirmButtonText: label('确定删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    const ids = Array.from(selectedSoftwareIds.value);
    await api.post('/api/softwares/bulk-delete', { ids });

    ElMessage.success(label(`成功删除 ${ids.length} 个插件`, `Successfully deleted ${ids.length} softwares`));
    selectedSoftwareIds.value = new Set();
    fetchSoftwares();
    fetchInsights();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(getApiErrorMessage(err, label('批量删除失败', 'Failed to bulk delete softwares')));
    }
  }
};

const handleBulkUnfavoriteSoftwares = async () => {
  if (selectedSoftwareIds.value.size === 0) {
    ElMessage.warning(label('请选择要取消收藏的插件', 'Please select softwares to unfavorite'));
    return;
  }

  try {
    await ElMessageBox.confirm(
      label(
        `确定要批量取消收藏选中的 ${selectedSoftwareIds.value.size} 个插件吗？`,
        `Are you sure you want to unfavorite ${selectedSoftwareIds.value.size} selected softwares?`,
      ),
      label('批量取消收藏确认', 'Confirm Bulk Unfavorite'),
      {
        confirmButtonText: label('确定', 'Confirm'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    const ids = Array.from(selectedSoftwareIds.value);
    await api.post('/api/softwares/bulk/favorite', { ids, favorite: false });

    ElMessage.success(label(`成功取消收藏 ${ids.length} 个插件`, `Successfully unfavorited ${ids.length} softwares`));
    selectedSoftwareIds.value = new Set();
    isBatchMode.value = false;
    fetchSoftwares();
    fetchInsights();
    fetchFavorites();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(getApiErrorMessage(err, label('批量取消收藏失败', 'Failed to bulk unfavorite softwares')));
    }
  }
};

watch(activeTab, () => {
  isBatchMode.value = false;
  selectedSoftwareIds.value = new Set();
});

// Local EditWorkDialog state
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
  tempSoftwarePath?: string;
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

const pluginCategories = computed(() =>
  (systemStore.settings.SOFTWARE_CATEGORIES || []).filter(
    (name: string) => name !== '全部软件' && name !== '全部',
  ),
);
const selectedSoftware = ref<SoftwareItem | null>(null);

const availableCategories = computed(() => {
  const configured = (systemStore.settings.SOFTWARE_CATEGORIES || []).filter(
    (name: string) => name !== CATEGORY_ALL,
  );

  const fromData = [
    ...softwaresList.value.map((software) => software.category).filter(Boolean),
    ...(insights.value?.categories || []).map((category) => category.name),
  ].filter((name) => name !== CATEGORY_ALL);

  return [CATEGORY_ALL, ...Array.from(new Set([...configured, ...fromData]))];
});

const visibleSoftwares = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let list = [...softwaresList.value];

  if (activeCategory.value !== CATEGORY_ALL) {
    list = list.filter((software) => software.category === activeCategory.value);
  }

  if (query) {
    list = list.filter((software) => {
      return [software.title, software.description, software.tags, software.compatibility, software.category]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }

  if (showFavoritesOnly.value) {
    list = list.filter((software) => favoritedIds.value.includes(software.id));
  }

  if (selectedTag.value !== 'all') {
    list = list.filter((software) => parseTags(software.tags).includes(selectedTag.value));
  }

  return list.sort((a, b) => {
    if (sortBy.value === 'popular') return b.downloads - a.downloads;
    if (sortBy.value === 'name')
      return a.title.localeCompare(b.title, locale.value === 'en-US' ? 'en-US' : 'zh-CN');
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

const stats = computed(() => ({
  total: insights.value?.summary.total || softwaresList.value.length,
  downloads:
    insights.value?.summary.downloads ||
    softwaresList.value.reduce((sum, software) => sum + software.downloads, 0),
  favorites: favoritedIds.value.length || insights.value?.summary.favoriteCount || 0,
  categories:
    insights.value?.summary.categories ||
    new Set(softwaresList.value.map((software) => software.category)).size,
}));

const spotlightSoftware = computed(() => {
  return (
    visibleSoftwares.value[0] ||
    insights.value?.topDownloads?.[0] ||
    insights.value?.latest?.[0] ||
    null
  );
});

const marketplaceSignals = computed<MarketplaceSignal[]>(() => [
  {
    title: label('审核后公开', 'Reviewed publishing'),
    description: label(
      '插件包、脚本和封面图进入审核，通过后上架。',
      'Software packages, scripts, and covers go live after review.',
    ),
    Icon: ShieldCheck,
  },
  {
    title: label('兼容版本清楚', 'Clear compatibility'),
    description: label(
      '卡片优先展示宿主软件、版本号和适配范围。',
      'Cards emphasize host app, version, and compatibility.',
    ),
    Icon: CheckCircle2,
  },
  {
    title: label('安装说明沉淀', 'Install guides included'),
    description: label(
      '详情里保留依赖、安装步骤和注意事项。',
      'Details keep dependencies, install steps, and notes.',
    ),
    Icon: Wrench,
  },
]);

const normalizeSoftware = (software: Partial<SoftwareItem> & Record<string, unknown>): SoftwareItem => ({
  id: String(software.id || crypto.randomUUID()),
  title: String(software.title || label('未命名插件', 'Untitled Software')),
  description: String(software.description || ''),
  category: String(software.category || CATEGORY_OTHER),
  tags: String(software.tags || ''),
  version: String(software.version || '1.0.0').replace(/^v/i, ''),
  compatibility: String(software.compatibility || label('未填写', 'Not specified')),
  downloads: Number(software.downloads || 0),
  fileUrl: typeof software.fileUrl === 'string' ? software.fileUrl : null,
  fileSize: typeof software.fileSize === 'number' ? software.fileSize : null,
  previewUrl: typeof software.previewUrl === 'string' ? software.previewUrl : null,
  installGuide: String(
    software.installGuide || label('作者暂未填写安装说明。', 'No installation guide yet.'),
  ),
  status: (software.status as SoftwareStatus) || 'APPROVED',
  rejectReason: typeof software.rejectReason === 'string' ? software.rejectReason : null,
  createdAt: String(software.createdAt || new Date().toISOString()),
  user: (software.user as SoftwareUser | null | undefined) || null,
  bilibiliUrl: typeof software.bilibiliUrl === 'string' ? software.bilibiliUrl : null,
});

watch([activeTab, myStatusFilter, selectedFavoriteCategory], () => {
  if (activeTab.value === 'requests') {
    fetchHelpRequests();
  } else {
    fetchSoftwares();
  }
});

const fetchSoftwares = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/softwares', {
      params: {
        page: 1,
        pageSize: 80,
        search: searchQuery.value.trim() || undefined,
        category: activeCategory.value === CATEGORY_ALL ? undefined : activeCategory.value,
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
    const source = Array.isArray(data) ? data : data.softwares || [];
    softwaresList.value = source.map(normalizeSoftware);
    await applyRouteSoftware();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('插件列表加载失败', 'Failed to load softwares')));
  } finally {
    isLoading.value = false;
  }
};

const fetchInsights = async () => {
  try {
    const { data } = await api.get('/api/softwares/insights');
    insights.value = data;
    favoritedIds.value = data.favoriteIds || [];
  } catch (error) {
    logError(error, { operation: 'fetchSoftwareInsights', view: 'SoftwaresView' });
  }
};

const fetchFavorites = async () => {
  try {
    const { data } = await api.get('/api/softwares/favorites');
    favoritedIds.value = data.ids || [];
    favoriteCategoriesList.value = data.categories || [];
  } catch (error) {
    logError(error, { operation: 'fetchSoftwareFavorites', view: 'SoftwaresView' });
  }
};

const fetchHelpRequests = async () => {
  try {
    isHelpRequestsLoading.value = true;
    const { data } = await api.get('/api/softwares/requests');
    helpRequests.value = data.requests || [];
    helpRequestsCount.value = data.pagination?.total || helpRequests.value.length;
  } catch (err) {
    logError(err, { operation: 'fetch help requests' });
  } finally {
    isHelpRequestsLoading.value = false;
  }
};

const fetchApprovedSoftwaresForLinking = async () => {
  try {
    const { data } = await api.get('/api/softwares', { params: { pageSize: 100 } });
    const list = data.softwares || [];
    approvedSoftwaresForLinking.value = list.map((p: any) => ({ id: p.id, title: p.title }));
  } catch (err) {
    logError(err, { operation: 'fetch softwares for linking' });
  }
};

const openHelpRequestDetail = async (req: HelpRequest) => {
  selectedHelpRequest.value = req;
  showHelpRequestDetailModal.value = true;
  newHelpReplyContent.value = '';
  linkedSoftwareIdForReply.value = '';

  isHelpRepliesLoading.value = true;
  try {
    const { data } = await api.get(`/api/softwares/requests/${req.id}`);
    helpRequestReplies.value = data.replies || [];
  } catch (err) {
    logError(err, { operation: 'load replies' });
  } finally {
    isHelpRepliesLoading.value = false;
  }

  fetchApprovedSoftwaresForLinking();
};

const handlePostHelpRequest = async () => {
  if (!newHelpRequestForm.value.title.trim() || !newHelpRequestForm.value.description.trim())
    return;
  isSubmittingHelpRequest.value = true;
  try {
    await api.post('/api/softwares/requests', {
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
      `/api/softwares/requests/${selectedHelpRequest.value.id}/replies`,
      {
        content: newHelpReplyContent.value.trim(),
        linkedSoftwareId: linkedSoftwareIdForReply.value || undefined,
      },
    );
    helpRequestReplies.value.push(data);
    newHelpReplyContent.value = '';
    linkedSoftwareIdForReply.value = '';
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
    await api.post(`/api/softwares/requests/${requestId}/resolve`);
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

const openLinkedSoftware = (pluginId: string) => {
  showHelpRequestDetailModal.value = false;
  const software = softwaresList.value.find((item) => item.id === pluginId);
  if (software) {
    openDetail(software);
  } else {
    window.location.hash = `#/softwares?software=${pluginId}`;
    window.location.reload();
  }
};

const activeFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string }> = [];

  if (activeCategory.value !== CATEGORY_ALL) {
    chips.push({
      key: 'category',
      label: label(`分类: ${activeCategory.value}`, `Category: ${activeCategory.value}`),
    });
  }
  if (selectedTag.value !== 'all') {
    chips.push({
      key: 'tag',
      label: label(`标签: ${selectedTag.value}`, `Tag: ${selectedTag.value}`),
    });
  }
  if (showFavoritesOnly.value) {
    chips.push({
      key: 'favorites',
      label: label('只看收藏', 'Favorites Only'),
    });
  }
  if (searchQuery.value.trim()) {
    chips.push({
      key: 'search',
      label: label(`搜索: "${searchQuery.value.trim()}"`, `Search: "${searchQuery.value.trim()}"`),
    });
  }

  return chips;
});

const clearFilter = (key: string) => {
  if (key === 'category') activeCategory.value = CATEGORY_ALL;
  if (key === 'tag') selectedTag.value = 'all';
  if (key === 'favorites') showFavoritesOnly.value = false;
  if (key === 'search') searchQuery.value = '';
  fetchSoftwares();
};

const resetFilters = () => {
  searchQuery.value = '';
  activeCategory.value = CATEGORY_ALL;
  selectedTag.value = 'all';
  showFavoritesOnly.value = false;
  fetchSoftwares();
};

const handleContainerClick = (e: MouseEvent) => {
  if (!isBatchMode.value) return;
  const target = e.target as HTMLElement;
  if (!target) return;
  if (target.closest('article, .unified-card, button, input, .el-select, .el-popper, a, select')) {
    return;
  }
  isBatchMode.value = false;
  selectedSoftwareIds.value = new Set();
};

const openDetail = (software: SoftwareItem) => {
  if (isBatchMode.value) {
    toggleSoftwareSelect(software.id);
    return;
  }
  selectedSoftware.value = software;
  isDetailDialogOpen.value = true;
};

const handleDetailEdit = (software: any) => {
  isDetailDialogOpen.value = false;
  const work = normalizeSoftwareWork(software);
  selectedWork.value = work;
  const rawSoftware = work.raw as any;

  const fileUrl = rawSoftware.fileUrl || '';
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
    categoryId: '',
    materialCategory: '',
    resolution: '4K',
    isProcedural: false,
    pluginCategory: rawSoftware.category || '',
    pluginVersion: rawSoftware.version || '1.0.0',
    pluginCompatibility: rawSoftware.compatibility || '',
    showcaseType: 'IMAGE',
    videoUrl: '',
    originality: rawSoftware.originality || 'ORIGINAL',
    originalAuthor: rawSoftware.originalAuthor || '',
    originalLink: rawSoftware.originalLink || '',
    license: rawSoftware.license || 'CC_BY',
    isFree: rawSoftware.isFree !== false,
    meshType: 'LOW_POLY',
    uvUnwrapped: true,
    uvOverlapping: false,
    pbrChannels: [],
    rigged: false,
    gameReady: false,
    linkedCourseId: rawSoftware.linkedCourseId || '',
    linkedLessonId: rawSoftware.linkedLessonId || '',
    installGuide: rawSoftware.installGuide || '',
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
    formData.append('category', editForm.value.pluginCategory);
    formData.append('version', editForm.value.pluginVersion);
    formData.append('compatibility', editForm.value.pluginCompatibility);
    formData.append('tags', editForm.value.tags);
    formData.append('installGuide', editForm.value.installGuide || '');
    formData.append('originality', editForm.value.originality || 'ORIGINAL');
    formData.append('originalAuthor', editForm.value.originalAuthor || '');
    formData.append('originalLink', editForm.value.originalLink || '');
    formData.append('license', editForm.value.license || 'CC_BY');
    formData.append('isFree', String(editForm.value.isFree !== false));
    formData.append('linkedCourseId', editForm.value.linkedCourseId || '');
    formData.append('linkedLessonId', editForm.value.linkedLessonId || '');

    if (editForm.value.downloadType === 'local') {
      if (editForm.value.tempSoftwarePath) {
        formData.append('tempSoftwarePath', editForm.value.tempSoftwarePath);
      } else if (editForm.value.file) {
        formData.append('plugin_file', editForm.value.file);
      }
    } else {
      let finalUrl = editForm.value.externalUrl.trim();
      if (editForm.value.extractionCode?.trim()) {
        finalUrl += ` 提取码: ${editForm.value.extractionCode.trim()}`;
      }
      formData.append('externalUrl', finalUrl);
    }
    if (editForm.value.tempPreviewPath) {
      formData.append('tempPreviewPath', editForm.value.tempPreviewPath);
    } else if (editForm.value.thumbnail) {
      formData.append('plugin_preview', editForm.value.thumbnail);
    }
    if (editForm.value.fileSize !== undefined) {
      formData.append('fileSize', String(editForm.value.fileSize));
    }
    if (editForm.value.packageFilesList) {
      formData.append('packageFilesList', editForm.value.packageFilesList);
    }

    await api.put(`/api/softwares/${work.id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    ElMessage.success(label('保存成功', 'Saved successfully'));
    isEditDialogOpen.value = false;
    handleSoftwareUpdate();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('保存失败', 'Save failed')));
  } finally {
    isSaving.value = false;
  }
};

const getRouteSoftwareId = () => {
  const software = route.query.software;
  return typeof software === 'string' ? software : '';
};

async function applyRouteSoftware() {
  const pluginId = getRouteSoftwareId();
  if (!pluginId || selectedSoftware.value?.id === pluginId) return;

  let software = softwaresList.value.find((item) => item.id === pluginId);
  if (!software) {
    try {
      const { data } = await api.get(`/api/softwares/${pluginId}`);
      const normalized = normalizeSoftware(data);
      software = normalized;
      softwaresList.value = [
        normalized,
        ...softwaresList.value.filter((item) => item.id !== normalized.id),
      ];
    } catch (error) {
      logError(error, { operation: 'fetchSoftwareDetail', view: 'SoftwaresView' });
      return;
    }
  }
  if (!software) return;
  openDetail(software);
}

const isFavorited = (pluginId: string) => favoritedIds.value.includes(pluginId);

const toggleFavorite = async (pluginId: string, event?: Event) => {
  event?.stopPropagation();
  try {
    const { data } = await api.post(`/api/softwares/${pluginId}/favorite`);
    favoritedIds.value = data.favoriteIds || [];
    ElMessage.success(
      data.isFavorited
        ? label('已收藏插件', 'Software saved')
        : label('已取消收藏', 'Favorite removed'),
    );
    fetchInsights();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('收藏失败', 'Favorite failed')));
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
      await api.post('/api/softwares/favorites/categories', {
        category: val,
      });
      ElMessage.success(label('分类创建成功', 'Category created successfully'));
      selectedFavoriteCategory.value = val;
      showCategoryModal.value = false;
      fetchFavorites();
      fetchSoftwares();
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
      await api.put('/api/softwares/favorites/categories', {
        oldCategory: categoryModalOldValue.value,
        newCategory: val,
      });
      ElMessage.success(label('分类重命名成功', 'Category renamed successfully'));
      if (selectedFavoriteCategory.value === categoryModalOldValue.value) {
        selectedFavoriteCategory.value = val;
      }
      showCategoryModal.value = false;
      fetchFavorites();
      fetchSoftwares();
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, label('重命名失败', 'Rename failed')));
    }
  }
};

const handleDeleteFavoriteCategory = async (cat: string) => {
  try {
    await ElMessageBox.confirm(
      label(
        `确认删除收藏夹分类「${cat}」？此操作将取消该分类下所有插件的收藏。`,
        `Delete favorite folder "${cat}"? This will remove all favorites inside this folder.`,
      ),
      label('删除分类', 'Delete Category'),
      {
        confirmButtonText: label('删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    await api.delete(`/api/softwares/favorites/categories/${encodeURIComponent(cat)}`);

    ElMessage.success(label('分类删除成功', 'Category deleted successfully'));
    if (selectedFavoriteCategory.value === cat) {
      selectedFavoriteCategory.value = 'all';
    }
    fetchFavorites();
    fetchSoftwares();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
    }
  }
};

const handleDownload = async (software: SoftwareItem, event?: Event) => {
  event?.stopPropagation();
  if (downloadingIds.value[software.id]) return;

  try {
    downloadingIds.value[software.id] = true;
    const { data } = await api.post(`/api/softwares/${software.id}/download`);
    const fileUrl = data.fileUrl || software.fileUrl;
    if (!fileUrl) {
      ElMessage.warning(label('该插件暂未提供下载文件', 'This software has no download file yet'));
      return;
    }
    software.downloads += 1;
    window.open(getAssetUrl(fileUrl), '_blank', 'noopener,noreferrer');
    fetchInsights();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('下载失败', 'Download failed')));
  } finally {
    delete downloadingIds.value[software.id];
  }
};

const getCategoryIcon = (category: string): Component => {
  if (category.includes('建模')) return Box;
  if (category.includes('材质')) return Layers;
  if (category.includes('渲染')) return Sun;
  if (category.includes('骨骼')) return Bone;
  if (category.includes('导入')) return Import;
  return Package;
};

const getCategoryTone = (category: string) => {
  if (category === '建模') return 'tone-orange';
  if (category === '材质与纹理') return 'tone-rose';
  if (category === '渲染与灯光') return 'tone-blue';
  if (category === '动画与骨骼') return 'tone-cyan';
  if (category === '导入与导出') return 'tone-emerald';
  if (category === '物理与特效') return 'tone-violet';
  return 'tone-slate';
};

const starterTemplates = computed<StarterSoftwareTemplate[]>(() => [
  {
    title: label('Blender 快速建模工具集', 'Blender Quick Modeling Kit'),
    description: label(
      '快捷添加基础几何、镜像对称及边缘导角工具。',
      'Quick tools for base geometry, mirror symmetry, and beveling.',
    ),
    category: '建模',
    compatibility: 'Blender 4.x',
    tags: ['Python', label('建模辅助', 'Modeling Utility'), 'Utility'],
    packageType: 'ZIP / PY',
    Icon: Box,
    tone: 'tone-orange',
  },
  {
    title: label('PBR 材质一键贴图', 'PBR Material Texture Mapper'),
    description: label(
      '为选中的模型一键导入和关联 Diffuse、Normal、Roughness 等贴图通道。',
      'Map Diffuse, Normal, Roughness channels for selected meshes in one click.',
    ),
    category: '材质与纹理',
    compatibility: 'Blender 3.x / 4.x',
    tags: ['PBR', label('材质', 'Material'), label('纹理', 'Texture')],
    packageType: 'ZIP / PY',
    Icon: Layers,
    tone: 'tone-rose',
  },
  {
    title: label('Blender 快速灯光预设', 'Blender Fast Light Studio'),
    description: label(
      '一键创建三点光源、HDRI 天空盒 and 渲染环境设置。',
      'One-click creation of three-point lighting, HDRI skybox, and rendering environment.',
    ),
    category: '渲染与灯光',
    compatibility: 'Blender 4.x',
    tags: ['Cycles', label('渲染', 'Rendering'), label('灯光', 'Lighting')],
    packageType: 'ZIP / PY',
    Icon: Sun,
    tone: 'tone-blue',
  },
  {
    title: label('FBX/GLTF 自动优化导出', 'FBX/GLTF Auto-Optimized Exporter'),
    description: label(
      '自动清理材质槽，重置比例与旋转，打包贴图并导出为最简 GLTF/FBX 文件。',
      'Clean material slots, reset transforms, pack textures, and export minimized GLTF/FBX.',
    ),
    category: '导入与导出',
    compatibility: 'Blender 3.6+',
    tags: ['gltf', label('导出', 'Export'), label('优化', 'Optimization')],
    packageType: 'ZIP / PY',
    Icon: Import,
    tone: 'tone-emerald',
  },
]);

const categoryTiles = computed(() => {
  const insightMap = new Map(
    (insights.value?.categories || []).map((category) => [category.name, category]),
  );

  return availableCategories.value.map((category) => {
    const isAll = category === CATEGORY_ALL;
    const fromInsights = insightMap.get(category);
    const pluginsInCategory = softwaresList.value.filter((software) => software.category === category);
    const count = isAll ? stats.value.total : (fromInsights?.count ?? pluginsInCategory.length);
    const downloads = isAll
      ? stats.value.downloads
      : (fromInsights?.downloads ??
        pluginsInCategory.reduce((sum, software) => sum + software.downloads, 0));

    return {
      name: category,
      count,
      downloads,
      Icon: isAll ? Puzzle : getCategoryIcon(category),
      tone: isAll ? 'tone-slate' : getCategoryTone(category),
    };
  });
});

const categoryTabOptions = computed(() => {
  return categoryTiles.value.map((category) => ({
    label: categoryLabel(category.name),
    badge: category.count,
    value: category.name,
  }));
});

const startFromTemplate = (template: StarterSoftwareTemplate) => {
  initialPublishData.value = {
    title: template.title,
    pluginCategory: template.category,
    description: template.description,
    pluginCompatibility: template.compatibility,
    tags: template.tags.join(', '),
    pluginInstallGuide: label(
      '1. 将插件包解压到 Blender 插件目录。\n2. 在软件偏好设置中启用插件。\n3. 按项目规范填写依赖版本和使用注意事项。',
      '1. Extract the package into the Blender software directory.\n2. Enable it from the Blender preferences.\n3. Document dependencies, versions, and usage notes.',
    ),
  };
  isUploadDialogOpen.value = true;
};

const isFilterOpen = ref(false);
const isFilterCollapsed = ref(false);

const downloadSelectedSoftware = () => {
  if (selectedSoftware.value) handleDownload(selectedSoftware.value);
};

const deleteSoftware = async (software: SoftwareItem) => {
  try {
    await ElMessageBox.confirm(
      label(
        `确认删除插件「${software.title}」？此操作不可恢复。`,
        `Are you sure you want to delete software "${software.title}"? This action cannot be undone.`,
      ),
      label('删除插件', 'Delete Software'),
      {
        confirmButtonText: label('删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    const oldSoftwares = [...softwaresList.value];
    softwaresList.value = softwaresList.value.filter((x) => x.id !== software.id);

    ElMessage.success(label('插件已删除', 'Software deleted'));
    isDetailDialogOpen.value = false;

    api
      .delete(`/api/softwares/${software.id}`)
      .then(() => {
        fetchInsights();
      })
      .catch((error) => {
        softwaresList.value = oldSoftwares;
        ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
      });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
    }
  }
};

const isSavingReview = ref(false);

const handleReviewApproved = async (software: SoftwareItem) => {
  try {
    await ElMessageBox.confirm(
      label(`确认通过插件「${software.title}」的发布申请？`, `Approve software "${software.title}"?`),
      label('审核插件', 'Review Software'),
      {
        confirmButtonText: label('通过', 'Approve'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'success',
      },
    );

    isSavingReview.value = true;
    const { data } = await api.put(`/api/admin/softwares/${software.id}/status`, {
      status: 'APPROVED',
    });

    ElMessage.success(label('插件已通过审核并发布', 'Software approved and published'));
    if (selectedSoftware.value && selectedSoftware.value.id === software.id) {
      selectedSoftware.value = normalizeSoftware(data);
    }
    fetchSoftwares();
    fetchInsights();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('审核失败', 'Review failed')));
    }
  } finally {
    isSavingReview.value = false;
  }
};

const handleReviewRejected = async (software: SoftwareItem) => {
  try {
    const { value } = await ElMessageBox.prompt(
      label('驳回原因', 'Rejection Reason'),
      label(`驳回「${software.title}」`, `Reject "${software.title}"`),
      {
        inputValue:
          software.rejectReason ||
          label(
            '安装指南、描述信息需要补充或测试不通过。',
            'Installation guide or description needs more information, or validation failed.',
          ),
        confirmButtonText: label('驳回', 'Reject'),
        cancelButtonText: label('取消', 'Cancel'),
        inputValidator: (val) => {
          if (!val?.trim()) return label('请输入驳回原因', 'Please enter rejection reason');
          return true;
        },
      },
    );

    isSavingReview.value = true;
    const { data } = await api.put(`/api/admin/softwares/${software.id}/status`, {
      status: 'REJECTED',
      rejectReason: value,
    });

    ElMessage.warning(label('已驳回该插件的发布申请', 'Software request rejected'));
    if (selectedSoftware.value && selectedSoftware.value.id === software.id) {
      selectedSoftware.value = normalizeSoftware(data);
    }
    fetchSoftwares();
    fetchInsights();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('操作失败', 'Action failed')));
    }
  } finally {
    isSavingReview.value = false;
  }
};

const handleSoftwareUpdate = async () => {
  fetchSoftwares();
  fetchInsights();
  if (selectedSoftware.value) {
    try {
      const { data } = await api.get(`/api/softwares/${selectedSoftware.value.id}`);
      selectedSoftware.value = normalizeSoftware(data);
    } catch (err) {
      logError(err, { operation: 'refresh software detail' });
    }
  }
};

onMounted(() => {
  systemStore.fetchSettings();
  fetchSoftwares();
  fetchInsights();
  fetchFavorites();
  fetchHelpRequests();
});

watch(
  () => route.query.software,
  () => {
    applyRouteSoftware();
  },
);
</script>

<template>
  <div class="softwares-page mobile-adaptive flex flex-col h-full overflow-hidden" @click="handleContainerClick">
    <SoftwarePageHeader
      v-model:search-query="searchQuery"
      :is-loading="isLoading"
      @refresh="
        fetchSoftwares();
        fetchInsights();
      "
      @upload="isUploadDialogOpen = true"
      @success="
        fetchSoftwares();
        fetchInsights();
      "
    />

    <div class="flex-1 overflow-y-auto p-4 pt-2.5 flex flex-col gap-3">

      <div class="workspace-shell" :class="{ 'single-col': activeTab === 'requests', 'collapsed-shell': isFilterCollapsed }">
        <SoftwareFiltersPanel
          v-if="activeTab !== 'requests'"
          :is-open="isFilterOpen"
          v-model:collapsed="isFilterCollapsed"
          :active-category="activeCategory"
          :active-tab="activeTab"
          :my-status-filter="myStatusFilter"
          :selected-tag="selectedTag"
          :category-tab-options="categoryTabOptions"
          :status-tab-options="statusTabOptions"
          :hot-tags="insights?.hotTags || []"
          :favorite-categories="favoriteCategoriesList"
          :selected-favorite-category="selectedFavoriteCategory"
          @update:active-category="activeCategory = $event"
          @update:my-status-filter="myStatusFilter = $event"
          @update:selected-tag="selectedTag = $event"
          @update:selected-favorite-category="selectedFavoriteCategory = $event"
          @fetch-softwares="fetchSoftwares"
          @rename-category="handleRenameFavoriteCategory"
          @delete-category="handleDeleteFavoriteCategory"
          @create-category="handleCreateFavoriteCategory"
        />

        <main class="content-panel">
          <SoftwareToolbar
            :active-tab="activeTab"
            :library-tab-options="libraryTabOptions"
            :sort-by="sortBy"
            :view-mode="viewMode"
            :view-mode-options="viewModeOptions"
            :show-favorites-only="showFavoritesOnly"
            :is-filter-open="isFilterOpen"
            :is-filter-collapsed="isFilterCollapsed"
            @toggle-filter-collapse="isFilterCollapsed = false"
            :is-batch-mode="isBatchMode"
            :selected-ids="Array.from(selectedSoftwareIds)"
            :visible-softwares-count="visibleSoftwares.length"
            @update:active-tab="activeTab = $event"
            @update:sort-by="sortBy = $event"
            @update:view-mode="viewMode = $event"
            @update:is-batch-mode="isBatchMode = $event; if (!$event) selectedSoftwareIds = new Set();"
            @select-all="selectAllSoftwares"
            @bulk-delete="handleBulkDeleteSoftwares"
            @bulk-unfavorite="handleBulkUnfavoriteSoftwares"
            @toggle-favorites="showFavoritesOnly = !showFavoritesOnly"
            @toggle-filter="isFilterOpen = !isFilterOpen"
          />

          <!-- Request Help forum list -->
          <HelpRequestsForum
            v-if="activeTab === 'requests'"
            :forum-title="label('插件求助论坛', 'Software Help Requests Forum')"
            :forum-desc="label('找不到需要的插件？发布求助帖，让社区开发者和爱好者来帮助您！', 'Can\'t find a software? Ask the community for help.')"
            :requests="helpRequests"
            :is-loading="isHelpRequestsLoading"
            @open-detail="openHelpRequestDetail"
            @create-request="showHelpRequestPostDialog = true"
          />

          <SoftwareCatalog
            v-else
            :softwares="visibleSoftwares"
            :is-loading="isLoading"
            :view-mode="viewMode"
            :active-tab="activeTab"
            :favorited-ids="favoritedIds"
            :downloading-ids="downloadingIds"
            :active-filter-chips="activeFilterChips"
            :total-count="stats.total || visibleSoftwares.length"
            :selected-ids="Array.from(selectedSoftwareIds)"
            @open-detail="openDetail"
            @select="toggleSoftwareSelect"
            @toggle-favorite="toggleFavorite"
            @download="handleDownload"
            @reset-filters="resetFilters"
            @clear-filter="clearFilter"
            @upload="isUploadDialogOpen = true"
          />
        </main>
      </div>
    </div>

    <UnifiedDetailModal
      v-if="isDetailDialogOpen"
      :show="isDetailDialogOpen"
      :item="selectedSoftware"
      kind="software"
      :is-favorited="selectedSoftware ? isFavorited(selectedSoftware.id) : false"
      :is-downloading="selectedSoftware ? !!downloadingIds[selectedSoftware.id] : false"
      :is-admin="isAdmin"
      :can-edit="selectedSoftware ? canEditSoftware(selectedSoftware) : false"
      :is-saving-review="isSavingReview"
      @close="isDetailDialogOpen = false"
      @favorite="
        fetchFavorites();
        fetchInsights();
      "
      @download="downloadSelectedSoftware"
      @edit="handleDetailEdit"
      @delete="deleteSoftware"
      @review-approved="handleReviewApproved"
      @review-rejected="handleReviewRejected"
      @update="handleSoftwareUpdate"
    />

    <PublishWorkDialog
      v-if="isUploadDialogOpen"
      v-model="isUploadDialogOpen"
      default-category="software"
      :initial-data="initialPublishData"
      @published="
        fetchSoftwares();
        fetchInsights();
      "
    />

    <EditWorkDialog
      v-if="isEditDialogOpen"
      v-model:show="isEditDialogOpen"
      v-model:form="editForm"
      :work="selectedWork"
      :is-saving="isSaving"
      :asset-categories="[]"
      :material-categories="[]"
      :plugin-categories="pluginCategories"
      @save="handleSaveEdit"
    />

    <!-- Help Request Detail Modal -->
    <Modal
      :show="showHelpRequestDetailModal"
      size="xl"
      @close="
        showHelpRequestDetailModal = false;
        selectedHelpRequest = null;
      "
    >
      <template v-if="selectedHelpRequest" #header>
        <div class="flex items-center gap-2">
          <span
            class="px-2 py-0.5 rounded text-[10px] font-bold"
            :class="
              selectedHelpRequest.status === 'RESOLVED'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            "
          >
            {{
              selectedHelpRequest.status === 'RESOLVED'
                ? label('已解决', 'Resolved')
                : label('求助中', 'Open')
            }}
          </span>
          <h3 class="text-sm sm:text-base font-bold text-[var(--text-primary)]">
            {{ selectedHelpRequest.title }}
          </h3>
        </div>
      </template>

      <div
        v-if="selectedHelpRequest"
        class="flex flex-col gap-5 text-left max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar"
      >
        <!-- Main Post -->
        <div class="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col gap-3">
          <div class="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <div
              class="w-5 h-5 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center shrink-0"
            >
              <img
                v-if="selectedHelpRequest.user?.avatarUrl"
                :src="getAssetUrl(selectedHelpRequest.user.avatarUrl)"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-[9px] font-bold text-slate-400">{{
                selectedHelpRequest.user?.name?.slice(0, 1) || 'U'
              }}</span>
            </div>
            <span class="font-bold text-[var(--text-primary)]">{{
              selectedHelpRequest.user?.name
            }}</span>
            <span>•</span>
            <span class="font-mono">{{
              new Date(selectedHelpRequest.createdAt).toLocaleString()
            }}</span>

            <!-- Resolve button for requester -->
            <button
              v-if="
                selectedHelpRequest.status === 'OPEN' &&
                (currentUserId === selectedHelpRequest.userId || isAdmin)
              "
              class="ml-auto px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] border-0 transition-colors cursor-pointer"
              @click="handleResolveRequest(selectedHelpRequest.id)"
            >
              {{ label('标为已解决', 'Mark Resolved') }}
            </button>
          </div>

          <p
            class="text-xs sm:text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed border-t border-white/5 pt-3"
          >
            {{ selectedHelpRequest.description }}
          </p>
        </div>

        <!-- Replies list -->
        <div class="flex flex-col gap-3">
          <h4
            class="text-xs font-bold text-[var(--text-primary)] border-l-2 border-indigo-500 pl-2"
          >
            {{ label('回复与讨论', 'Replies') }} ({{ helpRequestReplies.length }})
          </h4>

          <div v-if="isHelpRepliesLoading" class="flex justify-center py-6">
            <RefreshCw class="w-6 h-6 animate-spin text-indigo-400" />
          </div>
          <div
            v-else-if="helpRequestReplies.length === 0"
            class="text-center py-6 text-xs text-[var(--text-muted)]"
          >
            {{
              label(
                '暂无回复，发表第一条回复来提供帮助吧！',
                'No replies yet. Help out by replying!',
              )
            }}
          </div>
          <div v-else class="flex flex-col gap-3">
            <div
              v-for="rep in helpRequestReplies"
              :key="rep.id"
              class="p-4 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col gap-3"
            >
              <div class="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                <div
                  class="w-4 h-4 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center shrink-0"
                >
                  <img
                    v-if="rep.user?.avatarUrl"
                    :src="getAssetUrl(rep.user.avatarUrl)"
                    class="w-full h-full object-cover"
                  />
                  <span v-else class="text-[8px] font-bold text-slate-400">{{
                    rep.user?.name?.slice(0, 1) || 'U'
                  }}</span>
                </div>
                <span class="font-bold text-[var(--text-primary)]">{{ rep.user?.name }}</span>
                <span>•</span>
                <span class="font-mono">{{ new Date(rep.createdAt).toLocaleString() }}</span>
              </div>

              <p class="text-xs text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                {{ rep.content }}
              </p>

              <!-- Linked approved software showcase -->
              <div
                v-if="rep.linkedSoftware"
                class="flex items-center justify-between p-3 rounded-xl bg-indigo-600/5 border border-indigo-500/10 cursor-pointer hover:bg-indigo-600/10 transition-colors"
                @click="openLinkedSoftware(rep.linkedSoftware.id)"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div
                    class="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center shrink-0"
                  >
                    <img
                      v-if="rep.linkedSoftware.previewUrl"
                      :src="getAssetUrl(rep.linkedSoftware.previewUrl)"
                      class="w-full h-full object-cover"
                    />
                    <Puzzle v-else class="w-4 h-4 text-indigo-400" />
                  </div>
                  <div class="text-left min-w-0">
                    <div class="text-xs font-bold text-[var(--text-primary)] truncate">
                      {{ rep.linkedSoftware.title }}
                    </div>
                    <div class="text-[9px] text-[var(--text-muted)] mt-0.5">
                      v{{ rep.linkedSoftware.version }}
                    </div>
                  </div>
                </div>

                <div
                  class="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:underline"
                >
                  <span>{{ label('查看插件', 'View Software') }}</span>
                  <ExternalLink class="w-3 h-3" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Post Reply Box -->
        <div v-if="authStore.user" class="border-t border-white/10 pt-4 flex flex-col gap-3">
          <h4 class="text-xs font-bold text-[var(--text-primary)]">
            {{ label('发表回复', 'Post Reply') }}
          </h4>

          <textarea
            v-model="newHelpReplyContent"
            :placeholder="
              label('在此输入回复内容，提供解决方案或线索...', 'Type your reply here...')
            "
            class="w-full min-h-[70px] bg-white/[0.03] border border-[var(--border-base)] rounded-xl p-3 text-xs text-[var(--text-primary)] focus:border-indigo-500 outline-none resize-none placeholder-slate-500"
          ></textarea>

          <div class="flex flex-col md:flex-row md:items-center gap-3">
            <!-- Linked software dropdown -->
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span
                class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0"
                >{{ label('关联插件(可选)', 'Link Software') }}</span
              >
              <el-select
                v-model="linkedSoftwareIdForReply"
                placeholder="选择推荐的已上架插件"
                clearable
                filterable
                class="flex-1 custom-select-v2 text-xs"
              >
                <el-option
                  v-for="p in approvedSoftwaresForLinking"
                  :key="p.id"
                  :label="p.title"
                  :value="p.id"
                />
              </el-select>
            </div>

            <Button
              variant="primary"
              size="sm"
              :loading="isSubmittingReply"
              :disabled="!newHelpReplyContent.trim()"
              class="shrink-0 flex items-center justify-center cursor-pointer"
              @click="handlePostReply"
            >
              {{ label('提交回复', 'Post Reply') }}
            </Button>
          </div>
        </div>
      </div>
    </Modal>

    <!-- Help Request Post Modal -->
    <Modal :show="showHelpRequestPostDialog" size="md" @close="showHelpRequestPostDialog = false">
      <template #header>
        <h3 class="text-sm sm:text-base font-bold text-[var(--text-primary)]">
          {{ label('发布新插件求助贴', 'Create Help Request') }}
        </h3>
      </template>

      <div class="flex flex-col gap-4 text-left">
        <div>
          <Input
            v-model="newHelpRequestForm.title"
            type="text"
            label="求助标题"
            placeholder="简要描述您需要的插件或需求，如：求一个能批量烘焙动作的Blender插件"
            required
          />
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1"
            >详细描述</label
          >
          <textarea
            v-model="newHelpRequestForm.description"
            placeholder="详细描述您遇到的问题、期望插件具备的功能、或者提供参考的演示视频/图片链接..."
            class="w-full min-h-[120px] bg-white/[0.03] border border-[var(--border-base)] rounded-xl p-3 text-xs text-[var(--text-primary)] focus:border-indigo-500 outline-none resize-none placeholder-slate-500"
          ></textarea>
        </div>

        <div class="flex justify-end gap-2 mt-2">
          <Button variant="secondary" size="sm" @click="showHelpRequestPostDialog = false">{{
            label('取消', 'Cancel')
          }}</Button>
          <Button
            variant="primary"
            size="sm"
            :loading="isSubmittingHelpRequest"
            :disabled="!newHelpRequestForm.title.trim() || !newHelpRequestForm.description.trim()"
            @click="handlePostHelpRequest"
            >{{ label('发布', 'Post') }}</Button
          >
        </div>
      </div>
    </Modal>

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
            placeholder="例如：实用工具、烘焙辅助"
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
.softwares-page {
  height: 100%;
  background:
    linear-gradient(
      180deg,
      rgba(37, 99, 235, 0.05),
      rgba(20, 184, 166, 0.03) 200px,
      transparent 380px
    ),
    transparent !important;
  color: var(--text-primary);
}

.workspace-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 156px minmax(0, 1fr);
  gap: 12px;
  transition: grid-template-columns 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.workspace-shell.collapsed-shell {
  grid-template-columns: 1fr;
}

.workspace-shell.single-col {
  grid-template-columns: 1fr;
}

.content-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

@media (max-width: 980px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
}
</style>
