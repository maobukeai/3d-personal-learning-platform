<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArrowDownToLine,
  Box,
  Clock3,
  Edit3,
  Eye,
  EyeOff,
  FileImage,
  Grid3X3,
  HardDrive,
  Layers,
  LayoutList,
  Loader2,
  PackageCheck,
  Plus,
  Puzzle,
  Search,
  SendHorizonal,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import PublishWorkDialog from '@/components/PublishWorkDialog.vue';
import { formatCompactNumber, formatDate, formatFileSize } from './resourceUtils';
import {
  MATERIAL_CATEGORIES,
  PLUGIN_CATEGORIES,
  calculateWorkStats,
  filterAndSortWorks,
  getReviewCompletion,
  getWorkStatusLabel as getStatusLabel,
  normalizeWorkbenchWorks,
  type AssetWork,
  type CategoryType,
  type MaterialWork,
  type PluginWork,
  type ShowcaseWork,
  type UnifiedWork,
  type WorkKind,
  type WorkStatus,
  type WorkbenchSummary,
  type WorkSortKey,
  type WorkViewMode as ViewMode,
} from './myWorksModel';

const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));

const router = useRouter();
const searchQuery = ref('');
const isStatsExpanded = ref(false);
const sourceFilter = ref<'ALL' | WorkKind>('ALL');
const statusFilter = ref<WorkStatus>('ALL');
const viewMode = ref<ViewMode>('grid');
const sortBy = ref<WorkSortKey>('newest');
const isLoading = ref(false);
const isSaving = ref(false);
const isPublishWorkDialogOpen = ref(false);
const isEditDialogOpen = ref(false);
const isShowcaseDialogOpen = ref(false);
const selectedWork = ref<UnifiedWork | null>(null);

const assets = ref<AssetWork[]>([]);
const materials = ref<MaterialWork[]>([]);
const plugins = ref<PluginWork[]>([]);
const showcases = ref<ShowcaseWork[]>([]);
const assetCategories = ref<CategoryType[]>([]);
const workbenchSummary = ref<WorkbenchSummary | null>(null);

const materialCategories = MATERIAL_CATEGORIES;
const pluginCategories = PLUGIN_CATEGORIES;

const editForm = ref({
  title: '',
  description: '',
  tags: '',
  categoryId: '',
  materialCategory: '其他',
  resolution: '4K',
  isProcedural: false,
  pluginCategory: '其他工具',
  pluginVersion: '1.0.0',
  pluginCompatibility: '',
  showcaseType: 'IMAGE',
  videoUrl: '',
});

const showcaseForm = ref({
  assetId: '',
  title: '',
  description: '',
  tags: '',
});

const allWorks = computed<UnifiedWork[]>(() =>
  normalizeWorkbenchWorks({
    assets: assets.value,
    materials: materials.value,
    plugins: plugins.value,
    showcases: showcases.value,
  }),
);

const filteredWorks = computed(() =>
  filterAndSortWorks(allWorks.value, {
    searchQuery: searchQuery.value,
    sourceFilter: sourceFilter.value,
    statusFilter: statusFilter.value,
    sortBy: sortBy.value,
  }),
);

const stats = computed(() => calculateWorkStats(allWorks.value));

const reviewCompletion = computed(() => getReviewCompletion(stats.value));

const statCards = computed(() => [
  {
    label: '全部作品',
    value: stats.value.total,
    meta: `${stats.value.approved} 个已公开`,
    icon: PackageCheck,
    tone: 'blue',
  },
  {
    label: '待审核',
    value: stats.value.pending,
    meta: '修改后会重新进入审核',
    icon: Clock3,
    tone: 'amber',
  },
  {
    label: '未通过',
    value: stats.value.rejected,
    meta: '可编辑后重新提交',
    icon: XCircle,
    tone: 'rose',
  },
  {
    label: '总触达',
    value: formatCompactNumber(stats.value.totalReach),
    meta: `文件 ${formatFileSize(stats.value.totalSize, '0 MB')}`,
    icon: Sparkles,
    tone: 'teal',
  },
]);

