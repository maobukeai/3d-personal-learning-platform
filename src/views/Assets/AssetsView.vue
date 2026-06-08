<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Activity,
  BarChart3,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Grid3X3,
  Heart,
  LayoutGrid,
  List,
  MoreHorizontal,
  PackageCheck,
  Search,
  SlidersHorizontal,
  UploadCloud,
  UsersRound,
  X,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';
import type { Asset, Category } from '@/types';

type AssetListItem = Asset & {
  category?: Category | null;
  user?: {
    name?: string | null;
    avatarUrl?: string | null;
  } | null;
};

type AssetCategory = Category & {
  _count?: {
    assets?: number;
  };
};

type ViewMode = 'grid' | 'list';
type SortKey = 'latest' | 'oldest' | 'popular' | 'size';

const router = useRouter();
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));
const searchQuery = ref('');
const activeCategoryId = ref('all');
const selectedFormat = ref('all');
const selectedTag = ref('all');
const selectedQuality = ref('all');
const selectedLicense = ref('all');
const sortKey = ref<SortKey>('latest');
const viewMode = ref<ViewMode>('grid');
const isMobile = ref(window.innerWidth < 900);
const isFilterMenuOpen = ref(false);
const assets = ref<AssetListItem[]>([]);
const analyticsAssets = ref<AssetListItem[]>([]);
const assetCategories = ref<AssetCategory[]>([]);
const isLoading = ref(false);
const isUploading = ref(false);
const isUploadDialogOpen = ref(false);

const isCategoryExpanded = ref(localStorage.getItem('3d_platform_category_expanded') !== 'false');
const isFormatExpanded = ref(localStorage.getItem('3d_platform_format_expanded') === 'true');
const isTagExpanded = ref(localStorage.getItem('3d_platform_tag_expanded') === 'true');

const tagsList = ref<{ label: string; count: number; searchCount: number }[]>([]);
const isAllTagsExpanded = ref(false);
const tagSearchQuery = ref('');

const fetchTags = async () => {
  try {
    const response = await api.get('/api/assets/tags');
    tagsList.value = response.data;
  } catch (error) {
    console.error('Failed to fetch tags:', error);
  }
};

const handleTagClick = (tagLabel: string) => {
  searchQuery.value = tagLabel;
  isAllTagsExpanded.value = false;
  tagSearchQuery.value = '';
  fetchAssets();
  fetchTags();
};

const toggleAllTags = () => {
  isAllTagsExpanded.value = !isAllTagsExpanded.value;
  if (!isAllTagsExpanded.value) {
    tagSearchQuery.value = '';
  }
};

const displayedSidebarTags = computed(() => {
  let list = tagsList.value;
  const query = tagSearchQuery.value.trim().toLowerCase();
  if (query) {
    list = list.filter(t => t.label.toLowerCase().includes(query));
  }
  if (!isAllTagsExpanded.value && !query) {
    return list.slice(0, 9);
  }
  return list;
});

const toggleCategory = () => {
  isCategoryExpanded.value = !isCategoryExpanded.value;
  localStorage.setItem('3d_platform_category_expanded', String(isCategoryExpanded.value));
};

const toggleFormat = () => {
  isFormatExpanded.value = !isFormatExpanded.value;
  localStorage.setItem('3d_platform_format_expanded', String(isFormatExpanded.value));
};

const toggleTag = () => {
  isTagExpanded.value = !isTagExpanded.value;
  localStorage.setItem('3d_platform_tag_expanded', String(isTagExpanded.value));
};

const pagination = ref({
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
});

const uploadForm = ref({
  uploadType: 'file',
  title: '',
  description: '',
  categoryId: '',
  file: null as File | null,
  externalUrl: '',
  thumbnail: null as File | null,
  formats: [] as string[],
  tags: '',
});

const availableFormats = ['FBX', 'OBJ', 'BLEND', 'MAX', 'C4D', 'MAYA', 'ZTL', 'SPP', 'Textures'];
const formatOptions = ['all', 'GLB', 'GLTF', 'FBX', 'OBJ', 'STL', 'DAE', 'ZIP', 'LINK'];
const tagOptions = [
  { value: 'all', label: '全部标签' },
  { value: 'animated', label: '含动画' },
  { value: 'materials', label: '含材质' },
  { value: 'large', label: '大文件' },
];
const qualityOptions = [
  { value: 'all', label: '全部质量' },
  { value: 'high', label: '高精度' },
  { value: 'medium', label: '中精度' },
  { value: 'light', label: '轻量' },
];
const licenseOptions = [
  { value: 'all', label: '全部许可' },
  { value: 'downloadable', label: '可下载' },
  { value: 'link', label: '外链资源' },
];

const isZipFile = computed(() => {
  const fileName = uploadForm.value.file?.name || '';
  return fileName.toLowerCase().endsWith('.zip');
});

const canSubmitUpload = computed(() => {
  const hasSource =
    uploadForm.value.uploadType === 'file'
      ? Boolean(uploadForm.value.file)
      : Boolean(uploadForm.value.externalUrl.trim());

  return (
    hasSource &&
    Boolean(uploadForm.value.title.trim()) &&
    Boolean(uploadForm.value.categoryId) &&
    !isUploading.value
  );
});

watch(isZipFile, (isZip) => {
  if (!isZip) {
    uploadForm.value.formats = [];
  }
});

const categories = computed(() => [
  { id: 'all', name: '全部分类', count: pagination.value.total },
  ...assetCategories.value.map((category) => ({
    id: category.id,
    name: category.name,
    count: category._count?.assets || 0,
  })),
]);

const normalizedAssets = computed(() => assets.value.map(normalizeAsset));
const normalizedAnalyticsAssets = computed(() => analyticsAssets.value.map(normalizeAsset));

