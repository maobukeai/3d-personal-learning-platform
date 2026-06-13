<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Activity,
  ArrowDownToLine,
  BarChart3,
  Box,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileArchive,
  Grid3X3,
  Heart,
  Layers,
  LayoutList,
  Loader2,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tags,
  UploadCloud,
  UsersRound,
  X,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import type { Category } from '@/types';
import {
  ASSET_UPLOAD_FORMAT_OPTIONS,
  buildActiveAssetFilterChips,
  buildAssetCategoryOptions,
  buildAssetFormatOptions,
  buildAssetUploadFormData,
  createAssetUploadForm,
  filterVisibleAssets,
  isAssetUploadReady,
  type AssetInsights,
  type AssetInsightCategory,
  type AssetListItem,
  type AssetSortKey as SortKey,
  type AssetViewMode as ViewMode,
} from './assetLibraryModel';
import {
  formatCompactNumber,
  formatFileSize,
  formatRelativeTime,
  resolvePreviewUrl,
} from './resourceUtils';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

const router = useRouter();
const { locale } = useI18n();
const label = (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);
const searchQuery = ref('');
const isStatsExpanded = ref(false);
const activeCategoryId = ref('all');
const selectedFormat = ref('all');
const selectedTag = ref('all');
const sortKey = ref<SortKey>('latest');
const viewMode = ref<ViewMode>('grid');
const isFilterOpen = ref(false);
const isLoading = ref(false);
const isUploading = ref(false);
const isUploadDialogOpen = ref(false);
const assets = ref<AssetListItem[]>([]);
const categories = ref<AssetInsightCategory[]>([]);
const insights = ref<AssetInsights | null>(null);
const searchTimer = ref<number | undefined>();

const pagination = ref({
  total: 0,
  page: 1,
  limit: 24,
  totalPages: 0,
});

const uploadForm = ref(createAssetUploadForm());
const uploadFormatOptions = ASSET_UPLOAD_FORMAT_OPTIONS;

const categoryOptions = computed(() =>
  buildAssetCategoryOptions(
    categories.value,
    insights.value,
    pagination.value.total,
    label('全部资源', 'All Assets'),
  ),
);

const formatOptions = computed(() => buildAssetFormatOptions(insights.value));

const statCards = computed(() => [
  {
    label: label('资源总量', 'Total Assets'),
    value: insights.value?.summary.total || pagination.value.total,
    meta: label(
      `${formatCompactNumber(insights.value?.summary.downloads)} 次下载`,
      `${formatCompactNumber(insights.value?.summary.downloads)} downloads`,
    ),
    icon: Box,
    tone: 'blue',
  },
  {
    label: label('团队贡献', 'Team Contributions'),
    value: insights.value?.summary.myUploads || 0,
    meta: label(`${insights.value?.summary.pending || 0} 个待审核`, `${insights.value?.summary.pending || 0} pending`),
    icon: UsersRound,
    tone: 'green',
  },
  {
    label: label('可动画模型', 'Animated Models'),
    value: insights.value?.summary.animated || 0,
    meta: label(`${insights.value?.summary.optimized || 0} 个轻量网格`, `${insights.value?.summary.optimized || 0} optimized`),
    icon: Activity,
    tone: 'orange',
  },
  {
    label: label('平均体积', 'Average Size'),
    value: formatFileSize(insights.value?.summary.averageSize || 0, '0 MB'),
    meta: label(
      `累计 ${formatFileSize(insights.value?.summary.totalSize || 0, '0 MB')}`,
      `Total ${formatFileSize(insights.value?.summary.totalSize || 0, '0 MB')}`,
    ),
    icon: FileArchive,
    tone: 'teal',
  },
]);

const visibleAssets = computed(() => {
  return filterVisibleAssets(
    assets.value,
    {
      selectedFormat: selectedFormat.value,
      selectedTag: selectedTag.value,
    },
    {
      creatorLabel: label('创作者', 'Creator'),
      uncategorizedLabel: label('未分类', 'Uncategorized'),
    },
  );
});

const activeFilterChips = computed(() => {
  return buildActiveAssetFilterChips({
    activeCategoryId: activeCategoryId.value,
    categoryOptions: categoryOptions.value,
    currentCategoryLabel: label('当前分类', 'Current Category'),
    selectedFormat: selectedFormat.value,
    selectedTag: selectedTag.value,
    searchQuery: searchQuery.value,
  });
});