const workbenchSignals = computed(() => [
  {
    label: '审核通过率',
    value: `${workbenchSummary.value?.readyRate ?? reviewCompletion.value}%`,
    meta: `${stats.value.approved}/${stats.value.total} 已发布`,
    icon: PackageCheck,
    tone: 'green',
  },
  {
    label: '待处理',
    value: workbenchSummary.value?.needsAction ?? stats.value.pending + stats.value.rejected,
    meta: `${stats.value.pending} 待审核 / ${stats.value.rejected} 未通过`,
    icon: ShieldAlert,
    tone: stats.value.rejected > 0 ? 'rose' : 'amber',
  },
  {
    label: '内容触达',
    value: formatCompactNumber(workbenchSummary.value?.totalReach ?? stats.value.totalReach),
    meta: '下载 / 浏览 / 收藏 / 点赞',
    icon: SendHorizonal,
    tone: 'blue',
  },
  {
    label: '占用空间',
    value: formatFileSize(workbenchSummary.value?.totalSize ?? stats.value.totalSize, '0 MB'),
    meta: '资源、材料、插件文件',
    icon: HardDrive,
    tone: 'teal',
  },
]);

const sourceTabs = computed(() => [
  { key: 'ALL', label: '全部内容', count: allWorks.value.length, icon: Sparkles },
  { key: 'asset', label: '资源', count: assets.value.length, icon: Box },
  { key: 'material', label: '材料', count: materials.value.length, icon: Layers },
  { key: 'plugin', label: '插件', count: plugins.value.length, icon: Puzzle },
  { key: 'showcase', label: '展示', count: showcases.value.length, icon: FileImage },
] as const);

const statusTabs = computed(() => [
  { key: 'ALL', label: '全部状态', count: allWorks.value.length },
  { key: 'PENDING', label: '待审核', count: stats.value.pending },
  { key: 'APPROVED', label: '已通过', count: stats.value.approved },
  { key: 'REJECTED', label: '未通过', count: stats.value.rejected },
] as const);

const fetchWorks = async () => {
  isLoading.value = true;
  try {
    const { data } = await api.get('/api/resources/my-workbench', {
      params: { limit: 240 },
    });
    assets.value = data.assets || [];
    materials.value = data.materials || [];
    plugins.value = data.plugins || [];
    showcases.value = data.showcases || [];
    workbenchSummary.value = data.summary || null;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '我的作品加载失败'));
  } finally {
    isLoading.value = false;
  }
};

const fetchCategories = async () => {
  try {
    const { data } = await api.get('/api/assets/categories');
    assetCategories.value = data || [];
  } catch {
    assetCategories.value = [];
  }
};

const openWork = (work: UnifiedWork) => {
  if (work.kind === 'asset') {
    router.push({ name: 'AssetDetail', params: { id: work.id } });
    return;
  }
  if (work.kind === 'material') {
    const raw = work.raw as MaterialWork;
    const url = raw.previewUrl || raw.fileUrl;
    if (url) window.open(getAssetUrl(url), '_blank', 'noopener,noreferrer');
    return;
  }
  if (work.kind === 'plugin') {
    router.push({ name: 'Plugins' });
    return;
  }
  router.push({ name: 'Showcase' });
};

const handleDownload = async (work: UnifiedWork) => {
  if (work.kind === 'asset') {
    const raw = work.raw as AssetWork;
    try {
      await api.post(`/api/assets/${work.id}/download`);
    } catch {
      // Download is still allowed if counting fails.
    }
    window.open(getAssetUrl(raw.url), '_blank', 'noopener,noreferrer');
    return;
  }

  if (work.kind === 'material') {
    try {
      await api.post(`/api/materials/${work.id}/download`);
      const response = await api.get(`/api/materials/${work.id}/file`, { responseType: 'blob' });
      const raw = work.raw as MaterialWork;
      const ext = raw.fileUrl?.split('.').pop() || 'zip';
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${work.title}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, '下载失败'));
    }
    return;
  }

  if (work.kind === 'plugin') {
    const raw = work.raw as PluginWork;
    try {
      const { data } =
        work.status === 'APPROVED'
          ? await api.post(`/api/plugins/${work.id}/download`)
          : { data: { fileUrl: raw.fileUrl } };
      const fileUrl = data.fileUrl || raw.fileUrl;
      if (!fileUrl) {
        ElMessage.warning('该插件暂无可下载文件');
        return;
      }
      window.open(getAssetUrl(fileUrl), '_blank', 'noopener,noreferrer');
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, '下载失败'));
    }
  }
};

