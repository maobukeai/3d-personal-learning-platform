<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  Trash2,
  Edit3,
  Database,
  Loader2,
  Layers,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Eye,
  Calendar,
  Lock,
  Upload,
  Settings,
  Layout,
  Check,
  ArrowLeft,
  X,
  PanelRightOpen,
  PanelRightClose,
  Keyboard,
  RefreshCw,
} from 'lucide-vue-next';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import AdminOpsPanel from './components/AdminOpsPanel.vue';
import { fetchManagementInsights } from './adminManagementInsights';

const previewMode = ref<'edit' | 'live' | 'preview'>('edit');

interface ManualStation {
  id: string;
  name: string;
  displayName: string;
  status: string;
  totalResources: number;
  minPlanPriority: number;
  iconUrl: string | null;
  description: string | null;
  createdAt: string;
  _count?: { resources: number; categories: number };
}

interface ManualResource {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  contentUrl: string | null;
  contentHtml: string | null;
  tags: string | null;
  resourceType: string;
  viewCount: number;
  categoryId: string | null;
  category: { name: string } | null;
  createdAt: string;
}

interface ManualCategory {
  id: string;
  name: string;
  slug?: string | null;
  order?: number;
  parentId?: string | null;
}

type ResourceQueryParams = {
  page: number;
  pageSize: number;
  categoryId?: string;
  search?: string;
};

const route = useRoute();
const stations = ref<ManualStation[]>([]);
const isLoading = ref(false);
const showCreateDialog = ref(false);
const showEditDialog = ref(false);
const editingStation = ref<ManualStation | null>(null);

// Resource management state
const expandedStationId = ref<string | null>(null);
const expandedTab = ref<'resources' | 'categories'>('resources');
const resourceList = ref<ManualResource[]>([]);
const resourceTotal = ref(0);
const resourcePage = ref(1);
const resourcePageSize = ref(20);
const resourceTotalPages = ref(0);
const resourceSearch = ref('');
const resourceCategoryFilter = ref<string | null>(null);
const isLoadingResources = ref(false);
const stationCategories = ref<ManualCategory[]>([]);
const showResourceDialog = ref(false);
const isEditingResource = ref(false);
const editingResource = ref<ManualResource | null>(null);
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
const editingCategory = ref<ManualCategory | null>(null);
const categoryForm = ref({
  name: '',
  slug: '',
  order: 0,
  parentId: null as string | null,
  childIds: [] as string[],
});

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: t('admin.enable'), color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
  DISABLED: { label: t('admin.disable'), color: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10' },
};

const formData = ref({
  name: '',
  displayName: '',
  minPlanPriority: 0,
  description: '',
  iconUrl: '',
  status: 'ACTIVE',
});

function resetForm() {
  formData.value = {
    name: '',
    displayName: '',
    minPlanPriority: 0,
    description: '',
    iconUrl: '',
    status: 'ACTIVE',
  };
}

function openCreate() {
  resetForm();
  showCreateDialog.value = true;
}

function openEdit(station: ManualStation) {
  editingStation.value = station;
  formData.value = {
    name: station.name,
    displayName: station.displayName,
    minPlanPriority: station.minPlanPriority,
    description: station.description || '',
    iconUrl: station.iconUrl || '',
    status: station.status,
  };
  showEditDialog.value = true;
}

async function fetchStations() {
  isLoading.value = true;
  try {
    const res = await api.get('/api/manual/stations');
    stations.value = res.data;
    fetchManagementInsights(true);
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, t('admin.failed_to_pull_data')));
  } finally {
    isLoading.value = false;
  }
}

async function createStation() {
  try {
    await api.post('/api/admin/manual/stations', formData.value);
    ElMessage.success(t('admin.manual_resource_station_created'));
    showCreateDialog.value = false;
    await fetchStations();
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, t('admin.creation_failed')));
  }
}

async function updateStation() {
  if (!editingStation.value) return;
  try {
    await api.put(`/api/admin/manual/stations/${editingStation.value.id}`, formData.value);
    ElMessage.success(t('admin.update_successful'));
    showEditDialog.value = false;
    await fetchStations();
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, t('admin.update_failed')));
  }
}