const uploadCanSubmit = computed(() => isAssetUploadReady(uploadForm.value));

watch([activeCategoryId, sortKey], () => {
  pagination.value.page = 1;
  fetchAssets();
});

watch(searchQuery, () => {
  if (searchTimer.value) window.clearTimeout(searchTimer.value);
  searchTimer.value = window.setTimeout(() => {
    pagination.value.page = 1;
    fetchAssets();
  }, 320);
});

const fetchAssets = async () => {
  isLoading.value = true;
  try {
    const { data } = await api.get('/api/assets/public', {
      params: {
        page: pagination.value.page,
        limit: pagination.value.limit,
        search: searchQuery.value.trim() || undefined,
        categoryId: activeCategoryId.value,
        sort: sortKey.value,
      },
    });
    assets.value = data.assets || [];
    pagination.value = data.pagination || pagination.value;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('资源列表加载失败', 'Failed to load assets')));
  } finally {
    isLoading.value = false;
  }
};

const fetchInsights = async () => {
  try {
    const { data } = await api.get('/api/assets/insights');
    insights.value = data;
    categories.value = data.categories || [];
  } catch (error) {
    console.error('Failed to fetch asset insights:', error);
  }
};

const fetchCategories = async () => {
  try {
    const { data } = await api.get('/api/assets/categories');
    const mapped = (data || []).map((category: Category) => ({
      id: category.id,
      name: category.name,
      count: category._count?.assets || 0,
    }));
    if (!categories.value.length) categories.value = mapped;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
  }
};

const handlePageChange = (page: number) => {
  if (page < 1 || page > pagination.value.totalPages) return;
  pagination.value.page = page;
  fetchAssets();
};

const clearFilter = (key: string) => {
  if (key === 'category') activeCategoryId.value = 'all';
  if (key === 'format') selectedFormat.value = 'all';
  if (key === 'tag') selectedTag.value = 'all';
  if (key === 'search') searchQuery.value = '';
};

const resetFilters = () => {
  activeCategoryId.value = 'all';
  selectedFormat.value = 'all';
  selectedTag.value = 'all';
  searchQuery.value = '';
};

const goToDetail = (asset: AssetListItem) => {
  router.push({ name: 'AssetDetail', params: { id: asset.id } });
};

const handleDownload = async (asset: AssetListItem, event?: Event) => {
  event?.stopPropagation();
  if (!asset.url) return;
  try {
    const { data } = await api.post(`/api/assets/${asset.id}/download`);
    asset.downloads = data.downloads;
  } catch (error) {
    console.error('Failed to record asset download:', error);
  }
  window.open(getAssetUrl(asset.url), '_blank', 'noopener,noreferrer');
};

const handleLike = async (asset: AssetListItem, event?: Event) => {
  event?.stopPropagation();
  try {
    const { data } = await api.post(`/api/assets/${asset.id}/like`);
    asset.likes = data.likes;
    ElMessage.success(data.liked ? label('已收藏到喜欢列表', 'Added to favorites') : label('已取消喜欢', 'Removed from favorites'));
    fetchInsights();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('操作失败', 'Operation failed')));
  }
};

const handleFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploadForm.value.file = file;
  if (!uploadForm.value.title.trim()) {
    uploadForm.value.title = file.name.replace(/\.[^.]+$/, '');
  }
};

const handleThumbnailChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) uploadForm.value.thumbnail = file;
};

const resetUploadForm = () => {
  uploadForm.value = createAssetUploadForm();
};

const submitUpload = async () => {
  if (!uploadCanSubmit.value) {
    ElMessage.warning(label('请补全资源名称、分类和文件来源', 'Please complete asset name, category, and source'));
    return;
  }

  const formData = buildAssetUploadFormData(uploadForm.value);

  try {
    isUploading.value = true;
    await api.post('/api/assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success(label('资源已提交审核', 'Asset submitted for review'));
    isUploadDialogOpen.value = false;
    resetUploadForm();
    await Promise.all([fetchAssets(), fetchInsights(), fetchCategories()]);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('上传失败', 'Upload failed')));
  } finally {
    isUploading.value = false;
  }
};

onMounted(() => {
  fetchAssets();
  fetchInsights();
  fetchCategories();
});

onUnmounted(() => {
  if (searchTimer.value) window.clearTimeout(searchTimer.value);
});
</script>

