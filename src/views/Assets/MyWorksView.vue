<script setup lang="ts">
import { computed, onMounted, ref, watch, defineAsyncComponent } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useLabel } from '@/utils/i18n';
import {
  Box,
  Clock3,
  FileImage,
  Grid3X3,
  HardDrive,
  Layers,
  LayoutList,
  PackageCheck,
  Puzzle,
  SendHorizonal,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { useSystemStore } from '@/stores/system';
import { formatCompactNumber, formatFileSize } from './resourceUtils';
import {
  calculateWorkStats,
  filterAndSortWorks,
  getReviewCompletion,
  normalizeWorkbenchWorks,
  normalizeAssetWork,
  normalizeMaterialWork,
  normalizePluginWork,
  normalizeShowcaseWork,
  type AssetWork,
  type CategoryType,
  type MaterialWork,
  type PluginWork,
  type ShowcaseWork,
  type UnifiedWork,
  type WorkKind,
  type WorkStatus,
  type WorkbenchSummary,
  type WorkSortKey,
  type WorkViewMode as ViewMode,
} from './myWorksModel';
import MyWorksHeader from './components/MyWorksHeader.vue';
import MyWorksStatsPanel from './components/MyWorksStatsPanel.vue';
import MyWorksFilterPanel from './components/MyWorksFilterPanel.vue';
import MyWorksGrid from './components/MyWorksGrid.vue';
import { useAuthStore } from '@/stores/auth';

const PublishWorkDialog = defineAsyncComponent(() => import('@/components/PublishWorkDialog.vue'));
const EditWorkDialog = defineAsyncComponent(() => import('./components/EditWorkDialog.vue'));
const SubmitShowcaseDialog = defineAsyncComponent(
  () => import('./components/SubmitShowcaseDialog.vue'),
);
const AssetDetailModal = defineAsyncComponent(() => import('./components/AssetDetailModal.vue'));
const MaterialDetailPanel = defineAsyncComponent(
  () => import('./components/MaterialDetailPanel.vue'),
);
const PluginDetailModal = defineAsyncComponent(() => import('./components/PluginDetailModal.vue'));
const ShowcaseDetail = defineAsyncComponent(
  () => import('../Community/components/ShowcaseDetail.vue'),
);

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const label = useLabel();
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

const isAssetDetailOpen = ref(false);
const selectedAssetId = ref<string | null>(null);

const isMaterialDetailOpen = ref(false);
const selectedMaterial = ref<any | null>(null);
const isMaterialLoading = ref(false);

const isPluginDetailOpen = ref(false);
const selectedPlugin = ref<any | null>(null);
const isPluginLoading = ref(false);

const isShowcaseDetailOpen = ref(false);
const selectedShowcase = ref<any | null>(null);
const isShowcaseLoading = ref(false);

function showAssetDetail(assetId: string) {
  selectedAssetId.value = assetId;
  isAssetDetailOpen.value = true;
}

async function showMaterialDetail(materialId: string) {
  isMaterialLoading.value = true;
  try {
    const { data } = await api.get(`/api/materials/${materialId}`);
    selectedMaterial.value = {
      ...data,
      id: data.id,
      title: data.title || '',
      description: data.description || '',
      category: data.category || '其他',
      tags: data.tags || [],
      preview: data.previewUrl || data.preview || '',
      downloads: data.downloads || 0,
      fileSize: data.fileSize || 0,
      resolution: data.resolution || '4K',
      favorites: data.favorites || 0,
      isProcedural: !!data.isProcedural,
      status: data.status,
      rejectReason: data.rejectReason,
      userId: data.userId,
      isFavorited: !!data.isFavorited,
      _count: data._count || { favorites: data.favorites || 0 },
    };
    isMaterialDetailOpen.value = true;
  } catch {
    ElMessage.error('加载材质详情失败');
  } finally {
    isMaterialLoading.value = false;
  }
}

async function showPluginDetail(pluginId: string) {
  isPluginLoading.value = true;
  try {
    const { data } = await api.get(`/api/plugins/${pluginId}`);
    selectedPlugin.value = data.plugin || data;
    isPluginDetailOpen.value = true;
  } catch {
    ElMessage.error('加载插件详情失败');
  } finally {
    isPluginLoading.value = false;
  }
}

async function showShowcaseDetail(showcaseId: string) {
  isShowcaseLoading.value = true;
  try {
    const { data } = await api.get(`/api/showcase/${showcaseId}`);
    selectedShowcase.value = data;
    isShowcaseDetailOpen.value = true;
  } catch {
    ElMessage.error('加载展示详情失败');
  } finally {
    isShowcaseLoading.value = false;
  }
}

function handleDetailEdit(item: any, kind: 'asset' | 'material' | 'plugin' | 'showcase') {
  isAssetDetailOpen.value = false;
  isMaterialDetailOpen.value = false;
  isPluginDetailOpen.value = false;
  isShowcaseDetailOpen.value = false;

  let work: UnifiedWork | null = null;
  if (kind === 'asset') {
    const raw = assets.value.find((a) => a.id === item.id);
    if (raw) work = normalizeAssetWork(raw);
  } else if (kind === 'material') {
    const raw = materials.value.find((m) => m.id === item.id);
    if (raw) work = normalizeMaterialWork(raw);
  } else if (kind === 'plugin') {
    const raw = plugins.value.find((p) => p.id === item.id);
    if (raw) work = normalizePluginWork(raw);
  } else if (kind === 'showcase') {
    const raw = showcases.value.find((s) => s.id === item.id);
    if (raw) work = normalizeShowcaseWork(raw);
  }

  if (work) {
    openEditDialog(work);
  } else {
    const fallbackWork: UnifiedWork = {
      uid: `${kind}-${item.id}`,
      id: item.id,
      kind,
      title: item.title,
      description: item.description || '',
      status: item.status || 'APPROVED',
      tags: item.tags || [],
      surface: '',
      typeLabel:
        kind === 'asset'
          ? '资源'
          : kind === 'material'
            ? '材质'
            : kind === 'plugin'
              ? '插件'
              : '展示',
      format: '',
      thumbnail: item.previewUrl || item.preview || '',
      size: item.fileSize || 0,
      metric: 0,
      metricLabel: '',
      createdAt: item.createdAt || '',
      raw: item,
    };
    openEditDialog(fallbackWork);
  }
}

function handleDetailDelete(item: any, kind: 'asset' | 'material' | 'plugin' | 'showcase') {
  isAssetDetailOpen.value = false;
  isMaterialDetailOpen.value = false;
  isPluginDetailOpen.value = false;
  isShowcaseDetailOpen.value = false;

  const work: UnifiedWork = {
    uid: `${kind}-${item.id}`,
    id: item.id,
    kind,
    title: item.title,
    description: item.description || '',
    status: item.status || 'APPROVED',
    tags: item.tags || [],
    surface: '',
    typeLabel:
      kind === 'asset'
        ? '资源'
        : kind === 'material'
          ? '材质'
          : kind === 'plugin'
            ? '插件'
            : '展示',
    format: '',
    thumbnail: item.previewUrl || item.preview || '',
    size: item.fileSize || 0,
    metric: 0,
    metricLabel: '',
    createdAt: item.createdAt || '',
    raw: item,
  };
  handleDeleteWork(work);
}
const searchQuery = ref('');
const isStatsExpanded = ref(false);
const sourceFilter = ref<'ALL' | WorkKind>('ALL');
const statusFilter = ref<WorkStatus>('ALL');
const viewMode = ref<ViewMode>('grid');
const viewModeOptions = computed(() => [
  { value: 'grid', icon: Grid3X3 },
  { value: 'list', icon: LayoutList },
]);
const sortBy = ref<WorkSortKey>('newest');
const isLoading = ref(false);
const isSaving = ref(false);
const isPublishWorkDialogOpen = ref(false);
const isEditDialogOpen = ref(false);
const isShowcaseDialogOpen = ref(false);
const selectedWork = ref<UnifiedWork | null>(null);

const assets = ref<AssetWork[]>([]);
const materials = ref<MaterialWork[]>([]);
const plugins = ref<PluginWork[]>([]);
const showcases = ref<ShowcaseWork[]>([]);
const assetCategories = ref<CategoryType[]>([]);
const workbenchSummary = ref<WorkbenchSummary | null>(null);

const activeTab = ref<'mine' | 'favorites'>('mine');
const mySubmissionsCount = ref(0);
const myFavoritesCount = ref(0);

const libraryTabOptions = computed(() => [
  { label: `我的提交 ${mySubmissionsCount.value}`, value: 'mine' },
  { label: `我的收藏 ${myFavoritesCount.value}`, value: 'favorites' },
]);

const systemStore = useSystemStore();
const materialCategories = computed(() =>
  (systemStore.settings.MATERIAL_CATEGORIES || []).filter(
    (name) => name !== '全部材料' && name !== '全部',
  ),
);
const pluginCategories = computed(() =>
  (systemStore.settings.PLUGIN_CATEGORIES || []).filter(
    (name) => name !== '全部插件' && name !== '全部',
  ),
);

const editForm = ref<{
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
  installGuide: string;
  // asset-specific fields
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
  // files
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
}>({
  title: '',
  description: '',
  tags: '',
  categoryId: '',
  materialCategory: '其他',
  resolution: '4K',
  isProcedural: false,
  pluginCategory: '其他工具',
  pluginVersion: '1.0.0',
  pluginCompatibility: '',
  showcaseType: 'IMAGE',
  videoUrl: '',
  installGuide: '',
  // asset-specific fields
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
  // files
  file: null,
  packageFile: null,
  thumbnail: null,
  downloadType: 'local',
  externalUrl: '',
  extractionCode: '',
  tempAssetPath: undefined,
  tempPackagePath: undefined,
  tempThumbnailPath: undefined,
  tempMaterialPath: undefined,
  tempPluginPath: undefined,
  tempPreviewPath: undefined,
});

const showcaseForm = ref({
  assetId: '',
  title: '',
  description: '',
  tags: '',
});

const allWorks = computed<UnifiedWork[]>(() =>
  normalizeWorkbenchWorks({
    assets: assets.value,
    materials: materials.value,
    plugins: plugins.value,
    showcases: showcases.value,
  }),
);

const filteredWorks = computed(() =>
  filterAndSortWorks(allWorks.value, {
    searchQuery: searchQuery.value,
    sourceFilter: sourceFilter.value,
    statusFilter: statusFilter.value,
    sortBy: sortBy.value,
  }),
);

const activeFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string }> = [];

  if (sourceFilter.value !== 'ALL') {
    const kindLabels: Record<string, string> = {
      asset: label('模型库', 'Models'),
      material: label('材料库', 'Materials'),
      plugin: label('插件库', 'Plugins'),
      showcase: label('展示作品', 'Showcase'),
    };
    chips.push({
      key: 'source',
      label: label(
        `来源: ${kindLabels[sourceFilter.value]}`,
        `Source: ${kindLabels[sourceFilter.value]}`,
      ),
    });
  }

  if (statusFilter.value !== 'ALL') {
    const statusLabels: Record<string, string> = {
      PENDING: label('待审核', 'Pending'),
      APPROVED: label('已发布', 'Approved'),
      REJECTED: label('未通过', 'Rejected'),
    };
    chips.push({
      key: 'status',
      label: label(
        `状态: ${statusLabels[statusFilter.value]}`,
        `Status: ${statusLabels[statusFilter.value]}`,
      ),
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
  if (key === 'source') sourceFilter.value = 'ALL';
  if (key === 'status') statusFilter.value = 'ALL';
  if (key === 'search') searchQuery.value = '';
};

const resetFilters = () => {
  sourceFilter.value = 'ALL';
  statusFilter.value = 'ALL';
  searchQuery.value = '';
};

const stats = computed(() => calculateWorkStats(allWorks.value));

const reviewCompletion = computed(() => getReviewCompletion(stats.value));

const statCards = computed(() => [
  {
    label: '全部作品',
    value: stats.value.total,
    meta: `${stats.value.approved} 个已公开`,
    icon: PackageCheck,
    tone: 'blue',
  },
  {
    label: '待审核',
    value: stats.value.pending,
    meta: '修改后会重新进入审核',
    icon: Clock3,
    tone: 'amber',
  },
  {
    label: '未通过',
    value: stats.value.rejected,
    meta: '可编辑后重新提交',
    icon: XCircle,
    tone: 'rose',
  },
  {
    label: '总触达',
    value: formatCompactNumber(stats.value.totalReach),
    meta: `文件 ${formatFileSize(stats.value.totalSize, '0 MB')}`,
    icon: Sparkles,
    tone: 'teal',
  },
]);

const workbenchSignals = computed(() => [
  {
    label: '审核通过率',
    value: `${workbenchSummary.value?.readyRate ?? reviewCompletion.value}%`,
    meta: `${stats.value.approved}/${stats.value.total} 已发布`,
    icon: PackageCheck,
    tone: 'green',
  },
  {
    label: '待处理',
    value: workbenchSummary.value?.needsAction ?? stats.value.pending + stats.value.rejected,
    meta: `${stats.value.pending} 待审核 / ${stats.value.rejected} 未通过`,
    icon: ShieldAlert,
    tone: stats.value.rejected > 0 ? 'rose' : 'amber',
  },
  {
    label: '内容触达',
    value: formatCompactNumber(workbenchSummary.value?.totalReach ?? stats.value.totalReach),
    meta: '下载 / 浏览 / 收藏 / 点赞',
    icon: SendHorizonal,
    tone: 'blue',
  },
  {
    label: '占用空间',
    value: formatFileSize(workbenchSummary.value?.totalSize ?? stats.value.totalSize, '0 MB'),
    meta: '资源、材料、插件文件',
    icon: HardDrive,
    tone: 'teal',
  },
]);

const sourceTabs = computed(() => {
  const currentStatus = statusFilter.value;
  const query = searchQuery.value.trim().toLowerCase();

  const getCountForKind = (kind: 'ALL' | WorkKind) => {
    return allWorks.value.filter((work) => {
      const matchesKind = kind === 'ALL' || work.kind === kind;
      const matchesStatus = currentStatus === 'ALL' || work.status === currentStatus;
      const matchesQuery =
        !query ||
        work.title.toLowerCase().includes(query) ||
        work.description.toLowerCase().includes(query) ||
        work.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        work.surface.toLowerCase().includes(query);
      return matchesKind && matchesStatus && matchesQuery;
    }).length;
  };

  return [
    { key: 'ALL', label: '全部内容', count: getCountForKind('ALL'), icon: Sparkles },
    { key: 'asset', label: '资源', count: getCountForKind('asset'), icon: Box },
    { key: 'material', label: '材料', count: getCountForKind('material'), icon: Layers },
    { key: 'plugin', label: '插件', count: getCountForKind('plugin'), icon: Puzzle },
    { key: 'showcase', label: '展示', count: getCountForKind('showcase'), icon: FileImage },
  ] as const;
});

const statusTabs = computed(() => {
  const currentSource = sourceFilter.value;
  const query = searchQuery.value.trim().toLowerCase();

  const getCountForStatus = (status: WorkStatus) => {
    return allWorks.value.filter((work) => {
      const matchesKind = currentSource === 'ALL' || work.kind === currentSource;
      const matchesStatus = status === 'ALL' || work.status === status;
      const matchesQuery =
        !query ||
        work.title.toLowerCase().includes(query) ||
        work.description.toLowerCase().includes(query) ||
        work.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        work.surface.toLowerCase().includes(query);
      return matchesKind && matchesStatus && matchesQuery;
    }).length;
  };

  return [
    { key: 'ALL', label: '全部状态', count: getCountForStatus('ALL') },
    { key: 'PENDING', label: '待审核', count: getCountForStatus('PENDING') },
    { key: 'APPROVED', label: '已通过', count: getCountForStatus('APPROVED') },
    { key: 'REJECTED', label: '未通过', count: getCountForStatus('REJECTED') },
  ] as const;
});

const sourceTabOptions = computed(() => {
  return sourceTabs.value.map((tab) => ({
    label: tab.label,
    value: tab.key,
    badge: tab.count,
  }));
});

const statusTabOptions = computed(() => {
  return statusTabs.value.map((tab) => ({
    label: tab.label,
    value: tab.key,
    badge: tab.count,
  }));
});
const fetchWorks = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    if (activeTab.value === 'mine') {
      const { data } = await api.get('/api/resources/my-workbench', {
        params: { limit: 240 },
      });
      assets.value = data.assets || [];
      materials.value = data.materials || [];
      plugins.value = data.plugins || [];
      showcases.value = data.showcases || [];
      workbenchSummary.value = data.summary || null;
      mySubmissionsCount.value =
        (data.assets || []).length +
        (data.materials || []).length +
        (data.plugins || []).length +
        (data.showcases || []).length;
    } else {
      const [assetsRes, materialsRes, pluginsRes] = await Promise.all([
        api.get('/api/assets/public', { params: { favoritesOnly: 'true', limit: 100 } }),
        api.get('/api/materials', { params: { favoritesOnly: 'true', limit: 100 } }),
        api.get('/api/plugins/favorites'),
      ]);
      assets.value = assetsRes.data?.assets || [];
      materials.value = Array.isArray(materialsRes.data)
        ? materialsRes.data
        : materialsRes.data?.items || [];
      plugins.value = pluginsRes.data?.plugins || [];
      showcases.value = [];
      workbenchSummary.value = null;

      const assetsCount =
        assetsRes.data?.pagination?.total || (assetsRes.data?.assets || []).length;
      const materialsCount = Array.isArray(materialsRes.data)
        ? materialsRes.data.length
        : materialsRes.data?.total || materialsRes.data?.items?.length || 0;
      const pluginsCount = pluginsRes.data?.plugins?.length || 0;
      myFavoritesCount.value = assetsCount + materialsCount + pluginsCount;
    }
  } catch (error) {
    if (!silent) {
      ElMessage.error(
        getApiErrorMessage(
          error,
          activeTab.value === 'mine' ? '我的作品加载失败' : '收藏列表加载失败',
        ),
      );
    }
  } finally {
    if (!silent) isLoading.value = false;
  }
};
watch(activeTab, () => {
  fetchWorks();
});

