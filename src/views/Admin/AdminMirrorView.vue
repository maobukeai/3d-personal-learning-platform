<script setup lang="ts">
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
} from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { getPlanName } from '@/utils/plans';

interface MirrorSource {
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
  latestSync?: any;
}

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

interface SyncLog {
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
const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const showSyncLogsDialog = ref(false);
const showMatchDialog = ref(false);
const editingSource = ref<MirrorSource | null>(null);
const selectedSource = ref<MirrorSource | null>(null);
const syncLogs = ref<SyncLog[]>([]);
const isLoadingLogs = ref(false);
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

const adapterTypes = [
  { label: 'Zycku (资源酷)', value: 'ZYCKU' },
  { label: '通用 WordPress', value: 'GENERIC_WP' },
  { label: '手动上传 (资产站)', value: 'MANUAL' },
];

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '启用', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  PAUSED: { label: '暂停', color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
  ERROR: { label: '异常', color: 'text-red-500 bg-red-50 dark:bg-red-500/10' },
};

const formData = ref({
  name: '',
  displayName: '',
  baseUrl: '',
  adapterType: 'ZYCKU',
  syncInterval: 3600,
  minPlanPriority: 1,
  description: '',
  iconUrl: '',
  syncConfig: '',
});

function resetForm() {
  formData.value = {
    name: '',
    displayName: '',
    baseUrl: '',
    adapterType: 'ZYCKU',
    syncInterval: 3600,
    minPlanPriority: 1,
    description: '',
    iconUrl: '',
    syncConfig: '',
  };
}

const isUploadingIcon = ref(false);
const handleIconUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    return ElMessage.warning('图标图片大小不能超过 5MB');
  }

  try {
    isUploadingIcon.value = true;
    const formDataObj = new FormData();
    formDataObj.append('mirror_image', file);
    const { data } = await api.post('/api/admin/mirror/upload', formDataObj);
    formData.value.iconUrl = data.url;
    ElMessage.success('图标上传成功');
  } catch (error: any) {
    console.error('Icon upload error:', error);
    ElMessage.error(error.response?.data?.error || '图标上传失败');
  } finally {
    isUploadingIcon.value = false;
    target.value = '';
  }
};

function openCreate() {
  resetForm();
  showCreateDialog.value = true;
}

function openEdit(source: MirrorSource) {
  editingSource.value = source;
  formData.value = {
    name: source.name,
    displayName: source.displayName,
    baseUrl: source.baseUrl,
    adapterType: source.adapterType,
    syncInterval: source.syncInterval,
    minPlanPriority: source.minPlanPriority,
    description: source.description || '',
    iconUrl: source.iconUrl || '',
    syncConfig: source.syncConfig || '',
  };
  showEditDialog.value = true;
}

async function createSource() {
  try {
    await api.post('/api/admin/mirror/sources', {
      ...formData.value,
      syncConfig: formData.value.syncConfig ? JSON.parse(formData.value.syncConfig) : undefined,
    });
    ElMessage.success('镜像源创建成功');
    showCreateDialog.value = false;
    await fetchSources();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '创建失败');
  }
}

async function updateSource() {
  if (!editingSource.value) return;
  try {
    await api.put(`/api/admin/mirror/sources/${editingSource.value.id}`, {
      ...formData.value,
      syncConfig: formData.value.syncConfig ? JSON.parse(formData.value.syncConfig) : undefined,
    });
    ElMessage.success('更新成功');
    showEditDialog.value = false;
    await fetchSources();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '更新失败');
  }
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
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.error || '删除失败');
    }
  }
}

async function triggerSync(sourceId: string, type: 'FULL' | 'INCREMENTAL') {
  try {
    await api.post(`/api/admin/mirror/sources/${sourceId}/sync?type=${type}`);
    ElMessage.success(`${type === 'FULL' ? '全量' : '增量'}同步已触发`);
    await fetchSources();
    startPolling();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '触发同步失败');
  }
}

async function cancelSync(sourceId: string) {
  try {
    await api.post(`/api/admin/mirror/sources/${sourceId}/sync/cancel`);
    ElMessage.success('同步取消已请求');
    await fetchSources();
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '取消同步失败');
  }
}

