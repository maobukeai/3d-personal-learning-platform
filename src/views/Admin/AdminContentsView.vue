<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed, onMounted, onBeforeUnmount, ref, watch, type Component } from 'vue';
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
  LayoutGrid,
  List,
  X,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { fetchManagementInsights } from './adminManagementInsights';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import UiButton from '@/components/ui/Button.vue';
import UiInput from '@/components/ui/Input.vue';
import Card from '@/components/ui/Card.vue';
import AdminContentStatusBadge from './components/AdminContentStatusBadge.vue';
import AdminHeader from './components/AdminHeader.vue';

export type ContentTab = 'assets' | 'materials' | 'showcases' | 'plugins';
export type ContentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type StatusFilter = ContentStatus | 'ALL';

export interface ContentUser {
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
  isProcedural?: boolean;
}

export interface PageConfig {
  label: string;
  title: string;
  apiPath: string;
  icon: Component;
  emptyLabel: string;
}

interface PaginatedContentResponse {
  items: ContentItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  stats?: ContentStats;
}

interface ContentStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

interface UserListItem {
  id: string;
  name?: string | null;
  email?: string | null;
}

const route = useRoute();
const router = useRouter();
const workspaceStore = useWorkspaceStore();

const getValidTab = (value: unknown): ContentTab => {
  if (value === 'assets' || value === 'materials' || value === 'showcases' || value === 'plugins') {
    return value;
  }
  return 'assets';
};

const activeTab = ref<ContentTab>(getValidTab(route.query.tab || route.meta.contentType));
const statusFilter = ref<StatusFilter>('ALL');
const searchQuery = ref('');
const items = ref<ContentItem[]>([]);
const assetCategories = ref<{ id: string; name: string }[]>([]);
const isLoading = ref(false);
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);
const totalPages = ref(1);
const queueStats = ref<ContentStats | null>(null);

const activeItem = ref<ContentItem | null>(null);

const isDetailSplitOpen = ref(false);
const detailDrawerVisible = ref(false);
const isDesktop = ref(window.innerWidth >= 1024);

const handleResize = () => {
  isDesktop.value = window.innerWidth >= 1024;
  if (!isDesktop.value) {
    isDetailSplitOpen.value = false;
  }
};

const openDetail = (item: ContentItem) => {
  activeItem.value = item;
  if (isDesktop.value) {
    isDetailSplitOpen.value = true;
    detailDrawerVisible.value = false;
  } else {
    detailDrawerVisible.value = true;
    isDetailSplitOpen.value = false;
  }
};

const closeDetail = () => {
  isDetailSplitOpen.value = false;
  detailDrawerVisible.value = false;
};

// Edit / Create Dialog States
const isCreateOpen = ref(false);
const isEditOpen = ref(false);
const isSaving = ref(false);
const createMode = ref<'single' | 'batch'>('single');

const viewMode = ref<'list' | 'grid'>('list');

const failedImages = ref<Record<string, boolean>>({});
const handleImageError = (id: string) => {
  failedImages.value[id] = true;
};

// Assigned users list
const usersList = ref<UserListItem[]>([]);
const fetchUsersList = async () => {
  try {
    const response = await api.get<any>('/api/admin/users', {
      params: { limit: 100 },
    });
    if (Array.isArray(response.data)) {
      usersList.value = response.data.map((u: any) => ({ id: u.id, name: u.name, email: u.email }));
    } else if (response.data?.items && Array.isArray(response.data.items)) {
      usersList.value = response.data.items.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      }));
    }
  } catch (error) {
    logError(error, { operation: 'admin.fetchUsersList', component: 'AdminContentsView' });
  }
};

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
  // Specialized parameters
  resolution: '2K',
  isProcedural: false,
  // Advanced parameters
  userId: '',
  originality: 'ORIGINAL',
  originalAuthor: '',
  originalLink: '',
  license: 'CC_BY',
  meshType: 'LOW_POLY',
  uvUnwrapped: true,
  uvOverlapping: false,
  rigged: false,
  gameReady: false,
  installGuide: '',
  bilibiliUrl: '',
});

const fileInputRef = ref<HTMLInputElement | null>(null);
const thumbnailInputRef = ref<HTMLInputElement | null>(null);

// Batch Publish States
const batchQueue = ref<any[]>([]);
const batchGlobalSettings = ref({
  categoryId: '',
  category: '硬表面',
  userId: '',
  status: 'APPROVED' as ContentStatus,
  tags: '',
});
const batchUploadRef = ref<HTMLInputElement | null>(null);
const batchProgress = ref({
  active: false,
  total: 0,
  current: 0,
  statusText: '',
});
const batchErrors = ref<string[]>([]);

// Filename parsing helper functions
const pathExt = (name: string) => {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > -1 ? name.substring(dotIndex) : '';
};

const pathBase = (name: string, ext: string) => {
  return ext ? name.substring(0, name.length - ext.length) : name;
};

const pageConfigs: Record<ContentTab, PageConfig> = {
  assets: {
    label: '3D 资产',
    title: '3D 资产管理',
    apiPath: '/api/admin/assets',
    icon: Box,
    emptyLabel: '暂无 3D 资产记录',
  },
  materials: {
    label: '材质贴图',
    title: '材质贴图管理',
    apiPath: '/api/admin/materials',
    icon: Layers,
    emptyLabel: '暂无材质贴图记录',
  },
  showcases: {
    label: '作品展示',
    title: '作品展示管理',
    apiPath: '/api/admin/showcases',
    icon: Sparkles,
    emptyLabel: '暂无作品展示记录',
  },
  plugins: {
    label: '插件扩展',
    title: '插件与软件资源管理',
    apiPath: '/api/admin/plugins',
    icon: Puzzle,
    emptyLabel: '暂无插件与软件资源记录',
  },
};

const pageConfig = computed(() => pageConfigs[activeTab.value]);

const tabsListOptions = computed(() => [
  { label: pageConfigs.assets.label, value: 'assets' as const, icon: pageConfigs.assets.icon },
  {
    label: pageConfigs.materials.label,
    value: 'materials' as const,
    icon: pageConfigs.materials.icon,
  },
  {
    label: pageConfigs.showcases.label,
    value: 'showcases' as const,
    icon: pageConfigs.showcases.icon,
  },
  { label: pageConfigs.plugins.label, value: 'plugins' as const, icon: pageConfigs.plugins.icon },
]);

const statusFilterOptions = computed(() => [
  { label: '全部', value: 'ALL' as const },
  { label: '待审核', value: 'PENDING' as const },
  { label: '已通过', value: 'APPROVED' as const },
  { label: '已打回', value: 'REJECTED' as const },
]);

const fetchItems = async (silent = false) => {
  if (!silent) isLoading.value = true;
  failedImages.value = {};
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
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, `无法加载${pageConfig.value.label}数据`));
  } finally {
    if (!silent) isLoading.value = false;
  }
};

const fetchAssetCategories = async () => {
  try {
    const response = await api.get<{ id: string; name: string }[]>('/api/admin/asset-categories');
    assetCategories.value = response.data;
  } catch (error) {
    logError(error, { operation: 'admin.fetchCategories', component: 'AdminContentsView' });
  }
};

const handleTabChange = (tabId: ContentTab) => {
  activeTab.value = tabId;
  currentPage.value = 1;
  router.push({ query: { ...route.query, tab: tabId } });
  clearSelection();
  closeDetail();
  fetchItems();
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchItems();
};

const handleStatusFilterChange = (status: StatusFilter) => {
  statusFilter.value = status;
  currentPage.value = 1;
  clearSelection();
  closeDetail();
  fetchItems();
};

// Pagination
const setPage = (page: number) => {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  clearSelection();
  closeDetail();
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
      icon: Layers,
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      health: { label: '正常', variant: 'success' as const },
    },
    {
      label: '待审核资源',
      value: pendingCount,
      hint: '新提交待审批内容',
      icon: AlertTriangle,
      color:
        pendingCount > 0
          ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
          : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: {
        label: pendingCount > 0 ? '待处理' : '无积压',
        variant: pendingCount > 0 ? ('warning' as const) : ('success' as const),
      },
    },
    {
      label: '已发布资源',
      value: stats.value.approved,
      hint: '已上线公开访问资源',
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: '稳定', variant: 'success' as const },
    },
    {
      label: '资源上架率',
      value: `${approvalRate.value}%`,
      hint: '已上线资源占比',
      icon: ListChecks,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health: {
        label: approvalRate.value >= 70 ? '高效' : '关注',
        variant: approvalRate.value >= 70 ? ('success' as const) : ('warning' as const),
      },
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

const metricLine = (row: ContentItem) => {
  if (row.fileSize || row.size) {
    return formatSize(row.fileSize || row.size);
  }
  const parts = [];
  if (row.version) parts.push(row.version);
  if (row.compatibility && row.compatibility.trim() && row.compatibility !== '未填兼容性') {
    parts.push(row.compatibility);
  }
  return parts.length ? parts.join(' · ') : 'v1.0.0';
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
    if (activeItem.value?.id === item.id) {
      activeItem.value.status = 'APPROVED';
    }
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
        if (activeItem.value?.id === item.id) {
          activeItem.value.status = 'REJECTED';
          activeItem.value.rejectReason = value;
        }
        fetchItems(true);
      } catch (error) {
        ElMessage.error(getApiErrorMessage(error, '退回审批失败'));
      }
    })
    .catch(() => {});
};

