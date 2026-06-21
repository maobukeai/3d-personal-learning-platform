<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertTriangle,
  ArrowUpDown,
  Box,
  CheckCircle2,
  Edit3,
  Eye,
  FolderCog,
  Layers,
  ListChecks,
  MoreHorizontal,
  Puzzle,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { fetchManagementInsights } from './adminManagementInsights';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import UiButton from '@/components/ui/Button.vue';
import UiInput from '@/components/ui/Input.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/PageHeader.vue';

type AuditTab = 'assets' | 'materials' | 'showcases' | 'plugins';
type AuditStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type StatusFilter = AuditStatus | 'ALL';

interface AuditUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface AuditItem {
  id: string;
  title: string;
  description?: string | null;
  status: AuditStatus;
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
  user?: AuditUser;
}

interface PageConfig {
  label: string;
  title: string;
  apiPath: string;
  icon: Component;
  emptyLabel: string;
  reasons: string[];
}

interface AuditListResponse {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  stats?: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

const route = useRoute();
const router = useRouter();
const workspaceStore = useWorkspaceStore();

const getValidTab = (value: unknown): AuditTab => {
  if (value === 'assets' || value === 'materials' || value === 'showcases' || value === 'plugins') {
    return value;
  }
  return 'assets';
};

const getRouteItemId = () => {
  const item = route.query.item;
  return typeof item === 'string' ? item : '';
};

const pageConfigs: Record<AuditTab, PageConfig> = {
  assets: {
    label: '3D 资产',
    title: '3D 资产审核',
    apiPath: '/api/admin/assets',
    icon: Box,
    emptyLabel: '暂无资产记录',
    reasons: [
      '模型文件无法正常预览或加载',
      '面数、贴图或文件体积明显超出发布规范',
      '资产描述、分类或标签信息不完整',
      '版权归属不清晰',
      '缩略图无法准确呈现资产内容',
    ],
  },
  materials: {
    label: '材质',
    title: '材质审核',
    apiPath: '/api/admin/materials',
    icon: Layers,
    emptyLabel: '暂无材质记录',
    reasons: [
      '贴图分辨率或通道文件不符合要求',
      '预览图与实际材质不一致',
      '材质分类或标签缺失',
      '版权归属不清晰',
      '参数说明不足，无法复用',
    ],
  },
  showcases: {
    label: '作品',
    title: '作品内容审核',
    apiPath: '/api/admin/showcases',
    icon: Sparkles,
    emptyLabel: '暂无作品记录',
    reasons: [
      '内容与平台主题关联不足',
      '封面或媒体文件质量不足',
      '作品描述信息不完整',
      '存在版权或授权风险',
      '内容展示不符合社区规范',
    ],
  },
  plugins: {
    label: '插件',
    title: '插件资源审核',
    apiPath: '/api/admin/plugins',
    icon: Puzzle,
    emptyLabel: '暂无插件记录',
    reasons: [
      '缺少安装或使用说明',
      '兼容性信息不完整',
      '插件文件格式不符合要求',
      '版权归属不清晰',
      '功能描述与实际资源不一致',
    ],
  },
};

const activeTab = ref<AuditTab>(getValidTab(route.query.tab || route.meta.auditType));
const statusFilter = ref<StatusFilter>('PENDING');
const searchQuery = ref('');
const items = ref<AuditItem[]>([]);
const allItems = ref<AuditItem[]>([]);
const assetCategories = ref<{ id: string; name: string }[]>([]);
const isLoading = ref(false);
const currentPage = ref(1);
const pageSize = ref(36);
const totalItems = ref(0);
const totalPages = ref(1);
const queueStats = ref<AuditListResponse['stats'] | null>(null);
const selectedIds = ref<string[]>([]);
const activeItem = ref<AuditItem | null>(null);
const rejectDialogVisible = ref(false);
const detailDrawerVisible = ref(false);
const isEditOpen = ref(false);
const isSaving = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const openDetail = (item: AuditItem) => {
  activeItem.value = item;
  detailDrawerVisible.value = true;
};

const rejectionForm = ref({
  reason: '',
  isBatch: false,
  targetId: '',
});

const editForm = ref({
  id: '',
  title: '',
  description: '',
  status: 'PENDING' as AuditStatus,
  categoryId: '',
  category: '',
  tags: '',
  type: '',
  version: '',
  compatibility: '',
});

const pageConfig = computed(() => pageConfigs[activeTab.value]);

const moderationTabs = computed(() => [
  { id: 'assets' as const, badge: workspaceStore.adminStats.pendingAssets, ...pageConfigs.assets },
  {
    id: 'materials' as const,
    badge: workspaceStore.adminStats.pendingMaterials,
    ...pageConfigs.materials,
  },
  {
    id: 'showcases' as const,
    badge: workspaceStore.adminStats.pendingShowcases,
    ...pageConfigs.showcases,
  },
  {
    id: 'plugins' as const,
    badge: workspaceStore.adminStats.pendingPlugins,
    ...pageConfigs.plugins,
  },
]);

const moderationTabOptions = computed(() => {
  return moderationTabs.value.map((tab) => ({
    label: tab.label,
    value: tab.id,
    icon: tab.icon,
    badge: tab.badge,
  }));
});

const statusFilterOptions = computed(() => [
  { label: '待审核', value: 'PENDING' as const },
  { label: '已通过', value: 'APPROVED' as const },
  { label: '已打回', value: 'REJECTED' as const },
  { label: '全部', value: 'ALL' as const },
]);

const fetchItems = async () => {
  isLoading.value = true;
  selectedIds.value = [];
  try {
    const params = {
      response: 'paginated',
      page: currentPage.value,
      limit: pageSize.value,
      search: searchQuery.value.trim() || undefined,
      status: statusFilter.value !== 'ALL' ? statusFilter.value : undefined,
    };
    const response = await api.get<AuditItem[] | AuditListResponse>(pageConfig.value.apiPath, {
      params,
    });
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
      queueStats.value = response.data.stats || null;
    }
    const routeItemId = getRouteItemId();
    activeItem.value =
      items.value.find((item) => item.id === routeItemId) ||
      items.value.find((item) => item.id === activeItem.value?.id) ||
      items.value[0] ||
      null;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, `无法加载${pageConfig.value.label}审核队列`));
  } finally {
    isLoading.value = false;
  }
};

