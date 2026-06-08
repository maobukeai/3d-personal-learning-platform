<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArrowUpDown,
  Box,
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  Eye,
  FileImage,
  Grid3X3,
  HardDrive,
  Layers,
  List,
  PackageCheck,
  Plus,
  Puzzle,
  Search,
  SendHorizonal,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';
import PublishWorkDialog from '@/components/PublishWorkDialog.vue';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

type WorkKind = 'asset' | 'material' | 'showcase' | 'plugin';
type WorkStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
type ViewMode = 'grid' | 'list';

interface AssetWork {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  url: string;
  thumbnail?: string | null;
  size?: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  categoryId?: string | null;
  category?: { id?: string; name: string } | null;
  tags?: string | null;
  downloads?: number;
  viewCount?: number;
  createdAt: string;
}

interface MaterialWork {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  resolution?: string | null;
  previewUrl?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  tags?: string | null;
  isProcedural?: boolean;
  downloads?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  createdAt: string;
  _count?: { favorites?: number };
}

interface ShowcaseWork {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  tags?: string | null;
  type?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  assetId?: string | null;
  views?: number;
  createdAt: string;
  _count?: { likes?: number; comments?: number };
}

interface PluginWork {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  version?: string | null;
  compatibility?: string | null;
  tags?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  previewUrl?: string | null;
  installGuide?: string | null;
  downloads?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  createdAt: string;
}

interface UnifiedWork {
  uid: string;
  id: string;
  kind: WorkKind;
  title: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  surface: string;
  typeLabel: string;
  format: string;
  thumbnail: string;
  size: number;
  metric: number;
  metricLabel: string;
  tags: string[];
  createdAt: string;
  raw: AssetWork | MaterialWork | ShowcaseWork;
}

interface CategoryType {
  id: string;
  name: string;
}

const router = useRouter();
const searchQuery = ref('');
const sourceFilter = ref<'ALL' | WorkKind>('ALL');
const statusFilter = ref<WorkStatus>('ALL');
const viewMode = ref<ViewMode>('grid');
const sortBy = ref<'newest' | 'oldest' | 'name' | 'status'>('newest');
const isLoading = ref(false);
const isPublishWorkDialogOpen = ref(false);
const isSaving = ref(false);
const isEditDialogOpen = ref(false);
const isPublishDialogOpen = ref(false);
const selectedWork = ref<UnifiedWork | null>(null);

const assets = ref<AssetWork[]>([]);
const materials = ref<MaterialWork[]>([]);
const showcases = ref<ShowcaseWork[]>([]);
const plugins = ref<PluginWork[]>([]);
const assetCategories = ref<CategoryType[]>([]);
const materialCategories = ['金属', '木纹', '石材', '织物', '程序化', '玻璃', '其他'];

const editForm = ref({
  title: '',
  description: '',
  categoryId: '',
  materialCategory: '其他',
  resolution: '4K',
  tags: '',
  isProcedural: false,
  showcaseType: 'IMAGE',
  videoUrl: '',
});

const publishForm = ref({
  assetId: '',
  title: '',
  description: '',
  tags: '',
});

const fetchWorks = async () => {
  isLoading.value = true;
  try {
    const [assetRes, materialRes, showcaseRes, pluginRes] = await Promise.all([
      api.get('/api/assets/my').catch(err => { console.error('Failed to fetch assets:', err); return { data: [] }; }),
      api.get('/api/materials/my').catch(err => { console.error('Failed to fetch materials:', err); return { data: [] }; }),
      api.get('/api/showcase/my').catch(err => { console.error('Failed to fetch showcases:', err); return { data: [] }; }),
      api.get('/api/plugins/my').catch(err => { console.error('Failed to fetch plugins:', err); return { data: [] }; }),
    ]);
    assets.value = assetRes.data || [];
    materials.value = materialRes.data || [];
    showcases.value = showcaseRes.data || [];
    plugins.value = pluginRes.data || [];
  } catch (err) {
    console.error('Unexpected error fetching works:', err);
    ElMessage.error('获取我的作品失败');
  } finally {
    isLoading.value = false;
  }
};

