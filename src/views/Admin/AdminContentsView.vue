<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed, onMounted, ref, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Edit3,
  Eye,
  Inbox,
  Layers,
  ListChecks,
  MoreHorizontal,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Card from '@/components/ui/Card.vue';
import PageHeader from '@/components/PageHeader.vue';
import UiButton from '@/components/ui/Button.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import AdminStatCards from './components/AdminStatCards.vue';
import AdminContentStatusBadge from './components/AdminContentStatusBadge.vue';
import ContentDetailModal from './components/ContentDetailModal.vue';

type ContentTab = 'assets' | 'materials' | 'showcases' | 'plugins';
type ContentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type StatusFilter = ContentStatus | 'ALL';

interface ContentUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface ContentItem {
  id: string;
  title: string;
  description?: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt?: string;
  type?: string;
  category?: string;
  categoryId?: string;
  tags?: string | null;
  thumbnail?: string | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  fileUrl?: string | null;
  videoUrl?: string | null;
  url?: string | null;
  fileSize?: number | null;
  size?: number | null;
  resolution?: string | null;
  downloads?: number;
  likes?: number;
  views?: number;
  comments?: number;
  version?: string;
  compatibility?: string;
  rejectReason?: string | null;
  user?: ContentUser;
}

export interface PageConfig {
  label: string;
  title: string;
  apiPath: string;
  icon: Component;
  emptyLabel: string;
}

interface PaginatedContentResponse {
  items?: ContentItem[];
  total?: number;
  page?: number;
  pageSize?: number;
  pages?: number;
  stats?: Record<string, unknown>;
}

const route = useRoute();
const router = useRouter();

const getValidTab = (value: unknown): ContentTab => {
  if (value === 'assets' || value === 'materials' || value === 'showcases' || value === 'plugins') {
    return value;
  }
  return 'assets';
};

const pageConfigs: Record<ContentTab, PageConfig> = {
  assets: {
    label: '3D 资产',
    title: '3D 资产管理',
    apiPath: '/api/admin/assets',
    icon: Box,
    emptyLabel: '暂无资产记录',
  },
  materials: {
    label: '材质',
    title: '材质管理',
    apiPath: '/api/admin/materials',
    icon: Layers,
    emptyLabel: '暂无材质记录',
  },
  showcases: {
    label: '作品',
    title: '作品管理',
    apiPath: '/api/admin/showcases',
    icon: Sparkles,
    emptyLabel: '暂无作品记录',
  },
  plugins: {
    label: '插件',
    title: '插件管理',
    apiPath: '/api/admin/plugins',
    icon: Puzzle,
    emptyLabel: '暂无插件记录',
  },
};

const activeTab = ref<ContentTab>(getValidTab(route.query.tab));
const statusFilter = ref<StatusFilter>('ALL');
const searchQuery = ref('');
const items = ref<ContentItem[]>([]);
const assetCategories = ref<{ id: string; name: string }[]>([]);
const isLoading = ref(false);
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);
const totalPages = ref(1);
const activeItem = ref<ContentItem | null>(null);
const detailModalVisible = ref(false);

interface ContentStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}
const queueStats = ref<ContentStats | null>(null);

const openDetail = (item: ContentItem) => {
  activeItem.value = item;
  detailModalVisible.value = true;
};

// Edit / Create Dialog States
const isCreateOpen = ref(false);
const isEditOpen = ref(false);
const isSaving = ref(false);

const editForm = ref<Partial<ContentItem>>({});
const createForm = ref({
  title: '',
  description: '',
  status: 'APPROVED' as ContentStatus,
  categoryId: '',
  category: '',
  type: 'IMAGE',
  version: '1.0.0',
  compatibility: '',
  tags: '',
  // For file inputs
  file: null as File | null,
  thumbnail: null as File | null,
  // Or external links
  externalUrl: '',
  externalThumbnailUrl: '',
  resolution: '2K',
  isProcedural: false,
});

// File inputs refs
const fileInputRef = ref<HTMLInputElement | null>(null);
const thumbnailInputRef = ref<HTMLInputElement | null>(null);

const pageConfig = computed(() => pageConfigs[activeTab.value]);

const tabsList = computed(() => [
  { id: 'assets' as const, ...pageConfigs.assets },
  { id: 'materials' as const, ...pageConfigs.materials },
  { id: 'showcases' as const, ...pageConfigs.showcases },
  { id: 'plugins' as const, ...pageConfigs.plugins },
]);

