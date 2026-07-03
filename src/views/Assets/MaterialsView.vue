<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import {
  CheckCircle2,
  Clock3,
  Grid3X3,
  Heart,
  Layers,
  LayoutList,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { formatCompactNumber, formatFileSize, parseTags, resolvePreviewUrl } from './resourceUtils';
import MaterialFiltersPanel from './components/MaterialFiltersPanel.vue';
import MaterialControlToolbar from './components/MaterialControlToolbar.vue';
import MaterialSignalsRow from './components/MaterialSignalsRow.vue';
import MaterialStateBar from './components/MaterialStateBar.vue';
import MaterialsGrid from './components/MaterialsGrid.vue';
import MaterialDetailPanel from './components/MaterialDetailPanel.vue';

const PublishWorkDialog = defineAsyncComponent(() => import('@/components/PublishWorkDialog.vue'));
const EditWorkDialog = defineAsyncComponent(() => import('./components/EditWorkDialog.vue'));
import Modal from '@/components/ui/Modal.vue';
import Input from '@/components/ui/Input.vue';
import { normalizeMaterialWork } from './myWorksModel';
import type { UnifiedWork } from './myWorksModel';
import MaterialLibraryHeader from './components/MaterialLibraryHeader.vue';
import { useLabel } from '@/utils/i18n';

type ViewMode = 'grid' | 'list';
type SortMode = 'latest' | 'popular' | 'favorited' | 'largest' | 'smallest';
type LibraryTab = 'explore' | 'favorites' | 'mine' | 'drafts';
type MaterialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type StatusFilter = 'all' | MaterialStatus;
type ProceduralFilter = 'all' | 'true' | 'false';

interface MaterialUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface MaterialItem {
  id: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: string | string[] | null;
  fileUrl?: string | null;
  previewUrl?: string | null;
  downloads?: number;
  fileSize?: number | null;
  resolution?: string | null;
  isProcedural?: boolean;
  createdAt?: string;
  updatedAt?: string;
  status?: MaterialStatus;
  rejectReason?: string | null;
  userId?: string;
  isFavorited?: boolean;
  _count?: { favorites?: number };
  user?: MaterialUser | null;
}

interface NormalizedMaterial extends Omit<
  MaterialItem,
  'title' | 'description' | 'category' | 'tags' | 'downloads' | 'fileSize' | 'resolution'
> {
  title: string;
  description: string;
  category: string;
  tags: string[];
  preview: string;
  downloads: number;
  fileSize: number;
  resolution: string;
  favorites: number;
}

interface MaterialInsights {
  summary: {
    total: number;
    downloads: number;
    favorites: number;
    myFavorites: number;
    myUploads: number;
    myPending?: number;
    myApproved?: number;
    myRejected?: number;
    pending: number;
    procedural: number;
    averageSize: number;
  };
  categories: { name: string; count: number; downloads: number }[];
  resolutions: { label: string; count: number }[];
  hotTags: { label: string; count: number }[];
  dailyUploads?: { date: string; count: number }[];
  topDownloads: MaterialItem[];
  latest: MaterialItem[];
}

const CATEGORY_ALL = 'all';
const defaultCategories = ['金属', '木纹', '石材', '织物', '程序化', '玻璃', '其他'];

const authStore = useAuthStore();
const systemStore = useSystemStore();
const route = useRoute();
const { locale } = useI18n();
const label = useLabel();
const categoryLabel = (name: string) => {
  const map: Record<string, string> = {
    金属: 'Metal',
    木纹: 'Wood',
    石材: 'Stone',
    织物: 'Fabric',
    程序化: 'Procedural',
    玻璃: 'Glass',
    其他: 'Other',
  };
  return locale.value === 'en-US' ? map[name] || name : name;
};
const searchQuery = ref('');
const activeTab = ref<LibraryTab>('explore');
const activeCategory = ref(CATEGORY_ALL);
const selectedResolution = ref(CATEGORY_ALL);
const selectedTag = ref(CATEGORY_ALL);
const selectedProcedural = ref<ProceduralFilter>('all');
const myStatusFilter = ref<StatusFilter>('all');
const sortBy = ref<SortMode>('latest');
const viewMode = ref<ViewMode>('grid');
const isStatsExpanded = ref(false);
const selectedIds = ref<string[]>([]);
const isFilterOpen = ref(false);
const isLoading = ref(false);
const isLoadingDetail = ref(false);

const isUploadDialogOpen = ref(false);
const isBulkBusy = ref(false);
const isSavingReview = ref(false);
const materials = ref<MaterialItem[]>([]);
const myMaterials = ref<MaterialItem[]>([]);
const insights = ref<MaterialInsights | null>(null);
const selectedMaterial = ref<NormalizedMaterial | null>(null);
const editingMaterial = ref<NormalizedMaterial | null>(null);
const searchTimer = ref<number | undefined>();
let consumedCreateQuery = false;

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

const materialForm = ref({
  title: '',
  description: '',
  category: '其他',
  resolution: '4K',
  tags: '',
  isProcedural: false,
  file: null as File | null,
  preview: null as File | null,
});

const currentUserId = computed(() => authStore.user?.id || '');
const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

const statCards = computed(() => [
  {
    label: label('全部材料', 'All Materials'),
    value: insights.value?.summary.total || materials.value.length,
    meta: label(
      `${formatCompactNumber(insights.value?.summary.downloads)} 次下载`,
      `${formatCompactNumber(insights.value?.summary.downloads)} downloads`,
    ),
    icon: Layers,
    tone: 'amber',
  },
  {
    label: label('收藏热度', 'Favorites'),
    value: insights.value?.summary.favorites || 0,
    meta: label(
      `我收藏 ${insights.value?.summary.myFavorites || 0}`,
      `Mine ${insights.value?.summary.myFavorites || 0}`,
    ),
    icon: Heart,
    tone: 'rose',
  },
  {
    label: label('我的材质', 'My Uploads'),
    value: insights.value?.summary.myUploads || myMaterials.value.length,
    meta: label(
      `${insights.value?.summary.myPending || 0} 待审 / ${insights.value?.summary.myApproved || 0} 通过`,
      `${insights.value?.summary.myPending || 0} pending / ${insights.value?.summary.myApproved || 0} approved`,
    ),
    icon: UploadCloud,
    tone: 'blue',
  },
  {
    label: label('程序化', 'Procedural'),
    value: insights.value?.summary.procedural || 0,
    meta: label(
      `均值 ${formatFileSize(insights.value?.summary.averageSize || 0, '0 MB')}`,
      `Avg ${formatFileSize(insights.value?.summary.averageSize || 0, '0 MB')}`,
    ),
    icon: ShieldCheck,
    tone: 'teal',
  },
]);

const libraryTabs = computed(() => [
  {
    key: 'explore' as const,
    label: label('资源广场', 'Explore'),
    count: insights.value?.summary.total || 0,
  },
  {
    key: 'favorites' as const,
    label: label('我的收藏', 'Favorites'),
    count: insights.value?.summary.myFavorites || 0,
  },
  {
    key: 'mine' as const,
    label: label('我的材质', 'My Uploads'),
    count: insights.value?.summary.myUploads || myMaterials.value.length,
  },
  {
    key: 'drafts' as const,
    label: label('草稿箱', 'Drafts'),
    count: insights.value?.summary.myPending || 0,
  },
]);

const libraryTabOptions = computed(() => {
  return libraryTabs.value.map((tab) => ({
    label: `${tab.label} ${tab.count}`,
    value: tab.key,
  }));
});

const viewModeOptions = computed(() => [
  { value: 'grid' as ViewMode, icon: Grid3X3 },
  { value: 'list' as ViewMode, icon: LayoutList },
]);

const categoryOptions = computed(() => {
  const configured = (systemStore.settings.MATERIAL_CATEGORIES || []).filter(
    (name) => name !== '全部' && name !== '全部材料' && name !== CATEGORY_ALL,
  );

  const dbCounts = new Map<string, { count: number; downloads: number }>();
  (insights.value?.categories || []).forEach((cat) => {
    dbCounts.set(cat.name, { count: cat.count, downloads: cat.downloads || 0 });
  });

  const combinedNames = Array.from(new Set([...configured, ...dbCounts.keys()]));

  return [
    {
      name: CATEGORY_ALL,
      label: label('全部', 'All'),
      count: insights.value?.summary.total || materials.value.length,
    },
    ...combinedNames.map((name) => {
      const db = dbCounts.get(name) || { count: 0, downloads: 0 };
      return {
        name,
        label: categoryLabel(name),
        count: db.count,
      };
    }),
  ];
});

const resolutionFilters = computed(() => [
  { label: label('全部', 'All'), value: CATEGORY_ALL, count: insights.value?.summary.total || 0 },
  ...(insights.value?.resolutions || []).map((resolution) => ({
    label: resolution.label,
    value: resolution.label,
    count: resolution.count,
  })),
]);

const categoryTabOptions = computed(() => {
  return categoryOptions.value.map((cat) => ({
    label: cat.label,
    value: cat.name,
    badge: cat.count,
  }));
});

const resolutionTabOptions = computed(() => {
  return resolutionFilters.value.map((res) => ({
    label: res.label,
    value: res.value,
    badge: res.count,
  }));
});

const proceduralTabOptions = computed(() => [
  { label: label('全部', 'All'), value: 'all' },
  { label: label('程序化', 'Procedural'), value: 'true' },
  { label: label('贴图包', 'Texture Pack'), value: 'false' },
]);

const statusTabOptions = computed(() => [
  { label: label('全部', 'All'), value: 'all' },
  { label: label('待审', 'Pending'), value: 'PENDING' },
  { label: label('通过', 'Approved'), value: 'APPROVED' },
  { label: label('驳回', 'Rejected'), value: 'REJECTED' },
]);

const uploadCategories = computed(() => {
  const names = categoryOptions.value
    .map((category) => category.name)
    .filter((name) => name !== CATEGORY_ALL);
  return names.length ? names : defaultCategories;
});

const normalizedMaterials = computed(() => materials.value.map(normalizeMaterial));
const normalizedMyMaterials = computed(() => myMaterials.value.map(normalizeMaterial).slice(0, 6));
const visibleMaterials = computed(() => normalizedMaterials.value);
const selectedIdSet = computed(() => new Set(selectedIds.value));
const selectedMaterials = computed(() =>
  visibleMaterials.value.filter((material) => selectedIdSet.value.has(material.id)),
);
const allVisibleSelected = computed(
  () =>
    visibleMaterials.value.length > 0 &&
    visibleMaterials.value.every((material) => selectedIdSet.value.has(material.id)),
);

const activeFilterLabels = computed(() => {
  const labels: { key: string; label: string }[] = [];
  if (activeCategory.value !== CATEGORY_ALL)
    labels.push({ key: 'category', label: activeCategory.value });
  if (selectedResolution.value !== CATEGORY_ALL)
    labels.push({ key: 'resolution', label: selectedResolution.value });
  if (selectedTag.value !== CATEGORY_ALL)
    labels.push({ key: 'tag', label: `#${selectedTag.value}` });
  if (selectedProcedural.value !== 'all') {
    labels.push({
      key: 'procedural',
      label:
        selectedProcedural.value === 'true'
          ? label('程序化', 'Procedural')
          : label('贴图包', 'Texture Pack'),
    });
  }
  if (activeTab.value === 'mine' && myStatusFilter.value !== 'all') {
    labels.push({ key: 'status', label: getStatusMeta(myStatusFilter.value).label });
  }
  if (searchQuery.value.trim()) labels.push({ key: 'search', label: searchQuery.value.trim() });
  return labels;
});

const emptyState = computed(() => {
  if (activeTab.value === 'favorites') {
    return {
      title: label('暂无收藏材料', 'No Favorite Materials'),
      body: label('收藏后的材料会集中在这里。', 'Favorited materials will appear here.'),
    };
  }
  if (activeTab.value === 'mine') {
    return {
      title: label('暂无提交记录', 'No Uploads Yet'),
      body: label(
        '上传一个材料包，审核状态会同步显示。',
        'Upload a material pack and review status will appear here.',
      ),
    };
  }
  return {
    title: label('没有匹配的材料', 'No Matching Materials'),
    body: label('换一组筛选条件试试。', 'Try a different set of filters.'),
  };
});

function normalizeMaterial(material: MaterialItem): NormalizedMaterial {
  const tags = parseTags(material.tags);
  return {
    ...material,
    title: material.title || label('未命名材料', 'Untitled Material'),
    description: material.description || '',
    category: categoryLabel(material.category || '其他'),
    resolution: material.resolution || label('未标注', 'Unlabeled'),
    preview: resolvePreviewUrl(material.previewUrl, 'STL'),
    tags,
    favorites: material._count?.favorites || 0,
    downloads: material.downloads || 0,
    fileSize: material.fileSize || 0,
    status: material.status || 'APPROVED',
  };
}

function parseMaterialListResponse(data: unknown): MaterialItem[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown[] }).items)) {
    return (data as { items: MaterialItem[] }).items;
  }
  return [];
}