const fetchCategories = async () => {
  try {
    const response = await api.get('/api/assets/categories');
    assetCategories.value = response.data || [];
  } catch {
    assetCategories.value = [];
  }
};

onMounted(() => {
  fetchWorks();
  fetchCategories();
});

const allWorks = computed<UnifiedWork[]>(() => [
  ...assets.value.map(normalizeAsset),
  ...materials.value.map(normalizeMaterial),
  ...showcases.value.map(normalizeShowcase),
  ...plugins.value.map(normalizePlugin),
]);

const filteredWorks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const list = allWorks.value.filter((work) => {
    const matchesSource = sourceFilter.value === 'ALL' || work.kind === sourceFilter.value;
    const matchesStatus = statusFilter.value === 'ALL' || work.status === statusFilter.value;
    const matchesQuery =
      !query ||
      work.title.toLowerCase().includes(query) ||
      work.description.toLowerCase().includes(query) ||
      work.tags.some((tag) => tag.toLowerCase().includes(query));
    return matchesSource && matchesStatus && matchesQuery;
  });

  return [...list].sort((a, b) => {
    if (sortBy.value === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy.value === 'name') return a.title.localeCompare(b.title, 'zh-CN');
    if (sortBy.value === 'status') return statusWeight(a.status) - statusWeight(b.status);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

const stats = computed(() => {
  const total = allWorks.value.length;
  const approved = allWorks.value.filter((work) => work.status === 'APPROVED').length;
  const pending = allWorks.value.filter((work) => work.status === 'PENDING').length;
  const rejected = allWorks.value.filter((work) => work.status === 'REJECTED').length;
  const totalSize = allWorks.value.reduce((sum, work) => sum + work.size, 0);
  return { total, approved, pending, rejected, totalSize };
});

const sourceTabs = computed(() => [
  { key: 'ALL', label: '全部发布', count: allWorks.value.length, icon: Sparkles },
  { key: 'asset', label: '资源库', count: assets.value.length, icon: Box },
  { key: 'material', label: '材料库', count: materials.value.length, icon: Layers },
  { key: 'plugin', label: '插件库', count: plugins.value.length, icon: Puzzle },
  { key: 'showcase', label: '作品展示', count: showcases.value.length, icon: FileImage },
] as const);

const statusTabs = computed(() => [
  { key: 'ALL', label: '全部状态', count: allWorks.value.length },
  { key: 'PENDING', label: '待审核', count: stats.value.pending },
  { key: 'APPROVED', label: '已通过', count: stats.value.approved },
  { key: 'REJECTED', label: '未通过', count: stats.value.rejected },
] as const);

const statCards = computed(() => [
  { label: '全部作品', value: stats.value.total, icon: PackageCheck, tone: 'indigo', meta: '三类内容汇总' },
  { label: '已发布', value: stats.value.approved, icon: CheckCircle2, tone: 'emerald', meta: '公开可见' },
  { label: '审核中', value: stats.value.pending, icon: Clock3, tone: 'amber', meta: '修改后重新审核' },
  { label: '存储占用', value: formatSize(stats.value.totalSize), icon: HardDrive, tone: 'sky', meta: '资源与材料文件' },
]);

function normalizeAsset(item: AssetWork): UnifiedWork {
  return {
    uid: `asset:${item.id}`,
    id: item.id,
    kind: 'asset',
    title: item.title,
    description: item.description || '',
    status: item.status,
    rejectReason: item.rejectReason,
    surface: '资源库',
    typeLabel: '3D 模型资产',
    format: (item.type || 'GLB').toUpperCase(),
    thumbnail: item.thumbnail || getDefaultThumbnailUrl(item.type || 'GLB'),
    size: Number(item.size || 0),
    metric: item.downloads || item.viewCount || 0,
    metricLabel: item.downloads ? '下载' : '浏览',
    tags: parseTags(item.tags || item.category?.name || ''),
    createdAt: item.createdAt,
    raw: item,
  };
}

function normalizeMaterial(item: MaterialWork): UnifiedWork {
  return {
    uid: `material:${item.id}`,
    id: item.id,
    kind: 'material',
    title: item.title,
    description: item.description || '',
    status: item.status,
    rejectReason: item.rejectReason,
    surface: '材料库',
    typeLabel: item.isProcedural ? '程序化材质' : '材质贴图包',
    format: item.resolution || '材质',
    thumbnail: item.previewUrl || getDefaultThumbnailUrl('STL'),
    size: Number(item.fileSize || 0),
    metric: item._count?.favorites || item.downloads || 0,
    metricLabel: item._count?.favorites ? '收藏' : '下载',
    tags: parseTags(item.tags || item.category || ''),
    createdAt: item.createdAt,
    raw: item,
  };
}

function normalizePlugin(item: PluginWork): UnifiedWork {
  return {
    uid: `plugin:${item.id}`,
    id: item.id,
    kind: 'plugin',
    title: item.title,
    description: item.description || '',
    status: item.status,
    rejectReason: item.rejectReason,
    surface: '插件库',
    typeLabel: item.category || '插件',
    format: item.version ? `v${item.version}` : '插件',
    thumbnail: item.previewUrl || getDefaultThumbnailUrl('GLB'),
    size: Number(item.fileSize || 0),
    metric: item.downloads || 0,
    metricLabel: '下载',
    tags: parseTags(item.tags || ''),
    createdAt: item.createdAt,
    raw: item as any,
  };
}

function normalizeShowcase(item: ShowcaseWork): UnifiedWork {
  return {
    uid: `showcase:${item.id}`,
    id: item.id,
    kind: 'showcase',
    title: item.title,
    description: item.description || '',
    status: item.status,
    surface: '作品展示',
    typeLabel: getShowcaseTypeLabel(item.type || 'OTHER'),
    format: item.type || 'SHOW',
    thumbnail: item.thumbnailUrl || getDefaultThumbnailUrl('GLB'),
    size: 0,
    metric: item._count?.likes || item.views || 0,
    metricLabel: item._count?.likes ? '点赞' : '浏览',
    tags: parseTags(item.tags || ''),
    createdAt: item.createdAt,
    raw: item,
  };
}

function parseTags(tags?: string | null) {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    // fall through
  }
  return tags.split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean);
}