const openCreate = () => {
  createMode.value = 'single';
  batchQueue.value = [];
  batchGlobalSettings.value = {
    categoryId: assetCategories.value[0]?.id || '',
    category: activeTab.value === 'materials' ? '硬表面' : '工具',
    userId: '',
    status: 'APPROVED',
    tags: '',
  };
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
    // Advanced fields
    userId: '',
    originality: 'ORIGINAL',
    originalAuthor: '',
    originalLink: '',
    license: 'CC_BY',
    meshType: 'LOW_POLY',
    uvUnwrapped: true,
    uvOverlapping: false,
    rigged: false,
    gameReady: false,
    installGuide: '',
    bilibiliUrl: '',
  };
  if (fileInputRef.value) fileInputRef.value.value = '';
  if (thumbnailInputRef.value) thumbnailInputRef.value.value = '';
  fetchUsersList();
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
    if (createForm.value.userId) {
      formData.append('userId', createForm.value.userId);
    }

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
      } else if (createForm.value.externalThumbnailUrl) {
        formData.append('externalThumbnailUrl', createForm.value.externalThumbnailUrl);
      }

      // Advanced asset fields
      formData.append('originality', createForm.value.originality);
      formData.append('originalAuthor', createForm.value.originalAuthor);
      formData.append('originalLink', createForm.value.originalLink);
      formData.append('license', createForm.value.license);
      formData.append('meshType', createForm.value.meshType);
      formData.append('uvUnwrapped', String(createForm.value.uvUnwrapped));
      formData.append('uvOverlapping', String(createForm.value.uvOverlapping));
      formData.append('rigged', String(createForm.value.rigged));
      formData.append('gameReady', String(createForm.value.gameReady));
      if (createForm.value.bilibiliUrl) {
        formData.append('bilibiliUrl', createForm.value.bilibiliUrl);
      }
    } else if (activeTab.value === 'materials') {
      formData.append('category', createForm.value.category);
      formData.append('resolution', createForm.value.resolution);
      formData.append('isProcedural', String(createForm.value.isProcedural));
      if (createForm.value.file) {
        formData.append('material', createForm.value.file);
      } else {
        formData.append('externalUrl', createForm.value.externalUrl);
      }
      if (createForm.value.thumbnail) {
        formData.append('thumbnail', createForm.value.thumbnail);
      } else if (createForm.value.externalThumbnailUrl) {
        formData.append('externalThumbnailUrl', createForm.value.externalThumbnailUrl);
      }
    } else if (activeTab.value === 'showcases') {
      formData.append('type', createForm.value.type);
      if (createForm.value.file) {
        formData.append('showcase', createForm.value.file);
      } else {
        formData.append('externalUrl', createForm.value.externalUrl);
      }
      if (createForm.value.thumbnail) {
        formData.append('thumbnail', createForm.value.thumbnail);
      } else if (createForm.value.externalThumbnailUrl) {
        formData.append('externalThumbnailUrl', createForm.value.externalThumbnailUrl);
      }
    } else if (activeTab.value === 'plugins') {
      formData.append('category', createForm.value.category);
      formData.append('version', createForm.value.version);
      formData.append('compatibility', createForm.value.compatibility);
      if (createForm.value.file) {
        formData.append('plugin_file', createForm.value.file);
      } else {
        formData.append('externalUrl', createForm.value.externalUrl);
      }
      if (createForm.value.thumbnail) {
        formData.append('plugin_preview', createForm.value.thumbnail);
      } else if (createForm.value.externalThumbnailUrl) {
        formData.append('externalThumbnailUrl', createForm.value.externalThumbnailUrl);
      }
      formData.append('installGuide', createForm.value.installGuide);
    }

    await api.post(pageConfig.value.apiPath, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success(`成功发布${pageConfig.value.label}`);
    isCreateOpen.value = false;
    fetchItems();
    workspaceStore.fetchAdminStats();
    fetchManagementInsights(true);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发布失败'));
  } finally {
    isSaving.value = false;
  }
};

// Batch Files Pairing
const handleBatchFiles = (fileList: FileList) => {
  const files = Array.from(fileList);
  const grouped: Record<string, { main?: File; thumb?: File }> = {};

  files.forEach((f) => {
    const ext = pathExt(f.name).toLowerCase();
    const base = pathBase(f.name, ext);
    if (!grouped[base]) grouped[base] = {};

    if (['.glb', '.zip', '.rar', '.7z', '.blend', '.py'].includes(ext)) {
      grouped[base].main = f;
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      grouped[base].thumb = f;
    }
  });

  const newItems: any[] = [];
  Object.entries(grouped).forEach(([base, g]) => {
    if (g.main || g.thumb) {
      newItems.push({
        id: Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        title: base,
        description: '',
        file: g.main || null,
        thumbnail: g.thumb || null,
        externalUrl: '',
        externalThumbnailUrl: '',
        categoryId: batchGlobalSettings.value.categoryId || assetCategories.value[0]?.id || '',
        category: batchGlobalSettings.value.category || '硬表面',
        tags: batchGlobalSettings.value.tags || '',
        userId: batchGlobalSettings.value.userId || '',
        status: batchGlobalSettings.value.status || 'APPROVED',
        resolution: '2K',
        version: '1.0.0',
        compatibility: '',
        isProcedural: false,
      });
    }
  });
  batchQueue.value = [...batchQueue.value, ...newItems];
};

const applyBatchGlobalSettings = () => {
  batchQueue.value.forEach((item) => {
    if (batchGlobalSettings.value.categoryId)
      item.categoryId = batchGlobalSettings.value.categoryId;
    if (batchGlobalSettings.value.category) item.category = batchGlobalSettings.value.category;
    if (batchGlobalSettings.value.userId) item.userId = batchGlobalSettings.value.userId;
    if (batchGlobalSettings.value.status) item.status = batchGlobalSettings.value.status;
    if (batchGlobalSettings.value.tags) {
      item.tags = item.tags
        ? Array.from(
            new Set(
              [...item.tags.split(','), ...batchGlobalSettings.value.tags.split(',')]
                .map((t) => t.trim())
                .filter(Boolean),
            ),
          ).join(', ')
        : batchGlobalSettings.value.tags;
    }
  });
  ElMessage.success('全局设置已应用到队列');
};

const removeBatchQueueItem = (id: string) => {
  batchQueue.value = batchQueue.value.filter((item) => item.id !== id);
};

