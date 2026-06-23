<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { useRoute } from 'vue-router';
import {
  Box,
  Bone,
  CheckCircle2,
  Grid3X3,
  Import,
  Layers,
  LayoutList,
  Package,
  Puzzle,
  ShieldCheck,
  Sun,
  Wrench,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useSystemStore } from '@/stores/system';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { parseTags } from './resourceUtils';
import { useLabel } from '@/utils/i18n';
import PluginPageHeader from './components/PluginPageHeader.vue';
import PluginMarketOverview from './components/PluginMarketOverview.vue';
import PluginStatsStrip from './components/PluginStatsStrip.vue';
import PluginFiltersPanel from './components/PluginFiltersPanel.vue';
import PluginToolbar from './components/PluginToolbar.vue';
import PluginCatalog from './components/PluginCatalog.vue';
import PluginInsightPanel from './components/PluginInsightPanel.vue';
import PluginDetailModal from './components/PluginDetailModal.vue';
import PluginUploadModal from './components/PluginUploadModal.vue';

type PluginStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type SortMode = 'latest' | 'popular' | 'name';

interface PluginUser {
  id?: string;
  name?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}

interface PluginItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  version: string;
  compatibility: string;
  downloads: number;
  fileUrl?: string | null;
  fileSize?: number | null;
  previewUrl?: string | null;
  installGuide: string;
  status: PluginStatus;
  rejectReason?: string | null;
  createdAt: string;
  user?: PluginUser | null;
}

interface PluginInsights {
  summary: {
    total: number;
    pending: number;
    downloads: number;
    categories: number;
    favoriteCount: number;
    averageSize: number;
    myUploads?: number;
  };
  categories: { name: string; count: number; downloads: number }[];
  hotTags: { label: string; count: number }[];
  topDownloads: PluginItem[];
  latest: PluginItem[];
  favoriteIds: string[];
}

interface StarterPluginTemplate {
  title: string;
  description: string;
  category: string;
  compatibility: string;
  tags: string[];
  packageType: string;
  Icon: Component;
  tone: string;
}

interface MarketplaceSignal {
  title: string;
  description: string;
  Icon: Component;
}

const CATEGORY_ALL = '全部插件';
const CATEGORY_OTHER = '其他工具';

const { locale } = useI18n();
const route = useRoute();

const label = useLabel();

const categoryLabel = (category?: string | null) => {
  const normalized = category || CATEGORY_OTHER;
  const englishLabels: Record<string, string> = {
    [CATEGORY_ALL]: 'All Add-ons',
    [CATEGORY_OTHER]: 'Other Utilities',
    建模: 'Modeling',
    材质与纹理: 'Materials & Texturing',
    渲染与灯光: 'Rendering & Lighting',
    动画与骨骼: 'Animation & Rigging',
    导入与导出: 'Import & Export',
    物理与特效: 'Physics & FX',
  };
  return locale.value === 'en-US' ? englishLabels[normalized] || normalized : normalized;
};

const systemStore = useSystemStore();
const pluginsList = ref<PluginItem[]>([]);
const searchQuery = ref('');
const activeCategory = ref(CATEGORY_ALL);
const selectedTag = ref('all');
const sortBy = ref<SortMode>('latest');
const viewMode = ref<'grid' | 'list'>('grid');
const viewModeOptions = computed<{ value: 'grid' | 'list'; label: string; icon: Component }[]>(
  () => [
    { value: 'grid', label: '', icon: Grid3X3 },
    { value: 'list', label: '', icon: LayoutList },
  ],
);
const showFavoritesOnly = ref(false);
const favoritedIds = ref<string[]>([]);
const insights = ref<PluginInsights | null>(null);

type LibraryTab = 'explore' | 'favorites' | 'mine';
type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

const activeTab = ref<LibraryTab>('explore');
const myStatusFilter = ref<StatusFilter>('all');

const libraryTabs = computed(() => [
  {
    key: 'explore' as const,
    label: label('插件广场', 'Explore'),
    count: insights.value?.summary.total || 0,
  },
  {
    key: 'favorites' as const,
    label: label('我的收藏', 'Favorites'),
    count: insights.value?.summary.favoriteCount || favoritedIds.value.length,
  },
  {
    key: 'mine' as const,
    label: label('我的提交', 'My Uploads'),
    count: insights.value?.summary.myUploads || 0,
  },
]);