const fetchAllForStats = async () => {
  try {
    const response = await api.get<AuditItem[]>(pageConfig.value.apiPath);
    allItems.value = response.data;
  } catch (error) {
    console.error('Fetch audit stats error:', error);
  }
};

const fetchAssetCategories = async () => {
  try {
    const response = await api.get<{ id: string; name: string }[]>('/api/admin/asset-categories');
    assetCategories.value = response.data;
  } catch (error) {
    console.error('Fetch asset categories error:', error);
  }
};

const refreshQueue = async () => {
  await fetchItems();
  fetchManagementInsights(true);
};

const stats = computed(() => {
  if (queueStats.value) return queueStats.value;
  const source = allItems.value.length ? allItems.value : items.value;
  return {
    total: source.length,
    pending: source.filter((item) => item.status === 'PENDING').length,
    approved: source.filter((item) => item.status === 'APPROVED').length,
    rejected: source.filter((item) => item.status === 'REJECTED').length,
  };
});

const filteredItems = computed(() => {
  return items.value;
});

const approvalRate = computed(() => {
  const denominator = Math.max(stats.value.total, 1);
  return Math.round((stats.value.approved / denominator) * 100);
});

const visibleRange = computed(() => {
  if (!totalItems.value) return '0';
  const start = (currentPage.value - 1) * pageSize.value + 1;
  const end = Math.min(currentPage.value * pageSize.value, totalItems.value);
  return `${start}-${end}`;
});

const backlogLabel = computed(() => {
  if (stats.value.pending > 20) return '积压偏高';
  if (stats.value.pending > 5) return '需要关注';
  return '队列健康';
});

