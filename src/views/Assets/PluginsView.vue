<script setup lang="ts">
import { formatDate } from '@/utils/format';
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { useRoute } from 'vue-router';
import {
  BarChart3,
  Box,
  Bone,
  CalendarClock,
  CheckCircle2,
  Cpu,
  Download,
  Eye,
  EyeOff,
  Heart,
  Import,
  Layers,
  Loader2,
  Package,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Sun,
  Tags,
  Wrench,
  X,
  Grid3X3,
  LayoutList,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useSystemStore } from '@/stores/system';
import FileDropZone from '@/components/FileDropZone.vue';
import Input from '@/components/ui/Input.vue';
import Tabs from '@/components/ui/Tabs.vue';
import UnifiedCard from '@/components/UnifiedCard.vue';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import { formatCompactNumber, formatRelativeTime, parseTags } from './resourceUtils';

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
const baseCategories = [
  CATEGORY_ALL,
  '建模',
  '材质与纹理',
  '渲染与灯光',
  '动画与骨骼',
  '导入与导出',
  '物理与特效',
  CATEGORY_OTHER,
];

const { locale } = useI18n();
const route = useRoute();

const label = (zh: string, en: string) => (locale.value === 'en-US' ? en : zh);

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
const viewModeOptions = computed(() => [
  { value: 'grid', label: '', icon: Grid3X3 },
  { value: 'list', label: '', icon: LayoutList },
]);
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
    console.error('Failed to fetch plugin insights:', error);
  }
};