const openEditDialog = (work: UnifiedWork) => {
  selectedWork.value = work;
  const raw = work.raw;
  editForm.value = {
    title: work.title,
    description: work.description,
    tags: work.tags.join(', '),
    categoryId: work.kind === 'asset' ? (raw as AssetWork).categoryId || '' : '',
    materialCategory: work.kind === 'material' ? (raw as MaterialWork).category || '其他' : '其他',
    resolution: work.kind === 'material' ? (raw as MaterialWork).resolution || '4K' : '4K',
    isProcedural: work.kind === 'material' ? !!(raw as MaterialWork).isProcedural : false,
    pluginCategory: work.kind === 'plugin' ? (raw as PluginWork).category || '其他工具' : '其他工具',
    pluginVersion: work.kind === 'plugin' ? (raw as PluginWork).version || '1.0.0' : '1.0.0',
    pluginCompatibility: work.kind === 'plugin' ? (raw as PluginWork).compatibility || '' : '',
    showcaseType: work.kind === 'showcase' ? (raw as ShowcaseWork).type || 'IMAGE' : 'IMAGE',
    videoUrl: work.kind === 'showcase' ? (raw as ShowcaseWork).videoUrl || '' : '',
  };
  isEditDialogOpen.value = true;
};

const handleSaveEdit = async () => {
  if (!selectedWork.value || !editForm.value.title.trim()) {
    ElMessage.warning('请填写作品名称');
    return;
  }

  const work = selectedWork.value;
  isSaving.value = true;
  try {
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
        category: editForm.value.pluginCategory,
        version: editForm.value.pluginVersion,
        compatibility: editForm.value.pluginCompatibility,
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

    ElMessage.success('修改已提交审核');
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
    if (work.kind === 'plugin') await api.delete(`/api/plugins/${work.id}`);
    if (work.kind === 'showcase') await api.delete(`/api/showcase/${work.id}`);
    ElMessage.success('已删除');
    await fetchWorks();
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error, '删除失败'));
  }
};

const openShowcaseDialog = (work: UnifiedWork) => {
  if (work.kind !== 'asset') return;
  showcaseForm.value = {
    assetId: work.id,
    title: work.title,
    description: work.description,
    tags: work.tags.join(', '),
  };
  isShowcaseDialogOpen.value = true;
};

const publishToShowcase = async () => {
  if (!showcaseForm.value.title.trim()) {
    ElMessage.warning('请填写展示标题');
    return;
  }
  try {
    await api.post('/api/showcase/publish-asset', showcaseForm.value);
    ElMessage.success('已提交作品展示审核');
    isShowcaseDialogOpen.value = false;
    await fetchWorks();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '发布失败'));
  }
};

onMounted(() => {
  fetchWorks();
  fetchCategories();
});
</script>

