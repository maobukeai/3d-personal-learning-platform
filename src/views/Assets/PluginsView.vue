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
  Sparkles,
} from 'lucide-vue-next';
import 'md-editor-v3/lib/preview.css';

const MdPreview = defineAsyncComponent(() => import('md-editor-v3').then((m) => m.MdPreview));
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import { useI18n } from 'vue-i18n';
import { useSystemStore } from '@/stores/system';
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import { useAuthStore } from '@/stores/auth';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { parseTags } from './resourceUtils';
import { useLabel } from '@/utils/i18n';
import PluginPageHeader from './components/PluginPageHeader.vue';
import PluginFiltersPanel from './components/PluginFiltersPanel.vue';
import PluginToolbar from './components/PluginToolbar.vue';
import PluginCatalog from './components/PluginCatalog.vue';

const UnifiedDetailModal = defineAsyncComponent(
  () => import('./components/UnifiedDetailModal.vue'),
);
const PublishWorkDialog = defineAsyncComponent(() => import('@/components/PublishWorkDialog.vue'));
const EditWorkDialog = defineAsyncComponent(() => import('./components/EditWorkDialog.vue'));
import { normalizePluginWork } from './myWorksModel';
import type { UnifiedWork } from './myWorksModel';

type PluginStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type SortMode = 'latest' | 'popular' | 'name';

interface PluginUser {
  id?: string;
  name?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}

interface PluginItem {
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
  status: PluginStatus;
  rejectReason?: string | null;
  createdAt: string;
  user?: PluginUser | null;
  bilibiliUrl?: string | null;
}

interface PluginInsights {
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
  topDownloads: PluginItem[];
  latest: PluginItem[];
  favoriteIds: string[];
}

