<script setup lang="ts">
import { formatDateTime as formatTime } from '@/utils/format';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  RefreshCw,
  Trash2,
  Edit3,
  Clock,
  Database,
  Globe,
  Loader2,
  X,
  History,
  Play,
  Square,
  Sparkles,
  Layers,
  Link2,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Check,
  Upload,
  Download,
  Eraser,
} from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import type { AxiosProgressEvent } from 'axios';
import { getPlanName } from '@/utils/plans';
import { getApiErrorMessage } from '@/utils/error';
import { fetchManagementInsights } from './adminManagementInsights';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Modal from '@/components/ui/Modal.vue';
import MirrorSourceDialog from './components/MirrorSourceDialog.vue';
import MirrorSyncLogsDialog from './components/MirrorSyncLogsDialog.vue';

export interface MirrorSource {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  adapterType: string;
  status: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSyncDuration: number | null;
  totalResources: number;
  minPlanPriority: number;
  syncInterval: number;
  syncConfig: string | null;
  iconUrl: string | null;
  description: string | null;
  createdAt: string;
  _count?: { resources: number; categories: number };
  latestSync?: SyncLog | null;
}

type ResourceQueryParams = {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
};

interface SyncProgress {
  type: string;
  status: string;
  phase: 'CATEGORIES' | 'LISTING' | 'DETAILS';
  currentCategory: string;
  currentCategoryIndex: number;
  totalCategories: number;
  currentPage: number;
  resourcesFound: number;
  resourcesCreated: number;
  resourcesUpdated: number;
  detailsFetched: number;
  totalDetailsToFetch: number;
  startedAt: string;
  estimatedProgress: number;
}

export interface SyncLog {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  duration: number | null;
  resourcesFound: number;
  resourcesCreated: number;
  resourcesUpdated: number;
  resourcesDeleted: number;
  error: string | null;
}

interface MirrorResource {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  contentUrl: string | null;
  contentHtml: string | null;
  tags: string | null;
  resourceType: string;
  viewCount: number;
  publishedAt: string | null;
  categoryId: string | null;
  category: { name: string } | null;
  externalId: string;
  createdAt: string;
}

interface MirrorCategory {
  id: string;
  name: string;
  slug?: string;
  order?: number;
  externalId: string;
  parentExternalId?: string | null;
}

const route = useRoute();
const sources = ref<MirrorSource[]>([]);
const progressMap = ref<Record<string, SyncProgress>>({});
const isLoading = ref(false);
const showSourceDialog = ref(false);
const showSyncLogsDialog = ref(false);
const showMatchDialog = ref(false);
const showCloudScanDialog = ref(false);
const isScanningCloud = ref(false);
const isConnectingCloud = ref(false);
const cloudSources = ref<
  Array<{
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    iconUrl: string | null;
    totalResources: number;
    isConnected: boolean;
    metadataKey: string;
  }>
>([]);
const editingSource = ref<MirrorSource | null>(null);
const selectedSource = ref<MirrorSource | null>(null);
const excelFiles = ref<File[]>([]);
const isUploading = ref(false);
const matchResult = ref<{ totalLinks: number; matchedCount: number } | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

// Resource management state
const expandedSourceId = ref<string | null>(null);
const expandedTab = ref<'resources' | 'categories'>('resources');
const resourceList = ref<MirrorResource[]>([]);
const resourceTotal = ref(0);
const resourcePage = ref(1);
const resourcePageSize = ref(20);
const resourceTotalPages = ref(0);
const resourceSearch = ref('');
const resourceCategoryFilter = ref<string | null>(null);
const isLoadingResources = ref(false);
const sourceCategories = ref<MirrorCategory[]>([]);
const showResourceDialog = ref(false);
const isEditingResource = ref(false);
const editingResource = ref<MirrorResource | null>(null);
const resourceForm = ref({
  title: '',
  description: '',
  thumbnailUrl: '',
  contentUrl: '',
  tags: '',
  contentHtml: '',
  resourceType: 'COURSE',
  categoryId: '',
});

// Category management state
const showCategoryDialog = ref(false);
const isEditingCategory = ref(false);
const editingCategory = ref<MirrorCategory | null>(null);
const categoryForm = ref({
  name: '',
  slug: '',
  order: 0,
  parentExternalId: null as string | null,
  childExternalIds: [] as string[],
});

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '启用', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  PAUSED: { label: '暂停', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
  ERROR: { label: '异常', color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
};

function openCreate() {
  editingSource.value = null;
  showSourceDialog.value = true;
}

function openEdit(source: MirrorSource) {
  editingSource.value = source;
  showSourceDialog.value = true;
}

async function onSourceSaved() {
  await fetchSources();
}

async function deleteSource(source: MirrorSource) {
  try {
    await ElMessageBox.confirm(
      `确定要删除镜像源「${source.displayName}」吗？\n\n⚠️ 此操作将删除该镜像源的所有数据，包括：\n• ${source._count?.resources || source.totalResources} 个同步资源\n• ${source._count?.categories || 0} 个分类\n• 所有同步日志\n\n此操作不可恢复！`,
      '确认删除镜像源',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`/api/admin/mirror/sources/${source.id}`);
    ElMessage.success('镜像源及所有关联数据已删除');
    await fetchSources();
  } catch (e: unknown) {
    if (e !== 'cancel') {
      ElMessage.error(getApiErrorMessage(e, '删除失败'));
    }
  }
}

async function triggerSync(sourceId: string, type: 'FULL' | 'INCREMENTAL') {
  try {
    await api.post(`/api/admin/mirror/sources/${sourceId}/sync?type=${type}`);
    ElMessage.success(`${type === 'FULL' ? '全量' : '增量'}同步已触发`);
    await fetchSources();
    startPolling();
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '触发同步失败'));
  }
}

async function cancelSync(sourceId: string) {
  try {
    await api.post(`/api/admin/mirror/sources/${sourceId}/sync/cancel`);
    ElMessage.success('同步取消已请求');
    await fetchSources();
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '取消同步失败'));
  }
}

function viewSyncLogs(source: MirrorSource) {
  editingSource.value = source;
  showSyncLogsDialog.value = true;
}

function openMatchLinks(source: MirrorSource) {
  selectedSource.value = source;
  excelFiles.value = [];
  matchResult.value = null;
  showMatchDialog.value = true;
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const selected = Array.from(target.files);
    selected.forEach((file) => {
      const exists = excelFiles.value.some((f) => f.name === file.name && f.size === file.size);
      if (!exists) {
        excelFiles.value.push(file);
      }
    });
    target.value = '';
  }
}

function removeFile(index: number) {
  excelFiles.value.splice(index, 1);
}

async function uploadAndMatch() {
  if (excelFiles.value.length === 0 || !selectedSource.value) {
    ElMessage.warning('请先选择 Excel 文件');
    return;
  }

  isUploading.value = true;
  const formData = new FormData();
  excelFiles.value.forEach((file) => {
    formData.append('files', file);
  });

  try {
    const res = await api.post(
      `/api/admin/mirror/sources/${selectedSource.value.id}/match-links`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    ElMessage.success(res.data.message || '匹配成功');
    matchResult.value = {
      totalLinks: res.data.totalLinks,
      matchedCount: res.data.matchedCount,
    };
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '匹配失败'));
  } finally {
    isUploading.value = false;
  }
}

async function openScanCloudDialog() {
  showCloudScanDialog.value = true;
  await fetchCloudSources();
}

async function fetchCloudSources() {
  isScanningCloud.value = true;
  try {
    const res = await api.get('/api/admin/mirror/cloud-discover');
    cloudSources.value = res.data;
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '扫描云端镜像站失败'));
  } finally {
    isScanningCloud.value = false;
  }
}

async function connectCloudMirror(metadataKey: string) {
  isConnectingCloud.value = true;
  try {
    const res = await api.post('/api/admin/mirror/cloud-connect', { metadataKey });
    ElMessage.success(res.data.message || '连接云端镜像成功！');
    await fetchCloudSources();
    await fetchSources();
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '连接云端镜像站失败'));
  } finally {
    isConnectingCloud.value = false;
  }
}

async function fetchSources() {
  isLoading.value = true;
  try {
    const res = await api.get('/api/admin/mirror/sources');
    sources.value = res.data;
    fetchManagementInsights(true);
  } catch (_e) {
    ElMessage.error('加载镜像源失败');
  } finally {
    isLoading.value = false;
  }
}

