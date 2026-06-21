<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Box,
  Clock3,
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
  X,
  XCircle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import PublishWorkDialog from '@/components/PublishWorkDialog.vue';
import Input from '@/components/ui/Input.vue';
import Tabs from '@/components/ui/Tabs.vue';
import UnifiedCard from '@/components/UnifiedCard.vue';
import { useSystemStore } from '@/stores/system';
import { formatCompactNumber, formatFileSize } from './resourceUtils';
import {
  calculateWorkStats,
  filterAndSortWorks,
  getReviewCompletion,
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
const viewModeOptions = computed(() => [
  { value: 'grid', icon: Grid3X3 },
  { value: 'list', icon: LayoutList },
]);
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

const activeTab = ref<'mine' | 'favorites'>('mine');
const mySubmissionsCount = ref(0);
const myFavoritesCount = ref(0);

const libraryTabOptions = computed(() => [
  { label: `我的提交 ${mySubmissionsCount.value}`, value: 'mine' },
  { label: `我的收藏 ${myFavoritesCount.value}`, value: 'favorites' },
]);

const systemStore = useSystemStore();
const materialCategories = computed(() =>
  (systemStore.settings.MATERIAL_CATEGORIES || []).filter(
    (name) => name !== '全部材料' && name !== '全部',
  ),
);
const pluginCategories = computed(() =>
  (systemStore.settings.PLUGIN_CATEGORIES || []).filter(
    (name) => name !== '全部插件' && name !== '全部',
  ),
);

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

const sourceTabs = computed(() => {
  const currentStatus = statusFilter.value;
  const query = searchQuery.value.trim().toLowerCase();

  const getCountForKind = (kind: 'ALL' | WorkKind) => {
    return allWorks.value.filter((work) => {
      const matchesKind = kind === 'ALL' || work.kind === kind;
      const matchesStatus = currentStatus === 'ALL' || work.status === currentStatus;
      const matchesQuery =
        !query ||
        work.title.toLowerCase().includes(query) ||
        work.description.toLowerCase().includes(query) ||
        work.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        work.surface.toLowerCase().includes(query);
      return matchesKind && matchesStatus && matchesQuery;
    }).length;
  };

  return [
    { key: 'ALL', label: '全部内容', count: getCountForKind('ALL'), icon: Sparkles },
    { key: 'asset', label: '资源', count: getCountForKind('asset'), icon: Box },
    { key: 'material', label: '材料', count: getCountForKind('material'), icon: Layers },
    { key: 'plugin', label: '插件', count: getCountForKind('plugin'), icon: Puzzle },
    { key: 'showcase', label: '展示', count: getCountForKind('showcase'), icon: FileImage },
  ] as const;
});

const statusTabs = computed(() => {
  const currentSource = sourceFilter.value;
  const query = searchQuery.value.trim().toLowerCase();

  const getCountForStatus = (status: WorkStatus) => {
    return allWorks.value.filter((work) => {
      const matchesKind = currentSource === 'ALL' || work.kind === currentSource;
      const matchesStatus = status === 'ALL' || work.status === status;
      const matchesQuery =
        !query ||
        work.title.toLowerCase().includes(query) ||
        work.description.toLowerCase().includes(query) ||
        work.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        work.surface.toLowerCase().includes(query);
      return matchesKind && matchesStatus && matchesQuery;
    }).length;
  };

  return [
    { key: 'ALL', label: '全部状态', count: getCountForStatus('ALL') },
    { key: 'PENDING', label: '待审核', count: getCountForStatus('PENDING') },
    { key: 'APPROVED', label: '已通过', count: getCountForStatus('APPROVED') },
    { key: 'REJECTED', label: '未通过', count: getCountForStatus('REJECTED') },
  ] as const;
});

const sourceTabOptions = computed(() => {
  return sourceTabs.value.map((tab) => ({
    label: tab.label,
    value: tab.key,
    badge: tab.count,
  }));
});

const statusTabOptions = computed(() => {
  return statusTabs.value.map((tab) => ({
    label: tab.label,
    value: tab.key,
    badge: tab.count,
  }));
});
const fetchWorks = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    if (activeTab.value === 'mine') {
      const { data } = await api.get('/api/resources/my-workbench', {
        params: { limit: 240 },
      });
      assets.value = data.assets || [];
      materials.value = data.materials || [];
      plugins.value = data.plugins || [];
      showcases.value = data.showcases || [];
      workbenchSummary.value = data.summary || null;
      mySubmissionsCount.value =
        (data.assets || []).length +
        (data.materials || []).length +
        (data.plugins || []).length +
        (data.showcases || []).length;
    } else {
      const [assetsRes, materialsRes, pluginsRes] = await Promise.all([
        api.get('/api/assets/public', { params: { favoritesOnly: 'true', limit: 100 } }),
        api.get('/api/materials', { params: { favoritesOnly: 'true', limit: 100 } }),
        api.get('/api/plugins/favorites'),
      ]);
      assets.value = assetsRes.data?.assets || [];
      materials.value = Array.isArray(materialsRes.data)
        ? materialsRes.data
        : materialsRes.data?.items || [];
      plugins.value = pluginsRes.data?.plugins || [];
      showcases.value = [];
      workbenchSummary.value = null;

      const assetsCount =
        assetsRes.data?.pagination?.total || (assetsRes.data?.assets || []).length;
      const materialsCount = Array.isArray(materialsRes.data)
        ? materialsRes.data.length
        : materialsRes.data?.total || materialsRes.data?.items?.length || 0;
      const pluginsCount = pluginsRes.data?.plugins?.length || 0;
      myFavoritesCount.value = assetsCount + materialsCount + pluginsCount;
    }
  } catch (error) {
    if (!silent) {
      ElMessage.error(
        getApiErrorMessage(
          error,
          activeTab.value === 'mine' ? '我的作品加载失败' : '收藏列表加载失败',
        ),
      );
    }
  } finally {
    if (!silent) isLoading.value = false;
  }
};
watch(activeTab, () => {
  fetchWorks();
});

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
    pluginCategory:
      work.kind === 'plugin' ? (raw as PluginWork).category || '其他工具' : '其他工具',
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

    // 备份当前状态以备失败恢复
    const oldAssets = [...assets.value];
    const oldMaterials = [...materials.value];
    const oldPlugins = [...plugins.value];
    const oldShowcases = [...showcases.value];

    // 乐观更新：立刻在前端移除该作品
    if (work.kind === 'asset') {
      assets.value = assets.value.filter((x) => x.id !== work.id);
    } else if (work.kind === 'material') {
      materials.value = materials.value.filter((x) => x.id !== work.id);
    } else if (work.kind === 'plugin') {
      plugins.value = plugins.value.filter((x) => x.id !== work.id);
    } else if (work.kind === 'showcase') {
      showcases.value = showcases.value.filter((x) => x.id !== work.id);
    }

    // 立刻提示已删除
    ElMessage.success('已删除');

    // 异步在后台删除，成功后静默拉取更新，失败后恢复界面
    const deletePromise = (() => {
      if (work.kind === 'asset') return api.delete(`/api/assets/${work.id}`);
      if (work.kind === 'material') return api.delete(`/api/materials/${work.id}`);
      if (work.kind === 'plugin') return api.delete(`/api/plugins/${work.id}`);
      if (work.kind === 'showcase') return api.delete(`/api/showcase/${work.id}`);
      return Promise.resolve();
    })();

    deletePromise
      .then(() => {
        fetchWorks(true);
      })
      .catch((err) => {
        // 恢复数据
        assets.value = oldAssets;
        materials.value = oldMaterials;
        plugins.value = oldPlugins;
        showcases.value = oldShowcases;
        ElMessage.error(getApiErrorMessage(err, '删除失败'));
      });
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