async function deleteStation(station: ManualStation) {
  try {
    await ElMessageBox.confirm(
      t('admin.are_you_sure_you_11', { stationdisplayName: station.displayName }),
      t('admin.confirm_deletion_of_manual'),
      {
        confirmButtonText: t('admin.confirm_deletion_1'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
      }
    );
    await api.delete(`/api/admin/manual/stations/${station.id}`);
    ElMessage.success(t('admin.resource_site_deleted_successfully'));
    if (expandedStationId.value === station.id) {
      expandedStationId.value = null;
    }
    await fetchStations();
  } catch (e: unknown) {
    if (e !== 'cancel') {
      ElMessage.error(getApiErrorMessage(e, t('admin.delete_failed')));
    }
  }
}

// -------------------------------------------------------------
// RESOURCE & CATEGORY DETAILS DRAWER (EXPANSION)
// -------------------------------------------------------------

async function handleExpandStation(stationId: string) {
  if (expandedStationId.value === stationId) {
    expandedStationId.value = null;
    return;
  }
  expandedStationId.value = stationId;
  expandedTab.value = 'resources';
  resourcePage.value = 1;
  resourceSearch.value = '';
  resourceCategoryFilter.value = null;
  
  await Promise.all([
    fetchStationCategories(stationId),
    fetchStationResources(stationId)
  ]);
}

async function fetchStationCategories(stationId: string) {
  try {
    const res = await api.get(`/api/manual/stations/${stationId}/categories`);
    stationCategories.value = res.data;
  } catch (e) {
    console.error(e);
  }
}

async function fetchStationResources(stationId: string) {
  isLoadingResources.value = true;
  try {
    const params: ResourceQueryParams = {
      page: resourcePage.value,
      pageSize: resourcePageSize.value,
    };
    if (resourceCategoryFilter.value) {
      params.categoryId = resourceCategoryFilter.value;
    }
    if (resourceSearch.value) {
      params.search = resourceSearch.value;
    }

    const res = await api.get(`/api/manual/stations/${stationId}/resources`, { params });
    resourceList.value = res.data.resources;
    resourceTotal.value = res.data.total;
    resourceTotalPages.value = res.data.totalPages;
  } catch (_e) {
    ElMessage.error(t('admin.failed_to_pull_resources'));
  } finally {
    isLoadingResources.value = false;
  }
}

async function handleResourceSearch() {
  resourcePage.value = 1;
  if (expandedStationId.value) {
    await fetchStationResources(expandedStationId.value);
  }
}

async function handleCategoryFilterChange() {
  resourcePage.value = 1;
  if (expandedStationId.value) {
    await fetchStationResources(expandedStationId.value);
  }
}

async function handlePageChange(newPage: number) {
  resourcePage.value = newPage;
  if (expandedStationId.value) {
    await fetchStationResources(expandedStationId.value);
  }
}

// -------------------------------------------------------------
// RESOURCE DIALOG ACTIONS
// -------------------------------------------------------------

function openCreateResource() {
  previewMode.value = 'edit';
  isEditingResource.value = false;
  editingResource.value = null;
  resourceForm.value = {
    title: '',
    description: '',
    thumbnailUrl: '',
    contentUrl: '',
    tags: '',
    contentHtml: '',
    resourceType: 'COURSE',
    categoryId: stationCategories.value[0]?.id || '',
  };
  showResourceDialog.value = true;
}

function openEditResource(resource: ManualResource) {
  previewMode.value = 'edit';
  isEditingResource.value = true;
  editingResource.value = resource;
  resourceForm.value = {
    title: resource.title,
    description: resource.description || '',
    thumbnailUrl: resource.thumbnailUrl || '',
    contentUrl: resource.contentUrl || '',
    tags: resource.tags || '',
    contentHtml: resource.contentHtml || '',
    resourceType: resource.resourceType || 'COURSE',
    categoryId: resource.categoryId || '',
  };
  showResourceDialog.value = true;
}

const isSaving = ref(false);
const showSettingsSidebar = ref(true);

const charCount = computed(() => resourceForm.value.contentHtml?.length || 0);
const lineCount = computed(() => {
  const content = resourceForm.value.contentHtml || '';
  return content ? content.split('\n').length : 0;
});

async function saveResource() {
  if (!expandedStationId.value) return;
  
  if (!resourceForm.value.title) {
    ElMessage.warning(t('admin.please_enter_a_resource'));
    return;
  }

  if (isSaving.value) return;
  isSaving.value = true;

  try {
    if (isEditingResource.value && editingResource.value) {
      await api.put(`/api/admin/manual/resources/${editingResource.value.id}`, resourceForm.value);
      ElMessage.success(t('admin.update_resource_successfully'));
    } else {
      await api.post(`/api/admin/manual/stations/${expandedStationId.value}/resources`, resourceForm.value);
      ElMessage.success(t('admin.resource_created_successfully'));
    }
    showResourceDialog.value = false;
    await Promise.all([
      fetchStationResources(expandedStationId.value),
      fetchStations()
    ]);
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, t('admin.failed_to_operate_resource')));
  } finally {
    isSaving.value = false;
  }
}