const fetchFavorites = async () => {
  try {
    const { data } = await api.get('/api/plugins/favorites');
    favoritedIds.value = data.ids || [];
  } catch (error) {
    console.error('Failed to fetch plugin favorites:', error);
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
      console.error('Failed to fetch plugin detail:', error);
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

const formatSize = (size?: number | null) => {
  if (!size) return label('未知大小', 'Unknown size');
  if (size >= 1) return `${size.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size * 1024))} KB`;
};

const getTagsList = (tags?: string) =>
  (tags || '')
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);

const getAuthorName = (plugin: PluginItem) =>
  plugin.user?.name || plugin.user?.email || label('创作者', 'Creator');

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
  <div class="plugins-page">
    <header class="page-header">
      <div class="title-block">
        <div class="title-icon">
          <Puzzle class="icon-sm" />
        </div>
        <div>
          <h1>{{ label('Blender 插件库', 'Blender Add-ons') }}</h1>
          <p>
            {{
              label(
                '集中管理 Blender 建模、材质、动画、渲染等相关插件与创作工具。',
                'Manage Blender plugins, including modeling, materials, animation, rendering tools.',
              )
            }}
          </p>
        </div>
      </div>

      <div class="header-actions">
        <button type="button" class="ghost-button" @click="isStatsExpanded = !isStatsExpanded">
          <component :is="isStatsExpanded ? EyeOff : Eye" class="icon-sm" />
          {{ isStatsExpanded ? label('收起指标', 'Hide Stats') : label('数据指标', 'Show Stats') }}
        </button>
        <button
          type="button"
          class="ghost-button"
          :disabled="isLoading"
          @click="
            fetchPlugins();
            fetchInsights();
          "
        >
          <RefreshCw class="icon-sm" :class="{ spinning: isLoading }" />
          {{ label('刷新', 'Refresh') }}
        </button>
        <button type="button" class="primary-button" @click="isUploadDialogOpen = true">
          <Plus class="icon-sm" />
          {{ label('上传插件', 'Upload Plugin') }}
        </button>
      </div>
    </header>

    <section v-show="isStatsExpanded" class="market-overview">
      <div class="overview-copy">
        <div class="eyebrow market-eyebrow">
          <Puzzle class="icon-sm" />
          {{ label('Blender 插件中心', 'Blender Add-on Hub') }}
        </div>
        <h2>
          {{
            label(
              '把 Python 脚本、插件和工具包集中上架',
              'Ship Python scripts, add-ons, and toolkits in one catalog',
            )
          }}
        </h2>
        <p>
          {{
            label(
              '按宿主软件、兼容版本、标签和安装说明浏览，让插件像应用商店一样可发现、可维护。',
              'Browse by host app, compatibility, tags, and install guides so plugins feel discoverable and maintainable.',
            )
          }}
        </p>
        <div class="format-strip" :aria-label="label('支持的插件格式', 'Supported plugin formats')">
          <span>ZIP</span>
          <span>PY</span>
        </div>
      </div>

      <div class="spotlight-panel">
        <div class="side-title">
          <Star class="icon-sm" />
          {{
            spotlightPlugin
              ? label('当前推荐', 'Spotlight')
              : label('插件卡片预览', 'Plugin Card Preview')
          }}
        </div>
        <button
          v-if="spotlightPlugin"
          type="button"
          class="spotlight-row"
          @click="openDetail(spotlightPlugin)"
        >
          <span class="spotlight-icon" :class="getCategoryTone(spotlightPlugin.category)">
            <component :is="getCategoryIcon(spotlightPlugin.category)" class="icon-sm" />
          </span>
          <span>
            <strong>{{ spotlightPlugin.title }}</strong>
            <small
              >{{ categoryLabel(spotlightPlugin.category) }} · v{{ spotlightPlugin.version }}</small
            >
          </span>
          <b>{{ formatCompactNumber(spotlightPlugin.downloads) }}</b>
        </button>
        <button
          v-else
          type="button"
          class="spotlight-row"
          @click="startFromTemplate(starterTemplates[0])"
        >
          <span class="spotlight-icon tone-orange">
            <Box class="icon-sm" />
          </span>
          <span>
            <strong>{{ starterTemplates[0].title }}</strong>
            <small
              >{{ starterTemplates[0].compatibility }} ·
              {{ starterTemplates[0].packageType }}</small
            >
          </span>
          <b>{{ label('模板', 'Template') }}</b>
        </button>
      </div>

      <div class="signal-stack">
        <div v-for="signal in marketplaceSignals" :key="signal.title" class="signal-item">
          <span class="signal-icon">
            <component :is="signal.Icon" class="icon-sm" />
          </span>
          <span>
            <strong>{{ signal.title }}</strong>
            <small>{{ signal.description }}</small>
          </span>
        </div>
      </div>
    </section>

    <section v-show="isStatsExpanded" class="stats-strip">
      <div class="stat">
        <span><Package class="icon-sm" />{{ label('插件总数', 'Plugins') }}</span>
        <strong>{{ stats.total }}</strong>
      </div>
      <div class="stat">
        <span><Download class="icon-sm" />{{ label('总下载', 'Downloads') }}</span>
        <strong>{{ formatCompactNumber(stats.downloads) }}</strong>
      </div>
      <div class="stat">
        <span><Heart class="icon-sm" />{{ label('已收藏', 'Saved') }}</span>
        <strong>{{ stats.favorites }}</strong>
      </div>
      <div class="stat">
        <span><Tags class="icon-sm" />{{ label('分类', 'Categories') }}</span>
        <strong>{{ stats.categories }}</strong>
      </div>
    </section>

    <div class="workspace-shell">
      <aside class="filter-panel" :class="{ open: isFilterOpen }">
        <div class="panel-section">
          <div class="section-title">
            <Layers class="icon-sm" />
            {{ label('分类', 'Categories') }}
          </div>
          <Tabs
            v-model="activeCategory"
            :options="categoryTabOptions"
            direction="vertical"
            size="sm"
            @change="fetchPlugins"
          />
        </div>

        <div v-if="activeTab === 'mine'" class="panel-section">
          <div class="section-title">
            <SlidersHorizontal class="icon-sm" />
            {{ label('状态', 'Status') }}
          </div>
          <Tabs
            v-model="myStatusFilter"
            :options="statusTabOptions"
            direction="vertical"
            size="sm"
          />
        </div>

        <div v-if="insights?.hotTags?.length" class="panel-section">
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
              v-for="tag in insights.hotTags"
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
          <div class="toolbar-left">
            <button
              type="button"
              class="icon-button mobile-filter"
              @click="isFilterOpen = !isFilterOpen"
            >
              <SlidersHorizontal class="icon-sm" />
            </button>
            <Tabs v-model="activeTab" :options="libraryTabOptions" size="sm" />
          </div>

          <div class="toolbar-center">
            <Input
              v-model="searchQuery"
              type="search"
              :placeholder="label('搜索插件、标签、兼容版本', 'Search plugins, tags, or versions')"
              :icon="Search"
              clearable
              input-class="!py-1.5 !h-8.5 !rounded-lg"
              class="w-full max-w-[280px]"
              @keydown.enter="fetchPlugins"
            />
          </div>

          <div class="toolbar-right">
            <select v-model="sortBy" class="select-field" aria-label="排序方式">
              <option value="latest">{{ label('最新发布', 'Newest') }}</option>
              <option value="popular">{{ label('下载最多', 'Most Downloaded') }}</option>
              <option value="name">{{ label('名称排序', 'Name') }}</option>
            </select>
            <button
              type="button"
              class="ghost-button"
              :class="{ active: showFavoritesOnly }"
              @click="showFavoritesOnly = !showFavoritesOnly"
            >
              <Heart class="icon-sm" />
              {{ label('收藏', 'Saved') }}
            </button>
            <Tabs v-model="viewMode" :options="viewModeOptions" size="sm" />
          </div>
        </section>

        <section class="market-shell">
          <main class="plugin-content">
            <div class="library-heading">
              <div>
                <strong>{{ label('插件列表', 'Plugin Catalog') }}</strong>
                <span>
                  {{
                    visiblePlugins.length
                      ? label(
                          `当前显示 ${visiblePlugins.length} 个插件`,
                          `${visiblePlugins.length} plugins shown`,
                        )
                      : label(
                          '浏览插件模板或上传你的第一个插件',
                          'Browse plugin templates or publish the first plugin',
                        )
                  }}
                </span>
              </div>
              <button type="button" class="text-button" @click="resetFilters">
                {{ label('重置筛选', 'Reset Filters') }}
              </button>
            </div>

            <div
              v-if="isLoading"
              :class="viewMode === 'list' ? 'flex flex-col gap-3' : 'plugin-grid'"
            >
              <div
                v-for="index in 8"
                :key="index"
                class="plugin-card skeleton-card"
                :class="{ 'list-row': viewMode === 'list' }"
              >
                <div
                  class="skeleton preview"
                  :class="{ 'list-preview': viewMode === 'list' }"
                ></div>
                <div class="skeleton line wide"></div>
                <div class="skeleton line"></div>
              </div>
            </div>

            <div
              v-else-if="visiblePlugins.length"
              :class="viewMode === 'list' ? 'flex flex-col gap-3' : 'plugin-grid'"
            >
              <UnifiedCard
                v-for="plugin in visiblePlugins"
                :key="plugin.id"
                :item="plugin"
                kind="plugin"
                :view-mode="viewMode"
                :is-favorited="isFavorited(plugin.id)"
                :downloading="!!downloadingIds[plugin.id]"
                :active-tab="activeTab"
                @click="openDetail(plugin)"
                @like="(item, event) => toggleFavorite(plugin.id, event)"
                @download="(item, event) => handleDownload(plugin, event)"
              />
            </div>

            <div v-else class="starter-market">
              <div class="empty-state">
                <Cpu class="empty-icon" />
                <h2>{{ label('还没有匹配的插件', 'No Matching Plugins') }}</h2>
                <p>
                  {{
                    label(
                      '可以调整筛选条件，也可以从下面的插件方向开始发布。',
                      'Adjust filters or start publishing from one of the plugin directions below.',
                    )
                  }}
                </p>
                <div class="empty-actions">
                  <button type="button" class="primary-button" @click="isUploadDialogOpen = true">
                    <Plus class="icon-sm" />
                    {{ label('上传插件', 'Upload Plugin') }}
                  </button>
                  <button type="button" class="ghost-button" @click="resetFilters">
                    <RefreshCw class="icon-sm" />
                    {{ label('查看全部', 'Show All') }}
                  </button>
                </div>
              </div>
            </div>
          </main>

          <aside class="insight-panel">
            <section class="side-section">
              <div class="side-title">
                <BarChart3 class="icon-sm" />
                {{ label('下载榜', 'Top Downloads') }}
              </div>
              <button
                v-for="(plugin, index) in topDownloadPlugins"
                :key="plugin.id"
                type="button"
                class="rank-item"
                @click="openDetail(plugin)"
              >
                <span class="rank-badge" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
                <span class="rank-icon" :class="getCategoryTone(plugin.category)">
                  <component :is="getCategoryIcon(plugin.category)" class="icon-sm" />
                </span>
                <span class="rank-title">{{ plugin.title }}</span>
                <strong class="rank-value">{{ formatCompactNumber(plugin.downloads) }}</strong>
              </button>
              <div v-if="!topDownloadPlugins.length" class="side-placeholder">
                <Download class="icon-sm" />
                <span>{{
                  label(
                    '下载榜会在插件产生下载后自动生成',
                    'Top downloads appear after plugins get downloads',
                  )
                }}</span>
              </div>
            </section>

            <section class="side-section">
              <div class="side-title">
                <CalendarClock class="icon-sm" />
                {{ label('最新插件', 'Latest Plugins') }}
              </div>
              <button
                v-for="plugin in latestPlugins"
                :key="plugin.id"
                type="button"
                class="activity-item"
                @click="openDetail(plugin)"
              >
                <span>{{ plugin.title }}</span>
                <small>{{ formatRelativeTime(plugin.createdAt) }}</small>
              </button>
              <button
                v-for="template in !latestPlugins.length ? starterTemplates.slice(0, 3) : []"
                :key="template.title"
                type="button"
                class="activity-item template-activity"
                @click="startFromTemplate(template)"
              >
                <span>{{ template.title }}</span>
                <small>{{ template.compatibility }}</small>
              </button>
            </section>

            <section class="side-section">
              <div class="side-title">
                <Tags class="icon-sm" />
                {{ label('分类热度', 'Category Heat') }}
              </div>
              <button
                v-for="category in sideCategories"
                :key="category.name"
                type="button"
                class="category-rank"
                @click="
                  activeCategory = category.name;
                  fetchPlugins();
                "
              >
                <span>{{ categoryLabel(category.name) }}</span>
                <strong>{{ category.count }}</strong>
              </button>
            </section>
          </aside>
        </section>
      </main>
    </div>

    <Transition name="fade">
      <div v-if="isDetailDialogOpen && selectedPlugin" class="modal-layer">
        <div class="modal-backdrop" @click="isDetailDialogOpen = false"></div>
        <section class="detail-dialog">
          <button type="button" class="close-button" @click="isDetailDialogOpen = false">
            <X class="icon-sm" />
          </button>

          <div class="detail-hero" :class="getCategoryTone(selectedPlugin.category)">
            <img
              v-if="selectedPlugin.previewUrl"
              :src="getAssetUrl(selectedPlugin.previewUrl)"
              :alt="selectedPlugin.title"
            />
            <component :is="getCategoryIcon(selectedPlugin.category)" v-else class="preview-icon" />
          </div>

          <div class="detail-body">
            <div class="meta-row">
              <span class="category-pill">{{ categoryLabel(selectedPlugin.category) }}</span>
              <span class="version-pill">v{{ selectedPlugin.version }}</span>
            </div>
            <h2>{{ selectedPlugin.title }}</h2>
            <p>
              {{
                selectedPlugin.description ||
                label('作者暂未填写简介。', 'No plugin description yet.')
              }}
            </p>

            <dl class="detail-grid">
              <div>
                <dt>{{ label('兼容版本', 'Compatible With') }}</dt>
                <dd>{{ selectedPlugin.compatibility }}</dd>
              </div>
              <div>
                <dt>{{ label('文件大小', 'File Size') }}</dt>
                <dd>{{ formatSize(selectedPlugin.fileSize) }}</dd>
              </div>
              <div>
                <dt>{{ label('发布时间', 'Published') }}</dt>
                <dd>{{ formatDate(selectedPlugin.createdAt) }}</dd>
              </div>
              <div>
                <dt>{{ label('下载次数', 'Downloads') }}</dt>
                <dd>{{ selectedPlugin.downloads }}</dd>
              </div>
            </dl>

            <div class="tag-row detail-tags">
              <span v-for="tag in getTagsList(selectedPlugin.tags)" :key="tag">#{{ tag }}</span>
            </div>

            <section class="install-box">
              <h3>{{ label('安装说明', 'Installation Guide') }}</h3>
              <p>{{ selectedPlugin.installGuide }}</p>
            </section>
          </div>

          <footer class="detail-footer">
            <button
              type="button"
              class="ghost-button"
              :class="{ active: isFavorited(selectedPlugin.id) }"
              @click="toggleFavorite(selectedPlugin.id)"
            >
              <Heart class="icon-sm" :class="{ filled: isFavorited(selectedPlugin.id) }" />
              {{
                isFavorited(selectedPlugin.id) ? label('已收藏', 'Saved') : label('收藏', 'Save')
              }}
            </button>
            <button
              type="button"
              class="primary-button"
              :disabled="downloadingIds[selectedPlugin.id]"
              @click="handleDownload(selectedPlugin)"
            >
              <Loader2 v-if="downloadingIds[selectedPlugin.id]" class="icon-sm spinning" />
              <Download v-else class="icon-sm" />
              {{ label('下载插件', 'Download Plugin') }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>

    <Transition name="fade">
      <div v-if="isUploadDialogOpen" class="modal-layer">
        <div class="modal-backdrop" @click="isUploadDialogOpen = false"></div>
        <section class="upload-dialog">
          <header>
            <div>
              <h2>{{ label('上传插件', 'Upload Plugin') }}</h2>
              <p>
                {{
                  label(
                    '提交后进入管理员审核，通过后公开展示。',
                    'Submissions enter admin review before public listing.',
                  )
                }}
              </p>
            </div>
            <button type="button" class="close-button" @click="isUploadDialogOpen = false">
              <X class="icon-sm" />
            </button>
          </header>

          <div class="upload-grid">
            <label>
              <span>{{ label('插件名称', 'Plugin Name') }}</span>
              <input
                v-model="uploadForm.title"
                type="text"
                :placeholder="label('给插件起个清晰的名字', 'Give the plugin a clear name')"
              />
            </label>
            <label>
              <span>{{ label('分类', 'Category') }}</span>
              <select v-model="uploadForm.category">
                <option v-for="category in uploadCategories" :key="category" :value="category">
                  {{ categoryLabel(category) }}
                </option>
              </select>
            </label>
            <label>
              <span>{{ label('版本', 'Version') }}</span>
              <input v-model="uploadForm.version" type="text" placeholder="1.0.0" />
            </label>
            <label>
              <span>{{ label('兼容版本', 'Compatibility') }}</span>
              <input
                v-model="uploadForm.compatibility"
                type="text"
                :placeholder="
                  label('如 Blender 4.x / Three.js r160+', 'e.g. Blender 4.x / Three.js r160+')
                "
              />
            </label>
            <label class="wide">
              <span>{{ label('标签', 'Tags') }}</span>
              <input
                v-model="uploadForm.tags"
                type="text"
                :placeholder="
                  label(
                    '用逗号分隔，如 glTF, 优化, 渲染',
                    'Comma-separated, e.g. glTF, optimize, render',
                  )
                "
              />
            </label>
            <label class="wide">
              <span>{{ label('简介', 'Description') }}</span>
              <textarea
                v-model="uploadForm.description"
                rows="3"
                :placeholder="
                  label(
                    '介绍插件用途、适用场景和核心能力',
                    'Describe use cases, scenarios, and core capabilities',
                  )
                "
              ></textarea>
            </label>
            <label class="wide">
              <span>{{ label('安装说明', 'Installation Guide') }}</span>
              <textarea
                v-model="uploadForm.installGuide"
                rows="4"
                :placeholder="
                  label(
                    '写清楚安装步骤、依赖版本和注意事项',
                    'Include install steps, dependencies, and notes',
                  )
                "
              ></textarea>
            </label>
          </div>

          <div class="file-grid">
            <div class="w-full">
              <FileDropZone
                v-model="pluginFile"
                accept=".zip,.py,.js,.jsx,.ts,.tsx,.blend,.addon,.tgz,.tar,.gz"
                :label="pluginFile?.name || label('选择插件文件', 'Choose Plugin File')"
                :sublabel="
                  pluginFile
                    ? formatSize(pluginFile.size / 1024 / 1024)
                    : label(
                        '支持 ZIP、脚本、插件包等格式',
                        'Supports ZIP, scripts, and plugin packages',
                      )
                "
                height-class="h-28"
                @change="handlePluginFileChange"
              />
            </div>

            <div class="w-full">
              <FileDropZone
                v-model="previewFile"
                accept="image/*"
                :label="previewFile?.name || label('上传预览图', 'Upload Preview')"
                :sublabel="
                  previewFile
                    ? formatSize(previewFile.size / 1024 / 1024)
                    : label('可选，用于插件卡片封面', 'Optional cover for plugin cards')
                "
                height-class="h-28"
                @change="handlePreviewFileChange"
              />
            </div>
          </div>

          <footer>
            <button type="button" class="ghost-button" @click="isUploadDialogOpen = false">
              {{ label('取消', 'Cancel') }}
            </button>
            <button
              type="button"
              class="primary-button"
              :disabled="isUploading"
              @click="submitPlugin"
            >
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

/* Sidebar Layout & Vertical Filters */
.workspace-shell {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
  margin-top: 12px;
}

.filter-panel {
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
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

.content-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

@media (max-width: 980px) {
  .workspace-shell {
    grid-template-columns: 1fr;
  }
  .filter-panel {
    display: none;
  }
  .filter-panel.open {
    display: flex;
    position: fixed;
    top: 50px;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    border-radius: 0;
    border: 0;
    background: var(--bg-card);
    overflow: auto;
  }
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  min-height: 32px;
}

.title-block {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.title-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--accent);
  background: var(--accent-subtle);
}

.title-block h1 {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  line-height: 1.2;
}

.title-block p {
  margin-top: 1px;
  color: var(--text-muted);
  font-size: 10px;
  margin-bottom: 0;
  line-height: 1.2;
}

.eyebrow,
.meta-row,
.header-actions,
.toolbar,
.toolbar-actions,
.card-footer,
.detail-footer,
.side-title,
.empty-actions,
.upload-dialog header,
.upload-dialog footer {
  display: flex;
  align-items: center;
}

.eyebrow {
  gap: 4px;
  color: #0f766e;
  font-size: 10px;
  font-weight: 600;
  margin-bottom: 4px;
}

h1,
h2,
h3,
p {
  margin: 0;
}

.plugins-header h1 {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.plugins-header p,
.overview-copy p,
.upload-dialog header p,
.empty-state p {
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 11px;
}

.header-actions,
.toolbar-actions,
.detail-footer,
.upload-dialog footer {
  gap: 8px;
}

/* Base Buttons */
.primary-button,
.ghost-button,
.download-button,
.favorite-button,
.close-button,
.text-button {
  cursor: pointer;
  transition: all 0.15s ease;
}

.primary-button,
.ghost-button,
.download-button,
.text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  border-radius: 6px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-base);
}

.primary-button {
  border-color: transparent;
  background: var(--accent);
  color: white;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
}

.primary-button:hover {
  background: var(--accent-hover);
  transform: translateY(-0.5px);
}

.ghost-button {
  background: var(--bg-card);
  color: var(--text-primary);
}

.ghost-button:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.ghost-button.active {
  border-color: rgba(37, 99, 235, 0.25);
  color: var(--accent);
  background: var(--accent-subtle);
}

.text-button {
  border-color: transparent;
  background: transparent;
  color: var(--accent);
  padding: 0 6px;
  font-size: 11px;
  font-weight: 600;
}

.primary-button:disabled,
.ghost-button:disabled,
.download-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.icon-sm {
  width: 14px;
  height: 14px;
}

/* Market Overview section */
.market-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(240px, 0.75fr) minmax(250px, 0.8fr);
  gap: 10px;
  margin-bottom: 10px;
}