onMounted(async () => {
  systemStore.fetchSettings();
  fetchCategories();
  await fetchWorks();

  // Pre-fetch favorites count to display badge on tab
  try {
    const [assetsRes, materialsRes, pluginsRes] = await Promise.all([
      api.get('/api/assets/public', { params: { favoritesOnly: 'true', limit: 1 } }),
      api.get('/api/materials', { params: { favoritesOnly: 'true', limit: 1 } }),
      api.get('/api/plugins/favorites'),
    ]);
    const assetsCount = assetsRes.data?.pagination?.total || 0;
    const materialsCount = Array.isArray(materialsRes.data)
      ? materialsRes.data.length
      : materialsRes.data?.total || materialsRes.data?.items?.length || 0;
    const pluginsCount = pluginsRes.data?.plugins?.length || 0;
    myFavoritesCount.value = assetsCount + materialsCount + pluginsCount;
  } catch (err) {
    console.error('Failed to pre-fetch favorites count:', err);
  }
});
</script>

<template>
  <div class="my-works-page">
    <header class="page-header flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-0">
      <div class="title-block flex-1 min-w-0">
        <div class="title-icon">
          <PackageCheck class="icon-sm" />
        </div>
        <div>
          <h1>我的作品</h1>
          <p>统一管理资源、材料、插件和展示作品的发布状态。</p>
        </div>
      </div>

      <!-- Center: Centered Search Input -->
      <div class="flex justify-center flex-1 w-full md:w-auto">
        <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 md:w-80 shrink-0">
          <Search />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索标题、说明、标签或发布位置"
          />
        </label>
      </div>

      <div class="header-actions flex-1 flex justify-end">
        <button
          v-if="activeTab === 'mine'"
          type="button"
          class="ghost-button"
          @click="isStatsExpanded = !isStatsExpanded"
        >
          <component :is="isStatsExpanded ? EyeOff : Eye" class="icon-sm" />
          {{ isStatsExpanded ? '收起指标' : '数据指标' }}
        </button>
        <button
          type="button"
          class="ghost-button"
          :disabled="isLoading"
          @click="() => fetchWorks()"
        >
          <Loader2 v-if="isLoading" class="icon-sm spinning" />
          <Sparkles v-else class="icon-sm" />
          刷新
        </button>
        <button
          v-if="activeTab === 'mine'"
          type="button"
          class="primary-button"
          @click="isPublishWorkDialogOpen = true"
        >
          <Plus class="icon-sm" />
          发布作品
        </button>
      </div>
    </header>

    <section v-show="isStatsExpanded && activeTab === 'mine'" class="stats-grid">
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

    <section v-show="isStatsExpanded && activeTab === 'mine'" class="workbench-strip">
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
        <button
          type="button"
          :class="{ active: statusFilter === 'PENDING' }"
          @click="statusFilter = 'PENDING'"
        >
          待审核
        </button>
        <button
          type="button"
          :class="{ active: statusFilter === 'REJECTED' }"
          @click="statusFilter = 'REJECTED'"
        >
          未通过
        </button>
        <button
          type="button"
          :class="{ active: statusFilter === 'APPROVED' }"
          @click="statusFilter = 'APPROVED'"
        >
          已发布
        </button>
        <button
          type="button"
          :class="{ active: statusFilter === 'ALL' }"
          @click="statusFilter = 'ALL'"
        >
          全部
        </button>
      </div>
    </section>

    <section class="workspace-shell">
      <aside class="filter-panel">
        <div class="panel-section">
          <div class="section-title">
            <Layers class="icon-sm" />
            发布位置
          </div>
          <Tabs v-model="sourceFilter" :options="sourceTabOptions" direction="vertical" size="sm" />
        </div>

        <div v-if="activeTab === 'mine'" class="panel-section">
          <div class="section-title">
            <PackageCheck class="icon-sm" />
            审核状态
          </div>
          <Tabs v-model="statusFilter" :options="statusTabOptions" direction="vertical" size="sm" />
        </div>

        <div v-if="activeTab === 'mine'" class="review-note">
          <ShieldAlert class="icon-sm" />
          <strong>审核流</strong>
          <p>编辑已通过内容后会回到待审核，管理员通过后重新公开。</p>
        </div>
      </aside>

      <main class="content-panel">
        <section class="toolbar">
          <div class="toolbar-left">
            <Tabs v-model="activeTab" :options="libraryTabOptions" size="sm" />
          </div>



          <div class="toolbar-right">
            <select v-model="sortBy" class="select-field" aria-label="排序方式">
              <option value="newest">最新更新</option>
              <option value="oldest">最早发布</option>
              <option value="name">名称排序</option>
              <option value="status">审核状态</option>
            </select>
            <Tabs v-model="viewMode" :options="viewModeOptions" size="sm" />
          </div>
        </section>

        <div class="works-main">
          <div v-if="isLoading" class="works-grid" :class="viewMode">
            <article v-for="index in 8" :key="index" class="work-card skeleton-card">
              <div class="skeleton preview"></div>
              <div class="skeleton line wide"></div>
              <div class="skeleton line"></div>
            </article>
          </div>

          <div v-else-if="filteredWorks.length" class="works-grid" :class="viewMode">
            <UnifiedCard
              v-for="work in filteredWorks"
              :key="work.uid"
              :item="work"
              kind="work"
              :view-mode="viewMode"
              :active-tab="activeTab"
              @click="openWork(work)"
              @edit="openEditDialog(work)"
              @download="handleDownload(work)"
              @share="openShowcaseDialog(work)"
              @select="handleDeleteWork(work)"
            />
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
        </div>
      </main>
    </section>

    <Modal
      :show="isEditDialogOpen && !!selectedWork"
      size="xl"
      glass-card
      @close="isEditDialogOpen = false"
    >
      <template #header>
        <div>
          <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">编辑作品</h3>
          <p class="text-xs text-[var(--text-muted)] mt-1">保存后会根据内容类型重新提交审核。</p>
        </div>
      </template>

      <div class="edit-grid" v-if="selectedWork">
        <div class="col-span-2">
          <Input
            v-model="editForm.title"
            type="text"
            label="作品名称"
            required
          />
        </div>

        <label v-if="selectedWork.kind === 'asset'" class="form-field flex flex-col col-span-2 sm:col-span-1">
          <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">资源分类</span>
          <select
            v-model="editForm.categoryId"
            class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="">未分类</option>
            <option v-for="category in assetCategories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </label>

        <template v-if="selectedWork.kind === 'material'">
          <label class="form-field flex flex-col col-span-2 sm:col-span-1">
            <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">材料分类</span>
            <select
              v-model="editForm.materialCategory"
              class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option v-for="category in materialCategories" :key="category" :value="category">
                {{ category }}
              </option>
            </select>
          </label>
          <label class="form-field flex flex-col col-span-2 sm:col-span-1">
            <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">分辨率</span>
            <select
              v-model="editForm.resolution"
              class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="2K">2K</option>
              <option value="4K">4K</option>
              <option value="8K">8K</option>
              <option value="矢量">矢量</option>
              <option value="程序化">程序化</option>
            </select>
          </label>
          <div class="col-span-2 flex items-center py-2">
            <Checkbox v-model="editForm.isProcedural">程序化材质</Checkbox>
          </div>
        </template>

        <template v-if="selectedWork.kind === 'plugin'">
          <label class="form-field flex flex-col col-span-2 sm:col-span-1">
            <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">插件分类</span>
            <select
              v-model="editForm.pluginCategory"
              class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option v-for="category in pluginCategories" :key="category" :value="category">
                {{ category }}
              </option>
            </select>
          </label>
          <div class="col-span-2 sm:col-span-1">
            <Input
              v-model="editForm.pluginVersion"
              type="text"
              label="版本"
            />
          </div>
          <div class="col-span-2">
            <Input
              v-model="editForm.pluginCompatibility"
              type="text"
              label="兼容版本"
            />
          </div>
        </template>

        <template v-if="selectedWork.kind === 'showcase'">
          <label class="form-field flex flex-col col-span-2 sm:col-span-1">
            <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">展示类型</span>
            <select
              v-model="editForm.showcaseType"
              class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="IMAGE">图片作品</option>
              <option value="VIDEO">视频作品</option>
              <option value="MODEL">模型展示</option>
              <option value="TEXT">图文作品</option>
              <option value="OTHER">其他</option>
            </select>
          </label>
          <div v-if="editForm.showcaseType === 'VIDEO'" class="col-span-2 sm:col-span-1">
            <Input
              v-model="editForm.videoUrl"
              type="text"
              label="视频链接"
            />
          </div>
        </template>

        <div class="col-span-2">
          <Input
            v-model="editForm.tags"
            type="text"
            label="标签"
            placeholder="用逗号分隔多个标签"
          />
        </div>

        <label class="form-field wide editor-field col-span-2">
          <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">作品说明</span>
          <MarkdownEditor
            v-model="editForm.description"
            height="280px"
            placeholder="描述作品用途、制作说明、安装方式或更新内容"
            simple
          />
        </label>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" size="sm" @click="isEditDialogOpen = false">
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            :loading="isSaving"
            @click="handleSaveEdit"
          >
            保存并提交审核
          </Button>
        </div>
      </template>
    </Modal>

    <Modal
      :show="isShowcaseDialogOpen"
      size="lg"
      glass-card
      @close="isShowcaseDialogOpen = false"
    >
      <template #header>
        <div>
          <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)]">发布到作品展示</h3>
          <p class="text-xs text-[var(--text-muted)] mt-1">用已审核资源生成展示作品。</p>
        </div>
      </template>

      <div class="space-y-4">
        <Input
          v-model="showcaseForm.title"
          type="text"
          label="展示标题"
          required
        />
        <label class="flex flex-col">
          <span class="block text-xs font-bold uppercase tracking-wider mb-2 ml-1 text-[var(--text-secondary)]">展示说明</span>
          <textarea
            v-model="showcaseForm.description"
            rows="4"
            class="glass-input text-sm p-3.5 rounded-xl outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
          ></textarea>
        </label>
        <Input
          v-model="showcaseForm.tags"
          type="text"
          label="标签"
        />
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button variant="secondary" size="sm" @click="isShowcaseDialogOpen = false">
            取消
          </Button>
          <Button
            variant="primary"
            size="sm"
            @click="publishToShowcase"
          >
            提交审核
          </Button>
        </div>
      </template>
    </Modal>

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
  background: transparent !important;
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
  min-height: 32px;
}