const consolidatedCards = computed(() => {
  const pendingCount = stats.value.pending;
  const backlogText = backlogLabel.value;

  let backlogVariant: 'success' | 'warning' | 'danger' = 'success';
  if (pendingCount > 20) backlogVariant = 'danger';
  else if (pendingCount > 5) backlogVariant = 'warning';

  return [
    {
      label: '审核队列总量',
      value: stats.value.total,
      hint: `已通过 ${stats.value.approved} · 已打回 ${stats.value.rejected}`,
      icon: Layers,
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      health: { label: '正常', variant: 'success' as const },
    },
    {
      label: '待审核资源',
      value: pendingCount,
      hint: `需优先处理`,
      icon: AlertTriangle,
      color:
        pendingCount > 0
          ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
          : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: backlogText, variant: backlogVariant },
    },
    {
      label: '审核通过数',
      value: stats.value.approved,
      hint: `已发布上线`,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: '稳定', variant: 'success' as const },
    },
    {
      label: '审核通过率',
      value: `${approvalRate.value}%`,
      hint: `已审核占总量比`,
      icon: ListChecks,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health:
        approvalRate.value >= 80
          ? { label: '高效', variant: 'success' as const }
          : { label: '关注', variant: 'warning' as const },
    },
  ];
});

const isAllSelected = computed(
  () =>
    filteredItems.value.length > 0 &&
    filteredItems.value.every((item) => selectedIds.value.includes(item.id)),
);

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = selectedIds.value.filter(
      (id) => !filteredItems.value.some((item) => item.id === id),
    );
  } else {
    selectedIds.value = Array.from(
      new Set([...selectedIds.value, ...filteredItems.value.map((item) => item.id)]),
    );
  }
};

const toggleSelection = (id: string) => {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((selectedId) => selectedId !== id)
    : [...selectedIds.value, id];
};

const setStatusFilter = (status: StatusFilter) => {
  statusFilter.value = status;
  currentPage.value = 1;
  fetchItems();
};

const setPage = (page: number) => {
  const nextPage = Math.min(Math.max(page, 1), totalPages.value);
  if (nextPage === currentPage.value) return;
  currentPage.value = nextPage;
  fetchItems();
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已通过',
    REJECTED: '已打回',
  };
  return map[status] || status;
};

const statusClass = (status: string) => ({
  'tone-amber': status === 'PENDING',
  'tone-green': status === 'APPROVED',
  'tone-red': status === 'REJECTED',
});

const mediaUrl = (item: AuditItem) =>
  item.thumbnailUrl ||
  item.previewUrl ||
  item.thumbnail ||
  item.videoUrl ||
  item.url ||
  item.fileUrl ||
  '';

const itemKind = (item: AuditItem) => {
  if (activeTab.value === 'assets') return item.type || 'MODEL';
  if (activeTab.value === 'materials') return item.category || '材质';
  if (activeTab.value === 'plugins') return item.category || '插件';
  return item.type || '作品';
};

const metricLine = (item: AuditItem) => {
  if (activeTab.value === 'assets') return `${item.size || item.fileSize || 0} MB`;
  if (activeTab.value === 'materials') return item.resolution || `${item.fileSize || 0} MB`;
  if (activeTab.value === 'showcases') return `${item.views || 0} 浏览 · ${item.likes || 0} 喜欢`;
  if (activeTab.value === 'plugins')
    return `${item.version || 'v1.0.0'} · ${item.compatibility || '未填兼容性'}`;
  return '待审核';
};

const openCategoryManager = () => {
  router.push('/admin/categories');
};

const openEdit = (item: AuditItem) => {
  activeItem.value = item;
  editForm.value = {
    id: item.id,
    title: item.title,
    description: item.description || '',
    status: item.status,
    categoryId: item.categoryId || '',
    category: item.category || '',
    tags: item.tags || '',
    type: item.type || '',
    version: item.version || '',
    compatibility: item.compatibility || '',
  };
  isEditOpen.value = true;
};