<template>
  <div class="my-works-page">
    <header class="page-header">
      <div class="title-block">
        <div class="title-icon">
          <PackageCheck class="icon-md" />
        </div>
        <div>
          <h1>我的作品</h1>
          <p>统一管理资源、材料、插件和展示作品的发布状态。</p>
        </div>
      </div>

      <div class="header-actions">
        <button
          type="button"
          class="ghost-button"
          @click="isStatsExpanded = !isStatsExpanded"
        >
          <component :is="isStatsExpanded ? EyeOff : Eye" class="icon-sm" />
          {{ isStatsExpanded ? '收起指标' : '数据指标' }}
        </button>
        <button type="button" class="ghost-button" :disabled="isLoading" @click="fetchWorks">
          <Loader2 v-if="isLoading" class="icon-sm spinning" />
          <Sparkles v-else class="icon-sm" />
          刷新
        </button>
        <button type="button" class="primary-button" @click="isPublishWorkDialogOpen = true">
          <Plus class="icon-sm" />
          发布作品
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

    <section v-show="isStatsExpanded" class="workbench-strip">
      <div class="review-progress">
        <div>
          <span>审核管线</span>
          <strong>{{ reviewCompletion }}%</strong>
        </div>
        <i :style="{ width: reviewCompletion + '%' }"></i>
      </div>

      <div class="signal-grid">
        <article v-for="signal in workbenchSignals" :key="signal.label" :data-tone="signal.tone">
          <component :is="signal.icon" class="icon-sm" />
          <div>
            <span>{{ signal.label }}</span>
            <strong>{{ signal.value }}</strong>
            <small>{{ signal.meta }}</small>
          </div>
        </article>
      </div>

      <div class="pipeline-actions">
        <button type="button" :class="{ active: statusFilter === 'PENDING' }" @click="statusFilter = 'PENDING'">
          待审核
        </button>
        <button type="button" :class="{ active: statusFilter === 'REJECTED' }" @click="statusFilter = 'REJECTED'">
          未通过
        </button>
        <button type="button" :class="{ active: statusFilter === 'APPROVED' }" @click="statusFilter = 'APPROVED'">
          已发布
        </button>
        <button type="button" :class="{ active: statusFilter === 'ALL' }" @click="statusFilter = 'ALL'">
          全部
        </button>
      </div>
    </section>

    <section class="toolbar">
      <label class="search-box">
        <Search class="icon-sm" />
        <input v-model="searchQuery" type="search" placeholder="搜索标题、说明、标签或发布位置" />
      </label>

      <div class="toolbar-actions">
        <select v-model="sortBy" class="select-field">
          <option value="newest">最新更新</option>
          <option value="oldest">最早发布</option>
          <option value="name">名称排序</option>
          <option value="status">审核状态</option>
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

    <section class="content-shell">
      <aside class="filter-panel">
        <div class="filter-section">
          <h2>发布位置</h2>
          <button
            v-for="tab in sourceTabs"
            :key="tab.key"
            type="button"
            class="filter-button"
            :class="{ active: sourceFilter === tab.key }"
            @click="sourceFilter = tab.key"
          >
            <span>
              <component :is="tab.icon" class="icon-sm" />
              {{ tab.label }}
            </span>
            <strong>{{ tab.count }}</strong>
          </button>
        </div>

        <div class="filter-section">
          <h2>审核状态</h2>
          <button
            v-for="tab in statusTabs"
            :key="tab.key"
            type="button"
            class="filter-button"
            :class="{ active: statusFilter === tab.key }"
            @click="statusFilter = tab.key"
          >
            <span>{{ tab.label }}</span>
            <strong>{{ tab.count }}</strong>
          </button>
        </div>

        <div class="review-note">
          <ShieldAlert class="icon-sm" />
          <strong>审核流</strong>
          <p>编辑已通过内容后会回到待审核，管理员通过后重新公开。</p>
        </div>
      </aside>

      <main class="works-main">
        <div v-if="isLoading" class="works-grid" :class="viewMode">
          <article v-for="index in 8" :key="index" class="work-card skeleton-card">
            <div class="skeleton preview"></div>
            <div class="skeleton line wide"></div>
            <div class="skeleton line"></div>
          </article>
        </div>

        <div v-else-if="filteredWorks.length" class="works-grid" :class="viewMode">
          <article v-for="work in filteredWorks" :key="work.uid" class="work-card" :data-kind="work.kind">
            <div class="work-preview" @click="openWork(work)">
              <img :src="work.thumbnail" :alt="work.title" />
              <div class="badge-row">
                <span>{{ work.surface }}</span>
                <span :data-status="work.status">{{ getStatusLabel(work.status) }}</span>
              </div>
            </div>

            <div class="work-body">
              <div class="card-title">
                <div>
                  <h2>{{ work.title }}</h2>
                  <p>{{ work.description || '还没有填写说明。' }}</p>
                </div>
                <button type="button" class="icon-button" @click="openWork(work)">
                  <Eye class="icon-sm" />
                </button>
              </div>

              <p v-if="work.status === 'REJECTED'" class="reject-reason">
                <XCircle class="icon-sm" />
                {{ work.rejectReason || '管理员未填写具体原因。' }}
              </p>

              <div class="meta-row">
                <span>{{ work.typeLabel }}</span>
                <span>{{ work.format }}</span>
                <span>{{ formatDate(work.createdAt) }}</span>
              </div>

              <div class="tag-row">
                <span v-for="tag in work.tags.slice(0, 4)" :key="tag">#{{ tag }}</span>
              </div>

              <footer class="card-footer">
                <div class="metric-row">
                  <span><ArrowDownToLine class="icon-xs" />{{ work.metric }} {{ work.metricLabel }}</span>
                  <span><HardDrive class="icon-xs" />{{ formatFileSize(work.size, '0 MB') }}</span>
                </div>
                <div class="action-row">
                  <button type="button" class="icon-button" @click="openEditDialog(work)">
                    <Edit3 class="icon-sm" />
                  </button>
                  <button type="button" class="icon-button" @click="handleDownload(work)">
                    <ArrowDownToLine class="icon-sm" />
                  </button>
                  <button
                    v-if="work.kind === 'asset' && work.status === 'APPROVED'"
                    type="button"
                    class="icon-button"
                    @click="openShowcaseDialog(work)"
                  >
                    <SendHorizonal class="icon-sm" />
                  </button>
                  <button type="button" class="icon-button danger" @click="handleDeleteWork(work)">
                    <Trash2 class="icon-sm" />
                  </button>
                </div>
              </footer>
            </div>
          </article>
        </div>

        <div v-else class="empty-state">
          <Sparkles class="empty-icon" />
          <h2>还没有匹配的作品</h2>
          <p>换一个筛选条件，或发布新的资源、材料、插件或展示作品。</p>
          <button type="button" class="primary-button" @click="isPublishWorkDialogOpen = true">
            <Plus class="icon-sm" />
            发布作品
          </button>
        </div>
      </main>
    </section>

    <Transition name="fade">
      <div v-if="isEditDialogOpen && selectedWork" class="modal-layer">
        <button type="button" class="modal-backdrop" @click="isEditDialogOpen = false"></button>
        <section class="edit-dialog">
          <header>
            <div>
              <h2>编辑作品</h2>
              <p>保存后会根据内容类型重新提交审核。</p>
            </div>
            <button type="button" class="icon-button" @click="isEditDialogOpen = false">
              <X class="icon-sm" />
            </button>
          </header>

          <div class="edit-grid">
            <label class="form-field">
              <span>作品名称</span>
              <input v-model="editForm.title" type="text" />
            </label>

            <label v-if="selectedWork.kind === 'asset'" class="form-field">
              <span>资源分类</span>
              <select v-model="editForm.categoryId">
                <option value="">未分类</option>
                <option v-for="category in assetCategories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
            </label>

            <template v-if="selectedWork.kind === 'material'">
              <label class="form-field">
                <span>材料分类</span>
                <select v-model="editForm.materialCategory">
                  <option v-for="category in materialCategories" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
              </label>
              <label class="form-field">
                <span>分辨率</span>
                <select v-model="editForm.resolution">
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                  <option value="8K">8K</option>
                  <option value="矢量">矢量</option>
                  <option value="程序化">程序化</option>
                </select>
              </label>
              <label class="switch-row">
                <input v-model="editForm.isProcedural" type="checkbox" />
                <span>程序化材质</span>
              </label>
            </template>

            <template v-if="selectedWork.kind === 'plugin'">
              <label class="form-field">
                <span>插件分类</span>
                <select v-model="editForm.pluginCategory">
                  <option v-for="category in pluginCategories" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
              </label>
              <label class="form-field">
                <span>版本</span>
                <input v-model="editForm.pluginVersion" type="text" />
              </label>
              <label class="form-field">
                <span>兼容版本</span>
                <input v-model="editForm.pluginCompatibility" type="text" />
              </label>
            </template>

            <template v-if="selectedWork.kind === 'showcase'">
              <label class="form-field">
                <span>展示类型</span>
                <select v-model="editForm.showcaseType">
                  <option value="IMAGE">图片作品</option>
                  <option value="VIDEO">视频作品</option>
                  <option value="MODEL">模型展示</option>
                  <option value="TEXT">图文作品</option>
                  <option value="OTHER">其他</option>
                </select>
              </label>
              <label v-if="editForm.showcaseType === 'VIDEO'" class="form-field">
                <span>视频链接</span>
                <input v-model="editForm.videoUrl" type="text" />
              </label>
            </template>

            <label class="form-field wide">
              <span>标签</span>
              <input v-model="editForm.tags" type="text" placeholder="用逗号分隔多个标签" />
            </label>

            <label class="form-field wide editor-field">
              <span>作品说明</span>
              <MarkdownEditor
                v-model="editForm.description"
                height="280px"
                placeholder="描述作品用途、制作说明、安装方式或更新内容"
                simple
              />
            </label>
          </div>

          <footer>
            <button type="button" class="ghost-button" @click="isEditDialogOpen = false">取消</button>
            <button type="button" class="primary-button" :disabled="isSaving" @click="handleSaveEdit">
              <Loader2 v-if="isSaving" class="icon-sm spinning" />
              保存并提交审核
            </button>
          </footer>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="isShowcaseDialogOpen" class="modal-layer">
        <button type="button" class="modal-backdrop" @click="isShowcaseDialogOpen = false"></button>
        <section class="showcase-dialog">
          <header>
            <div>
              <h2>发布到作品展示</h2>
              <p>用已审核资源生成展示作品。</p>
            </div>
            <button type="button" class="icon-button" @click="isShowcaseDialogOpen = false">
              <X class="icon-sm" />
            </button>
          </header>

          <label class="form-field">
            <span>展示标题</span>
            <input v-model="showcaseForm.title" type="text" />
          </label>
          <label class="form-field">
            <span>展示说明</span>
            <textarea v-model="showcaseForm.description" rows="4"></textarea>
          </label>
          <label class="form-field">
            <span>标签</span>
            <input v-model="showcaseForm.tags" type="text" />
          </label>

          <footer>
            <button type="button" class="ghost-button" @click="isShowcaseDialogOpen = false">取消</button>
            <button type="button" class="primary-button" @click="publishToShowcase">提交审核</button>
          </footer>
        </section>
      </div>
    </Transition>

    <PublishWorkDialog v-model="isPublishWorkDialogOpen" @published="fetchWorks" />
  </div>