.overview-copy,
.spotlight-panel,
.signal-item {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}

.overview-copy {
  min-height: 100px;
  padding: 10px 14px;
  background:
    linear-gradient(
      135deg,
      rgba(37, 99, 235, 0.06),
      rgba(20, 184, 166, 0.05) 55%,
      rgba(249, 115, 22, 0.05)
    ),
    var(--bg-card);
}

.market-eyebrow {
  color: var(--accent);
}

.overview-copy h2 {
  max-width: 760px;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.overview-copy p {
  max-width: 760px;
  line-height: 1.4;
  font-size: 11px;
  margin-top: 3px;
  color: var(--text-secondary);
}

.format-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.format-strip span,
.package-type {
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: #1d4ed8;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 600;
}

.dark .format-strip span,
.dark .package-type {
  background: rgba(15, 23, 42, 0.6);
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.2);
}

.spotlight-panel {
  display: grid;
  align-content: start;
  gap: 6px;
  min-height: 100px;
  padding: 8px;
}

.spotlight-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
  width: 100%;
  min-height: 48px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-hover);
  color: var(--text-primary);
  padding: 6px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.spotlight-row:hover {
  border-color: var(--accent);
  background: var(--accent-subtle);
  transform: translateY(-0.5px);
}

.spotlight-icon,
.signal-icon,
.category-icon,
.starter-icon {
  display: grid;
  place-items: center;
  color: #fff;
  border-radius: 6px;
}

