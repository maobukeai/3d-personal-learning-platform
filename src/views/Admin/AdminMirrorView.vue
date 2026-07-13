<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import type { AxiosProgressEvent } from 'axios';
import { getApiErrorMessage } from '@/utils/error';
import { fetchManagementInsights } from './adminManagementInsights';
import MirrorSourceDialog from './components/MirrorSourceDialog.vue';
import MirrorSyncLogsDialog from './components/MirrorSyncLogsDialog.vue';
import CategoryFormDialog from './components/CategoryFormDialog.vue';
import AdminHeader from './components/AdminHeader.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import { Search, Plus, Upload, RefreshCw, Globe, Loader2, X, Layers } from 'lucide-vue-next';
import MirrorSourceToolbar from './components/MirrorSourceToolbar.vue';
import MirrorSourceList from './components/MirrorSourceList.vue';
import MirrorMatchDialog from './components/MirrorMatchDialog.vue';
import MirrorResourceDialog from './components/MirrorResourceDialog.vue';
import MirrorCloudScanDialog from './components/MirrorCloudScanDialog.vue';
import MirrorImportProgressDialog from './components/MirrorImportProgressDialog.vue';

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

export interface SyncProgress {
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

export interface MirrorResource {
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

export interface MirrorCategory {
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
  } catch {
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
  } catch {
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
        if (importPollInterval) clearInterval(importPollInterval);
        ElMessage.success('镜像源导入成功！');
        fetchSources(); // Refresh sources list
      } else if (task.status === 'failed') {
        if (importPollInterval) clearInterval(importPollInterval);
        importError.value = task.error || '导入失败';
      }
    } catch (error: unknown) {
      if (importPollInterval) clearInterval(importPollInterval);
      importTaskStatus.value = 'failed';
      importError.value = getApiErrorMessage(error, '获取导入状态失败');
    }
  }, 1000);
};

const closeImportDialog = () => {
  showImportProgressDialog.value = false;
  if (importPollInterval) {
    clearInterval(importPollInterval);
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
    clearInterval(importPollInterval);
  }
});
</script>

<template>
  <div
    class="admin-mirror-page mobile-adaptive flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)]"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide">
      <!-- Ultra-Compact Single Row Header -->
      <AdminHeader
        title="镜像源管理"
        :cards="consolidatedCards"
        v-model="mirrorSearchQuery"
        placeholder="搜索镜像源..."
      >
        <template #title-badge>
          <div class="flex flex-wrap items-center gap-1.5">
            <Badge variant="info"> 镜像源数: {{ sources.length }} </Badge>
          </div>
        </template>

        <Button
          variant="primary"
          size="sm"
          :icon="Plus"
          @click="openCreate"
          class="!h-7.5 !text-xs !px-2.5"
        >
          添加镜像源
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :icon="Upload"
          @click="triggerImportFile"
          class="!h-7.5 !text-xs !px-2.5"
        >
          导入镜像源
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :icon="Search"
          @click="openScanCloudDialog"
          class="!h-7.5 !text-xs !px-2.5"
        >
          扫描云端镜像源
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchSources"
          class="!h-7.5 !text-xs !px-2.5"
        >
          刷新
        </Button>
      </AdminHeader>

      <MirrorSourceToolbar
        v-model:status-filter="statusFilter"
        :sources="sources"
        :filtered-sources="filteredSources"
      />

      <MirrorSourceList
        v-model:expanded-tab="expandedTab"
        v-model:resource-search="resourceSearch"
        v-model:resource-category-filter="resourceCategoryFilter"
        :sources="sources"
        :filtered-sources="filteredSources"
        :is-loading="isLoading"
        :expanded-source-id="expandedSourceId"
        :progress-map="progressMap"
        :resource-list="resourceList"
        :resource-total="resourceTotal"
        :resource-page="resourcePage"
        :resource-total-pages="resourceTotalPages"
        :is-loading-resources="isLoadingResources"
        :source-categories="sourceCategories"
        :formatted-mirror-categories="formattedMirrorCategories"
        @sync="triggerSync"
        @cancel-sync="cancelSync"
        @view-logs="viewSyncLogs"
        @match-links="openMatchLinks"
        @toggle-resources="toggleResourcePanel"
        @cleanup="cleanupSource"
        @export="exportSource"
        @edit="openEdit"
        @delete="deleteSource"
        @create-source="openCreate"
        @resource-search="doResourceSearch"
        @change-resource-page="changeResourcePage"
        @create-resource="openCreateResource"
        @edit-resource="openEditResource"
        @delete-resource="deleteResource"
        @create-category="openCreateCategory"
        @edit-category="openEditCategory"
        @delete-category="deleteCategory"
      />
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

      <MirrorMatchDialog
        v-model:show="showMatchDialog"
        v-model:files="excelFiles"
        :selected-source="selectedSource"
        :is-uploading="isUploading"
        :match-result="matchResult"
        @upload="uploadAndMatch"
      />

      <MirrorResourceDialog
        v-model:show="showResourceDialog"
        v-model:form="resourceForm"
        :is-editing="isEditingResource"
        :formatted-categories="formattedMirrorCategories"
        @save="saveResource"
      />

      <CategoryFormDialog
        v-model:show="showCategoryDialog"
        v-model:form="categoryForm"
        mode="mirror"
        :parent-category-options="parentCategoryOptions"
        :eligible-subcategories="eligibleSubcategories"
        :categories="sourceCategories"
        @save="saveCategory"
      />

      <MirrorCloudScanDialog
        v-model:show="showCloudScanDialog"
        :is-scanning-cloud="isScanningCloud"
        :is-connecting-cloud="isConnectingCloud"
        :cloud-sources="cloudSources"
        @refresh="fetchCloudSources"
        @connect="connectCloudMirror"
      />

      <MirrorImportProgressDialog
        v-model:show="showImportProgressDialog"
        :import-progress="importProgress"
        :import-status-text="importStatusText"
        :import-error="importError"
        :import-task-status="importTaskStatus"
        @close="closeImportDialog"
      />
    </Teleport>
  </div>
</template>