const submitBatchPublish = async () => {
  if (batchQueue.value.length === 0) {
    ElMessage.warning('队列为空，请先添加文件');
    return;
  }
  batchProgress.value.active = true;
  batchProgress.value.total = batchQueue.value.length;
  batchProgress.value.current = 0;
  batchErrors.value = [];

  for (let i = 0; i < batchQueue.value.length; i++) {
    const item = batchQueue.value[i];
    batchProgress.value.current = i + 1;
    batchProgress.value.statusText = `正在上传第 ${i + 1}/${batchQueue.value.length} 个资源: ${item.title}`;

    try {
      const formData = new FormData();
      formData.append('title', item.title.trim());
      formData.append('description', item.description);
      formData.append('status', item.status);
      formData.append('tags', item.tags);
      if (item.userId) formData.append('userId', item.userId);

      if (activeTab.value === 'assets') {
        formData.append('categoryId', item.categoryId);
        if (item.file) {
          formData.append('asset', item.file);
        } else {
          formData.append('externalUrl', item.externalUrl);
        }
        if (item.thumbnail) {
          formData.append('thumbnail', item.thumbnail);
        } else if (item.externalThumbnailUrl) {
          formData.append('externalThumbnailUrl', item.externalThumbnailUrl);
        }
      } else if (activeTab.value === 'materials') {
        formData.append('category', item.category);
        formData.append('resolution', item.resolution);
        formData.append('isProcedural', String(item.isProcedural));
        if (item.file) {
          formData.append('material', item.file);
        } else {
          formData.append('externalUrl', item.externalUrl);
        }
        if (item.thumbnail) {
          formData.append('thumbnail', item.thumbnail);
        } else if (item.externalThumbnailUrl) {
          formData.append('externalThumbnailUrl', item.externalThumbnailUrl);
        }
      } else if (activeTab.value === 'showcases') {
        formData.append('type', item.type || 'IMAGE');
        if (item.file) {
          formData.append('showcase', item.file);
        } else {
          formData.append('externalUrl', item.externalUrl);
        }
        if (item.thumbnail) {
          formData.append('thumbnail', item.thumbnail);
        } else if (item.externalThumbnailUrl) {
          formData.append('externalThumbnailUrl', item.externalThumbnailUrl);
        }
      } else if (activeTab.value === 'plugins') {
        formData.append('category', item.category);
        formData.append('version', item.version);
        formData.append('compatibility', item.compatibility);
        if (item.file) {
          formData.append('plugin_file', item.file);
        } else {
          formData.append('externalUrl', item.externalUrl);
        }
        if (item.thumbnail) {
          formData.append('plugin_preview', item.thumbnail);
        } else if (item.externalThumbnailUrl) {
          formData.append('externalThumbnailUrl', item.externalThumbnailUrl);
        }
      }

      await api.post(pageConfig.value.apiPath, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err: any) {
      const errMsg = getApiErrorMessage(err, `发布失败: ${item.title}`);
      batchErrors.value.push(errMsg);
    }
  }

  batchProgress.value.active = false;
  if (batchErrors.value.length === 0) {
    ElMessage.success('队列所有资源已成功发布');
    isCreateOpen.value = false;
    batchQueue.value = [];
    fetchItems();
    workspaceStore.fetchAdminStats();
    fetchManagementInsights(true);
  } else if (batchErrors.value.length < batchQueue.value.length) {
    ElMessage.warning(`队列部分发布成功，其中有 ${batchErrors.value.length} 个失败。`);
    fetchItems();
  } else {
    ElMessage.error('队列中所有项目均发布失败，请检查文件大小或配置参数。');
  }
};

const openEdit = (item: ContentItem) => {
  editForm.value = { ...item };
  isEditOpen.value = true;
};

const submitEdit = async () => {
  if (!editForm.value.title?.trim()) {
    ElMessage.warning('请输入标题');
    return;
  }
  isSaving.value = true;
  try {
    const payload: Record<string, any> = {
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
      payload.isProcedural = editForm.value.isProcedural;
    } else if (activeTab.value === 'showcases') {
      payload.type = editForm.value.type;
    } else if (activeTab.value === 'plugins') {
      payload.category = editForm.value.category;
      payload.version = editForm.value.version;
      payload.compatibility = editForm.value.compatibility;
    }

    await api.put(`${pageConfig.value.apiPath}/${editForm.value.id}`, payload);
    ElMessage.success('保存成功');
    isEditOpen.value = false;
    if (activeItem.value && activeItem.value.id === editForm.value.id) {
      Object.assign(activeItem.value, payload);
    }
    fetchItems(true);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存失败'));
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = async (item: ContentItem) => {
  try {
    await ElMessageBox.confirm(`确认永久删除资源「${item.title}」？此操作不可逆！`, '警告', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    });
    isLoading.value = true;
    await api.delete(`${pageConfig.value.apiPath}/${item.id}`);
    ElMessage.success('删除成功');
    if (activeItem.value?.id === item.id) {
      closeDetail();
    }
    fetchItems();
    workspaceStore.fetchAdminStats();
    fetchManagementInsights(true);
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error, '删除失败'));
  } finally {
    isLoading.value = false;
  }
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

// Batch Operations
const tableRef = ref<any>(null);
const selectedItems = ref<ContentItem[]>([]);

const handleSelectionChange = (val: ContentItem[]) => {
  selectedItems.value = val;
};

const isAllSelected = computed(
  () =>
    items.value.length > 0 &&
    items.value.every((item) => selectedItems.value.some((selected) => selected.id === item.id)),
);

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedItems.value = selectedItems.value.filter(
      (selected) => !items.value.some((item) => item.id === selected.id),
    );
  } else {
    const toAdd = items.value.filter(
      (item) => !selectedItems.value.some((selected) => selected.id === item.id),
    );
    selectedItems.value = [...selectedItems.value, ...toAdd];
  }
};

const toggleSelection = (item: ContentItem) => {
  const index = selectedItems.value.findIndex((selected) => selected.id === item.id);
  if (index > -1) {
    selectedItems.value = selectedItems.value.filter((selected) => selected.id !== item.id);
  } else {
    selectedItems.value = [...selectedItems.value, item];
  }
};

const selectPendingOnly = () => {
  const pendingItems = items.value.filter(
    (item) =>
      item.status === 'PENDING' && !selectedItems.value.some((selected) => selected.id === item.id),
  );
  selectedItems.value = [...selectedItems.value, ...pendingItems];
};

const clearSelection = () => {
  selectedItems.value = [];
};

const handleBatchApprove = async () => {
  if (selectedItems.value.length === 0) return;
  try {
    const ids = selectedItems.value.map((item) => item.id);
    await ElMessageBox.confirm(`确认批量通过已选择的 ${ids.length} 个资源？`, '批量审核通过', {
      confirmButtonText: '确认通过',
      cancelButtonText: '取消',
      type: 'success',
    });

    isLoading.value = true;
    await api.put(`${pageConfig.value.apiPath}/batch-status`, {
      ids,
      status: 'APPROVED',
    });
    ElMessage.success('批量审核已通过');
    if (activeItem.value && ids.includes(activeItem.value.id)) {
      activeItem.value.status = 'APPROVED';
    }
    clearSelection();
    await fetchItems();
    workspaceStore.fetchAdminStats();
    fetchManagementInsights(true);
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error, '批量审批失败'));
  } finally {
    isLoading.value = false;
  }
};

const handleBatchReject = async () => {
  if (selectedItems.value.length === 0) return;
  try {
    const ids = selectedItems.value.map((item) => item.id);
    const { value } = await ElMessageBox.prompt(
      `请输入 ${ids.length} 个资源的批量退回理由：`,
      '批量退回审核',
      {
        confirmButtonText: '确定退回',
        cancelButtonText: '取消',
        inputPattern: /\S+/,
        inputErrorMessage: '理由不能为空',
      },
    );

    isLoading.value = true;
    await api.put(`${pageConfig.value.apiPath}/batch-status`, {
      ids,
      status: 'REJECTED',
      rejectReason: value,
    });
    ElMessage.success('批量资源已被打回');
    if (activeItem.value && ids.includes(activeItem.value.id)) {
      activeItem.value.status = 'REJECTED';
      activeItem.value.rejectReason = value;
    }
    clearSelection();
    await fetchItems();
    workspaceStore.fetchAdminStats();
    fetchManagementInsights(true);
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error, '批量退回失败'));
  } finally {
    isLoading.value = false;
  }
};

const handleBatchDelete = async () => {
  if (selectedItems.value.length === 0) return;
  try {
    const ids = selectedItems.value.map((item) => item.id);
    await ElMessageBox.confirm(
      `警告：确认要永久批量删除这 ${ids.length} 个资源吗？此操作将立即从文件系统中清除对应资产，不可恢复！`,
      '危险操作确认',
      {
        confirmButtonText: '确定永久删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );

    isLoading.value = true;
    await api.post(`${pageConfig.value.apiPath}/batch-delete`, { ids });
    ElMessage.success('批量删除成功');
    if (activeItem.value && ids.includes(activeItem.value.id)) {
      closeDetail();
    }
    clearSelection();
    await fetchItems();
    workspaceStore.fetchAdminStats();
    fetchManagementInsights(true);
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error, '批量删除失败'));
  } finally {
    isLoading.value = false;
  }
};