.title-block {
  gap: 8px;
  min-width: 0;
}

.title-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
  flex: 0 0 auto;
}

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

.title-block h1 {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.title-block p {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.2;
}

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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card);
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid var(--border-base);
  backdrop-filter: blur(12px);
  flex-wrap: nowrap;
}

.toolbar-left {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}

.toolbar-center {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  align-items: center;
}

.toolbar-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

/* Local .search-box styling removed to use global .search-box style */

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
.workspace-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.content-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.section-title svg {
  color: var(--accent);
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

.works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.works-grid.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
.work-card[data-kind='asset']:hover {
  border-color: rgba(37, 99, 235, 0.45);
}
.work-card[data-kind='material']:hover {
  border-color: rgba(217, 119, 6, 0.45);
}
.work-card[data-kind='plugin']:hover {
  border-color: rgba(5, 150, 105, 0.45);
}
.work-card[data-kind='showcase']:hover {
  border-color: rgba(225, 29, 72, 0.45);
}

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

.badge-row [data-status='APPROVED'] {
  background: rgba(5, 150, 105, 0.9);
}
.badge-row [data-status='PENDING'] {
  background: rgba(217, 119, 6, 0.9);
}
.badge-row [data-status='REJECTED'] {
  background: rgba(220, 38, 38, 0.9);
}

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



/* Skeletons */
.skeleton {
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.1),
    rgba(148, 163, 184, 0.2),
    rgba(148, 163, 184, 0.1)
  );
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
  .header-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar {
    gap: 12px;
  }

  .toolbar-left,
  .toolbar-right {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    width: 100%;
  }

  .toolbar-center {
    width: 100%;
  }

  .toolbar-center :deep(.ui-input-wrapper) {
    max-width: none;
    width: 100%;
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