const libraryTabOptions = computed(() => {
  return libraryTabs.value.map((tab) => ({
    label: `${tab.label} ${tab.count}`,
    value: tab.key,
  }));
});

const statusTabOptions = computed(() => [
  { label: label('全部状态', 'All Statuses'), value: 'all' },
  { label: label('待审核', 'Pending'), value: 'PENDING' },
  { label: label('已发布', 'Approved'), value: 'APPROVED' },
  { label: label('未通过', 'Rejected'), value: 'REJECTED' },
]);
const downloadingIds = ref<Record<string, boolean>>({});
const isLoading = ref(false);
const isUploading = ref(false);
const isUploadDialogOpen = ref(false);
const isDetailDialogOpen = ref(false);
const selectedPlugin = ref<PluginItem | null>(null);
const pluginFile = ref<File | null>(null);
const previewFile = ref<File | null>(null);

const uploadForm = ref({
  title: '',
  category: CATEGORY_OTHER,
  description: '',
  version: '1.0.0',
  compatibility: '',
  tags: '',
  installGuide: '',
});

const availableCategories = computed(() => {
  const configured = (systemStore.settings.PLUGIN_CATEGORIES || []).filter(
    (name) => name !== CATEGORY_ALL,
  );

  const fromData = [
    ...pluginsList.value.map((plugin) => plugin.category).filter(Boolean),
    ...(insights.value?.categories || []).map((category) => category.name),
  ].filter((name) => name !== CATEGORY_ALL);

  return [CATEGORY_ALL, ...Array.from(new Set([...configured, ...fromData]))];
});

const uploadCategories = computed(() =>
  availableCategories.value.filter((category) => category !== CATEGORY_ALL),
);

const visiblePlugins = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let list = [...pluginsList.value];

  if (activeCategory.value !== CATEGORY_ALL) {
    list = list.filter((plugin) => plugin.category === activeCategory.value);
  }

  if (query) {
    list = list.filter((plugin) => {
      return [plugin.title, plugin.description, plugin.tags, plugin.compatibility, plugin.category]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }

  if (showFavoritesOnly.value) {
    list = list.filter((plugin) => favoritedIds.value.includes(plugin.id));
  }

  if (selectedTag.value !== 'all') {
    list = list.filter((plugin) => parseTags(plugin.tags).includes(selectedTag.value));
  }

  return list.sort((a, b) => {
    if (sortBy.value === 'popular') return b.downloads - a.downloads;
    if (sortBy.value === 'name')
      return a.title.localeCompare(b.title, locale.value === 'en-US' ? 'en-US' : 'zh-CN');
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
});

const stats = computed(() => ({
  total: insights.value?.summary.total || pluginsList.value.length,
  downloads:
    insights.value?.summary.downloads ||
    pluginsList.value.reduce((sum, plugin) => sum + plugin.downloads, 0),
  favorites: favoritedIds.value.length || insights.value?.summary.favoriteCount || 0,
  categories:
    insights.value?.summary.categories ||
    new Set(pluginsList.value.map((plugin) => plugin.category)).size,
}));

const spotlightPlugin = computed(() => {
  return (
    visiblePlugins.value[0] ||
    insights.value?.topDownloads?.[0] ||
    insights.value?.latest?.[0] ||
    null
  );
});

const marketplaceSignals = computed<MarketplaceSignal[]>(() => [
  {
    title: label('审核后公开', 'Reviewed publishing'),
    description: label(
      '插件包、脚本和封面图进入审核，通过后上架。',
      'Plugin packages, scripts, and covers go live after review.',
    ),
    Icon: ShieldCheck,
  },
  {
    title: label('兼容版本清楚', 'Clear compatibility'),
    description: label(
      '卡片优先展示宿主软件、版本号和适配范围。',
      'Cards emphasize host app, version, and compatibility.',
    ),
    Icon: CheckCircle2,
  },
  {
    title: label('安装说明沉淀', 'Install guides included'),
    description: label(
      '详情里保留依赖、安装步骤和注意事项。',
      'Details keep dependencies, install steps, and notes.',
    ),
    Icon: Wrench,
  },
]);

const normalizePlugin = (plugin: Partial<PluginItem> & Record<string, unknown>): PluginItem => ({
  id: String(plugin.id || crypto.randomUUID()),
  title: String(plugin.title || label('未命名插件', 'Untitled Plugin')),
  description: String(plugin.description || ''),
  category: String(plugin.category || CATEGORY_OTHER),
  tags: String(plugin.tags || ''),
  version: String(plugin.version || '1.0.0').replace(/^v/i, ''),
  compatibility: String(plugin.compatibility || label('未填写', 'Not specified')),
  downloads: Number(plugin.downloads || 0),
  fileUrl: typeof plugin.fileUrl === 'string' ? plugin.fileUrl : null,
  fileSize: typeof plugin.fileSize === 'number' ? plugin.fileSize : null,
  previewUrl: typeof plugin.previewUrl === 'string' ? plugin.previewUrl : null,
  installGuide: String(
    plugin.installGuide || label('作者暂未填写安装说明。', 'No installation guide yet.'),
  ),
  status: (plugin.status as PluginStatus) || 'APPROVED',
  rejectReason: typeof plugin.rejectReason === 'string' ? plugin.rejectReason : null,
  createdAt: String(plugin.createdAt || new Date().toISOString()),
  user: (plugin.user as PluginUser | null | undefined) || null,
});

watch([activeTab, myStatusFilter], () => {
  fetchPlugins();
});

const fetchPlugins = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get('/api/plugins', {
      params: {
        page: 1,
        pageSize: 80,
        search: searchQuery.value.trim() || undefined,
        category: activeCategory.value === CATEGORY_ALL ? undefined : activeCategory.value,
        mine: activeTab.value === 'mine' ? 'true' : undefined,
        favoritesOnly: activeTab.value === 'favorites' ? 'true' : undefined,
        status:
          activeTab.value === 'mine' && myStatusFilter.value !== 'all'
            ? myStatusFilter.value
            : undefined,
      },
    });
    const source = Array.isArray(data) ? data : data.plugins || [];
    pluginsList.value = source.map(normalizePlugin);
    await applyRoutePlugin();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('插件列表加载失败', 'Failed to load plugins')));
  } finally {
    isLoading.value = false;
  }
};