</template>

<style scoped>
.my-works-page {
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
.content-shell,
.card-title,
.card-footer,
.metric-row,
.action-row,
.edit-dialog header,
.edit-dialog footer,
.showcase-dialog header,
.showcase-dialog footer,
.switch-row {
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
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
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
.empty-state p,
.edit-dialog header p,
.showcase-dialog header p {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 11px;
}

.header-actions,
.toolbar-actions,
.view-switch,
.metric-row,
.action-row,
.edit-dialog footer,
.showcase-dialog footer {
  gap: 8px;
}

/* Base Buttons & Standard Heights (32px) */
.primary-button,
.ghost-button,
.icon-button,
.filter-button {
  cursor: pointer;
  transition: all 0.15s ease;
}

.primary-button,
.ghost-button {
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
  background: #2563eb;
  color: #fff;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
}

.primary-button:hover {
  background: #1d4ed8;
  transform: translateY(-0.5px);
}

.ghost-button,
.icon-button {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border-base);
  border-radius: 6px;
}

.ghost-button:hover,
.icon-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.primary-button:disabled,
.ghost-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
}

.icon-button.danger:hover {
  border-color: rgba(220, 38, 38, 0.38);
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
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

/* Stats Dashboard Grid */
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
  box-shadow: var(--card-shadow);
  transition: all 0.15s ease;
}