const displayedAssets = computed(() => {
  const filtered = normalizedAssets.value.filter((asset) => {
    const matchesFormat = selectedFormat.value === 'all' || asset.format === selectedFormat.value;
    const matchesTag =
      selectedTag.value === 'all' ||
      (selectedTag.value === 'animated' && asset.hasAnimations) ||
      (selectedTag.value === 'materials' && (asset.materials || 0) > 0) ||
      (selectedTag.value === 'large' && (asset.sizeMb || 0) >= 10);
    const matchesQuality =
      selectedQuality.value === 'all' ||
      (selectedQuality.value === 'high' && (asset.faces || 0) >= 50000) ||
      (selectedQuality.value === 'medium' && (asset.faces || 0) > 0 && (asset.faces || 0) < 50000) ||
      (selectedQuality.value === 'light' && (asset.sizeMb || 0) < 3);
    const matchesLicense =
      selectedLicense.value === 'all' ||
      (selectedLicense.value === 'downloadable' && asset.format !== 'LINK') ||
      (selectedLicense.value === 'link' && asset.format === 'LINK');

    return matchesFormat && matchesTag && matchesQuality && matchesLicense;
  });

  return filtered.sort((a, b) => {
    if (sortKey.value === 'oldest') return a.createdAtTime - b.createdAtTime;
    if (sortKey.value === 'popular') return b.popularity - a.popularity;
    if (sortKey.value === 'size') return (b.sizeMb || 0) - (a.sizeMb || 0);
    return b.createdAtTime - a.createdAtTime;
  });
});

const totalSizeMb = computed(() =>
  normalizedAnalyticsAssets.value.reduce((sum, asset) => sum + (asset.sizeMb || 0), 0),
);

const animatedAssetsCount = computed(() =>
  normalizedAnalyticsAssets.value.filter((asset) => asset.hasAnimations).length,
);
const optimizedAssetsCount = computed(() =>
  normalizedAnalyticsAssets.value.filter(
    (asset) => (asset.faces || 0) > 0 && (asset.faces || 0) < 50000,
  ).length,
);
const sharedUserCount = computed(() => {
  const names = new Set(normalizedAnalyticsAssets.value.map((asset) => asset.author).filter(Boolean));
  return Math.max(names.size, normalizedAnalyticsAssets.value.length ? 1 : 0);
});

const statCards = computed(() => [
  {
    label: '资产总数',
    value: pagination.value.total,
    meta: `较上月 +${Math.min(12, Math.max(0, normalizedAnalyticsAssets.value.length))}`,
    icon: Box,
    tone: 'indigo',
    spark: [18, 22, 21, 28, 24, 33, 30, 38],
  },
  {
    label: '动画模型',
    value: animatedAssetsCount.value,
    meta: normalizedAnalyticsAssets.value.length
      ? `${Math.round((animatedAssetsCount.value / normalizedAnalyticsAssets.value.length) * 100)}%`
      : '0%',
    icon: Activity,
    tone: 'emerald',
    spark: [14, 18, 25, 20, 28, 24, 32, 36],
  },
  {
    label: '轻量网格',
    value: optimizedAssetsCount.value,
    meta: normalizedAnalyticsAssets.value.length
      ? `${Math.round((optimizedAssetsCount.value / normalizedAnalyticsAssets.value.length) * 100)}%`
      : '0%',
    icon: PackageCheck,
    tone: 'orange',
    spark: [22, 24, 21, 25, 23, 27, 26, 30],
  },
  {
    label: '团队共享',
    value: sharedUserCount.value,
    meta: '贡献者',
    icon: UsersRound,
    tone: 'sky',
    spark: [10, 14, 13, 18, 17, 23, 20, 26],
  },
]);

const latestActivities = computed(() =>
  normalizedAnalyticsAssets.value.slice(0, 5).map((asset) => ({
    id: asset.id,
    name: asset.author,
    avatar: asset.avatar,
    action: asset.format === 'LINK' ? '分享了模型' : '上传了模型',
    target: asset.title,
    time: formatRelativeTime(asset.createdAt),
  })),
);

// hotTags and filteredTags are replaced by displayedSidebarTags

const storagePercent = computed(() => Math.min(100, Math.round((totalSizeMb.value / 100) * 100)));

watch(
  [searchQuery, activeCategoryId],
  () => {
    pagination.value.page = 1;
    fetchAssets();
  },
  { flush: 'post' },
);

const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 900;
};

const fetchCategories = async () => {
  try {
    const response = await api.get('/api/assets/categories');
    assetCategories.value = response.data;
  } catch (_error) {
    console.error('Failed to fetch categories');
  }
};

const fetchAssets = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/assets/public', {
      params: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        search: searchQuery.value,
        categoryId: activeCategoryId.value,
      },
    });
    assets.value = response.data.assets || [];
    pagination.value = response.data.pagination;
  } catch (_error) {
    ElMessage.error('获取资产失败');
  } finally {
    isLoading.value = false;
  }
};

const fetchAnalyticsAssets = async () => {
  try {
    const response = await api.get('/api/assets/public', {
      params: {
        page: 1,
        limit: 50,
        lite: true,
      },
    });
    analyticsAssets.value = response.data.assets || [];
  } catch (_error) {
    analyticsAssets.value = [];
  }
};

const handlePageChange = (page: number) => {
  pagination.value.page = page;
  fetchAssets();
};

const handleLimitChange = (limit: number) => {
  pagination.value.limit = limit;
  pagination.value.page = 1;
  fetchAssets();
};

const goToDetail = (id: string) => {
  router.push({ name: 'AssetDetail', params: { id } });
};

const handleDirectDownload = async (asset: AssetListItem) => {
  if (!asset.url) return;
  try {
    const response = await api.post(`/api/assets/${asset.id}/download`);
    asset.downloads = response.data.downloads;
  } catch (error) {
    console.error('Failed to record download:', error);
  }
  window.open(asset.url, '_blank', 'noopener,noreferrer');
};

const showComingSoon = (feature: string) => {
  ElMessage.info(`${feature}功能已保留入口，可继续接入后端能力`);
};

const handleFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (file) {
    uploadForm.value.file = file;
    if (!uploadForm.value.title) {
      uploadForm.value.title = file.name.split('.')[0];
    }
  }
};

const handleThumbnailChange = (e: Event) => {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (file) {
    uploadForm.value.thumbnail = file;
  }
};

const resetUploadForm = () => {
  uploadForm.value = {
    uploadType: 'file',
    title: '',
    description: '',
    categoryId: '',
    file: null,
    externalUrl: '',
    thumbnail: null,
    formats: [],
    tags: '',
  };
};

