<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Box,
  Clock3,
  FileImage,
  Grid3X3,
  HardDrive,
  Layers,
  LayoutList,
  PackageCheck,
  Puzzle,
  SendHorizonal,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import PublishWorkDialog from '@/components/PublishWorkDialog.vue';
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
import MyWorksHeader from './components/MyWorksHeader.vue';
import MyWorksStatsPanel from './components/MyWorksStatsPanel.vue';
import MyWorksFilterPanel from './components/MyWorksFilterPanel.vue';
import MyWorksGrid from './components/MyWorksGrid.vue';
import EditWorkDialog from './components/EditWorkDialog.vue';
import PublishShowcaseDialog from './components/PublishShowcaseDialog.vue';

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
    logError(err, { operation: 'prefetchFavoritesCount', view: 'MyWorksView' });
  }
});
</script>

<template>
  <div class="my-works-page mobile-adaptive">
    <MyWorksHeader
      v-model:search-query="searchQuery"
      v-model:is-stats-expanded="isStatsExpanded"
      :active-tab="activeTab"
      :is-loading="isLoading"
      @refresh="fetchWorks"
      @publish="isPublishWorkDialogOpen = true"
    />

    <MyWorksStatsPanel
      v-model:status-filter="statusFilter"
      :is-stats-expanded="isStatsExpanded"
      :active-tab="activeTab"
      :stat-cards="statCards"
      :workbench-signals="workbenchSignals"
      :review-completion="reviewCompletion"
    />

    <section class="workspace-shell">
      <MyWorksFilterPanel
        v-model:source-filter="sourceFilter"
        v-model:status-filter="statusFilter"
        :active-tab="activeTab"
        :source-tab-options="sourceTabOptions"
        :status-tab-options="statusTabOptions"
      />

      <MyWorksGrid
        v-model:active-tab="activeTab"
        v-model:sort-by="sortBy"
        v-model:view-mode="viewMode"
        :library-tab-options="libraryTabOptions"
        :view-mode-options="viewModeOptions"
        :is-loading="isLoading"
        :filtered-works="filteredWorks"
        @open-work="openWork"
        @edit="openEditDialog"
        @download="handleDownload"
        @share="openShowcaseDialog"
        @delete="handleDeleteWork"
        @publish="isPublishWorkDialogOpen = true"
      />
    </section>

    <EditWorkDialog
      v-model:show="isEditDialogOpen"
      v-model:form="editForm"
      :work="selectedWork"
      :is-saving="isSaving"
      :asset-categories="assetCategories"
      :material-categories="materialCategories"
      :plugin-categories="pluginCategories"
      @save="handleSaveEdit"
    />

    <PublishShowcaseDialog
      v-model:show="isShowcaseDialogOpen"
      v-model:form="showcaseForm"
      @submit="publishToShowcase"
    />

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

.workspace-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
  margin-top: 12px;
}

@media (max-width: 680px) {
  .my-works-page {
    padding: 12px;
  }
}
</style>