.spotlight-icon {
  width: 24px;
  height: 24px;
}

.spotlight-row strong,
.signal-item strong,
.library-heading strong,
.starter-card h3 {
  display: block;
  overflow: hidden;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spotlight-row strong {
  font-size: 12px;
  font-weight: 600;
}

.spotlight-row small,
.signal-item small,
.library-heading span {
  display: block;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spotlight-row b {
  color: var(--accent);
  font-size: 11px;
}

.signal-stack {
  display: grid;
  gap: 6px;
}

.signal-item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 4px 6px;
}

.signal-item strong {
  font-size: 11px;
  font-weight: 600;
}

.signal-icon {
  width: 24px;
  height: 24px;
  background: #0f766e;
}

/* Stats Strip */
.stats-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 36px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 4px 10px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  transition: all 0.15s ease;
}

.stat:hover {
  transform: translateY(-1px);
  border-color: var(--accent);
  box-shadow: var(--shadow-card-hover);
}

.stat span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.stat strong {
  display: block;
  font-size: 15px;
  font-weight: 700;
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
  margin-bottom: 8px;
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

.search-box {
  flex: 1;
  min-width: 220px;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 0 10px;
  background: var(--bg-card);
  transition: all 0.15s ease;
}

.search-box:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-subtle);
}

