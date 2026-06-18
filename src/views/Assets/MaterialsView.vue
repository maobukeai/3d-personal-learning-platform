<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import {
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileArchive,
  Grid3X3,
  Heart,
  Layers,
  LayoutList,
  Loader2,
  PackageCheck,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import UserAvatar from '@/components/UserAvatar.vue';
import FileDropZone from '@/components/FileDropZone.vue';
import Input from '@/components/ui/Input.vue';
import Tabs from '@/components/ui/Tabs.vue';
import UnifiedCard from '@/components/UnifiedCard.vue';
import {
  formatCompactNumber,
  formatDate,
  formatFileSize,
  formatRelativeTime,
  parseTags,
  resolvePreviewUrl,
} from './resourceUtils';

type ViewMode = 'grid' | 'list';
type SortMode = 'latest' | 'popular' | 'favorited' | 'largest' | 'smallest';
type LibraryTab = 'explore' | 'favorites' | 'mine';
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

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

const CATEGORY_ALL = 'all';
const defaultCategories = ['金属', '木纹', '石材', '织物', '程序化', '玻璃', '其他'];
const resolutionOptions = ['2K', '4K', '8K', '矢量', '程序化'];

const authStore = useAuthStore();
const systemStore = useSystemStore();
const route = useRoute();
const { locale } = useI18n();
const label = (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);
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
const isUploading = ref(false);
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
const isEditingMaterial = computed(() => !!editingMaterial.value);

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
    label: label('我的提交', 'My Uploads'),
    value: insights.value?.summary.myUploads || myMaterials.value.length,
    meta: label(
      `${insights.value?.summary.myPending || 0} 待审 / ${insights.value?.summary.myApproved || 0} 通过`,
      `${insights.value?.summary.myPending || 0} pending / ${insights.value?.summary.myApproved || 0} approved`,
    ),
    icon: PackageCheck,
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
    label: label('我的提交', 'My Uploads'),
    count: insights.value?.summary.myUploads || myMaterials.value.length,
  },
]);

const libraryTabOptions = computed(() => {
  return libraryTabs.value.map((tab) => ({
    label: `${tab.label} ${tab.count}`,
    value: tab.key,
  }));
});

const viewModeOptions = computed(() => [
  { value: 'grid', icon: Grid3X3 },
  { value: 'list', icon: LayoutList },
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

const canSubmitMaterial = computed(() => {
  const hasBasicInfo =
    Boolean(materialForm.value.title.trim()) && Boolean(materialForm.value.category);
  if (isEditingMaterial.value) return hasBasicInfo;
  return hasBasicInfo && Boolean(materialForm.value.file) && Boolean(materialForm.value.preview);
});

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
    mine: activeTab.value === 'mine' ? 'true' : undefined,
    status:
      activeTab.value === 'mine' && myStatusFilter.value !== 'all'
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

async function fetchMyMaterials() {
  try {
    const { data } = await api.get('/api/materials/my');
    myMaterials.value = data || [];
  } catch (error) {
    console.error('Failed to fetch my materials:', error);
  }
}

async function fetchInsights() {
  try {
    const { data } = await api.get('/api/materials/insights');
    insights.value = data;
  } catch (error) {
    console.error('Failed to fetch material insights:', error);
  }
}

async function refreshWorkspace(silent = false) {
  await Promise.all([fetchMaterials(silent), fetchInsights(), fetchMyMaterials()]);
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

function openEditDialog(material: NormalizedMaterial) {
  editingMaterial.value = material;
  materialForm.value = {
    title: material.title,
    description: material.description,
    category: material.category,
    resolution: material.resolution,
    tags: material.tags.join(', '),
    isProcedural: Boolean(material.isProcedural),
    file: null,
    preview: null,
  };
  isUploadDialogOpen.value = true;
}

function closeMaterialDialog() {
  isUploadDialogOpen.value = false;
  editingMaterial.value = null;
}

function handleFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  materialForm.value.file = file;
  if (!materialForm.value.title.trim()) {
    materialForm.value.title = file.name.replace(/\.[^.]+$/, '');
  }
}

function handlePreviewChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) materialForm.value.preview = file;
}