const handleUpload = async () => {
  if (uploadForm.value.uploadType === 'file' && !uploadForm.value.file) {
    ElMessage.warning('请选择模型文件');
    return;
  }

  if (uploadForm.value.uploadType === 'link' && !uploadForm.value.externalUrl) {
    ElMessage.warning('请输入外链地址');
    return;
  }

  if (!uploadForm.value.title.trim()) {
    ElMessage.warning('请填写资源名称');
    return;
  }

  if (!uploadForm.value.categoryId) {
    ElMessage.warning('请选择资源分类');
    return;
  }

  isUploading.value = true;
  const formData = new FormData();
  if (uploadForm.value.uploadType === 'file') {
    formData.append('asset', uploadForm.value.file!);
  } else {
    formData.append('externalUrl', uploadForm.value.externalUrl);
  }
  if (uploadForm.value.thumbnail) {
    formData.append('thumbnail', uploadForm.value.thumbnail);
  }
  formData.append('title', uploadForm.value.title);
  formData.append('description', uploadForm.value.description);
  formData.append('categoryId', uploadForm.value.categoryId);
  if (uploadForm.value.tags) {
    formData.append('tags', uploadForm.value.tags);
  }
  if (uploadForm.value.formats.length > 0) {
    formData.append('formats', JSON.stringify(uploadForm.value.formats));
  }

  try {
    await api.post('/api/assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success('上传成功，请等待管理员审核');
    isUploadDialogOpen.value = false;
    resetUploadForm();
    fetchAssets();
    fetchAnalyticsAssets();
    fetchCategories();
    fetchTags();
  } catch (_error) {
    ElMessage.error('上传失败');
  } finally {
    isUploading.value = false;
  }
};

function normalizeAsset(asset: AssetListItem) {
  const sizeMb = Number(asset.size ?? (asset.fileSize ? asset.fileSize / 1024 / 1024 : 0)) || 0;
  const format = (asset.type || asset.format || 'GLB').toUpperCase();
  const downloads = asset.downloads ?? 0;
  const likes = asset.likes ?? 0;
  const viewCount = asset.viewCount ?? 0;

  return {
    ...asset,
    format,
    sizeMb,
    author: asset.user?.name || '未知用户',
    avatar: asset.user?.avatarUrl || '',
    categoryName: asset.category?.name || '未分类',
    createdAtTime: new Date(asset.createdAt).getTime(),
    downloads,
    likes,
    viewCount,
    popularity: downloads + likes + viewCount,
  };
}

function formatSize(sizeMb?: number | null, format?: string) {
  if (format === 'LINK') return '外部资源';
  const value = Number(sizeMb || 0);
  if (!value) return '未知大小';
  if (value < 1) return `${Math.max(1, Math.round(value * 1024))} KB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`;
  return `${value.toFixed(1)} MB`;
}

function formatRelativeTime(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(date).toLocaleDateString('zh-CN');
}

function sparkline(points: number[]) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  return points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 36 - ((point - min) / Math.max(1, max - min)) * 28;
      return `${x},${y}`;
    })
    .join(' ');
}

onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  fetchAssets();
  fetchAnalyticsAssets();
  fetchCategories();
  fetchTags();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});
</script>