async function deleteResource(resource: ManualResource) {
  if (!expandedStationId.value) return;

  try {
    await ElMessageBox.confirm(
      t('admin.are_you_sure_you_10', { resourcetitle: resource.title }),
      t('admin.confirm_resource_deletion'),
      {
        confirmButtonText: t('admin.confirm_deletion_1'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
      }
    );
    await api.delete(`/api/admin/manual/resources/${resource.id}`);
    ElMessage.success(t('admin.resource_deleted_successfully'));
    await Promise.all([
      fetchStationResources(expandedStationId.value),
      fetchStations()
    ]);
  } catch (e: unknown) {
    if (e !== 'cancel') {
      ElMessage.error(t('admin.failed_to_delete_resource'));
    }
  }
}

// -------------------------------------------------------------
// CATEGORY DIALOG ACTIONS
// -------------------------------------------------------------

function openCreateCategory() {
  isEditingCategory.value = false;
  editingCategory.value = null;
  categoryForm.value = {
    name: '',
    slug: '',
    order: 0,
    parentId: null,
    childIds: [],
  };
  showCategoryDialog.value = true;
}

function openEditCategory(category: ManualCategory) {
  isEditingCategory.value = true;
  editingCategory.value = category;
  const currentChildIds = stationCategories.value
    .filter(c => c.parentId === category.id)
    .map(c => c.id);
  categoryForm.value = {
    name: category.name,
    slug: category.slug || '',
    order: category.order || 0,
    parentId: category.parentId || null,
    childIds: currentChildIds,
  };
  showCategoryDialog.value = true;
}

const parentCategoryOptions = computed(() => {
  return stationCategories.value.filter(cat => {
    if (editingCategory.value && cat.id === editingCategory.value.id) return false;
    return !cat.parentId;
  });
});

const eligibleSubcategories = computed(() => {
  const categories = stationCategories.value;
  const currentId = editingCategory.value?.id;
  const parentIds = new Set<string>();
  categories.forEach(c => {
    if (c.parentId && c.parentId !== currentId) {
      parentIds.add(c.parentId);
    }
  });
  return categories.filter(c => {
    if (currentId && c.id === currentId) return false;
    if (parentIds.has(c.id)) return false;
    return true;
  });
});

const formattedManualCategories = computed(() => {
  const categories = stationCategories.value;
  const parentMap = new Map<string, ManualCategory[]>();
  const topLevel: ManualCategory[] = [];

  categories.forEach(cat => {
    if (cat.parentId) {
      if (!parentMap.has(cat.parentId)) {
        parentMap.set(cat.parentId, []);
      }
      parentMap.get(cat.parentId)!.push(cat);
    }
  });

  categories.forEach(cat => {
    const hasParent = cat.parentId && categories.some(p => p.id === cat.parentId);
    if (!hasParent) {
      topLevel.push(cat);
    }
  });

  topLevel.sort((a, b) => (a.order || 0) - (b.order || 0));

  const result: Array<ManualCategory> = [];

  topLevel.forEach(parent => {
    result.push(parent);
    const children = parentMap.get(parent.id) || [];
    children.sort((a, b) => (a.order || 0) - (b.order || 0));
    children.forEach(child => {
      result.push({
        ...child,
        name: `\u3000└─ ${child.name}`
      });
    });
  });

  return result;
});

function getParentCategoryName(cat: ManualCategory) {
  if (!cat.parentId) return '-';
  const parent = stationCategories.value.find(c => c.id === cat.parentId);
  return parent ? parent.name : '-';
}

async function saveCategory() {
  if (!expandedStationId.value) return;

  if (!categoryForm.value.name) {
    ElMessage.warning(t('admin.please_enter_the_category'));
    return;
  }

  try {
    if (isEditingCategory.value && editingCategory.value) {
      await api.put(`/api/admin/manual/categories/${editingCategory.value.id}`, categoryForm.value);
      ElMessage.success(t('admin.classification_updated_successfully_1'));
    } else {
      await api.post(`/api/admin/manual/stations/${expandedStationId.value}/categories`, categoryForm.value);
      ElMessage.success(t('admin.classification_created_successfully'));
    }
    showCategoryDialog.value = false;
    await fetchStationCategories(expandedStationId.value);
  } catch (e: unknown) {
    ElMessage.error(getApiErrorMessage(e, t('admin.operation_classification_failed')));
  }
}

async function deleteCategory(category: ManualCategory) {
  if (!expandedStationId.value) return;

  try {
    await ElMessageBox.confirm(
      t('admin.are_you_sure_you_6', { categoryname: category.name }),
      t('admin.confirm_category_deletion'),
      {
        confirmButtonText: t('admin.confirm_deletion_1'),
        cancelButtonText: t('admin.cancel'),
        type: 'warning',
      }
    );
    await api.delete(`/api/admin/manual/categories/${category.id}`);
    ElMessage.success(t('admin.category_deleted_successfully'));
    await fetchStationCategories(expandedStationId.value);
  } catch (e: unknown) {
    if (e !== 'cancel') {
      ElMessage.error(t('admin.failed_to_delete_category'));
    }
  }
}

// 自动根据分类名称智能生成符合规范的 Slug
watch(
  () => categoryForm.value.name,
  (newName) => {
    // 只有在添加新分类时才自动生成，不影响编辑已有分类
    if (isEditingCategory.value) return;
    
    const trimName = newName.trim();
    if (!trimName) {
      categoryForm.value.slug = '';
      return;
    }

    // 1. 常见 3D 资产领域分类词汇智能英译映射
    const cnMap: Record<string, string> = {
      [t('admin.3d_model_1')]: '3d-models',
      [t('admin.model')]: 'models',
      [t('admin.stickers')]: 'textures',
      [t('admin.material')]: 'materials',
      [t('admin.tutorial')]: 'courses',
      [t('admin.courses')]: 'courses',
      [t('admin.video_tutorial')]: 'video-courses',
      [t('admin.plug_in')]: 'plugins',
      [t('admin.software')]: 'software',
      [t('admin.default_1')]: 'presets',
      [t('admin.plane')]: 'design',
      [t('admin.photography')]: 'photography',
      [t('admin.illustration')]: 'illustrations',
    };

    // 检索是否包含关键词，若是则智能匹配预设英文标识
    for (const key in cnMap) {
      if (trimName.toLowerCase().includes(key)) {
        categoryForm.value.slug = cnMap[key];
        return;
      }
    }

    // 2. 英文或拼音命名自动规范化 (转小写、过滤特殊字符、空格换成中划线)
    const safeSlug = trimName
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    if (safeSlug) {
      categoryForm.value.slug = safeSlug;
    } else {
      categoryForm.value.slug = '';
    }
  }
);

// Image Uploads for Stations and Resources
const isUploadingIcon = ref(false);
const handleIconUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    return ElMessage.warning(t('admin.icon_image_size_cannot'));
  }

  try {
    isUploadingIcon.value = true;
    const formDataObj = new FormData();
    formDataObj.append('manual_image', file);
    const { data } = await api.post('/api/admin/manual/upload', formDataObj);
    formData.value.iconUrl = data.url;
    ElMessage.success(t('admin.icon_uploaded_successfully'));
  } catch (error: unknown) {
    console.error('Icon upload error:', error);
    ElMessage.error(getApiErrorMessage(error, t('admin.icon_upload_failed')));
  } finally {
    isUploadingIcon.value = false;
    target.value = '';
  }
};

const isUploadingThumbnail = ref(false);
const handleThumbnailUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    return ElMessage.warning(t('admin.preview_image_size_cannot'));
  }

  try {
    isUploadingThumbnail.value = true;
    const formDataObj = new FormData();
    formDataObj.append('manual_image', file);
    const { data } = await api.post('/api/admin/manual/upload', formDataObj);
    resourceForm.value.thumbnailUrl = data.url;
    ElMessage.success(t('admin.preview_image_uploaded_successfully'));
  } catch (error: unknown) {
    console.error('Thumbnail upload error:', error);
    ElMessage.error(getApiErrorMessage(error, t('admin.preview_upload_failed')));
  } finally {
    isUploadingThumbnail.value = false;
    target.value = '';
  }
};