.select-field {
  min-width: 100px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 0 8px;
  background: var(--bg-card);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.select-field:hover {
  border-color: var(--border-strong);
}

.select-field:focus {
  border-color: var(--accent);
}

/* Category Tabs Wrapper */
.category-tabs-wrapper {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-tabs-wrapper::-webkit-scrollbar {
  display: none;
}

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

/* Shell & Layout */
.market-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 12px;
}

.plugin-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.library-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.library-heading strong {
  font-size: 13px;
  font-weight: 600;
}

.library-heading span {
  font-size: 10px;
  color: var(--text-muted);
}

/* Grid layout */
.plugin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

/* List layout modifications */
.plugin-card.list-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.plugin-preview.list-preview {
  width: 100px;
  height: 64px;
  flex-shrink: 0;
}

.plugin-body.list-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  padding: 8px 12px;
}

.plugin-body.list-body h2 {
  margin-top: 0;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plugin-body.list-body .meta-row {
  flex-shrink: 0;
}

.plugin-body.list-body .compat-row {
  margin-top: 0;
  flex-shrink: 0;
}

.plugin-body.list-body .card-footer {
  margin-top: 0;
  border-top: none;
  padding-top: 0;
  flex-shrink: 0;
  gap: 12px;
}

.plugin-body.list-body .card-footer > div {
  display: none; /* Hide author name and size in simple list mode to make it compact */
}

/* Plugin Cards */
.plugin-card {
  overflow: hidden;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: all 0.18s ease;
}

.plugin-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

/* Category hover glows mapping */
.plugin-card:hover:has(.tone-orange) {
  border-color: rgba(249, 115, 22, 0.4);
}
.plugin-card:hover:has(.tone-blue) {
  border-color: rgba(37, 99, 235, 0.4);
}
.plugin-card:hover:has(.tone-rose) {
  border-color: rgba(225, 29, 72, 0.4);
}
.plugin-card:hover:has(.tone-cyan) {
  border-color: rgba(8, 145, 178, 0.4);
}
.plugin-card:hover:has(.tone-emerald) {
  border-color: rgba(5, 150, 105, 0.4);
}
.plugin-card:hover:has(.tone-violet) {
  border-color: rgba(124, 58, 237, 0.4);
}

.plugin-preview {
  position: relative;
  height: 100px;
  display: grid;
  place-items: center;
  overflow: hidden;
  transition: all 0.2s ease;
}

.plugin-preview img,
.detail-hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.plugin-card:hover .plugin-preview img {
  transform: scale(1.03);
}

.preview-icon {
  width: 32px;
  height: 32px;
  color: rgba(255, 255, 255, 0.85);
}

.favorite-button,
.close-button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
  color: #475569;
  border: 1px solid var(--border-base);
}