async function pollProgress() {
  const syncingSources = sources.value.filter((s) => s.syncStatus === 'SYNCING');
  if (syncingSources.length === 0) {
    stopPolling();
    return;
  }

  for (const source of syncingSources) {
    try {
      const res = await api.get(`/api/admin/mirror/sources/${source.id}/sync-status`);
      if (res.data.progress) {
        progressMap.value[source.id] = res.data.progress;
      }
      if (!res.data.isSyncing) {
        delete progressMap.value[source.id];
        await fetchSources();
      }
    } catch {
      // ignore
    }
  }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(pollProgress, 2000);
  pollProgress();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}秒`;
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
}

function formatElapsed(startedAt: string) {
  const elapsed = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (elapsed < 60) return `${elapsed}秒`;
  return `${Math.floor(elapsed / 60)}分${elapsed % 60}秒`;
}

// Resource management functions
async function toggleResourcePanel(source: MirrorSource) {
  if (expandedSourceId.value === source.id) {
    expandedSourceId.value = null;
    return;
  }
  expandedSourceId.value = source.id;
  expandedTab.value = 'resources';
  resourcePage.value = 1;
  resourceSearch.value = '';
  resourceCategoryFilter.value = null;
  await Promise.all([fetchResources(source.id), fetchCategories(source.id)]);
}

async function fetchResources(sourceId: string) {
  isLoadingResources.value = true;
  try {
    const params: ResourceQueryParams = {
      page: resourcePage.value,
      pageSize: resourcePageSize.value,
    };
    if (resourceSearch.value) params.search = resourceSearch.value;
    if (resourceCategoryFilter.value) params.categoryId = resourceCategoryFilter.value;
    const res = await api.get(`/api/admin/mirror/sources/${sourceId}/resources`, { params });
    resourceList.value = res.data.resources;
    resourceTotal.value = res.data.total;
    resourceTotalPages.value = res.data.totalPages;
  } catch (_e) {
    ElMessage.error('加载资源列表失败');
  } finally {
    isLoadingResources.value = false;
  }
}

async function fetchCategories(sourceId: string) {
  try {
    const res = await api.get(`/api/mirror/sources/${sourceId}/categories`);
    sourceCategories.value = res.data;
  } catch {
    sourceCategories.value = [];
  }
}

const parentCategoryOptions = computed(() => {
  return sourceCategories.value.filter((cat) => {
    if (editingCategory.value && cat.id === editingCategory.value.id) return false;
    return !cat.parentExternalId;
  });
});

const eligibleSubcategories = computed(() => {
  const categories = sourceCategories.value;
  const currentExternalId = editingCategory.value?.externalId;
  const parentExternalIds = new Set<string>();
  categories.forEach((c) => {
    if (c.parentExternalId && c.parentExternalId !== currentExternalId) {
      parentExternalIds.add(c.parentExternalId);
    }
  });
  return categories.filter((c) => {
    if (currentExternalId && c.externalId === currentExternalId) return false;
    if (parentExternalIds.has(c.externalId)) return false;
    return true;
  });
});

const formattedMirrorCategories = computed(() => {
  const categories = sourceCategories.value;
  const parentMap = new Map<string, MirrorCategory[]>();
  const topLevel: MirrorCategory[] = [];

  categories.forEach((cat) => {
    if (cat.parentExternalId) {
      if (!parentMap.has(cat.parentExternalId)) {
        parentMap.set(cat.parentExternalId, []);
      }
      parentMap.get(cat.parentExternalId)!.push(cat);
    }
  });

  categories.forEach((cat) => {
    const hasParent =
      cat.parentExternalId && categories.some((p) => p.externalId === cat.parentExternalId);
    if (!hasParent) {
      topLevel.push(cat);
    }
  });

  topLevel.sort((a, b) => (a.order || 0) - (b.order || 0));

  const result: Array<MirrorCategory> = [];

  topLevel.forEach((parent) => {
    result.push(parent);
    const children = parentMap.get(parent.externalId) || [];
    children.sort((a, b) => (a.order || 0) - (b.order || 0));
    children.forEach((child) => {
      result.push({
        ...child,
        name: `\u3000└─ ${child.name}`,
      });
    });
  });

  return result;
});

function getParentCategoryName(cat: MirrorCategory) {
  if (!cat.parentExternalId) return '-';
  const parent = sourceCategories.value.find((c) => c.externalId === cat.parentExternalId);
  return parent ? parent.name : '-';
}

function doResourceSearch() {
  if (!expandedSourceId.value) return;
  resourcePage.value = 1;
  fetchResources(expandedSourceId.value);
}

function changeResourcePage(page: number) {
  if (!expandedSourceId.value) return;
  resourcePage.value = page;
  fetchResources(expandedSourceId.value);
}

function resetResourceForm() {
  resourceForm.value = {
    title: '',
    description: '',
    thumbnailUrl: '',
    contentUrl: '',
    tags: '',
    contentHtml: '',
    resourceType: 'COURSE',
    categoryId: '',
  };
}

function openCreateResource() {
  isEditingResource.value = false;
  editingResource.value = null;
  resetResourceForm();
  showResourceDialog.value = true;
}

async function openEditResource(res: MirrorResource) {
  isEditingResource.value = true;
  editingResource.value = res;
  try {
    const detail = await api.get(`/api/admin/mirror/resources/${res.id}`);
    const r = detail.data;
    resourceForm.value = {
      title: r.title || '',
      description: r.description || '',
      thumbnailUrl: r.thumbnailUrl || '',
      contentUrl: r.contentUrl || '',
      tags: r.tags || '',
      contentHtml: r.contentHtml || '',
      resourceType: r.resourceType || 'COURSE',
      categoryId: r.categoryId || '',
    };
  } catch {
    resourceForm.value = {
      title: res.title || '',
      description: res.description || '',
      thumbnailUrl: res.thumbnailUrl || '',
      contentUrl: res.contentUrl || '',
      tags: res.tags || '',
      contentHtml: res.contentHtml || '',
      resourceType: res.resourceType || 'COURSE',
      categoryId: res.categoryId || '',
    };
  }
  showResourceDialog.value = true;
}

async function saveResource() {
  if (!resourceForm.value.title.trim()) {
    ElMessage.warning('请输入资源标题');
    return;
  }
  try {
    const payload = {
      ...resourceForm.value,
      categoryId: resourceForm.value.categoryId || null,
    };

    if (isEditingResource.value && editingResource.value) {
      await api.put(`/api/admin/mirror/resources/${editingResource.value.id}`, payload);
      ElMessage.success('资源更新成功');
    } else if (expandedSourceId.value) {
      await api.post(`/api/admin/mirror/sources/${expandedSourceId.value}/resources`, payload);
      ElMessage.success('资源创建成功');
    }
    showResourceDialog.value = false;
    if (expandedSourceId.value) {
      await fetchResources(expandedSourceId.value);
      await fetchSources();
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '操作失败'));
  }
}

async function deleteResource(res: MirrorResource) {
  try {
    await ElMessageBox.confirm(
      `确定要删除资源「${res.title}」吗？此操作不可恢复。`,
      '确认删除资源',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`/api/admin/mirror/resources/${res.id}`);
    ElMessage.success('资源已删除');
    if (expandedSourceId.value) {
      await fetchResources(expandedSourceId.value);
      await fetchSources();
    }
  } catch (e: unknown) {
    if (e !== 'cancel') {
      ElMessage.error(getApiErrorMessage(e, '删除失败'));
    }
  }
}

// Category management functions
function resetCategoryForm() {
  categoryForm.value = {
    name: '',
    slug: '',
    order: 0,
    parentExternalId: null,
    childExternalIds: [],
  };
}

function openCreateCategory() {
  isEditingCategory.value = false;
  editingCategory.value = null;
  resetCategoryForm();
  showCategoryDialog.value = true;
}

function openEditCategory(cat: MirrorCategory) {
  isEditingCategory.value = true;
  editingCategory.value = cat;
  const currentChildExternalIds = sourceCategories.value
    .filter((c) => c.parentExternalId === cat.externalId)
    .map((c) => c.externalId);
  categoryForm.value = {
    name: cat.name,
    slug: cat.slug || '',
    order: cat.order || 0,
    parentExternalId: cat.parentExternalId || null,
    childExternalIds: currentChildExternalIds,
  };
  showCategoryDialog.value = true;
}

async function saveCategory() {
  if (!categoryForm.value.name.trim()) {
    ElMessage.warning('请输入分类名称');
    return;
  }
  try {
    const payload = {
      name: categoryForm.value.name,
      slug: categoryForm.value.slug || undefined,
      order: categoryForm.value.order,
      parentExternalId: categoryForm.value.parentExternalId || null,
      childExternalIds: categoryForm.value.childExternalIds,
    };

    if (isEditingCategory.value && editingCategory.value) {
      await api.put(`/api/admin/mirror/categories/${editingCategory.value.id}`, payload);
      ElMessage.success('分类更新成功');
    } else if (expandedSourceId.value) {
      await api.post(`/api/admin/mirror/sources/${expandedSourceId.value}/categories`, payload);
      ElMessage.success('分类创建成功');
    }
    showCategoryDialog.value = false;
    if (expandedSourceId.value) {
      await fetchCategories(expandedSourceId.value);
    }
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, '操作失败'));
  }
}

async function deleteCategory(cat: MirrorCategory) {
  try {
    await ElMessageBox.confirm(
      `确定要删除分类「${cat.name}」吗？关联该分类的资源会被设为「未分类」。`,
      '确认删除分类',
      {
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`/api/admin/mirror/categories/${cat.id}`);
    ElMessage.success('分类已删除');
    if (expandedSourceId.value) {
      await fetchCategories(expandedSourceId.value);
      await fetchResources(expandedSourceId.value);
    }
  } catch (e: unknown) {
    if (e !== 'cancel') {
      ElMessage.error(getApiErrorMessage(e, '删除失败'));
    }
  }
}

const statusFilter = ref<'ALL' | 'ACTIVE' | 'PAUSED' | 'ERROR'>('ALL');
const setStatusFilter = (key: string) => {
  if (key === 'ALL' || key === 'ACTIVE' || key === 'PAUSED' || key === 'ERROR') {
    statusFilter.value = key;
  }
};
const mirrorSearchQuery = ref('');

const filteredSources = computed(() => {
  return sources.value.filter((source) => {
    const matchesStatus = statusFilter.value === 'ALL' || source.status === statusFilter.value;
    const matchesSearch =
      !mirrorSearchQuery.value ||
      source.name.toLowerCase().includes(mirrorSearchQuery.value.toLowerCase()) ||
      source.displayName.toLowerCase().includes(mirrorSearchQuery.value.toLowerCase());
    return matchesStatus && matchesSearch;
  });
});

const consolidatedCards = computed(() => {
  const activeCount = sources.value.filter((s) => s.status === 'ACTIVE').length;
  const totalCount = sources.value.length;
  const totalResources = sources.value.reduce(
    (sum, s) => sum + (s._count?.resources || s.totalResources || 0),
    0,
  );
  const syncingCount = sources.value.filter((s) => s.syncStatus === 'SYNCING').length;
  const errorCount = sources.value.filter((s) => s.status === 'ERROR').length;
  const totalCategories = sources.value.reduce((sum, s) => sum + (s._count?.categories || 0), 0);

  return [
    {
      label: '可用镜像',
      value: `${activeCount}/${totalCount}`,
      hint: `${totalResources} 个资源`,
      icon: Globe,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: '运行中' },
    },
    {
      label: '同步中',
      value: syncingCount,
      hint: '当前后台镜像站同步中数',
      icon: Loader2,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      health: { label: syncingCount > 0 ? '同步中' : '空闲' },
    },
    {
      label: '异常源',
      value: errorCount,
      hint: '需查看网络或日志',
      icon: X,
      color: 'text-rose-600 bg-rose-500/10 border-rose-500/20',
      health: { label: errorCount > 0 ? '有异常' : '无异常' },
    },
    {
      label: '镜像分类',
      value: totalCategories,
      hint: '同步至系统内的分类数',
      icon: Layers,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health: { label: '资源目录' },
    },
  ];
});

const getBadgeVariant = (label: string) => {
  if (label === '运行中' || label === '无异常' || label === '空闲') return 'success';
  if (label === '有异常') return 'danger';
  if (label === '同步中') return 'warning';
  return 'primary';
};

const tabOptions = computed(() => [
  { label: `所有镜像源 (${sources.value.length})`, value: 'ALL', icon: Globe },
  {
    label: `启用 (${sources.value.filter((s) => s.status === 'ACTIVE').length})`,
    value: 'ACTIVE',
    icon: Check,
  },
  {
    label: `暂停 (${sources.value.filter((s) => s.status === 'PAUSED').length})`,
    value: 'PAUSED',
    icon: Square,
  },
  {
    label: `异常 (${sources.value.filter((s) => s.status === 'ERROR').length})`,
    value: 'ERROR',
    icon: X,
  },
]);

onMounted(() => {
  fetchSources().then(() => {
    const hasSyncing = sources.value.some((s) => s.syncStatus === 'SYNCING');
    if (hasSyncing) {
      startPolling();
    }
    const sourceId = route.query.sourceId as string;
    if (sourceId) {
      const source = sources.value.find((s) => s.id === sourceId);
      if (source) {
        toggleResourcePanel(source);
      }
    }
  });
});

const importFileInput = ref<HTMLInputElement | null>(null);
const showImportProgressDialog = ref(false);
const importProgress = ref(0);
const importStatusText = ref('正在准备上传...');
const importError = ref<string | null>(null);
const importTaskStatus = ref<string>('idle');
let importPollInterval: ReturnType<typeof setInterval> | null = null;

const triggerImportFile = () => {
  importFileInput.value?.click();
};

const handleImportFile = async (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // Reset file input value so same file can be selected again
  target.value = '';

  showImportProgressDialog.value = true;
  importProgress.value = 0;
  importStatusText.value = '正在上传压缩包... 0%';
  importError.value = null;
  importTaskStatus.value = 'uploading';

  const formData = new FormData();
  formData.append('file', file);

  const startTime = Date.now();

  try {
    const response = await api.post('/api/admin/mirror/sources/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent: AxiosProgressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          importProgress.value = Math.min(percentCompleted, 99);

          const elapsedTime = (Date.now() - startTime) / 1000;
          const speedBytes = elapsedTime > 0 ? progressEvent.loaded / elapsedTime : 0;
          const speedText =
            speedBytes > 1024 * 1024
              ? (speedBytes / (1024 * 1024)).toFixed(1) + ' MB/s'
              : (speedBytes / 1024).toFixed(1) + ' KB/s';

          const loadedText = (progressEvent.loaded / (1024 * 1024)).toFixed(1) + ' MB';
          const totalText = (progressEvent.total / (1024 * 1024)).toFixed(1) + ' MB';

          importStatusText.value = `正在上传压缩包... ${importProgress.value}% (${loadedText} / ${totalText}) | 速度: ${speedText}`;
        }
      },
    });

    const { taskId } = response.data;
    if (!taskId) {
      throw new Error('未返回导入任务 ID');
    }

    importTaskStatus.value = 'processing';
    startImportPolling(taskId);
  } catch (error: unknown) {
    importTaskStatus.value = 'failed';
    importError.value = getApiErrorMessage(error, '上传文件失败');
    importStatusText.value = '导入失败';
  }
};

const startImportPolling = (taskId: string) => {
  if (importPollInterval) clearInterval(importPollInterval);

  importPollInterval = setInterval(async () => {
    try {
      const response = await api.get(`/api/admin/mirror/import/status/${taskId}`);
      const task = response.data;

      importProgress.value = task.progress;
      importStatusText.value = task.message;
      importTaskStatus.value = task.status;

      if (task.status === 'completed') {
        clearInterval(importPollInterval as any);
        ElMessage.success('镜像源导入成功！');
        fetchSources(); // Refresh sources list
      } else if (task.status === 'failed') {
        clearInterval(importPollInterval as any);
        importError.value = task.error || '导入失败';
      }
    } catch (error: unknown) {
      clearInterval(importPollInterval as any);
      importTaskStatus.value = 'failed';
      importError.value = getApiErrorMessage(error, '获取导入状态失败');
    }
  }, 1000);
};

const closeImportDialog = () => {
  showImportProgressDialog.value = false;
  if (importPollInterval) {
    clearInterval(importPollInterval as any);
    importPollInterval = null;
  }
};

const triggerExportDownload = (source: MirrorSource, full: boolean) => {
  ElMessage.info(
    full
      ? '正在生成完整备份 (2.4GB)，文件将通过流式传输下载，请耐心等待浏览器弹出下载进度...'
      : '正在生成轻量备份，请稍候...',
  );

  // Use a relative /api URL (same-origin through Vite proxy) so that:
  // 1. Cookies are sent automatically (backend uses cookie-based auth)
  // 2. link.download attribute works (only works for same-origin URLs in Chrome)
  // The Vite proxy has a 30-min timeout configured for this path, so large downloads won't be cut off.
  const exportUrl = `/api/admin/mirror/sources/${source.id}/export?full=${full}`;

  const link = document.createElement('a');
  link.href = exportUrl;
  // download attribute forces browser file-save instead of navigation (only works for same-origin)
  link.download = `${source.name}-mirror-export.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const exportSource = (source: MirrorSource) => {
  ElMessageBox.confirm(
    `<div class="text-slate-600 dark:text-slate-300">
      <p class="mb-3">请选择镜像源 <b>${source.displayName}</b> 的导出模式：</p>
      <ul class="list-disc pl-5 space-y-1.5 text-xs">
        <li><b>仅导出封面 (轻量模式)</b>：体积小 (约 90MB)，生成与下载极快。</li>
        <li><b>包含全部正文插图 (完整模式)</b>：体积大 (约 2.4GB)，包含文章内嵌的所有本地图片。</li>
      </ul>
      <p class="mt-3 text-xs text-red-500 font-semibold">注意：如果选择完整模式，由于文件较多可能会有几秒的网络响应延迟，请耐心等待。</p>
     </div>`,
    '选择导出模式',
    {
      confirmButtonText: '完整导出 (包含插图)',
      cancelButtonText: '仅导出封面',
      distinguishCancelAndClose: true,
      type: 'info',
      dangerouslyUseHTMLString: true,
    },
  )
    .then(() => {
      triggerExportDownload(source, true);
    })
    .catch((action) => {
      if (action === 'cancel') {
        triggerExportDownload(source, false);
      }
    });
};