// Listen to URL query params or trigger default load
onMounted(() => {
  fetchItems();
  fetchAssetCategories();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

watch(
  () => route.query.tab,
  (newTab) => {
    const valid = getValidTab(newTab);
    if (valid !== activeTab.value) {
      activeTab.value = valid;
      currentPage.value = 1;
      closeDetail();
      fetchItems();
    }
  },
);

watch(searchQuery, () => {
  currentPage.value = 1;
  fetchItems();
});
</script>

<template>
  <div
    class="admin-contents-page mobile-adaptive flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)]"
  >
    <main class="min-h-0 flex-1 flex flex-col overflow-hidden p-2 sm:p-2.5 gap-2">
      <!-- Ultra-Compact Single Row Header -->
      <AdminHeader
        :title="pageConfig.title"
        subtitle="平台管理 · 资源清单"
        :cards="consolidatedCards"
        v-model="searchQuery"
        placeholder="搜索关键字或创作者..."
      >
        <UiButton
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchItems(false)"
          class="!h-7.5 !text-xs !px-2.5"
        >
          刷新
        </UiButton>
        <UiButton
          variant="primary"
          size="sm"
          :icon="Plus"
          @click="openCreate"
          class="!h-7.5 !text-xs !px-2.5"
        >
          发布{{ pageConfig.label }}
        </UiButton>
      </AdminHeader>

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

          <div class="flex items-center gap-3 shrink-0 mobile-row">
            <!-- View Mode Switcher -->
            <div
              class="flex items-center border border-slate-100 dark:border-white/5 bg-slate-100/50 dark:bg-white/5 rounded-lg p-0.5 shrink-0"
            >
              <button
                type="button"
                :class="[
                  'p-1 rounded-md transition-colors border-0 cursor-pointer flex items-center justify-center',
                  viewMode === 'list'
                    ? 'bg-white dark:bg-white/10 text-accent dark:text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent',
                ]"
                @click="viewMode = 'list'"
                title="列表视图"
              >
                <List class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                :class="[
                  'p-1 rounded-md transition-colors border-0 cursor-pointer flex items-center justify-center',
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-white/10 text-accent dark:text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent',
                ]"
                @click="viewMode = 'grid'"
                title="网格视图"
              >
                <LayoutGrid class="w-3.5 h-3.5" />
              </button>
            </div>

            <!-- Page size selector -->
            <div class="flex items-center gap-2 self-end md:self-auto">
              <span class="text-xs text-[var(--text-muted)] font-medium whitespace-nowrap"
                >每页条数:</span
              >
              <Select
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
                <SelectOption :value="10" label="10条" />
                <SelectOption :value="12" label="12条" />
                <SelectOption :value="20" label="20条" />
                <SelectOption :value="50" label="50条" />
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <!-- Batch operations bar -->
      <div
        v-if="selectedItems.length"
        class="batch-bar flex items-center justify-between gap-3 p-2 px-3 border border-slate-100 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-sm rounded-lg mobile-row z-20 shrink-0"
      >
        <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
          <span>已选择 {{ selectedItems.length }} 条记录</span>
          <span class="opacity-30">|</span>
          <button
            type="button"
            class="text-accent hover:underline bg-transparent border-0 cursor-pointer text-xs"
            @click="toggleSelectAll"
          >
            {{ isAllSelected ? '取消全选' : '全选本页' }}
          </button>
          <span class="opacity-30">/</span>
          <button
            type="button"
            class="text-accent hover:underline bg-transparent border-0 cursor-pointer text-xs"
            @click="selectPendingOnly"
          >
            仅选待审核
          </button>
          <span class="opacity-30">/</span>
          <button
            type="button"
            class="text-accent hover:underline bg-transparent border-0 cursor-pointer text-xs"
            @click="clearSelection"
          >
            清除选择
          </button>
        </div>
        <div class="flex items-center gap-2 mobile-row">
          <UiButton variant="primary" size="sm" :icon="CheckCircle2" @click="handleBatchApprove">
            批量通过
          </UiButton>
          <UiButton
            variant="secondary"
            size="sm"
            class="danger-action"
            :icon="AlertTriangle"
            @click="handleBatchReject"
          >
            批量退回
          </UiButton>
          <UiButton variant="danger" size="sm" :icon="Trash2" @click="handleBatchDelete">
            批量删除
          </UiButton>
        </div>
      </div>

      <!-- Split Screen Workspace Container -->
      <div class="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative gap-3">
        <!-- Left Pane: List / Grid -->
        <div class="flex-1 flex flex-col overflow-hidden min-w-0">
          <!-- Table Shell Card -->
          <Card padding="none" class="table-shell-card overflow-hidden flex-1 flex flex-col">
            <!-- View Mode Wrapper -->
            <template v-if="viewMode === 'list'">
              <Table
                ref="tableRef"
                v-loading="isLoading"
                :data="items"
                class="user-table mobile-table table-compact flex-1 overflow-y-auto"
                row-key="id"
                @row-click="openDetail"
                @selection-change="handleSelectionChange"
              >
                <!-- Selection Column -->
                <TableColumn width="48">
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
                      :checked="selectedItems.some((selected) => selected.id === row.id)"
                      @change="toggleSelection(row)"
                      @click.stop
                    />
                  </template>
                </TableColumn>

                <!-- Thumbnail Preview -->
                <TableColumn label="预览" width="70" align="center">
                  <template #default="{ row }">
                    <div
                      class="row-thumb w-8 h-8 rounded-lg border border-base overflow-hidden flex items-center justify-center bg-[var(--bg-app)] shrink-0"
                    >
                      <img
                        v-if="mediaUrl(row) && !failedImages[row.id]"
                        :src="mediaUrl(row)"
                        class="w-full h-full object-cover"
                        @error="handleImageError(row.id)"
                      />
                      <component
                        :is="pageConfig.icon"
                        v-else
                        class="w-4 h-4 text-[var(--text-muted)]"
                      />
                    </div>
                  </template>
                </TableColumn>

                <!-- Resource Title and Description -->
                <TableColumn label="资源名称" min-width="220">
                  <template #default="{ row }">
                    <div class="flex flex-col text-left">
                      <button
                        class="text-xs font-bold text-[var(--text-primary)] hover:text-accent transition-colors truncate text-left focus:outline-none"
                        type="button"
                        @click.stop="openDetail(row)"
                      >
                        {{ row.title }}
                      </button>
                    </div>
                  </template>
                </TableColumn>

                <!-- Creator -->
                <TableColumn label="创作者" min-width="140">
                  <template #default="{ row }">
                    <div class="flex items-center gap-2">
                      <UserAvatar :user="row.user" size="xs" />
                      <span
                        class="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[100px]"
                      >
                        {{ row.user?.name || row.user?.email || '匿名' }}
                      </span>
                    </div>
                  </template>
                </TableColumn>

                <!-- Specifications / Meta properties -->
                <TableColumn label="规格属性" min-width="140">
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
                </TableColumn>

                <!-- Status badge -->
                <TableColumn label="状态" width="100" align="center">
                  <template #default="{ row }">
                    <AdminContentStatusBadge :status="row.status" />
                  </template>
                </TableColumn>

                <!-- Created Date -->
                <TableColumn label="提交时间" width="140" align="center">
                  <template #default="{ row }">
                    <span class="text-xs text-[var(--text-secondary)]">
                      {{ formatDate(row.createdAt).substring(0, 10) }}
                    </span>
                  </template>
                </TableColumn>

                <!-- Actions column -->
                <TableColumn label="操作" width="180" align="center">
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
                      <Dropdown trigger="click" @command="(cmd: any) => handleCommand(cmd, row)">
                        <UiButton v-slot="{}" size="sm" variant="secondary" class="!p-1.5 !min-h-0">
                          <MoreHorizontal class="w-3.5 h-3.5" />
                        </UiButton>
                        <template #dropdown>
                          <DropdownMenu>
                            <DropdownItem command="details">
                              <Eye class="w-3.5 h-3.5 mr-1" /> 查看详情
                            </DropdownItem>
                            <DropdownItem command="edit">
                              <Edit3 class="w-3.5 h-3.5 mr-1" /> 编辑资源
                            </DropdownItem>
                            <DropdownItem command="delete" class="!text-[var(--danger)]">
                              <Trash2 class="w-3.5 h-3.5 mr-1" /> 彻底删除
                            </DropdownItem>
                          </DropdownMenu>
                        </template>
                      </Dropdown>
                    </div>
                  </template>
                </TableColumn>

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
              </Table>
            </template>

            <!-- Grid View -->
            <template v-else>
              <div
                v-loading="isLoading"
                class="flex-1 overflow-y-auto p-2 sm:p-2.5 custom-scrollbar grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3"
              >
                <!-- Grid Cards -->
                <div
                  v-for="row in items"
                  :key="row.id"
                  class="relative group rounded-xl border border-slate-100 dark:border-white/5 bg-white/40 dark:bg-white/5 hover:border-slate-200 dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer overflow-hidden flex flex-col p-2 gap-1.5 text-xs animate-fade-in"
                  :class="[
                    selectedItems.some((selected) => selected.id === row.id)
                      ? 'border-accent bg-accent/5 ring-1 ring-accent/30 shadow-lg'
                      : '',
                  ]"
                  @click="openDetail(row)"
                >
                  <!-- Hover Checkbox Overlay -->
                  <div
                    class="absolute top-2 left-2 z-10 transition-opacity duration-200"
                    :class="[
                      selectedItems.some((selected) => selected.id === row.id)
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100',
                    ]"
                    @click.stop
                  >
                    <input
                      type="checkbox"
                      :checked="selectedItems.some((selected) => selected.id === row.id)"
                      @change="toggleSelection(row)"
                      class="w-3.5 h-3.5 cursor-pointer accent-accent transition-transform hover:scale-110 rounded"
                    />
                  </div>

                  <!-- Thumbnail Cover -->
                  <div
                    class="relative w-full rounded-lg overflow-hidden border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex items-center justify-center shrink-0 h-22"
                  >
                    <img
                      v-if="mediaUrl(row) && !failedImages[row.id]"
                      :src="mediaUrl(row)"
                      alt=""
                      class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      @error="handleImageError(row.id)"
                    />
                    <component :is="pageConfig.icon" v-else class="w-8 h-8 text-slate-400" />
                    <!-- Small Status Badge on Thumbnail -->
                    <div class="absolute bottom-1 right-1">
                      <AdminContentStatusBadge
                        :status="row.status"
                        class="scale-90 transform origin-bottom-right"
                      />
                    </div>
                  </div>

                  <!-- Info Details block -->
                  <div
                    class="flex-1 flex flex-col min-w-0 justify-between gap-0.5 mt-0.5 text-[10px] text-[var(--text-secondary)]"
                  >
                    <div class="min-w-0">
                      <strong
                        class="font-bold truncate text-[var(--text-primary)] block text-xs leading-tight"
                      >
                        {{ row.title }}
                      </strong>
                      <!-- Combined specifications and type info -->
                      <span class="truncate block opacity-95 mt-0.5 font-semibold">
                        {{ itemKind(row) }} · {{ metricLine(row) }}
                      </span>
                    </div>
                    <!-- Combined author name and date info in one line, no divider -->
                    <div class="flex items-center justify-between gap-2 mt-0.5 truncate opacity-85">
                      <div class="flex items-center gap-1.5 min-w-0">
                        <UserAvatar
                          :user="row.user"
                          size="xs"
                          class="scale-90 transform origin-left shrink-0"
                        />
                        <span class="truncate font-semibold text-[var(--text-primary)]">
                          {{ row.user?.name || row.user?.email?.split('@')[0] || '匿名' }}
                        </span>
                      </div>
                      <span class="font-mono text-[9px] shrink-0">
                        {{ formatDate(row.createdAt).split(' ')[0] }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Pagination Wrap -->
            <div class="pagination-wrap mobile-row shrink-0">
              <span class="text-xs text-[var(--text-secondary)]"
                >当前显示 {{ items.length }} 条，共 {{ totalItems }} 条</span
              >
              <Pagination
                background
                :current-page="currentPage"
                :page-size="pageSize"
                :total="totalItems"
                layout="prev, pager, next, jumper"
                @current-change="setPage"
              />
            </div>
          </Card>
        </div>

        <!-- Right Side Detail Workspace (Split Pane) -->
        <div
          v-if="isDetailSplitOpen && activeItem"
          class="w-full lg:w-[460px] xl:w-[520px] shrink-0 h-full border border-base rounded-2xl overflow-hidden glass-real-physical glass-panel-extreme shadow-2xl flex flex-col z-10 animate-fade-in"
        >
          <!-- Pane Header -->
          <div
            class="p-4 border-b border-strong/40 flex items-center justify-between shrink-0 bg-white/5"
          >
            <div class="flex items-center gap-2">
              <AdminContentStatusBadge :status="activeItem.status" />
              <span class="text-xs text-[var(--text-secondary)] font-semibold">资源详情</span>
            </div>
            <button
              type="button"
              class="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer"
              @click="closeDetail"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Pane Scrollable Body -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <!-- Media Banner -->
            <div
              class="relative w-full h-44 rounded-xl overflow-hidden border border-base bg-[var(--bg-subtle)] flex items-center justify-center group shadow-inner"
            >
              <img
                v-if="mediaUrl(activeItem)"
                :src="mediaUrl(activeItem)"
                alt=""
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <component :is="pageConfig.icon" v-else class="w-10 h-10 text-[var(--text-muted)]" />

              <!-- External View Button -->
              <a
                v-if="mediaUrl(activeItem)"
                :href="mediaUrl(activeItem)"
                target="_blank"
                rel="noopener noreferrer"
                class="absolute right-3 bottom-3 p-1.5 bg-black/60 backdrop-blur-sm text-white rounded-lg hover:bg-black/80 transition-colors border-0 flex items-center gap-1 text-[10px] font-bold"
              >
                <Eye class="w-3.5 h-3.5" /> 查看原图
              </a>
            </div>

            <!-- Title & User Info -->
            <div class="space-y-3">
              <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <span>{{ formatDate(activeItem.createdAt) }}</span>
              </div>
              <h2 class="text-base font-bold text-[var(--text-primary)] leading-snug break-words">
                {{ activeItem.title }}
              </h2>
              <p
                class="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-base"
              >
                {{ activeItem.description || '暂无描述信息' }}
              </p>
            </div>

            <!-- Details Grid -->
            <div class="border-t border-base pt-3 space-y-2">
              <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                资源元数据
              </h4>

              <div
                class="grid grid-cols-2 gap-3 text-xs bg-[var(--bg-app)] p-3 rounded-xl border border-base"
              >
                <div>
                  <span class="text-[var(--text-muted)] block mb-0.5">创作者</span>
                  <span class="font-bold text-[var(--text-primary)]">
                    {{ activeItem.user?.name || activeItem.user?.email || '匿名创作者' }}
                  </span>
                </div>
                <div>
                  <span class="text-[var(--text-muted)] block mb-0.5">类别</span>
                  <span class="font-bold text-[var(--text-primary)]">{{
                    itemKind(activeItem)
                  }}</span>
                </div>
                <div class="col-span-2 border-t border-strong pt-2 mt-1">
                  <span class="text-[var(--text-muted)] block mb-0.5">指标数据</span>
                  <span class="font-bold text-[var(--text-primary)]">
                    浏览 {{ activeItem.views ?? 0 }} · 点赞 {{ activeItem.likes ?? 0 }} · 下载
                    {{ activeItem.downloads ?? 0 }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Extra details e.g., Tags, Reject Reason -->
            <div v-if="activeItem.tags" class="border-t border-base pt-3">
              <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                标签
              </h4>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="tag in activeItem.tags.split(',')"
                  :key="tag"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                >
                  {{ tag.trim() }}
                </span>
              </div>
            </div>

            <div
              v-if="activeItem.rejectReason"
              class="border-t border-base pt-3 bg-red-500/5 p-3 rounded-xl border border-red-500/10"
            >
              <h4
                class="text-xs font-bold text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1"
              >
                <AlertTriangle class="w-3.5 h-3.5" /> 退回理由
              </h4>
              <p class="text-xs text-red-600 dark:text-red-400 font-medium leading-normal">
                {{ activeItem.rejectReason }}
              </p>
            </div>
          </div>

          <!-- Pane Footer Actions -->
          <div
            class="p-4 border-t border-strong/40 bg-white/5 flex items-center gap-2 justify-end shrink-0"
          >
            <UiButton variant="secondary" size="sm" :icon="Edit3" @click="openEdit(activeItem)">
              编辑资源
            </UiButton>
            <UiButton
              variant="secondary"
              size="sm"
              class="danger-action"
              :icon="Trash2"
              @click="handleDelete(activeItem)"
            >
              彻底删除
            </UiButton>
            <UiButton variant="secondary" size="sm" @click="closeDetail"> 关闭 </UiButton>
          </div>
        </div>
      </div>
    </main>

    <!-- Side Drawer on Mobile -->
    <Drawer v-model="detailDrawerVisible" size="500px" :with-header="false">
      <div v-if="activeItem" class="h-full flex flex-col bg-[var(--bg-card)]">
        <!-- Header -->
        <div
          class="p-4 border-b border-strong/40 flex items-center justify-between shrink-0 bg-white/5"
        >
          <div class="flex items-center gap-2">
            <AdminContentStatusBadge :status="activeItem.status" />
            <span class="text-xs text-[var(--text-secondary)] font-semibold">资源详情</span>
          </div>
          <button
            type="button"
            class="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer"
            @click="detailDrawerVisible = false"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <!-- Media Banner -->
          <div
            class="relative w-full h-44 rounded-xl overflow-hidden border border-base bg-[var(--bg-subtle)] flex items-center justify-center group shadow-inner"
          >
            <img
              v-if="mediaUrl(activeItem)"
              :src="mediaUrl(activeItem)"
              alt=""
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <component :is="pageConfig.icon" v-else class="w-10 h-10 text-[var(--text-muted)]" />
          </div>

          <!-- Info -->
          <div class="space-y-3">
            <div class="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span>{{ formatDate(activeItem.createdAt) }}</span>
            </div>
            <h2 class="text-base font-bold text-[var(--text-primary)] leading-snug break-words">
              {{ activeItem.title }}
            </h2>
            <p
              class="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-base"
            >
              {{ activeItem.description || '暂无描述信息' }}
            </p>
          </div>

          <!-- Metadata -->
          <div class="border-t border-base pt-3 space-y-2">
            <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              资源元数据
            </h4>
            <div
              class="grid grid-cols-2 gap-3 text-xs bg-[var(--bg-app)] p-3 rounded-xl border border-base"
            >
              <div>
                <span class="text-[var(--text-muted)] block mb-0.5">创作者</span>
                <span class="font-bold text-[var(--text-primary)]">
                  {{ activeItem.user?.name || activeItem.user?.email || '匿名' }}
                </span>
              </div>
              <div>
                <span class="text-[var(--text-muted)] block mb-0.5">类别</span>
                <span class="font-bold text-[var(--text-primary)]">{{ itemKind(activeItem) }}</span>
              </div>
              <div class="col-span-2 border-t border-strong pt-2 mt-1">
                <span class="text-[var(--text-muted)] block mb-0.5">指标数据</span>
                <span class="font-bold text-[var(--text-primary)]">
                  浏览 {{ activeItem.views ?? 0 }} · 点赞 {{ activeItem.likes ?? 0 }} · 下载
                  {{ activeItem.downloads ?? 0 }}
                </span>
              </div>
            </div>
          </div>

          <!-- Tags -->
          <div v-if="activeItem.tags" class="border-t border-base pt-3">
            <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              标签
            </h4>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="tag in activeItem.tags.split(',')"
                :key="tag"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
              >
                {{ tag.trim() }}
              </span>
            </div>
          </div>

          <div
            v-if="activeItem.rejectReason"
            class="border-t border-base pt-3 bg-red-500/5 p-3 rounded-xl border border-red-500/10"
          >
            <h4
              class="text-xs font-bold text-red-500 uppercase tracking-wider mb-1 flex items-center gap-1"
            >
              <AlertTriangle class="w-3.5 h-3.5" /> 退回理由
            </h4>
            <p class="text-xs text-red-600 dark:text-red-400 font-medium leading-normal">
              {{ activeItem.rejectReason }}
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="p-4 border-t border-strong/40 bg-white/5 flex items-center gap-2 justify-end shrink-0"
        >
          <UiButton
            variant="secondary"
            size="sm"
            :icon="Edit3"
            @click="
              openEdit(activeItem);
              detailDrawerVisible = false;
            "
          >
            编辑资源
          </UiButton>
          <UiButton
            variant="secondary"
            size="sm"
            class="danger-action"
            :icon="Trash2"
            @click="
              handleDelete(activeItem);
              detailDrawerVisible = false;
            "
          >
            彻底删除
          </UiButton>
          <UiButton variant="secondary" size="sm" @click="detailDrawerVisible = false">
            关闭
          </UiButton>
        </div>
      </div>
    </Drawer>

    <!-- Create Dialog -->
    <Modal
      :show="isCreateOpen"
      :title="`发布新${pageConfig.label}`"
      size="lg"
      @close="isCreateOpen = false"
    >
      <!-- Mode tabs: Single vs Batch -->
      <div class="flex border-b border-strong/20 mb-4 pb-0.5 gap-4">
        <button
          type="button"
          :class="[
            'pb-2 text-sm font-bold border-b-2 transition-colors cursor-pointer bg-transparent border-transparent',
            createMode === 'single'
              ? 'border-accent text-accent'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          ]"
          @click="createMode = 'single'"
        >
          单个精细发布
        </button>
        <button
          type="button"
          :class="[
            'pb-2 text-sm font-bold border-b-2 transition-colors cursor-pointer bg-transparent border-transparent',
            createMode === 'batch'
              ? 'border-accent text-accent'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
          ]"
          @click="createMode = 'batch'"
        >
          队列批量上传发布
        </button>
      </div>

      <!-- Mode 1: Single Publish -->
      <div
        v-show="createMode === 'single'"
        class="form-stack max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar"
      >
        <!-- Basic info -->
        <div class="form-grid">
          <label>
            资源标题 *
            <UiInput v-model="createForm.title" :glass="false" />
          </label>
          <label>
            指派作者 (代发)
            <Select v-model="createForm.userId" class="w-full mt-1.5" size="large" filterable>
              <SelectOption value="" label="使用当前管理员账号" />
              <SelectOption
                v-for="u in usersList"
                :key="u.id"
                :value="u.id"
                :label="u.name ? `${u.name} (${u.email})` : u.email || u.id"
              />
            </Select>
          </label>
        </div>

        <label>
          资源描述
          <textarea v-model="createForm.description" rows="3" placeholder="资源详情描述介绍..." />
        </label>

        <div class="form-grid">
          <!-- Categorization based on activeTab -->
          <label v-if="activeTab === 'assets'">
            分类 *
            <Select v-model="createForm.categoryId" class="w-full mt-1.5" size="large">
              <SelectOption
                v-for="cat in assetCategories"
                :key="cat.id"
                :value="cat.id"
                :label="cat.name"
              />
            </Select>
          </label>
          <label v-if="activeTab === 'materials' || activeTab === 'plugins'">
            分类
            <UiInput v-model="createForm.category" :glass="false" />
          </label>
          <label v-if="activeTab === 'showcases'">
            类型
            <Select v-model="createForm.type" class="w-full mt-1.5" size="large">
              <SelectOption value="IMAGE" label="图文作品" />
              <SelectOption value="VIDEO" label="视频作品" />
            </Select>
          </label>

          <label>
            直接发布状态
            <Select v-model="createForm.status" class="w-full mt-1.5" size="large">
              <SelectOption value="APPROVED" label="直接上架 (APPROVED)" />
              <SelectOption value="PENDING" label="提交审核 (PENDING)" />
            </Select>
          </label>
        </div>

        <!-- Spec grids by tab -->
        <div
          v-if="activeTab === 'assets'"
          class="border border-base p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-3"
        >
          <span class="text-xs font-bold text-[var(--text-secondary)] block">3D 模型精细参数</span>
          <div class="grid grid-cols-3 gap-3">
            <label>
              版权原创性
              <Select v-model="createForm.originality" class="w-full mt-1.5" size="large">
                <SelectOption value="ORIGINAL" label="原创作品" />
                <SelectOption value="REPRINT" label="二次分发/转载" />
              </Select>
            </label>
            <label>
              授权协议
              <Select v-model="createForm.license" class="w-full mt-1.5" size="large">
                <SelectOption value="CC0" label="CC0 (无版权限制)" />
                <SelectOption value="CC_BY" label="CC-BY (署名)" />
                <SelectOption value="CC_BY_NC" label="CC-BY-NC (署名-非商用)" />
                <SelectOption value="COMMERCIAL" label="商业授权" />
              </Select>
            </label>
            <label>
              模型精度
              <Select v-model="createForm.meshType" class="w-full mt-1.5" size="large">
                <SelectOption value="LOW_POLY" label="低模 (Low Poly)" />
                <SelectOption value="HIGH_POLY" label="高模 (High Poly)" />
                <SelectOption value="SUBDIV" label="细分曲面模" />
              </Select>
            </label>
          </div>
          <div class="grid grid-cols-2 gap-3 mt-1.5">
            <label>
              原作者姓名 (转载)
              <UiInput
                v-model="createForm.originalAuthor"
                placeholder="原作者姓名"
                :glass="false"
              />
            </label>
            <label>
              转载来源链接
              <UiInput v-model="createForm.originalLink" placeholder="https://..." :glass="false" />
            </label>
          </div>
          <div class="flex flex-wrap gap-4 mt-2">
            <label class="checkbox-label !flex-row !items-center gap-1.5 cursor-pointer">
              <input type="checkbox" v-model="createForm.uvUnwrapped" />
              <span>已展 UV (UV Unwrapped)</span>
            </label>
            <label class="checkbox-label !flex-row !items-center gap-1.5 cursor-pointer">
              <input type="checkbox" v-model="createForm.uvOverlapping" />
              <span>UV 重叠 (Overlapping)</span>
            </label>
            <label class="checkbox-label !flex-row !items-center gap-1.5 cursor-pointer">
              <input type="checkbox" v-model="createForm.rigged" />
              <span>已绑定骨骼 (Rigged)</span>
            </label>
            <label class="checkbox-label !flex-row !items-center gap-1.5 cursor-pointer">
              <input type="checkbox" v-model="createForm.gameReady" />
              <span>游戏就绪 (Game Ready)</span>
            </label>
          </div>
        </div>

        <div
          v-if="activeTab === 'materials'"
          class="border border-base p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-3"
        >
          <span class="text-xs font-bold text-[var(--text-secondary)] block">材质贴图属性</span>
          <div class="grid grid-cols-2 gap-3">
            <label>
              贴图分辨率
              <Select v-model="createForm.resolution" class="w-full mt-1.5" size="large">
                <SelectOption value="1K" label="1K" />
                <SelectOption value="2K" label="2K" />
                <SelectOption value="4K" label="4K" />
                <SelectOption value="8K" label="8K" />
              </Select>
            </label>
            <label class="checkbox-label !flex-row !items-center gap-2 mt-7 cursor-pointer">
              <input type="checkbox" v-model="createForm.isProcedural" />
              <span>程序化材质 (Substance SBSAR / PBR)</span>
            </label>
          </div>
        </div>

        <div
          v-if="activeTab === 'plugins'"
          class="border border-base p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-3"
        >
          <span class="text-xs font-bold text-[var(--text-secondary)] block">插件扩展信息</span>
          <div class="grid grid-cols-2 gap-3">
            <label>
              初始版本
              <UiInput v-model="createForm.version" placeholder="1.0.0" :glass="false" />
            </label>
            <label>
              软件兼容性
              <UiInput
                v-model="createForm.compatibility"
                placeholder="Blender 3.6 / 4.0 / 4.2"
                :glass="false"
              />
            </label>
          </div>
          <label>
            安装与使用说明
            <textarea
              v-model="createForm.installGuide"
              rows="2"
              placeholder="填写安装或使用步骤..."
            />
          </label>
        </div>

        <div class="form-grid">
          <label>
            视频演示链接 (可选)
            <UiInput
              v-model="createForm.bilibiliUrl"
              placeholder="Bilibili BV号或其它链接"
              :glass="false"
            />
          </label>
          <label>
            标签 (逗号分隔)
            <UiInput v-model="createForm.tags" placeholder="分类标签" :glass="false" />
          </label>
        </div>

        <!-- File Upload inputs -->
        <div class="form-grid border-t border-base pt-3 mt-2">
          <div class="file-upload-section">
            <span class="text-xs font-semibold text-[var(--text-secondary)] block mb-1"
              >主文件上传</span
            >
            <input
              type="file"
              ref="fileInputRef"
              @change="(e) => handleCreateFileChange(e, 'file')"
              class="hidden"
            />
            <UiButton
              variant="secondary"
              size="sm"
              :icon="Upload"
              @click="fileInputRef?.click()"
              class="w-full"
            >
              {{ createForm.file ? createForm.file.name : '选择本地文件' }}
            </UiButton>
            <span class="text-[10px] text-[var(--text-muted)] mt-1 block"
              >如果不上传文件，需填写下方外部链接</span
            >
          </div>

          <div class="file-upload-section">
            <span class="text-xs font-semibold text-[var(--text-secondary)] block mb-1"
              >封面缩略图</span
            >
            <input
              type="file"
              ref="thumbnailInputRef"
              @change="(e) => handleCreateFileChange(e, 'thumbnail')"
              class="hidden"
            />
            <UiButton
              variant="secondary"
              size="sm"
              :icon="Upload"
              @click="thumbnailInputRef?.click()"
              class="w-full"
            >
              {{ createForm.thumbnail ? createForm.thumbnail.name : '选择封面图' }}
            </UiButton>
          </div>
        </div>

        <div class="space-y-2 mt-1">
          <label>
            外部资源下载链接 (非本地上传时必填)
            <UiInput
              v-model="createForm.externalUrl"
              placeholder="网盘下载地址 / 外部下载地址"
              :glass="false"
            />
          </label>
          <label>
            外部图片封面链接 (可选)
            <UiInput
              v-model="createForm.externalThumbnailUrl"
              placeholder="https://..."
              :glass="false"
            />
          </label>
        </div>
      </div>

      <!-- Mode 2: Batch Publish -->
      <div
        v-show="createMode === 'batch'"
        class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar"
      >
        <!-- Bulk dropzone -->
        <div
          class="border-2 border-dashed border-strong/30 hover:border-accent/60 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-black/5 dark:bg-white/5"
          @click="batchUploadRef?.click()"
          @dragover.prevent
          @drop.prevent="
            (e) => {
              if (e.dataTransfer?.files) handleBatchFiles(e.dataTransfer.files);
            }
          "
        >
          <Upload class="w-8 h-8 text-[var(--text-muted)]" />
          <span class="text-xs font-bold text-[var(--text-primary)]"
            >拖入或点击多选批量上传本地资产文件及预览图</span
          >
          <span class="text-[10px] text-[var(--text-muted)]"
            >系统将自动根据文件名对齐模型 (.glb/.zip) 和图片 (.png/.jpg)</span
          >
          <input
            type="file"
            ref="batchUploadRef"
            multiple
            class="hidden"
            @change="
              (e) => {
                if ((e.target as HTMLInputElement).files)
                  handleBatchFiles((e.target as HTMLInputElement).files!);
              }
            "
          />
        </div>

        <!-- Global Batch settings override toolbar -->
        <div
          v-if="batchQueue.length > 0"
          class="border border-base p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-2.5"
        >
          <span class="text-xs font-bold text-[var(--text-secondary)] block"
            >批量设置项 (将应用到下方队列中所有记录)</span
          >
          <div class="grid grid-cols-4 gap-3 text-xs">
            <label class="flex flex-col gap-1 font-bold text-[var(--text-secondary)]">
              分类
              <Select
                v-if="activeTab === 'assets'"
                v-model="batchGlobalSettings.categoryId"
                size="small"
                class="w-full"
              >
                <SelectOption
                  v-for="cat in assetCategories"
                  :key="cat.id"
                  :value="cat.id"
                  :label="cat.name"
                />
              </Select>
              <UiInput
                v-else
                v-model="batchGlobalSettings.category"
                placeholder="分类名称"
                :glass="false"
                class="h-8"
              />
            </label>
            <label class="flex flex-col gap-1 font-bold text-[var(--text-secondary)]">
              指派作者
              <Select v-model="batchGlobalSettings.userId" size="small" class="w-full" filterable>
                <SelectOption value="" label="使用当前管理员账号" />
                <SelectOption
                  v-for="u in usersList"
                  :key="u.id"
                  :value="u.id"
                  :label="u.name ? `${u.name} (${u.email})` : u.email || u.id"
                />
              </Select>
            </label>
            <label class="flex flex-col gap-1 font-bold text-[var(--text-secondary)]">
              标签
              <UiInput
                v-model="batchGlobalSettings.tags"
                placeholder="标签"
                :glass="false"
                class="h-8"
              />
            </label>
            <div class="flex items-end gap-2">
              <label class="flex-1 flex flex-col gap-1 font-bold text-[var(--text-secondary)]">
                状态
                <Select v-model="batchGlobalSettings.status" size="small" class="w-full">
                  <SelectOption value="APPROVED" label="已发布" />
                  <SelectOption value="PENDING" label="待审核" />
                </Select>
              </label>
              <UiButton variant="secondary" size="sm" @click="applyBatchGlobalSettings" class="!h-8"
                >应用</UiButton
              >
            </div>
          </div>
        </div>

        <!-- Queue list editor grid -->
        <div v-if="batchQueue.length > 0" class="border border-base rounded-xl overflow-hidden">
          <table class="w-full text-xs text-left border-collapse">
            <thead>
              <tr
                class="bg-black/5 dark:bg-white/5 border-b border-base text-[var(--text-secondary)] font-bold"
              >
                <th class="p-2">配对/名称</th>
                <th class="p-2 w-32" v-if="activeTab === 'assets'">分类</th>
                <th class="p-2 w-28" v-else>分类</th>
                <th class="p-2 w-32">标签</th>
                <th class="p-2 w-32">指派作者</th>
                <th class="p-2 w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in batchQueue"
                :key="item.id"
                class="border-b border-base hover:bg-black/5 dark:hover:bg-white/5"
              >
                <td class="p-2 space-y-1">
                  <!-- Match status and files indicators -->
                  <div class="flex items-center gap-1.5">
                    <span
                      v-if="item.file"
                      class="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1 py-0.5 rounded text-[10px]"
                    >
                      {{ pathExt(item.file.name).toUpperCase() }}
                    </span>
                    <span
                      v-if="item.thumbnail"
                      class="bg-sky-500/10 text-sky-500 border border-sky-500/20 px-1 py-0.5 rounded text-[10px]"
                    >
                      预览图
                    </span>
                    <span
                      v-if="!item.file"
                      class="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1 py-0.5 rounded text-[10px]"
                    >
                      缺少主文件
                    </span>
                  </div>
                  <input
                    v-model="item.title"
                    type="text"
                    class="w-full px-1.5 py-0.5 border border-base bg-transparent rounded focus:border-accent text-xs font-bold"
                  />
                  <input
                    v-model="item.externalUrl"
                    type="text"
                    placeholder="输入外部链接地址 (可选)"
                    class="w-full px-1.5 py-0.5 border border-base/60 bg-transparent rounded text-[10px] text-[var(--text-secondary)]"
                  />
                </td>
                <td class="p-2">
                  <Select
                    v-if="activeTab === 'assets'"
                    v-model="item.categoryId"
                    class="w-full"
                    size="small"
                  >
                    <SelectOption
                      v-for="cat in assetCategories"
                      :key="cat.id"
                      :value="cat.id"
                      :label="cat.name"
                    />
                  </Select>
                  <input
                    v-else
                    v-model="item.category"
                    type="text"
                    class="w-full px-1.5 py-0.5 border border-base bg-transparent rounded text-xs"
                  />
                </td>
                <td class="p-2">
                  <input
                    v-model="item.tags"
                    type="text"
                    placeholder="逗号分隔"
                    class="w-full px-1.5 py-0.5 border border-base bg-transparent rounded text-xs"
                  />
                </td>
                <td class="p-2">
                  <Select v-model="item.userId" class="w-full" size="small" filterable>
                    <SelectOption value="" label="使用管理员账号" />
                    <SelectOption
                      v-for="u in usersList"
                      :key="u.id"
                      :value="u.id"
                      :label="u.name || u.email || u.id"
                    />
                  </Select>
                </td>
                <td class="p-2">
                  <button
                    type="button"
                    class="text-rose-500 hover:text-rose-600 bg-transparent border-0 cursor-pointer font-bold"
                    @click="removeBatchQueueItem(item.id)"
                  >
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="text-center py-8 text-[var(--text-muted)] text-xs">
          队列为空。拖入模型/包文件以开始。
        </div>

        <!-- Progress overlay / Error log output during bulk upload -->
        <div
          v-if="batchProgress.active || batchErrors.length > 0"
          class="border border-base p-3 rounded-xl bg-black/5 dark:bg-white/5 space-y-2 mt-2"
        >
          <div v-if="batchProgress.active" class="space-y-1">
            <div class="flex justify-between text-xs font-bold">
              <span>{{ batchProgress.statusText }}</span>
              <span>{{ Math.round((batchProgress.current / batchProgress.total) * 100) }}%</span>
            </div>
            <div class="w-full bg-strong/10 h-2 rounded-full overflow-hidden">
              <div
                class="bg-accent h-full transition-all duration-300"
                :style="{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }"
              ></div>
            </div>
          </div>
          <div v-if="batchErrors.length > 0" class="space-y-1">
            <span class="text-[10px] font-bold text-rose-500 block">发布异常记录:</span>
            <div
              class="max-h-24 overflow-y-auto text-[9px] text-rose-500 bg-rose-500/5 p-2 rounded border border-rose-500/10 font-mono space-y-0.5 custom-scrollbar"
            >
              <div v-for="(err, idx) in batchErrors" :key="idx">{{ err }}</div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <UiButton variant="secondary" @click="isCreateOpen = false">取消</UiButton>
        <UiButton
          v-if="createMode === 'single'"
          variant="primary"
          :loading="isSaving"
          @click="submitCreate"
        >
          发布
        </UiButton>
        <UiButton
          v-else
          variant="primary"
          :loading="batchProgress.active"
          @click="submitBatchPublish"
        >
          一键发布队列 ({{ batchQueue.length }})
        </UiButton>
      </template>
    </Modal>

    <!-- Edit Dialog -->
    <Modal
      :show="isEditOpen"
      :title="`编辑${pageConfig.label}信息`"
      size="lg"
      @close="isEditOpen = false"
    >
      <div class="form-stack">
        <label>
          标题
          <UiInput v-model="editForm.title" :glass="false" />
        </label>
        <label>
          描述介绍
          <textarea v-model="editForm.description" rows="4" />
        </label>
        <div class="form-grid">
          <label>
            状态
            <Select v-model="editForm.status" class="w-full mt-1.5" size="large">
              <SelectOption value="APPROVED" label="已发布" />
              <SelectOption value="PENDING" label="待审核" />
              <SelectOption value="REJECTED" label="已打回" />
            </Select>
          </label>
          <label v-if="activeTab === 'assets'">
            所属分类
            <Select v-model="editForm.categoryId" class="w-full mt-1.5" size="large">
              <SelectOption
                v-for="cat in assetCategories"
                :key="cat.id"
                :value="cat.id"
                :label="cat.name"
              />
            </Select>
          </label>
          <label v-if="activeTab === 'materials' || activeTab === 'plugins'">
            分类
            <UiInput v-model="editForm.category" :glass="false" />
          </label>
          <label v-if="activeTab === 'showcases'">
            类型
            <Select v-model="editForm.type" class="w-full mt-1.5" size="large">
              <SelectOption value="IMAGE" label="图文作品" />
              <SelectOption value="VIDEO" label="视频作品" />
            </Select>
          </label>
        </div>

        <div v-if="activeTab === 'materials'" class="form-grid">
          <label>
            分辨率
            <Select v-model="editForm.resolution" class="w-full mt-1.5" size="large">
              <SelectOption value="1K" label="1K" />
              <SelectOption value="2K" label="2K" />
              <SelectOption value="4K" label="4K" />
              <SelectOption value="8K" label="8K" />
            </Select>
          </label>
          <label class="checkbox-label !flex-row !items-center gap-2 mt-7 cursor-pointer">
            <input type="checkbox" v-model="editForm.isProcedural" />
            <span>程序化材质(Substance PBR)</span>
          </label>
        </div>

        <div v-if="activeTab === 'plugins'" class="form-grid">
          <label>
            版本
            <UiInput v-model="editForm.version" :glass="false" />
          </label>
          <label>
            软件兼容性
            <UiInput v-model="editForm.compatibility" :glass="false" />
          </label>
        </div>

        <label>
          标签
          <UiInput
            :model-value="editForm.tags || ''"
            @update:model-value="(val: any) => (editForm.tags = val)"
            placeholder="用逗号分隔"
            :glass="false"
          />
        </label>
      </div>
      <template #footer>
        <UiButton variant="secondary" @click="isEditOpen = false">取消</UiButton>
        <UiButton variant="primary" :loading="isSaving" @click="submitEdit">保存更改</UiButton>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.admin-contents-page {
  height: 100%;
  min-height: 0;
  background: transparent;
  color: var(--text-primary);
}

.user-table :deep(th),
.user-table :deep(td) {
  text-align: left;
}

.table-empty {
  padding: 48px 0;
  text-align: center;
  color: var(--text-muted);
}

.pagination-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-top: 1px solid var(--border-base);
  background: var(--bg-card);
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-stack label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 900;
  color: var(--text-secondary);
}

.form-stack textarea {
  min-height: 80px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 10px;
  color: var(--text-primary);
  outline: none;
  font-size: 13px;
  resize: vertical;
}

.form-stack textarea:focus {
  border-color: var(--accent);
}

.form-grid {
  display: grid;
  grid-template-cols: 1fr 1fr;
  gap: 12px;
}

.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 900;
  color: var(--text-secondary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  font-size: 13px;
  font-weight: 900;
  color: var(--text-secondary);
}

.checkbox-label input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
}

.file-upload-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

/* Table Density Customizations */
.table-compact :deep(th),
.table-compact :deep(td) {
  padding: 4px 6px !important;
  font-size: 11px !important;
}

.danger-action {
  background: rgba(220, 38, 38, 0.05);
  color: var(--danger);
  border-color: rgba(220, 38, 38, 0.15);
}

.danger-action:hover {
  background: rgba(220, 38, 38, 0.1);
}
</style>