async function viewSyncLogs(source: MirrorSource) {
  editingSource.value = source;
  showSyncLogsDialog.value = true;
  isLoadingLogs.value = true;
  try {
    const res = await api.get(`/api/admin/mirror/sources/${source.id}/sync-logs?limit=30`);
    syncLogs.value = res.data;
  } catch (e: any) {
    ElMessage.error('加载日志失败');
  } finally {
    isLoadingLogs.value = false;
  }
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
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '匹配失败');
  } finally {
    isUploading.value = false;
  }
}

async function fetchSources() {
  isLoading.value = true;
  try {
    const res = await api.get('/api/admin/mirror/sources');
    sources.value = res.data;
  } catch (e: any) {
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

function formatTime(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
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
    const params: any = { page: resourcePage.value, pageSize: resourcePageSize.value };
    if (resourceSearch.value) params.search = resourceSearch.value;
    if (resourceCategoryFilter.value) params.categoryId = resourceCategoryFilter.value;
    const res = await api.get(`/api/admin/mirror/sources/${sourceId}/resources`, { params });
    resourceList.value = res.data.resources;
    resourceTotal.value = res.data.total;
    resourceTotalPages.value = res.data.totalPages;
  } catch (e: any) {
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
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '操作失败');
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
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.error || '删除失败');
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
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '操作失败');
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
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(e.response?.data?.error || '删除失败');
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

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- 奢华顶栏 (超紧凑高阶版) -->
    <div
      class="relative shrink-0 border-b overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- 极光背景装饰 -->
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-blue-500/10 via-indigo-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1 rounded-xl bg-blue-500/10 text-blue-500 shadow-sm border border-blue-500/20 shrink-0"
          >
            <Globe class="w-4 h-4" />
          </span>
          <h1 class="text-sm font-black tracking-tight shrink-0" style="color: var(--text-primary)">
            镜像源管理
          </h1>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <button
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[11px] transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
            @click="openCreate"
          >
            <Plus class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">添加镜像源</span>
          </button>
          <button
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="fetchSources"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span class="hidden sm:inline">刷新</span>
          </button>
        </div>
      </div>

      <!-- Row 2: 状态与检索 Pills -->
      <div
        class="px-4 sm:px-8 py-2 flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
      >
        <!-- 状态 Pills -->
        <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
          <div class="flex flex-nowrap items-center gap-0.5 sm:gap-1.5 shrink-0">
            <button
              v-for="filter in [
                {
                  key: 'ALL',
                  label: '所有镜像源',
                  count: sources.length,
                  color: 'indigo',
                  icon: Globe,
                },
                {
                  key: 'ACTIVE',
                  label: '启用',
                  count: sources.filter((s) => s.status === 'ACTIVE').length,
                  color: 'emerald',
                  icon: Check,
                },
                {
                  key: 'PAUSED',
                  label: '暂停',
                  count: sources.filter((s) => s.status === 'PAUSED').length,
                  color: 'amber',
                  icon: Square,
                },
                {
                  key: 'ERROR',
                  label: '异常',
                  count: sources.filter((s) => s.status === 'ERROR').length,
                  color: 'rose',
                  icon: X,
                },
              ]"
              :key="filter.key"
              class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0"
              :class="[
                statusFilter === filter.key
                  ? filter.key === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20 font-extrabold shadow-sm'
                    : filter.key === 'PAUSED'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 ring-1 ring-amber-500/20 font-extrabold shadow-sm'
                      : filter.key === 'ERROR'
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 ring-1 ring-rose-500/20 font-extrabold shadow-sm'
                        : 'bg-blue-500/10 text-blue-500 border-blue-500/30 ring-1 ring-blue-500/20 font-extrabold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
              ]"
              @click="statusFilter = filter.key as any"
            >
              <component :is="filter.icon" class="w-2 h-2 sm:w-3 sm:h-3" />
              <span>{{ filter.label }}</span>
              <span class="opacity-60">({{ filter.count }})</span>
            </button>
          </div>
        </div>

        <!-- 检索与统计 -->
        <div
          class="w-full flex items-center justify-between md:justify-end gap-3 md:w-auto shrink-0"
        >
          <div class="relative flex-1 md:flex-none md:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="mirrorSearchQuery"
              type="text"
              placeholder="按名称或显示名搜索镜像源..."
              class="w-full pl-9 pr-3 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-blue-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div class="text-[10px] font-bold text-right shrink-0" style="color: var(--text-muted)">
            已过滤: <span class="text-blue-600 font-extrabold">{{ filteredSources.length }}</span> /
            总计: {{ sources.length }}
          </div>
        </div>
      </div>
    </div>

    <!-- 主体内容区 -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <div class="max-w-[1600px] mx-auto">
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
                      class="p-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                      title="停止同步"
                      @click="cancelSync(source.id)"
                    >
                      <Square class="w-4 h-4" />
                    </button>
                    <button
                      v-else
                      class="p-2 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10 transition-colors"
                      title="增量同步"
                      @click="triggerSync(source.id, 'INCREMENTAL')"
                    >
                      <Play class="w-4 h-4" />
                    </button>
                    <button
                      class="p-2 rounded-lg text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                      title="同步日志"
                      @click="viewSyncLogs(source)"
                    >
                      <History class="w-4 h-4" />
                    </button>
                    <button
                      class="p-2 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                      title="匹配提取链接"
                      @click="openMatchLinks(source)"
                    >
                      <Link2 class="w-4 h-4" />
                    </button>
                  </template>

                  <button
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
                    class="p-2 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                    title="编辑"
                    @click="openEdit(source)"
                  >
                    <Edit3 class="w-4 h-4" />
                  </button>
                  <button
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
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
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
                                class="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                                title="编辑"
                                @click="openEditResource(res)"
                              >
                                <Edit3 class="w-3.5 h-3.5" />
                              </button>
                              <button
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
                          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                          :disabled="resourcePage <= 1"
                          @click="changeResourcePage(resourcePage - 1)"
                        >
                          <ChevronLeft class="w-4 h-4" />
                        </button>
                        <button
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
                                class="p-1.5 rounded text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                                title="编辑"
                                @click="openEditCategory(cat)"
                              >
                                <Edit3 class="w-3.5 h-3.5" />
                              </button>
                              <button
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

        <Teleport to="body">
          <div
            v-if="showCreateDialog || showEditDialog"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            @click.self="
              showCreateDialog = false;
              showEditDialog = false;
            "
          >
            <div
              class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div
                class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700"
              >
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
                  {{ showEditDialog ? '编辑镜像源' : '添加镜像源' }}
                </h2>
                <button
                  class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  @click="
                    showCreateDialog = false;
                    showEditDialog = false;
                  "
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <div class="p-5 space-y-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >名称（英文标识）</label
                  >
                  <input
                    v-model="formData.name"
                    type="text"
                    placeholder="例如: zycku"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >显示名称</label
                  >
                  <input
                    v-model="formData.displayName"
                    type="text"
                    placeholder="例如: 资源酷"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >站点图标 (推荐 1:1 比例)</label
                  >
                  <div class="flex items-center gap-4">
                    <div
                      class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700"
                    >
                      <img
                        v-if="formData.iconUrl"
                        :src="getAssetUrl(formData.iconUrl)"
                        class="w-full h-full object-cover"
                      />
                      <Globe v-else class="w-6 h-6 text-slate-400" />

                      <label
                        class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                      >
                        <Upload v-if="!isUploadingIcon" class="w-5 h-5 text-white" />
                        <Loader2 v-else class="w-5 h-5 text-white animate-spin" />
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="handleIconUpload"
                        />
                      </label>
                    </div>
                    <div class="flex-1 space-y-1.5">
                      <input
                        v-model="formData.iconUrl"
                        type="text"
                        placeholder="或者输入网络图标 URL"
                        class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                      <p class="text-[10px] text-slate-400 dark:text-slate-500 leading-none">
                        推荐尺寸 128x128px，支持 PNG/JPG/WebP，大小不超过 5MB
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >网站地址</label
                  >
                  <input
                    v-model="formData.baseUrl"
                    type="text"
                    placeholder="https://www.zycku.com"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >适配器类型</label
                  >
                  <select
                    v-model="formData.adapterType"
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  >
                    <option v-for="opt in adapterTypes" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                      >访问权限</label
                    >
                    <select
                      v-model="formData.minPlanPriority"
                      class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    >
                      <option :value="0">免费版及以上</option>
                      <option :value="1">VIP及以上</option>
                      <option :value="2">SVIP及以上</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                      >同步间隔(秒)</label
                    >
                    <input
                      v-model.number="formData.syncInterval"
                      type="number"
                      min="600"
                      step="600"
                      class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
                    >描述</label
                  >
                  <textarea
                    v-model="formData.description"
                    rows="2"
                    placeholder="简要描述该镜像源..."
                    class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                  ></textarea>
                </div>
              </div>

              <div
                class="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700"
              >
                <button
                  class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  @click="
                    showCreateDialog = false;
                    showEditDialog = false;
                  "
                >
                  取消
                </button>
                <button
                  v-if="showCreateDialog"
                  class="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
                  @click="createSource"
                >
                  创建
                </button>
                <button
                  v-else
                  class="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
                  @click="updateSource"
                >
                  保存
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="showSyncLogsDialog"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            @click.self="showSyncLogsDialog = false"
          >
            <div
              class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div
                class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700"
              >
                <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
                  同步日志 - {{ editingSource?.displayName }}
                </h2>
                <button
                  class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  @click="showSyncLogsDialog = false"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <div class="flex-1 overflow-y-auto p-5">
                <div v-if="isLoadingLogs" class="flex items-center justify-center py-10">
                  <Loader2 class="w-5 h-5 animate-spin text-blue-500" />
                  <span class="ml-2 text-sm text-slate-500">加载日志...</span>
                </div>

                <div v-else-if="syncLogs.length === 0" class="text-center py-10">
                  <p class="text-slate-500">暂无同步记录</p>
                </div>

                <div v-else class="space-y-3">
                  <div
                    v-for="log in syncLogs"
                    :key="log.id"
                    class="p-4 rounded-lg border border-slate-200 dark:border-slate-700"
                    :class="
                      log.status === 'FAILED'
                        ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/30'
                    "
                  >
                    <div
                      class="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2"
                    >
                      <div class="flex items-center gap-2">
                        <span
                          class="px-2 py-0.5 text-xs rounded-full font-medium"
                          :class="
                            log.type === 'FULL'
                              ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600'
                              : 'bg-green-100 dark:bg-green-500/20 text-green-600'
                          "
                        >
                          {{ log.type === 'FULL' ? '全量同步' : '增量同步' }}
                        </span>
                        <span
                          class="px-2 py-0.5 text-xs rounded-full font-medium"
                          :class="
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600'
                              : log.status === 'FAILED'
                                ? 'bg-red-100 dark:bg-red-500/20 text-red-600'
                                : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                          "
                        >
                          {{
                            log.status === 'SUCCESS'
                              ? '成功'
                              : log.status === 'FAILED'
                                ? '失败'
                                : '进行中'
                          }}
                        </span>
                      </div>
                      <span class="text-xs text-slate-400">{{ formatTime(log.startedAt) }}</span>
                    </div>

                    <div
                      v-if="log.error"
                      class="text-xs text-red-500 mb-2 p-2 bg-red-50 dark:bg-red-500/10 rounded"
                    >
                      {{ log.error }}
                    </div>

                    <div
                      v-if="log.status !== 'RUNNING'"
                      class="flex flex-wrap gap-3 text-xs text-slate-500"
                    >
                      <span>发现 {{ log.resourcesFound }} 个</span>
                      <span class="text-emerald-500">新增 {{ log.resourcesCreated }}</span>
                      <span class="text-amber-500">更新 {{ log.resourcesUpdated }}</span>
                      <span class="text-red-400">删除 {{ log.resourcesDeleted }}</span>
                      <span v-if="log.duration">耗时 {{ formatDuration(log.duration) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Match Links Dialog -->
          <div
            v-if="showMatchDialog"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            @click.self="showMatchDialog = false"
          >
            <div
              class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md mx-4 shadow-2xl overflow-hidden"
            >
              <div
                class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700"
              >
                <h2
                  class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"
                >
                  <Link2 class="w-5 h-5 text-indigo-500" />
                  匹配提取链接 - {{ selectedSource?.displayName }}
                </h2>
                <button
                  class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  @click="showMatchDialog = false"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <div class="p-5 space-y-4">
                <div
                  class="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-lg text-xs text-slate-500 dark:text-slate-400 space-y-1.5"
                >
                  <p class="font-bold text-slate-700 dark:text-slate-300">💡 上传说明：</p>
                  <p>
                    1. 支持 <strong class="text-slate-700 dark:text-slate-300">.xlsx</strong> 格式的
                    Excel 数据。
                  </p>
                  <p>2. 数据表中应包含以下列头名称：</p>
                  <ul class="list-disc pl-4 space-y-0.5 mt-1 text-slate-600 dark:text-slate-400">
                    <li>
                      <strong class="text-indigo-500">课程名称</strong>（用于匹配系统内已有课程）
                    </li>
                    <li>
                      <strong class="text-indigo-500">链接</strong>（如百度网盘、夸克网盘链接）
                    </li>
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
                    <div
                      class="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-full text-indigo-500"
                    >
                      <Database class="w-6 h-6 animate-pulse" />
                    </div>
                    <div class="text-sm font-medium text-slate-700 dark:text-slate-200">
                      点击或拖拽上传 Excel 文件
                    </div>
                    <div class="text-xs text-slate-400">支持多选，仅限 .xlsx 格式文件</div>
                  </div>
                </div>

                <!-- Selected Files List -->
                <div
                  v-if="excelFiles.length > 0"
                  class="space-y-1.5 max-h-48 overflow-y-auto p-0.5"
                >
                  <div
                    class="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between px-1"
                  >
                    <span>已选择的文件 ({{ excelFiles.length }})</span>
                    <button
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

              <div
                class="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
              >
                <button
                  class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  :disabled="isUploading"
                  @click="showMatchDialog = false"
                >
                  关闭
                </button>
                <button
                  class="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
                  :disabled="excelFiles.length === 0 || isUploading"
                  @click="uploadAndMatch"
                >
                  <Loader2 v-if="isUploading" class="w-4 h-4 animate-spin" />
                  {{ isUploading ? '匹配中...' : '开始匹配' }}
                </button>
              </div>
            </div>
          </div>
          <!-- Resource Create/Edit Dialog -->
          <div
            v-if="showResourceDialog"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            @click.self="showResourceDialog = false"
          >
            <div
              class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div
                class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700"
              >
                <h2
                  class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"
                >
                  <FileText class="w-5 h-5 text-cyan-500" />
                  {{ isEditingResource ? '编辑资源' : '新增资源' }}
                </h2>
                <button
                  class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  @click="showResourceDialog = false"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <div class="p-5 space-y-4">
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
                      <option
                        v-for="cat in formattedMirrorCategories"
                        :key="cat.id"
                        :value="cat.id"
                      >
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

              <div
                class="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700"
              >
                <button
                  class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  @click="showResourceDialog = false"
                >
                  取消
                </button>
                <button
                  class="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
                  @click="saveResource"
                >
                  {{ isEditingResource ? '保存' : '创建' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Category Create/Edit Dialog -->
          <div
            v-if="showCategoryDialog"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            @click.self="showCategoryDialog = false"
          >
            <div
              class="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md mx-4 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
              <div
                class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700"
              >
                <h2
                  class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2"
                >
                  <Layers class="w-5 h-5 text-cyan-500" />
                  {{ isEditingCategory ? '编辑分类' : '新增分类' }}
                </h2>
                <button
                  class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  @click="showCategoryDialog = false"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <div class="p-5 space-y-4">
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
                    <option
                      v-for="cat in parentCategoryOptions"
                      :key="cat.id"
                      :value="cat.externalId"
                    >
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
                        type="checkbox"
                        :id="'subcat-' + cat.id"
                        :value="cat.externalId"
                        v-model="categoryForm.childExternalIds"
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
                    >Slug (别名)
                    <span class="text-xs text-slate-400 font-normal">（可选）</span></label
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

              <div
                class="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40"
              >
                <button
                  class="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  @click="showCategoryDialog = false"
                >
                  取消
                </button>
                <button
                  class="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors"
                  @click="saveCategory"
                >
                  {{ isEditingCategory ? '保存' : '创建' }}
                </button>
              </div>
            </div>
          </div>
        </Teleport>
      </div>
    </div>
  </div>
</template>