function getShowcaseTypeLabel(type: string) {
  if (type === 'MODEL') return '模型展示';
  if (type === 'VIDEO') return '视频作品';
  if (type === 'TEXT') return '图文作品';
  if (type === 'IMAGE') return '图片作品';
  return '创意作品';
}

function statusWeight(status: string) {
  if (status === 'PENDING') return 0;
  if (status === 'REJECTED') return 1;
  return 2;
}

function getStatusLabel(status: string) {
  if (status === 'APPROVED') return '已通过';
  if (status === 'REJECTED') return '未通过';
  return '待审核';
}

function formatSize(sizeMb: number) {
  if (!sizeMb) return '0 MB';
  if (sizeMb < 1) return `${Math.max(1, Math.round(sizeMb * 1024))} KB`;
  if (sizeMb >= 1024) return `${(sizeMb / 1024).toFixed(1)} GB`;
  return `${sizeMb.toFixed(1)} MB`;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const openEditDialog = (work: UnifiedWork) => {
  selectedWork.value = work;
  const pluginRaw = work.kind === 'plugin' ? (work.raw as PluginWork) : null;
  editForm.value = {
    title: work.title,
    description: work.description,
    categoryId: work.kind === 'asset' ? (work.raw as AssetWork).categoryId || '' : '',
    materialCategory:
      work.kind === 'material'
        ? (work.raw as MaterialWork).category || '其他'
        : work.kind === 'plugin'
          ? pluginRaw?.category || '其他工具'
          : '其他',
    resolution:
      work.kind === 'material'
        ? (work.raw as MaterialWork).resolution || '4K'
        : work.kind === 'plugin'
          ? pluginRaw?.version || '1.0.0'
          : '4K',
    tags: work.tags.join(', '),
    isProcedural: work.kind === 'material' ? !!(work.raw as MaterialWork).isProcedural : false,
    showcaseType: work.kind === 'showcase' ? (work.raw as ShowcaseWork).type || 'IMAGE' : 'IMAGE',
    videoUrl:
      work.kind === 'showcase'
        ? (work.raw as ShowcaseWork).videoUrl || ''
        : work.kind === 'plugin'
          ? pluginRaw?.compatibility || ''
          : '',
  };
  isEditDialogOpen.value = true;
};

const handleSaveEdit = async () => {
  if (!selectedWork.value || !editForm.value.title.trim()) {
    ElMessage.warning('请输入作品名称');
    return;
  }

  isSaving.value = true;
  try {
    const work = selectedWork.value;
    if (work.kind === 'asset') {
      await api.patch(`/api/assets/${work.id}`, {
        title: editForm.value.title,
        description: editForm.value.description,
        categoryId: editForm.value.categoryId || null,
        tags: editForm.value.tags,
      });
    } else if (work.kind === 'material') {
      await api.put(`/api/materials/${work.id}`, {
        title: editForm.value.title,
        description: editForm.value.description,
        category: editForm.value.materialCategory,
        resolution: editForm.value.resolution,
        tags: editForm.value.tags,
        isProcedural: editForm.value.isProcedural,
      });
    } else if (work.kind === 'plugin') {
      await api.put(`/api/plugins/${work.id}`, {
        title: editForm.value.title,
        description: editForm.value.description,
        category: editForm.value.materialCategory,
        version: editForm.value.resolution,
        compatibility: editForm.value.videoUrl,
        tags: editForm.value.tags,
      });
    } else {
      await api.put(`/api/showcase/${work.id}`, {
        title: editForm.value.title,
        description: editForm.value.description,
        tags: editForm.value.tags,
        type: editForm.value.showcaseType,
        videoUrl: editForm.value.videoUrl,
        isVideo: editForm.value.showcaseType === 'VIDEO',
      });
    }

    ElMessage.success('修改已提交，等待管理员重新审核');
    isEditDialogOpen.value = false;
    await fetchWorks();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存失败'));
  } finally {
    isSaving.value = false;
  }
};

const handleDeleteWork = async (work: UnifiedWork) => {
  try {
    await ElMessageBox.confirm(`确定删除「${work.title}」吗？`, '删除作品', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
    if (work.kind === 'asset') await api.delete(`/api/assets/${work.id}`);
    if (work.kind === 'material') await api.delete(`/api/materials/${work.id}`);
    if (work.kind === 'showcase') await api.delete(`/api/showcase/${work.id}`);
    if (work.kind === 'plugin') await api.delete(`/api/plugins/${work.id}`);
    ElMessage.success('已删除');
    await fetchWorks();
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('删除失败');
  }
};

const openPublishDialog = (work: UnifiedWork) => {
  if (work.kind !== 'asset') return;
  publishForm.value = {
    assetId: work.id,
    title: work.title,
    description: work.description,
    tags: work.tags.join(', '),
  };
  isPublishDialogOpen.value = true;
};

const handlePublishToShowcase = async () => {
  if (!publishForm.value.title.trim()) {
    ElMessage.warning('请输入展示标题');
    return;
  }
  try {
    await api.post('/api/showcase/publish-asset', publishForm.value);
    ElMessage.success('已发布到作品展示，等待管理员审核');
    isPublishDialogOpen.value = false;
    await fetchWorks();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发布失败'));
  }
};

const openWork = (work: UnifiedWork) => {
  if (work.kind === 'asset') {
    router.push({ name: 'AssetDetail', params: { id: work.id } });
  } else if (work.kind === 'material') {
    window.open((work.raw as MaterialWork).fileUrl || work.thumbnail, '_blank', 'noopener,noreferrer');
  } else {
    router.push({ name: 'Showcase' });
  }
};

const handleDownload = async (work: UnifiedWork) => {
  if (work.kind === 'asset') {
    window.open((work.raw as AssetWork).url, '_blank', 'noopener,noreferrer');
    return;
  }
  if (work.kind === 'material') {
    try {
      await api.post(`/api/materials/${work.id}/download`);
      const response = await api.get(`/api/materials/${work.id}/file`, { responseType: 'blob' });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = work.title;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      ElMessage.error('下载失败');
    }
  }
};
</script>

<template>
  <div class="my-works-page">
    <header class="works-header-bar">
      <div class="header-left">
        <div class="header-icon-wrap">
          <PackageCheck class="w-4 h-4" />
        </div>
        <h1>我的作品</h1>
      </div>
      <button type="button" class="primary-action" @click="isPublishWorkDialogOpen = true">
        <Plus class="h-4 w-4" />
        发布作品
      </button>
    </header>

    <div class="works-page-body">
      <section class="stats-grid">
      <article v-for="stat in statCards" :key="stat.label" class="stat-card" :data-tone="stat.tone">
        <div class="stat-icon">
          <component :is="stat.icon" class="h-4 w-4" />
        </div>
        <div class="stat-content">
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
          <small>{{ stat.meta }}</small>
        </div>
      </article>
    </section>

    <section class="toolbar">
      <label class="search-box">
        <Search class="h-4 w-4" />
        <input v-model="searchQuery" type="text" placeholder="搜索作品名称、描述、标签..." />
      </label>
      <div class="select-wrapper">
        <select v-model="sortBy">
          <option value="newest">最新发布</option>
          <option value="oldest">最早发布</option>
          <option value="name">名称排序</option>
          <option value="status">审核优先</option>
        </select>
        <ArrowUpDown class="sort-icon h-4 w-4" />
      </div>
      <div class="view-switch">
        <button type="button" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'">
          <Grid3X3 class="h-4 w-4" />
        </button>
        <button type="button" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">
          <List class="h-4 w-4" />
        </button>
      </div>
    </section>

    <section class="content-shell">
      <aside class="filter-panel">
        <div class="filter-group">
          <h2>作品类型</h2>
          <div class="filter-buttons">
            <button
              v-for="tab in sourceTabs"
              :key="tab.key"
              type="button"
              :class="{ active: sourceFilter === tab.key }"
              @click="sourceFilter = tab.key"
            >
              <div class="filter-btn-left">
                <component :is="tab.icon" class="h-4 w-4" />
                <span>{{ tab.label }}</span>
              </div>
              <strong class="count-badge">{{ tab.count }}</strong>
            </button>
          </div>
        </div>

        <div class="filter-group">
          <h2>审核状态</h2>
          <div class="filter-buttons">
            <button
              v-for="tab in statusTabs"
              :key="tab.key"
              type="button"
              :class="{ active: statusFilter === tab.key }"
              @click="statusFilter = tab.key"
            >
              <span>{{ tab.label }}</span>
              <strong class="count-badge">{{ tab.count }}</strong>
            </button>
          </div>
        </div>

        <div class="review-note">
          <Clock3 class="h-4 w-4" />
          <strong>编辑会重新审核</strong>
          <p>你在这里修改自己的资源、材料或展示作品后，系统会把状态改为待审核，管理员通过后才会再次公开。</p>
        </div>
      </aside>

      <main class="works-main">
        <div v-if="isLoading" class="empty-state">
          <div class="spinner"></div>
          正在加载我的作品...
        </div>

        <div v-else-if="filteredWorks.length === 0" class="empty-state">
          <PackageCheck class="h-10 w-10" />
          <strong>暂无匹配作品</strong>
          <span>试试调整筛选条件，或发布你的第一个作品。</span>
        </div>

        <div v-else :class="['works-grid', viewMode]">
          <article v-for="work in filteredWorks" :key="work.uid" class="work-card">
            <div class="preview" @click="openWork(work)">
              <img :src="work.thumbnail" :alt="work.title" />
              <div class="badges">
                <span>{{ work.surface }}</span>
                <span :data-status="work.status">{{ getStatusLabel(work.status) }}</span>
              </div>
            </div>

            <div class="card-body">
              <div class="card-title">
                <h2>{{ work.title }}</h2>
                <button type="button" @click="openEditDialog(work)">
                  <Edit3 class="h-4 w-4" />
                </button>
              </div>
              <p>{{ work.typeLabel }} · {{ work.format }} · {{ formatDate(work.createdAt) }}</p>
              <p v-if="work.rejectReason" class="reject-reason">
                <XCircle class="h-3.5 w-3.5" />
                {{ work.rejectReason }}
              </p>
              <div class="tag-row">
                <span v-for="tag in work.tags.slice(0, 3)" :key="tag">{{ tag }}</span>
              </div>
              <div class="card-actions">
                <div class="card-stats">
                  <span>
                    <component :is="work.metricLabel === '下载' ? Download : Eye" class="h-3.5 w-3.5" />
                    {{ work.metric }}
                  </span>
                  <span v-if="work.size > 0">{{ formatSize(work.size) }}</span>
                </div>
                <div class="action-buttons">
                  <button type="button" title="预览" @click="openWork(work)">
                    <Eye class="h-3.5 w-3.5" />
                  </button>
                  <button v-if="work.kind !== 'showcase'" type="button" title="下载" @click="handleDownload(work)">
                    <Download class="h-3.5 w-3.5" />
                  </button>
                  <button
                    v-if="work.kind === 'asset' && work.status === 'APPROVED'"
                    type="button"
                    title="发布到作品展示"
                    @click="openPublishDialog(work)"
                  >
                    <SendHorizonal class="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="删除" @click="handleDeleteWork(work)">
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>
    </section>

    <Transition name="fade">
      <div v-if="isEditDialogOpen && selectedWork" class="modal">
        <button type="button" class="modal-backdrop" @click="isEditDialogOpen = false"></button>
        <div class="edit-dialog">
          <header>
            <div>
              <h2>编辑{{ selectedWork.surface }}作品</h2>
              <p>保存后将提交管理员重新审核。</p>
            </div>
            <button type="button" @click="isEditDialogOpen = false">
              <X class="h-4 w-4" />
            </button>
          </header>

          <div class="edit-form">
            <label>
              <span>作品名称</span>
              <input v-model="editForm.title" type="text" />
            </label>

            <label class="wide">
              <span>作品说明</span>
              <MarkdownEditor v-model="editForm.description" :height="'220px'" placeholder="描述作品用途、制作说明或更新内容" simple />
            </label>

            <label v-if="selectedWork.kind === 'asset'">
              <span>资源分类</span>
              <select v-model="editForm.categoryId">
                <option value="">未分类</option>
                <option v-for="category in assetCategories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
            </label>

            <template v-if="selectedWork.kind === 'material'">
              <label>
                <span>材料分类</span>
                <select v-model="editForm.materialCategory">
                  <option v-for="category in materialCategories" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
              </label>
              <label>
                <span>分辨率 / 类型</span>
                <select v-model="editForm.resolution">
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                  <option value="8K">8K</option>
                  <option value="矢量">矢量</option>
                  <option value="程序化">程序化</option>
                </select>
              </label>
              <label class="checkbox-row">
                <input v-model="editForm.isProcedural" type="checkbox" />
                <span>程序化材质</span>
              </label>
            </template>

            <template v-if="selectedWork.kind === 'showcase'">
              <label>
                <span>展示类型</span>
                <select v-model="editForm.showcaseType">
                  <option value="IMAGE">图片作品</option>
                  <option value="VIDEO">视频作品</option>
                  <option value="MODEL">模型展示</option>
                  <option value="TEXT">图文作品</option>
                  <option value="OTHER">其他</option>
                </select>
              </label>
              <label v-if="editForm.showcaseType === 'VIDEO'">
                <span>视频链接</span>
                <input v-model="editForm.videoUrl" type="text" />
              </label>
            </template>

            <template v-if="selectedWork.kind === 'plugin'">
              <label>
                <span>插件分类</span>
                <select v-model="editForm.materialCategory">
                  <option value="Blender 插件">Blender 插件</option>
                  <option value="Three.js 插件">Three.js 插件</option>
                  <option value="Substance 工具">Substance 工具</option>
                  <option value="游戏引擎插件">游戏引擎插件</option>
                  <option value="Photoshop 脚本">Photoshop 脚本</option>
                  <option value="其他工具">其他工具</option>
                </select>
              </label>
              <label>
                <span>版本号</span>
                <input v-model="editForm.resolution" type="text" placeholder="如 1.2.0" />
              </label>
              <label>
                <span>兼容性</span>
                <input v-model="editForm.videoUrl" type="text" placeholder="如 Blender 3.x / 4.x" />
              </label>
            </template>

            <label>
              <span>标签</span>
              <input v-model="editForm.tags" type="text" placeholder="用逗号分隔多个标签" />
            </label>
          </div>

          <footer>
            <button type="button" class="cancel-button" @click="isEditDialogOpen = false">取消</button>
            <button type="button" class="save-button" :disabled="isSaving" @click="handleSaveEdit">
              {{ isSaving ? '提交中...' : '保存并提交审核' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="isPublishDialogOpen" class="modal">
        <button type="button" class="modal-backdrop" @click="isPublishDialogOpen = false"></button>
        <div class="publish-dialog">
          <header>
            <h2>发布到作品展示</h2>
            <button type="button" @click="isPublishDialogOpen = false">
              <X class="h-4 w-4" />
            </button>
          </header>
          <label>
            <span>展示标题</span>
            <input v-model="publishForm.title" type="text" />
          </label>
          <label>
            <span>展示说明</span>
            <textarea v-model="publishForm.description" rows="4"></textarea>
          </label>
          <label>
            <span>标签</span>
            <input v-model="publishForm.tags" type="text" />
          </label>
          <button type="button" class="save-button" @click="handlePublishToShowcase">提交展示审核</button>
        </div>
      </div>
    </Transition>

    <PublishWorkDialog v-model="isPublishWorkDialogOpen" @published="fetchWorks" />
    </div>
  </div>
</template>

<style scoped>
.my-works-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-app);
  color: var(--text-primary);
}

.works-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 52px;
  min-height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-base);
  background: var(--bg-card);
  flex-shrink: 0;
}