// Real-time netdisk brand analysis
const parsedNetdisk = computed(() => {
  const url = resourceForm.value.contentUrl || '';
  if (!url) return null;
  
  if (url.includes('quark.cn')) {
    return { name: t('admin.quark_network_disk'), color: 'text-teal-500 bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-800/30' };
  } else if (url.includes('baidu.com')) {
    return { name: t('admin.baidu_skydisk'), color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800/30' };
  } else if (url.includes('alipan.com') || url.includes('aliyundrive.com')) {
    return { name: t('admin.alibaba_cloud_disk'), color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-800/30' };
  } else if (url.includes('123pan.com')) {
    return { name: t('admin.123_cloud_disk'), color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-800/30' };
  }
  return { name: t('admin.universal_link'), color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10 border-slate-200 dark:border-slate-800/30' };
});

function handleEditorKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (showResourceDialog.value) {
      saveResource();
    }
  }
}

const statusFilter = ref<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
const setStatusFilter = (key: string) => {
  if (key === 'ALL' || key === 'ACTIVE' || key === 'DISABLED') {
    statusFilter.value = key;
  }
};
const stationSearchQuery = ref('');

const filteredStations = computed(() => {
  return stations.value.filter((station) => {
    const matchesStatus = statusFilter.value === 'ALL' || station.status === statusFilter.value;
    const matchesSearch =
      !stationSearchQuery.value ||
      station.name.toLowerCase().includes(stationSearchQuery.value.toLowerCase()) ||
      station.displayName.toLowerCase().includes(stationSearchQuery.value.toLowerCase());
    return matchesStatus && matchesSearch;
  });
});

onMounted(async () => {
  await fetchStations();
  const stationId = route.query.stationId as string;
  if (stationId) {
    const station = stations.value.find((s) => s.id === stationId);
    if (station) {
      handleExpandStation(stationId);
    }
  }
  window.addEventListener('keydown', handleEditorKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleEditorKeydown);
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
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-cyan-500/10 via-emerald-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1 rounded-xl bg-cyan-500/10 text-cyan-500 shadow-sm border border-cyan-500/20 shrink-0"
          >
            <Database class="w-4 h-4" />
          </span>
          <h1 class="text-sm font-black tracking-tight shrink-0" style="color: var(--text-primary)">
            手动资源站管理
          </h1>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <button type="button" class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold text-[11px] transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer" @click="openCreate">
            <Plus class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ $t('admin.create_a_manual_resource') }}</span>
          </button>
          <button type="button" class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap" style="border-color: var(--border-base); color: var(--text-secondary)" @click="fetchStations">
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span class="hidden sm:inline">{{ $t('admin.refresh') }}</span>
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
                { key: 'ALL', label: $t('admin.all_sites'), count: stations.length, color: 'indigo', icon: Database },
                { key: 'ACTIVE', label: $t('admin.activating'), count: stations.filter(s => s.status === 'ACTIVE').length, color: 'emerald', icon: Check },
                { key: 'DISABLED', label: $t('admin.disabled'), count: stations.filter(s => s.status === 'DISABLED').length, color: 'rose', icon: X }
              ]" :key="filter.key" type="button" class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0" :class="[
                statusFilter === filter.key
                  ? filter.key === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20 font-extrabold shadow-sm'
                    : filter.key === 'DISABLED'
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 ring-1 ring-rose-500/20 font-extrabold shadow-sm'
                      : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 ring-1 ring-indigo-500/20 font-extrabold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
              ]" @click="setStatusFilter(filter.key)">
              <component :is="filter.icon" class="w-2 h-2 sm:w-3 sm:h-3" />
              <span>{{ filter.label }}</span>
              <span class="opacity-60">({{ filter.count }})</span>
            </button>
          </div>
        </div>

        <!-- 检索与统计 -->
        <div class="w-full flex items-center justify-between md:justify-end gap-3 md:w-auto shrink-0">
          <div class="relative flex-1 md:flex-none md:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="stationSearchQuery"
              type="text"
              :placeholder="$t('admin.search_sites_by_name')"
              class="w-full pl-9 pr-3 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div class="text-[10px] font-bold text-right shrink-0" style="color: var(--text-muted)">
            已过滤: <span class="text-indigo-600 font-extrabold">{{ filteredStations.length }}</span> / 总计: {{ stations.length }}
          </div>
        </div>
      </div>
    </div>

    <!-- 主体内容区 -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <div class="max-w-none">
        <AdminOpsPanel scope="manual" />

        <!-- Loading State -->
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 class="w-10 h-10 text-cyan-500 animate-spin" />
          <span class="text-slate-400 text-xs tracking-widest uppercase">{{ $t('admin.loading_data') }}</span>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="stations.length === 0"
          class="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl"
        >
          <Database class="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4" />
          <h3 class="text-sm font-semibold text-slate-600 dark:text-slate-400">{{ $t('admin.there_is_currently_no') }}</h3>
          <p class="text-xs text-slate-400 mt-1 mb-6">{{ $t('admin.click_the_button_in') }}</p>
          <button type="button" class="px-4 py-2 border border-cyan-500/30 text-cyan-500 hover:bg-cyan-500/5 rounded-xl text-xs transition-colors" @click="openCreate">
            立即创建
          </button>
        </div>

        <!-- Stations Grid/List -->
        <div v-else class="space-y-4">
          <div
            v-for="station in filteredStations"
        :key="station.id"
        class="border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden transition-all duration-300 bg-white dark:bg-slate-900/40"
      >
        <!-- Station Main Card Content -->
        <div class="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/20 text-cyan-500 flex items-center justify-center shrink-0 border border-cyan-100 dark:border-cyan-950/50 overflow-hidden">
              <img v-if="station.iconUrl" alt="" :src="getAssetUrl(station.iconUrl)" class="w-full h-full object-cover" />
              <Database v-else class="w-6 h-6" />
            </div>
            <div class="space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
                  {{ station.displayName }}
                </h3>
                <span class="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md">
                  {{ station.name }}
                </span>
                <span
                  class="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  :class="statusLabels[station.status]?.color || 'text-slate-500 bg-slate-50'"
                >
                  {{ statusLabels[station.status]?.label || station.status }}
                </span>
                <span class="text-[10px] bg-cyan-500/10 text-cyan-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock class="w-3 h-3" /> {{ station.minPlanPriority === 0 ? [t('admin.free_for_all')]: $t('admin.getplanname_station_minplanpriority_and') }}
                </span>
              </div>
              <p class="text-xs text-slate-400 line-clamp-2 pr-6">
                {{ station.description || $t('admin.no_description_yet') }}
              </p>
            </div>
          </div>

          <!-- Quick Stats and Actions -->
          <div class="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-100 dark:border-slate-800/60 pt-4 md:pt-0">
            <div class="flex gap-4 items-center">
              <div class="text-left md:text-right shrink-0">
                <div class="text-xs text-slate-400">{{ $t('admin.total_resources') }}</div>
                <div class="text-base font-bold text-slate-700 dark:text-slate-300 font-mono">{{ station.totalResources }}</div>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button type="button" class="px-4 py-2 border rounded-xl text-xs font-medium transition-all" :class="expandedStationId === station.id ? 'bg-cyan-500 text-white border-cyan-500' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'" @click="handleExpandStation(station.id)">
                {{ expandedStationId === station.id ? [t('admin.collapse_panel')]: $t('admin.manage_categories_resources') }}
              </button>
              <button type="button" class="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl transition-colors" :title="$t('admin.edit_basic_information')" @click="openEdit(station)">
                <Edit3 class="w-4 h-4" />
              </button>
              <button type="button" class="p-2 border border-rose-200/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-xl transition-colors" :title="$t('admin.delete_resource_site')" @click="deleteStation(station)">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- STATION DETAILS EXPAND PANEL -->
        <div
          v-if="expandedStationId === station.id"
          class="border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/10 p-5 space-y-5 animate-in slide-in-from-top duration-300"
        >
          <!-- Internal Navigation Tabs -->
          <div class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-3">
            <div class="flex gap-2">
              <button type="button" class="px-4 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5" :class="expandedTab === 'resources' ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/40 dark:border-slate-700/40' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'" @click="expandedTab = 'resources'">
                <FileText class="w-4 h-4" /> 资源库 ({{ resourceTotal }})
              </button>
              <button type="button" class="px-4 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5" :class="expandedTab === 'categories' ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/40 dark:border-slate-700/40' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'" @click="expandedTab = 'categories'">
                <Layers class="w-4 h-4" /> 分类配置 ({{ stationCategories.length }})
              </button>
            </div>

            <button v-if="expandedTab === 'resources'" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 text-xs font-semibold transition-all" @click="openCreateResource">
              <Plus class="w-3.5 h-3.5" /> 上传资源
            </button>
            <button v-else type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 text-xs font-semibold transition-all" @click="openCreateCategory">
              <Plus class="w-3.5 h-3.5" /> 添加分类
            </button>
          </div>

          <!-- TAB 1: RESOURCES MANAGEMENT -->
          <div v-if="expandedTab === 'resources'" class="space-y-4">
            <!-- Search & Filters -->
            <div class="flex flex-col sm:flex-row gap-3">
              <div class="relative flex-1">
                <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  v-model="resourceSearch"
                  type="text"
                  :placeholder="$t('admin.enter_keyword_and_press')"
                  class="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:border-cyan-500 outline-none bg-white dark:bg-slate-900/60"
                  @keydown.enter="handleResourceSearch"
                />
              </div>
              <select
                v-model="resourceCategoryFilter"
                class="px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl focus:border-cyan-500 outline-none bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 min-w-[150px]"
                @change="handleCategoryFilterChange"
              >
                <option :value="null">{{ $t('admin.all_categories_1') }}</option>
                <option v-for="cat in formattedManualCategories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>

            <!-- Resource List Loading -->
            <div v-if="isLoadingResources" class="flex justify-center py-10">
              <Loader2 class="w-8 h-8 text-cyan-500 animate-spin" />
            </div>

            <!-- Empty Resources -->
            <div
              v-else-if="resourceList.length === 0"
              class="flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800 rounded-2xl"
            >
              <FileText class="w-8 h-8 text-slate-300 mb-2" />
              <p class="text-xs text-slate-400">{{ $t('admin.no_resources_were_retrieved') }}</p>
            </div>

            <!-- Resources List -->
            <div v-else class="space-y-2">
              <div
                v-for="res in resourceList"
                :key="res.id"
                class="flex items-center justify-between p-3 bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/55 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all gap-4"
              >
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    v-if="res.thumbnailUrl"
                    class="w-12 h-8 rounded bg-slate-100 dark:bg-slate-800 shrink-0 bg-cover bg-center border border-slate-100 dark:border-slate-800"
                    :style="{ backgroundImage: `url(${res.thumbnailUrl})` }"
                  ></div>
                  <div
                    v-else
                    class="w-12 h-8 rounded bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-400"
                  >
                    <FileText class="w-4 h-4" />
                  </div>
                  <div class="min-w-0 flex-1 space-y-0.5 text-left">
                    <h4 class="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {{ res.title }}
                    </h4>
                    <div class="flex items-center gap-2 text-[10px] text-slate-400">
                      <span class="font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/20 px-1.5 py-0.2 rounded">
                        {{ res.category?.name || $t('admin.uncategorized') }}
                      </span>
                      <span class="flex items-center gap-0.5"><Eye class="w-3 h-3" /> {{ res.viewCount }}</span>
                      <span class="flex items-center gap-0.5"><Calendar class="w-3 h-3" /> {{ new Date(res.createdAt).toLocaleDateString() }}</span>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <button type="button" class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg transition-colors border border-slate-200/40 dark:border-slate-700/40" :title="$t('admin.edit_resources')" @click="openEditResource(res)">
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>
                  <button type="button" class="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-lg transition-colors border border-rose-200/20" :title="$t('admin.delete_resources')" @click="deleteResource(res)">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Pagination Footer -->
              <div v-if="resourceTotalPages > 1" class="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800 pt-4 mt-2">
                <span class="text-[10px] text-slate-400">{{ $t('admin.showing_resourcepage_1_resourcepagesize', { start: (resourcePage - 1) * resourcePageSize + 1, end: Math.min(resourcePage * resourcePageSize, resourceTotal), total: resourceTotal }) }}</span>
                <div class="flex items-center gap-2">
                  <button type="button" :disabled="resourcePage === 1" class="p-1.5 border rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-40" @click="handlePageChange(resourcePage - 1)">
                    <ChevronLeft class="w-4 h-4" />
                  </button>
                  <span class="text-xs font-medium px-2">{{ resourcePage }} / {{ resourceTotalPages }}</span>
                  <button type="button" :disabled="resourcePage === resourceTotalPages" class="p-1.5 border rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-40" @click="handlePageChange(resourcePage + 1)">
                    <ChevronRight class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: CATEGORIES CONFIGURATION -->
          <div v-else class="space-y-3">
            <div
              v-if="stationCategories.length === 0"
              class="flex flex-col items-center justify-center py-10 bg-white dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800 rounded-2xl"
            >
              <Layers class="w-8 h-8 text-slate-300 mb-2" />
              <p class="text-xs text-slate-400">{{ $t('admin.this_resource_site_has') }}</p>
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-for="cat in stationCategories"
                :key="cat.id"
                class="flex items-center justify-between p-3 bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/60 rounded-xl hover:border-slate-300 dark:hover:border-slate-700/60 transition-all"
              >
                <div class="text-left">
                  <div class="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                    {{ cat.name }}
                    <span v-if="cat.slug" class="text-[9px] font-mono bg-slate-100 dark:bg-slate-800 px-1 text-slate-400 rounded">
                      {{ cat.slug }}
                    </span>
                    <span v-if="cat.parentId" class="text-[9px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded">
                      子分类 (父: {{ getParentCategoryName(cat) }})
                    </span>
                  </div>
                  <div class="text-[10px] text-slate-400 mt-0.5">{{ $t('admin.sorting_weight_cat_order', { order: cat.order || 0 }) }}</div>
                </div>

                <div class="flex items-center gap-1.5">
                  <button type="button" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded transition-colors" @click="openEditCategory(cat)">
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>
                  <button type="button" class="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded transition-colors" @click="deleteCategory(cat)">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- DIALOG: CREATE MANUAL STATION -->
    <el-dialog
      v-model="showCreateDialog"
      :title="$t('admin.create_a_manual_resource')"
      width="500px"
      custom-class="premium-dialog"
      :before-close="resetForm"
    >
      <div class="space-y-4 py-2">
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.english_logo_letters_underscores') }}</label>
          <input
            v-model="formData.name"
            type="text"
            :placeholder="$t('admin.such_as_c4d_assets')"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.display_name') }}</label>
          <input
            v-model="formData.displayName"
            type="text"
            :placeholder="$t('admin.such_as_cinema_4d')"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.membership_restrictions') }}</label>
          <select
            v-model="formData.minPlanPriority"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          >
            <option :value="0">{{ $t('admin.free_users_and_above') }}</option>
            <option :value="1">{{ $t('admin.standard_member_and_above') }}</option>
            <option :value="2">{{ $t('admin.professional_member_and_above') }}</option>
            <option :value="3">{{ $t('admin.diamond_members_and_above') }}</option>
          </select>
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.site_icon_1_1') }}</label>
          <div class="flex items-center gap-4">
            <div
              class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
            >
              <img v-if="formData.iconUrl" alt="" :src="getAssetUrl(formData.iconUrl)" class="w-full h-full object-cover" />
              <Database v-else class="w-6 h-6 text-slate-400" />
              
              <label class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <Upload v-if="!isUploadingIcon" class="w-5 h-5 text-white" />
                <Loader2 v-else class="w-5 h-5 text-white animate-spin" />
                <input type="file" accept="image/*" class="hidden" @change="handleIconUpload" />
              </label>
            </div>
            <div class="flex-1 space-y-1.5">
              <input
                v-model="formData.iconUrl"
                type="text"
                :placeholder="$t('admin.or_enter_the_web')"
                class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
              />
              <p class="text-[10px] text-slate-400 leading-none">
                推荐尺寸 128x128px，支持 PNG/JPG/WebP，大小不超过 5MB
              </p>
            </div>
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.description_information') }}</label>
          <textarea
            v-model="formData.description"
            rows="3"
            :placeholder="$t('admin.give_a_brief_introduction')"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          ></textarea>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="px-4 py-2 border rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" @click="showCreateDialog = false">
            取消
          </button>
          <button type="button" class="px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-500 text-xs font-semibold transition-colors" @click="createStation">
            创建资源站
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- DIALOG: EDIT MANUAL STATION -->
    <el-dialog
      v-model="showEditDialog"
      :title="$t('admin.edit_manual_resource_site')"
      width="500px"
      custom-class="premium-dialog"
      :before-close="resetForm"
    >
      <div class="space-y-4 py-2">
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.english_logo_as_the') }}</label>
          <input
            v-model="formData.name"
            type="text"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.display_name') }}</label>
          <input
            v-model="formData.displayName"
            type="text"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.status') }}</label>
          <select
            v-model="formData.status"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          >
            <option value="ACTIVE">{{ $t('admin.enable') }}</option>
            <option value="DISABLED">{{ $t('admin.disable') }}</option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.membership_restrictions') }}</label>
          <select
            v-model="formData.minPlanPriority"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          >
            <option :value="0">{{ $t('admin.free_users_and_above') }}</option>
            <option :value="1">{{ $t('admin.standard_member_and_above') }}</option>
            <option :value="2">{{ $t('admin.professional_member_and_above') }}</option>
            <option :value="3">{{ $t('admin.diamond_members_and_above') }}</option>
          </select>
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.site_icon_1_1') }}</label>
          <div class="flex items-center gap-4">
            <div
              class="w-16 h-16 rounded-2xl border overflow-hidden flex items-center justify-center shrink-0 group relative bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800"
            >
              <img v-if="formData.iconUrl" alt="" :src="getAssetUrl(formData.iconUrl)" class="w-full h-full object-cover" />
              <Database v-else class="w-6 h-6 text-slate-400" />
              
              <label class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                <Upload v-if="!isUploadingIcon" class="w-5 h-5 text-white" />
                <Loader2 v-else class="w-5 h-5 text-white animate-spin" />
                <input type="file" accept="image/*" class="hidden" @change="handleIconUpload" />
              </label>
            </div>
            <div class="flex-1 space-y-1.5">
              <input
                v-model="formData.iconUrl"
                type="text"
                :placeholder="$t('admin.or_enter_the_web')"
                class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
              />
              <p class="text-[10px] text-slate-400 leading-none">
                推荐尺寸 128x128px，支持 PNG/JPG/WebP，大小不超过 5MB
              </p>
            </div>
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.description_information') }}</label>
          <textarea
            v-model="formData.description"
            rows="3"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          ></textarea>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="px-4 py-2 border rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" @click="showEditDialog = false">
            取消
          </button>
          <button type="button" class="px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-500 text-xs font-semibold transition-colors" @click="updateStation">
            保存修改
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- DIALOG: MANAGE RESOURCE (Immersive Fullscreen Editor) -->
    <el-dialog
      v-model="showResourceDialog"
      fullscreen
      :show-close="false"
      class="immersive-editor-dialog"
      destroy-on-close
    >
      <div class="fixed inset-0 bg-[var(--bg-app)] flex flex-col h-screen">
        <!-- ① HEADER TOOLBAR -->
        <header
          class="sticky top-0 z-50 h-14 flex items-center justify-between px-4 md:px-6 bg-[var(--bg-app)]/80 backdrop-blur-xl border-b border-[var(--border-base)] shrink-0"
        >
          <!-- Left: Back + Context -->
          <div class="flex items-center gap-3 min-w-0">
            <button type="button" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all shrink-0 cursor-pointer" @click="showResourceDialog = false">
              <ArrowLeft class="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
            <div class="min-w-0">
              <div class="text-sm font-bold text-[var(--text-primary)] truncate">
                {{ isEditingResource ? [t('admin.edit_quality_resources')]: $t('admin.publish_high_quality_resources') }}
              </div>
              <p class="text-[10px] text-[var(--text-muted)] truncate">
                {{ stations.find(s => s.id === expandedStationId)?.displayName || $t('admin.resource_station') }}
              </p>
            </div>
          </div>

          <!-- Center: Preview Mode Toggle -->
          <div class="absolute left-1/2 -translate-x-1/2 hidden sm:block">
            <el-radio-group v-model="previewMode" size="small" class="preview-mode-toggle">
              <el-radio-button value="edit">
                <div class="flex items-center gap-1.5 px-2">
                  <Edit3 class="w-3.5 h-3.5" /> <span>{{ $t('admin.edit') }}</span>
                </div>
              </el-radio-button>
              <el-radio-button value="live">
                <div class="flex items-center gap-1.5 px-2">
                  <Layout class="w-3.5 h-3.5" /> <span>{{ $t('admin.real_time') }}</span>
                </div>
              </el-radio-button>
              <el-radio-button value="preview">
                <div class="flex items-center gap-1.5 px-2">
                  <Eye class="w-3.5 h-3.5" /> <span>{{ $t('admin.preview') }}</span>
                </div>
              </el-radio-button>
            </el-radio-group>
          </div>

          <!-- Right: Sidebar Toggle + Save -->
          <div class="flex items-center gap-2">
            <!-- Mobile preview toggle -->
            <el-radio-group v-model="previewMode" size="small" class="preview-mode-toggle sm:hidden">
              <el-radio-button value="edit">
                <Edit3 class="w-3.5 h-3.5" />
              </el-radio-button>
              <el-radio-button value="live">
                <Layout class="w-3.5 h-3.5" />
              </el-radio-button>
              <el-radio-button value="preview">
                <Eye class="w-3.5 h-3.5" />
              </el-radio-button>
            </el-radio-group>

            <button