const handleStatusUpdate = async (item: AuditItem, status: AuditStatus) => {
  activeItem.value = item;
  if (status === 'REJECTED') {
    rejectionForm.value = { reason: '', isBatch: false, targetId: item.id };
    rejectDialogVisible.value = true;
    return;
  }

  try {
    await api.put(`${pageConfig.value.apiPath}/${item.id}/status`, { status });
    ElMessage.success('审核已通过');
    await refreshQueue();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '审核操作失败'));
  }
};

const submitRejection = async () => {
  if (!rejectionForm.value.reason.trim()) {
    ElMessage.warning('请填写打回原因');
    return;
  }

  try {
    if (rejectionForm.value.isBatch) {
      await api.put(`${pageConfig.value.apiPath}/batch-status`, {
        ids: selectedIds.value,
        status: 'REJECTED',
        rejectReason: rejectionForm.value.reason.trim(),
      });
      ElMessage.success(`已打回 ${selectedIds.value.length} 条记录`);
      selectedIds.value = [];
    } else {
      await api.put(`${pageConfig.value.apiPath}/${rejectionForm.value.targetId}/status`, {
        status: 'REJECTED',
        rejectReason: rejectionForm.value.reason.trim(),
      });
      ElMessage.success('记录已打回');
    }
    rejectDialogVisible.value = false;
    await refreshQueue();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '打回失败'));
  }
};

const handleBatchApprove = async () => {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(`确认通过 ${selectedIds.value.length} 条记录？`, '批量审核', {
      confirmButtonText: '确认通过',
      cancelButtonText: '取消',
      type: 'success',
    });
    await api.put(`${pageConfig.value.apiPath}/batch-status`, {
      ids: selectedIds.value,
      status: 'APPROVED',
    });
    ElMessage.success('批量审核已通过');
    selectedIds.value = [];
    await refreshQueue();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '批量审核失败'));
    }
  }
};

const handleBatchReject = () => {
  if (selectedIds.value.length === 0) return;
  rejectionForm.value = { reason: '', isBatch: true, targetId: '' };
  rejectDialogVisible.value = true;
};

const handleDelete = async (item: AuditItem) => {
  try {
    await ElMessageBox.confirm(`确认删除「${item.title}」？`, '删除审核记录', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    });
    await api.delete(`${pageConfig.value.apiPath}/${item.id}`);
    ElMessage.success('记录已删除');
    await refreshQueue();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '删除失败'));
    }
  }
};

const handleUpdate = async () => {
  isSaving.value = true;
  try {
    const payload: Record<string, string> = {
      title: editForm.value.title,
      description: editForm.value.description,
      status: editForm.value.status,
    };

    if (activeTab.value === 'assets') {
      payload.categoryId = editForm.value.categoryId;
      payload.tags = editForm.value.tags;
    }
    if (activeTab.value === 'materials') {
      payload.category = editForm.value.category;
      payload.tags = editForm.value.tags;
    }
    if (activeTab.value === 'showcases') {
      payload.type = editForm.value.type;
      payload.tags = editForm.value.tags;
    }
    if (activeTab.value === 'plugins') {
      payload.category = editForm.value.category;
      payload.tags = editForm.value.tags;
      payload.version = editForm.value.version;
      payload.compatibility = editForm.value.compatibility;
    }

    await api.put(`${pageConfig.value.apiPath}/${editForm.value.id}`, payload);
    ElMessage.success('内容信息已保存');
    isEditOpen.value = false;
    await refreshQueue();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存失败'));
  } finally {
    isSaving.value = false;
  }
};

watch(activeTab, (newTab) => {
  router.replace({ query: { ...route.query, tab: newTab } });
  statusFilter.value = 'PENDING';
  searchQuery.value = '';
  currentPage.value = 1;
  refreshQueue();
});

watch([searchQuery, pageSize], () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentPage.value = 1;
    fetchItems();
  }, 260);
});

