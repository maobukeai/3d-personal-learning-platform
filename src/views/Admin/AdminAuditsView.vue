<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertTriangle,
  ArrowUpDown,
  Box,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  Eye,
  FolderCog,
  Layers,
  ListChecks,
  PackageCheck,
  Puzzle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  XCircle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { fetchManagementInsights } from './adminManagementInsights';
import AdminOpsPanel from './components/AdminOpsPanel.vue';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import UiButton from '@/components/ui/Button.vue';
import UiInput from '@/components/ui/Input.vue';

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
const isEditOpen = ref(false);
const isSaving = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

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

const formatDate = (value?: string | null) => {
  if (!value) return '未记录';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  <div class="admin-workbench">
    <header class="workbench-header">
      <div>
        <p class="eyebrow">内容审核 · {{ backlogLabel }}</p>
        <h1>{{ pageConfig.title }}</h1>
      </div>
      <div class="header-actions">
        <UiButton variant="secondary" :icon="FolderCog" @click="openCategoryManager">
          分类管理
        </UiButton>
        <UiButton variant="secondary" :icon="RefreshCw" :loading="isLoading" @click="refreshQueue">
          刷新
        </UiButton>
      </div>
    </header>

    <AdminOpsPanel scope="audits" />

    <section class="metric-grid">
      <article class="metric-card">
        <PackageCheck />
        <div>
          <span>总量</span><strong>{{ stats.total }}</strong>
        </div>
      </article>
      <article class="metric-card">
        <AlertTriangle />
        <div>
          <span>待审核</span><strong>{{ stats.pending }}</strong>
        </div>
      </article>
      <article class="metric-card">
        <CheckCircle2 />
        <div>
          <span>已通过</span><strong>{{ stats.approved }}</strong>
        </div>
      </article>
      <article class="metric-card">
        <XCircle />
        <div>
          <span>已打回</span><strong>{{ stats.rejected }}</strong>
        </div>
      </article>
      <article class="metric-card">
        <ListChecks />
        <div>
          <span>通过率</span><strong>{{ approvalRate }}%</strong>
        </div>
      </article>
    </section>

    <section class="toolbar-panel">
      <div class="shrink-0 overflow-x-auto" style="scrollbar-width: none; -ms-overflow-style: none">
        <Tabs v-model="activeTab" :options="moderationTabOptions" size="sm" />
      </div>
      <div class="shrink-0 overflow-x-auto" style="scrollbar-width: none; -ms-overflow-style: none">
        <Tabs
          v-model="statusFilter"
          :options="statusFilterOptions"
          size="sm"
          @change="(val: any) => setStatusFilter(val)"
        />
      </div>
      <UiInput
        v-model="searchQuery"
        :icon="Search"
        placeholder="搜索标题、作者、标签、分类"
        :glass="false"
        class="ml-auto min-w-[280px]"
      />
      <div class="toolbar-meta">
        <span><ArrowUpDown /> 最新提交优先</span>
        <label>
          <SlidersHorizontal />
          <select v-model.number="pageSize">
            <option :value="24">24 条</option>
            <option :value="36">36 条</option>
            <option :value="60">60 条</option>
            <option :value="100">100 条</option>
          </select>
        </label>
      </div>
    </section>

    <section v-if="selectedIds.length" class="batch-bar">
      <span>已选择 {{ selectedIds.length }} 条记录</span>
      <div>
        <UiButton variant="primary" size="sm" @click="handleBatchApprove">批量通过</UiButton>
        <UiButton variant="danger" size="sm" @click="handleBatchReject">批量打回</UiButton>
        <UiButton variant="secondary" size="sm" @click="selectedIds = []">清空</UiButton>
      </div>
    </section>

    <main class="review-shell">
      <section class="queue-panel">
        <div class="queue-head">
          <UiButton
            variant="secondary"
            size="sm"
            :icon="isAllSelected ? CheckSquare : Square"
            @click="toggleSelectAll"
          >
            全选当前队列
          </UiButton>
          <span>{{ visibleRange }} / {{ totalItems }} 条</span>
        </div>

        <div v-if="isLoading" class="loading-state">
          <RefreshCw class="spinning" />
          <span>正在加载审核队列</span>
        </div>

        <div v-else-if="filteredItems.length === 0" class="empty-state">
          <component :is="pageConfig.icon" />
          <strong>{{ pageConfig.emptyLabel }}</strong>
          <span>当前筛选条件下没有需要展示的记录。</span>
        </div>

        <div v-else class="review-list">
          <article
            v-for="item in filteredItems"
            :key="item.id"
            class="review-row"
            :class="{ active: activeItem?.id === item.id, selected: selectedIds.includes(item.id) }"
            @click="activeItem = item"
          >
            <button type="button" class="row-check" @click.stop="toggleSelection(item.id)">
              <CheckSquare v-if="selectedIds.includes(item.id)" />
              <Square v-else />
            </button>
            <div class="row-thumb">
              <img v-if="mediaUrl(item)" :src="mediaUrl(item)" alt="" />
              <component :is="pageConfig.icon" v-else />
            </div>
            <div class="row-main">
              <div class="row-title">
                <strong>{{ item.title }}</strong>
                <span class="pill" :class="statusClass(item.status)">{{
                  statusLabel(item.status)
                }}</span>
              </div>
              <p>{{ item.description || '暂无描述' }}</p>
              <div class="row-meta">
                <span>{{ itemKind(item) }}</span>
                <span>{{ metricLine(item) }}</span>
                <span>{{ formatDate(item.createdAt) }}</span>
                <UserAvatar :user="item.user" size="xs" />
                <span>{{ item.user?.name || item.user?.email || '匿名创作者' }}</span>
              </div>
            </div>
            <div class="row-actions" @click.stop>
              <UiButton
                v-if="item.status !== 'APPROVED'"
                variant="primary"
                size="sm"
                :icon="CheckCircle2"
                @click="handleStatusUpdate(item, 'APPROVED')"
              >
                通过
              </UiButton>
              <UiButton
                v-if="item.status !== 'REJECTED'"
                variant="danger"
                size="sm"
                :icon="XCircle"
                @click="handleStatusUpdate(item, 'REJECTED')"
              >
                打回
              </UiButton>
              <UiButton variant="secondary" size="sm" :icon="Edit3" @click="openEdit(item)">
                编辑
              </UiButton>
            </div>
          </article>
        </div>

        <footer class="queue-pagination">
          <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
          <div>
            <button
              type="button"
              class="icon-btn"
              :disabled="currentPage === 1"
              @click="setPage(1)"
            >
              <ChevronsLeft />
            </button>
            <button
              type="button"
              class="icon-btn"
              :disabled="currentPage === 1"
              @click="setPage(currentPage - 1)"
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              class="icon-btn"
              :disabled="currentPage === totalPages"
              @click="setPage(currentPage + 1)"
            >
              <ChevronRight />
            </button>
            <button
              type="button"
              class="icon-btn"
              :disabled="currentPage === totalPages"
              @click="setPage(totalPages)"
            >
              <ChevronsRight />
            </button>
          </div>
        </footer>
      </section>

      <aside class="inspector-panel">
        <template v-if="activeItem">
          <div class="inspector-media">
            <img v-if="mediaUrl(activeItem)" :src="mediaUrl(activeItem)" alt="" />
            <component :is="pageConfig.icon" v-else />
          </div>
          <div class="inspector-title">
            <span class="pill" :class="statusClass(activeItem.status)">
              {{ statusLabel(activeItem.status) }}
            </span>
            <h2>{{ activeItem.title }}</h2>
            <p>{{ activeItem.description || '暂无描述' }}</p>
          </div>

          <div class="inspector-section">
            <h3>提交信息</h3>
            <div class="detail-grid">
              <span>作者</span
              ><strong>{{
                activeItem.user?.name || activeItem.user?.email || '匿名创作者'
              }}</strong>
              <span>类型</span><strong>{{ itemKind(activeItem) }}</strong> <span>指标</span
              ><strong>{{ metricLine(activeItem) }}</strong> <span>时间</span
              ><strong>{{ formatDate(activeItem.createdAt) }}</strong>
            </div>
          </div>

          <div v-if="activeItem.tags" class="inspector-section">
            <h3>标签</h3>
            <p class="tag-line">{{ activeItem.tags }}</p>
          </div>

          <div v-if="activeItem.rejectReason" class="inspector-section">
            <h3>打回原因</h3>
            <p class="body-text">{{ activeItem.rejectReason }}</p>
          </div>

          <div class="inspector-actions">
            <a
              v-if="mediaUrl(activeItem)"
              :href="mediaUrl(activeItem)"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Eye /> 查看原件
            </a>
            <UiButton variant="secondary" :icon="Edit3" @click="openEdit(activeItem)">编辑</UiButton>
            <UiButton
              v-if="activeItem.status !== 'APPROVED'"
              variant="primary"
              :icon="CheckCircle2"
              @click="handleStatusUpdate(activeItem, 'APPROVED')"
            >
              通过
            </UiButton>
            <UiButton
              v-if="activeItem.status !== 'REJECTED'"
              variant="danger"
              :icon="XCircle"
              @click="handleStatusUpdate(activeItem, 'REJECTED')"
            >
              打回
            </UiButton>
            <UiButton variant="danger" :icon="Trash2" @click="handleDelete(activeItem)">
              删除
            </UiButton>
          </div>
        </template>
        <div v-else class="empty-state">
          <ChevronRight />
          <strong>选择一条记录</strong>
          <span>右侧会显示审核详情。</span>
        </div>
      </aside>
    </main>

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
        <label>标签<UiInput v-model="editForm.tags" placeholder="用逗号分隔" :glass="false" /></label>
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
.admin-workbench {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  overflow: hidden;
  background: var(--bg-app);
  color: var(--text-primary);
}

.workbench-header,
.toolbar-panel,
.batch-bar,
.queue-panel,
.inspector-panel {
  border: 1px solid var(--border-base);
  background: var(--bg-card);
  border-radius: 8px;
  box-shadow: var(--shadow-enterprise);
}

.workbench-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
}