.favorite-button {
  position: absolute;
  top: 8px;
  right: 8px;
}

.favorite-button.active,
.filled {
  color: #e11d48;
  fill: #e11d48;
}

.plugin-body {
  padding: 10px;
}

.meta-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.category-pill,
.version-pill {
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 9px;
  font-weight: 600;
}

.category-pill {
  color: var(--accent);
  background: var(--accent-subtle);
}

.version-pill {
  color: #0f766e;
  background: rgba(20, 184, 166, 0.08);
}

.plugin-body h2 {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}

.plugin-body p {
  min-height: 30px;
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.4;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.compat-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 18px;
  margin-top: 6px;
  color: #0f766e;
  font-size: 10px;
  font-weight: 600;
}

.compat-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 18px;
  margin-top: 6px;
}

.tag-row span {
  border-radius: 4px;
  padding: 1px 5px;
  background: var(--bg-app);
  color: var(--text-secondary);
  font-size: 9px;
  font-weight: 500;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border-base);
}

.card-footer div {
  min-width: 0;
}

.card-footer strong,
.card-footer span {
  display: block;
}

.card-footer strong {
  font-size: 11px;
  color: var(--text-primary);
}

.card-footer span {
  max-width: 120px;
  color: var(--text-muted);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.download-button {
  min-width: 64px;
  height: 24px;
  border-radius: 4px;
  padding: 0 8px;
  background: var(--accent-subtle);
  color: var(--accent);
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

.side-title {
  gap: 6px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 4px;
}

.side-title svg {
  color: var(--accent);
}

/* Sidebar List Buttons (Remove Borders) */
.rank-item,
.activity-item,
.category-rank {
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
.activity-item:hover,
.category-rank:hover {
  background: var(--bg-hover);
}

/* Dotted dividers between sidebar rows */
.side-section > button:not(:last-child) {
  border-bottom: 1px dashed var(--border-base);
  border-radius: 6px 6px 0 0;
}

.rank-item {
  display: grid;
  grid-template-columns: 18px 24px minmax(0, 1fr) auto;
  gap: 6px;
}

.rank-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
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

.rank-title {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-value {
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
}

.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.activity-item span {
  font-weight: 500;
  font-size: 11px;
}

.activity-item small {
  color: var(--text-muted);
  font-size: 10px;
}

.category-rank {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-rank span {
  font-weight: 500;
  font-size: 11px;
}

.category-rank strong {
  color: var(--accent);
  font-size: 11px;
}

.side-placeholder {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  min-height: 44px;
  border: 1px dashed var(--border-base);
  border-radius: 6px;
  color: var(--text-muted);
  padding: 6px;
  font-size: 10px;
  font-weight: 500;
}

.template-activity small {
  color: var(--accent);
}

/* Empty State / Templates Grid */
.starter-market {
  display: grid;
  grid-template-columns: minmax(220px, 0.65fr) minmax(0, 1.35fr);
  gap: 10px;
  align-items: stretch;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 220px;
  padding: 16px 20px;
  text-align: center;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.empty-icon {
  width: 32px;
  height: 32px;
  color: var(--accent);
  opacity: 0.45;
  margin-bottom: 8px;
}

.empty-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.starter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.starter-card {
  display: flex;
  flex-direction: column;
  min-height: 200px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 10px;
  box-shadow: var(--shadow-card);
  transition: all 0.15s ease;
}

.starter-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

/* Starter tones hover */
.starter-card:hover:has(.tone-orange) {
  border-color: rgba(249, 115, 22, 0.4);
}
.starter-card:hover:has(.tone-blue) {
  border-color: rgba(37, 99, 235, 0.4);
}
.starter-card:hover:has(.tone-rose) {
  border-color: rgba(225, 29, 72, 0.4);
}
.starter-card:hover:has(.tone-cyan) {
  border-color: rgba(8, 145, 178, 0.4);
}
.starter-card:hover:has(.tone-emerald) {
  border-color: rgba(5, 150, 105, 0.4);
}

.starter-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.starter-icon {
  width: 28px;
  height: 28px;
}

.starter-card h3 {
  font-size: 13px;
  font-weight: 600;
}

.starter-card p {
  min-height: 36px;
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.4;
}

.starter-action {
  width: 100%;
  margin-top: auto;
}

/* Modals */
.modal-layer {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(6px);
}

.detail-dialog,
.upload-dialog {
  position: relative;
  width: min(640px, 100%);
  max-height: min(86vh, 760px);
  overflow: auto;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-card);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.2);
}

.detail-dialog .close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
}

.detail-hero {
  height: 180px;
  display: grid;
  place-items: center;
}

.detail-body {
  padding: 16px;
}

.detail-body h2 {
  margin-top: 10px;
  font-size: 18px;
  font-weight: 700;
}

.detail-body > p {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 12px 0 0;
}

.detail-grid div,
.install-box {
  border: 1px solid var(--border-base);
  border-radius: 6px;
  background: var(--bg-hover);
  padding: 8px 10px;
}

.detail-grid dt {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 500;
}

.detail-grid dd {
  margin: 4px 0 0;
  font-size: 12px;
  font-weight: 600;
}

.detail-tags {
  margin-top: 10px;
}

.install-box {
  margin-top: 12px;
}

.install-box h3 {
  font-size: 12px;
  font-weight: 600;
}

.install-box p {
  margin-top: 6px;
  white-space: pre-wrap;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.detail-footer {
  justify-content: flex-end;
  border-top: 1px solid var(--border-base);
  padding: 10px 16px;
}

.upload-dialog {
  width: min(720px, 100%);
  padding: 16px;
}

.upload-dialog header,
.upload-dialog footer {
  justify-content: space-between;
}

.upload-dialog header {
  margin-bottom: 12px;
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.upload-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.upload-grid label.wide {
  grid-column: 1 / -1;
}

.upload-grid label span {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.upload-grid input,
.upload-grid select,
.upload-grid textarea {
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--bg-app);
  font-size: 12px;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.drop-zone {
  position: relative;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px dashed var(--border-base);
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.04);
  text-align: center;
}

.drop-zone.active {
  border-color: var(--accent);
  background: var(--accent-subtle);
}

.drop-zone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.drop-icon {
  width: 22px;
  height: 22px;
  color: var(--accent);
}

.drop-zone strong {
  max-width: 80%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.drop-zone span {
  color: var(--text-muted);
  font-size: 10px;
}

.upload-dialog footer {
  margin-top: 14px;
  justify-content: flex-end;
}

.tone-orange {
  background: linear-gradient(135deg, #f97316, #7c2d12);
}

.tone-blue {
  background: linear-gradient(135deg, #2563eb, #172554);
}

.tone-rose {
  background: linear-gradient(135deg, #e11d48, #4c0519);
}

.tone-cyan {
  background: linear-gradient(135deg, #0891b2, #164e63);
}

.tone-emerald {
  background: linear-gradient(135deg, #059669, #064e3b);
}

.tone-violet {
  background: linear-gradient(135deg, #7c3aed, #312e81);
}

.tone-slate {
  background: linear-gradient(135deg, #475569, #0f172a);
}

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
  height: 100px;
}

.skeleton.line {
  height: 10px;
  width: 60%;
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
  .market-overview {
    grid-template-columns: 1fr 1fr;
  }

  .overview-copy {
    grid-column: 1 / -1;
  }

  .market-shell {
    grid-template-columns: minmax(0, 1fr) 250px;
  }
}

@media (max-width: 920px) {
  .market-overview,
  .market-shell,
  .starter-market {
    grid-template-columns: 1fr;
  }

  .signal-stack {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .insight-panel {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .plugins-page {
    padding: 12px;
  }

  .plugins-header,
  .toolbar,
  .library-heading {
    flex-direction: column;
    align-items: stretch;
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

  .overview-copy h2 {
    font-size: 16px;
  }

  .signal-stack,
  .insight-panel,
  .plugin-grid,
  .starter-grid {
    grid-template-columns: 1fr;
  }

  .stats-strip,
  .detail-grid,
  .upload-grid,
  .file-grid {
    grid-template-columns: 1fr;
  }

  .header-actions,
  .toolbar-actions {
    width: 100%;
  }

  .primary-button,
  .ghost-button,
  .select-field {
    flex: 1;
  }

  .spotlight-row {
    grid-template-columns: 32px minmax(0, 1fr);
  }

  .spotlight-row b {
    grid-column: 2;
  }
}
</style>