<template>
  <div class="asset-library-page">
    <header class="page-header">
      <div class="title-block">
        <div class="title-icon">
          <Box class="icon-md" />
        </div>
        <div>
          <h1>{{ label('资源库', 'Asset Library') }}</h1>
          <p>{{ label('模型、工程文件、贴图包与外链资产统一分发。', 'Distribute models, project files, texture packs, and external assets in one place.') }}</p>
        </div>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="ghost-button"
          @click="isStatsExpanded = !isStatsExpanded"
        >
          <component :is="isStatsExpanded ? EyeOff : Eye" class="icon-sm" />
          {{ isStatsExpanded ? label('收起指标', 'Hide Stats') : label('数据指标', 'Show Stats') }}
        </button>
        <button type="button" class="ghost-button" @click="fetchInsights">
          <BarChart3 class="icon-sm" />
          {{ label('更新统计', 'Refresh Stats') }}
        </button>
        <button type="button" class="primary-button" @click="isUploadDialogOpen = true">
          <UploadCloud class="icon-sm" />
          {{ label('上传资源', 'Upload Asset') }}
        </button>
      </div>
    </header>

    <section v-show="isStatsExpanded" class="stats-grid">
      <article v-for="stat in statCards" :key="stat.label" class="stat-card" :data-tone="stat.tone">
        <div class="stat-icon">
          <component :is="stat.icon" class="icon-sm" />
        </div>
        <div>
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
          <small>{{ stat.meta }}</small>
        </div>
      </article>
    </section>

    <section class="workspace-shell">
      <aside class="filter-panel" :class="{ open: isFilterOpen }">
        <div class="panel-section">
          <div class="section-title">
            <Layers class="icon-sm" />
            {{ label('分类', 'Categories') }}
          </div>
          <button
            v-for="category in categoryOptions"
            :key="category.id"
            type="button"
            class="filter-button"
            :class="{ active: activeCategoryId === category.id }"
            @click="activeCategoryId = category.id"
          >
            <span>{{ category.name }}</span>
            <strong>{{ category.count }}</strong>
          </button>
        </div>

        <div class="panel-section">
          <div class="section-title">
            <PackageCheck class="icon-sm" />
            {{ label('格式', 'Formats') }}
          </div>
          <button
            v-for="format in formatOptions"
            :key="format.label"
            type="button"
            class="filter-button"
            :class="{ active: selectedFormat === format.label }"
            @click="selectedFormat = format.label"
          >
            <span>{{ format.label === 'all' ? label('全部格式', 'All Formats') : format.label }}</span>
            <strong>{{ format.count }}</strong>
          </button>
        </div>

        <div class="panel-section">
          <div class="section-title">
            <Tags class="icon-sm" />
            {{ label('热标签', 'Hot Tags') }}
          </div>
          <div class="tag-cloud">
            <button
              type="button"
              :class="{ active: selectedTag === 'all' }"
              @click="selectedTag = 'all'"
            >
              {{ label('全部', 'All') }}
            </button>
            <button
              v-for="tag in insights?.hotTags || []"
              :key="tag.label"
              type="button"
              :class="{ active: selectedTag === tag.label }"
              @click="selectedTag = tag.label"
            >
              {{ tag.label }}
            </button>
          </div>
        </div>
      </aside>

      <main class="content-panel">
        <section class="toolbar">
          <label class="search-box">
            <Search class="icon-sm" />
            <input v-model="searchQuery" type="search" :placeholder="label('搜索资源名称、标签、作者或描述', 'Search names, tags, authors, or descriptions')" />
          </label>

          <div class="toolbar-actions">
            <button type="button" class="icon-button mobile-filter" @click="isFilterOpen = !isFilterOpen">
              <SlidersHorizontal class="icon-sm" />
            </button>
            <select v-model="sortKey" class="select-field">
              <option value="latest">{{ label('最新发布', 'Newest') }}</option>
              <option value="popular">{{ label('下载最多', 'Most Downloaded') }}</option>
              <option value="views">{{ label('浏览最多', 'Most Viewed') }}</option>
              <option value="size">{{ label('体积最大', 'Largest') }}</option>
              <option value="oldest">{{ label('最早发布', 'Oldest') }}</option>
            </select>
            <div class="view-switch">
              <button type="button" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'">
                <Grid3X3 class="icon-sm" />
              </button>
              <button type="button" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">
                <LayoutList class="icon-sm" />
              </button>
            </div>
          </div>
        </section>

        <section class="asset-filter-strip">
          <div>
            <strong>{{ visibleAssets.length }}</strong>
            <span>/ {{ pagination.total || visibleAssets.length }} {{ label('个资源', 'assets') }}</span>
          </div>
          <div class="asset-chip-row">
            <button
              v-for="chip in activeFilterChips"
              :key="chip.key"
              type="button"
              @click="clearFilter(chip.key)"
            >
              {{ chip.label }}
              <X class="icon-xs" />
            </button>
            <button v-if="activeFilterChips.length" type="button" class="reset-chip" @click="resetFilters">
              {{ label('清空筛选', 'Clear Filters') }}
            </button>
            <span v-else>{{ label('当前显示全部公开资源', 'Showing all public assets') }}</span>
          </div>
        </section>

        <div v-if="isLoading" class="asset-grid" :class="viewMode">
          <article v-for="index in 8" :key="index" class="asset-card skeleton-card">
            <div class="skeleton preview"></div>
            <div class="skeleton line wide"></div>
            <div class="skeleton line"></div>
          </article>
        </div>

        <div v-else-if="visibleAssets.length" class="asset-grid" :class="viewMode">
          <article
            v-for="asset in visibleAssets"
            :key="asset.id"
            class="asset-card"
            @click="goToDetail(asset)"
          >
            <div class="asset-preview">
              <img :src="asset.preview" :alt="asset.title" />
              <div class="badge-row">
                <span>{{ asset.format }}</span>
                <span v-if="asset.hasAnimations">{{ label('动画', 'Animated') }}</span>
              </div>
            </div>

            <div class="asset-body">
              <div class="card-title">
                <div>
                  <h2>{{ asset.title }}</h2>
                  <p>{{ asset.description || label('作者暂未填写资源说明。', 'No asset description yet.') }}</p>
                </div>
                <button type="button" class="icon-button" @click="handleLike(asset, $event)">
                  <Heart class="icon-sm" />
                </button>
              </div>

              <div class="asset-meta">
                <span>{{ asset.categoryName }}</span>
                <span>{{ formatFileSize(asset.sizeMb) }}</span>
                <span>{{ formatRelativeTime(asset.createdAt) }}</span>
              </div>

              <div class="tag-row">
                <span v-for="tag in asset.tags.slice(0, 4)" :key="tag">#{{ tag }}</span>
              </div>

              <footer class="card-footer">
                <div class="metric-row">
                  <span><ArrowDownToLine class="icon-xs" />{{ formatCompactNumber(asset.downloads) }}</span>
                  <span><Eye class="icon-xs" />{{ formatCompactNumber(asset.views) }}</span>
                  <span><Heart class="icon-xs" />{{ formatCompactNumber(asset.likes) }}</span>
                </div>
                <button type="button" class="download-button" @click="handleDownload(asset, $event)">
                  <ArrowDownToLine class="icon-sm" />
                  {{ label('下载', 'Download') }}
                </button>
              </footer>
            </div>
          </article>
        </div>

        <div v-else class="empty-state">
          <Sparkles class="empty-icon" />
          <h2>{{ label('没有匹配的资源', 'No Matching Assets') }}</h2>
          <p>{{ label('调整筛选条件，或上传一个新的资源包。', 'Adjust filters or upload a new asset package.') }}</p>
          <button type="button" class="primary-button" @click="isUploadDialogOpen = true">
            <UploadCloud class="icon-sm" />
            {{ label('上传资源', 'Upload Asset') }}
          </button>
        </div>

        <footer v-if="pagination.totalPages > 1" class="pagination">
          <button type="button" :disabled="pagination.page <= 1" @click="handlePageChange(pagination.page - 1)">
            <ChevronLeft class="icon-sm" />
          </button>
          <span>{{ label('第', 'Page') }} {{ pagination.page }} / {{ pagination.totalPages }} {{ label('页', '') }}</span>
          <button
            type="button"
            :disabled="pagination.page >= pagination.totalPages"
            @click="handlePageChange(pagination.page + 1)"
          >
            <ChevronRight class="icon-sm" />
          </button>
        </footer>
      </main>

      <aside class="insight-panel">
        <section class="side-section">
          <div class="section-title">
            <ArrowDownToLine class="icon-sm" />
            {{ label('下载榜', 'Top Downloads') }}
          </div>
          <button
            v-for="(asset, index) in insights?.topDownloads || []"
            :key="asset.id"
            type="button"
            class="rank-item"
            @click="goToDetail(asset)"
          >
            <span class="rank-badge" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
            <img :src="resolvePreviewUrl(asset.thumbnail, asset.type)" :alt="asset.title" />
            <span class="rank-title">{{ asset.title }}</span>
            <strong class="rank-value">{{ formatCompactNumber(asset.downloads) }}</strong>
          </button>
        </section>

        <section class="side-section">
          <div class="section-title">
            <CalendarClock class="icon-sm" />
            {{ label('最近更新', 'Recently Updated') }}
          </div>
          <button
            v-for="asset in insights?.latest || []"
            :key="asset.id"
            type="button"
            class="activity-item"
            @click="goToDetail(asset)"
          >
            <span>{{ asset.title }}</span>
            <small>{{ formatRelativeTime(asset.createdAt) }}</small>
          </button>
        </section>
      </aside>
    </section>

    <Transition name="fade">
      <div v-if="isUploadDialogOpen" class="modal-layer">
        <button type="button" class="modal-backdrop" @click="isUploadDialogOpen = false"></button>
        <section class="upload-dialog">
          <header>
            <div>
              <h2>{{ label('上传资源', 'Upload Asset') }}</h2>
              <p>{{ label('提交后进入审核，通过后展示在资源库。', 'Submissions go through review before appearing in the library.') }}</p>
            </div>
            <button type="button" class="icon-button" @click="isUploadDialogOpen = false">
              <X class="icon-sm" />
            </button>
          </header>

          <div class="upload-type-switch">
            <button
              type="button"
              :class="{ active: uploadForm.uploadType === 'file' }"
              @click="uploadForm.uploadType = 'file'"
            >
              <UploadCloud class="icon-sm" />
              {{ label('本地文件', 'Local File') }}
            </button>
            <button
              type="button"
              :class="{ active: uploadForm.uploadType === 'link' }"
              @click="uploadForm.uploadType = 'link'"
            >
              <CheckCircle2 class="icon-sm" />
              {{ label('外部链接', 'External Link') }}
            </button>
          </div>

          <div class="upload-grid">
            <div class="upload-column">
              <label v-if="uploadForm.uploadType === 'file'" class="drop-zone">
                <input type="file" accept=".glb,.gltf,.fbx,.obj,.stl,.dae,.3ds,.blend,.usdz,.abc,.zip" @change="handleFileChange" />
                <UploadCloud class="drop-icon" />
                <strong>{{ uploadForm.file?.name || label('选择模型或资源包', 'Choose a model or asset package') }}</strong>
                <span>{{ label('支持 GLB、FBX、OBJ、STL、BLEND、ZIP 等格式', 'Supports GLB, FBX, OBJ, STL, BLEND, ZIP, and more') }}</span>
              </label>

              <label v-else class="form-field">
                <span>{{ label('外部资源地址', 'External Asset URL') }}</span>
                <input v-model="uploadForm.externalUrl" type="url" placeholder="https://..." />
              </label>

              <label class="form-field">
                <span>{{ label('资源名称', 'Asset Name') }}</span>
                <input v-model="uploadForm.title" type="text" :placeholder="label('例如：工业机器人机械臂', 'Example: Industrial robot arm')" />
              </label>

              <div class="two-col">
                <label class="form-field">
                  <span>{{ label('分类', 'Category') }}</span>
                  <select v-model="uploadForm.categoryId">
                    <option value="">{{ label('选择分类', 'Select category') }}</option>
                    <option v-for="category in categories" :key="category.id" :value="category.id">
                      {{ category.name }}
                    </option>
                  </select>
                </label>

                <label class="file-picker">
                  <span>{{ label('封面图', 'Cover Image') }}</span>
                  <input type="file" accept="image/*" @change="handleThumbnailChange" />
                  <strong>{{ uploadForm.thumbnail?.name || label('可选', 'Optional') }}</strong>
                </label>
              </div>

              <label class="form-field">
                <span>{{ label('标签', 'Tags') }}</span>
                <input v-model="uploadForm.tags" type="text" :placeholder="label('PBR, 低面数, 游戏资产', 'PBR, low-poly, game asset')" />
              </label>

              <div v-if="uploadForm.file?.name.toLowerCase().endsWith('.zip')" class="format-checks">
                <span>{{ label('压缩包内格式', 'Formats inside ZIP') }}</span>
                <label v-for="format in uploadFormatOptions" :key="format">
                  <input v-model="uploadForm.formats" type="checkbox" :value="format" />
                  {{ format }}
                </label>
              </div>
            </div>

            <div class="upload-column">
              <label class="form-field editor-field">
                <span>{{ label('资源说明', 'Asset Description') }}</span>
                <MarkdownEditor
                  v-model="uploadForm.description"
                  :placeholder="label('写清楚用途、格式、面数、贴图、授权或使用注意事项', 'Describe usage, formats, poly count, textures, license, or notes')"
                  height="360px"
                  simple
                />
              </label>
            </div>
          </div>

          <footer>
            <button type="button" class="ghost-button" @click="isUploadDialogOpen = false">{{ label('取消', 'Cancel') }}</button>
            <button type="button" class="primary-button" :disabled="isUploading || !uploadCanSubmit" @click="submitUpload">
              <Loader2 v-if="isUploading" class="icon-sm spinning" />
              {{ label('提交审核', 'Submit for Review') }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.asset-library-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-app);
  color: var(--text-primary);
}