<template>
  <div class="asset-library-page">
    <header class="asset-header-bar">
      <div class="header-left">
        <div class="header-icon-wrap">
          <Box class="w-4 h-4" />
        </div>
        <h1>模型资产库</h1>
      </div>

      <div class="header-actions">
        <button type="button" class="ghost-action" @click="showComingSoon('资产分析')">
          <BarChart3 class="h-3.5 w-3.5" />
          资产分析
        </button>
        <button type="button" class="ghost-action" @click="showComingSoon('批量操作')">
          <MoreHorizontal class="h-3.5 w-3.5" />
          批量操作
        </button>
        <button type="button" class="primary-action" @click="isUploadDialogOpen = true">
          <UploadCloud class="h-3.5 w-3.5" />
          上传资产
        </button>
      </div>
    </header>

    <div class="asset-page-body">
      <main class="asset-main">

      <section class="stats-grid">
        <article v-for="stat in statCards" :key="stat.label" class="stat-card" :data-tone="stat.tone">
          <div class="stat-icon">
            <component :is="stat.icon" class="h-5 w-5" />
          </div>
          <div class="stat-content">
            <span>{{ stat.label }}</span>
            <strong>{{ stat.value }}</strong>
            <small>{{ stat.meta }}</small>
          </div>
          <svg class="stat-spark" viewBox="0 0 100 40" preserveAspectRatio="none">
            <polyline :points="sparkline(stat.spark)" />
          </svg>
        </article>
      </section>

      <section class="asset-toolbar">
        <label class="search-box">
          <Search class="h-4 w-4" />
          <input v-model="searchQuery" type="text" placeholder="搜索资产名称、标签、作者..." />
        </label>

        <div class="filter-strip">
          <select v-model="activeCategoryId">
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
          <select v-model="selectedFormat">
            <option v-for="format in formatOptions" :key="format" :value="format">
              {{ format === 'all' ? '全部格式' : format }}
            </option>
          </select>
          <select v-model="selectedQuality">
            <option v-for="quality in qualityOptions" :key="quality.value" :value="quality.value">
              {{ quality.label }}
            </option>
          </select>
          <select v-model="selectedTag">
            <option v-for="tag in tagOptions" :key="tag.value" :value="tag.value">
              {{ tag.label }}
            </option>
          </select>
          <select v-model="selectedLicense">
            <option v-for="license in licenseOptions" :key="license.value" :value="license.value">
              {{ license.label }}
            </option>
          </select>
          <select v-model="sortKey">
            <option value="latest">最新上传</option>
            <option value="oldest">最早上传</option>
            <option value="popular">热度优先</option>
            <option value="size">文件大小</option>
          </select>
        </div>

        <div class="view-switch">
          <button type="button" :class="{ active: viewMode === 'grid' }" title="网格视图" @click="viewMode = 'grid'">
            <Grid3X3 class="h-4 w-4" />
          </button>
          <button type="button" :class="{ active: viewMode === 'list' }" title="列表视图" @click="viewMode = 'list'">
            <List class="h-4 w-4" />
          </button>
          <button type="button" class="mobile-filter" title="筛选" @click="isFilterMenuOpen = !isFilterMenuOpen">
            <Filter class="h-4 w-4" />
          </button>
        </div>
      </section>

      <Transition name="slide-down">
        <section v-if="isFilterMenuOpen && isMobile" class="mobile-filter-panel">
          <button v-for="category in categories" :key="category.id" type="button" :class="{ active: activeCategoryId === category.id }" @click="activeCategoryId = category.id; isFilterMenuOpen = false">
            {{ category.name }} <span>{{ category.count }}</span>
          </button>
        </section>
      </Transition>

      <section class="content-shell">
        <aside class="filter-sidebar">
          <div class="sidebar-title">
            <SlidersHorizontal class="h-4 w-4" />
            筛选条件
            <button type="button" @click="activeCategoryId = 'all'; selectedFormat = 'all'; selectedTag = 'all'; selectedQuality = 'all'; selectedLicense = 'all'">清空</button>
          </div>

          <div class="filter-group">
            <h3 @click="toggleCategory">
              <span>分类</span>
              <ChevronDown :class="['h-3.5 w-3.5 collapse-icon', { collapsed: !isCategoryExpanded }]" />
            </h3>
            <div v-show="isCategoryExpanded" class="filter-content">
              <button v-for="category in categories" :key="category.id" type="button" :class="{ active: activeCategoryId === category.id }" @click="activeCategoryId = category.id">
                <span>{{ category.name }}</span>
                <small>{{ category.count }}</small>
              </button>
            </div>
          </div>

          <div class="filter-group">
            <h3 @click="toggleFormat">
              <span>格式</span>
              <ChevronDown :class="['h-3.5 w-3.5 collapse-icon', { collapsed: !isFormatExpanded }]" />
            </h3>
            <div v-show="isFormatExpanded" class="filter-content">
              <button v-for="format in formatOptions" :key="format" type="button" :class="{ active: selectedFormat === format }" @click="selectedFormat = format">
                <span>{{ format === 'all' ? '全部格式' : `.${format.toLowerCase()}` }}</span>
                <small>{{ format === 'all' ? pagination.total : normalizedAnalyticsAssets.filter((asset) => asset.format === format).length }}</small>
              </button>
            </div>
          </div>

          <div class="filter-group">
            <h3 @click="toggleTag">
              <span>标签</span>
              <ChevronDown :class="['h-3.5 w-3.5 collapse-icon', { collapsed: !isTagExpanded }]" />
            </h3>
            <div v-show="isTagExpanded" class="filter-content">
              <button v-for="tag in tagOptions" :key="tag.value" type="button" :class="{ active: selectedTag === tag.value }" @click="selectedTag = tag.value">
                <span>{{ tag.label }}</span>
              </button>
            </div>
          </div>
        </aside>

        <div class="asset-results">
          <div v-if="isLoading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>正在加载资产...</span>
          </div>

          <div v-else-if="displayedAssets.length === 0" class="empty-state">
            <PackageCheck class="h-10 w-10" />
            <strong>没有找到匹配的资产</strong>
            <span>调整筛选条件或上传新的 3D 资源</span>
          </div>

          <div v-else :class="['asset-grid', viewMode]">
            <article v-for="asset in displayedAssets" :key="asset.id" class="asset-card" @click="goToDetail(asset.id)">
              <div class="asset-preview">
                <img :src="asset.thumbnail || getDefaultThumbnailUrl(asset.format)" :alt="asset.title" />
                <div class="asset-badges">
                  <span>{{ asset.format }}</span>
                  <span>{{ asset.categoryName }}</span>
                </div>
              </div>
              <div class="asset-card-body">
                <h2>{{ asset.title }}</h2>
                <p>{{ formatSize(asset.sizeMb, asset.format) }} · {{ asset.author }} · {{ formatRelativeTime(asset.createdAt) }}</p>
                <div class="asset-meta-row">
                  <span><Download class="h-3.5 w-3.5" />{{ asset.downloads }}</span>
                  <span><Heart class="h-3.5 w-3.5" />{{ asset.likes }}</span>
                  <button type="button" title="下载" @click.stop="handleDirectDownload(asset)">
                    <Download class="h-3.5 w-3.5" />
                  </button>
                  <button type="button" title="更多" @click.stop="showComingSoon('更多操作')">
                    <MoreHorizontal class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          </div>

          <footer v-if="pagination.totalPages > 1" class="asset-pagination">
            <button type="button" :disabled="pagination.page <= 1" @click="handlePageChange(pagination.page - 1)">
              <ChevronLeft class="h-4 w-4" />
            </button>
            <button
              v-for="page in pagination.totalPages"
              :key="page"
              type="button"
              :class="{ active: pagination.page === page }"
              class="page-number"
              @click="handlePageChange(page)"
            >
              {{ page }}
            </button>
            <button type="button" :disabled="pagination.page >= pagination.totalPages" @click="handlePageChange(pagination.page + 1)">
              <ChevronRight class="h-4 w-4" />
            </button>
            <select :value="pagination.limit" @change="handleLimitChange(Number(($event.target as HTMLSelectElement).value))">
              <option :value="20">20 条/页</option>
              <option :value="40">40 条/页</option>
              <option :value="50">50 条/页</option>
            </select>
          </footer>
        </div>
      </section>
    </main>

    <aside class="asset-aside">
      <section class="aside-panel">
        <div class="panel-title">
          <strong>最近动态</strong>
          <button type="button" @click="showComingSoon('动态中心')">查看更多</button>
        </div>
        <div class="activity-list">
          <div v-for="activityItem in latestActivities" :key="activityItem.id" class="activity-item">
            <img v-if="activityItem.avatar" :src="activityItem.avatar" :alt="activityItem.name" />
            <div v-else class="avatar-fallback">{{ activityItem.name.slice(0, 1) }}</div>
            <div>
              <p><strong>{{ activityItem.name }}</strong> {{ activityItem.action }}</p>
              <span>{{ activityItem.target }}</span>
              <small>{{ activityItem.time }}</small>
            </div>
          </div>
          <div v-if="latestActivities.length === 0" class="aside-empty">暂无动态</div>
        </div>
      </section>

      <section class="aside-panel">
        <div class="panel-title">
          <strong>{{ isAllTagsExpanded ? '所有标签' : '热门标签' }}</strong>
          <button v-if="tagsList.length > 9" type="button" @click="toggleAllTags">
            {{ isAllTagsExpanded ? '收起' : '全部标签' }}
          </button>
        </div>
        
        <div v-if="isAllTagsExpanded" class="tag-sidebar-search">
          <Search class="h-3.5 w-3.5 tag-search-icon" />
          <input v-model="tagSearchQuery" type="text" placeholder="搜索标签..." />
        </div>

        <div v-if="tagsList.length > 0" class="tag-cloud">
          <button v-for="tag in displayedSidebarTags" :key="tag.label" type="button" @click="handleTagClick(tag.label)">
            {{ tag.label }} <span>{{ tag.count }}</span>
          </button>
        </div>
        
        <div v-if="tagsList.length === 0" class="tag-empty-text">
          暂无标签
        </div>
        <div v-else-if="displayedSidebarTags.length === 0" class="tag-empty-text">
          未找到匹配的标签
        </div>
      </section>

      <section class="aside-panel">
        <div class="panel-title">
          <strong>存储空间</strong>
          <button type="button" @click="showComingSoon('空间详情')">详情</button>
        </div>
        <div class="storage-box">
          <div>
            <span>已使用</span>
            <strong>{{ formatSize(totalSizeMb) }} / 100 MB</strong>
            <small>{{ storagePercent }}%</small>
          </div>
          <div class="storage-track">
            <div :style="{ width: `${storagePercent}%` }"></div>
          </div>
        </div>
      </section>

      <section class="upgrade-panel">
        <div>
          <strong>升级存储空间</strong>
          <span>开启更高资产容量、团队共享与批量处理能力</span>
          <button type="button" @click="router.push({ name: 'Billing' })">立即升级</button>
        </div>
        <LayoutGrid class="h-16 w-16" />
      </section>
    </aside>
  </div>

    <Transition name="fade">
      <div v-if="isUploadDialogOpen" class="upload-modal">
        <button type="button" class="modal-backdrop" @click="isUploadDialogOpen = false"></button>
        <div class="upload-card-v2">
          <header class="upload-modal-header">
            <div>
              <span class="upload-eyebrow">Asset Submit</span>
              <h3>上传 3D 资产</h3>
              <p>提交后会进入管理员审核，通过后展示在资源库与我的作品中。</p>
            </div>
            <button type="button" class="upload-close" aria-label="关闭上传弹窗" @click="isUploadDialogOpen = false">
              <X class="w-5 h-5" />
            </button>
          </header>

          <div class="upload-type-switch" role="tablist" aria-label="选择上传方式">
            <button
              type="button"
              :class="{ active: uploadForm.uploadType === 'file' }"
              @click="uploadForm.uploadType = 'file'"
            >
              <Box class="w-4 h-4" />
              <span>本地文件</span>
            </button>
            <button
              type="button"
              :class="{ active: uploadForm.uploadType === 'link' }"
              @click="uploadForm.uploadType = 'link'"
            >
              <UploadCloud class="w-4 h-4" />
              <span>网盘/外链</span>
            </button>
          </div>

          <div class="upload-modal-grid">
            <section class="upload-panel upload-source-panel">
              <div class="upload-panel-title">
                <strong>上传来源</strong>
                <span>{{ uploadForm.uploadType === 'file' ? '支持常见 3D 格式' : '适合超大文件或网盘资源' }}</span>
              </div>

              <label v-if="uploadForm.uploadType === 'file'" class="upload-dropzone">
                <input
                  type="file"
                  accept=".glb,.gltf,.fbx,.obj,.stl,.dae,.3ds,.zip"
                  @change="handleFileChange"
                />
                <span class="upload-drop-icon"><Box class="w-6 h-6" /></span>
                <strong>{{ uploadForm.file ? uploadForm.file.name : '点击或拖拽模型文件到这里' }}</strong>
                <small>GLB、GLTF、FBX、OBJ、STL、DAE、3DS、ZIP</small>
              </label>

              <label v-else class="upload-field">
                <span>外链地址</span>
                <input
                  v-model="uploadForm.externalUrl"
                  type="url"
                  placeholder="粘贴网盘、对象存储或可下载链接"
                />
              </label>

              <div class="upload-form-stack">
                <label class="upload-field">
                  <span>资源名称</span>
                  <input v-model="uploadForm.title" type="text" placeholder="给你的作品起个清晰的名字" />
                </label>

                <div class="upload-two-col">
                  <label class="upload-field">
                    <span>资源分类</span>
                    <el-select v-model="uploadForm.categoryId" placeholder="选择分类" class="custom-select-v2">
                      <el-option
                        v-for="category in assetCategories"
                        :key="category.id"
                        :label="category.name"
                        :value="category.id"
                      />
                    </el-select>
                  </label>

                  <label class="upload-thumb-picker">
                    <span>封面图</span>
                    <input type="file" accept="image/*" @change="handleThumbnailChange" />
                    <strong>{{ uploadForm.thumbnail ? uploadForm.thumbnail.name : '上传封面' }}</strong>
                  </label>
                </div>

                <label class="upload-field">
                  <span>自定义标签</span>
                  <input v-model="uploadForm.tags" type="text" placeholder="用逗号或空格分隔，例如：科幻, 载具, PBR" />
                </label>

                <div v-if="isZipFile" class="upload-zip-formats">
                  <span>ZIP 包内格式</span>
                  <div>
                    <label v-for="format in availableFormats" :key="format">
                      <input v-model="uploadForm.formats" type="checkbox" :value="format" />
                      <small>{{ format }}</small>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section class="upload-panel upload-description-panel">
              <div class="upload-panel-title">
                <strong>资源描述</strong>
                <span>建议说明网格质量、UV、贴图通道、授权和使用注意事项。</span>
              </div>
              <MarkdownEditor
                v-model="uploadForm.description"
                placeholder="简单介绍这个模型，说明其网格质量、UV、贴图通道及使用注意事项..."
                :height="isMobile ? '280px' : '360px'"
                simple
              />
            </section>
          </div>

          <footer class="upload-modal-footer">
            <div class="upload-review-note">
              <strong>审核提示</strong>
              <span>发布或重新修改资源后，都需要管理员审核后才会公开展示。</span>
            </div>
            <button type="button" class="upload-submit-v2" :disabled="!canSubmitUpload" @click="handleUpload">
              <div v-if="isUploading" class="button-spinner"></div>
              {{ isUploading ? '正在上传...' : '提交审核' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- Modal tags dialog removed -->
  </div>
</template>

<style scoped>
.asset-library-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--bg-app);
  color: var(--text-primary);
}