const tabsListOptions = computed(() => {
  return tabsList.value.map((tab) => ({
    label: tab.label,
    value: tab.id,
    icon: tab.icon,
  }));
});

const statusFilterOptions = computed(() => [
  { label: '全部', value: 'ALL' as const },
  { label: '待审核', value: 'PENDING' as const },
  { label: '已通过', value: 'APPROVED' as const },
  { label: '已打回', value: 'REJECTED' as const },
]);

const fetchItems = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const params = {
      response: 'paginated',
      page: currentPage.value,
      limit: pageSize.value,
      search: searchQuery.value.trim() || undefined,
      status: statusFilter.value !== 'ALL' ? statusFilter.value : undefined,
    };
    const response = await api.get<PaginatedContentResponse | ContentItem[]>(
      pageConfig.value.apiPath,
      { params },
    );
    if (Array.isArray(response.data)) {
      items.value = response.data;
      totalItems.value = response.data.length;
      totalPages.value = 1;
      queueStats.value = null;
    } else {
      items.value = response.data.items || [];
      totalItems.value = response.data.total || 0;
      currentPage.value = response.data.page || currentPage.value;
      pageSize.value = response.data.pageSize || pageSize.value;
      totalPages.value = Math.max(response.data.pages || 1, 1);
      queueStats.value = (response.data.stats as unknown as ContentStats | null) || null;
    }
    if (items.value.length > 0) {
      if (!activeItem.value || !items.value.some((i) => i.id === activeItem.value?.id)) {
        activeItem.value = items.value[0];
      } else {
        activeItem.value = items.value.find((i) => i.id === activeItem.value?.id) || items.value[0];
      }
    } else {
      activeItem.value = null;
    }
  } catch (error) {
    if (!silent) {
      ElMessage.error(getApiErrorMessage(error, `无法加载${pageConfig.value.label}数据`));
    }
  } finally {
    if (!silent) isLoading.value = false;
  }
};

const fetchAssetCategories = async () => {
  try {
    const response = await api.get<{ id: string; name: string }[]>('/api/admin/asset-categories');
    assetCategories.value = response.data;
  } catch (error) {
    logError(error, { operation: 'admin.fetchAssetCategories', component: 'AdminContentsView' });
  }
};

const handleTabChange = (tabId: ContentTab) => {
  activeTab.value = tabId;
  currentPage.value = 1;
  router.push({ query: { ...route.query, tab: tabId } });
  fetchItems();
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchItems();
};

const handleStatusFilterChange = (status: StatusFilter) => {
  statusFilter.value = status;
  currentPage.value = 1;
  fetchItems();
};

// Pagination
const setPage = (page: number) => {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  fetchItems();
};

const mediaUrl = (item: ContentItem) => {
  return item.thumbnail || item.thumbnailUrl || item.previewUrl || '';
};

const itemKind = (item: ContentItem) => {
  if (activeTab.value === 'assets') return item.type || 'GLB';
  if (activeTab.value === 'materials') return item.resolution || '程序化';
  if (activeTab.value === 'showcases') return item.type === 'VIDEO' ? '视频作品' : '图文作品';
  return '应用扩展';
};

const stats = computed(() => {
  if (queueStats.value) return queueStats.value;
  const source = items.value;
  return {
    total: source.length,
    pending: source.filter((item) => item.status === 'PENDING').length,
    approved: source.filter((item) => item.status === 'APPROVED').length,
    rejected: source.filter((item) => item.status === 'REJECTED').length,
  };
});

const approvalRate = computed(() => {
  const denominator = Math.max(stats.value.total, 1);
  return Math.round((stats.value.approved / denominator) * 100);
});

const consolidatedCards = computed(() => {
  const pendingCount = stats.value.pending;

  return [
    {
      label: '管理资源总量',
      value: stats.value.total,
      hint: `已通过 ${stats.value.approved} · 已打回 ${stats.value.rejected}`,
      icon: Inbox,
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      health: { label: '常态', variant: 'success' as const },
    },
    {
      label: '待审核资源',
      value: pendingCount,
      hint: `需审核队列`,
      icon: AlertTriangle,
      color:
        pendingCount > 0
          ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
          : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health:
        pendingCount > 20
          ? { label: '积压高', variant: 'danger' as const }
          : pendingCount > 0
            ? { label: '待处理', variant: 'warning' as const }
            : { label: '已清空', variant: 'success' as const },
    },
    {
      label: '已发布资源',
      value: stats.value.approved,
      hint: `正常公开展示`,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: '已同步', variant: 'success' as const },
    },
    {
      label: '资源上架率',
      value: `${approvalRate.value}%`,
      hint: `通过数占总量`,
      icon: ListChecks,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health:
        approvalRate.value >= 80
          ? { label: '稳定', variant: 'success' as const }
          : { label: '关注', variant: 'warning' as const },
    },
  ];
});