.stat-card:hover {
  transform: translateY(-1.5px);
  border-color: #2563eb;
  box-shadow: var(--shadow-card-hover);
}

.stat-card .stat-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex: 0 0 auto;
}

.stat-card[data-tone='amber'] .stat-icon {
  color: #d97706;
  background: rgba(217, 119, 6, 0.1);
}

.stat-card[data-tone='rose'] .stat-icon {
  color: #e11d48;
  background: rgba(225, 29, 72, 0.1);
}

.stat-card[data-tone='teal'] .stat-icon {
  color: #0f766e;
  background: rgba(15, 118, 110, 0.1);
}

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

/* Workbench pipeline strip */
.workbench-strip {
  display: grid;
  grid-template-columns: minmax(10rem, 0.7fr) minmax(0, 2fr) minmax(15rem, 0.8fr);
  gap: 10px;
  align-items: stretch;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 8px;
}

.review-progress {
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 6px;
  border: 1px solid rgba(37, 99, 235, 0.15);
  border-radius: 6px;
  background: rgba(37, 99, 235, 0.04);
  padding: 8px;
}

.review-progress div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.review-progress span,
.signal-grid span,
.signal-grid small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-progress strong,
.signal-grid strong {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
}

.review-progress i {
  display: block;
  height: 5px;
  border-radius: 999px;
  background: #2563eb;
}