function getStatusMeta(status?: string) {
  const statusMap = {
    APPROVED: { label: label('已通过', 'Approved'), tone: 'success', icon: CheckCircle2 },
    PENDING: { label: label('待审核', 'Pending'), tone: 'warning', icon: Clock3 },
    REJECTED: { label: label('已驳回', 'Rejected'), tone: 'danger', icon: XCircle },
  };
  return statusMap[(status || 'APPROVED') as MaterialStatus] || statusMap.APPROVED;
}

function isMaterialOwner(material: MaterialItem | NormalizedMaterial) {
  return Boolean(
    currentUserId.value &&
    (material.userId === currentUserId.value || material.user?.id === currentUserId.value),
  );
}

function canEditMaterial(material: MaterialItem | NormalizedMaterial) {
  return isAdmin.value || isMaterialOwner(material);
}

function canDownloadMaterial(material: MaterialItem | NormalizedMaterial) {
  return !material.status || material.status === 'APPROVED';
}

function getListParams() {
  return {
    category: activeCategory.value,
    sort: sortBy.value,
    search: searchQuery.value.trim() || undefined,
    resolution: selectedResolution.value,
    tag: selectedTag.value,
    procedural: selectedProcedural.value === 'all' ? undefined : selectedProcedural.value,
    favoritesOnly: activeTab.value === 'favorites' ? 'true' : undefined,
    favoriteCategory:
      activeTab.value === 'favorites' && selectedFavoriteCategory.value !== 'all'
        ? selectedFavoriteCategory.value
        : undefined,
    mine: activeTab.value === 'mine' || activeTab.value === 'drafts' ? 'true' : undefined,
    status:
      activeTab.value === 'drafts'
        ? 'PENDING'
        : activeTab.value === 'mine' && myStatusFilter.value !== 'all'
          ? myStatusFilter.value
          : undefined,
    limit: 120,
    paginated: 'true',
  };
}
async function fetchMaterials(silent = false) {
  if (!silent) isLoading.value = true;
  try {
    const { data } = await api.get('/api/materials', { params: getListParams() });
    materials.value = parseMaterialListResponse(data);
    const visibleIds = new Set(materials.value.map((material) => material.id));
    selectedIds.value = selectedIds.value.filter((id) => visibleIds.has(id));
  } catch (error) {
    if (!silent) {
      ElMessage.error(
        getApiErrorMessage(error, label('材料列表加载失败', 'Failed to load materials')),
      );
    }
  } finally {
    if (!silent) isLoading.value = false;
  }
}