.works-page-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon-wrap {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(245, 121, 42, 0.1);
  color: #f5792a;
}

.dark .header-icon-wrap {
  background: rgba(245, 121, 42, 0.2);
  color: #f5792a;
}

.header-left h1 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.toolbar,
.content-shell,
.card-title,
.card-actions,
.modal header,
.modal footer {
  display: flex;
  align-items: center;
}

.primary-action,
.save-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.1s ease;
}

.primary-action:hover,
.save-button:hover {
  opacity: 0.9;
}

.primary-action:active,
.save-button:active {
  transform: scale(0.98);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 2px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  padding: 8px 12px;
  box-shadow: var(--card-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-1px);
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  transition: transform 0.2s ease;
}

.stat-card:hover .stat-icon {
  transform: scale(1.05);
}

.stat-card[data-tone='indigo'] .stat-icon { color: var(--accent); background: var(--accent-subtle); }
.stat-card[data-tone='indigo']:hover { border-color: var(--accent); }

.stat-card[data-tone='emerald'] .stat-icon { color: var(--success); background: rgba(16, 185, 129, 0.1); }
.stat-card[data-tone='emerald']:hover { border-color: var(--success); }

.stat-card[data-tone='amber'] .stat-icon { color: var(--warning); background: rgba(245, 158, 11, 0.1); }
.stat-card[data-tone='amber']:hover { border-color: var(--warning); }