const fetchInsights = async () => {
  try {
    const { data } = await api.get('/api/plugins/insights');
    insights.value = data;
    favoritedIds.value = data.favoriteIds || [];
  } catch (error) {
    logError(error, { operation: 'fetchPluginInsights', view: 'PluginsView' });
  }
};

const fetchFavorites = async () => {
  try {
    const { data } = await api.get('/api/plugins/favorites');
    favoritedIds.value = data.ids || [];
  } catch (error) {
    logError(error, { operation: 'fetchPluginFavorites', view: 'PluginsView' });
  }
};

const resetFilters = () => {
  searchQuery.value = '';
  activeCategory.value = CATEGORY_ALL;
  selectedTag.value = 'all';
  showFavoritesOnly.value = false;
  fetchPlugins();
};

const openDetail = (plugin: PluginItem) => {
  selectedPlugin.value = plugin;
  isDetailDialogOpen.value = true;
};

const getRoutePluginId = () => {
  const plugin = route.query.plugin;
  return typeof plugin === 'string' ? plugin : '';
};

async function applyRoutePlugin() {
  const pluginId = getRoutePluginId();
  if (!pluginId || selectedPlugin.value?.id === pluginId) return;

  let plugin = pluginsList.value.find((item) => item.id === pluginId);
  if (!plugin) {
    try {
      const { data } = await api.get(`/api/plugins/${pluginId}`);
      const normalized = normalizePlugin(data);
      plugin = normalized;
      pluginsList.value = [
        normalized,
        ...pluginsList.value.filter((item) => item.id !== normalized.id),
      ];
    } catch (error) {
      logError(error, { operation: 'fetchPluginDetail', view: 'PluginsView' });
      return;
    }
  }
  if (!plugin) return;
  openDetail(plugin);
}

const isFavorited = (pluginId: string) => favoritedIds.value.includes(pluginId);

const toggleFavorite = async (pluginId: string, event?: Event) => {
  event?.stopPropagation();
  try {
    const { data } = await api.post(`/api/plugins/${pluginId}/favorite`);
    favoritedIds.value = data.favoriteIds || [];
    ElMessage.success(
      data.isFavorited
        ? label('已收藏插件', 'Plugin saved')
        : label('已取消收藏', 'Favorite removed'),
    );
    fetchInsights();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('收藏失败', 'Favorite failed')));
  }
};