async function fetchFavorites() {
  try {
    const { data } = await api.get('/api/materials/favorites');
    favoritedIds.value = data.ids || [];
    favoriteCategoriesList.value = data.categories || [];
  } catch (error) {
    logError(error, { operation: 'fetchMaterialFavorites', view: 'MaterialsView' });
  }
}

async function fetchMyMaterials() {
  try {
    const { data } = await api.get('/api/materials/my');
    myMaterials.value = data || [];
  } catch (error) {
    logError(error, { operation: 'fetchMyMaterials', view: 'MaterialsView' });
  }
}

async function fetchInsights() {
  try {
    const { data } = await api.get('/api/materials/insights');
    insights.value = data;
  } catch (error) {
    logError(error, { operation: 'fetchMaterialInsights', view: 'MaterialsView' });
  }
}

async function refreshWorkspace(silent = false) {
  await Promise.all([
    fetchMaterials(silent),
    fetchInsights(),
    fetchMyMaterials(),
    fetchFavorites(),
  ]);
  await applyRouteEntry();
}
function resetUploadForm() {
  materialForm.value = {
    title: '',
    description: '',
    category: uploadCategories.value[0] || '其他',
    resolution: '4K',
    tags: '',
    isProcedural: false,
    file: null,
    preview: null,
  };
}