.asset-header-bar {
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

.asset-page-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 232px;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 12px;
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

.asset-main,
.asset-aside {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}

.asset-breadcrumb,
.breadcrumb-current,
.header-actions,
.ghost-action,
.primary-action,
.asset-title-row,
.asset-toolbar,
.filter-strip,
.view-switch,
.sidebar-title,
.panel-title,
.asset-meta-row,
.asset-pagination {
  display: flex;
  align-items: center;
}

.asset-breadcrumb {
  gap: 6px;
  color: #7c89a6;
  font-size: 11px;
  font-weight: 700;
}

.breadcrumb-current {
  gap: 4px;
  color: #5b5ff4;
  border: 0;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.asset-title-row {
  gap: 6px;
  margin-top: 6px;
}

.asset-title-row h1 {
  margin: 0;
  font-size: 20px;
  line-height: 1.15;
  letter-spacing: 0;
  color: #14213d;
}

.asset-header p {
  margin: 4px 0 0;
  color: #64708b;
  font-size: 12px;
}

.header-actions {
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.ghost-action,
.primary-action {
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
}

.ghost-action {
  border: 1px solid #e4e8f3;
  background: #ffffff;
  color: #33415f;
}

.primary-action {
  border: 0;
  background: #635bff;
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(99, 91, 255, 0.22);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.stat-card {
  position: relative;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 72px;
  gap: 10px;
  align-items: center;
  min-height: 68px;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-card);
  padding: 10px 12px;
  box-shadow: var(--card-shadow);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
              border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.stat-card:hover {
  transform: translateY(-3px);
  border-color: transparent;
}

.stat-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  transition: transform 0.3s ease;
}

.stat-card:hover .stat-icon {
  transform: scale(1.08);
}

.stat-card[data-tone='indigo'] .stat-icon {
  color: #635bff;
  background: rgba(99, 91, 255, 0.12);
}
.stat-card[data-tone='indigo']:hover {
  box-shadow: var(--card-shadow-hover), 0 10px 24px rgba(99, 91, 255, 0.15), 0 0 0 1px rgba(99, 91, 255, 0.2);
}
.stat-card[data-tone='indigo'] .stat-spark polyline {
  stroke: #635bff;
}

.stat-card[data-tone='emerald'] .stat-icon {
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
}
.stat-card[data-tone='emerald']:hover {
  box-shadow: var(--card-shadow-hover), 0 10px 24px rgba(16, 185, 129, 0.15), 0 0 0 1px rgba(16, 185, 129, 0.2);
}
.stat-card[data-tone='emerald'] .stat-spark polyline {
  stroke: #10b981;
}

.stat-card[data-tone='orange'] .stat-icon {
  color: #f5792a;
  background: rgba(245, 121, 42, 0.12);
}
.stat-card[data-tone='orange']:hover {
  box-shadow: var(--card-shadow-hover), 0 10px 24px rgba(245, 121, 42, 0.15), 0 0 0 1px rgba(245, 121, 42, 0.2);
}
.stat-card[data-tone='orange'] .stat-spark polyline {
  stroke: #f5792a;
}

.stat-card[data-tone='sky'] .stat-icon {
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.12);
}
.stat-card[data-tone='sky']:hover {
  box-shadow: var(--card-shadow-hover), 0 10px 24px rgba(14, 165, 233, 0.15), 0 0 0 1px rgba(14, 165, 233, 0.2);
}
.stat-card[data-tone='sky'] .stat-spark polyline {
  stroke: #0ea5e9;
}

.stat-content span {
  display: block;
  color: var(--text-muted);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.stat-content strong {
  display: block;
  margin: 0px 0 2px;
  color: var(--text-primary);
  font-size: 21px;
  font-weight: 800;
  font-family: var(--font-sans);
  line-height: 1.1;
}

.stat-content small {
  display: block;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.stat-spark {
  width: 72px;
  height: 32px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.05));
  transition: filter 0.3s ease;
}

.stat-card:hover .stat-spark {
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
}

.stat-spark polyline {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.asset-toolbar {
  gap: 12px;
  margin-bottom: 12px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 260px;
  flex: 1;
  height: 40px;
  padding: 0 12px;
  border: 1px solid #e3e8f3;
  border-radius: 8px;
  background: #ffffff;
  color: #8a96ad;
}

.search-box input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1e2a44;
  font-size: 13px;
}

.filter-strip {
  gap: 8px;
  flex-wrap: wrap;
}

.filter-strip select,
.asset-pagination select,
.upload-form select {
  height: 40px;
  min-width: 110px;
  border: 1px solid #e3e8f3;
  border-radius: 8px;
  background: #ffffff;
  color: #33415f;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
  outline: 0;
}

.view-switch {
  gap: 6px;
}

.view-switch button,
.asset-meta-row button,
.asset-pagination button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid #e3e8f3;
  border-radius: 8px;
  background: #ffffff;
  color: #65718b;
  cursor: pointer;
}

.view-switch button.active,
.asset-pagination button.active {
  border-color: #635bff;
  background: #635bff;
  color: #ffffff;
}

.mobile-filter {
  display: none !important;
}

.content-shell {
  display: grid;
  grid-template-columns: 184px minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.filter-sidebar,
.aside-panel,
.upgrade-panel {
  border: 1px solid #e7ebf5;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 22px rgba(25, 38, 72, 0.04);
}

.filter-sidebar {
  align-self: start;
  padding: 12px;
}

.sidebar-title {
  justify-content: space-between;
  gap: 8px;
  color: #13223d;
  font-size: 13px;
  font-weight: 900;
  margin-bottom: 12px;
}

.sidebar-title button,
.panel-title button {
  border: 0;
  background: transparent;
  color: #635bff;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.filter-group {
  padding: 8px 0;
  border-top: 1px solid var(--border-base);
}

.filter-group h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.filter-group h3:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.collapse-icon {
  color: var(--text-muted);
  transition: transform 0.2s ease;
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

.filter-content {
  margin-top: 6px;
  display: grid;
  gap: 2px;
}

.filter-group button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #65718b;
  padding: 0 8px;
  font-size: 12px;
  cursor: pointer;
}

.filter-group button.active {
  background: #f0efff;
  color: #5b55df;
  font-weight: 900;
}

.asset-results {
  min-width: 0;
}

.asset-grid.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}

.asset-grid.list {
  display: grid;
  gap: 10px;
}

.asset-card {
  overflow: hidden;
  border: 1px solid #e7ebf5;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 22px rgba(25, 38, 72, 0.04);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.asset-card:hover {
  transform: translateY(-2px);
  border-color: #cfd6ff;
  box-shadow: 0 16px 30px rgba(25, 38, 72, 0.1);
}

.asset-grid.list .asset-card {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
}

.asset-preview {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #172339;
}

.asset-grid.list .asset-preview {
  aspect-ratio: auto;
  min-height: 128px;
}

.asset-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.28s ease;
}