const handleDownload = async (plugin: PluginItem, event?: Event) => {
  event?.stopPropagation();
  if (downloadingIds.value[plugin.id]) return;

  try {
    downloadingIds.value[plugin.id] = true;
    const { data } = await api.post(`/api/plugins/${plugin.id}/download`);
    const fileUrl = data.fileUrl || plugin.fileUrl;
    if (!fileUrl) {
      ElMessage.warning(label('该插件暂未提供下载文件', 'This plugin has no download file yet'));
      return;
    }
    plugin.downloads += 1;
    window.open(getAssetUrl(fileUrl), '_blank', 'noopener,noreferrer');
    fetchInsights();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('下载失败', 'Download failed')));
  } finally {
    delete downloadingIds.value[plugin.id];
  }
};

const processPluginFile = (file: File) => {
  pluginFile.value = file;
  if (!uploadForm.value.title.trim()) {
    uploadForm.value.title = file.name.replace(/\.[^.]+$/, '');
  }
};

const processPreviewFile = (file: File) => {
  previewFile.value = file;
};

const handlePluginFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) processPluginFile(file);
};

const handlePreviewFileChange = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) processPreviewFile(file);
};

const resetUploadForm = () => {
  uploadForm.value = {
    title: '',
    category: CATEGORY_OTHER,
    description: '',
    version: '1.0.0',
    compatibility: '',
    tags: '',
    installGuide: '',
  };
  pluginFile.value = null;
  previewFile.value = null;
};

const submitPlugin = async () => {
  if (!uploadForm.value.title.trim()) {
    ElMessage.warning(label('请填写插件名称', 'Please enter a plugin name'));
    return;
  }
  if (!pluginFile.value) {
    ElMessage.warning(label('请选择插件文件', 'Please choose a plugin file'));
    return;
  }

  const formData = new FormData();
  formData.append('plugin_file', pluginFile.value);
  if (previewFile.value) formData.append('plugin_preview', previewFile.value);
  Object.entries(uploadForm.value).forEach(([key, value]) => {
    formData.append(key, value);
  });

  try {
    isUploading.value = true;
    await api.post('/api/plugins/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success(
      label(
        '插件已提交审核，通过后会在插件库展示',
        'Plugin submitted for review and will appear after approval',
      ),
    );
    isUploadDialogOpen.value = false;
    resetUploadForm();
    await Promise.all([fetchPlugins(), fetchInsights()]);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, label('插件上传失败', 'Plugin upload failed')));
  } finally {
    isUploading.value = false;
  }
};

const getCategoryIcon = (category: string): Component => {
  if (category.includes('建模')) return Box;
  if (category.includes('材质')) return Layers;
  if (category.includes('渲染')) return Sun;
  if (category.includes('骨骼')) return Bone;
  if (category.includes('导入')) return Import;
  return Package;
};

const getCategoryTone = (category: string) => {
  if (category === '建模') return 'tone-orange';
  if (category === '材质与纹理') return 'tone-rose';
  if (category === '渲染与灯光') return 'tone-blue';
  if (category === '动画与骨骼') return 'tone-cyan';
  if (category === '导入与导出') return 'tone-emerald';
  if (category === '物理与特效') return 'tone-violet';
  return 'tone-slate';
};