.stat-card[data-tone='sky'] .stat-icon { color: var(--info); background: rgba(14, 165, 233, 0.1); }
.stat-card[data-tone='sky']:hover { border-color: var(--info); }

.stat-content {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-content span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin-bottom: 1px;
}

.stat-content strong {
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.15;
}

.stat-content small {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
}

.toolbar {
  gap: 8px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  height: 34px;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-muted);
  padding: 0 10px;
}

.search-box input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
}

.search-box input::placeholder {
  color: var(--text-muted);
  opacity: 0.8;
}

.select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.toolbar select,
.edit-form select,
.edit-form input,
.publish-dialog input,
.publish-dialog textarea {
  height: 34px;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 0 10px;
  outline: 0;
  font-size: 12px;
}

.toolbar select {
  padding-right: 28px;
  appearance: none;
  cursor: pointer;
}

.sort-icon {
  position: absolute;
  right: 8px;
  color: var(--text-muted);
  pointer-events: none;
}

.view-switch {
  display: flex;
  gap: 4px;
}

.view-switch button,
.card-actions button,
.card-title button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-switch button.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.content-shell {
  align-items: stretch;
  gap: 10px;
  min-height: 0;
  flex: 1;
}

.filter-panel {
  width: 175px;
  flex: 0 0 auto;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-group h2 {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.filter-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-buttons button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-buttons button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.filter-buttons button.active {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--accent);
}

.filter-btn-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.count-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 4px;
}