.asset-card:hover .asset-preview img {
  transform: scale(1.04);
}

.asset-badges {
  position: absolute;
  top: 8px;
  left: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.asset-badges span {
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  background: rgba(32, 41, 61, 0.72);
  color: #ffffff;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 900;
}

.asset-card-body {
  padding: 12px;
}

.asset-card-body h2 {
  margin: 0 0 6px;
  color: #182642;
  font-size: 14px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-card-body p {
  margin: 0 0 12px;
  color: #6c7892;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-meta-row {
  gap: 12px;
  color: #64708b;
  font-size: 12px;
}

.asset-meta-row span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.asset-meta-row button {
  width: 28px;
  height: 28px;
  margin-left: auto;
}

.asset-meta-row button + button {
  margin-left: -6px;
}

.asset-pagination {
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
}

.asset-pagination button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.page-number:nth-of-type(n + 9) {
  display: none;
}

.loading-state,
.empty-state {
  min-height: 340px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: #79859d;
}

.loading-spinner,
.button-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #dbe1ef;
  border-top-color: #635bff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.asset-aside {
  display: grid;
  gap: 14px;
  align-content: start;
}

.aside-panel {
  padding: 14px;
}

.panel-title {
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title strong {
  color: #13223d;
  font-size: 13px;
}

.activity-list {
  display: grid;
  gap: 12px;
}

.activity-item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr);
  gap: 10px;
}