type="button" class="p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold" :class="showSettingsSidebar
                ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400'
                : 'border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-white/5'" @click="showSettingsSidebar = !showSettingsSidebar">
              <PanelRightOpen v-if="!showSettingsSidebar" class="w-4 h-4" />
              <PanelRightClose v-else class="w-4 h-4" />
              <span class="hidden md:inline">{{ $t('admin.settings') }}</span>
            </button>

            <button
type="button" :disabled="isSaving" class="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed" :class="isSaving
                ? 'bg-cyan-600'
                : 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 hover:-translate-y-0.5'" @click="saveResource">
              <Loader2 v-if="isSaving" class="w-3.5 h-3.5 animate-spin" />
              <Check v-else class="w-3.5 h-3.5" />
              {{ isSaving ? [t('admin.saving')]: $t('admin.save_and_publish') }}
            </button>
          </div>
        </header>

        <!-- ② + ③ MAIN AREA: Editor + Sidebar -->
        <div class="flex-1 flex overflow-hidden">
          <!-- Editor Content Area -->
          <div class="flex-1 overflow-y-auto custom-scrollbar">
            <div class="max-w-5xl mx-auto px-3 md:px-6 pb-16 pt-6 md:pt-10">
              <div class="bg-[var(--bg-card)] border border-[var(--border-base)] shadow-sm rounded-2xl min-h-[70vh] px-5 md:px-12 py-6 md:py-12 transition-all duration-300">
                <el-input v-model="resourceForm.title" :placeholder="$t('admin.please_enter_a_resource')" class="editor-modern-title mb-6" />
                <div class="w-16 h-0.5 bg-gradient-to-r from-cyan-500/40 to-transparent rounded-full mb-6"></div>
                <MarkdownEditor
                  v-model="resourceForm.contentHtml"
                  auto-height
                  class="modern-paper-theme"
                  :auto-focus="true"
                  :preview="previewMode === 'live'"
                  :preview-only="previewMode === 'preview'"
                  :placeholder="$t('admin.detailed_introduction_and_usage')"
                  upload-url="/api/admin/manual/upload"
                  upload-field="manual_image"
                />
              </div>
            </div>
          </div>

          <!-- ③ Settings Sidebar -->
          <aside
            v-if="showSettingsSidebar"
            class="w-80 shrink-0 border-l border-[var(--border-base)] bg-[var(--bg-card)] overflow-y-auto custom-scrollbar hidden md:block"
          >
            <div class="p-5 space-y-5">
              <!-- Sidebar Header -->
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Settings class="w-4 h-4 text-cyan-500" />
                  资源设置
                </h3>
                <button type="button" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-muted)] transition-colors cursor-pointer" @click="showSettingsSidebar = false">
                  <X class="w-4 h-4" />
                </button>
              </div>

              <!-- Category -->
              <div class="settings-group">
                <label class="settings-label">
                  <span class="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0"></span>
                  所属分类
                </label>
                <el-select v-model="resourceForm.categoryId" :placeholder="$t('admin.select_category')" size="small" class="w-full">
                  <el-option :label="$t('admin.no_classification_yet')" value="" />
                  <el-option v-for="cat in formattedManualCategories" :key="cat.id" :label="cat.name" :value="cat.id" />
                </el-select>
              </div>

              <!-- Resource Type -->
              <div class="settings-group">
                <label class="settings-label">
                  <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                  资源类型
                </label>
                <el-select v-model="resourceForm.resourceType" :placeholder="$t('admin.select_type')" size="small" class="w-full">
                  <el-option :label="$t('admin.courses_tutorials')" value="COURSE" />
                  <el-option :label="$t('admin.3d_model')" value="MODEL" />
                  <el-option :label="$t('admin.material_map')" value="MATERIAL" />
                  <el-option :label="$t('admin.software_plug_in')" value="SOFTWARE" />
                  <el-option :label="$t('admin.other_resources')" value="OTHER" />
                </el-select>
              </div>

              <!-- Download URL + Netdisk Badge -->
              <div class="settings-group">
                <label class="settings-label">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                  极速提取链接
                  <span
                    v-if="parsedNetdisk"
                    class="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all"
                    :class="parsedNetdisk.color"
                  >
                    {{ parsedNetdisk.name }}
                  </span>
                </label>
                <el-input v-model="resourceForm.contentUrl" placeholder="https://pan.quark.cn/s/..." size="small" />
              </div>

              <!-- Thumbnail Upload -->
              <div class="settings-group">
                <label class="settings-label">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                  资源封面
                </label>
                <div
                  class="w-full aspect-video rounded-xl border border-dashed flex flex-col items-center justify-center relative overflow-hidden transition-all bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 group"
                >
                  <img v-if="resourceForm.thumbnailUrl" alt="" :src="getAssetUrl(resourceForm.thumbnailUrl)" class="w-full h-full object-cover" />
                  <div v-else class="flex flex-col items-center justify-center p-2 text-center space-y-1 pointer-events-none">
                    <Upload class="w-5 h-5 text-slate-400" />
                    <span class="text-[10px] text-slate-400">{{ $t('admin.click_to_upload_cover') }}</span>
                    <span class="text-[8px] text-slate-400">PNG/JPG/WebP &lt; 5MB</span>
                  </div>
                  
                  <label class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                    <Upload v-if="!isUploadingThumbnail" class="w-5 h-5 text-white" />
                    <Loader2 v-else class="w-5 h-5 text-white animate-spin" />
                    <input type="file" accept="image/*" class="hidden" @change="handleThumbnailUpload" />
                  </label>
                </div>
                <el-input
                  v-model="resourceForm.thumbnailUrl"
                  :placeholder="$t('admin.or_enter_the_web_1')"
                  size="small"
                  class="mt-2"
                />
              </div>

              <!-- Tags -->
              <div class="settings-group">
                <label class="settings-label">
                  <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                  资源标签
                </label>
                <el-input v-model="resourceForm.tags" :placeholder="$t('admin.c4d_material_pack_renderer')" size="small" />
                <p class="text-[10px] text-[var(--text-muted)] mt-1">{{ $t('admin.separate_multiple_tags_with') }}</p>
              </div>

              <!-- Description -->
              <div class="settings-group">
                <label class="settings-label">
                  <span class="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0"></span>
                  资源描述
                </label>
                <el-input
                  v-model="resourceForm.description"
                  type="textarea"
                  :rows="3"
                  :placeholder="$t('admin.a_brief_explanation_of')"
                  size="small"
                />
              </div>
            </div>
          </aside>
        </div>

        <!-- ④ BOTTOM STATUS BAR -->
        <footer
          class="sticky bottom-0 z-40 h-9 flex items-center justify-between px-4 md:px-6 bg-[var(--bg-app)]/80 backdrop-blur-md border-t border-[var(--border-base)] shrink-0"
        >
          <div class="flex items-center gap-4 text-[10px] font-medium text-[var(--text-muted)]">
            <span class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              已就绪
            </span>
            <span class="hidden sm:flex items-center gap-1">
              <Keyboard class="w-3 h-3" />
              Ctrl+S 保存
            </span>
            <span class="hidden md:flex items-center gap-1">
              <Database class="w-3 h-3 text-cyan-500" />
              Markdown
            </span>
          </div>
          <div class="flex items-center gap-4 text-[10px] font-medium text-[var(--text-muted)]">
            <span>{{ $t('admin.charcount_characters', { count: charCount }) }}</span>
            <span class="hidden sm:inline">{{ $t('admin.linecount_lines', { count: lineCount }) }}</span>
          </div>
        </footer>
      </div>
    </el-dialog>

    <!-- DIALOG: MANAGE CATEGORY -->
    <el-dialog
      v-model="showCategoryDialog"
      :title="isEditingCategory ? $t('admin.edit_category_name') : $t('admin.add_resource_category')"
      width="400px"
      custom-class="premium-dialog"
    >
      <div class="space-y-4 py-2">
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.category_display_name') }}</label>
          <input
            v-model="categoryForm.name"
            type="text"
            :placeholder="$t('admin.such_as_premium_texture')"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.parent_category_optional_used') }}</label>
          <select
            v-model="categoryForm.parentId"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none text-slate-600 dark:text-slate-300"
          >
            <option :value="null">{{ $t('admin.none_as_a_first') }}</option>
            <option
              v-for="cat in parentCategoryOptions"
              :key="cat.id"
              :value="cat.id"
            >
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div v-if="!categoryForm.parentId && eligibleSubcategories.length > 0" class="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-1">
          <label class="text-xs font-semibold text-slate-500 block">{{ $t('admin.assign_subcategories_select_from') }}</label>
          <div class="max-h-36 overflow-y-auto border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-2.5 bg-slate-50/50 dark:bg-slate-900/30 space-y-1.5 scrollbar-hide">
            <div
              v-for="cat in eligibleSubcategories"
              :key="cat.id"
              class="flex items-center gap-2 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 p-1 rounded-lg transition-colors"
            >
              <input
                :id="'subcat-' + cat.id"
                v-model="categoryForm.childIds"
                type="checkbox"
                :value="cat.id"
                class="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 w-3.5 h-3.5"
              />
              <label :for="'subcat-' + cat.id" class="text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer select-none flex-1">
                {{ cat.name }}
                <span v-if="cat.parentId" class="text-[9px] text-slate-400 dark:text-slate-500 ml-1">
                  (当前父: {{ getParentCategoryName(cat) }})
                </span>
              </label>
            </div>
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.slug_abbreviation_optional_such') }}</label>
          <input
            v-model="categoryForm.slug"
            type="text"
            :placeholder="$t('admin.used_for_routing_auxiliary')"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-semibold text-slate-500">{{ $t('admin.sorting_weight_small_number') }}</label>
          <input
            v-model="categoryForm.order"
            type="number"
            placeholder="0"
            class="w-full p-2.5 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/60 focus:border-cyan-500 outline-none"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="px-4 py-2 border rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" @click="showCategoryDialog = false">
            取消
          </button>
          <button type="button" class="px-4 py-2 bg-cyan-600 text-white rounded-xl hover:bg-cyan-500 text-xs font-semibold transition-colors" @click="saveCategory">
            保存分类
          </button>
        </div>
      </template>
    </el-dialog>
    </div>
  </div>