.page-header,
.title-block,
.header-actions,
.toolbar,
.toolbar-actions,
.view-switch,
.card-title,
.card-footer,
.metric-row,
.section-title,
.upload-dialog header,
.upload-dialog footer,
.upload-type-switch,
.two-col {
  display: flex;
  align-items: center;
}

.page-header {
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
}

.title-block {
  gap: 10px;
  min-width: 0;
}

.title-icon,
.stat-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--accent);
  background: var(--accent-subtle);
  flex: 0 0 auto;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.title-block p,
.upload-dialog header p,
.empty-state p {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 11px;
}

.header-actions,
.toolbar-actions,
.view-switch,
.metric-row,
.upload-dialog footer {
  gap: 8px;
}

/* Base Buttons */
.primary-button,
.ghost-button,
.download-button,
.icon-button {
  cursor: pointer;
  transition: all 0.15s ease;
}

.primary-button,
.ghost-button,
.download-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--border-base);
}

.primary-button {
  border-color: transparent;
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
}

.primary-button:hover {
  background: var(--accent-hover);
  transform: translateY(-0.5px);
}

.ghost-button,
.icon-button {
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover,
.icon-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.primary-button:disabled,
.pagination button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
}

.icon-md {
  width: 18px;
  height: 18px;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

.icon-xs {
  width: 11px;
  height: 11px;
}

/* KPI Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.stat-card {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 54px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 8px 12px;
  box-shadow: var(--shadow-card);
  transition: all 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-1.5px);
  border-color: var(--tone-color, var(--accent));
  box-shadow: var(--shadow-card-hover);
}

.stat-card .stat-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

/* Stat card tones */
.stat-card[data-tone='blue'] {
  --tone-color: #2563eb;
}
.stat-card[data-tone='green'] {
  --tone-color: #059669;
}
.stat-card[data-tone='orange'] {
  --tone-color: #d97706;
}
.stat-card[data-tone='teal'] {
  --tone-color: #0f766e;
}

.stat-card[data-tone='blue'] .stat-icon { color: #2563eb; background: rgba(37, 99, 235, 0.1); }
.stat-card[data-tone='green'] .stat-icon { color: #059669; background: rgba(5, 150, 105, 0.1); }
.stat-card[data-tone='orange'] .stat-icon { color: #d97706; background: rgba(217, 119, 6, 0.1); }
.stat-card[data-tone='teal'] .stat-icon { color: #0f766e; background: rgba(15, 118, 110, 0.1); }

.stat-card span {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.stat-card strong {
  display: block;
  margin-top: 1px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
}

.stat-card small {
  display: block;
  color: var(--text-muted);
  font-size: 10px;
  margin-top: 1px;
}

/* Shell & Layout */
.workspace-shell {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr) 280px;
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.filter-panel,
.content-panel,
.insight-panel {
  min-width: 0;
}

.filter-panel,
.side-section {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
}

.filter-panel {
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  gap: 6px;
  margin-bottom: 4px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.section-title svg {
  color: var(--accent);
}

/* Sidebar List Buttons (Remove Borders) */
.filter-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
  text-align: left;
  transition: all 0.15s ease;
  cursor: pointer;
}

.filter-button:hover {
  background: var(--bg-hover);
}

.panel-section > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.filter-button.active {
  background: var(--accent-subtle);
  color: var(--accent);
  font-weight: 600;
}

.filter-button strong {
  color: var(--text-muted);
  font-size: 10px;
}

.filter-button.active strong {
  color: var(--accent);
}

/* Tag Cloud (Capsule shape) */
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-cloud button {
  height: 24px;
  border: 0;
  border-radius: 9999px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 0 10px;
  font-size: 10px;
  font-weight: 500;
  transition: all 0.15s ease;
  cursor: pointer;
}

.tag-cloud button:hover {
  background: var(--bg-active);
  color: var(--accent);
  transform: translateY(-0.5px);
}

.tag-cloud button.active {
  background: var(--accent-subtle);
  color: var(--accent);
  font-weight: 600;
}

.content-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Toolbar */
.toolbar {
  justify-content: space-between;
  gap: 8px;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  color: var(--text-muted);
  padding: 0 10px;
  transition: all 0.15s ease;
}

.search-box:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-subtle);
}

.search-box input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
}

.select-field {
  width: 96px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  padding: 0 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.select-field:hover {
  border-color: var(--border-strong);
}

.select-field:focus {
  border-color: var(--accent);
  outline: 0;
}

.view-switch {
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  padding: 2px;
  display: flex;
  gap: 2px;
}

.view-switch button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-switch button.active {
  background: var(--accent);
  color: #fff;
}

.mobile-filter {
  display: none;
}

/* Filter Strip */
.asset-filter-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-card);
  padding: 0 10px;
}

.asset-filter-strip > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 3px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.asset-filter-strip strong {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.asset-chip-row {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.asset-chip-row button,
.asset-chip-row span {
  height: 22px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(37, 99, 235, 0.15);
  border-radius: 999px;
  background: var(--accent-subtle);
  color: var(--accent);
  padding: 0 8px;
  font-size: 10px;
  font-weight: 500;
}

.asset-chip-row button {
  cursor: pointer;
}

.asset-chip-row .reset-chip {
  border-color: var(--border-base);
  background: var(--bg-app);
  color: var(--text-secondary);
}

/* Card grids and spacing */
.asset-grid.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}

.asset-grid.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Asset Cards */
.asset-card {
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  transition: all 0.18s ease;
  cursor: pointer;
}

.asset-card:hover {
  transform: translateY(-2px);
  border-color: rgba(37, 99, 235, 0.45);
  box-shadow: var(--shadow-card-hover);
}

.asset-grid.list .asset-card {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
}

.asset-preview {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #172033;
}

.asset-grid.list .asset-preview {
  aspect-ratio: auto;
  min-height: 96px;
}

.asset-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.asset-card:hover .asset-preview img {
  transform: scale(1.03);
}

.badge-row {
  position: absolute;
  left: 6px;
  top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.badge-row span {
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.75);
  color: #fff;
  padding: 2px 5px;
  font-size: 9px;
  font-weight: 600;
}

.asset-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.card-title h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-title p {
  margin-top: 2px;
  min-height: 30px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.4;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-title .icon-button {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.asset-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.asset-meta span,
.tag-row span {
  border-radius: 4px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 500;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 18px;
  margin-top: 4px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid var(--border-base);
}

.metric-row {
  display: flex;
  gap: 6px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
}

.metric-row span {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.download-button {
  height: 24px;
  border-radius: 4px;
  padding: 0 8px;
  color: var(--accent);
  background: var(--accent-subtle);
  border-color: transparent;
  font-size: 10px;
  font-weight: 600;
}

.download-button:hover {
  background: rgba(37, 99, 235, 0.15);
}

/* Insight panel (Right Sidebar) */
.insight-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.side-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
}

/* Sidebar List Buttons (Remove Borders) */
.rank-item,
.activity-item {
  display: flex;
  align-items: center;
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 5px 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.rank-item:hover,
.activity-item:hover {
  background: var(--bg-hover);
}

.side-section > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.rank-item {
  display: grid;
  grid-template-columns: 18px 24px minmax(0, 1fr) auto;
  gap: 6px;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.rank-badge.rank-1 {
  background: #f59e0b;
  color: #fff;
}

.rank-badge.rank-2 {
  background: #94a3b8;
  color: #fff;
}

.rank-badge.rank-3 {
  background: #a16207;
  color: #fff;
}

.rank-badge:not(.rank-1):not(.rank-2):not(.rank-3) {
  background: var(--bg-app);
  color: var(--text-muted);
}

.rank-item img {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
}

.rank-item span,
.activity-item span {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-item strong {
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  text-align: right;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.activity-item small {
  color: var(--text-muted);
  font-size: 10px;
}

/* Empty State */
.empty-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  min-height: 260px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  text-align: center;
}

.empty-state h2 {
  font-size: 15px;
  font-weight: 600;
}

.empty-icon {
  width: 32px;
  height: 32px;
  color: var(--accent);
  opacity: 0.5;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.pagination button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 6px;
  border: 1px solid var(--border-base);
  transition: all 0.15s ease;
}

.pagination button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

/* Modals */
.modal-layer {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 16px;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(6px);
}

.upload-dialog {
  position: relative;
  z-index: 1;
  width: min(920px, 100%);
  max-height: min(86vh, 760px);
  overflow: auto;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--bg-card);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
  padding: 16px;
}

.upload-dialog header,
.upload-dialog footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.upload-dialog header {
  margin-bottom: 12px;
}

.upload-dialog h2 {
  font-size: 16px;
  font-weight: 700;
}

.upload-type-switch {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: var(--bg-hover);
  border: 1px solid var(--border-base);
}

.upload-type-switch button {
  flex: 1;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  border: none;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.upload-type-switch button:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.4);
}

.dark .upload-type-switch button:hover {
  background: rgba(255, 255, 255, 0.06);
}

.upload-type-switch button.active {
  background: var(--bg-card);
  color: var(--accent);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-weight: 600;
}

.upload-grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(0, 1.1fr);
  gap: 12px;
  margin-top: 12px;
}

.upload-column {
  display: grid;
  align-content: start;
  gap: 10px;
}

.drop-zone {
  position: relative;
  display: grid;
  place-items: center;
  gap: 4px;
  min-height: 118px;
  border: 1px dashed var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  text-align: center;
}

.drop-zone input,
.file-picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.drop-icon {
  width: 24px;
  height: 24px;
  color: var(--accent);
}

.drop-zone strong,
.file-picker strong {
  max-width: 90%;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drop-zone span {
  color: var(--text-muted);
  font-size: 10px;
}

.form-field,
.file-picker,
.format-checks {
  position: relative;
  display: grid;
  gap: 4px;
}

.form-field > span,
.file-picker > span,
.format-checks > span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.form-field input,
.form-field select,
.file-picker strong {
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 0 10px;
  font-size: 12px;
}

.file-picker strong {
  display: flex;
  align-items: center;
}

.two-col {
  display: flex;
  align-items: end;
  gap: 8px;
}

.two-col > * {
  flex: 1;
}

.editor-field :deep(.markdown-editor) {
  min-width: 0;
}

.format-checks {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 8px;
}

.format-checks > span {
  grid-column: 1 / -1;
}

.format-checks label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.upload-dialog footer {
  margin-top: 12px;
  justify-content: flex-end;
}

.skeleton {
  border-radius: 6px;
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.1), rgba(148, 163, 184, 0.2), rgba(148, 163, 184, 0.1));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

.skeleton-card {
  padding: 10px;
}

.skeleton.preview {
  aspect-ratio: 4 / 3;
}

.skeleton.line {
  width: 60%;
  height: 10px;
  margin-top: 10px;
}

.skeleton.line.wide {
  width: 80%;
}

.spinning {
  animation: spin 0.8s linear infinite;
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

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

@media (max-width: 1180px) {
  .workspace-shell {
    grid-template-columns: 190px minmax(0, 1fr);
  }

  .insight-panel {
    display: none;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .asset-library-page {
    padding: 12px;
  }

  .page-header,
  .toolbar,
  .asset-filter-strip {
    align-items: stretch;
    flex-direction: column;
  }

  .asset-chip-row {
    justify-content: flex-start;
  }

  .header-actions,
  .toolbar-actions {
    width: 100%;
  }

  .workspace-shell {
    grid-template-columns: 1fr;
  }

  .filter-panel {
    display: none;
  }

  .filter-panel.open {
    display: grid;
  }

  .mobile-filter {
    display: grid;
  }

  .asset-grid.list .asset-card {
    grid-template-columns: 1fr;
  }

  .upload-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .title-block {
    align-items: flex-start;
  }

  .toolbar-actions,
  .header-actions,
  .two-col {
    align-items: stretch;
    flex-direction: column;
  }

  .select-field,
  .primary-button,
  .ghost-button {
    width: 100%;
  }

  .asset-grid.grid {
    grid-template-columns: 1fr;
  }

  .format-checks {
    grid-template-columns: 1fr;
  }
}
</style>