.activity-item img,
.avatar-fallback {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.avatar-fallback {
  display: grid;
  place-items: center;
  background: #15213a;
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
}

.activity-item p,
.activity-item span,
.activity-item small {
  display: block;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-item p {
  color: #33415f;
  font-size: 12px;
}

.activity-item span {
  color: #635bff;
  font-size: 11px;
  font-weight: 800;
}

.activity-item small,
.aside-empty {
  color: #8a96ad;
  font-size: 11px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.tag-cloud button {
  border: 1px solid #edf0f7;
  border-radius: 6px;
  background: #f8faff;
  color: #51607c;
  padding: 6px 8px;
  font-size: 11px;
  cursor: pointer;
}

.tag-cloud span {
  color: #8a96ad;
}

.tag-sidebar-search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  margin-bottom: 10px;
  border: 1px solid var(--border-base, #e3e8f3);
  border-radius: 6px;
  background: var(--bg-card, #ffffff);
}

.tag-sidebar-search input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary, #1e2a44);
  font-size: 11px;
}

.tag-search-icon {
  color: var(--text-muted, #8a96ad);
  flex-shrink: 0;
}

.tag-empty-text {
  color: var(--text-muted, #8a96ad);
  font-size: 11px;
  text-align: center;
  padding: 10px 0;
}

.storage-box span,
.storage-box small,
.upgrade-panel span {
  display: block;
  color: #7c89a6;
  font-size: 12px;
}

.storage-box strong {
  display: block;
  margin: 5px 0;
  color: #1f2d49;
  font-size: 13px;
}

.storage-track {
  height: 8px;
  margin-top: 10px;
  border-radius: 999px;
  background: #edf0f8;
  overflow: hidden;
}

.storage-track div {
  height: 100%;
  border-radius: inherit;
  background: #635bff;
}

.upgrade-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 58px;
  gap: 10px;
  padding: 16px;
  background: #f0efff;
  color: #5b55df;
}

.upgrade-panel strong {
  display: block;
  color: #382fa8;
  font-size: 13px;
  margin-bottom: 5px;
}

.upgrade-panel button {
  margin-top: 12px;
  height: 32px;
  border: 0;
  border-radius: 7px;
  background: #635bff;
  color: #ffffff;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.mobile-filter-panel {
  display: none;
}

.upload-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 18px;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(5px);
}

.upload-card-v2 {
  position: relative;
  z-index: 1;
  width: min(1040px, 96vw);
  max-height: min(92vh, 760px);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  border-radius: 12px;
  background-color: var(--bg-card);
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
  border: 1px solid var(--border-strong, var(--border-base));
}

.upload-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px 16px;
  border-bottom: 1px solid var(--border-base);
  background: linear-gradient(180deg, rgba(248, 250, 255, 0.96), rgba(255, 255, 255, 0.96));
}

.upload-eyebrow {
  display: block;
  margin-bottom: 5px;
  color: #635bff;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.upload-modal-header h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
  line-height: 1.15;
  letter-spacing: 0;
}

.upload-modal-header p {
  margin: 7px 0 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.upload-close {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.upload-close:hover {
  border-color: #635bff;
  color: #635bff;
  transform: translateY(-1px);
}

.upload-type-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border-base);
  background: #fbfcff;
}

.upload-type-switch button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.upload-type-switch button.active {
  background: #635bff;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(99, 91, 255, 0.22);
}

.upload-modal-grid {
  display: grid;
  grid-template-columns: minmax(320px, 0.92fr) minmax(0, 1.18fr);
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px;
  background: var(--bg-app);
}

.upload-panel {
  min-width: 0;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-card);
  padding: 16px;
}

.upload-source-panel,
.upload-description-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.upload-panel-title {
  display: grid;
  gap: 4px;
}

.upload-panel-title strong,
.upload-field span,
.upload-thumb-picker span,
.upload-zip-formats > span {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 900;
}

.upload-panel-title span {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.upload-dropzone {
  position: relative;
  display: grid;
  place-items: center;
  gap: 7px;
  min-height: 150px;
  padding: 18px;
  border: 1.5px dashed #cfd6e8;
  border-radius: 10px;
  background: #f8faff;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.upload-dropzone:hover {
  border-color: #635bff;
  background: #f4f3ff;
  transform: translateY(-1px);
}

.upload-dropzone input,
.upload-thumb-picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-drop-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(99, 91, 255, 0.1);
  color: #635bff;
}

.upload-dropzone strong {
  max-width: 100%;
  color: var(--text-primary);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-dropzone small {
  color: var(--text-muted);
  font-size: 11px;
}

.upload-form-stack {
  display: grid;
  gap: 13px;
}

.upload-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.upload-field input {
  width: 100%;
  height: 42px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-primary);
  padding: 0 12px;
  font-size: 13px;
  outline: 0;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.upload-field input:focus {
  border-color: #635bff;
  box-shadow: 0 0 0 3px rgba(99, 91, 255, 0.12);
}

.upload-two-col {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  gap: 12px;
}

.upload-thumb-picker {
  position: relative;
  display: grid;
  gap: 8px;
  min-width: 0;
}

.upload-thumb-picker strong {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 42px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: #ffffff;
  color: var(--text-secondary);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-thumb-picker:hover strong {
  border-color: #635bff;
  color: #635bff;
}

.upload-zip-formats {
  display: grid;
  gap: 9px;
}

.upload-zip-formats > div {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: #fbfcff;
}

.upload-zip-formats label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.upload-zip-formats small {
  font-size: 11px;
  font-weight: 800;
}

.custom-select-v2 :deep(.el-input__wrapper) {
  border-radius: 8px !important;
  background-color: #ffffff !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 42px;
}

.upload-description-panel :deep(.markdown-editor) {
  min-width: 0;
}

.upload-modal-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 16px;
  align-items: center;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--border-base);
  background: #ffffff;
}

.upload-review-note {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.upload-review-note strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 900;
}

.upload-review-note span {
  color: var(--text-secondary);
  font-size: 12px;
}

.upload-submit-v2 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: #635bff;
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 14px 28px rgba(99, 91, 255, 0.24);
  transition: opacity 0.18s ease, transform 0.18s ease, background 0.18s ease;
}