const fetchCategories = async () => {
  try {
    const { data } = await api.get('/api/assets/categories');
    assetCategories.value = data || [];
  } catch {
    assetCategories.value = [];
  }
};

const openWork = (work: UnifiedWork) => {
  if (work.kind === 'asset') {
    showAssetDetail(work.id);
  } else if (work.kind === 'material') {
    showMaterialDetail(work.id);
  } else if (work.kind === 'plugin') {
    showPluginDetail(work.id);
  } else if (work.kind === 'showcase') {
    showShowcaseDetail(work.id);
  } else {
    router.push('/my-works');
  }
};

const handleDownload = async (work: UnifiedWork) => {
  if (work.kind === 'asset') {
    const raw = work.raw as AssetWork;
    try {
      await api.post(`/api/assets/${work.id}/download`);
    } catch {
      // Download is still allowed if counting fails.
    }
    window.open(getAssetUrl(raw.url), '_blank', 'noopener,noreferrer');
    return;
  }

  if (work.kind === 'material') {
    try {
      await api.post(`/api/materials/${work.id}/download`);
      const response = await api.get(`/api/materials/${work.id}/file`, { responseType: 'blob' });
      const raw = work.raw as MaterialWork;
      const ext = raw.fileUrl?.split('.').pop() || 'zip';
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${work.title}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, '下载失败'));
    }
    return;
  }

  if (work.kind === 'plugin') {
    const raw = work.raw as PluginWork;
    try {
      const { data } =
        work.status === 'APPROVED'
          ? await api.post(`/api/plugins/${work.id}/download`)
          : { data: { fileUrl: raw.fileUrl } };
      const fileUrl = data.fileUrl || raw.fileUrl;
      if (!fileUrl) {
        ElMessage.warning('该插件暂无可下载文件');
        return;
      }
      window.open(getAssetUrl(fileUrl), '_blank', 'noopener,noreferrer');
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, '下载失败'));
    }
  }
};