async function submitMaterial() {
  if (!canSubmitMaterial.value) {
    ElMessage.warning(
      isEditingMaterial.value
        ? label('请补全材料名称和分类', 'Please complete material name and category')
        : label(
            '请补全材料文件、预览图、名称和分类',
            'Please complete material file, preview, name, and category',
          ),
    );
    return;
  }

  try {
    isUploading.value = true;
    if (editingMaterial.value) {
      const payload = {
        title: materialForm.value.title.trim(),
        description: materialForm.value.description,
        category: materialForm.value.category,
        resolution: materialForm.value.resolution,
        tags: materialForm.value.tags,
        isProcedural: materialForm.value.isProcedural,
      };
      const { data } = await api.put(`/api/materials/${editingMaterial.value.id}`, payload);
      selectedMaterial.value = normalizeMaterial(data);
      ElMessage.success(label('材料信息已更新', 'Material updated'));
    } else {
      const formData = new FormData();
      formData.append('material', materialForm.value.file as File);
      formData.append('preview', materialForm.value.preview as File);
      formData.append('title', materialForm.value.title.trim());
      formData.append('description', materialForm.value.description);
      formData.append('category', materialForm.value.category);
      formData.append('resolution', materialForm.value.resolution);
      formData.append('tags', materialForm.value.tags);
      formData.append('isProcedural', String(materialForm.value.isProcedural));
      await api.post('/api/materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      ElMessage.success(label('材料已提交审核', 'Material submitted for review'));
      activeTab.value = 'mine';
    }
    closeMaterialDialog();
    resetUploadForm();
    await refreshWorkspace();
  } catch (error) {
    ElMessage.error(
      getApiErrorMessage(
        error,
        isEditingMaterial.value
          ? label('更新失败', 'Update failed')
          : label('上传失败', 'Upload failed'),
      ),
    );
  } finally {
    isUploading.value = false;
  }
}

async function openDetail(material: MaterialItem | NormalizedMaterial) {
  selectedMaterial.value = normalizeMaterial(material);
  isLoadingDetail.value = true;
  try {
    const { data } = await api.get(`/api/materials/${material.id}`);
    selectedMaterial.value = normalizeMaterial(data);
  } catch (error) {
    console.error('Failed to fetch material detail:', error);
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
    const { data } = await api.post(`/api/materials/${material.id}/favorite`);
    applyFavoriteState(material.id, data.isFavorited);
    await fetchInsights();
    if (activeTab.value === 'favorites' && !data.isFavorited) {
      await fetchMaterials();
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('收藏失败', 'Favorite failed')));
  }
}

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

    // 备份当前状态以备失败恢复
    const oldMaterials = [...materials.value];
    const oldMyMaterials = [...myMaterials.value];

    // 乐观更新：立刻在前端移除被删除材质
    materials.value = materials.value.filter((x) => x.id !== material.id);
    myMaterials.value = myMaterials.value.filter((x) => x.id !== material.id);

    // 立刻提示已删除，关闭详情面板
    ElMessage.success(label('材料已删除', 'Material deleted'));
    closeDetail();

    // 后台异步执行请求并在成功后静默拉取更新，失败后恢复界面
    api.delete(`/api/materials/${material.id}`)
      .then(() => {
        refreshWorkspace(true);
      })
      .catch((error) => {
        // 恢复数据
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

function clearFilter(key: string) {
  if (key === 'category') activeCategory.value = CATEGORY_ALL;
  if (key === 'resolution') selectedResolution.value = CATEGORY_ALL;
  if (key === 'tag') selectedTag.value = CATEGORY_ALL;
  if (key === 'procedural') selectedProcedural.value = 'all';
  if (key === 'status') myStatusFilter.value = 'all';
  if (key === 'search') searchQuery.value = '';
}

function resetFilters() {
  activeCategory.value = CATEGORY_ALL;
  selectedResolution.value = CATEGORY_ALL;
  selectedTag.value = CATEGORY_ALL;
  selectedProcedural.value = 'all';
  myStatusFilter.value = 'all';
  searchQuery.value = '';
}

watch(
  [
    activeTab,
    activeCategory,
    selectedResolution,
    selectedTag,
    selectedProcedural,
    myStatusFilter,
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
  <div class="materials-page">
    <header class="page-header">
      <div class="title-block">
        <div class="title-icon">
          <Layers class="icon-sm" />
        </div>
        <div>
          <h1>{{ label('材质库', 'Material Library') }}</h1>
          <p>
            {{
              label(
                'PBR 贴图、程序化材质、纹理包',
                'PBR maps, procedural materials, and texture packs',
              )
            }}
          </p>
        </div>
      </div>
      <div class="header-actions">
        <button
          type="button"
          class="ghost-button icon-text"
          @click="isStatsExpanded = !isStatsExpanded"
        >
          <component :is="isStatsExpanded ? EyeOff : Eye" class="icon-sm" />
          {{ isStatsExpanded ? label('收起指标', 'Hide Stats') : label('数据指标', 'Show Stats') }}
        </button>
        <button type="button" class="ghost-button icon-text" @click="activeTab = 'favorites'">
          <Heart class="icon-sm" />
          {{ label('收藏', 'Favorites') }}
        </button>
        <button type="button" class="primary-button icon-text" @click="openCreateDialog">
          <UploadCloud class="icon-sm" />
          {{ label('上传', 'Upload') }}
        </button>
      </div>
    </header>

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
      <aside class="filter-panel" :class="{ open: isFilterOpen }">
        <div class="panel-section">
          <div class="section-title">
            <Layers class="icon-sm" />
            {{ label('分类', 'Categories') }}
          </div>
          <Tabs
            v-model="activeCategory"
            :options="categoryTabOptions"
            direction="vertical"
            size="sm"
          />
        </div>

        <div class="panel-section">
          <div class="section-title">
            <PackageCheck class="icon-sm" />
            {{ label('分辨率', 'Resolution') }}
          </div>
          <Tabs
            v-model="selectedResolution"
            :options="resolutionTabOptions"
            direction="vertical"
            size="sm"
          />
        </div>

        <div class="panel-section">
          <div class="section-title">
            <Tags class="icon-sm" />
            {{ label('类型', 'Type') }}
          </div>
          <Tabs
            v-model="selectedProcedural"
            :options="proceduralTabOptions"
            direction="vertical"
            size="sm"
          />
        </div>

        <div v-if="insights?.hotTags?.length" class="panel-section">
          <div class="section-title">
            <Tags class="icon-sm" />
            {{ label('热标签', 'Hot Tags') }}
          </div>
          <div class="tag-cloud">
            <button
              type="button"
              :class="{ active: selectedTag === 'all' }"
              @click="selectedTag = 'all'"
            >
              {{ label('全部', 'All') }}
            </button>
            <button
              v-for="tag in insights.hotTags"
              :key="tag.label"
              type="button"
              :class="{ active: selectedTag === tag.label }"
              @click="selectedTag = tag.label"
            >
              {{ tag.label }}
            </button>
          </div>
        </div>

        <div v-if="activeTab === 'mine'" class="panel-section">
          <div class="section-title">
            <SlidersHorizontal class="icon-sm" />
            {{ label('状态', 'Status') }}
          </div>
          <Tabs
            v-model="myStatusFilter"
            :options="statusTabOptions"
            direction="vertical"
            size="sm"
          />
        </div>
      </aside>

      <main class="content-panel">
        <section class="control-bar">
          <div class="toolbar-left">
            <Tabs v-model="activeTab" :options="libraryTabOptions" size="sm" />
          </div>

          <div class="toolbar-center">
            <Input
              v-model="searchQuery"
              type="search"
              :placeholder="label('搜索名称、标签、说明', 'Search name, tags, or description')"
              :icon="Search"
              clearable
              input-class="!py-1.5 !h-8.5 !rounded-lg"
              class="w-full max-w-[280px]"
            />
          </div>

          <div class="toolbar-right">
            <button
              type="button"
              class="icon-button mobile-filter"
              @click="isFilterOpen = !isFilterOpen"
            >
              <SlidersHorizontal class="icon-sm" />
            </button>
            <select v-model="sortBy" class="select-field" aria-label="排序方式">
              <option value="latest">{{ label('最新', 'Newest') }}</option>
              <option value="popular">{{ label('下载', 'Downloads') }}</option>
              <option value="favorited">{{ label('收藏', 'Favorites') }}</option>
              <option value="largest">{{ label('体积大', 'Largest') }}</option>
              <option value="smallest">{{ label('体积小', 'Smallest') }}</option>
            </select>
            <Tabs v-model="viewMode" :options="viewModeOptions" size="sm" />
          </div>
        </section>

        <section v-show="isStatsExpanded" class="signal-row">
          <div class="signal-panel">
            <header>
              <Download class="icon-sm" />
              <span>{{ label('热门下载', 'Top Downloads') }}</span>
            </header>
            <div class="mini-list">
              <button
                v-for="material in insights?.topDownloads?.slice(0, 3) || []"
                :key="material.id"
                type="button"
                class="mini-material"
                @click="openDetail(material)"
              >
                <img
                  :src="resolvePreviewUrl(material.previewUrl, 'STL')"
                  :alt="material.title || ''"
                />
                <span>{{ material.title }}</span>
                <strong>{{ formatCompactNumber(material.downloads) }}</strong>
              </button>
            </div>
          </div>

          <div class="signal-panel">
            <header>
              <Clock3 class="icon-sm" />
              <span>{{ label('最近上传', 'Recent Uploads') }}</span>
            </header>
            <div class="mini-list">
              <button
                v-for="material in insights?.latest?.slice(0, 3) || []"
                :key="material.id"
                type="button"
                class="mini-material"
                @click="openDetail(material)"
              >
                <img
                  :src="resolvePreviewUrl(material.previewUrl, 'STL')"
                  :alt="material.title || ''"
                />
                <span>{{ material.title }}</span>
                <small>{{ formatRelativeTime(material.createdAt) }}</small>
              </button>
            </div>
          </div>
        </section>

        <section v-if="activeFilterLabels.length || selectedIds.length" class="state-bar">
          <button
            type="button"
            class="select-all"
            :class="{ active: allVisibleSelected }"
            @click="toggleSelectAllVisible"
          >
            {{
              allVisibleSelected
                ? label('取消全选', 'Clear Selection')
                : label('选择当前页', 'Select Page')
            }}
          </button>

          <div class="active-filters">
            <button
              v-for="filter in activeFilterLabels"
              :key="filter.key"
              type="button"
              @click="clearFilter(filter.key)"
            >
              {{ filter.label }}
              <X class="icon-xs" />
            </button>
            <button
              v-if="activeFilterLabels.length > 1"
              type="button"
              class="clear-filter"
              @click="resetFilters"
            >
              {{ label('清空', 'Clear') }}
            </button>
          </div>

          <div v-if="selectedIds.length" class="bulk-actions">
            <span>{{ selectedIds.length }} {{ label('项', 'selected') }}</span>
            <button
              type="button"
              class="ghost-button compact-button"
              :disabled="isBulkBusy"
              @click="bulkFavorite(true)"
            >
              <Heart class="icon-sm" />
              {{ label('收藏', 'Favorite') }}
            </button>
            <button
              v-if="activeTab === 'favorites'"
              type="button"
              class="ghost-button compact-button"
              :disabled="isBulkBusy"
              @click="bulkFavorite(false)"
            >
              <X class="icon-sm" />
              {{ label('移出', 'Remove') }}
            </button>
            <button type="button" class="primary-button compact-button" @click="downloadSelected">
              <Download class="icon-sm" />
              {{ label('下载', 'Download') }}
            </button>
          </div>
        </section>

        <section class="workbench" :class="{ 'with-detail': selectedMaterial }">
          <main class="asset-area">
            <div v-if="isLoading" class="material-grid" :class="viewMode">
              <article v-for="index in 12" :key="index" class="material-card skeleton-card">
                <div class="skeleton preview"></div>
                <div class="skeleton line wide"></div>
                <div class="skeleton line"></div>
              </article>
            </div>

            <div v-else-if="visibleMaterials.length" class="material-grid" :class="viewMode">
              <UnifiedCard
                v-for="material in visibleMaterials"
                :key="material.id"
                :item="material"
                kind="material"
                :view-mode="viewMode"
                :is-selected="selectedIdSet.has(material.id)"
                :is-favorited="material.isFavorited"
                :active-tab="activeTab"
                @click="openDetail(material)"
                @select="(item, event) => toggleSelect(material.id, event)"
                @like="(item, event) => toggleFavorite(material, event)"
                @download="(item, event) => handleDownload(material, event)"
              />
            </div>

            <div v-else class="empty-state">
              <Sparkles class="empty-icon" />
              <h2>{{ emptyState.title }}</h2>
              <p>{{ emptyState.body }}</p>
              <button type="button" class="primary-button icon-text" @click="openCreateDialog">
                <UploadCloud class="icon-sm" />
                {{ label('上传材质', 'Upload Material') }}
              </button>
            </div>
          </main>

          <aside v-if="selectedMaterial" class="detail-drawer">
            <button type="button" class="close-button" @click="closeDetail">
              <X class="icon-sm" />
            </button>

            <div v-if="isLoadingDetail" class="drawer-loading">
              <Loader2 class="spinning" />
            </div>

            <template v-else>
              <div class="drawer-preview">
                <img :src="selectedMaterial.preview" :alt="selectedMaterial.title" />
                <div class="drawer-badges">
                  <span>{{ selectedMaterial.category }}</span>
                  <span>{{ selectedMaterial.resolution }}</span>
                  <span v-if="selectedMaterial.isProcedural">{{
                    label('程序化', 'Procedural')
                  }}</span>
                </div>
              </div>

              <div class="drawer-body">
                <div class="drawer-title">
                  <h2>{{ selectedMaterial.title }}</h2>
                  <span
                    class="status-pill"
                    :data-tone="getStatusMeta(selectedMaterial.status).tone"
                  >
                    <component :is="getStatusMeta(selectedMaterial.status).icon" class="icon-xs" />
                    {{ getStatusMeta(selectedMaterial.status).label }}
                  </span>
                </div>
                <p>
                  {{
                    selectedMaterial.description ||
                    label('作者暂未填写材料说明。', 'No material description yet.')
                  }}
                </p>

                <dl class="detail-grid">
                  <div>
                    <dt>{{ label('体积', 'Size') }}</dt>
                    <dd>{{ formatFileSize(selectedMaterial.fileSize) }}</dd>
                  </div>
                  <div>
                    <dt>{{ label('下载', 'Downloads') }}</dt>
                    <dd>{{ formatCompactNumber(selectedMaterial.downloads) }}</dd>
                  </div>
                  <div>
                    <dt>{{ label('收藏', 'Favorites') }}</dt>
                    <dd>{{ formatCompactNumber(selectedMaterial.favorites) }}</dd>
                  </div>
                  <div>
                    <dt>{{ label('上传', 'Uploaded') }}</dt>
                    <dd>{{ formatDate(selectedMaterial.createdAt) }}</dd>
                  </div>
                </dl>

                <div v-if="selectedMaterial.rejectReason" class="reject-note">
                  <strong>{{ label('驳回原因', 'Rejection Reason') }}</strong>
                  <span>{{ selectedMaterial.rejectReason }}</span>
                </div>

                <div class="tag-row detail-tags">
                  <span v-for="tag in selectedMaterial.tags" :key="tag">#{{ tag }}</span>
                </div>

                <div v-if="selectedMaterial.user" class="author-row">
                  <UserAvatar :user="selectedMaterial.user" size="sm" />
                  <div>
                    <strong>{{
                      selectedMaterial.user.name ||
                      selectedMaterial.user.email ||
                      label('创作者', 'Creator')
                    }}</strong>
                    <span>{{ label('材料贡献者', 'Material Contributor') }}</span>
                  </div>
                </div>

                <div v-if="normalizedMyMaterials.length" class="my-submissions">
                  <header>
                    <FileArchive class="icon-sm" />
                    <span>{{ label('我的最近提交', 'My Recent Uploads') }}</span>
                  </header>
                  <button
                    v-for="material in normalizedMyMaterials"
                    :key="material.id"
                    type="button"
                    class="submission-item"
                    @click="openDetail(material)"
                  >
                    <span>{{ material.title }}</span>
                    <small :data-tone="getStatusMeta(material.status).tone">{{
                      getStatusMeta(material.status).label
                    }}</small>
                  </button>
                </div>
              </div>

              <footer class="drawer-actions">
                <button
                  type="button"
                  class="ghost-button icon-text"
                  :class="{ active: selectedMaterial.isFavorited }"
                  @click="toggleFavorite(selectedMaterial)"
                >
                  <Heart class="icon-sm" :class="{ filled: selectedMaterial.isFavorited }" />
                  {{
                    selectedMaterial.isFavorited
                      ? label('已收藏', 'Favorited')
                      : label('收藏', 'Favorite')
                  }}
                </button>
                <button
                  type="button"
                  class="primary-button icon-text"
                  :disabled="!canDownloadMaterial(selectedMaterial)"
                  @click="handleDownload(selectedMaterial)"
                >
                  <Download class="icon-sm" />
                  {{ label('下载', 'Download') }}
                </button>
                <button
                  v-if="canEditMaterial(selectedMaterial)"
                  type="button"
                  class="ghost-button square-action"
                  @click="openEditDialog(selectedMaterial)"
                >
                  <Edit3 class="icon-sm" />
                </button>
                <button
                  v-if="canEditMaterial(selectedMaterial)"
                  type="button"
                  class="danger-button square-action"
                  @click="deleteMaterial(selectedMaterial)"
                >
                  <Trash2 class="icon-sm" />
                </button>
              </footer>

              <div v-if="isAdmin && selectedMaterial.status === 'PENDING'" class="review-actions">
                <button
                  type="button"
                  class="approve-button"
                  :disabled="isSavingReview"
                  @click="reviewMaterial(selectedMaterial, 'APPROVED')"
                >
                  <CheckCircle2 class="icon-sm" />
                  {{ label('通过', 'Approve') }}
                </button>
                <button
                  type="button"
                  class="reject-button"
                  :disabled="isSavingReview"
                  @click="reviewMaterial(selectedMaterial, 'REJECTED')"
                >
                  <XCircle class="icon-sm" />
                  {{ label('驳回', 'Reject') }}
                </button>
              </div>
            </template>
          </aside>
        </section>
      </main>
    </div>

    <Transition name="fade">
      <div v-if="isUploadDialogOpen" class="modal-layer">
        <button type="button" class="modal-backdrop" @click="closeMaterialDialog"></button>
        <section class="material-dialog">
          <header>
            <div>
              <h2>
                {{
                  isEditingMaterial
                    ? label('编辑材料', 'Edit Material')
                    : label('上传材质', 'Upload Material')
                }}
              </h2>
              <p>
                {{
                  isEditingMaterial
                    ? label('保存后将重新进入审核流程', 'Saving will send it back to review')
                    : label('提交贴图包或 SBSAR 文件', 'Submit texture packs or SBSAR files')
                }}
              </p>
            </div>
            <button type="button" class="icon-button" @click="closeMaterialDialog">
              <X class="icon-sm" />
            </button>
          </header>

          <div class="dialog-grid">
            <div class="dialog-column">
              <template v-if="!isEditingMaterial">
                <div class="mb-4 w-full">
                  <FileDropZone
                    v-model="materialForm.file"
                    accept=".zip,.sbsar"
                    :label="materialForm.file?.name || label('选择材料包', 'Choose Material Pack')"
                    sublabel="ZIP / SBSAR"
                    height-class="h-28"
                    @change="handleFileChange"
                  />
                </div>

                <div class="mb-4 w-full">
                  <FileDropZone
                    v-model="materialForm.preview"
                    accept="image/*"
                    :label="materialForm.preview?.name || label('上传预览图', 'Upload Preview')"
                    :sublabel="label('方形或 16:10 封面', 'Square or 16:10 cover')"
                    height-class="h-28"
                    @change="handlePreviewChange"
                  />
                </div>
              </template>

              <label class="form-field">
                <span>{{ label('材料名称', 'Material Name') }}</span>
                <input
                  v-model="materialForm.title"
                  type="text"
                  :placeholder="label('磨砂金属 PBR 套装', 'Brushed metal PBR set')"
                />
              </label>

              <div class="two-col">
                <label class="form-field">
                  <span>{{ label('分类', 'Category') }}</span>
                  <select v-model="materialForm.category">
                    <option v-for="category in uploadCategories" :key="category" :value="category">
                      {{ category }}
                    </option>
                  </select>
                </label>
                <label class="form-field">
                  <span>{{ label('分辨率', 'Resolution') }}</span>
                  <select v-model="materialForm.resolution">
                    <option
                      v-for="resolution in resolutionOptions"
                      :key="resolution"
                      :value="resolution"
                    >
                      {{ resolution }}
                    </option>
                  </select>
                </label>
              </div>

              <label class="switch-row">
                <input v-model="materialForm.isProcedural" type="checkbox" />
                <span>{{ label('程序化材质 / SBSAR', 'Procedural Material / SBSAR') }}</span>
              </label>

              <label class="form-field">
                <span>{{ label('标签', 'Tags') }}</span>
                <input
                  v-model="materialForm.tags"
                  type="text"
                  :placeholder="label('PBR, 金属, 4K, 游戏资产', 'PBR, metal, 4K, game asset')"
                />
              </label>
            </div>

            <div class="dialog-column">
              <label class="form-field editor-field">
                <span>{{ label('材料说明', 'Material Description') }}</span>
                <MarkdownEditor
                  v-model="materialForm.description"
                  :placeholder="
                    label(
                      '贴图通道、使用场景、授权或引擎导入注意事项',
                      'Texture channels, use cases, license, or engine import notes',
                    )
                  "
                  height="330px"
                  simple
                />
              </label>
            </div>
          </div>

          <footer>
            <button type="button" class="ghost-button" @click="closeMaterialDialog">
              {{ label('取消', 'Cancel') }}
            </button>
            <button
              type="button"
              class="primary-button icon-text"
              :disabled="isUploading || !canSubmitMaterial"
              @click="submitMaterial"
            >
              <Loader2 v-if="isUploading" class="icon-sm spinning" />
              {{
                isEditingMaterial ? label('保存', 'Save') : label('提交审核', 'Submit for Review')
              }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.materials-page {
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
  opacity: 0.55;
}

/* Flex alignments */
.page-header,
.title-block,
.command-actions,
.control-bar,
.toolbar-actions,
.view-switch,
.chip-row,
.state-bar,
.active-filters,
.bulk-actions,
.card-footer,
.metric-row,
.drawer-actions,
.review-actions,
.two-col,
.author-row,
.material-dialog header,
.material-dialog footer,
.signal-panel header,
.my-submissions header,
.title-line,
.drawer-title {
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

.material-dialog header p,
.empty-state p {
  margin-top: 1px;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Metric Strip (KPIs) */
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
  display: none; /* Hide verbose details in compact layout */
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

.command-actions,
.toolbar-actions,
.view-switch,
.bulk-actions,
.drawer-actions,
.review-actions,
.material-dialog footer {
  gap: 8px;
}

/* Base Buttons */
.primary-button,
.ghost-button,
.danger-button,
.approve-button,
.reject-button {
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

.ghost-button,
.icon-button {
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover,
.icon-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.ghost-button.active {
  border-color: rgba(225, 29, 72, 0.25);
  background: rgba(225, 29, 72, 0.05);
  color: #e11d48;
}

.danger-button {
  border-color: rgba(220, 38, 38, 0.25);
  background: rgba(220, 38, 38, 0.05);
  color: #dc2626;
}

.danger-button:hover {
  background: rgba(220, 38, 38, 0.1);
  border-color: #dc2626;
}

.approve-button {
  border-color: rgba(5, 150, 105, 0.25);
  background: rgba(5, 150, 105, 0.05);
  color: #047857;
}

.approve-button:hover {
  background: rgba(5, 150, 105, 0.1);
  border-color: #059669;
}

.reject-button {
  border-color: rgba(220, 38, 38, 0.25);
  background: rgba(220, 38, 38, 0.05);
  color: #dc2626;
}

.reject-button:hover {
  background: rgba(220, 38, 38, 0.1);
  border-color: #dc2626;
}

.compact-button {
  height: 28px;
  padding: 0 10px;
}

.square-action,
.icon-button {
  display: grid;
  place-items: center;
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
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

/* Control Bar (Toolbar) */
.control-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid var(--border-base);
  backdrop-filter: blur(12px);
  flex-wrap: nowrap;
}

.toolbar-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}

.toolbar-center {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
}

.toolbar-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.tab-switch {
  display: flex;
  gap: 2px;
  background: var(--bg-hover);
  padding: 2px;
  border-radius: 6px;
  border: 1px solid var(--border-base);
}

.tab-switch button {
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

.tab-switch button:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.4);
}

.dark .tab-switch button:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tab-switch button.active {
  background: var(--bg-card);
  color: #d97706;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-weight: 600;
}

.tab-switch strong {
  margin-left: 2px;
  color: var(--text-muted);
  font-size: 10px;
}

.tab-switch button.active strong {
  color: #d97706;
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
  border-color: #d97706;
  box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.15);
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

.select-field {
  width: 96px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.select-field:hover {
  border-color: var(--border-strong);
}

.select-field:focus {
  border-color: #d97706;
  outline: 0;
}

.view-switch {
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  padding: 2px;
}

.view-switch button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-switch button.active {
  background: #d97706;
  color: #fff;
}

.mobile-filter {
  display: none;
}

/* Sidebar Layout & Vertical Filters */
.workspace-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.filter-panel {
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.section-title svg {
  color: var(--accent);
}

.content-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 980px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
  .filter-panel {
    display: none;
  }
  .filter-panel.open {
    display: flex;
    position: fixed;
    top: 50px;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    border-radius: 0;
    border: 0;
    background: var(--bg-card);
    overflow: auto;
  }
}

.tag-strip button.active,
.select-all.active {
  border-color: transparent;
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
  font-weight: 600;
}

.filter-chip.active strong {
  color: #d97706;
}

/* Signal Row (Data Panel inside stats block) */
.signal-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(260px, 1.2fr);
  gap: 10px;
}

.signal-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
}

.mini-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Remove Borders on Sidebar list items */
.mini-material,
.submission-item {
  display: flex;
  align-items: center;
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 5px 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mini-list > button:not(:last-child),
.my-submissions > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.mini-material:hover,
.submission-item:hover {
  background: var(--bg-hover);
}

.mini-material {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 8px;
}

.mini-material img {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
}

.mini-material span,
.mini-material strong,
.mini-material small {
  min-width: 0;
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-material span {
  color: var(--text-primary);
  font-weight: 500;
}

.mini-material strong {
  color: #d97706;
  font-weight: 600;
  text-align: right;
}

.mini-material small {
  color: var(--text-muted);
  text-align: right;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-cloud button {
  height: 24px;
  border: 0;
  border-radius: 9999px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 0 10px;
  font-size: 10px;
  font-weight: 500;
  transition: all 0.15s ease;
  cursor: pointer;
}

.tag-cloud button:hover {
  background: var(--bg-active);
  color: var(--accent);
  transform: translateY(-0.5px);
}

.tag-cloud button.active {
  background: var(--accent-subtle);
  color: var(--accent);
  font-weight: 600;
}

/* State bar */
.state-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  padding: 0 10px;
}

.select-all,
.active-filters button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 0 8px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid var(--border-base);
}

.select-all:hover,
.active-filters button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.active-filters {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.active-filters .clear-filter {
  color: #d97706;
  font-weight: 600;
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bulk-actions > span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

/* Workbench Layout */
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

.asset-area {
  min-width: 0;
}

/* Grid columns and card sizing */
.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  min-height: 200px;
}

.material-grid.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Material Cards */
.material-card {
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  transition: all 0.18s ease;
  cursor: pointer;
}

.material-card:hover {
  transform: translateY(-2px);
  border-color: rgba(217, 119, 6, 0.45);
  box-shadow: 0 8px 24px rgba(217, 119, 6, 0.08);
}

.material-card.selected {
  border-color: #d97706;
  box-shadow: 0 0 0 1px #d97706;
}

.material-card.inactive {
  opacity: 0.8;
}

.material-grid.list .material-card {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
}

.material-preview {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #172033;
}

.material-grid.list .material-preview {
  aspect-ratio: auto;
  min-height: 80px;
}

.material-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.material-card:hover .material-preview img {
  transform: scale(1.03);
}

.select-dot,
.favorite-button {
  position: absolute;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  color: #475569;
  border: 1px solid var(--border-base);
}

.select-dot {
  left: 6px;
  top: 6px;
}

.favorite-button {
  right: 6px;
  top: 6px;
}

.select-dot.active {
  border-color: transparent;
  background: #d97706;
  color: #fff;
}

.favorite-button.active,
.filled {
  color: #e11d48;
  fill: #e11d48;
}

.badge-row,
.drawer-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.badge-row {
  position: absolute;
  left: 6px;
  bottom: 6px;
}

.badge-row span,
.drawer-badges span {
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.75);
  color: #fff;
  padding: 2px 5px;
  font-size: 9px;
  font-weight: 600;
}

.material-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.title-line,
.drawer-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.material-body h2,
.drawer-title h2 {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-body h2 {
  font-size: 13px;
}

.material-body p {
  min-height: 28px;
  margin-top: 2px;
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1.4;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.meta-row,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.meta-row span,
.tag-row span {
  border-radius: 4px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 500;
}

.status-pill {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  border-radius: 999px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 600;
}

.status-pill[data-tone='success'],
.submission-item small[data-tone='success'] {
  background: rgba(5, 150, 105, 0.1);
  color: #047857;
}

.status-pill[data-tone='warning'],
.submission-item small[data-tone='warning'] {
  background: rgba(217, 119, 6, 0.1);
  color: #b45309;
}

.status-pill[data-tone='danger'],
.submission-item small[data-tone='danger'] {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid var(--border-base);
}

.metric-row {
  display: flex;
  gap: 6px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
}

.metric-row span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.download-button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border-color: transparent;
  background: rgba(217, 119, 6, 0.08);
  color: #d97706;
  padding: 0;
  transition: all 0.15s ease;
}

.download-button:hover:not(:disabled) {
  background: rgba(217, 119, 6, 0.15);
  transform: translateY(-0.5px);
}

/* Detail Drawer */
.detail-drawer {
  position: sticky;
  top: 10px;
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.close-button {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: #fff;
  border-color: var(--border-strong);
}

.drawer-loading {
  display: grid;
  place-items: center;
  min-height: 380px;
  color: #d97706;
}

.drawer-preview {
  position: relative;
  height: 180px;
  overflow: hidden;
  background: #172033;
}

.drawer-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.drawer-badges {
  position: absolute;
  left: 10px;
  bottom: 10px;
}

.drawer-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}

.drawer-title h2 {
  font-size: 16px;
}

.drawer-body > p {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.5;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
}

.detail-grid div,
.reject-note,
.author-row,
.my-submissions {
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-hover);
}

.detail-grid div {
  padding: 6px;
}

.detail-grid dt {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
}

.detail-grid dd {
  margin: 2px 0 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reject-note {
  display: grid;
  gap: 3px;
  padding: 8px;
}

.reject-note strong {
  color: #dc2626;
  font-size: 10px;
}

.reject-note span {
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.4;
}

.detail-tags {
  margin-top: 0;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.author-row strong,
.author-row span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-row strong {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.author-row span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
}

.my-submissions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
}

.submission-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 28px;
  padding: 0 4px;
  font-size: 11px;
}

.submission-item span {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submission-item small {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 600;
}

.drawer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-top: 1px solid var(--border-base);
  padding: 10px 12px;
}

.review-actions {
  display: flex;
  gap: 6px;
  border-top: 1px solid var(--border-base);
  padding: 0 12px 12px;
}

/* Empty State */
.empty-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  min-height: 260px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  text-align: center;
}

.empty-state h2 {
  font-size: 15px;
  font-weight: 600;
}

.empty-icon {
  width: 32px;
  height: 32px;
  color: #d97706;
  opacity: 0.55;
}

/* Modals */
.modal-layer {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 16px;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(6px);
}

.material-dialog {
  position: relative;
  z-index: 1;
  width: min(920px, 100%);
  max-height: min(86vh, 760px);
  overflow: auto;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--bg-card);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
  padding: 16px;
}

.material-dialog header,
.material-dialog footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.material-dialog header {
  margin-bottom: 12px;
}

.material-dialog h2 {
  font-size: 16px;
  font-weight: 700;
}

.dialog-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.86fr) minmax(0, 1.14fr);
  gap: 12px;
}

.dialog-column {
  display: grid;
  align-content: start;
  gap: 8px;
}

.drop-zone {
  position: relative;
  display: grid;
  place-items: center;
  gap: 4px;
  min-height: 100px;
  border: 1px dashed var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  text-align: center;
}

.drop-zone.compact {
  min-height: 76px;
}

.drop-zone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.drop-icon {
  width: 22px;
  height: 22px;
  color: #d97706;
}

.drop-zone strong {
  max-width: 90%;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drop-zone span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
}

.form-field,
.switch-row {
  display: grid;
  gap: 4px;
}

.form-field > span,
.switch-row span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.form-field input,
.form-field select {
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 0 10px;
  font-size: 12px;
}

.two-col {
  display: flex;
  align-items: end;
  gap: 8px;
}

.two-col > * {
  flex: 1;
}

.switch-row {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 8px;
}

.editor-field :deep(.markdown-editor) {
  min-width: 0;
}

.material-dialog footer {
  margin-top: 12px;
  justify-content: flex-end;
}

.skeleton {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.1),
    rgba(148, 163, 184, 0.2),
    rgba(148, 163, 184, 0.1)
  );
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

.skeleton-card {
  padding: 10px;
}

.skeleton.preview {
  aspect-ratio: 4 / 3;
}

.skeleton.line {
  width: 60%;
  height: 10px;
  margin-top: 10px;
}

.skeleton.line.wide {
  width: 80%;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (max-width: 1040px) {
  .filter-deck {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .signal-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1080px) {
  .workbench.with-detail {
    grid-template-columns: 1fr;
  }

  .detail-drawer {
    position: relative;
    top: 0;
  }
}

@media (max-width: 860px) {
  .materials-page {
    padding: 12px;
  }

  .command-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .control-bar {
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

  .tab-switch,
  .metric-strip,
  .mini-list {
    grid-template-columns: 1fr;
  }

  .search-box {
    min-width: 0;
    width: 100%;
  }

  .toolbar-actions,
  .command-actions {
    justify-content: stretch;
    width: 100%;
  }

  .toolbar-actions > *,
  .command-actions > * {
    flex: 1;
  }

  .mobile-filter {
    display: grid;
    flex: 0 0 32px;
  }

  .filter-deck {
    display: none;
    grid-template-columns: 1fr;
  }

  .filter-deck.open {
    display: grid;
  }

  .state-bar,
  .bulk-actions,
  .two-col {
    align-items: stretch;
    flex-direction: column;
  }

  .material-grid.list .material-card {
    grid-template-columns: 1fr;
  }

  .dialog-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .material-grid.grid {
    grid-template-columns: 1fr;
  }

  .page-title p {
    white-space: normal;
  }
}
</style>
