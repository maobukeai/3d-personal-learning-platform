<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Box,
  Edit3,
  Layers,
  Sparkles,
  Puzzle,
  Search,
  Trash2,
  Plus,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ChevronsRight,
  Upload,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { useWorkspaceStore } from '@/stores/workspace';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';

type ContentTab = 'assets' | 'materials' | 'showcases' | 'plugins';
type ContentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type StatusFilter = ContentStatus | 'ALL';

interface ContentUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface ContentItem {
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

interface PageConfig {
  label: string;
  title: string;
  apiPath: string;
  icon: any;
  emptyLabel: string;
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

const fetchItems = async () => {
  isLoading.value = true;
  try {
    const params = {
      response: 'paginated',
      page: currentPage.value,
      limit: pageSize.value,
      search: searchQuery.value.trim() || undefined,
      status: statusFilter.value !== 'ALL' ? statusFilter.value : undefined,
    };
    const response = await api.get<any>(pageConfig.value.apiPath, { params });
    if (Array.isArray(response.data)) {
      items.value = response.data;
      totalItems.value = response.data.length;
      totalPages.value = 1;
    } else {
      items.value = response.data.items || [];
      totalItems.value = response.data.total || 0;
      currentPage.value = response.data.page || currentPage.value;
      pageSize.value = response.data.pageSize || pageSize.value;
      totalPages.value = Math.max(response.data.pages || 1, 1);
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
    ElMessage.error(getApiErrorMessage(error, `无法加载${pageConfig.value.label}数据`));
  } finally {
    isLoading.value = false;
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

// Actions
const selectItem = (item: ContentItem) => {
  activeItem.value = item;
};

const mediaUrl = (item: ContentItem) => {
  return item.thumbnail || item.thumbnailUrl || item.previewUrl || '';
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return '已通过';
    case 'REJECTED':
      return '已打回';
    case 'PENDING':
    default:
      return '待审核';
  }
};

const statusClass = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'PENDING':
    default:
      return 'pending';
  }
};

const itemKind = (item: ContentItem) => {
  if (activeTab.value === 'assets') return item.type || 'GLB';
  if (activeTab.value === 'materials') return item.resolution || '程序化';
  if (activeTab.value === 'showcases') return item.type === 'VIDEO' ? '视频作品' : '图文作品';
  return '应用扩展';
};

const metricLine = (item: ContentItem) => {
  const views = item.views ?? item.views ?? 0;
  const likes = item.likes ?? 0;
  const downloads = item.downloads ?? 0;
  return `浏览 ${views} · 点赞 ${likes} · 下载 ${downloads}`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
    .then(async () => {
      try {
        await api.delete(`${pageConfig.value.apiPath}/${item.id}`);
        ElMessage.success('资源已删除');
        fetchItems();
      } catch (error) {
        ElMessage.error(getApiErrorMessage(error, '删除失败'));
      }
    })
    .catch(() => {});
};

onMounted(() => {
  fetchItems();
  fetchAssetCategories();
});
</script>

<template>
  <div class="admin-workbench">
    <!-- Header -->
    <header class="workbench-header">
      <div>
        <p class="eyebrow">平台管理 · 资源清单</p>
        <h1>{{ pageConfig.title }}</h1>
      </div>
      <div class="header-actions">
        <button type="button" class="primary-btn" @click="openCreate">
          <Plus /> 发布{{ pageConfig.label }}
        </button>
      </div>
    </header>

    <!-- Toolbar -->
    <div class="toolbar-panel">
      <div class="shrink-0 overflow-x-auto" style="scrollbar-width: none; -ms-overflow-style: none">
        <Tabs v-model="activeTab" :options="tabsListOptions" size="sm" @change="handleTabChange" />
      </div>

      <div class="shrink-0 overflow-x-auto" style="scrollbar-width: none; -ms-overflow-style: none">
        <Tabs
          v-model="statusFilter"
          :options="statusFilterOptions"
          size="sm"
          @change="handleStatusFilterChange"
        />
      </div>