function openCreateDialog() {
  editingMaterial.value = null;
  resetUploadForm();
  isUploadDialogOpen.value = true;
}

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

const materialCategories = computed(() =>
  (systemStore.settings.MATERIAL_CATEGORIES || []).filter(
    (name: string) => name !== '全部材料' && name !== '全部',
  ),
);

function openEditDialog(material: NormalizedMaterial) {
  closeDetail();
  const work = normalizeMaterialWork(material as any);
  selectedWork.value = work;
  const rawMaterial = work.raw as any;

  const fileUrl = rawMaterial.fileUrl || '';
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
    materialCategory: rawMaterial.category || '',
    resolution: rawMaterial.resolution || '4K',
    isProcedural: !!rawMaterial.isProcedural,
    pluginCategory: '',
    pluginVersion: '1.0.0',
    pluginCompatibility: '',
    showcaseType: 'IMAGE',
    videoUrl: '',
    originality: rawMaterial.originality || 'ORIGINAL',
    originalAuthor: rawMaterial.originalAuthor || '',
    originalLink: rawMaterial.originalLink || '',
    license: rawMaterial.license || 'CC_BY',
    isFree: rawMaterial.isFree !== false,
    meshType: 'LOW_POLY',
    uvUnwrapped: true,
    uvOverlapping: false,
    pbrChannels: [],
    rigged: false,
    gameReady: false,
    linkedCourseId: rawMaterial.linkedCourseId || '',
    linkedLessonId: rawMaterial.linkedLessonId || '',
    installGuide: '',
    file: null,
    packageFile: null,
    thumbnail: null,
    downloadType: isExternal ? 'external' : 'local',
    externalUrl: extUrl,
    extractionCode: extCode,
  };
  isEditDialogOpen.value = true;
}

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
    ElMessage.success(label('保存成功', 'Saved successfully'));
    isEditDialogOpen.value = false;
    fetchMaterials();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('保存失败', 'Save failed')));
  } finally {
    isSaving.value = false;
  }
};

async function openDetail(material: MaterialItem | NormalizedMaterial) {
  selectedMaterial.value = normalizeMaterial(material);
  isLoadingDetail.value = true;
  try {
    const { data } = await api.get(`/api/materials/${material.id}`);
    selectedMaterial.value = normalizeMaterial(data);
  } catch (error) {
    logError(error, { operation: 'fetchMaterialDetail', view: 'MaterialsView' });
  } finally {
    isLoadingDetail.value = false;
  }
}

function getRouteMaterialId() {
  const material = route.query.material;
  return typeof material === 'string' ? material : '';
}

async function applyRouteEntry() {
  if (route.query.create !== '1') {
    consumedCreateQuery = false;
  } else if (!consumedCreateQuery) {
    consumedCreateQuery = true;
    openCreateDialog();
  }

  const materialId = getRouteMaterialId();
  if (!materialId || selectedMaterial.value?.id === materialId) return;
  const existing = [...materials.value, ...myMaterials.value].find(
    (material) => material.id === materialId,
  );
  await openDetail(existing || { id: materialId, title: '' });
}

function closeDetail() {
  selectedMaterial.value = null;
}

function mutateMaterial(id: string, updater: (material: MaterialItem) => void) {
  materials.value.forEach((material) => {
    if (material.id === id) updater(material);
  });
  myMaterials.value.forEach((material) => {
    if (material.id === id) updater(material);
  });
}