.filter-buttons button.active .count-badge {
  color: var(--accent);
  background: rgba(245, 121, 42, 0.15);
}

.review-note {
  margin-top: auto;
  border-radius: var(--radius-sm);
  background: var(--accent-subtle);
  color: var(--accent);
  padding: 8px;
  border: 1px solid var(--border-base);
}

.review-note strong {
  display: block;
  margin: 4px 0 2px;
  font-size: 11px;
}

.review-note p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1.4;
}

.works-main {
  min-width: 0;
  flex: 1;
  overflow-y: auto;
}

.works-grid.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 8px;
}

.works-grid.list {
  display: grid;
  gap: 8px;
}

.work-card {
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  box-shadow: var(--card-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.work-card:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
  box-shadow: var(--card-shadow-hover);
}

.works-grid.list .work-card {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
}

.preview {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--bg-app);
  cursor: pointer;
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s ease;
}

.work-card:hover .preview img {
  transform: scale(1.03);
}

.badges {
  position: absolute;
  left: 6px;
  top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.badges span {
  border-radius: var(--radius-xs);
  background: rgba(20, 28, 45, 0.72);
  color: #fff;
  padding: 2px 5px;
  font-size: 9px;
  font-weight: 700;
}

.badges [data-status='APPROVED'] { background: rgba(16, 185, 129, 0.9); }
.badges [data-status='PENDING'] { background: rgba(245, 158, 11, 0.9); }
.badges [data-status='REJECTED'] { background: rgba(239, 68, 68, 0.9); }

.card-body {
  padding: 10px;
}

.card-title {
  justify-content: space-between;
  gap: 6px;
}

.card-title h2 {
  margin: 0;
  min-width: 0;
  color: var(--text-primary);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-title button,
.card-actions button {
  width: 26px;
  height: 26px;
}

.card-body p {
  margin: 6px 0;
  color: var(--text-secondary);
  font-size: 11px;
}

.reject-reason {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--danger) !important;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 20px;
}

.tag-row span {
  border-radius: var(--radius-xs);
  background: var(--bg-active);
  color: var(--text-secondary);
  padding: 2px 5px;
  font-size: 9px;
  font-weight: 700;
}

.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--border-base);
}