      <div class="search-box">
        <Search />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索关键字或创作者..."
          @keyup.enter="handleSearch"
        />
      </div>
    </div>

    <!-- Main Shell -->
    <main class="review-shell">
      <!-- Left List Panel -->
      <section class="queue-panel">
        <div class="queue-head">
          <span>共 {{ totalItems }} 个记录</span>
          <span>第 {{ currentPage }} / {{ totalPages }} 页</span>
        </div>

        <div v-if="items.length > 0" class="review-list custom-scrollbar">
          <div
            v-for="item in items"
            :key="item.id"
            class="review-row"
            :class="{ active: activeItem?.id === item.id }"
            @click="selectItem(item)"
          >
            <div class="row-check">
              <component :is="pageConfig.icon" class="w-4 h-4 text-accent" />
            </div>
            <div class="row-thumb">
              <img v-if="mediaUrl(item)" :src="mediaUrl(item)" alt="" />
              <component :is="pageConfig.icon" v-else />
            </div>
            <div class="row-main">
              <div class="row-title">
                <span class="pill" :class="statusClass(item.status)">
                  {{ statusLabel(item.status) }}
                </span>
                <strong class="truncate">{{ item.title }}</strong>
              </div>
              <p class="row-desc truncate">{{ item.description || '无描述' }}</p>
            </div>
            <div class="row-meta">
              <div class="meta-author truncate">
                作者：{{ item.user?.name || item.user?.email || '匿名' }}
              </div>
              <div class="meta-time">{{ formatDate(item.createdAt) }}</div>
            </div>
          </div>
        </div>

        <div v-else-if="!isLoading" class="empty-list-state">
          <component :is="pageConfig.icon" class="w-12 h-12 text-slate-300 dark:text-slate-700" />
          <p>{{ pageConfig.emptyLabel }}</p>
          <span>当前筛选条件下没有需要展示的记录。</span>
        </div>

        <!-- Footer Pagination -->
        <footer class="queue-foot">
          <div class="pagination">
            <button type="button" :disabled="currentPage === 1" @click="setPage(1)">
              <ChevronsLeft />
            </button>
            <button type="button" :disabled="currentPage === 1" @click="setPage(currentPage - 1)">
              <ChevronLeft />
            </button>
            <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
            <button
              type="button"
              :disabled="currentPage === totalPages"
              @click="setPage(currentPage + 1)"
            >
              <ChevronRightIcon />
            </button>
            <button
              type="button"
              :disabled="currentPage === totalPages"
              @click="setPage(totalPages)"
            >
              <ChevronsRight />
            </button>
          </div>
        </footer>
      </section>

      <!-- Right Inspector Panel -->
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
            <p class="custom-scrollbar">{{ activeItem.description || '暂无描述' }}</p>
          </div>

          <div class="inspector-section">
            <h3>资产信息</h3>
            <div class="detail-grid">
              <span>作者</span>
              <strong>{{ activeItem.user?.name || activeItem.user?.email || '匿名创作者' }}</strong>
              <span>类别</span>
              <strong>{{ itemKind(activeItem) }}</strong>
              <span>指标</span>
              <strong>{{ metricLine(activeItem) }}</strong>
              <span>创建时间</span>
              <strong>{{ formatDate(activeItem.createdAt) }}</strong>
            </div>
          </div>

          <div v-if="activeItem.tags" class="inspector-section">
            <h3>标签</h3>
            <p class="tag-line">{{ activeItem.tags }}</p>
          </div>

          <div v-if="activeItem.rejectReason" class="inspector-section">
            <h3>退回理由</h3>
            <p class="body-text">{{ activeItem.rejectReason }}</p>
          </div>