.upload-submit-v2:hover:not(:disabled) {
  background: #5148f0;
  transform: translateY(-1px);
}

.upload-submit-v2:disabled {
  opacity: 0.48;
  cursor: not-allowed;
  box-shadow: none;
}

.upload-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px;
  border-bottom: 1px solid #edf0f7;
}

.upload-card h2 {
  margin: 0;
  color: #13223d;
  font-size: 18px;
}

.upload-card header button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e3e8f3;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
}

.upload-form {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.upload-form label,
.format-checks {
  display: grid;
  gap: 7px;
}

.upload-form span,
.format-checks > span {
  color: #52607b;
  font-size: 12px;
  font-weight: 900;
}

.upload-form input,
.upload-form textarea {
  width: 100%;
  border: 1px solid #e3e8f3;
  border-radius: 8px;
  background: #ffffff;
  color: #1e2a44;
  padding: 10px 12px;
  outline: 0;
  font-size: 13px;
  resize: vertical;
}

.upload-tabs {
  display: flex;
  gap: 8px;
}

.upload-tabs button {
  height: 34px;
  border: 1px solid #e3e8f3;
  border-radius: 8px;
  background: #ffffff;
  color: #56637d;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.upload-tabs button.active {
  border-color: #635bff;
  background: #635bff;
  color: #ffffff;
}

.drop-zone {
  position: relative;
  place-items: center;
  min-height: 118px;
  border: 1px dashed #cfd6e8;
  border-radius: 8px;
  background: #f8faff;
  color: #64708b;
  text-align: center;
  padding: 16px;
  cursor: pointer;
}

.drop-zone.compact {
  min-height: 78px;
}

.drop-zone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.drop-zone strong {
  color: #33415f;
  font-size: 13px;
}

.format-checks {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid #edf0f7;
  border-radius: 8px;
  padding: 12px;
}

.format-checks > span {
  grid-column: 1 / -1;
}

.format-checks label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #56637d;
  font-size: 12px;
}

.submit-upload {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: calc(100% - 36px);
  height: 42px;
  margin: 0 18px 18px;
  border: 0;
  border-radius: 8px;
  background: #635bff;
  color: #ffffff;
  font-weight: 900;
  cursor: pointer;
}

.submit-upload:disabled {
  opacity: 0.7;
  cursor: wait;
}

.button-spinner {
  width: 16px;
  height: 16px;
  border-width: 2px;
  border-color: rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
}

.fade-enter-active,
.fade-leave-active,
.slide-down-enter-active,
.slide-down-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-enter-from,
.fade-leave-to,
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .asset-page-body {
    grid-template-columns: 1fr;
  }

  .asset-aside {
    display: none;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .asset-library-page {
    overflow-y: auto;
  }

  .asset-page-body {
    display: flex;
    flex-direction: column;
    padding: 12px;
    height: auto;
    overflow: visible;
  }

  .asset-header-bar {
    flex-direction: column;
    align-items: stretch;
    height: auto;
    padding: 10px 12px;
    gap: 8px;
  }

  .asset-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .filter-strip,
  .filter-sidebar {
    display: none;
  }

  .mobile-filter {
    display: grid !important;
  }

  .content-shell {
    grid-template-columns: 1fr;
  }

  .mobile-filter-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
    padding: 10px;
    border: 1px solid #e7ebf5;
    border-radius: 8px;
    background: #ffffff;
  }

  .mobile-filter-panel button {
    border: 1px solid #e7ebf5;
    border-radius: 999px;
    background: #ffffff;
    color: #51607c;
    padding: 7px 10px;
    font-size: 12px;
  }

  .mobile-filter-panel button.active {
    border-color: #635bff;
    background: #f0efff;
    color: #5b55df;
  }

  .upload-modal {
    align-items: end;
    padding: 10px;
  }

  .upload-card-v2 {
    width: 100%;
    max-height: 94vh;
    border-radius: 12px;
  }

  .upload-modal-header,
  .upload-type-switch,
  .upload-modal-grid,
  .upload-modal-footer {
    padding-left: 16px;
    padding-right: 16px;
  }

  .upload-modal-grid {
    grid-template-columns: 1fr;
  }

  .upload-modal-footer {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stat-card {
    grid-template-columns: 36px minmax(0, 1fr);
  }

  .stat-spark {
    display: none;
  }

  .asset-grid.grid {
    grid-template-columns: 1fr;
  }

  .asset-grid.list .asset-card {
    grid-template-columns: 1fr;
  }

  .asset-pagination {
    flex-wrap: wrap;
  }

  .upload-modal-header {
    padding-top: 16px;
  }

  .upload-modal-header h3 {
    font-size: 19px;
  }

  .upload-type-switch {
    grid-template-columns: 1fr;
  }

  .upload-two-col,
  .upload-zip-formats > div {
    grid-template-columns: 1fr;
  }

  .upload-dropzone {
    min-height: 130px;
  }
}
</style>