function applyFavoriteState(id: string, isFavorited: boolean) {
  const updateFavorite = (material: MaterialItem) => {
    const wasFavorited = Boolean(material.isFavorited);
    material.isFavorited = isFavorited;
    if (wasFavorited !== isFavorited) {
      material._count = {
        favorites: Math.max(0, (material._count?.favorites || 0) + (isFavorited ? 1 : -1)),
      };
    }
  };

  mutateMaterial(id, updateFavorite);
  if (selectedMaterial.value?.id === id) {
    const wasFavorited = Boolean(selectedMaterial.value.isFavorited);
    selectedMaterial.value.isFavorited = isFavorited;
    if (wasFavorited !== isFavorited) {
      selectedMaterial.value.favorites = Math.max(
        0,
        selectedMaterial.value.favorites + (isFavorited ? 1 : -1),
      );
      selectedMaterial.value._count = { favorites: selectedMaterial.value.favorites };
    }
  }
}

async function toggleFavorite(material: MaterialItem | NormalizedMaterial, event?: Event) {
  event?.stopPropagation();
  try {
    const isFav = favoritedIds.value.includes(material.id);
    let category = '默认';

    if (!isFav && selectedFavoriteCategory.value !== 'all') {
      category = selectedFavoriteCategory.value;
    }

    const { data } = await api.post(`/api/materials/${material.id}/favorite`, {
      category,
    });

    applyFavoriteState(material.id, data.isFavorited);

    if (data.isFavorited) {
      if (!favoritedIds.value.includes(material.id)) favoritedIds.value.push(material.id);
    } else {
      favoritedIds.value = favoritedIds.value.filter((id) => id !== material.id);
    }

    ElMessage.success(
      data.isFavorited
        ? label('已加入收藏', 'Added to favorites')
        : label('已取消收藏', 'Favorite removed'),
    );

    await fetchInsights();
    await fetchFavorites();
    if (activeTab.value === 'favorites') {
      await fetchMaterials();
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('收藏失败', 'Favorite failed')));
  }
}

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
      await api.post('/api/materials/favorites/categories', {
        category: val,
      });
      ElMessage.success(label('分类创建成功', 'Category created successfully'));
      selectedFavoriteCategory.value = val;
      showCategoryModal.value = false;
      await fetchFavorites();
      await fetchMaterials();
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
      await api.put('/api/materials/favorites/categories', {
        oldCategory: categoryModalOldValue.value,
        newCategory: val,
      });
      ElMessage.success(label('分类重命名成功', 'Category renamed successfully'));
      if (selectedFavoriteCategory.value === categoryModalOldValue.value) {
        selectedFavoriteCategory.value = val;
      }
      showCategoryModal.value = false;
      await fetchFavorites();
      await fetchMaterials();
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, label('重命名失败', 'Rename failed')));
    }
  }
};

const handleDeleteFavoriteCategory = async (cat: string) => {
  try {
    await ElMessageBox.confirm(
      label(
        `确认删除收藏夹分类「${cat}」？此操作将取消该分类下所有材料的收藏。`,
        `Delete favorite folder "${cat}"? This will remove all favorites inside this folder.`,
      ),
      label('删除分类', 'Delete Category'),
      {
        confirmButtonText: label('删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    await api.delete(`/api/materials/favorites/categories/${encodeURIComponent(cat)}`);

    ElMessage.success(label('分类删除成功', 'Category deleted successfully'));
    if (selectedFavoriteCategory.value === cat) {
      selectedFavoriteCategory.value = 'all';
    }
    await fetchFavorites();
    await fetchMaterials();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
    }
  }
};

function incrementDownloadCount(id: string) {
  const updateDownload = (material: MaterialItem) => {
    material.downloads = (material.downloads || 0) + 1;
  };
  mutateMaterial(id, updateDownload);
  if (selectedMaterial.value?.id === id) {
    selectedMaterial.value.downloads += 1;
  }
}

async function handleDownload(material: MaterialItem | NormalizedMaterial, event?: Event) {
  event?.stopPropagation();
  if (!canDownloadMaterial(material)) {
    ElMessage.warning(
      label('该材料审核通过后才能下载', 'This material can be downloaded after approval'),
    );
    return;
  }

  try {
    await api.post(`/api/materials/${material.id}/download`);
    const response = await api.get(`/api/materials/${material.id}/file`, {
      responseType: 'blob',
    });
    const ext = material.fileUrl?.split('.').pop() || 'zip';
    const safeTitle = (material.title || 'material').replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    incrementDownloadCount(material.id);
    await fetchInsights();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('下载失败', 'Download failed')));
  }
}

function toggleSelect(materialId: string, event?: Event) {
  event?.stopPropagation();
  if (selectedIdSet.value.has(materialId)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== materialId);
  } else {
    selectedIds.value = [...selectedIds.value, materialId];
  }
}

function toggleSelectAllVisible() {
  if (allVisibleSelected.value) {
    selectedIds.value = [];
    return;
  }
  selectedIds.value = visibleMaterials.value.map((material) => material.id);
}