const cleanupSource = (source: MirrorSource) => {
  ElMessageBox.confirm(
    `确定要清理镜像源「${source.displayName}」的本地缓存目录吗？这会分析数据库并删除所有未使用的缓存文件，释放磁盘空间。`,
    '系统提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    },
  )
    .then(async () => {
      ElMessage.info('正在深度分析并清理存储空间，请稍候...');
      try {
        const response = await api.post(`/api/admin/mirror/sources/${source.id}/cleanup`);
        const { deletedCount, savedMegabytes } = response.data;
        ElMessageBox.alert(
          `清理完成！共删除 ${deletedCount} 个无用缓存文件，成功释放了 ${savedMegabytes} MB 磁盘空间。`,
          '清理结果',
          {
            confirmButtonText: '好的',
            type: 'success',
          },
        );
      } catch (error: unknown) {
        ElMessage.error(getApiErrorMessage(error, '清理存储空间失败'));
      }
    })
    .catch(() => {});
};

onUnmounted(() => {
  stopPolling();
  if (importPollInterval) {
    clearInterval(importPollInterval as any);
  }
});
</script>

<template>
  <div
    class="admin-mirror-page flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)]"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide">
      <!-- Page Header -->
      <PageHeader title="镜像源管理" variant="card">
        <template #title-badge>
          <div class="flex flex-wrap items-center gap-1.5 ml-2">
            <Badge variant="info"> 镜像源数: {{ sources.length }} </Badge>
          </div>
        </template>

        <template #center>
          <!-- Compact Search Box (Centered) -->
          <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
            <Search />
            <input v-model="mirrorSearchQuery" type="text" placeholder="搜索镜像源..." />
          </label>
        </template>

        <!-- Actions -->
        <Button variant="primary" size="sm" :icon="Plus" @click="openCreate"> 添加镜像源 </Button>
        <Button variant="secondary" size="sm" :icon="Upload" @click="triggerImportFile">
          导入镜像源
        </Button>
        <Button variant="secondary" size="sm" :icon="Search" @click="openScanCloudDialog">
          扫描云端镜像源
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchSources"
        >
          刷新
        </Button>
      </PageHeader>

      <!-- KPI Metrics Grid -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card
          v-for="card in consolidatedCards"
          :key="card.label"
          hoverable
          glow
          class="group !p-2 px-2.5"
        >
          <div class="flex items-center justify-between w-full gap-3">
            <!-- Left: Icon & Info -->
            <div class="flex items-center gap-2.5 min-w-0">
              <span
                class="panel-icon border border-base rounded-lg p-1.5 transition-transform group-hover:scale-105 shrink-0"
                :class="card.color"
              >
                <component :is="card.icon" class="h-3.5 w-3.5" />
              </span>
              <div class="min-w-0">
                <p
                  class="text-[11px] font-bold text-[var(--text-secondary)] truncate leading-tight"
                >
                  {{ card.label }}
                </p>
                <p
                  class="text-[9px] text-[var(--text-secondary)] opacity-80 truncate mt-0.5 leading-none"
                  :title="card.hint"
                >
                  {{ card.hint }}
                </p>
              </div>
            </div>

            <!-- Right: Metric & Health Badge -->
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-base font-black text-[var(--text-primary)] leading-none">
                {{ card.value }}
              </span>
              <Badge :variant="getBadgeVariant(card.health.label)">
                {{ card.health.label }}
              </Badge>
            </div>
          </div>
        </Card>
      </section>

      <!-- Workspace layout: Single Column Workspace -->
      <div class="mt-3 w-full min-w-0">
        <div class="space-y-3 min-w-0">
          <!-- Toolbar Card -->
          <Card padding="sm" class="workbench-toolbar-card">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div class="overflow-x-auto scrollbar-hide shrink-0 max-w-full">
                <Tabs v-model="statusFilter" :options="tabOptions" size="sm" />
              </div>

              <!-- Filter count info -->
              <div class="flex items-center gap-3 shrink-0">
                <div class="text-[10px] font-bold text-slate-400 shrink-0">
                  已过滤:
                  <span class="text-blue-500 font-extrabold">{{ filteredSources.length }}</span> /
                  总计: {{ sources.length }}
                </div>
              </div>
            </div>
          </Card>

          <!-- Loading State -->
          <div v-if="isLoading" class="flex items-center justify-center py-20">
            <Loader2 class="w-6 h-6 animate-spin text-blue-500" />
            <span class="ml-2 text-slate-500">加载中...</span>
          </div>

          <div v-else-if="sources.length === 0" class="max-w-4xl mx-auto py-12 px-4">
            <div class="text-center mb-10">
              <div
                class="inline-flex p-4 bg-gradient-to-tr from-blue-500/10 to-indigo-500/10 rounded-2xl border border-blue-500/20 mb-6 shadow-inner relative group"
              >
                <div
                  class="absolute inset-0 bg-blue-500/5 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"
                ></div>
                <Globe
                  class="w-12 h-12 text-blue-500 relative z-10 animate-[spin_60s_linear_infinite]"
                />
              </div>
              <h2 class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                开启您的 3D 资产同步之旅
              </h2>
              <p
                class="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto leading-relaxed"
              >
                通过配置镜像源，您可以将外部平台的 3D
                模型、设计材质、系统课程一键本地化，创建专属于您的云学习平台工作区。
              </p>
            </div>

            <!-- Feature Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div
                class="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 hover:border-blue-500/40 transition-all duration-300 shadow-sm flex flex-col items-center text-center"
              >
                <div class="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-500 mb-4">
                  <Database class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  3D 资产自动抓取
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  支持自动探测并抓取远端平台的模型详情与元数据，保持本地库与时俱进。
                </p>
              </div>

              <div
                class="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 hover:border-indigo-500/40 transition-all duration-300 shadow-sm flex flex-col items-center text-center"
              >
                <div class="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-indigo-500 mb-4">
                  <Layers class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  独立工作空间映射
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  为每个镜像源生成专属前台工作空间，自定义独立分类展示与权限配置。
                </p>
              </div>

              <div
                class="p-5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 hover:border-violet-500/40 transition-all duration-300 shadow-sm flex flex-col items-center text-center"
              >
                <div class="p-3 bg-violet-50 dark:bg-violet-500/10 rounded-xl text-violet-500 mb-4">
                  <Sparkles class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                  富媒体深度本地化
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  智能提取详情页及文章结构，并将图片、文件离线下载至本地，极速秒开。
                </p>
              </div>
            </div>

            <div class="text-center">
              <button
                type="button"
                class="relative inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 duration-200"
                @click="openCreate"
              >
                <Plus class="w-5 h-5" />
                配置首个镜像同步源
              </button>
            </div>
          </div>

          <div v-else class="space-y-4">
            <div
              v-for="source in filteredSources"
              :key="source.id"
              class="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden"
            >
              <div class="p-4 sm:p-5">
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div class="flex items-start gap-4 flex-1 min-w-0">
                    <div
                      class="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/20 text-violet-500 flex items-center justify-center shrink-0 border border-violet-100 dark:border-violet-950/50 overflow-hidden"
                    >
                      <img
                        v-if="source.iconUrl"
                        alt=""
                        :src="getAssetUrl(source.iconUrl)"
                        class="w-full h-full object-cover"
                      />
                      <Globe v-else class="w-6 h-6" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-2 mb-2">
                        <h3 class="font-semibold text-slate-900 dark:text-white text-base truncate">
                          {{ source.displayName }}
                        </h3>
                        <div class="flex flex-wrap gap-1.5">
                          <span
                            class="px-2 py-0.5 text-xs rounded-full"
                            :class="
                              statusLabels[source.status]?.color || 'text-slate-400 bg-slate-100'
                            "
                          >
                            {{ statusLabels[source.status]?.label || source.status }}
                          </span>
                          <span
                            v-if="source.syncStatus === 'SYNCING'"
                            class="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-blue-500 bg-blue-50 dark:bg-blue-500/10"
                          >
                            <Loader2 class="w-3 h-3 animate-spin" />
                            同步中
                          </span>
                          <span
                            v-else-if="source.syncStatus === 'ERROR'"
                            class="px-2 py-0.5 text-xs rounded-full text-red-500 bg-red-50 dark:bg-red-500/10"
                          >
                            异常
                          </span>
                        </div>
                      </div>
                      <p class="text-xs text-slate-400 flex items-center gap-1 mb-1 truncate">
                        <Globe class="w-3 h-3 flex-shrink-0" />
                        {{ source.baseUrl }}
                      </p>
                      <p class="text-xs text-slate-400">适配器: {{ source.adapterType }}</p>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-1.5 sm:self-start">
                    <span
                      v-if="source.adapterType === 'MANUAL'"
                      class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 mr-1.5"
                    >
                      <Sparkles class="w-3.5 h-3.5" />
                      手动资产站
                    </span>

                    <template v-if="source.adapterType !== 'MANUAL'">
                      <button
                        type="button"
                        class="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                        :class="
                          source.syncStatus === 'SYNCING' ? 'opacity-50 pointer-events-none' : ''
                        "
                        title="全量同步"
                        @click="triggerSync(source.id, 'FULL')"
                      >
                        <RefreshCw
                          class="w-4 h-4"
                          :class="source.syncStatus === 'SYNCING' ? 'animate-spin' : ''"
                        />
                      </button>

                      <!-- Start / Stop Button -->
                      <button
                        v-if="source.syncStatus === 'SYNCING'"
                        type="button"
                        class="p-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        title="停止同步"
                        @click="cancelSync(source.id)"
                      >
                        <Square class="w-4 h-4" />
                      </button>
                      <button
                        v-else
                        type="button"
                        class="p-2 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
                        title="增量同步"
                        @click="triggerSync(source.id, 'INCREMENTAL')"
                      >
                        <Play class="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        class="p-2 rounded-lg text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                        title="同步日志"
                        @click="viewSyncLogs(source)"
                      >
                        <History class="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        class="p-2 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                        title="匹配提取链接"
                        @click="openMatchLinks(source)"
                      >
                        <Link2 class="w-4 h-4" />
                      </button>
                    </template>

                    <button
                      type="button"
                      class="p-2 rounded-lg transition-colors"
                      :class="
                        expandedSourceId === source.id
                          ? 'text-cyan-500 bg-cyan-50 dark:bg-cyan-500/10'
                          : 'text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-500/10'
                      "
                      title="管理资源"
                      @click="toggleResourcePanel(source)"
                    >
                      <Database class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      class="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                      title="清理空间"
                      @click="cleanupSource(source)"
                    >
                      <Eraser class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      class="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                      title="导出"
                      @click="exportSource(source)"
                    >
                      <Download class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      class="p-2 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                      title="编辑"
                      @click="openEdit(source)"
                    >
                      <Edit3 class="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="删除"
                      @click="deleteSource(source)"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <!-- 同步进度条 -->
                <div
                  v-if="progressMap[source.id]"
                  class="mt-4 p-3 bg-blue-50 dark:bg-blue-500/5 rounded-lg border border-blue-100 dark:border-blue-500/10"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {{ progressMap[source.id].type === 'FULL' ? '全量同步' : '增量同步' }}进行中
                    </span>
                    <span class="text-xs text-blue-500">
                      {{ progressMap[source.id].estimatedProgress }}%
                    </span>
                  </div>
                  <div
                    class="w-full h-2 bg-blue-100 dark:bg-blue-500/20 rounded-full overflow-hidden"
                  >
                    <div
                      class="h-full bg-blue-500 rounded-full transition-all duration-500"
                      :style="{ width: `${progressMap[source.id].estimatedProgress}%` }"
                    ></div>
                  </div>
                  <div class="flex flex-wrap gap-3 mt-2 text-xs text-blue-500 dark:text-blue-400">
                    <span v-if="progressMap[source.id].phase">
                      阶段:
                      {{
                        progressMap[source.id].phase === 'CATEGORIES'
                          ? '分类'
                          : progressMap[source.id].phase === 'LISTING'
                            ? '列表'
                            : '详情'
                      }}
                    </span>
                    <span v-if="progressMap[source.id].currentCategory">
                      分类: {{ progressMap[source.id].currentCategory }} ({{
                        progressMap[source.id].currentCategoryIndex
                      }}/{{ progressMap[source.id].totalCategories }})
                    </span>
                    <span>第 {{ progressMap[source.id].currentPage }} 页</span>
                    <span>发现 {{ progressMap[source.id].resourcesFound }} 个</span>
                    <span class="text-emerald-500"
                      >新增 {{ progressMap[source.id].resourcesCreated }}</span
                    >
                    <span class="text-amber-500"
                      >更新 {{ progressMap[source.id].resourcesUpdated }}</span
                    >
                    <span v-if="progressMap[source.id].totalDetailsToFetch > 0">
                      详情: {{ progressMap[source.id].detailsFetched }}/{{
                        progressMap[source.id].totalDetailsToFetch
                      }}
                    </span>
                    <span>已用 {{ formatElapsed(progressMap[source.id].startedAt) }}</span>
                  </div>
                </div>

                <!-- 同步信息 (仅非手动同步源显示) -->
                <div
                  v-if="source.adapterType !== 'MANUAL'"
                  class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400"
                >
                  <span class="flex items-center gap-1">
                    <Clock class="w-3.5 h-3.5" />
                    上次同步: {{ formatTime(source.lastSyncAt) }}
                  </span>
                  <span>耗时: {{ formatDuration(source.lastSyncDuration) }}</span>
                  <span>权限: {{ getPlanName(source.minPlanPriority) }}以上</span>
                  <span>同步间隔: {{ Math.floor(source.syncInterval / 60) }}分钟</span>
                </div>
              </div>

              <!-- Resource Management Panel -->
              <div
                v-if="expandedSourceId === source.id"
                class="border-t border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/10"
              >
                <div class="p-4 sm:p-5">
                  <!-- Tab Navigation for Mirror Sources -->
                  <div class="flex border-b border-slate-200 dark:border-slate-700/60 mb-5 gap-6">
                    <button
                      type="button"
                      class="pb-2.5 text-sm font-semibold transition-all border-b-2 px-1 focus:outline-none flex items-center gap-1.5"
                      :class="
                        expandedTab === 'resources'
                          ? 'text-cyan-500 border-cyan-500'
                          : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                      "
                      @click="expandedTab = 'resources'"
                    >
                      <FileText class="w-4 h-4" />
                      资源管理
                    </button>
                    <button
                      type="button"
                      class="pb-2.5 text-sm font-semibold transition-all border-b-2 px-1 focus:outline-none flex items-center gap-1.5"
                      :class="
                        expandedTab === 'categories'
                          ? 'text-cyan-500 border-cyan-500'
                          : 'text-slate-400 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
                      "
                      @click="expandedTab = 'categories'"
                    >
                      <Layers class="w-4 h-4" />
                      分类管理
                    </button>
                  </div>

                  <!-- Resource Management Content -->
                  <div v-if="expandedTab === 'resources'" class="space-y-4">
                    <!-- Header -->
                    <div
                      class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4"
                    >
                      <h4
                        class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"
                      >
                        <FileText class="w-4 h-4 text-cyan-500" />
                        资源管理
                        <span class="text-xs text-slate-400 font-normal"
                          >共 {{ resourceTotal }} 个</span
                        >
                      </h4>
                      <div class="flex items-center gap-2">
                        <div class="relative">
                          <Search
                            class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                          />
                          <input
                            v-model="resourceSearch"
                            type="text"
                            placeholder="搜索资源..."
                            class="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 w-48"
                            @keyup.enter="doResourceSearch"
                          />
                        </div>
                        <select
                          v-model="resourceCategoryFilter"
                          class="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                          @change="doResourceSearch"
                        >
                          <option :value="null">全部分类</option>
                          <option
                            v-for="cat in formattedMirrorCategories"
                            :key="cat.id"
                            :value="cat.id"
                          >
                            {{ cat.name }}
                          </option>
                        </select>
                        <button
                          type="button"
                          class="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition-colors"
                          @click="openCreateResource"
                        >
                          <Plus class="w-3.5 h-3.5" />
                          新增资源
                        </button>
                      </div>
                    </div>

                    <!-- Loading -->
                    <div v-if="isLoadingResources" class="flex items-center justify-center py-10">
                      <Loader2 class="w-5 h-5 animate-spin text-cyan-500" />
                      <span class="ml-2 text-sm text-slate-500">加载资源...</span>
                    </div>

                    <!-- Empty -->
                    <div v-else-if="resourceList.length === 0" class="text-center py-10">
                      <Database class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p class="text-sm text-slate-400">暂无资源数据</p>
                    </div>

                    <!-- Resource Table -->
                    <div v-else class="overflow-x-auto">
                      <table class="w-full text-xs">
                        <thead>
                          <tr class="border-b border-slate-200 dark:border-slate-700">
                            <th class="text-left py-2 px-2 text-slate-500 font-medium">标题</th>
                            <th
                              class="text-left py-2 px-2 text-slate-500 font-medium hidden md:table-cell"
                            >
                              分类
                            </th>
                            <th
                              class="text-left py-2 px-2 text-slate-500 font-medium hidden sm:table-cell"
                            >
                              类型
                            </th>
                            <th
                              class="text-center py-2 px-2 text-slate-500 font-medium hidden sm:table-cell"
                            >
                              浏览
                            </th>
                            <th
                              class="text-center py-2 px-2 text-slate-500 font-medium hidden lg:table-cell"
                            >
                              链接
                            </th>
                            <th class="text-right py-2 px-2 text-slate-500 font-medium">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="res in resourceList"
                            :key="res.id"
                            class="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td class="py-2.5 px-2">
                              <div class="flex items-center gap-2 max-w-xs">
                                <img
                                  v-if="res.thumbnailUrl"
                                  alt=""
                                  :src="res.thumbnailUrl"
                                  class="w-8 h-8 rounded object-cover flex-shrink-0 bg-slate-100 dark:bg-slate-700"
                                />
                                <div
                                  v-else
                                  class="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0"
                                >
                                  <FileText class="w-3.5 h-3.5 text-slate-400" />
                                </div>
                                <span
                                  class="text-slate-800 dark:text-slate-200 font-medium truncate"
                                  >{{ res.title }}</span
                                >
                              </div>
                            </td>
                            <td class="py-2.5 px-2 text-slate-500 hidden md:table-cell">
                              {{ res.category?.name || '-' }}
                            </td>
                            <td class="py-2.5 px-2 hidden sm:table-cell">
                              <span
                                class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-500"
                                >{{ res.resourceType }}</span
                              >
                            </td>
                            <td class="py-2.5 px-2 text-center text-slate-500 hidden sm:table-cell">
                              {{ res.viewCount }}
                            </td>
                            <td class="py-2.5 px-2 text-center hidden lg:table-cell">
                              <span v-if="res.contentUrl" class="text-emerald-500">✓</span>
                              <span v-else class="text-slate-300">-</span>
                            </td>
                            <td class="py-2.5 px-2">
                              <div class="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  class="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                                  title="编辑"
                                  @click="openEditResource(res)"
                                >
                                  <Edit3 class="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  class="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                  title="删除"
                                  @click="deleteResource(res)"
                                >
                                  <Trash2 class="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      <!-- Pagination -->
                      <div
                        v-if="resourceTotalPages > 1"
                        class="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/30"
                      >
                        <span class="text-xs text-slate-400"
                          >第 {{ resourcePage }}/{{ resourceTotalPages }} 页，共
                          {{ resourceTotal }} 条</span
                        >
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            :disabled="resourcePage <= 1"
                            @click="changeResourcePage(resourcePage - 1)"
                          >
                            <ChevronLeft class="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                            :disabled="resourcePage >= resourceTotalPages"
                            @click="changeResourcePage(resourcePage + 1)"
                          >
                            <ChevronRight class="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Category Management View -->
                  <div v-if="expandedTab === 'categories'" class="space-y-4">
                    <div class="flex items-center justify-between">
                      <h4
                        class="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2"
                      >
                        <Layers class="w-4 h-4 text-cyan-500" />
                        分类管理
                        <span class="text-xs text-slate-400 font-normal"
                          >共 {{ sourceCategories.length }} 个分类</span
                        >
                      </h4>
                      <button
                        type="button"
                        class="flex items-center gap-1 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium rounded-lg transition-colors"
                        @click="openCreateCategory"
                      >
                        <Plus class="w-3.5 h-3.5" />
                        新增分类
                      </button>
                    </div>

                    <div v-if="sourceCategories.length === 0" class="text-center py-10">
                      <Layers class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p class="text-sm text-slate-400">暂无分类数据，请先创建分类</p>
                    </div>

                    <div v-else class="overflow-x-auto">
                      <table class="w-full text-xs">
                        <thead>
                          <tr class="border-b border-slate-200 dark:border-slate-700">
                            <th class="text-left py-2 px-2 text-slate-500 font-medium">名称</th>
                            <th class="text-left py-2 px-2 text-slate-500 font-medium">父级分类</th>
                            <th class="text-left py-2 px-2 text-slate-500 font-medium">
                              Slug (别名)
                            </th>
                            <th class="text-center py-2 px-2 text-slate-500 font-medium">
                              排序权重 (Order)
                            </th>
                            <th class="text-right py-2 px-2 text-slate-500 font-medium">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="cat in sourceCategories"
                            :key="cat.id"
                            class="border-b border-slate-100 dark:border-slate-700/30 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td class="py-2.5 px-2 font-medium text-slate-800 dark:text-slate-200">
                              {{ cat.name }}
                            </td>
                            <td class="py-2.5 px-2 text-slate-500">
                              {{ getParentCategoryName(cat) }}
                            </td>
                            <td class="py-2.5 px-2 text-slate-500">{{ cat.slug || '-' }}</td>
                            <td class="py-2.5 px-2 text-center text-slate-500">
                              {{ cat.order ?? 0 }}
                            </td>
                            <td class="py-2.5 px-2">
                              <div class="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  class="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                                  title="编辑"
                                  @click="openEditCategory(cat)"
                                >
                                  <Edit3 class="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  class="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                  title="删除"
                                  @click="deleteCategory(cat)"
                                >
                                  <Trash2 class="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <Teleport to="body">
      <!-- Hidden Input for Zip Import -->
      <input
        ref="importFileInput"
        type="file"
        accept=".zip"
        class="hidden"
        @change="handleImportFile"
      />
      <MirrorSourceDialog
        v-model="showSourceDialog"
        :source="editingSource"
        @saved="onSourceSaved"
      />

      <MirrorSyncLogsDialog v-model="showSyncLogsDialog" :source="editingSource" />

      <!-- Match Links Dialog -->
      <Modal
        :show="showMatchDialog"
        size="sm"
        glass-card
        padding="md"
        @close="showMatchDialog = false"
      >
        <template #header>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Link2 class="w-5 h-5 text-indigo-500" />
            匹配提取链接 - {{ selectedSource?.displayName }}
          </h2>
        </template>

        <div class="space-y-4">
          <div
            class="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400 space-y-1.5"
          >
            <p class="font-bold text-slate-700 dark:text-slate-300">💡 上传说明：</p>
            <p>
              1. 支持 <strong class="text-slate-700 dark:text-slate-300">.xlsx</strong> 格式的 Excel
              数据。
            </p>
            <p>2. 数据表中应包含以下列头名称：</p>
            <ul class="list-disc pl-4 space-y-0.5 mt-1 text-slate-600 dark:text-slate-400">
              <li><strong class="text-indigo-500">课程名称</strong>（用于匹配系统内已有课程）</li>
              <li><strong class="text-indigo-500">链接</strong>（如百度网盘、夸克网盘链接）</li>
              <li><strong class="text-indigo-500">链接密码</strong> / 提取码（选填）</li>
              <li>
                <strong class="text-indigo-500">课程备注</strong> / 备注（包含原站链接如
                zycku.com/xxxx.html 可实现100%精准匹配）
              </li>
            </ul>
          </div>

          <div
            class="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-6 text-center cursor-pointer transition-all relative"
          >
            <input
              type="file"
              accept=".xlsx"
              multiple
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              @change="handleFileChange"
            />
            <div class="flex flex-col items-center justify-center space-y-2">
              <div class="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-full text-indigo-500">
                <Database class="w-6 h-6 animate-pulse" />
              </div>
              <div class="text-sm font-medium text-slate-700 dark:text-slate-200">
                点击或拖拽上传 Excel 文件
              </div>
              <div class="text-xs text-slate-400">支持多选，仅限 .xlsx 格式文件</div>
            </div>
          </div>

          <!-- Selected Files List -->
          <div v-if="excelFiles.length > 0" class="space-y-1.5 max-h-48 overflow-y-auto p-0.5">
            <div
              class="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between px-1"
            >
              <span>已选择的文件 ({{ excelFiles.length }})</span>
              <button
                type="button"
                class="text-indigo-500 hover:text-indigo-600 transition-colors"
                @click="excelFiles = []"
              >
                清空全部
              </button>
            </div>
            <div
              v-for="(file, index) in excelFiles"
              :key="file.name + '-' + file.size + '-' + index"
              class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-lg text-xs"
            >
              <div class="flex items-center gap-2 overflow-hidden mr-2">
                <FileText class="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span
                  class="text-slate-700 dark:text-slate-300 truncate font-medium max-w-[200px]"
                  :title="file.name"
                  >{{ file.name }}</span
                >
                <span class="text-slate-400 flex-shrink-0"
                  >({{ (file.size / 1024).toFixed(1) }} KB)</span
                >
              </div>
              <button
                type="button"
                class="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex-shrink-0"
                @click="removeFile(index)"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Match Results -->
          <div
            v-if="matchResult"
            class="p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-lg text-sm text-emerald-600 dark:text-emerald-400"
          >
            <p class="font-semibold flex items-center gap-1.5 mb-1">
              <Sparkles class="w-4 h-4 text-emerald-500" />
              自动匹配完成！
            </p>
            <div class="grid grid-cols-2 gap-4 mt-2">
              <div
                class="bg-white dark:bg-slate-800/40 p-2.5 rounded-lg border border-emerald-100/50 dark:border-emerald-500/5 text-center"
              >
                <div class="text-xs text-slate-400">发现课程链接</div>
                <div class="text-lg font-bold text-slate-800 dark:text-slate-200">
                  {{ matchResult.totalLinks }}
                </div>
              </div>
              <div
                class="bg-white dark:bg-slate-800/40 p-2.5 rounded-lg border border-emerald-100/50 dark:border-emerald-500/5 text-center"
              >
                <div class="text-xs text-slate-400">成功匹配绑定</div>
                <div class="text-lg font-bold text-emerald-500">
                  {{ matchResult.matchedCount }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            :disabled="isUploading"
            @click="showMatchDialog = false"
          >
            关闭
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-500"
            :disabled="excelFiles.length === 0 || isUploading"
            @click="uploadAndMatch"
          >
            <Loader2 v-if="isUploading" class="w-4 h-4 animate-spin" />
            {{ isUploading ? '匹配中...' : '开始匹配' }}
          </button>
        </template>
      </Modal>
      <!-- Resource Create/Edit Dialog -->
      <Modal
        :show="showResourceDialog"
        size="lg"
        glass-card
        padding="md"
        @close="showResourceDialog = false"
      >
        <template #header>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText class="w-5 h-5 text-cyan-500" />
            {{ isEditingResource ? '编辑资源' : '新增资源' }}
          </h2>
        </template>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >标题 <span class="text-red-400">*</span></label
            >
            <input
              v-model="resourceForm.title"
              type="text"
              placeholder="资源标题"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >描述</label
            >
            <textarea
              v-model="resourceForm.description"
              rows="2"
              placeholder="资源描述..."
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 resize-none"
            ></textarea>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >分类</label
              >
              <select
                v-model="resourceForm.categoryId"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                <option value="">未分类</option>
                <option v-for="cat in formattedMirrorCategories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                >资源类型</label
              >
              <input
                v-model="resourceForm.resourceType"
                type="text"
                placeholder="COURSE"
                class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >缩略图URL</label
            >
            <input
              v-model="resourceForm.thumbnailUrl"
              type="text"
              placeholder="https://..."
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >网盘链接 (contentUrl)</label
            >
            <input
              v-model="resourceForm.contentUrl"
              type="text"
              placeholder="网盘下载链接..."
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >标签</label
            >
            <input
              v-model="resourceForm.tags"
              type="text"
              placeholder='JSON数组格式, 如: ["3D", "教程"]'
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >正文 HTML</label
            >
            <textarea
              v-model="resourceForm.contentHtml"
              rows="6"
              placeholder="HTML内容..."
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 resize-none font-mono text-xs"
            ></textarea>
          </div>
        </div>

        <template #footer>
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            @click="showResourceDialog = false"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
            @click="saveResource"
          >
            {{ isEditingResource ? '保存' : '创建' }}
          </button>
        </template>
      </Modal>

      <!-- Category Create/Edit Dialog -->
      <Modal
        :show="showCategoryDialog"
        size="sm"
        glass-card
        padding="md"
        @close="showCategoryDialog = false"
      >
        <template #header>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers class="w-5 h-5 text-cyan-500" />
            {{ isEditingCategory ? '编辑分类' : '新增分类' }}
          </h2>
        </template>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >分类名称 <span class="text-red-400">*</span></label
            >
            <input
              v-model="categoryForm.name"
              type="text"
              placeholder="例如: 3D模型"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >父级分类
              <span class="text-xs text-slate-400 font-normal"
                >（可选，用于侧边栏分组）</span
              ></label
            >
            <select
              v-model="categoryForm.parentExternalId"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            >
              <option :value="null">无（作为一级分类/大类）</option>
              <option v-for="cat in parentCategoryOptions" :key="cat.id" :value="cat.externalId">
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div
            v-if="!categoryForm.parentExternalId && eligibleSubcategories.length > 0"
            class="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1"
          >
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >分配子分类
              <span class="text-xs text-slate-400 font-normal"
                >（从现有分类中选择归属于本大类）</span
              ></label
            >
            <div
              class="max-h-36 overflow-y-auto border border-slate-200/60 dark:border-slate-800/80 rounded-lg p-2.5 bg-slate-50/50 dark:bg-slate-900/30 space-y-1.5 scrollbar-hide"
            >
              <div
                v-for="cat in eligibleSubcategories"
                :key="cat.id"
                class="flex items-center gap-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 p-1 rounded-lg transition-colors"
              >
                <input
                  :id="'subcat-' + cat.id"
                  v-model="categoryForm.childExternalIds"
                  type="checkbox"
                  :value="cat.externalId"
                  class="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
                />
                <label
                  :for="'subcat-' + cat.id"
                  class="text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer select-none flex-1"
                >
                  {{ cat.name }}
                  <span
                    v-if="cat.parentExternalId"
                    class="text-[9px] text-slate-400 dark:text-slate-500 ml-1"
                  >
                    (当前父: {{ getParentCategoryName(cat) }})
                  </span>
                </label>
              </div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >Slug (别名) <span class="text-xs text-slate-400 font-normal">（可选）</span></label
            >
            <input
              v-model="categoryForm.slug"
              type="text"
              placeholder="例如: 3d-models"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
              >排序权重 (Order)
              <span class="text-xs text-slate-400 font-normal">（越小越靠前）</span></label
            >
            <input
              v-model.number="categoryForm.order"
              type="number"
              placeholder="0"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400"
            />
          </div>
        </div>

        <template #footer>
          <button
            type="button"
            class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            @click="showCategoryDialog = false"
          >
            取消
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
            @click="saveCategory"
          >
            {{ isEditingCategory ? '保存' : '创建' }}
          </button>
        </template>
      </Modal>

      <!-- Cloud Mirror Discovery Dialog -->
      <Modal :show="showCloudScanDialog" size="xl" glass-card @close="showCloudScanDialog = false">
        <template #header>
          <div class="flex items-center gap-2">
            <Search class="w-5 h-5 text-blue-500" />
            <h3 class="text-lg font-semibold text-[var(--text-primary)]">
              扫描云端镜像源 (Cloudflare R2)
            </h3>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-xs text-slate-500 dark:text-slate-400">
            系统将自动检索 Cloudflare R2
            存储桶中已同步的镜像站数据（`metadata.json`），您可以一键将其接入当前系统，无需重复下载或上传媒体文件，共享云端存储。
          </p>

          <!-- Loading State -->
          <div v-if="isScanningCloud" class="flex flex-col items-center justify-center py-12">
            <RefreshCw class="w-8 h-8 text-blue-500 animate-spin mb-3" />
            <span class="text-sm text-slate-500 dark:text-slate-400"
              >正在扫描云端存储中，这可能需要几秒钟...</span
            >
          </div>

          <!-- Empty State -->
          <div
            v-else-if="cloudSources.length === 0"
            class="flex flex-col items-center justify-center py-12 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl"
          >
            <Database class="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
            <span class="text-sm text-slate-500 dark:text-slate-400"
              >未在 Cloudflare R2 存储桶中扫描到任何镜像源</span
            >
          </div>

          <!-- Discovered List Table -->
          <div
            v-else
            class="border border-slate-100 dark:border-slate-700/80 rounded-xl overflow-hidden"
          >
            <table class="w-full text-left border-collapse">
              <thead>
                <tr
                  class="bg-slate-50 dark:bg-slate-800/40 text-[11px] font-black tracking-wider uppercase text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/80"
                >
                  <th class="px-5 py-3">图标</th>
                  <th class="px-5 py-3">镜像源显示名称 / 名称</th>
                  <th class="px-5 py-3">资源数量</th>
                  <th class="px-5 py-3">唯一识别 ID</th>
                  <th class="px-5 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/80 text-xs">
                <tr
                  v-for="item in cloudSources"
                  :key="item.id"
                  class="hover:bg-slate-50/40 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td class="px-5 py-3">
                    <img
                      v-if="item.iconUrl"
                      :src="getAssetUrl(item.iconUrl)"
                      class="w-7 h-7 rounded-lg object-cover bg-slate-100 dark:bg-slate-700"
                    />
                    <div
                      v-else
                      class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-[10px]"
                    >
                      {{ item.displayName.charAt(0) }}
                    </div>
                  </td>
                  <td class="px-5 py-3">
                    <div class="font-bold text-slate-800 dark:text-slate-200">
                      {{ item.displayName }}
                    </div>
                    <div class="text-[10px] text-slate-400 dark:text-slate-500">
                      {{ item.name }}
                    </div>
                  </td>
                  <td class="px-5 py-3 text-slate-600 dark:text-slate-400 font-medium">
                    {{ item.totalResources }} 个资源
                  </td>
                  <td class="px-5 py-3 font-mono text-[10px] text-slate-400 dark:text-slate-500">
                    {{ item.id }}
                  </td>
                  <td class="px-5 py-3 text-right">
                    <Button
                      v-if="item.isConnected"
                      variant="secondary"
                      size="sm"
                      :loading="isConnectingCloud"
                      @click="connectCloudMirror(item.metadataKey)"
                    >
                      重新接入 (更新)
                    </Button>
                    <Button
                      v-else
                      variant="primary"
                      size="sm"
                      :loading="isConnectingCloud"
                      @click="connectCloudMirror(item.metadataKey)"
                    >
                      一键接入
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-between items-center w-full">
            <Button
              variant="secondary"
              size="sm"
              :icon="RefreshCw"
              :loading="isScanningCloud"
              @click="fetchCloudSources"
            >
              重新扫描
            </Button>
            <Button variant="secondary" size="sm" @click="showCloudScanDialog = false">
              关闭
            </Button>
          </div>
        </template>
      </Modal>

      <!-- Import Progress Dialog -->
      <Modal
        :show="showImportProgressDialog"
        size="sm"
        glass-card
        padding="md"
        @close="closeImportDialog"
      >
        <template #header>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Upload class="w-5 h-5 text-cyan-500" />
            导入镜像源
          </h2>
        </template>

        <div class="text-center">
          <!-- Status Icons -->
          <div class="flex justify-center mb-4">
            <div
              v-if="
                importTaskStatus === 'uploading' ||
                importTaskStatus === 'processing' ||
                importTaskStatus === 'extracting' ||
                importTaskStatus === 'importing_metadata' ||
                importTaskStatus === 'copying_files'
              "
              class="p-3 bg-cyan-50 dark:bg-cyan-500/15 rounded-full text-cyan-500"
            >
              <RefreshCw class="w-8 h-8 animate-spin" />
            </div>
            <div
              v-else-if="importTaskStatus === 'completed'"
              class="p-3 bg-emerald-50 dark:bg-emerald-500/15 rounded-full text-emerald-500"
            >
              <Check class="w-8 h-8" />
            </div>
            <div
              v-else-if="importTaskStatus === 'failed'"
              class="p-3 bg-rose-50 dark:bg-rose-500/15 rounded-full text-rose-500"
            >
              <X class="w-8 h-8" />
            </div>
          </div>

          <!-- Status Title -->
          <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">
            <span v-if="importTaskStatus === 'uploading'">正在上传镜像包...</span>
            <span v-else-if="importTaskStatus === 'completed'">导入成功</span>
            <span v-else-if="importTaskStatus === 'failed'">导入失败</span>
            <span v-else>正在同步数据中...</span>
          </h3>

          <!-- Status Text & Details -->
          <p
            class="text-sm text-slate-500 dark:text-slate-400 mb-4 min-h-[40px] flex items-center justify-center text-center break-words"
          >
            {{ importStatusText }}
          </p>

          <!-- Progress Bar -->
          <div
            v-if="importTaskStatus !== 'failed'"
            class="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden mb-2"
          >
            <div
              class="bg-cyan-500 h-2.5 rounded-full transition-all duration-300"
              :style="{ width: importProgress + '%' }"
            ></div>
          </div>
          <div
            v-if="importTaskStatus !== 'failed'"
            class="text-xs text-slate-400 dark:text-slate-500 text-right mb-6"
          >
            {{ importProgress }}%
          </div>

          <!-- Error Message Alert -->
          <div
            v-if="importTaskStatus === 'failed' && importError"
            class="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-lg text-rose-600 dark:text-rose-400 text-sm text-left mb-6 break-all"
          >
            {{ importError }}
          </div>
        </div>

        <template #footer>
          <button
            v-if="importTaskStatus === 'completed' || importTaskStatus === 'failed'"
            type="button"
            class="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
            @click="closeImportDialog"
          >
            确定
          </button>
        </template>
      </Modal>
    </Teleport>
  </div>
</template>