.card-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
}

.card-stats span {
  display: flex;
  align-items: center;
  gap: 3px;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-buttons button,
.card-title button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-buttons button:hover,
.card-title button:hover {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--accent);
}

.empty-state {
  min-height: 300px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: var(--text-muted);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border-base);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 12px;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.45);
}

.edit-dialog,
.publish-dialog {
  position: relative;
  z-index: 1;
  width: min(720px, 100%);
  max-height: 92vh;
  overflow-y: auto;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  padding: 16px;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
  border: 1px solid var(--border-strong);
}

.publish-dialog {
  width: min(520px, 100%);
  display: grid;
  gap: 12px;
}

.modal header {
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}

.modal h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
}

.modal header p {
  margin: 2px 0 0;
  color: var(--text-muted);
  font-size: 11px;
}

.modal header button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  cursor: pointer;
  color: var(--text-secondary);
}

.edit-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.edit-form label,
.publish-dialog label {
  display: grid;
  gap: 5px;
}

.edit-form label.wide {
  grid-column: 1 / -1;
}

.edit-form span,
.publish-dialog span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
}

.checkbox-row {
  display: flex !important;
  align-items: center;
  gap: 6px;
}

.checkbox-row input {
  width: auto;
  height: auto;
}

.publish-dialog textarea {
  height: auto;
  padding: 8px;
  resize: vertical;
}

.modal footer {
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.cancel-button {
  height: 34px;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-secondary);
  padding: 0 12px;
  font-weight: 700;
  cursor: pointer;
  font-size: 12px;
}

.save-button:disabled {
  opacity: 0.7;
  cursor: wait;
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

@media (max-width: 980px) {
  .my-works-page {
    overflow-y: auto;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .content-shell {
    flex-direction: column;
  }

  .filter-panel {
    width: auto;
  }

  .works-grid.list .work-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .my-works-page {
    padding: 10px;
  }

  .works-header,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .stats-grid,
  .edit-form {
    grid-template-columns: 1fr;
  }
}
</style>