          <div class="inspector-actions">
            <button type="button" @click="openEdit(activeItem)"><Edit3 /> 编辑资源</button>
            <button type="button" class="danger-action" @click="handleDelete(activeItem)">
              <Trash2 /> 彻底删除
            </button>
          </div>
        </template>
        <div v-else class="empty-state">
          <ChevronRightIcon />
          <strong>选择一条记录</strong>
          <span>右侧会显示资源详细信息及操作。</span>
        </div>
      </aside>
    </main>

    <!-- Create Modal -->
    <Modal
      :show="isCreateOpen"
      :title="`发布新${pageConfig.label}`"
      size="md"
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
.inspector-actions button,
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

.ghost-btn,
.inspector-actions button {
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.danger-action {
  background: rgba(220, 38, 38, 0.1) !important;
  color: var(--danger) !important;
  border-color: rgba(220, 38, 38, 0.2) !important;
}

button svg {
  width: 15px;
  height: 15px;
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
  padding: 0 12px;
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

.search-box input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
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
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-base);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.review-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-row {
  min-height: 76px;
  display: grid;
  grid-template-columns: 32px 64px minmax(0, 1fr) minmax(180px, auto);
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.2s;
}

.review-row:hover {
  border-color: var(--border-strong);
  background: var(--bg-elevated);
}

.review-row.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-card));
  box-shadow: 0 0 0 1px var(--accent);
}

.row-check {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: var(--bg-app);
}

.row-thumb {
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 6px;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
}

.row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row-thumb > svg {
  width: 20px;
  height: 20px;
  color: var(--text-muted);
}

.row-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
}

.row-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.row-title strong {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
}

.row-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.row-meta {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}

.meta-author {
  font-weight: 700;
  color: var(--text-secondary);
}

.meta-time {
  color: var(--text-muted);
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pill.pending {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.pill.approved {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.pill.rejected {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.empty-list-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-muted);
  text-align: center;
  gap: 8px;
}

.empty-list-state p {
  font-weight: 800;
  color: var(--text-secondary);
}

.empty-list-state span {
  font-size: 12px;
}

.queue-foot {
  padding: 10px 14px;
  border-top: 1px solid var(--border-base);
  display: flex;
  justify-content: center;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-secondary);
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 12px;
  font-weight: 800;
  padding: 0 10px;
}

.inspector-panel {
  display: flex;
  flex-direction: column;
  padding: 16px;
  overflow-y: auto;
  text-align: left;
}

.inspector-media {
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
  display: grid;
  place-items: center;
  margin-bottom: 16px;
}

.inspector-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.inspector-media svg {
  width: 48px;
  height: 48px;
  color: var(--text-muted);
}

.inspector-title {
  margin-bottom: 20px;
}

.inspector-title h2 {
  font-size: 18px;
  font-weight: 900;
  margin: 6px 0 8px;
  color: var(--text-primary);
}

.inspector-title p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.inspector-section {
  border-top: 1px solid var(--border-base);
  padding-top: 16px;
  margin-bottom: 16px;
}

.inspector-section h3 {
  font-size: 11px;
  font-weight: 900;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 10px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 8px 12px;
  font-size: 12px;
}

.detail-grid span {
  color: var(--text-secondary);
}

.detail-grid strong {
  font-weight: 700;
  color: var(--text-primary);
}

.tag-line {
  font-size: 12px;
  color: var(--accent);
  font-family: monospace;
}

.body-text {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary);
}

.inspector-actions {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border-base);
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.inspector-actions button {
  width: 100%;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
  gap: 6px;
}

.empty-state svg {
  width: 32px;
  height: 32px;
}

.empty-state strong {
  font-size: 14px;
  color: var(--text-secondary);
}

.empty-state span {
  font-size: 12px;
}

/* Modal Form Styles */
.form-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: left;
}

.form-stack label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 900;
  color: var(--text-secondary);
}

.form-stack input,
.form-stack textarea,
.form-stack select {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  outline: 0;
  transition: all 0.2s;
}

.form-stack input:focus,
.form-stack textarea:focus,
.form-stack select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

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
</style>