</div>
</template>

<style scoped>
.premium-dialog {
  border-radius: 24px !important;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
}

:deep(.immersive-editor-dialog) {
  padding: 0 !important;
}
:deep(.immersive-editor-dialog .el-dialog__header) {
  display: none;
}
:deep(.immersive-editor-dialog .el-dialog__body) {
  padding: 0;
  height: 100%;
}

/* Preview Mode Toggle */
.preview-mode-toggle :deep(.el-radio-button__inner) {
  background-color: transparent !important;
  border: none !important;
  padding: 8px 14px !important;
  font-weight: 600 !important;
  font-size: 12px !important;
  color: var(--text-muted) !important;
  transition: all 0.2s ease !important;
}
.preview-mode-toggle :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background-color: var(--bg-card) !important;
  color: var(--accent, #06b6d4) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
  border-radius: 8px !important;
}
.preview-mode-toggle {
  background-color: var(--bg-app) !important;
  padding: 3px !important;
  border-radius: 10px !important;
  border: 1px solid var(--border-base) !important;
}

/* Editor Title */
.editor-modern-title :deep(.el-input__wrapper) {
  box-shadow: none !important;
  background-color: transparent !important;
  padding-left: 0 !important;
}
.editor-modern-title :deep(.el-input__inner) {
  font-size: 1.35rem !important;
  font-weight: 800 !important;
  color: var(--text-primary) !important;
  border: none !important;
  line-height: 1.4 !important;
}
@media (min-width: 768px) {
  .editor-modern-title :deep(.el-input__inner) {
    font-size: 2rem !important;
  }
}

/* Settings Sidebar Groups */
.settings-group {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-base);
}
.settings-group:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.settings-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong, var(--border-base));
}
</style>