const openEditDialog = (work: UnifiedWork) => {
  selectedWork.value = work;
  const raw = work.raw;
  const rawAny = raw as any;
  const rawAsset = work.kind === 'asset' ? (raw as AssetWork) : null;
  const rawPlugin = work.kind === 'plugin' ? (raw as PluginWork) : null;

  let parsedPbrChannels: string[] = [];
  if (rawAsset && rawAsset.pbrChannels) {
    if (typeof rawAsset.pbrChannels === 'string') {
      try {
        parsedPbrChannels = JSON.parse(rawAsset.pbrChannels);
      } catch {
        parsedPbrChannels = [];
      }
    } else if (Array.isArray(rawAsset.pbrChannels)) {
      parsedPbrChannels = rawAsset.pbrChannels;
    }
  }

  let fileUrl = '';
  if (work.kind === 'asset') {
    fileUrl = (raw as AssetWork).url || '';
  } else if (work.kind === 'material') {
    fileUrl = (raw as MaterialWork).fileUrl || '';
  } else if (work.kind === 'plugin') {
    fileUrl = (raw as PluginWork).fileUrl || '';
  }

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
    description: work.description,
    tags: work.tags.join(', '),
    categoryId: work.kind === 'asset' ? (raw as AssetWork).categoryId || '' : '',
    materialCategory: work.kind === 'material' ? (raw as MaterialWork).category || '其他' : '其他',
    resolution: work.kind === 'material' ? (raw as MaterialWork).resolution || '4K' : '4K',
    isProcedural: work.kind === 'material' ? !!(raw as MaterialWork).isProcedural : false,
    pluginCategory:
      work.kind === 'plugin' ? (raw as PluginWork).category || '其他工具' : '其他工具',
    pluginVersion: work.kind === 'plugin' ? (raw as PluginWork).version || '1.0.0' : '1.0.0',
    pluginCompatibility: work.kind === 'plugin' ? (raw as PluginWork).compatibility || '' : '',
    showcaseType: work.kind === 'showcase' ? (raw as ShowcaseWork).type || 'IMAGE' : 'IMAGE',
    videoUrl: work.kind === 'showcase' ? (raw as ShowcaseWork).videoUrl || '' : '',
    installGuide: rawPlugin?.installGuide || '',

    // advanced fields shared across asset, material, plugin
    originality: rawAny?.originality || 'ORIGINAL',
    originalAuthor: rawAny?.originalAuthor || '',
    originalLink: rawAny?.originalLink || '',
    license: rawAny?.license || 'CC_BY',
    isFree: rawAny?.isFree !== false,
    meshType: rawAsset?.meshType || 'LOW_POLY',
    uvUnwrapped: rawAsset?.uvUnwrapped !== false,
    uvOverlapping: !!rawAsset?.uvOverlapping,
    pbrChannels: parsedPbrChannels,
    rigged: !!rawAsset?.rigged,
    gameReady: !!rawAsset?.gameReady,
    linkedCourseId: rawAny?.linkedCourseId || '',
    linkedLessonId: rawAny?.linkedLessonId || '',

    // files
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
    ElMessage.warning('请填写作品名称');
    return;
  }

  const work = selectedWork.value;
  if (['asset', 'material', 'plugin'].includes(work.kind) && editForm.value.downloadType === 'external') {
    if (!editForm.value.externalUrl.trim()) {
      ElMessage.warning('请填写网盘链接或外部下载链接');
      return;
    }
  }

  isSaving.value = true;
  try {
    if (work.kind === 'asset') {
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

      await api.patch(`/api/assets/${work.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else if (work.kind === 'material') {
      const formData = new FormData();
      formData.append('title', editForm.value.title);
      formData.append('description', editForm.value.description);
      formData.append('category', editForm.value.materialCategory);
      formData.append('resolution', editForm.value.resolution);
      formData.append('tags', editForm.value.tags);
      formData.append('isProcedural', String(editForm.value.isProcedural));
      formData.append('originality', editForm.value.originality || 'ORIGINAL');
      formData.append('originalAuthor', editForm.value.originalAuthor || '');
      formData.append('originalLink', editForm.value.originalLink || '');
      formData.append('license', editForm.value.license || 'CC_BY');
      formData.append('isFree', String(editForm.value.isFree !== false));
      formData.append('linkedCourseId', editForm.value.linkedCourseId || '');
      formData.append('linkedLessonId', editForm.value.linkedLessonId || '');

      if (editForm.value.downloadType === 'local') {
        if (editForm.value.tempMaterialPath) {
          formData.append('tempMaterialPath', editForm.value.tempMaterialPath);
        } else if (editForm.value.file) {
          formData.append('material', editForm.value.file);
        }
      } else {
        let finalUrl = editForm.value.externalUrl.trim();
        if (editForm.value.extractionCode?.trim()) {
          finalUrl += ` 提取码: ${editForm.value.extractionCode.trim()}`;
        }
        formData.append('externalUrl', finalUrl);
      }
      if (editForm.value.tempThumbnailPath) {
        formData.append('tempPreviewPath', editForm.value.tempThumbnailPath);
      } else if (editForm.value.thumbnail) {
        formData.append('preview', editForm.value.thumbnail);
      }

      await api.put(`/api/materials/${work.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else if (work.kind === 'plugin') {
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

      await api.put(`/api/plugins/${work.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      await api.put(`/api/showcase/${work.id}`, {
        title: editForm.value.title,
        description: editForm.value.description,
        tags: editForm.value.tags,
        type: editForm.value.showcaseType,
        videoUrl: editForm.value.videoUrl,
        isVideo: editForm.value.showcaseType === 'VIDEO',
      });
    }

    ElMessage.success('修改已提交审核');
    isEditDialogOpen.value = false;
    await fetchWorks();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存失败'));
  } finally {
    isSaving.value = false;
  }
};
const handleDeleteWork = async (work: UnifiedWork) => {
  try {
    await ElMessageBox.confirm(`确定删除「${work.title}」吗？`, '删除作品', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });

    // 备份当前状态以备失败恢复
    const oldAssets = [...assets.value];
    const oldMaterials = [...materials.value];
    const oldPlugins = [...plugins.value];
    const oldShowcases = [...showcases.value];

    // 乐观更新：立刻在前端移除该作品
    if (work.kind === 'asset') {
      assets.value = assets.value.filter((x) => x.id !== work.id);
    } else if (work.kind === 'material') {
      materials.value = materials.value.filter((x) => x.id !== work.id);
    } else if (work.kind === 'plugin') {
      plugins.value = plugins.value.filter((x) => x.id !== work.id);
    } else if (work.kind === 'showcase') {
      showcases.value = showcases.value.filter((x) => x.id !== work.id);
    }

    // 立刻提示已删除
    ElMessage.success('已删除');

    // 异步在后台删除，成功后静默拉取更新，失败后恢复界面
    const deletePromise = (() => {
      if (work.kind === 'asset') return api.delete(`/api/assets/${work.id}`);
      if (work.kind === 'material') return api.delete(`/api/materials/${work.id}`);
      if (work.kind === 'plugin') return api.delete(`/api/plugins/${work.id}`);
      if (work.kind === 'showcase') return api.delete(`/api/showcase/${work.id}`);
      return Promise.resolve();
    })();

    deletePromise
      .then(() => {
        fetchWorks(true);
      })
      .catch((err) => {
        // 恢复数据
        assets.value = oldAssets;
        materials.value = oldMaterials;
        plugins.value = oldPlugins;
        showcases.value = oldShowcases;
        ElMessage.error(getApiErrorMessage(err, '删除失败'));
      });
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error, '删除失败'));
  }
};
const openShowcaseDialog = (work: UnifiedWork) => {
  if (work.kind !== 'asset') return;
  showcaseForm.value = {
    assetId: work.id,
    title: work.title,
    description: work.description,
    tags: work.tags.join(', '),
  };
  isShowcaseDialogOpen.value = true;
};

const publishToShowcase = async () => {
  if (!showcaseForm.value.title.trim()) {
    ElMessage.warning('请填写展示标题');
    return;
  }
  try {
    await api.post('/api/showcase/publish-asset', showcaseForm.value);
    ElMessage.success('已提交作品展示审核');
    isShowcaseDialogOpen.value = false;
    await fetchWorks();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发布失败'));
  }
};

const checkEditQueryParam = () => {
  if (route.query.editAssetId) {
    const assetId = String(route.query.editAssetId);
    const foundAsset = assets.value.find((a) => a.id === assetId);
    if (foundAsset) {
      const work = normalizeAssetWork(foundAsset);
      openEditDialog(work);
    }
  } else if (route.query.editMaterialId) {
    const materialId = String(route.query.editMaterialId);
    const foundMaterial = materials.value.find((m) => m.id === materialId);
    if (foundMaterial) {
      const work = normalizeMaterialWork(foundMaterial);
      openEditDialog(work);
    }
  } else if (route.query.editPluginId) {
    const pluginId = String(route.query.editPluginId);
    const foundPlugin = plugins.value.find((p) => p.id === pluginId);
    if (foundPlugin) {
      const work = normalizePluginWork(foundPlugin);
      openEditDialog(work);
    }
  }
};

watch(
  () => [route.query.editAssetId, route.query.editMaterialId, route.query.editPluginId],
  () => {
    checkEditQueryParam();
  },
);

onMounted(async () => {
  systemStore.fetchSettings();
  fetchCategories();
  await fetchWorks();
  checkEditQueryParam();

  // Pre-fetch favorites count to display badge on tab
  try {
    const [assetsRes, materialsRes, pluginsRes] = await Promise.all([
      api.get('/api/assets/public', { params: { favoritesOnly: 'true', limit: 1 } }),
      api.get('/api/materials', { params: { favoritesOnly: 'true', limit: 1 } }),
      api.get('/api/plugins/favorites'),
    ]);
    const assetsCount = assetsRes.data?.pagination?.total || 0;
    const materialsCount = Array.isArray(materialsRes.data)
      ? materialsRes.data.length
      : materialsRes.data?.total || materialsRes.data?.items?.length || 0;
    const pluginsCount = pluginsRes.data?.plugins?.length || 0;
    myFavoritesCount.value = assetsCount + materialsCount + pluginsCount;
  } catch (err) {
    logError(err, { operation: 'prefetchFavoritesCount', view: 'MyWorksView' });
  }
});
</script>

<template>
  <div class="my-works-page mobile-adaptive flex flex-col h-full overflow-hidden">
    <MyWorksHeader
      v-model:search-query="searchQuery"
      v-model:is-stats-expanded="isStatsExpanded"
      :active-tab="activeTab"
      :is-loading="isLoading"
      @refresh="fetchWorks"
      @publish="isPublishWorkDialogOpen = true"
    />

    <div class="flex-1 overflow-y-auto p-4 pt-2.5 flex flex-col gap-3">
      <MyWorksStatsPanel
        v-model:status-filter="statusFilter"
        :is-stats-expanded="isStatsExpanded"
        :active-tab="activeTab"
        :stat-cards="statCards"
        :workbench-signals="workbenchSignals"
        :review-completion="reviewCompletion"
      />

      <section class="workspace-shell">
        <MyWorksFilterPanel
          v-model:source-filter="sourceFilter"
          v-model:status-filter="statusFilter"
          :active-tab="activeTab"
          :source-tab-options="sourceTabOptions"
          :status-tab-options="statusTabOptions"
        />

        <MyWorksGrid
          v-model:active-tab="activeTab"
          v-model:sort-by="sortBy"
          v-model:view-mode="viewMode"
          :library-tab-options="libraryTabOptions"
          :view-mode-options="viewModeOptions"
          :is-loading="isLoading"
          :filtered-works="filteredWorks"
          :active-filter-chips="activeFilterChips"
          :total-count="allWorks.length"
          @open-work="openWork"
          @edit="openEditDialog"
          @download="handleDownload"
          @share="openShowcaseDialog"
          @delete="handleDeleteWork"
          @publish="isPublishWorkDialogOpen = true"
          @clear-filter="clearFilter"
          @reset-filters="resetFilters"
        />
      </section>
    </div>

    <EditWorkDialog
      v-if="isEditDialogOpen"
      v-model:show="isEditDialogOpen"
      v-model:form="editForm"
      :work="selectedWork"
      :is-saving="isSaving"
      :asset-categories="assetCategories"
      :material-categories="materialCategories"
      :plugin-categories="pluginCategories"
      @save="handleSaveEdit"
    />

    <SubmitShowcaseDialog
      v-if="isShowcaseDialogOpen"
      v-model:show="isShowcaseDialogOpen"
      v-model:form="showcaseForm"
      @submit="publishToShowcase"
    />

    <PublishWorkDialog
      v-if="isPublishWorkDialogOpen"
      v-model="isPublishWorkDialogOpen"
      @published="fetchWorks"
    />

    <AssetDetailModal
      v-if="isAssetDetailOpen"
      :show="isAssetDetailOpen"
      :asset-id="selectedAssetId"
      @close="
        isAssetDetailOpen = false;
        selectedAssetId = null;
      "
      @update="fetchWorks"
      @edit="handleDetailEdit($event, 'asset')"
    />

    <MaterialDetailPanel
      v-if="selectedMaterial"
      :material="selectedMaterial"
      :loading="isMaterialLoading"
      :my-materials="[]"
      :is-admin="isAdmin"
      :can-edit="true"
      :can-download="true"
      :is-saving-review="false"
      @close="
        isMaterialDetailOpen = false;
        selectedMaterial = null;
      "
      @edit="handleDetailEdit($event, 'material')"
      @delete="handleDetailDelete($event, 'material')"
      @update="fetchWorks"
    />

    <PluginDetailModal
      v-if="isPluginDetailOpen"
      :show="isPluginDetailOpen"
      :plugin="selectedPlugin"
      :is-favorited="false"
      :is-downloading="isPluginLoading"
      :is-admin="isAdmin"
      :can-edit="true"
      :is-saving-review="false"
      @close="
        isPluginDetailOpen = false;
        selectedPlugin = null;
      "
      @edit="handleDetailEdit($event, 'plugin')"
      @delete="handleDetailDelete($event, 'plugin')"
      @update="fetchWorks"
    />

    <ShowcaseDetail
      v-if="isShowcaseDetailOpen"
      v-model:is-open="isShowcaseDetailOpen"
      v-model:item="selectedShowcase"
      :is-admin="isAdmin"
      :showcases="[]"
      @refresh-list="fetchWorks"
    />
  </div>
</template>

<style scoped>
.my-works-page {
  height: 100%;
  background: transparent !important;
  color: var(--text-primary);
}

.workspace-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
}
</style>