// Format helpers
const formatSize = (bytes?: number | null) => {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return '-';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const handleQuickApprove = async (item: ContentItem) => {
  try {
    const payload: Record<string, unknown> = {
      title: item.title,
      description: item.description,
      status: 'APPROVED' as ContentStatus,
      tags: item.tags,
    };
    if (activeTab.value === 'assets') {
      payload.categoryId = item.categoryId;
    } else if (activeTab.value === 'materials') {
      payload.category = item.category;
      payload.resolution = item.resolution;
    } else if (activeTab.value === 'showcases') {
      payload.type = item.type;
    } else if (activeTab.value === 'plugins') {
      payload.category = item.category;
      payload.version = item.version;
      payload.compatibility = item.compatibility;
    }
    await api.put(`${pageConfig.value.apiPath}/${item.id}`, payload);
    ElMessage.success('已批准发布');
    fetchItems(true);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '审批失败'));
  }
};

const handleQuickReject = (item: ContentItem) => {
  ElMessageBox.prompt('请输入退回理由：', '退回审核', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /\S+/,
    inputErrorMessage: '请输入理由',
  })
    .then(async ({ value }) => {
      try {
        const payload: Record<string, unknown> = {
          title: item.title,
          description: item.description,
          status: 'REJECTED' as ContentStatus,
          tags: item.tags,
          rejectReason: value,
        };
        if (activeTab.value === 'assets') {
          payload.categoryId = item.categoryId;
        } else if (activeTab.value === 'materials') {
          payload.category = item.category;
          payload.resolution = item.resolution;
        } else if (activeTab.value === 'showcases') {
          payload.type = item.type;
        } else if (activeTab.value === 'plugins') {
          payload.category = item.category;
          payload.version = item.version;
          payload.compatibility = item.compatibility;
        }
        await api.put(`${pageConfig.value.apiPath}/${item.id}`, payload);
        ElMessage.success('已退回发布');
        fetchItems(true);
      } catch (error) {
        ElMessage.error(getApiErrorMessage(error, '退回失败'));
      }
    })
    .catch(() => {});
};

const handleCommand = (cmd: string, item: ContentItem) => {
  if (cmd === 'details') {
    openDetail(item);
  } else if (cmd === 'edit') {
    openEdit(item);
  } else if (cmd === 'delete') {
    handleDelete(item);
  }
};

// Create Operations
const openCreate = () => {
  createForm.value = {
    title: '',
    description: '',
    status: 'APPROVED',
    categoryId: assetCategories.value[0]?.id || '',
    category: activeTab.value === 'materials' ? '硬表面' : '工具',
    type: 'IMAGE',
    version: '1.0.0',
    compatibility: '',
    tags: '',
    file: null,
    thumbnail: null,
    externalUrl: '',
    externalThumbnailUrl: '',
    resolution: '2K',
    isProcedural: false,
  };
  if (fileInputRef.value) fileInputRef.value.value = '';
  if (thumbnailInputRef.value) thumbnailInputRef.value.value = '';
  isCreateOpen.value = true;
};