async function bulkFavorite(favorite: boolean) {
  if (!selectedIds.value.length) return;
  try {
    isBulkBusy.value = true;
    const { data } = await api.post('/api/materials/bulk/favorite', {
      ids: selectedIds.value,
      favorite,
    });
    (data.ids || selectedIds.value).forEach((id: string) => applyFavoriteState(id, favorite));
    selectedIds.value = [];
    await Promise.all([
      fetchInsights(),
      activeTab.value === 'favorites' ? fetchMaterials() : Promise.resolve(),
    ]);
    ElMessage.success(
      favorite
        ? label('已加入收藏', 'Added to favorites')
        : label('已移出收藏', 'Removed from favorites'),
    );
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('批量操作失败', 'Bulk operation failed')));
  } finally {
    isBulkBusy.value = false;
  }
}

async function bulkDeleteMaterials() {
  if (!selectedIds.value.length) return;

  try {
    await ElMessageBox.confirm(
      label(
        `确定要物理删除选中的 ${selectedIds.value.length} 个材质/草稿吗？关联文件也将被同步清除，此操作不可撤销！`,
        `Are you sure you want to delete ${selectedIds.value.length} selected materials? Associated files will also be deleted!`,
      ),
      label('批量删除确认', 'Confirm Bulk Delete'),
      {
        confirmButtonText: label('确定删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    isBulkBusy.value = true;
    const ids = [...selectedIds.value];
    await api.post('/api/materials/bulk-delete', { ids });

    ElMessage.success(label(`成功删除 ${ids.length} 个材质`, `Successfully deleted ${ids.length} materials`));
    selectedIds.value = [];
    await Promise.all([fetchMaterials(), fetchInsights()]);
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('批量删除失败', 'Failed to bulk delete materials')));
    }
  } finally {
    isBulkBusy.value = false;
  }
}

async function downloadSelected() {
  const downloadable = selectedMaterials.value.filter(canDownloadMaterial);
  if (!downloadable.length) {
    ElMessage.warning(
      label('没有可下载的已通过材料', 'No approved materials are available to download'),
    );
    return;
  }
  for (const material of downloadable) {
    await handleDownload(material);
  }
}
async function deleteMaterial(material: NormalizedMaterial) {
  try {
    await ElMessageBox.confirm(
      label(`确认删除「${material.title}」？`, `Delete "${material.title}"?`),
      label('删除材料', 'Delete Material'),
      {
        confirmButtonText: label('删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
        type: 'warning',
      },
    );

    const oldMaterials = [...materials.value];
    const oldMyMaterials = [...myMaterials.value];

    materials.value = materials.value.filter((x) => x.id !== material.id);
    myMaterials.value = myMaterials.value.filter((x) => x.id !== material.id);

    ElMessage.success(label('材料已删除', 'Material deleted'));
    closeDetail();

    api
      .delete(`/api/materials/${material.id}`)
      .then(() => {
        refreshWorkspace(true);
      })
      .catch((error) => {
        materials.value = oldMaterials;
        myMaterials.value = oldMyMaterials;
        ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
      });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
    }
  }
}
async function reviewMaterial(material: NormalizedMaterial, status: MaterialStatus) {
  try {
    let rejectReason: string | undefined;
    if (status === 'REJECTED') {
      const { value } = await ElMessageBox.prompt(
        label('驳回原因', 'Rejection Reason'),
        label(`审核「${material.title}」`, `Review "${material.title}"`),
        {
          inputValue:
            material.rejectReason ||
            label(
              '预览图、说明或授权信息需要补充。',
              'Preview, description, or license details need more information.',
            ),
          confirmButtonText: label('驳回', 'Reject'),
          cancelButtonText: label('取消', 'Cancel'),
        },
      );
      rejectReason = value;
    } else {
      await ElMessageBox.confirm(
        label(`确认通过「${material.title}」？`, `Approve "${material.title}"?`),
        label('审核材料', 'Review Material'),
        {
          confirmButtonText: label('通过', 'Approve'),
          cancelButtonText: label('取消', 'Cancel'),
          type: 'success',
        },
      );
    }

    isSavingReview.value = true;
    const { data } = await api.patch(`/api/materials/${material.id}/status`, {
      status,
      rejectReason,
    });
    selectedMaterial.value = normalizeMaterial(data);
    ElMessage.success(
      status === 'APPROVED'
        ? label('材料已通过审核', 'Material approved')
        : label('材料已驳回', 'Material rejected'),
    );
    await refreshWorkspace();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('审核失败', 'Review failed')));
    }
  } finally {
    isSavingReview.value = false;
  }
}