h1,
h2,
h3,
p {
  margin: 0;
}

.eyebrow {
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 800;
}

h1 {
  font-size: 20px;
  font-weight: 900;
}

button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.primary-btn,
.ghost-btn,
.batch-bar button,
.select-all-btn,
.card-actions button,
.row-actions button,
.inspector-actions button,
.inspector-actions a,
.reason-templates button,
.icon-btn {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
}

.primary-btn,
.approve-btn {
  background: var(--accent);
  color: white;
}

.ghost-btn,
.ghost-mini,
.select-all-btn,
.icon-btn,
.inspector-actions button,
.inspector-actions a {
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.reject-btn,
.danger-action {
  background: rgba(220, 38, 38, 0.1);
  color: var(--danger);
}

button svg,
a svg,
.toolbar-meta svg {
  width: 16px;
  height: 16px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  min-height: 62px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.metric-card svg {
  width: 24px;
  height: 24px;
  color: var(--accent);
}

.metric-card span {
  display: block;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 800;
}

.metric-card strong {
  display: block;
  margin-top: 2px;
  font-size: 22px;
}

.toolbar-panel {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  flex-wrap: wrap;
}

.tab-strip,
.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.tab-strip button,
.segmented button {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.tab-strip button.active,
.segmented button.active {
  background: var(--bg-card);
  color: var(--accent);
  box-shadow: var(--shadow-enterprise);
}

.tab-strip span {
  min-width: 18px;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--danger);
  color: white;
  font-size: 10px;
}

.search-box {
  margin-left: auto;
  min-width: 280px;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.toolbar-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.toolbar-meta span,
.toolbar-meta label {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.toolbar-meta select {
  min-width: 76px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-weight: 900;
}

.search-box input,
.form-stack input,
.form-stack textarea,
.form-stack select {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
}

.batch-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 900;
}

.batch-bar > div {
  display: flex;
  gap: 8px;
}

.batch-bar button {
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.review-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 12px;
}

.queue-panel,
.inspector-panel {
  min-height: 0;
  overflow: hidden;
}

.queue-panel {
  display: flex;
  flex-direction: column;
}

.queue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border-bottom: 1px solid var(--border-base);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 900;
}

.select-all-btn {
  background: transparent;
  color: var(--text-secondary);
}

.review-grid {
  min-height: 0;
  overflow: auto;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.review-list {
  min-height: 0;
  overflow: auto;
  padding: 8px;
  display: grid;
  gap: 8px;
}

.review-row {
  min-height: 92px;
  display: grid;
  grid-template-columns: 34px 74px minmax(0, 1fr) minmax(210px, auto);
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  cursor: pointer;
}

.review-row.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent);
}

.review-row.selected {
  border-color: var(--accent);
}

.row-check {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.row-thumb {
  width: 74px;
  height: 74px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bg-app);
}

.row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row-thumb > svg {
  width: 28px;
  height: 28px;
  color: var(--text-muted);
}

.row-main {
  min-width: 0;
  display: grid;
  gap: 6px;
}

.row-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-title strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 950;
}