const handleCreateFileChange = (e: Event, type: 'file' | 'thumbnail') => {
  const files = (e.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;
  if (type === 'file') {
    createForm.value.file = files[0];
  } else {
    createForm.value.thumbnail = files[0];
  }
};

const submitCreate = async () => {
  if (!createForm.value.title.trim()) {
    ElMessage.warning('请输入标题');
    return;
  }
  isSaving.value = true;
  try {
    const formData = new FormData();
    formData.append('title', createForm.value.title.trim());
    formData.append('description', createForm.value.description);
    formData.append('status', createForm.value.status);
    formData.append('tags', createForm.value.tags);

    if (activeTab.value === 'assets') {
      if (!createForm.value.categoryId) {
        ElMessage.warning('请选择分类');
        isSaving.value = false;
        return;
      }
      formData.append('categoryId', createForm.value.categoryId);
      if (createForm.value.file) {
        formData.append('asset', createForm.value.file);
      } else {
        formData.append('externalUrl', createForm.value.externalUrl);
      }
      if (createForm.value.thumbnail) {
        formData.append('thumbnail', createForm.value.thumbnail);
      }
      await api.post('/api/assets/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (activeTab.value === 'materials') {
      formData.append('category', createForm.value.category);
      formData.append('resolution', createForm.value.resolution);
      formData.append('isProcedural', String(createForm.value.isProcedural));
      if (createForm.value.file) {
        formData.append('material', createForm.value.file);
      }
      if (createForm.value.thumbnail) {
        formData.append('preview', createForm.value.thumbnail);
      }
      await api.post('/api/materials/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (activeTab.value === 'showcases') {
      formData.append('type', createForm.value.type);
      if (createForm.value.thumbnail) {
        formData.append('thumbnail', createForm.value.thumbnail);
      }
      await api.post('/api/showcase', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } else if (activeTab.value === 'plugins') {
      formData.append('category', createForm.value.category);
      formData.append('version', createForm.value.version);
      formData.append('compatibility', createForm.value.compatibility);
      if (createForm.value.file) {
        formData.append('plugin_file', createForm.value.file);
      }
      if (createForm.value.thumbnail) {
        formData.append('plugin_preview', createForm.value.thumbnail);
      }
      await api.post('/api/plugins/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }

    ElMessage.success('发布资源成功！');
    isCreateOpen.value = false;
    fetchItems();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发布资源失败'));
  } finally {
    isSaving.value = false;
  }
};

// Edit Operations
const openEdit = (item: ContentItem) => {
  editForm.value = { ...item };
  isEditOpen.value = true;
};

const handleUpdate = async () => {
  if (!editForm.value.title?.trim()) {
    ElMessage.warning('名称不能为空');
    return;
  }
  isSaving.value = true;
  try {
    const payload: Record<string, unknown> = {
      title: editForm.value.title.trim(),
      description: editForm.value.description,
      status: editForm.value.status,
      tags: editForm.value.tags,
    };

    if (activeTab.value === 'assets') {
      payload.categoryId = editForm.value.categoryId;
    } else if (activeTab.value === 'materials') {
      payload.category = editForm.value.category;
      payload.resolution = editForm.value.resolution;
    } else if (activeTab.value === 'showcases') {
      payload.type = editForm.value.type;
    } else if (activeTab.value === 'plugins') {
      payload.category = editForm.value.category;
      payload.version = editForm.value.version;
      payload.compatibility = editForm.value.compatibility;
    }

    await api.put(`${pageConfig.value.apiPath}/${editForm.value.id}`, payload);
    ElMessage.success('更新成功！');
    isEditOpen.value = false;
    fetchItems();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '更新失败'));
  } finally {
    isSaving.value = false;
  }
};

// Delete Operations
const handleDelete = (item: ContentItem) => {
  ElMessageBox.confirm(`确定要彻底删除资源 "${item.title}" 吗？此操作不可逆。`, '警告', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      // 备份当前状态以备失败恢复
      const oldItems = [...items.value];
      const oldActiveItem = activeItem.value;

      // 乐观更新：前端立即移除该元素
      items.value = items.value.filter((i) => i.id !== item.id);
      if (activeItem.value?.id === item.id) {
        activeItem.value = items.value[0] || null;
      }

      // 立即提示已删除
      ElMessage.success('资源已删除');

      // 后台执行请求并在成功后静默拉取
      api
        .delete(`${pageConfig.value.apiPath}/${item.id}`)
        .then(() => {
          fetchItems(true);
        })
        .catch((error) => {
          // 失败恢复
          items.value = oldItems;
          activeItem.value = oldActiveItem;
          ElMessage.error(getApiErrorMessage(error, '删除失败'));
        });
    })
    .catch(() => {});
};

onMounted(() => {
  fetchItems();
  fetchAssetCategories();
});
</script>

<template>
  <div
    class="admin-contents-page mobile-adaptive flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)]"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
      <!-- Reusable PageHeader -->
      <PageHeader :title="pageConfig.title" subtitle="平台管理 · 资源清单" variant="card">
        <template #center>
          <!-- Compact Search Box (Centered) -->
          <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
            <Search />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="搜索关键字或创作者..."
              @keyup.enter="handleSearch"
            />
          </label>
        </template>

        <div class="flex items-center gap-2 mobile-row">
          <UiButton
            variant="secondary"
            size="sm"
            :icon="RefreshCw"
            :loading="isLoading"
            @click="fetchItems(false)"
          >
            刷新
          </UiButton>
          <UiButton variant="primary" size="sm" :icon="Plus" @click="openCreate">
            发布{{ pageConfig.label }}
          </UiButton>
        </div>
      </PageHeader>

      <!-- KPI Metrics Grid -->
      <AdminStatCards :cards="consolidatedCards" />

      <!-- Filters & Search Toolbar -->
      <Card padding="sm">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <!-- Tabs for activeTab and statusFilter -->
          <div
            class="flex flex-wrap items-center gap-3 overflow-x-auto scrollbar-hide shrink-0 mobile-row"
          >
            <!-- Resource Categories Tab -->
            <Tabs
              v-slot="{}"
              v-model="activeTab"
              :options="tabsListOptions"
              variant="solid"
              @change="(val: any) => handleTabChange(val)"
            />
            <!-- Status filter Tab -->
            <Tabs
              v-slot="{}"
              v-model="statusFilter"
              :options="statusFilterOptions"
              variant="solid"
              @change="(val: any) => handleStatusFilterChange(val)"
            />
          </div>

          <!-- Page size selector -->
          <div class="flex items-center gap-2 self-end md:self-auto">
            <span class="text-xs text-[var(--text-muted)] font-medium">每页条数:</span>
            <el-select
              v-model="pageSize"
              size="small"
              style="width: 80px"
              @change="
                () => {
                  currentPage = 1;
                  fetchItems();
                }
              "
            >
              <el-option :value="10" label="10条" />
              <el-option :value="12" label="12条" />
              <el-option :value="20" label="20条" />
              <el-option :value="50" label="50条" />
            </el-select>
          </div>
        </div>
      </Card>

      <!-- Table Shell Card -->
      <Card padding="none" class="table-shell-card overflow-hidden">
        <el-table
          v-loading="isLoading"
          :data="items"
          class="user-table mobile-table"
          row-key="id"
          @row-click="openDetail"
        >
          <!-- Selection Column -->
          <el-table-column type="selection" width="48" align="center" />

          <!-- Thumbnail Preview -->
          <el-table-column label="预览" width="80" align="center">
            <template #default="{ row }">
              <div
                class="w-10 h-10 rounded-lg border border-base overflow-hidden flex items-center justify-center bg-[var(--bg-app)] shrink-0"
              >
                <img v-if="mediaUrl(row)" :src="mediaUrl(row)" class="w-full h-full object-cover" />
                <component :is="pageConfig.icon" v-else class="w-5 h-5 text-[var(--text-muted)]" />
              </div>
            </template>
          </el-table-column>

          <!-- Resource Title and Description -->
          <el-table-column label="资源名称" min-width="220">
            <template #default="{ row }">
              <div class="flex flex-col text-left">
                <button
                  class="text-sm font-bold text-[var(--text-primary)] hover:text-accent transition-colors truncate text-left focus:outline-none"
                  type="button"
                  @click.stop="openDetail(row)"
                >
                  {{ row.title }}
                </button>
                <p class="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                  {{ row.description || '暂无描述信息' }}
                </p>
              </div>
            </template>
          </el-table-column>

          <!-- Creator -->
          <el-table-column label="创作者" min-width="140">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <UserAvatar :user="row.user" size="sm" />
                <span
                  class="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[100px]"
                >
                  {{ row.user?.name || row.user?.email || '匿名' }}
                </span>
              </div>
            </template>
          </el-table-column>

          <!-- Specifications / Meta properties -->
          <el-table-column label="规格属性" min-width="140">
            <template #default="{ row }">
              <div class="flex flex-col text-left">
                <span class="text-xs text-[var(--text-primary)] font-semibold">
                  {{ itemKind(row) }}
                </span>
                <span
                  v-if="row.fileSize || row.size"
                  class="text-[10px] text-[var(--text-muted)] mt-0.5"
                >
                  {{ formatSize(row.fileSize || row.size) }}
                </span>
                <span
                  v-else-if="row.compatibility || row.version"
                  class="text-[10px] text-[var(--text-muted)] mt-0.5"
                >
                  {{ row.compatibility || row.version }}
                </span>
              </div>
            </template>
          </el-table-column>

          <!-- Status badge -->
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <AdminContentStatusBadge :status="row.status" />
            </template>
          </el-table-column>

          <!-- Created Date -->
          <el-table-column label="提交时间" width="140" align="center">
            <template #default="{ row }">
              <span class="text-xs text-[var(--text-secondary)]">
                {{ formatDate(row.createdAt).substring(0, 10) }}
              </span>
            </template>
          </el-table-column>

          <!-- Actions column -->
          <el-table-column label="操作" width="180" align="center">
            <template #default="{ row }">
              <div class="flex items-center justify-center gap-1.5" @click.stop>
                <!-- Quick audit action buttons -->
                <UiButton
                  v-if="row.status === 'PENDING'"
                  v-slot="{}"
                  size="sm"
                  variant="secondary"
                  class="!py-1 !px-2 !min-h-0 text-[11px]"
                  @click="handleQuickApprove(row)"
                >
                  通过
                </UiButton>
                <UiButton
                  v-if="row.status === 'PENDING'"
                  v-slot="{}"
                  size="sm"
                  variant="secondary"
                  class="danger-action !py-1 !px-2 !min-h-0 text-[11px]"
                  @click="handleQuickReject(row)"
                >
                  退回
                </UiButton>

                <!-- More action dropdown -->
                <el-dropdown trigger="click" @command="(cmd: any) => handleCommand(cmd, row)">
                  <UiButton v-slot="{}" size="sm" variant="secondary" class="!p-1.5 !min-h-0">
                    <MoreHorizontal class="w-3.5 h-3.5" />
                  </UiButton>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="details">
                        <Eye class="w-3.5 h-3.5 mr-1" /> 查看详情
                      </el-dropdown-item>
                      <el-dropdown-item command="edit">
                        <Edit3 class="w-3.5 h-3.5 mr-1" /> 编辑资源
                      </el-dropdown-item>
                      <el-dropdown-item command="delete" class="!text-[var(--danger)]">
                        <Trash2 class="w-3.5 h-3.5 mr-1" /> 彻底删除
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>

          <!-- Empty state slot inside el-table -->
          <template #empty>
            <div
              class="flex flex-col items-center justify-center py-8 text-[var(--text-muted)] gap-2"
            >
              <component :is="pageConfig.icon" class="w-8 h-8 text-[var(--text-muted)]" />
              <p class="text-sm font-semibold">{{ pageConfig.emptyLabel }}</p>
              <span class="text-xs">当前筛选条件下没有找到记录。</span>
            </div>
          </template>
        </el-table>

        <!-- Pagination Wrap -->
        <div class="pagination-wrap mobile-row">
          <span class="text-xs text-[var(--text-secondary)]"
            >当前显示 {{ items.length }} 条，共 {{ totalItems }} 条</span
          >
          <el-pagination
            background
            :current-page="currentPage"
            :page-size="pageSize"
            :total="totalItems"
            layout="prev, pager, next, jumper"
            @current-change="setPage"
          />
        </div>
      </Card>
    </main>

    <!-- Details Modal -->
    <ContentDetailModal
      v-model="detailModalVisible"
      :item="activeItem"
      :active-tab="activeTab"
      :page-config="pageConfig"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <!-- Create Modal -->
    <Modal
      :show="isCreateOpen"
      :title="`发布新${pageConfig.label}`"
      size="md"
      glass-card
      @close="isCreateOpen = false"
    >
      <div class="form-stack">
        <label>
          标题 / 名称 *
          <input v-model="createForm.title" placeholder="输入资源名称..." />
        </label>
        <label>
          描述
          <textarea v-model="createForm.description" rows="3" placeholder="输入资源描述介绍..." />
        </label>

        <!-- 3D Assets Specifics -->
        <template v-if="activeTab === 'assets'">
          <div class="form-grid">
            <label>
              资产分类 *
              <select v-model="createForm.categoryId">
                <option v-for="cat in assetCategories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </label>
          </div>
          <div class="file-uploader-box">
            <label class="file-label">
              <Upload class="w-4 h-4" /> <span>3D 模型文件 (GLB/FBX/OBJ)</span>
              <input
                ref="fileInputRef"
                type="file"
                @change="(e) => handleCreateFileChange(e, 'file')"
              />
            </label>
            <span v-if="createForm.file" class="file-info">已选择：{{ createForm.file.name }}</span>
          </div>
          <div class="file-uploader-box">
            <label class="file-label">
              <Upload class="w-4 h-4" /> <span>缩略图预览 (JPEG/PNG)</span>
              <input
                ref="thumbnailInputRef"
                type="file"
                @change="(e) => handleCreateFileChange(e, 'thumbnail')"
              />
            </label>
            <span v-if="createForm.thumbnail" class="file-info"
              >已选择：{{ createForm.thumbnail.name }}</span
            >
          </div>
        </template>

        <!-- Materials Specifics -->
        <template v-if="activeTab === 'materials'">
          <div class="form-grid">
            <label>
              分类名称
              <input v-model="createForm.category" placeholder="如：木纹、金属、布料..." />
            </label>
            <label>
              分辨率
              <select v-model="createForm.resolution">
                <option value="1K">1K</option>
                <option value="2K">2K</option>
                <option value="4K">4K</option>
                <option value="8K">8K</option>
                <option value="Procedural">Procedural 程序化</option>
              </select>
            </label>
          </div>
          <label class="checkbox-label">
            <input v-model="createForm.isProcedural" type="checkbox" />
            <span>是否为程序化材质 (Procedural)</span>
          </label>
          <div class="file-uploader-box">
            <label class="file-label">
              <Upload class="w-4 h-4" /> <span>材质包压缩文件 (.zip/.blend)</span>
              <input
                ref="fileInputRef"
                type="file"
                @change="(e) => handleCreateFileChange(e, 'file')"
              />
            </label>
            <span v-if="createForm.file" class="file-info">已选择：{{ createForm.file.name }}</span>
          </div>
          <div class="file-uploader-box">
            <label class="file-label">
              <Upload class="w-4 h-4" /> <span>预览图 (JPEG/PNG)</span>
              <input
                ref="thumbnailInputRef"
                type="file"
                @change="(e) => handleCreateFileChange(e, 'thumbnail')"
              />
            </label>
            <span v-if="createForm.thumbnail" class="file-info"
              >已选择：{{ createForm.thumbnail.name }}</span
            >
          </div>
        </template>

        <!-- Showcases Specifics -->
        <template v-if="activeTab === 'showcases'">
          <div class="form-grid">
            <label>
              作品媒体类型
              <select v-model="createForm.type">
                <option value="IMAGE">图文作品</option>
                <option value="VIDEO">视频作品</option>
                <option value="MODEL">3D展示作品</option>
              </select>
            </label>
          </div>
          <div class="file-uploader-box">
            <label class="file-label">
              <Upload class="w-4 h-4" /> <span>封面图 (JPEG/PNG)</span>
              <input
                ref="thumbnailInputRef"
                type="file"
                @change="(e) => handleCreateFileChange(e, 'thumbnail')"
              />
            </label>
            <span v-if="createForm.thumbnail" class="file-info"
              >已选择：{{ createForm.thumbnail.name }}</span
            >
          </div>
        </template>

        <!-- Plugins Specifics -->
        <template v-if="activeTab === 'plugins'">
          <div class="form-grid">
            <label>
              类别目录
              <input
                v-model="createForm.category"
                placeholder="如：Blender 插件、Three.js 插件..."
              />
            </label>
            <label>
              版本号
              <input v-model="createForm.version" placeholder="1.0.0" />
            </label>
          </div>
          <label>
            软件兼容性
            <input v-model="createForm.compatibility" placeholder="如：Blender 3.x / 4.x" />
          </label>
          <div class="file-uploader-box">
            <label class="file-label">
              <Upload class="w-4 h-4" /> <span>插件压缩包 (.zip)</span>
              <input
                ref="fileInputRef"
                type="file"
                @change="(e) => handleCreateFileChange(e, 'file')"
              />
            </label>
            <span v-if="createForm.file" class="file-info">已选择：{{ createForm.file.name }}</span>
          </div>
          <div class="file-uploader-box">
            <label class="file-label">
              <Upload class="w-4 h-4" /> <span>预览图 (JPEG/PNG)</span>
              <input
                ref="thumbnailInputRef"
                type="file"
                @change="(e) => handleCreateFileChange(e, 'thumbnail')"
              />
            </label>
            <span v-if="createForm.thumbnail" class="file-info"
              >已选择：{{ createForm.thumbnail.name }}</span
            >
          </div>
        </template>

        <label>
          标签
          <input v-model="createForm.tags" placeholder="标签用逗号分隔，如: 道具, 机械, 科幻" />
        </label>
      </div>
      <template #footer>
        <button type="button" class="ghost-btn dialog-btn" @click="isCreateOpen = false">
          取消
        </button>
        <button
          type="button"
          class="primary-btn dialog-btn"
          :disabled="isSaving"
          @click="submitCreate"
        >
          发布
        </button>
      </template>
    </Modal>

    <!-- Edit Modal -->
    <Modal
      :show="isEditOpen"
      :title="`修改${pageConfig.label}`"
      size="md"
      glass-card
      @close="isEditOpen = false"
    >
      <div class="form-stack">
        <label>
          标题 / 名称 *
          <input v-model="editForm.title" />
        </label>
        <label>
          描述
          <textarea v-model="editForm.description" rows="4" />
        </label>
        <div class="form-grid">
          <label>
            状态
            <select v-model="editForm.status">
              <option value="PENDING">待审核</option>
              <option value="APPROVED">已通过</option>
              <option value="REJECTED">已打回</option>
            </select>
          </label>
          <label v-if="activeTab === 'assets'">
            资产分类
            <select v-model="editForm.categoryId">
              <option value="">未分类</option>
              <option v-for="cat in assetCategories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </label>
          <label v-if="activeTab === 'materials' || activeTab === 'plugins'">
            分类
            <input v-model="editForm.category" />
          </label>
          <label v-if="activeTab === 'showcases'">
            类型
            <select v-model="editForm.type">
              <option value="IMAGE">图文</option>
              <option value="VIDEO">视频</option>
              <option value="MODEL">模型</option>
              <option value="OTHER">其他</option>
            </select>
          </label>
        </div>
        <div v-if="activeTab === 'plugins'" class="form-grid">
          <label>版本<input v-model="editForm.version" /></label>
          <label>兼容性<input v-model="editForm.compatibility" /></label>
        </div>
        <label>标签<input v-model="editForm.tags" placeholder="用逗号分隔" /></label>
      </div>
      <template #footer>
        <button type="button" class="ghost-btn dialog-btn" @click="isEditOpen = false">取消</button>
        <button
          type="button"
          class="primary-btn dialog-btn"
          :disabled="isSaving"
          @click="handleUpdate"
        >
          保存
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.admin-contents-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
}

.table-shell-card {
  border: 1px solid var(--border-base);
  box-shadow: var(--shadow-enterprise);
}

.user-table {
  width: 100%;
}

.pagination-wrap {
  min-height: 48px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 13px;
  border-top: 1px solid var(--border-base);
}

.danger-action {
  background: rgba(220, 38, 38, 0.05) !important;
  color: var(--danger) !important;
  border-color: rgba(220, 38, 38, 0.15) !important;
}

.danger-action:hover {
  background: rgba(220, 38, 38, 0.1) !important;
}

:deep(.el-table) {
  --el-table-border-color: var(--border-base);
  --el-table-header-bg-color: var(--bg-app);
  --el-table-row-hover-bg-color: var(--bg-hover);
  background-color: transparent;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-drawer) {
  background: var(--bg-card);
  color: var(--text-primary);
  border-left: 1px solid var(--border-base);
}

:deep(.el-drawer__header) {
  margin-bottom: 12px;
  padding: 16px 20px 0;
  color: var(--text-primary);
  font-weight: bold;
}

:deep(.el-drawer__body) {
  padding: 20px;
}

/* Modal Form Styles */

.file-uploader-box {
  border: 1px dashed var(--border-strong);
  border-radius: 8px;
  padding: 16px;
  background: var(--bg-elevated);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.file-label {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent) !important;
  font-weight: 900;
}

.file-label input {
  display: none;
}

.file-info {
  font-size: 11px;
  color: var(--text-secondary);
}

.checkbox-label {
  display: flex !important;
  flex-direction: row !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
}

.primary-btn,
.ghost-btn,
.dialog-btn {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
}

.primary-btn {
  background: var(--accent);
  color: white;
}

.ghost-btn {
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.primary-btn:hover {
  filter: brightness(1.1);
}

.ghost-btn:hover {
  background: var(--bg-hover);
}
</style>