const starterTemplates = computed<StarterPluginTemplate[]>(() => [
  {
    title: label('Blender 快速建模工具集', 'Blender Quick Modeling Kit'),
    description: label(
      '快捷添加基础几何、镜像对称及边缘导角工具。',
      'Quick tools for base geometry, mirror symmetry, and beveling.',
    ),
    category: '建模',
    compatibility: 'Blender 4.x',
    tags: ['Python', label('建模辅助', 'Modeling Utility'), 'Utility'],
    packageType: 'ZIP / PY',
    Icon: Box,
    tone: 'tone-orange',
  },
  {
    title: label('PBR 材质一键贴图', 'PBR Material Texture Mapper'),
    description: label(
      '为选中的模型一键导入和关联 Diffuse、Normal、Roughness 等贴图通道。',
      'Map Diffuse, Normal, Roughness channels for selected meshes in one click.',
    ),
    category: '材质与纹理',
    compatibility: 'Blender 3.x / 4.x',
    tags: ['PBR', label('材质', 'Material'), label('纹理', 'Texture')],
    packageType: 'ZIP / PY',
    Icon: Layers,
    tone: 'tone-rose',
  },
  {
    title: label('Blender 快速灯光预设', 'Blender Fast Light Studio'),
    description: label(
      '一键创建三点光源、HDRI 天空盒 and 渲染环境设置。',
      'One-click creation of three-point lighting, HDRI skybox, and rendering environment.',
    ),
    category: '渲染与灯光',
    compatibility: 'Blender 4.x',
    tags: ['Cycles', label('渲染', 'Rendering'), label('灯光', 'Lighting')],
    packageType: 'ZIP / PY',
    Icon: Sun,
    tone: 'tone-blue',
  },
  {
    title: label('FBX/GLTF 自动优化导出', 'FBX/GLTF Auto-Optimized Exporter'),
    description: label(
      '自动清理材质槽，重置比例与旋转，打包贴图并导出为最简 GLTF/FBX 文件。',
      'Clean material slots, reset transforms, pack textures, and export minimized GLTF/FBX.',
    ),
    category: '导入与导出',
    compatibility: 'Blender 3.6+',
    tags: ['gltf', label('导出', 'Export'), label('优化', 'Optimization')],
    packageType: 'ZIP / PY',
    Icon: Import,
    tone: 'tone-emerald',
  },
]);

const categoryTiles = computed(() => {
  const insightMap = new Map(
    (insights.value?.categories || []).map((category) => [category.name, category]),
  );

  return availableCategories.value.map((category) => {
    const isAll = category === CATEGORY_ALL;
    const fromInsights = insightMap.get(category);
    const pluginsInCategory = pluginsList.value.filter((plugin) => plugin.category === category);
    const count = isAll ? stats.value.total : (fromInsights?.count ?? pluginsInCategory.length);
    const downloads = isAll
      ? stats.value.downloads
      : (fromInsights?.downloads ??
        pluginsInCategory.reduce((sum, plugin) => sum + plugin.downloads, 0));

    return {
      name: category,
      count,
      downloads,
      Icon: isAll ? Puzzle : getCategoryIcon(category),
      tone: isAll ? 'tone-slate' : getCategoryTone(category),
    };
  });
});

const categoryTabOptions = computed(() => {
  return categoryTiles.value.map((category) => ({
    label: categoryLabel(category.name),
    badge: category.count,
    value: category.name,
  }));
});

const topDownloadPlugins = computed(() => (insights.value?.topDownloads || []).slice(0, 5));
const latestPlugins = computed(() => (insights.value?.latest || []).slice(0, 5));
const sideCategories = computed(() => {
  if (insights.value?.categories?.length) return insights.value.categories.slice(0, 5);
  return categoryTiles.value
    .filter((category) => category.name !== CATEGORY_ALL)
    .slice(0, 5)
    .map((category) => ({
      name: category.name,
      count: category.count,
      downloads: category.downloads,
    }));
});

const startFromTemplate = (template: StarterPluginTemplate) => {
  resetUploadForm();
  uploadForm.value = {
    ...uploadForm.value,
    title: template.title,
    category: template.category,
    description: template.description,
    compatibility: template.compatibility,
    tags: template.tags.join(', '),
    installGuide: label(
      '1. 将插件包解压到 Blender 插件目录。\n2. 在软件偏好设置中启用插件。\n3. 按项目规范填写依赖版本和使用注意事项。',
      '1. Extract the package into the Blender plugin directory.\n2. Enable it from the Blender preferences.\n3. Document dependencies, versions, and usage notes.',
    ),
  };
  isUploadDialogOpen.value = true;
};

const isStatsExpanded = ref(false);
const isFilterOpen = ref(false);

const favoriteSelectedPlugin = () => {
  if (selectedPlugin.value) toggleFavorite(selectedPlugin.value.id);
};

const downloadSelectedPlugin = () => {
  if (selectedPlugin.value) handleDownload(selectedPlugin.value);
};

onMounted(() => {
  systemStore.fetchSettings();
  fetchPlugins();
  fetchInsights();
  fetchFavorites();
});

watch(
  () => route.query.plugin,
  () => {
    applyRoutePlugin();
  },
);
</script>