interface StarterPluginTemplate {
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

const CATEGORY_ALL = '全部插件';
const CATEGORY_OTHER = '其他工具';

const { locale } = useI18n();
const route = useRoute();

const label = useLabel();

const categoryLabel = (category?: string | null) => {
  const normalized = category || CATEGORY_OTHER;
  const englishLabels: Record<string, string> = {
    [CATEGORY_ALL]: 'All Add-ons',
    [CATEGORY_OTHER]: 'Other Utilities',
    建模: 'Modeling',
    材质与纹理: 'Materials & Texturing',
    渲染与灯光: 'Rendering & Lighting',
    动画与骨骼: 'Animation & Rigging',
    导入与导出: 'Import & Export',
    物理与特效: 'Physics & FX',
  };
  return locale.value === 'en-US' ? englishLabels[normalized] || normalized : normalized;
};

const systemStore = useSystemStore();
const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

function isPluginOwner(plugin: PluginItem) {
  return Boolean(
    currentUserId.value &&
    (plugin.user?.id === currentUserId.value || (plugin as any).userId === currentUserId.value),
  );
}

function canEditPlugin(plugin: PluginItem) {
  return isAdmin.value || isPluginOwner(plugin);
}
const pluginsList = ref<PluginItem[]>([]);
const searchQuery = ref('');
const aiSearchAnalysis = ref('');
const isDark = computed(() => document.documentElement.classList.contains('dark'));
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
const favoritedIds = ref<string[]>([]);
const insights = ref<PluginInsights | null>(null);

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
  linkedPlugin?: {
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
const linkedPluginIdForReply = ref('');
const isSubmittingReply = ref(false);
const approvedPluginsForLinking = ref<{ id: string; title: string }[]>([]);

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
const selectedPluginIds = ref<Set<string>>(new Set());

const togglePluginSelect = (id: string) => {
  const next = new Set(selectedPluginIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedPluginIds.value = next;
};

const selectAllPlugins = () => {
  if (
    selectedPluginIds.value.size === visiblePlugins.value.length &&
    visiblePlugins.value.length > 0
  ) {
    selectedPluginIds.value = new Set();
  } else {
    selectedPluginIds.value = new Set(visiblePlugins.value.map((p) => p.id));
  }
};

const handleBulkDeletePlugins = async () => {
  if (selectedPluginIds.value.size === 0) {
    ElMessage.warning(label('请选择要删除的插件', 'Please select plugins to delete'));
    return;
  }

  try {
    await ElMessageBox.confirm(
      label(
        `确定要物理删除选中的 ${selectedPluginIds.value.size} 个插件/草稿吗？关联文件也将被同步清除，此操作不可撤销！`,
        `Are you sure you want to delete ${selectedPluginIds.value.size} selected plugins? Associated files will also be deleted!`,
      ),
      label('批量删除确认', 'Confirm Bulk Delete'),
      {
        confirmButtonText: label('确定删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    const ids = Array.from(selectedPluginIds.value);
    await api.post('/api/plugins/bulk-delete', { ids });

    ElMessage.success(
      label(`成功删除 ${ids.length} 个插件`, `Successfully deleted ${ids.length} plugins`),
    );
    selectedPluginIds.value = new Set();
    fetchPlugins();
    fetchInsights();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(
        getApiErrorMessage(err, label('批量删除失败', 'Failed to bulk delete plugins')),
      );
    }
  }
};

const handleBulkUnfavoritePlugins = async () => {
  if (selectedPluginIds.value.size === 0) {
    ElMessage.warning(label('请选择要取消收藏的插件', 'Please select plugins to unfavorite'));
    return;
  }

  try {
    await ElMessageBox.confirm(
      label(
        `确定要批量取消收藏选中的 ${selectedPluginIds.value.size} 个插件吗？`,
        `Are you sure you want to unfavorite ${selectedPluginIds.value.size} selected plugins?`,
      ),
      label('批量取消收藏确认', 'Confirm Bulk Unfavorite'),
      {
        confirmButtonText: label('确定', 'Confirm'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    const ids = Array.from(selectedPluginIds.value);
    await api.post('/api/plugins/bulk/favorite', { ids, favorite: false });

    ElMessage.success(
      label(`成功取消收藏 ${ids.length} 个插件`, `Successfully unfavorited ${ids.length} plugins`),
    );
    selectedPluginIds.value = new Set();
    isBatchMode.value = false;
    fetchPlugins();
    fetchInsights();
    fetchFavorites();
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(
        getApiErrorMessage(err, label('批量取消收藏失败', 'Failed to bulk unfavorite plugins')),
      );
    }
  }
};

watch(activeTab, () => {
  isBatchMode.value = false;
  selectedPluginIds.value = new Set();
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

const pluginCategories = computed(() =>
  (systemStore.settings.PLUGIN_CATEGORIES || []).filter(
    (name: string) => name !== '全部插件' && name !== '全部',
  ),
);
const selectedPlugin = ref<PluginItem | null>(null);

const availableCategories = computed(() => {
  const configured = (systemStore.settings.PLUGIN_CATEGORIES || []).filter(
    (name) => name !== CATEGORY_ALL,
  );

  const fromData = [
    ...pluginsList.value.map((plugin) => plugin.category).filter(Boolean),
    ...(insights.value?.categories || []).map((category) => category.name),
  ].filter((name) => name !== CATEGORY_ALL);

  return [CATEGORY_ALL, ...Array.from(new Set([...configured, ...fromData]))];
});

const visiblePlugins = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let list = [...pluginsList.value];

  if (activeCategory.value !== CATEGORY_ALL) {
    list = list.filter((plugin) => plugin.category === activeCategory.value);
  }

  if (query) {
    list = list.filter((plugin) => {
      return [plugin.title, plugin.description, plugin.tags, plugin.compatibility, plugin.category]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }

  if (selectedTag.value !== 'all') {
    list = list.filter((plugin) => parseTags(plugin.tags).includes(selectedTag.value));
  }

  return list.sort((a, b) => {
    if (sortBy.value === 'popular') return b.downloads - a.downloads;
    if (sortBy.value === 'name')
      return a.title.localeCompare(b.title, locale.value === 'en-US' ? 'en-US' : 'zh-CN');
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

const stats = computed(() => ({
  total: insights.value?.summary.total || pluginsList.value.length,
  downloads:
    insights.value?.summary.downloads ||
    pluginsList.value.reduce((sum, plugin) => sum + plugin.downloads, 0),
  favorites: favoritedIds.value.length || insights.value?.summary.favoriteCount || 0,
  categories:
    insights.value?.summary.categories ||
    new Set(pluginsList.value.map((plugin) => plugin.category)).size,
}));

const spotlightPlugin = computed(() => {
  return (
    visiblePlugins.value[0] ||
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
      'Plugin packages, scripts, and covers go live after review.',
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

const normalizePlugin = (plugin: Partial<PluginItem> & Record<string, unknown>): PluginItem => ({
  id: String(plugin.id || crypto.randomUUID()),
  title: String(plugin.title || label('未命名插件', 'Untitled Plugin')),
  description: String(plugin.description || ''),
  category: String(plugin.category || CATEGORY_OTHER),
  tags: String(plugin.tags || ''),
  version: String(plugin.version || '1.0.0').replace(/^v/i, ''),
  compatibility: String(plugin.compatibility || label('未填写', 'Not specified')),
  downloads: Number(plugin.downloads || 0),
  fileUrl: typeof plugin.fileUrl === 'string' ? plugin.fileUrl : null,
  fileSize: typeof plugin.fileSize === 'number' ? plugin.fileSize : null,
  previewUrl: typeof plugin.previewUrl === 'string' ? plugin.previewUrl : null,
  installGuide: String(
    plugin.installGuide || label('作者暂未填写安装说明。', 'No installation guide yet.'),
  ),
  status: (plugin.status as PluginStatus) || 'APPROVED',
  rejectReason: typeof plugin.rejectReason === 'string' ? plugin.rejectReason : null,
  createdAt: String(plugin.createdAt || new Date().toISOString()),
  user: (plugin.user as PluginUser | null | undefined) || null,
  bilibiliUrl: typeof plugin.bilibiliUrl === 'string' ? plugin.bilibiliUrl : null,
});

watch([activeTab, myStatusFilter, selectedFavoriteCategory], () => {
  if (activeTab.value === 'requests') {
    fetchHelpRequests();
  } else {
    fetchPlugins();
  }
});

const fetchPlugins = async () => {
  try {
    isLoading.value = true;
    const query = searchQuery.value.trim();
    if (query && activeTab.value === 'explore') {
      const { data } = await api.get('/api/resources/search-external', {
        params: { q: query },
      });
      aiSearchAnalysis.value = data?.aiAnalysis || '';

      const flatResults: PluginItem[] = [];
      if (data && data.results) {
        Object.entries(data.results).forEach(([site, list]) => {
          (list as any[]).forEach((item) => {
            flatResults.push({
              id: `external-${item.link}`,
              title: item.title,
              description: item.snippet || `来自 ${site} 的全网搜资源。`,
              category: site,
              tags: JSON.stringify([site, '全网搜资源']),
              version: '1.0.0',
              compatibility: '全网搜资源',
              downloads: 0,
              fileUrl: item.link,
              fileSize: null,
              previewUrl: null,
              installGuide: `该资源来自全网资源搜索，您可以直接访问其源站页面下载或查看：\n\n[点击前往源站](${item.link})`,
              status: 'APPROVED',
              rejectReason: null,
              createdAt: new Date().toISOString(),
              user: { id: 'external', name: site, avatarUrl: null },
              bilibiliUrl: null,
            });
          });
        });
      }
      pluginsList.value = flatResults;
      return;
    }

    aiSearchAnalysis.value = '';
    const { data } = await api.get('/api/plugins', {
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
    const source = Array.isArray(data) ? data : data.plugins || [];
    pluginsList.value = source.map(normalizePlugin);
    await applyRoutePlugin();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('插件列表加载失败', 'Failed to load plugins')));
  } finally {
    isLoading.value = false;
  }
};

const fetchInsights = async () => {
  try {
    const { data } = await api.get('/api/plugins/insights');
    insights.value = data;
    favoritedIds.value = data.favoriteIds || [];
  } catch (error) {
    logError(error, { operation: 'fetchPluginInsights', view: 'PluginsView' });
  }
};

const fetchFavorites = async () => {
  try {
    const { data } = await api.get('/api/plugins/favorites');
    favoritedIds.value = data.ids || [];
    favoriteCategoriesList.value = data.categories || [];
  } catch (error) {
    logError(error, { operation: 'fetchPluginFavorites', view: 'PluginsView' });
  }
};

const fetchHelpRequests = async () => {
  try {
    isHelpRequestsLoading.value = true;
    const { data } = await api.get('/api/plugins/requests');
    helpRequests.value = data.requests || [];
    helpRequestsCount.value = data.pagination?.total || helpRequests.value.length;
  } catch (err) {
    logError(err, { operation: 'fetch help requests' });
  } finally {
    isHelpRequestsLoading.value = false;
  }
};

const fetchApprovedPluginsForLinking = async () => {
  try {
    const { data } = await api.get('/api/plugins', { params: { pageSize: 100 } });
    const list = data.plugins || [];
    approvedPluginsForLinking.value = list.map((p: any) => ({ id: p.id, title: p.title }));
  } catch (err) {
    logError(err, { operation: 'fetch plugins for linking' });
  }
};

const openHelpRequestDetail = async (req: HelpRequest) => {
  selectedHelpRequest.value = req;
  showHelpRequestDetailModal.value = true;
  newHelpReplyContent.value = '';
  linkedPluginIdForReply.value = '';

  isHelpRepliesLoading.value = true;
  try {
    const { data } = await api.get(`/api/plugins/requests/${req.id}`);
    helpRequestReplies.value = data.replies || [];
  } catch (err) {
    logError(err, { operation: 'load replies' });
  } finally {
    isHelpRepliesLoading.value = false;
  }

  fetchApprovedPluginsForLinking();
};

const handlePostHelpRequest = async () => {
  if (!newHelpRequestForm.value.title.trim() || !newHelpRequestForm.value.description.trim())
    return;
  isSubmittingHelpRequest.value = true;
  try {
    await api.post('/api/plugins/requests', {
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
      `/api/plugins/requests/${selectedHelpRequest.value.id}/replies`,
      {
        content: newHelpReplyContent.value.trim(),
        linkedPluginId: linkedPluginIdForReply.value || undefined,
      },
    );
    helpRequestReplies.value.push(data);
    newHelpReplyContent.value = '';
    linkedPluginIdForReply.value = '';
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
    await api.post(`/api/plugins/requests/${requestId}/resolve`);
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

const openLinkedPlugin = (pluginId: string) => {
  showHelpRequestDetailModal.value = false;
  const plugin = pluginsList.value.find((item) => item.id === pluginId);
  if (plugin) {
    openDetail(plugin);
  } else {
    window.location.hash = `#/plugins?plugin=${pluginId}`;
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
  if (key === 'search') searchQuery.value = '';
  fetchPlugins();
};

const resetFilters = () => {
  searchQuery.value = '';
  activeCategory.value = CATEGORY_ALL;
  selectedTag.value = 'all';
  fetchPlugins();
};

const handleContainerClick = (e: MouseEvent) => {
  if (!isBatchMode.value) return;
  const target = e.target as HTMLElement;
  if (!target) return;
  if (
    target.closest(
      'article, .unified-card, button, input, .select-trigger, .glass-popover, [data-radix-popper-content-wrapper], a, select',
    )
  ) {
    return;
  }
  isBatchMode.value = false;
  selectedPluginIds.value = new Set();
};

const openDetail = (plugin: PluginItem) => {
  if (isBatchMode.value) {
    togglePluginSelect(plugin.id);
    return;
  }
  selectedPlugin.value = plugin;
  isDetailDialogOpen.value = true;
};

const handleDetailEdit = (plugin: any) => {
  isDetailDialogOpen.value = false;
  const work = normalizePluginWork(plugin);
  selectedWork.value = work;
  const rawPlugin = work.raw as any;

  const fileUrl = rawPlugin.fileUrl || '';
  const isExternal =
    fileUrl.startsWith('http://') || fileUrl.startsWith('https://')
      ? !fileUrl.includes('/uploads/')
      : false;
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
    pluginCategory: rawPlugin.category || '',
    pluginVersion: rawPlugin.version || '1.0.0',
    pluginCompatibility: rawPlugin.compatibility || '',
    showcaseType: 'IMAGE',
    videoUrl: '',
    originality: rawPlugin.originality || 'ORIGINAL',
    originalAuthor: rawPlugin.originalAuthor || '',
    originalLink: rawPlugin.originalLink || '',
    license: rawPlugin.license || 'CC_BY',
    isFree: rawPlugin.isFree !== false,
    meshType: 'LOW_POLY',
    uvUnwrapped: true,
    uvOverlapping: false,
    pbrChannels: [],
    rigged: false,
    gameReady: false,
    linkedCourseId: rawPlugin.linkedCourseId || '',
    linkedLessonId: rawPlugin.linkedLessonId || '',
    installGuide: rawPlugin.installGuide || '',
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
      if (editForm.value.tempPluginPath) {
        formData.append('tempPluginPath', editForm.value.tempPluginPath);
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

    await api.put(`/api/plugins/${work.id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    ElMessage.success(label('保存成功', 'Saved successfully'));
    isEditDialogOpen.value = false;
    handlePluginUpdate();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('保存失败', 'Save failed')));
  } finally {
    isSaving.value = false;
  }
};

const getRoutePluginId = () => {
  const plugin = route.query.plugin;
  return typeof plugin === 'string' ? plugin : '';
};

async function applyRoutePlugin() {
  const pluginId = getRoutePluginId();
  if (!pluginId || selectedPlugin.value?.id === pluginId) return;

  let plugin = pluginsList.value.find((item) => item.id === pluginId);
  if (!plugin) {
    try {
      const { data } = await api.get(`/api/plugins/${pluginId}`);
      const normalized = normalizePlugin(data);
      plugin = normalized;
      pluginsList.value = [
        normalized,
        ...pluginsList.value.filter((item) => item.id !== normalized.id),
      ];
    } catch (error) {
      logError(error, { operation: 'fetchPluginDetail', view: 'PluginsView' });
      return;
    }
  }
  if (!plugin) return;
  openDetail(plugin);
}

const isFavorited = (pluginId: string) => favoritedIds.value.includes(pluginId);

const toggleFavorite = async (pluginId: string, event?: Event) => {
  event?.stopPropagation();
  try {
    const { data } = await api.post(`/api/plugins/${pluginId}/favorite`);
    favoritedIds.value = data.favoriteIds || [];
    ElMessage.success(
      data.isFavorited
        ? label('已收藏插件', 'Plugin saved')
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
      await api.post('/api/plugins/favorites/categories', {
        category: val,
      });
      ElMessage.success(label('分类创建成功', 'Category created successfully'));
      selectedFavoriteCategory.value = val;
      showCategoryModal.value = false;
      fetchFavorites();
      fetchPlugins();
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
      await api.put('/api/plugins/favorites/categories', {
        oldCategory: categoryModalOldValue.value,
        newCategory: val,
      });
      ElMessage.success(label('分类重命名成功', 'Category renamed successfully'));
      if (selectedFavoriteCategory.value === categoryModalOldValue.value) {
        selectedFavoriteCategory.value = val;
      }
      showCategoryModal.value = false;
      fetchFavorites();
      fetchPlugins();
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

    await api.delete(`/api/plugins/favorites/categories/${encodeURIComponent(cat)}`);

    ElMessage.success(label('分类删除成功', 'Category deleted successfully'));
    if (selectedFavoriteCategory.value === cat) {
      selectedFavoriteCategory.value = 'all';
    }
    fetchFavorites();
    fetchPlugins();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
    }
  }
};

const handleDownload = async (plugin: PluginItem, event?: Event) => {
  event?.stopPropagation();
  if (downloadingIds.value[plugin.id]) return;

  if (plugin.id.startsWith('external-')) {
    if (plugin.fileUrl) {
      window.open(plugin.fileUrl, '_blank', 'noopener,noreferrer');
    } else {
      ElMessage.warning(
        label('该外链暂未提供下载文件', 'This external link has no download file yet'),
      );
    }
    return;
  }

  try {
    downloadingIds.value[plugin.id] = true;
    const { data } = await api.post(`/api/plugins/${plugin.id}/download`);
    const fileUrl = data.fileUrl || plugin.fileUrl;
    if (!fileUrl) {
      ElMessage.warning(label('该插件暂未提供下载文件', 'This plugin has no download file yet'));
      return;
    }
    plugin.downloads += 1;
    window.open(getAssetUrl(fileUrl), '_blank', 'noopener,noreferrer');
    fetchInsights();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('下载失败', 'Download failed')));
  } finally {
    delete downloadingIds.value[plugin.id];
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

const starterTemplates = computed<StarterPluginTemplate[]>(() => [
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
    const pluginsInCategory = pluginsList.value.filter((plugin) => plugin.category === category);
    const count = isAll ? stats.value.total : (fromInsights?.count ?? pluginsInCategory.length);
    const downloads = isAll
      ? stats.value.downloads
      : (fromInsights?.downloads ??
        pluginsInCategory.reduce((sum, plugin) => sum + plugin.downloads, 0));

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

const startFromTemplate = (template: StarterPluginTemplate) => {
  initialPublishData.value = {
    title: template.title,
    pluginCategory: template.category,
    description: template.description,
    pluginCompatibility: template.compatibility,
    tags: template.tags.join(', '),
    pluginInstallGuide: label(
      '1. 将插件包解压到 Blender 插件目录。\n2. 在软件偏好设置中启用插件。\n3. 按项目规范填写依赖版本和使用注意事项。',
      '1. Extract the package into the Blender plugin directory.\n2. Enable it from the Blender preferences.\n3. Document dependencies, versions, and usage notes.',
    ),
  };
  isUploadDialogOpen.value = true;
};

const isFilterOpen = ref(false);
const isFilterCollapsed = ref(false);

const downloadSelectedPlugin = () => {
  if (selectedPlugin.value) handleDownload(selectedPlugin.value);
};

const deletePlugin = async (plugin: PluginItem) => {
  try {
    await ElMessageBox.confirm(
      label(
        `确认删除插件「${plugin.title}」？此操作不可恢复。`,
        `Are you sure you want to delete plugin "${plugin.title}"? This action cannot be undone.`,
      ),
      label('删除插件', 'Delete Plugin'),
      {
        confirmButtonText: label('删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    const oldPlugins = [...pluginsList.value];
    pluginsList.value = pluginsList.value.filter((x) => x.id !== plugin.id);

    ElMessage.success(label('插件已删除', 'Plugin deleted'));
    isDetailDialogOpen.value = false;

    api
      .delete(`/api/plugins/${plugin.id}`)
      .then(() => {
        fetchInsights();
      })
      .catch((error) => {
        pluginsList.value = oldPlugins;
        ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
      });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
    }
  }
};

const isSavingReview = ref(false);

const handleReviewApproved = async (plugin: PluginItem) => {
  try {
    await ElMessageBox.confirm(
      label(`确认通过插件「${plugin.title}」的发布申请？`, `Approve plugin "${plugin.title}"?`),
      label('审核插件', 'Review Plugin'),
      {
        confirmButtonText: label('通过', 'Approve'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'success',
      },
    );

    isSavingReview.value = true;
    const { data } = await api.put(`/api/admin/plugins/${plugin.id}/status`, {
      status: 'APPROVED',
    });

    ElMessage.success(label('插件已通过审核并发布', 'Plugin approved and published'));
    if (selectedPlugin.value && selectedPlugin.value.id === plugin.id) {
      selectedPlugin.value = normalizePlugin(data);
    }
    fetchPlugins();
    fetchInsights();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('审核失败', 'Review failed')));
    }
  } finally {
    isSavingReview.value = false;
  }
};

const handleReviewRejected = async (plugin: PluginItem) => {
  try {
    const { value } = await ElMessageBox.prompt(
      label('驳回原因', 'Rejection Reason'),
      label(`驳回「${plugin.title}」`, `Reject "${plugin.title}"`),
      {
        inputValue:
          plugin.rejectReason ||
          label(
            '安装指南、描述信息需要补充或测试不通过。',
            'Installation guide or description needs more information, or validation failed.',
          ),
        confirmButtonText: label('驳回', 'Reject'),
        cancelButtonText: label('取消', 'Cancel'),
        inputValidator: (val: string | null) => {
          if (!val?.trim()) return label('请输入驳回原因', 'Please enter rejection reason');
          return true;
        },
      },
    );

    isSavingReview.value = true;
    const { data } = await api.put(`/api/admin/plugins/${plugin.id}/status`, {
      status: 'REJECTED',
      rejectReason: value,
    });

    ElMessage.warning(label('已驳回该插件的发布申请', 'Plugin request rejected'));
    if (selectedPlugin.value && selectedPlugin.value.id === plugin.id) {
      selectedPlugin.value = normalizePlugin(data);
    }
    fetchPlugins();
    fetchInsights();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('操作失败', 'Action failed')));
    }
  } finally {
    isSavingReview.value = false;
  }
};

const handlePluginUpdate = async () => {
  fetchPlugins();
  fetchInsights();
  if (selectedPlugin.value) {
    try {
      const { data } = await api.get(`/api/plugins/${selectedPlugin.value.id}`);
      selectedPlugin.value = normalizePlugin(data);
    } catch (err) {
      logError(err, { operation: 'refresh plugin detail' });
    }
  }
};

onMounted(() => {
  systemStore.fetchSettings();
  fetchPlugins();
  fetchInsights();
  fetchFavorites();
  fetchHelpRequests();
});

watch(
  () => route.query.plugin,
  () => {
    applyRoutePlugin();
  },
);
</script>

<template>
  <div
    class="plugins-page mobile-adaptive flex flex-col h-full overflow-hidden"
    @click="handleContainerClick"
  >
    <PluginPageHeader
      v-model:search-query="searchQuery"
      :is-loading="isLoading"
      @refresh="
        fetchPlugins();
        fetchInsights();
      "
      @upload="isUploadDialogOpen = true"
      @success="
        fetchPlugins();
        fetchInsights();
      "
    />

    <div class="flex-1 overflow-y-auto p-4 pt-2.5 flex flex-col gap-3">
      <div
        class="workspace-shell"
        :class="{ 'single-col': activeTab === 'requests', 'collapsed-shell': isFilterCollapsed }"
      >
        <PluginFiltersPanel
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
          @fetch-plugins="fetchPlugins"
          @rename-category="handleRenameFavoriteCategory"
          @delete-category="handleDeleteFavoriteCategory"
          @create-category="handleCreateFavoriteCategory"
        />

        <main class="content-panel">
          <PluginToolbar
            :active-tab="activeTab"
            :library-tab-options="libraryTabOptions"
            :sort-by="sortBy"
            :view-mode="viewMode"
            :view-mode-options="viewModeOptions"
            :is-filter-open="isFilterOpen"
            :is-filter-collapsed="isFilterCollapsed"
            @toggle-filter-collapse="isFilterCollapsed = false"
            :is-batch-mode="isBatchMode"
            :selected-ids="Array.from(selectedPluginIds)"
            :visible-plugins-count="visiblePlugins.length"
            @update:active-tab="activeTab = $event"
            @update:sort-by="sortBy = $event"
            @update:view-mode="viewMode = $event"
            @update:is-batch-mode="
              isBatchMode = $event;
              if (!$event) selectedPluginIds = new Set();
            "
            @select-all="selectAllPlugins"
            @bulk-delete="handleBulkDeletePlugins"
            @bulk-unfavorite="handleBulkUnfavoritePlugins"
            @toggle-filter="isFilterOpen = !isFilterOpen"
          />

          <!-- Request Help forum list -->
          <HelpRequestsForum
            v-if="activeTab === 'requests'"
            :forum-title="label('插件求助论坛', 'Plugin Help Requests Forum')"
            :forum-desc="
              label(
                '找不到需要的插件？发布求助帖，让社区开发者和爱好者来帮助您！',
                'Can\'t find a plugin? Ask the community for help.',
              )
            "
            :requests="helpRequests"
            :is-loading="isHelpRequestsLoading"
            @open-detail="openHelpRequestDetail"
            @create-request="showHelpRequestPostDialog = true"
          />

          <template v-else>
            <!-- AI recommendation summary -->
            <div
              v-if="aiSearchAnalysis && searchQuery && activeTab === 'explore'"
              class="mb-4.5 p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 backdrop-blur-md"
            >
              <div class="flex items-center gap-2 mb-3">
                <Sparkles class="w-4 h-4 text-indigo-400 animate-pulse" />
                <span class="text-xs font-black text-indigo-400 uppercase tracking-wider">
                  AI 推荐与提炼结论
                </span>
              </div>
              <MdPreview
                :model-value="aiSearchAnalysis"
                :theme="isDark ? 'dark' : 'light'"
                class="!bg-transparent !text-[var(--text-secondary)] !text-xs"
              />
            </div>

            <PluginCatalog
              :plugins="visiblePlugins"
              :is-loading="isLoading"
              :view-mode="viewMode"
              :active-tab="activeTab"
              :favorited-ids="favoritedIds"
              :downloading-ids="downloadingIds"
              :active-filter-chips="activeFilterChips"
              :total-count="stats.total || visiblePlugins.length"
              :selected-ids="Array.from(selectedPluginIds)"
              @open-detail="openDetail"
              @select="togglePluginSelect"
              @toggle-favorite="toggleFavorite"
              @download="handleDownload"
              @reset-filters="resetFilters"
              @clear-filter="clearFilter"
              @upload="isUploadDialogOpen = true"
            />
          </template>
        </main>
      </div>
    </div>

    <UnifiedDetailModal
      v-if="isDetailDialogOpen"
      :show="isDetailDialogOpen"
      :item="selectedPlugin"
      kind="plugin"
      :is-favorited="selectedPlugin ? isFavorited(selectedPlugin.id) : false"
      :is-downloading="selectedPlugin ? !!downloadingIds[selectedPlugin.id] : false"
      :is-admin="isAdmin"
      :can-edit="selectedPlugin ? canEditPlugin(selectedPlugin) : false"
      :is-saving-review="isSavingReview"
      @close="isDetailDialogOpen = false"
      @favorite="
        fetchFavorites();
        fetchInsights();
      "
      @download="downloadSelectedPlugin"
      @edit="handleDetailEdit"
      @delete="deletePlugin"
      @review-approved="handleReviewApproved"
      @review-rejected="handleReviewRejected"
      @update="handlePluginUpdate"
    />

    <PublishWorkDialog
      v-if="isUploadDialogOpen"
      v-model="isUploadDialogOpen"
      default-category="plugin"
      :initial-data="initialPublishData"
      @published="
        fetchPlugins();
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

              <!-- Linked approved plugin showcase -->
              <div
                v-if="rep.linkedPlugin"
                class="flex items-center justify-between p-3 rounded-xl bg-indigo-600/5 border border-indigo-500/10 cursor-pointer hover:bg-indigo-600/10 transition-colors"
                @click="openLinkedPlugin(rep.linkedPlugin.id)"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div
                    class="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center shrink-0"
                  >
                    <img
                      v-if="rep.linkedPlugin.previewUrl"
                      :src="getAssetUrl(rep.linkedPlugin.previewUrl)"
                      class="w-full h-full object-cover"
                    />
                    <Puzzle v-else class="w-4 h-4 text-indigo-400" />
                  </div>
                  <div class="text-left min-w-0">
                    <div class="text-xs font-bold text-[var(--text-primary)] truncate">
                      {{ rep.linkedPlugin.title }}
                    </div>
                    <div class="text-[9px] text-[var(--text-muted)] mt-0.5">
                      v{{ rep.linkedPlugin.version }}
                    </div>
                  </div>
                </div>

                <div
                  class="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:underline"
                >
                  <span>{{ label('查看插件', 'View Plugin') }}</span>
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
            <!-- Linked plugin dropdown -->
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span
                class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0"
                >{{ label('关联插件(可选)', 'Link Plugin') }}</span
              >
              <Select
                v-model="linkedPluginIdForReply"
                placeholder="选择推荐的已上架插件"
                clearable
                filterable
                class="flex-1 custom-select-v2 text-xs"
              >
                <SelectOption
                  v-for="p in approvedPluginsForLinking"
                  :key="p.id"
                  :label="p.title"
                  :value="p.id"
                />
              </Select>
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
.plugins-page {
  height: 100%;
  background:
    linear-gradient(
      180deg,
      rgba(37, 99, 235, 0.05),
      rgba(20, 184, 166, 0.03) 200px,
      transparent 380px
    ),
    transparent;
  color: var(--text-primary);
}

.workspace-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
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