.signal-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.signal-grid article {
  --signal-color: #2563eb;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--signal-color) 15%, var(--border-base));
  border-radius: 6px;
  background: color-mix(in srgb, var(--signal-color) 5%, var(--bg-card));
  padding: 6px;
}

.signal-grid article[data-tone='green'] {
  --signal-color: #059669;
}

.signal-grid article[data-tone='amber'] {
  --signal-color: #d97706;
}

.signal-grid article[data-tone='rose'] {
  --signal-color: #e11d48;
}

.signal-grid article[data-tone='teal'] {
  --signal-color: #0f766e;
}

.signal-grid article > svg {
  flex: 0 0 auto;
  color: var(--signal-color);
  width: 14px;
  height: 14px;
}

.signal-grid article > div {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.signal-grid span,
.signal-grid small,
.signal-grid strong {
  display: block;
}

.pipeline-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.pipeline-actions button {
  min-width: 0;
  height: 100%;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.pipeline-actions button:hover,
.pipeline-actions button.active {
  border-color: rgba(37, 99, 235, 0.3);
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
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
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
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
  border-color: #2563eb;
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
  background: #2563eb;
  color: #fff;
}

/* Shell & Columns */
.content-shell {
  align-items: stretch;
  gap: 12px;
  min-height: 0;
  flex: 1;
}

/* Left Sidebar - Borderless Buttons */
.filter-panel {
  width: 180px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
  align-self: start;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-section h2 {
  margin-bottom: 4px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

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
}

.filter-button:hover {
  background: var(--bg-hover);
}

.filter-section > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.filter-button.active {
  background: var(--accent-subtle);
  color: #2563eb;
  font-weight: 600;
}

.filter-button strong {
  color: var(--text-muted);
  font-size: 10px;
}

.filter-button.active strong {
  color: #2563eb;
}

.review-note {
  display: grid;
  gap: 4px;
  margin-top: 4px;
  border: 1px solid rgba(217, 119, 6, 0.15);
  border-radius: 6px;
  background: rgba(217, 119, 6, 0.04);
  color: #d97706;
  padding: 8px;
}

.review-note strong {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.review-note p {
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.4;
}

/* Works Main Grid & Cards */
.works-main {
  min-width: 0;
  flex: 1;
}

.works-grid.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.works-grid.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.work-card {
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  transition: all 0.18s ease;
}

.work-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

/* Dynamic Glow Border Hover Tones */
.work-card[data-kind='asset']:hover { border-color: rgba(37, 99, 235, 0.45); }
.work-card[data-kind='material']:hover { border-color: rgba(217, 119, 6, 0.45); }
.work-card[data-kind='plugin']:hover { border-color: rgba(5, 150, 105, 0.45); }
.work-card[data-kind='showcase']:hover { border-color: rgba(225, 29, 72, 0.45); }

.works-grid.list .work-card {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
}

.work-preview {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #172033;
  cursor: pointer;
}

.works-grid.list .work-preview {
  aspect-ratio: auto;
  min-height: 108px;
}

.work-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}

.work-card:hover .work-preview img {
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

.badge-row [data-status='APPROVED'] { background: rgba(5, 150, 105, 0.9); }
.badge-row [data-status='PENDING'] { background: rgba(217, 119, 6, 0.9); }
.badge-row [data-status='REJECTED'] { background: rgba(220, 38, 38, 0.9); }

.work-body {
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

.reject-reason {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  color: #dc2626;
  font-size: 10px;
  font-weight: 600;
}

.meta-row,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.meta-row span,
.tag-row span {
  border-radius: 4px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 1px 5px;
  font-size: 9px;
  font-weight: 500;
}

.tag-row span {
  border-radius: 9999px;
  padding: 1px 6px;
}

.card-footer {
  margin-top: auto;
  padding-top: 6px;
  border-top: 1px solid var(--border-base);
  display: flex;
  align-items: center;
}

/* Metric Row */
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
  white-space: nowrap;
}

/* Compact Actions inside Footer */
.action-row {
  display: flex;
  gap: 4px;
}

.action-row .icon-button {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border-color: transparent;
  background: var(--bg-app);
}

.action-row .icon-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-base);
}

.action-row .icon-button.danger:hover {
  background: rgba(220, 38, 38, 0.08);
  border-color: rgba(220, 38, 38, 0.2);
  color: #dc2626;
}

/* LAYOUT FOR CARD VS LIST IN GRID */
.works-grid.grid .card-footer {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.works-grid.grid .card-footer .metric-row {
  justify-content: space-between;
  width: 100%;
}

.works-grid.grid .card-footer .action-row {
  justify-content: flex-end;
  width: 100%;
}

.works-grid.list .card-footer {
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
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

.empty-icon {
  width: 32px;
  height: 32px;
  color: #2563eb;
  opacity: 0.5;
}

.empty-state h2 {
  font-size: 14px;
  font-weight: 600;
}

/* Dialogs & Modals */
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

.edit-dialog,
.showcase-dialog {
  position: relative;
  z-index: 1;
  width: min(820px, 100%);
  max-height: min(86vh, 720px);
  overflow: auto;
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  background: var(--bg-card);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
  padding: 16px;
}

.showcase-dialog {
  width: min(500px, 100%);
  display: grid;
  gap: 10px;
}

.edit-dialog header,
.edit-dialog footer,
.showcase-dialog header,
.showcase-dialog footer {
  justify-content: space-between;
  gap: 12px;
}

.edit-dialog header {
  margin-bottom: 12px;
}

.edit-dialog h2,
.showcase-dialog h2 {
  font-size: 16px;
  font-weight: 700;
}

.edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.form-field {
  display: grid;
  gap: 4px;
}

.form-field.wide {
  grid-column: 1 / -1;
}

.form-field > span,
.switch-row span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.form-field input,
.form-field select,
.form-field textarea {
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 0 10px;
  font-size: 12px;
}

.form-field textarea {
  height: auto;
  padding: 8px 10px;
  resize: vertical;
}

.switch-row {
  align-self: end;
  gap: 8px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-app);
  padding: 0 10px;
}

.editor-field :deep(.markdown-editor) {
  min-width: 0;
}

.edit-dialog footer,
.showcase-dialog footer {
  margin-top: 12px;
  justify-content: flex-end;
}

/* Skeletons */
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

@media (max-width: 980px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workbench-strip {
    grid-template-columns: 1fr;
  }

  .signal-grid {
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

@media (max-width: 680px) {
  .my-works-page {
    padding: 12px;
  }

  .page-header,
  .toolbar,
  .header-actions,
  .toolbar-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .stats-grid,
  .signal-grid,
  .edit-grid {
    grid-template-columns: 1fr;
  }

  .select-field,
  .primary-button,
  .ghost-button {
    width: 100%;
  }

  .works-grid.grid {
    grid-template-columns: 1fr;
  }
}
</style>