watch(
  () => [route.query.tab, route.meta.auditType],
  ([tab, metaTab]) => {
    const target = getValidTab(tab || metaTab);
    if (target !== activeTab.value) activeTab.value = target;
  },
);

watch(
  () => route.query.item,
  () => {
    const routeItemId = getRouteItemId();
    if (!routeItemId) return;
    const target = items.value.find((item) => item.id === routeItemId);
    if (target) activeItem.value = target;
  },
);

onMounted(() => {
  refreshQueue();
  fetchAllForStats();
  fetchAssetCategories();
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <div
    class="admin-audits-page flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)]"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
      <PageHeader :title="pageConfig.title" subtitle="内容审核" variant="card">
        <template #center>
          <!-- Compact Search Box (Centered) -->
          <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
            <Search />
            <input
              v-model="searchQuery"
              type="search"
              placeholder="搜索当前队列..."
            />
          </label>
        </template>

        <UiButton variant="secondary" size="sm" :icon="FolderCog" @click="openCategoryManager">
          分类管理
        </UiButton>
        <UiButton
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="refreshQueue"
        >
          刷新
        </UiButton>
      </PageHeader>
      <!-- KPI Metrics Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          v-for="card in consolidatedCards"
          :key="card.label"
          hoverable
          glow
          class="group !p-2 px-2.5"
        >
          <div class="flex items-center justify-between w-full gap-3">
            <div class="flex items-center gap-2 min-w-0">
              <span
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-slate-100/10"
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

            <div class="flex items-center gap-2 shrink-0">
              <span class="text-base font-black text-[var(--text-primary)] leading-none">
                {{ card.value }}
              </span>
              <Badge :variant="card.health.variant">
                {{ card.health.label }}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      <!-- Filters & Search Toolbar -->
      <Card padding="sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3 overflow-x-auto scrollbar-hide shrink-0">
            <!-- Resource Type Tabs -->
            <Tabs v-model="activeTab" :options="moderationTabOptions" variant="solid" />
            <!-- Status Tabs -->
            <Tabs
              v-model="statusFilter"
              :options="statusFilterOptions"
              variant="solid"
              @change="(val: any) => setStatusFilter(val)"
            />
          </div>
          <div class="flex items-center gap-2">
            <span
              class="text-xs text-[var(--text-secondary)] shrink-0 flex items-center gap-1 font-semibold"
            >
              <ArrowUpDown class="w-3.5 h-3.5" /> 最新提交优先
            </span>
            <el-select v-model="pageSize" size="small" style="width: 100px">
              <el-option :value="24" label="24 条" />
              <el-option :value="36" label="36 条" />
              <el-option :value="60" label="60 条" />
              <el-option :value="100" label="100 条" />
            </el-select>
          </div>
        </div>
      </Card>

      <!-- Batch operations bar -->
      <div
        v-if="selectedIds.length"
        class="batch-bar flex items-center justify-between gap-3 p-2 px-3 border border-slate-100 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-sm rounded-lg"
      >
        <span class="text-xs font-semibold text-[var(--text-secondary)]">
          已选择 {{ selectedIds.length }} 条记录
        </span>
        <div class="flex items-center gap-2">
          <UiButton variant="primary" size="sm" @click="handleBatchApprove">批量通过</UiButton>
          <UiButton variant="danger" size="sm" @click="handleBatchReject">批量打回</UiButton>
          <UiButton variant="secondary" size="sm" @click="selectedIds = []">清空</UiButton>
        </div>
      </div>

      <!-- Data Panel -->
      <Card
        padding="none"
        class="table-shell-card overflow-hidden flex-1 flex flex-col min-h-[360px]"
      >
        <el-table
          v-loading="isLoading"
          :data="filteredItems"
          class="user-table w-full flex-1"
          row-class-name="table-row"
          @row-click="openDetail"
        >
          <el-table-column width="48">
            <template #header>
              <input
                type="checkbox"
                :checked="isAllSelected"
                @change="toggleSelectAll"
                @click.stop
              />
            </template>
            <template #default="{ row }">
              <input
                type="checkbox"
                :checked="selectedIds.includes(row.id)"
                @change="toggleSelection(row.id)"
                @click.stop
              />
            </template>
          </el-table-column>

          <el-table-column label="预览" width="80">
            <template #default="{ row }">
              <div
                class="row-thumb w-10 h-10 rounded-lg border border-slate-100 dark:border-white/5 overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-white/5"
              >
                <img
                  v-if="mediaUrl(row)"
                  :src="mediaUrl(row)"
                  alt=""
                  class="w-full h-full object-cover"
                />
                <component :is="pageConfig.icon" v-else class="w-5 h-5 text-slate-400" />
              </div>
            </template>
          </el-table-column>

          <el-table-column label="资源名称" min-width="220">
            <template #default="{ row }">
              <div class="min-w-0">
                <strong class="text-sm font-bold truncate text-[var(--text-primary)] block">{{
                  row.title
                }}</strong>
                <small class="text-[11px] text-[var(--text-secondary)] truncate block mt-0.5">
                  {{ row.description || '暂无描述' }}
                </small>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="作者" width="180">
            <template #default="{ row }">
              <div class="user-cell flex items-center gap-2">
                <UserAvatar :user="row.user" size="xs" />
                <span class="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {{ row.user?.name || row.user?.email || '匿名创作者' }}
                </span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="规格参数" width="160">
            <template #default="{ row }">
              <span class="text-xs text-[var(--text-secondary)]">
                {{ itemKind(row) }} · {{ metricLine(row) }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <span
                class="pill text-xs px-2 py-0.5 font-bold rounded-full"
                :class="statusClass(row.status)"
              >
                {{ statusLabel(row.status) }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="提交时间" width="180">
            <template #default="{ row }">
              <span class="text-xs text-[var(--text-secondary)]">
                {{ formatDate(row.createdAt) }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="220" align="right">
            <template #default="{ row }">
              <div class="flex items-center justify-end gap-1.5" @click.stop>
                <UiButton
                  v-if="row.status !== 'APPROVED'"
                  variant="primary"
                  size="sm"
                  :icon="CheckCircle2"
                  @click="handleStatusUpdate(row, 'APPROVED')"
                >
                  通过
                </UiButton>
                <UiButton
                  v-if="row.status !== 'REJECTED'"
                  variant="danger"
                  size="sm"
                  :icon="XCircle"
                  @click="handleStatusUpdate(row, 'REJECTED')"
                >
                  打回
                </UiButton>
                <el-dropdown trigger="click">
                  <button
                    type="button"
                    class="icon-btn p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <MoreHorizontal class="w-4 h-4 text-slate-500" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="openDetail(row)">
                        <Eye class="dropdown-icon" /> 查看详情
                      </el-dropdown-item>
                      <el-dropdown-item @click="openEdit(row)">
                        <Edit3 class="dropdown-icon" /> 编辑
                      </el-dropdown-item>
                      <el-dropdown-item divided @click="handleDelete(row)">
                        <Trash2 class="dropdown-icon danger" /> 删除
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- Empty state inside ElTable wrapper or custom if filteredItems is empty -->
        <div
          v-if="filteredItems.length === 0"
          class="empty-state py-12 flex flex-col items-center justify-center text-center flex-1"
        >
          <component
            :is="pageConfig.icon"
            class="w-12 h-12 text-slate-300 dark:text-white/10 mb-4"
          />
          <strong class="text-base font-bold text-[var(--text-primary)]">{{
            pageConfig.emptyLabel
          }}</strong>
          <span class="text-sm text-[var(--text-secondary)] mt-1"
            >当前筛选条件下暂无需要处理的记录。</span
          >
        </div>

        <!-- Pagination -->
        <div
          class="flex items-center justify-between p-3 border-t border-slate-100 dark:border-white/5 bg-white/40 dark:bg-white/5 shrink-0"
        >
          <span class="text-xs text-[var(--text-secondary)]">
            显示 {{ visibleRange }} / 共 {{ totalItems }} 条记录
          </span>
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="totalItems"
            layout="prev, pager, next"
            small
            background
            @current-change="setPage"
          />
        </div>
      </Card>
    </main>

    <el-drawer v-model="detailDrawerVisible" size="500px" :with-header="false">
      <aside
        v-if="activeItem"
        class="detail-drawer flex flex-col h-full p-4 overflow-y-auto space-y-4"
      >
        <!-- Header -->
        <div class="flex items-start justify-between">
          <div class="min-w-0">
            <span
              class="pill text-xs px-2 py-0.5 font-bold rounded-full inline-block"
              :class="statusClass(activeItem.status)"
            >
              {{ statusLabel(activeItem.status) }}
            </span>
            <h2 class="text-xl font-bold mt-2 text-[var(--text-primary)] break-words">
              {{ activeItem.title }}
            </h2>
            <p class="text-xs text-[var(--text-secondary)] mt-1">
              {{ itemKind(activeItem) }} · {{ formatDate(activeItem.createdAt) }}
            </p>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-2xl font-light leading-none"
            @click="detailDrawerVisible = false"
          >
            &times;
          </button>
        </div>

        <!-- Preview Media -->
        <div
          class="inspector-media w-full h-48 rounded-lg overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5"
        >
          <img
            v-if="mediaUrl(activeItem)"
            :src="mediaUrl(activeItem)"
            alt=""
            class="w-full h-full object-cover"
          />
          <component :is="pageConfig.icon" v-else class="w-12 h-12 text-slate-400" />
        </div>

        <!-- Details -->
        <div
          class="inspector-section p-3 border border-slate-100 dark:border-white/5 rounded-lg space-y-2"
        >
          <h3 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            提交信息
          </h3>
          <div class="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-xs">
            <span class="text-[var(--text-secondary)]">作者</span>
            <strong class="text-[var(--text-primary)]">{{
              activeItem.user?.name || activeItem.user?.email || '匿名创作者'
            }}</strong>
            <span class="text-[var(--text-secondary)]">类型</span>
            <strong class="text-[var(--text-primary)]">{{ itemKind(activeItem) }}</strong>
            <span class="text-[var(--text-secondary)]">规格</span>
            <strong class="text-[var(--text-primary)]">{{ metricLine(activeItem) }}</strong>
            <span class="text-[var(--text-secondary)]">时间</span>
            <strong class="text-[var(--text-primary)]">{{
              formatDate(activeItem.createdAt)
            }}</strong>
          </div>
        </div>

        <!-- Description -->
        <div
          class="inspector-section p-3 border border-slate-100 dark:border-white/5 rounded-lg space-y-2"
        >
          <h3 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            资源描述
          </h3>
          <p class="text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
            {{ activeItem.description || '暂无描述' }}
          </p>
        </div>

        <!-- Tags -->
        <div
          v-if="activeItem.tags"
          class="inspector-section p-3 border border-slate-100 dark:border-white/5 rounded-lg space-y-2"
        >
          <h3 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            标签
          </h3>
          <p class="text-xs text-[var(--text-primary)] break-all">{{ activeItem.tags }}</p>
        </div>

        <!-- Rejection Reason if rejected -->
        <div
          v-if="activeItem.rejectReason"
          class="inspector-section p-3 border border-red-100 dark:border-red-950/20 bg-red-50/50 dark:bg-red-950/5 rounded-lg space-y-2"
        >
          <h3 class="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">
            打回原因
          </h3>
          <p class="text-xs text-red-700 dark:text-red-300 leading-relaxed">
            {{ activeItem.rejectReason }}
          </p>
        </div>

        <!-- Drawer Actions -->
        <div
          class="drawer-actions pt-4 mt-auto border-t border-slate-100 dark:border-white/5 flex flex-wrap gap-2"
        >
          <a
            v-if="mediaUrl(activeItem)"
            :href="mediaUrl(activeItem)"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          >
            <Eye class="w-3.5 h-3.5" /> 查看原件
          </a>
          <UiButton variant="secondary" size="sm" :icon="Edit3" @click="openEdit(activeItem)">
            编辑
          </UiButton>
          <UiButton
            v-if="activeItem.status !== 'APPROVED'"
            variant="primary"
            size="sm"
            :icon="CheckCircle2"
            @click="handleStatusUpdate(activeItem, 'APPROVED')"
          >
            通过
          </UiButton>
          <UiButton
            v-if="activeItem.status !== 'REJECTED'"
            variant="danger"
            size="sm"
            :icon="XCircle"
            @click="handleStatusUpdate(activeItem, 'REJECTED')"
          >
            打回
          </UiButton>
          <UiButton variant="danger" size="sm" :icon="Trash2" @click="handleDelete(activeItem)">
            删除
          </UiButton>
        </div>
      </aside>
    </el-drawer>

    <Modal
      :show="isEditOpen"
      :title="`编辑${pageConfig.label}`"
      size="md"
      @close="isEditOpen = false"
    >
      <div class="form-stack">
        <label>标题<UiInput v-model="editForm.title" :glass="false" /></label>
        <label>描述<textarea v-model="editForm.description" rows="4" /></label>
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
            <UiInput v-model="editForm.category" :glass="false" />
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
          <label>版本<UiInput v-model="editForm.version" :glass="false" /></label>
          <label>兼容性<UiInput v-model="editForm.compatibility" :glass="false" /></label>
        </div>
        <label
          >标签<UiInput v-model="editForm.tags" placeholder="用逗号分隔" :glass="false"
        /></label>
      </div>
      <template #footer>
        <UiButton variant="secondary" @click="isEditOpen = false">取消</UiButton>
        <UiButton variant="primary" :loading="isSaving" @click="handleUpdate">保存</UiButton>
      </template>
    </Modal>

    <Modal
      :show="rejectDialogVisible"
      title="填写打回原因"
      size="md"
      @close="rejectDialogVisible = false"
    >
      <div class="form-stack">
        <div class="reason-templates">
          <button
            v-for="reason in pageConfig.reasons"
            :key="reason"
            type="button"
            :class="{ active: rejectionForm.reason === reason }"
            @click="rejectionForm.reason = reason"
          >
            {{ reason }}
          </button>
        </div>
        <label>
          详细说明
          <textarea
            v-model="rejectionForm.reason"
            rows="5"
            placeholder="写清楚需要作者修改的地方"
          />
        </label>
      </div>
      <template #footer>
        <UiButton variant="secondary" @click="rejectDialogVisible = false">取消</UiButton>
        <UiButton variant="danger" @click="submitRejection">确认打回</UiButton>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.admin-audits-page {
  height: 100%;
  min-height: 0;
  background: transparent;
  color: var(--text-primary);
}

:deep(.el-drawer__body) {
  padding: 0;
}

.detail-drawer {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  overflow: auto;
  background: var(--bg-card);
  color: var(--text-primary);
}

.inspector-media {
  height: 190px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
}

.inspector-section {
  padding: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
}

.pill {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.tone-green {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}

.tone-red {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.12);
}

.tone-amber {
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

.user-table :deep(.el-table__header th) {
  height: 40px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.user-table :deep(.el-table__row) {
  height: 48px;
  cursor: pointer;
}

.user-table :deep(.el-table__cell) {
  padding: 4px 0;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.form-stack {
  display: grid;
  gap: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.form-stack label {
  display: grid;
  gap: 7px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.form-stack input,
.form-stack textarea,
.form-stack select {
  min-height: 40px;
  padding: 10px 11px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  resize: vertical;
  color: var(--text-primary);
  outline: none;
}

.reason-templates {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.reason-templates button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 900;
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
}

.reason-templates button.active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.empty-state,
.loading-state {
  min-height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
}

.empty-state svg,
.loading-state svg {
  width: 36px;
  height: 36px;
}

.spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