<template>
  <div class="plugins-page mobile-adaptive">
    <PluginPageHeader
      v-model:search-query="searchQuery"
      :is-loading="isLoading"
      :is-stats-expanded="isStatsExpanded"
      @toggle-stats="isStatsExpanded = !isStatsExpanded"
      @refresh="
        fetchPlugins();
        fetchInsights();
      "
      @upload="isUploadDialogOpen = true"
    />

    <PluginMarketOverview
      :is-visible="isStatsExpanded"
      :spotlight-plugin="spotlightPlugin"
      :starter-templates="starterTemplates"
      :marketplace-signals="marketplaceSignals"
      @open-detail="openDetail"
      @start-from-template="startFromTemplate"
    />

    <PluginStatsStrip
      :is-visible="isStatsExpanded"
      :total="stats.total"
      :downloads="stats.downloads"
      :favorites="stats.favorites"
      :categories="stats.categories"
    />

    <div class="workspace-shell">
      <PluginFiltersPanel
        :is-open="isFilterOpen"
        :active-category="activeCategory"
        :active-tab="activeTab"
        :my-status-filter="myStatusFilter"
        :selected-tag="selectedTag"
        :category-tab-options="categoryTabOptions"
        :status-tab-options="statusTabOptions"
        :hot-tags="insights?.hotTags || []"
        @update:active-category="activeCategory = $event"
        @update:my-status-filter="myStatusFilter = $event"
        @update:selected-tag="selectedTag = $event"
        @fetch-plugins="fetchPlugins"
      />

      <main class="content-panel">
        <PluginToolbar
          :active-tab="activeTab"
          :library-tab-options="libraryTabOptions"
          :sort-by="sortBy"
          :view-mode="viewMode"
          :view-mode-options="viewModeOptions"
          :show-favorites-only="showFavoritesOnly"
          :is-filter-open="isFilterOpen"
          @update:active-tab="activeTab = $event"
          @update:sort-by="sortBy = $event"
          @update:view-mode="viewMode = $event"
          @toggle-favorites="showFavoritesOnly = !showFavoritesOnly"
          @toggle-filter="isFilterOpen = !isFilterOpen"
        />

        <section class="market-shell">
          <PluginCatalog
            :plugins="visiblePlugins"
            :is-loading="isLoading"
            :view-mode="viewMode"
            :active-tab="activeTab"
            :favorited-ids="favoritedIds"
            :downloading-ids="downloadingIds"
            @open-detail="openDetail"
            @toggle-favorite="toggleFavorite"
            @download="handleDownload"
            @reset-filters="resetFilters"
            @upload="isUploadDialogOpen = true"
          />

          <PluginInsightPanel
            :top-download-plugins="topDownloadPlugins"
            :latest-plugins="latestPlugins"
            :side-categories="sideCategories"
            :starter-templates="starterTemplates"
            @open-detail="openDetail"
            @start-from-template="startFromTemplate"
            @set-category="
              activeCategory = $event;
              fetchPlugins();
            "
          />
        </section>
      </main>
    </div>

    <PluginDetailModal
      :show="isDetailDialogOpen"
      :plugin="selectedPlugin"
      :is-favorited="selectedPlugin ? isFavorited(selectedPlugin.id) : false"
      :is-downloading="selectedPlugin ? !!downloadingIds[selectedPlugin.id] : false"
      @close="isDetailDialogOpen = false"
      @favorite="favoriteSelectedPlugin"
      @download="downloadSelectedPlugin"
    />

    <PluginUploadModal
      :show="isUploadDialogOpen"
      :form="uploadForm"
      :upload-categories="uploadCategories"
      :plugin-file="pluginFile"
      :preview-file="previewFile"
      :is-uploading="isUploading"
      @close="isUploadDialogOpen = false"
      @submit="submitPlugin"
      @update:form="uploadForm = $event"
      @update:plugin-file="pluginFile = $event"
      @update:preview-file="previewFile = $event"
      @plugin-file-change="handlePluginFileChange"
      @preview-file-change="handlePreviewFileChange"
    />
  </div>
</template>

<style scoped>
.plugins-page {
  min-height: 100%;
  padding: 16px;
  background:
    linear-gradient(
      180deg,
      rgba(37, 99, 235, 0.05),
      rgba(20, 184, 166, 0.03) 200px,
      transparent 380px
    ),
    transparent !important;
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

.content-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.market-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 12px;
}

@media (max-width: 1180px) {
  .market-shell {
    grid-template-columns: minmax(0, 1fr) 250px;
  }
}

@media (max-width: 980px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }

  .market-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .plugins-page {
    padding: 12px;
  }
}
</style>