const activeFilterChips = computed(() => {
  const chips: Array<{ key: string; label: string }> = [];

  if (activeCategory.value !== CATEGORY_ALL) {
    chips.push({
      key: 'category',
      label: label(`分类: ${activeCategory.value}`, `Category: ${activeCategory.value}`),
    });
  }
  if (selectedResolution.value !== CATEGORY_ALL) {
    chips.push({
      key: 'resolution',
      label: label(
        `分辨率: ${selectedResolution.value}`,
        `Resolution: ${selectedResolution.value}`,
      ),
    });
  }
  if (selectedTag.value !== CATEGORY_ALL) {
    chips.push({
      key: 'tag',
      label: label(`标签: ${selectedTag.value}`, `Tag: ${selectedTag.value}`),
    });
  }
  if (selectedProcedural.value !== 'all') {
    chips.push({
      key: 'procedural',
      label:
        selectedProcedural.value === 'true'
          ? label('程序纹理: 是', 'Procedural: Yes')
          : label('程序纹理: 否', 'Procedural: No'),
    });
  }
  if (activeTab.value === 'mine' && myStatusFilter.value !== 'all') {
    const statusLabels: Record<string, string> = {
      PENDING: label('待审核', 'Pending'),
      APPROVED: label('已发布', 'Approved'),
      REJECTED: label('未通过', 'Rejected'),
    };
    chips.push({
      key: 'status',
      label: label(
        `状态: ${statusLabels[myStatusFilter.value]}`,
        `Status: ${statusLabels[myStatusFilter.value]}`,
      ),
    });
  }
  if (activeTab.value === 'favorites' && selectedFavoriteCategory.value !== 'all') {
    chips.push({
      key: 'favoriteCategory',
      label: label(
        `收藏分类: ${selectedFavoriteCategory.value}`,
        `Folder: ${selectedFavoriteCategory.value}`,
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

function clearFilter(key: string) {
  if (key === 'category') activeCategory.value = CATEGORY_ALL;
  if (key === 'resolution') selectedResolution.value = CATEGORY_ALL;
  if (key === 'tag') selectedTag.value = CATEGORY_ALL;
  if (key === 'procedural') selectedProcedural.value = 'all';
  if (key === 'status') myStatusFilter.value = 'all';
  if (key === 'favoriteCategory') selectedFavoriteCategory.value = 'all';
  if (key === 'search') searchQuery.value = '';
}

function resetFilters() {
  activeCategory.value = CATEGORY_ALL;
  selectedResolution.value = CATEGORY_ALL;
  selectedTag.value = CATEGORY_ALL;
  selectedProcedural.value = 'all';
  myStatusFilter.value = 'all';
  selectedFavoriteCategory.value = 'all';
  searchQuery.value = '';
}

watch(activeTab, () => {
  selectedFavoriteCategory.value = 'all';
});

watch(
  [
    activeTab,
    activeCategory,
    selectedResolution,
    selectedTag,
    selectedProcedural,
    myStatusFilter,
    selectedFavoriteCategory,
    sortBy,
  ],
  () => {
    selectedIds.value = [];
    fetchMaterials();
  },
);

watch(
  () => [route.query.material, route.query.create],
  () => {
    applyRouteEntry();
  },
);

watch(searchQuery, () => {
  if (searchTimer.value) window.clearTimeout(searchTimer.value);
  searchTimer.value = window.setTimeout(() => {
    selectedIds.value = [];
    fetchMaterials();
  }, 320);
});

onMounted(() => {
  systemStore.fetchSettings();
  resetUploadForm();
  refreshWorkspace();
});

onUnmounted(() => {
  if (searchTimer.value) window.clearTimeout(searchTimer.value);
});
</script>

<template>
  <div class="materials-page mobile-adaptive flex flex-col h-full overflow-hidden">
    <MaterialLibraryHeader
      v-model:search-query="searchQuery"
      :is-stats-expanded="isStatsExpanded"
      @toggle-stats="isStatsExpanded = !isStatsExpanded"
      @show-favorites="activeTab = 'favorites'"
      @upload="openCreateDialog"
    />

    <div class="flex-1 overflow-y-auto p-4 pt-2.5 flex flex-col gap-3">
      <div v-show="isStatsExpanded" class="metric-strip">
        <article
          v-for="stat in statCards"
          :key="stat.label"
          class="metric-tile"
          :data-tone="stat.tone"
        >
          <component :is="stat.icon" class="icon-sm" />
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
          <small>{{ stat.meta }}</small>
        </article>
      </div>

      <div class="workspace-shell">
        <MaterialFiltersPanel
          :is-open="isFilterOpen"
          :active-tab="activeTab"
          :active-category="activeCategory"
          :selected-resolution="selectedResolution"
          :selected-tag="selectedTag"
          :selected-procedural="selectedProcedural"
          :my-status-filter="myStatusFilter"
          :category-options="categoryTabOptions"
          :resolution-options="resolutionTabOptions"
          :procedural-options="proceduralTabOptions"
          :status-options="statusTabOptions"
          :hot-tags="insights?.hotTags || []"
          :favorite-categories="favoriteCategoriesList"
          :selected-favorite-category="selectedFavoriteCategory"
          @update:category="activeCategory = $event"
          @update:resolution="selectedResolution = $event"
          @update:tag="selectedTag = $event"
          @update:procedural="selectedProcedural = $event"
          @update:status="myStatusFilter = $event"
          @update:selected-favorite-category="selectedFavoriteCategory = $event"
          @rename-category="handleRenameFavoriteCategory"
          @delete-category="handleDeleteFavoriteCategory"
          @create-category="handleCreateFavoriteCategory"
        />

        <main class="content-panel">
          <MaterialControlToolbar
            v-model:active-tab="activeTab"
            v-model:sort-by="sortBy"
            v-model:view-mode="viewMode"
            :library-tab-options="libraryTabOptions"
            :view-mode-options="viewModeOptions"
            :is-filter-open="isFilterOpen"
            @toggle-filter="isFilterOpen = !isFilterOpen"
          />

          <MaterialSignalsRow
            v-show="isStatsExpanded"
            :top-downloads="insights?.topDownloads || []"
            :latest-uploads="insights?.latest || []"
            @open-detail="openDetail"
          />

          <MaterialStateBar
            :active-filter-labels="activeFilterLabels"
            :selected-count="selectedIds.length"
            :all-visible-selected="allVisibleSelected"
            :is-bulk-busy="isBulkBusy"
            :active-tab="activeTab"
            @clear-filter="clearFilter"
            @reset-filters="resetFilters"
            @toggle-select-all="toggleSelectAllVisible"
            @bulk-favorite="bulkFavorite"
            @download-selected="downloadSelected"
            @bulk-delete="bulkDeleteMaterials"
          />

          <section class="workbench" :class="{ 'with-detail': selectedMaterial }">
            <MaterialsGrid
              :is-loading="isLoading"
              :view-mode="viewMode"
              :materials="visibleMaterials"
              :selected-ids="selectedIds"
              :active-tab="activeTab"
              :empty-title="emptyState.title"
              :empty-body="emptyState.body"
              :active-filter-chips="activeFilterChips"
              :total-count="insights?.summary.total || visibleMaterials.length"
              @open-detail="openDetail"
              @toggle-select="toggleSelect"
              @toggle-favorite="toggleFavorite"
              @download="handleDownload"
              @create="openCreateDialog"
              @clear-filter="clearFilter"
              @reset-filters="resetFilters"
            />

            <MaterialDetailPanel
              v-if="selectedMaterial"
              :material="selectedMaterial"
              :loading="isLoadingDetail"
              :my-materials="normalizedMyMaterials"
              :is-admin="isAdmin"
              :can-edit="canEditMaterial(selectedMaterial)"
              :can-download="canDownloadMaterial(selectedMaterial)"
              :is-saving-review="isSavingReview"
              @close="closeDetail"
              @favorite="toggleFavorite(selectedMaterial)"
              @download="handleDownload(selectedMaterial)"
              @edit="openEditDialog"
              @select="openDetail"
              @delete="deleteMaterial(selectedMaterial)"
              @review-approved="reviewMaterial(selectedMaterial, 'APPROVED')"
              @review-rejected="reviewMaterial(selectedMaterial, 'REJECTED')"
            />
          </section>
        </main>
      </div>
    </div>

    <PublishWorkDialog
      v-if="isUploadDialogOpen"
      v-model="isUploadDialogOpen"
      default-category="material"
      @published="fetchMaterials"
    />

    <EditWorkDialog
      v-if="isEditDialogOpen"
      v-model:show="isEditDialogOpen"
      v-model:form="editForm"
      :work="selectedWork"
      :is-saving="isSaving"
      :asset-categories="[]"
      :material-categories="materialCategories"
      :plugin-categories="[]"
      @save="handleSaveEdit"
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
            placeholder="例如：金属材质、织物纹理"
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
.materials-page {
  height: 100%;
  background: transparent !important;
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
  opacity: 0.55;
}

.page-header,
.title-block,
.header-actions {
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
  flex: 0 0 auto;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #d97706;
  background: rgba(217, 119, 6, 0.12);
}

.title-block h1 {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.title-block p {
  margin-top: 1px;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.header-actions {
  gap: 8px;
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  min-width: 0;
}

.metric-tile {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
  min-height: 54px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 8px 12px;
  box-shadow: var(--shadow-card);
  transition: all 0.15s ease;
}

.metric-tile:hover {
  transform: translateY(-1.5px);
  border-color: var(--tone-color, #d97706);
  box-shadow: var(--shadow-card-hover);
}

.metric-tile svg {
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

.metric-tile span {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.metric-tile strong {
  margin-left: auto;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 700;
}

.metric-tile small {
  display: none;
}

.metric-tile[data-tone='amber'] {
  --tone-color: #d97706;
}
.metric-tile[data-tone='rose'] {
  --tone-color: #e11d48;
}
.metric-tile[data-tone='blue'] {
  --tone-color: #2563eb;
}
.metric-tile[data-tone='teal'] {
  --tone-color: #0f766e;
}

.primary-button,
.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border-base);
  transition: all 0.15s ease;
}

.icon-text {
  gap: 6px;
}

.primary-button {
  border-color: transparent;
  background: #d97706;
  color: #fff;
  box-shadow: 0 2px 4px rgba(217, 119, 6, 0.15);
}

.primary-button:hover {
  background: #c26702;
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

.icon-sm {
  width: 14px;
  height: 14px;
}

.workspace-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
}

.content-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.workbench {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.workbench.with-detail {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 350px);
  align-items: start;
}

@media (max-width: 980px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1080px) {
  .workbench.with-detail {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .metric-strip {
    grid-template-columns: 1fr;
  }
}
</style>