.row-main p {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 850;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  flex-wrap: wrap;
}

.row-actions button {
  min-height: 32px;
  padding: 0 9px;
}

.review-card {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  cursor: pointer;
}

.review-card.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
}

.review-card.selected {
  border-color: var(--accent);
}

.card-check {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.7);
  color: white;
}

.media-box,
.inspector-media {
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--bg-app);
}

.media-box {
  height: 150px;
}

.media-box img,
.inspector-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-box > svg,
.inspector-media > svg {
  width: 42px;
  height: 42px;
  color: var(--text-muted);
}

.card-body {
  display: grid;
  gap: 10px;
  padding: 12px;
}

.card-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.card-title strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-body p {
  min-height: 38px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 800;
}

.card-user {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.card-actions button {
  min-height: 32px;
  flex: 1;
  padding: 0 8px;
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

.inspector-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  overflow: auto;
}

.inspector-media {
  height: 160px;
  border-radius: 8px;
}

.inspector-title h2 {
  margin-top: 10px;
  font-size: 20px;
  font-weight: 900;
}

.inspector-title p,
.body-text {
  margin-top: 8px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.inspector-section {
  padding: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
}

.inspector-section h3 {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 900;
}

.detail-grid {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 9px;
  font-size: 13px;
}

.detail-grid span {
  color: var(--text-muted);
}

.tag-line {
  color: var(--text-secondary);
  word-break: break-word;
}

.inspector-actions {
  display: grid;
  gap: 8px;
}

.loading-state,
.empty-state {
  min-height: 190px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
}

.queue-pagination {
  min-height: 45px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  border-top: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.queue-pagination > div {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  width: 32px;
  padding: 0;
  color: var(--text-secondary);
}

.loading-state svg,
.empty-state svg {
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
}

.reason-templates {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.reason-templates button {
  border: 1px solid var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
}

.reason-templates button.active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.dialog-btn {
  margin-left: 8px;
}

@media (max-width: 1180px) {
  .review-shell {
    grid-template-columns: 1fr;
  }

  .inspector-panel {
    display: none;
  }
}

@media (max-width: 980px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-box {
    width: 100%;
    min-width: 0;
    margin-left: 0;
  }
}

@media (max-width: 640px) {
  .admin-workbench {
    padding: 10px;
  }

  .workbench-header,
  .batch-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
