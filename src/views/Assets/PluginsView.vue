<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import {
  Search,
  Cpu,
  Download,
  Heart,
  Eye,
  Plus,
  UploadCloud,
  X,
  HardDrive,
  Star,
  Sparkles,
  Code,
  Layers,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const authStore = useAuthStore();

// Plugin Interface
interface PluginItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  version: string;
  compatibility: string;
  downloads: number;
  favorites: number;
  rating: number;
  size: string;
  installGuide: string;
  previewColor: string; // Gradient color for cards fallback
  iconName: string; // Icon to render
  createdAt: string;
  author: {
    name: string;
    avatarUrl?: string;
  };
  isCustom?: boolean;
}

// Curated default plugins
const DEFAULT_PLUGINS: PluginItem[] = [
  {
    id: 'three-debugger',
    title: 'Three.js Scene Debugger',
    description: 'A real-time scene inspector for Three.js applications, enabling live property editing, performance profiling, and camera tuning.',
    category: 'Three.js 插件',
    tags: 'Debugger, DevTools, r3f',
    version: 'v1.2.4',
    compatibility: 'Three.js r120+',
    downloads: 1245,
    favorites: 342,
    rating: 4.8,
    size: '1.8 MB',
    installGuide: `### NPM 安装说明\n\n1. 在项目目录中运行：\n   \`npm install three-scene-debugger\`\n\n2. 在代码中导入并初始化：\n   \`\`\`javascript\n   import { initDebugger } from 'three-scene-debugger';\n   \n   // 创建场景、相机和渲染器后\n   initDebugger(scene, camera, renderer);\n   \`\`\`\n\n3. 启动项目，在浏览器侧边栏中即可看到实时场景调试菜单。`,
    previewColor: 'from-blue-600/30 to-indigo-900/40',
    iconName: 'Cpu',
    createdAt: '2026-03-15',
    author: {
      name: 'DeepMind 3D Lab',
    },
  },
  {
    id: 'blender-gltf-opt',
    title: 'Blender glTF Exporter Optimizer',
    description: 'An advanced Blender addon that compresses meshes and textures using Draco and KTX2 during glTF export.',
    category: 'Blender 插件',
    tags: 'glTF, Optimizer, Blender',
    version: 'v2.1.0',
    compatibility: 'Blender 3.6+, 4.0+',
    downloads: 3201,
    favorites: 984,
    rating: 4.9,
    size: '4.5 MB',
    installGuide: `### 安装步骤\n\n1. 下载本插件的 ZIP 文件。\n2. 打开 Blender，进入 **Edit -> Preferences -> Add-ons**。\n3. 点击右上角的 **Install...** 按钮，选择下载的 ZIP 压缩包。\n4. 在插件列表中搜索 "glTF Optimizer" 并勾选启用。\n5. 在导出 glTF/GLB 文件时，侧边栏属性中将出现全新的压缩与优化配置面板。`,
    previewColor: 'from-orange-500/30 to-amber-900/40',
    iconName: 'Layers',
    createdAt: '2026-04-02',
    author: {
      name: 'Blender Community',
    },
  },
  {
    id: 'substance-live-link',
    title: 'Substance Painter Live Link',
    description: 'Seamlessly bridge Substance Painter textures with your web platform or popular game engines in real-time.',
    category: 'Substance 工具',
    tags: 'LiveLink, Substance, Workflow',
    version: 'v1.0.8',
    compatibility: 'Substance 2023+',
    downloads: 843,
    favorites: 198,
    rating: 4.6,
    size: '8.2 MB',
    installGuide: `### 安装指南\n\n1. 下载并解压插件压缩包。\n2. 将解压出来的文件夹复制到 Substance Painter 的插件目录下：\n   - **Windows**: \`Documents/Allegorithmic/Substance Painter/plugins/\`\n   - **macOS**: \`Documents/Substance Painter/plugins/\`\n3. 重新启动 Substance Painter。\n4. 在顶部菜单栏中找到 **Live Link** 并开启服务，即可将贴图一键同步更新至前端渲染视口。`,
    previewColor: 'from-rose-600/30 to-purple-900/40',
    iconName: 'Sparkles',
    createdAt: '2026-05-10',
    author: {
      name: 'Allegorithmic Linker',
    },
  },
  {
    id: 'unity-webgl-opt',
    title: 'Unity WebGL Optimizer Pack',
    description: 'Lightweight Unity package designed to minimize WebGL build size and improve loading performance.',
    category: '游戏引擎插件',
    tags: 'Unity, WebGL, Performance',
    version: 'v0.9.5',
    compatibility: 'Unity 2021 LTS, 2022 LTS',
    downloads: 1530,
    favorites: 412,
    rating: 4.7,
    size: '12.1 MB',
    installGuide: `### 导入与使用\n\n1. 打开您的 Unity 项目。\n2. 依次选择顶部菜单： **Window -> Package Manager**。\n3. 点击左上角的 **+** 按钮，选择 **Add package from tarball...**。\n4. 选择下载好的 \`.tgz\` 优化包文件。\n5. 导入完成后，在 Build Settings -> WebGL 面板中勾选 "Enable Advanced WebGL Optimizations" 即可在打包时自动压缩 WebAssembly 代码并优化纹理格式。`,
    previewColor: 'from-emerald-600/30 to-cyan-900/40',
    iconName: 'Code',
    createdAt: '2026-05-28',
    author: {
      name: 'GameTech Solution',
    },
  },
  {
    id: 'ps-pbr-baker',
    title: 'Photoshop PBR Texture Baker',
    description: 'Automatically bake Albedo, Normal, Roughness, and Metallic maps directly inside Photoshop.',
    category: 'Photoshop 脚本',
    tags: 'Photoshop, PBR, Baking',
    version: 'v1.1.2',
    compatibility: 'Photoshop CC 2021+',
    downloads: 624,
    favorites: 118,
    rating: 4.5,
    size: '0.6 MB',
    installGuide: `### 运行指南\n\n1. 下载本插件并将 \`.jsx\` 脚本文件复制到 Photoshop 的脚本预设目录下：\n   - **Windows**: \`C:\\Program Files\\Adobe\\Adobe Photoshop CC\\Presets\\Scripts\\\`\n   - **macOS**: \`/Applications/Adobe Photoshop CC/Presets/Scripts/\`\n2. 打开 Photoshop。\n3. 在顶部菜单栏中选择 **File -> Scripts -> PBR Texture Baker** 启动本工具。\n4. 输入贴图图层后，即可一键切分输出成标准漫反射、法线及高光粗糙度贴图。`,
    previewColor: 'from-sky-600/30 to-blue-900/40',
    iconName: 'Layers',
    createdAt: '2026-06-01',
    author: {
      name: 'Adobe Scripts Guild',
    },
  },
];

// Reactive States
const pluginsList = ref<PluginItem[]>([]);
const searchQuery = ref('');
const activeCategory = ref('全部插件');
const sortBy = ref('latest'); // latest or popular
const showFavoritesOnly = ref(false);
const favoritedIds = ref<string[]>([]);
const downloadingIds = ref<Record<string, number>>({}); // Record of pluginId -> progress (0 to 100)

// Dialogs
const isUploadDialogOpen = ref(false);
const isDetailDialogOpen = ref(false);
const selectedPlugin = ref<PluginItem | null>(null);

// Upload Form
const uploadForm = ref({
  title: '',
  category: '其他工具',
  description: '',
  version: 'v1.0.0',
  compatibility: 'All Versions',
  tags: '',
  installGuide: '',
  fileName: '',
  fileSize: '0.0 MB',
  previewColor: 'from-zinc-700/30 to-slate-900/40',
});
const fileToUpload = ref<File | null>(null);
const fileDragActive = ref(false);

// Load data on mount
onMounted(() => {
  // Load Favorites from localStorage
  const savedFavorites = localStorage.getItem('favorited_plugins');
  if (savedFavorites) {
    try {
      favoritedIds.value = JSON.parse(savedFavorites);
    } catch (_) {
      favoritedIds.value = [];
    }
  }

  // Load Custom Plugins from localStorage
  const savedCustom = localStorage.getItem('custom_plugins');
  let customList: PluginItem[] = [];
  if (savedCustom) {
    try {
      customList = JSON.parse(savedCustom);
    } catch (_) {
      customList = [];
    }
  }

  // Merge lists
  pluginsList.value = [...customList, ...DEFAULT_PLUGINS];
});

// Category Label translations mapping
const getCategoryLabel = (category: string) => {
  switch (category) {
    case '全部插件':
      return t('plugins.catAll');
    case 'Blender 插件':
      return t('plugins.catBlender');
    case 'Three.js 插件':
      return t('plugins.catThreejs');
    case 'Substance 工具':
      return t('plugins.catSubstance');
    case '游戏引擎插件':
      return t('plugins.catUnityUnreal');
    case 'Photoshop 脚本':
      return t('plugins.catPhotoshop');
    case '其他工具':
      return t('plugins.catOther');
    default:
      return category;
  }
};

const categories = [
  '全部插件',
  'Blender 插件',
  'Three.js 插件',
  'Substance 工具',
  '游戏引擎插件',
  'Photoshop 脚本',
  '其他工具',
];

const uploadCategories = categories.filter((c) => c !== '全部插件');

// Compute filtered plugins
const filteredPlugins = computed(() => {
  let list = [...pluginsList.value];

  // Filter by category
  if (activeCategory.value !== '全部插件') {
    list = list.filter((p) => p.category === activeCategory.value);
  }

  // Filter by search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.toLowerCase().includes(q)
    );
  }

  // Filter by favorites
  if (showFavoritesOnly.value) {
    list = list.filter((p) => favoritedIds.value.includes(p.id));
  }

  // Sorting
  if (sortBy.value === 'popular') {
    list.sort((a, b) => b.downloads - a.downloads);
  } else {
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  return list;
});

// Handle Favorite Toggle
const toggleFavorite = (pluginId: string, event?: Event) => {
  if (event) event.stopPropagation();

  const index = favoritedIds.value.indexOf(pluginId);
  const plugin = pluginsList.value.find((p) => p.id === pluginId);

  if (index >= 0) {
    favoritedIds.value.splice(index, 1);
    if (plugin) plugin.favorites = Math.max(0, plugin.favorites - 1);
  } else {
    favoritedIds.value.push(pluginId);
    if (plugin) plugin.favorites += 1;
  }

  // Persist to localStorage
  localStorage.setItem('favorited_plugins', JSON.stringify(favoritedIds.value));

  // Sync back to selectedPlugin if currently opened in details dialog
  if (selectedPlugin.value && selectedPlugin.value.id === pluginId) {
    selectedPlugin.value.favorites = plugin ? plugin.favorites : selectedPlugin.value.favorites;
  }
};

const isFavorited = (pluginId: string) => {
  return favoritedIds.value.includes(pluginId);
};

// Handle Simulated Download
const handleDownload = (plugin: PluginItem, event?: Event) => {
  if (event) event.stopPropagation();

  // If already downloading, do nothing
  if (downloadingIds.value[plugin.id] !== undefined) return;

  // Start animated progress
  downloadingIds.value[plugin.id] = 0;
  
  const interval = setInterval(() => {
    if (downloadingIds.value[plugin.id] < 100) {
      downloadingIds.value[plugin.id] += 10;
    } else {
      clearInterval(interval);
      delete downloadingIds.value[plugin.id];

      // Update plugin downloads locally
      const original = pluginsList.value.find((p) => p.id === plugin.id);
      if (original) original.downloads += 1;

      // Sync detail dialog
      if (selectedPlugin.value && selectedPlugin.value.id === plugin.id) {
        selectedPlugin.value.downloads += 1;
      }

      ElMessage.success({
        message: t('plugins.downloadSuccess'),
        duration: 4000,
      });

      // Trigger standard browser download mock file
      const blob = new Blob([`Plugin Package: ${plugin.title} (${plugin.version})\nCompatibility: ${plugin.compatibility}\n\nInstall Instructions:\n${plugin.installGuide}`], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plugin.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${plugin.version}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  }, 150);
};

// Detail Dialog
const openDetail = (plugin: PluginItem) => {
  selectedPlugin.value = plugin;
  isDetailDialogOpen.value = true;
};

// File drag & drop simulator
const onDragOver = (e: DragEvent) => {
  e.preventDefault();
  fileDragActive.value = true;
};

const onDragLeave = () => {
  fileDragActive.value = false;
};

const onDrop = (e: DragEvent) => {
  e.preventDefault();
  fileDragActive.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    const file = files[0];
    if (file.name.endsWith('.zip')) {
      processUploadedFile(file);
    } else {
      ElMessage.warning(t('plugins.selectFileWarning'));
    }
  }
};

const onFileSelected = (e: Event) => {
  const files = (e.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    processUploadedFile(files[0]);
  }
};

const processUploadedFile = (file: File) => {
  fileToUpload.value = file;
  uploadForm.value.fileName = file.name;
  
  // Format file size
  const sizeMB = file.size / (1024 * 1024);
  uploadForm.value.fileSize = sizeMB >= 1 
    ? `${sizeMB.toFixed(1)} MB` 
    : `${(file.size / 1024).toFixed(0)} KB`;
};

// Submit simulated plugin upload
const handleUploadSubmit = () => {
  if (!uploadForm.value.title.trim()) {
    ElMessage.warning(t('plugins.namePlaceholder'));
    return;
  }
  if (!fileToUpload.value) {
    ElMessage.warning(t('plugins.selectFileWarning'));
    return;
  }

  // Pre-fill gradient fallback based on category to keep it premium
  const gradients = {
    'Blender 插件': 'from-orange-500/30 to-amber-950/45',
    'Three.js 插件': 'from-indigo-600/30 to-slate-900/40',
    'Substance 工具': 'from-pink-600/30 to-rose-950/45',
    '游戏引擎插件': 'from-teal-600/30 to-zinc-900/40',
    'Photoshop 脚本': 'from-cyan-600/30 to-blue-950/45',
    '其他工具': 'from-violet-600/30 to-slate-900/40',
  };

  const selectedCategory = uploadForm.value.category as keyof typeof gradients;
  const bgGradient = gradients[selectedCategory] || 'from-slate-700/30 to-slate-900/40';

  const newPlugin: PluginItem = {
    id: `custom-${Date.now()}`,
    title: uploadForm.value.title,
    description: uploadForm.value.description || 'No description provided.',
    category: uploadForm.value.category,
    tags: uploadForm.value.tags || 'General',
    version: uploadForm.value.version || 'v1.0.0',
    compatibility: uploadForm.value.compatibility || 'All Versions',
    downloads: 0,
    favorites: 0,
    rating: 5.0,
    size: uploadForm.value.fileSize,
    installGuide: uploadForm.value.installGuide || 'No custom guide provided. Drag zip to target application plugins folder.',
    previewColor: bgGradient,
    iconName: 'Cpu',
    createdAt: new Date().toISOString().split('T')[0],
    author: {
      name: authStore.user?.name || t('plugins.anonymousUser'),
      avatarUrl: authStore.user?.avatarUrl,
    },
    isCustom: true,
  };

  // Add to local state list
  pluginsList.value.unshift(newPlugin);

  // Persist to custom_plugins in localStorage
  const savedCustom = localStorage.getItem('custom_plugins');
  let customList: PluginItem[] = [];
  if (savedCustom) {
    try {
      customList = JSON.parse(savedCustom);
    } catch (_) {}
  }
  customList.unshift(newPlugin);
  localStorage.setItem('custom_plugins', JSON.stringify(customList));

  // Reset Form
  uploadForm.value = {
    title: '',
    category: '其他工具',
    description: '',
    version: 'v1.0.0',
    compatibility: 'All Versions',
    tags: '',
    installGuide: '',
    fileName: '',
    fileSize: '0.0 MB',
    previewColor: 'from-zinc-700/30 to-slate-900/40',
  };
  fileToUpload.value = null;

  isUploadDialogOpen.value = false;
  ElMessage.success(t('plugins.uploadSuccess'));
};

const getPluginIconComponent = (category: string) => {
  if (category === 'Three.js 插件') return Cpu;
  if (category === 'Blender 插件') return Layers;
  if (category === 'Photoshop 脚本') return Sparkles;
  if (category === '游戏引擎插件') return Code;
  return Layers;
};

// Split tags string into array
const getTagsList = (tags: string) => {
  if (!tags) return [];
  return tags.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
};

// Formatted Date
const formatDateString = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch (_) {
    return dateStr;
  }
};
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div
      class="h-auto md:h-13 border-b px-3.5 md:px-4.5 py-2.5 md:py-0 flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-2.5"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-2">
        <div class="p-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <Cpu class="w-4 h-4 text-orange-600 dark:text-orange-400" />
        </div>
        <h1 class="text-md sm:text-lg font-bold" style="color: var(--text-primary)">
          {{ t('plugins.title') }}
        </h1>
      </div>

      <div class="flex items-center gap-2 w-full md:w-auto">
        <div class="relative flex-1">
          <Search
            class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2"
            style="color: var(--text-secondary)"
          />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('plugins.searchPlaceholder')"
            class="pl-8 pr-3.5 py-1.5 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-full md:w-56 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button
          type="button"
          class="flex items-center justify-center p-1.5 bg-orange-500 text-white rounded-lg shadow-md shadow-orange-500/20 transition-all hover:bg-orange-600 shrink-0 cursor-pointer"
          @click="isUploadDialogOpen = true"
        >
          <Plus class="w-3.5 h-3.5" />
          <span class="hidden sm:inline ml-1 text-xs font-bold">{{ t('plugins.upload') }}</span>
        </button>
      </div>
    </div>

    <!-- Category Selector & Toolbar -->
    <div
      class="border-b px-3.5 md:px-4.5 py-1.5 shrink-0 overflow-x-auto scrollbar-hide"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <button
            v-for="cat in categories"
            :key="cat"
            type="button"
            class="px-2.5 sm:px-3 py-0.5 rounded text-[10px] sm:text-[11px] font-medium transition-all whitespace-nowrap cursor-pointer"
            :class="
              activeCategory === cat
                ? 'bg-slate-800 text-white dark:bg-accent dark:text-white'
                : 'hover:opacity-80'
            "
            :style="
              activeCategory !== cat
                ? 'color: var(--text-secondary); background-color: var(--bg-app)'
                : ''
            "
            @click="activeCategory = cat"
          >
            {{ getCategoryLabel(cat) }}
          </button>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Favorites Toggle -->
          <button
            type="button"
            class="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer"
            :class="
              showFavoritesOnly
                ? 'bg-rose-500/10 text-rose-500'
                : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-rose-500'
            "
            @click="showFavoritesOnly = !showFavoritesOnly"
          >
            <Heart class="w-3 h-3" :class="showFavoritesOnly ? 'fill-rose-500 text-rose-500' : ''" />
            <span class="hidden sm:inline">{{ t('plugins.favorite') }}</span>
          </button>

          <!-- Sort modes -->
          <div class="flex items-center gap-0.5 bg-slate-100 dark:bg-white/5 p-0.5 rounded-md shrink-0">
            <button
              type="button"
              class="px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer"
              :class="
                sortBy === 'latest'
                  ? 'bg-white dark:bg-slate-800 text-orange-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              "
              @click="sortBy = 'latest'"
            >
              {{ t('plugins.latest') }}
            </button>
            <button
              type="button"
              class="px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer"
              :class="
                sortBy === 'popular'
                  ? 'bg-white dark:bg-slate-800 text-orange-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              "
              @click="sortBy = 'popular'"
            >
              {{ t('plugins.popular') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Plugins Grid List -->
    <div class="flex-1 overflow-y-auto p-3.5 sm:p-4.5 scrollbar-hide">
      <div v-if="filteredPlugins.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 sm:gap-4">
        <div
          v-for="plugin in filteredPlugins"
          :key="plugin.id"
          class="blender-card group flex flex-col cursor-pointer border rounded-xl hover:shadow-lg transition-all duration-300 relative overflow-hidden"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
          @click="openDetail(plugin)"
        >
          <!-- Plugin Icon Banner Fallback -->
          <div class="h-28 relative bg-gradient-to-br flex items-center justify-center overflow-hidden shrink-0" :class="plugin.previewColor">
            <div class="absolute -right-2 -bottom-2 opacity-5 transform scale-150 rotate-12">
              <Cpu class="w-24 h-24 text-white" />
            </div>

            <!-- Floating top badges -->
            <div class="absolute top-2 left-2 flex flex-col gap-1 items-start">
              <span class="px-1.5 py-0.5 bg-black/40 backdrop-blur text-[8.5px] font-black tracking-wide rounded-md text-white border border-white/10 uppercase">
                {{ plugin.category.replace(' 插件', '').replace(' 工具', '').replace(' 脚本', '') }}
              </span>
            </div>

            <div class="absolute top-2 right-2">
              <button
                type="button"
                class="p-1 rounded-md bg-black/40 hover:bg-black/60 text-white backdrop-blur border border-white/5 transition-all hover:scale-105"
                @click.stop="toggleFavorite(plugin.id)"
              >
                <Heart class="w-3 h-3" :class="isFavorited(plugin.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-300'" />
              </button>
            </div>

            <div class="p-3 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-md shadow-black/20 group-hover:scale-110 transition-transform duration-500">
              <component :is="getPluginIconComponent(plugin.category)" class="w-7 h-7 text-white" />
            </div>

            <!-- Version Badge on preview -->
            <div class="absolute bottom-2 right-2 bg-black/45 backdrop-blur-md border border-white/5 px-1.5 py-0.5 rounded text-[8.5px] font-black text-white">
              {{ plugin.version }}
            </div>
          </div>

          <!-- Plugin Info -->
          <div class="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
            <div>
              <div class="flex items-start justify-between gap-1.5">
                <h3 class="text-xs sm:text-sm font-black truncate text-[var(--text-primary)] hover:text-orange-500 transition-colors">
                  {{ plugin.title }}
                </h3>
              </div>
              <p class="text-[10px] leading-relaxed line-clamp-2 mt-1" style="color: var(--text-secondary)">
                {{ plugin.description }}
              </p>
            </div>

            <div class="space-y-2">
              <!-- Tags list -->
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="tag in getTagsList(plugin.tags).slice(0, 3)"
                  :key="tag"
                  class="px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[8.5px] font-bold rounded"
                >
                  #{{ tag }}
                </span>
              </div>

              <!-- Footer Statistics -->
              <div class="flex items-center justify-between border-t pt-2" style="border-color: var(--border-base)">
                <div class="flex items-center gap-2 text-[9px] font-bold" style="color: var(--text-muted)">
                  <span class="flex items-center gap-0.5">
                    <Download class="w-2.5 h-2.5 text-orange-500" />
                    {{ plugin.downloads }}
                  </span>
                  <span class="flex items-center gap-0.5">
                    <Heart class="w-2.5 h-2.5 text-rose-500" />
                    {{ plugin.favorites }}
                  </span>
                  <span v-if="plugin.rating > 0" class="flex items-center gap-0.5 text-yellow-500">
                    <Star class="w-2.5 h-2.5 fill-yellow-500 text-yellow-500" />
                    {{ plugin.rating.toFixed(1) }}
                  </span>
                </div>
                <div class="text-[9px] text-right font-medium truncate max-w-[90px]" style="color: var(--text-muted)">
                  {{ plugin.author.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- Hover Overlay Quick Buttons -->
          <div class="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center gap-2">
            <button
              type="button"
              class="w-28 py-1.5 bg-white text-slate-900 font-bold rounded-lg text-xs hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-1.5"
              @click.stop="openDetail(plugin)"
            >
              <Eye class="w-3.5 h-3.5" />
              <span>{{ t('common.view') || '查看详情' }}</span>
            </button>
            <button
              type="button"
              class="w-28 py-1.5 bg-orange-500 text-white font-bold rounded-lg text-xs hover:bg-orange-600 hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              :disabled="downloadingIds[plugin.id] !== undefined"
              @click.stop="handleDownload(plugin)"
            >
              <template v-if="downloadingIds[plugin.id] !== undefined">
                <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{{ downloadingIds[plugin.id] }}%</span>
              </template>
              <template v-else>
                <Download class="w-3.5 h-3.5" />
                <span>{{ t('plugins.downloadPluginPack') }}</span>
              </template>
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="h-80 flex flex-col items-center justify-center text-slate-400">
        <Cpu class="w-12 h-12 mb-3 opacity-15 text-orange-500" />
        <p class="text-xs font-bold">
          {{ showFavoritesOnly ? t('plugins.noFavorites') : t('plugins.noPlugins') }}
        </p>
      </div>
    </div>

    <!-- Plugin Detail Dialog -->
    <Transition name="fade">
      <div v-if="isDetailDialogOpen && selectedPlugin" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="isDetailDialogOpen = false"></div>
        
        <div
          class="relative w-full max-w-xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col border border-white/5"
          style="background-color: var(--bg-card)"
        >
          <!-- Top Hero image/gradient header -->
          <div class="h-32 relative bg-gradient-to-r flex flex-col justify-end p-4 shrink-0" :class="selectedPlugin.previewColor">
            <button
              type="button"
              class="absolute top-3 right-3 p-1.5 bg-black/40 backdrop-blur-md rounded-lg text-white hover:bg-black/60 border border-white/5 transition-all"
              @click="isDetailDialogOpen = false"
            >
              <X class="w-4 h-4" />
            </button>

            <div class="flex items-center gap-1.5 mb-1.5">
              <span class="px-2 py-0.5 bg-black/40 backdrop-blur-md rounded text-[9px] font-black text-white uppercase">
                {{ selectedPlugin.category }}
              </span>
              <span class="px-2 py-0.5 bg-orange-500 text-white rounded text-[9px] font-black">
                {{ selectedPlugin.version }}
              </span>
              <span class="px-2 py-0.5 bg-white/15 backdrop-blur-md text-[9px] font-bold text-white rounded border border-white/10">
                <HardDrive class="w-2.5 h-2.5 inline mr-0.5" /> {{ selectedPlugin.size }}
              </span>
            </div>
            <h2 class="text-md sm:text-lg font-black text-white truncate drop-shadow-md">
              {{ selectedPlugin.title }}
            </h2>
          </div>

          <!-- Dialog Scrollable Contents -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4.5 scrollbar-hide">
            <div>
              <p class="text-xs sm:text-sm leading-relaxed" style="color: var(--text-primary)">
                {{ selectedPlugin.description }}
              </p>
            </div>

            <!-- Parameters details list -->
            <div class="grid grid-cols-3 gap-2.5">
              <div class="p-2 bg-slate-100 dark:bg-white/5 border rounded-lg text-center" style="border-color: var(--border-base)">
                <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  {{ t('plugins.categoryLabel') }}
                </div>
                <div class="text-xs font-bold truncate" style="color: var(--text-primary)">
                  {{ selectedPlugin.category.replace(' 插件', '').replace(' 工具', '') }}
                </div>
              </div>
              <div class="p-2 bg-slate-100 dark:bg-white/5 border rounded-lg text-center" style="border-color: var(--border-base)">
                <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  {{ t('plugins.compatibilityLabel') }}
                </div>
                <div class="text-xs font-bold truncate" style="color: var(--text-primary)">
                  {{ selectedPlugin.compatibility }}
                </div>
              </div>
              <div class="p-2 bg-slate-100 dark:bg-white/5 border rounded-lg text-center" style="border-color: var(--border-base)">
                <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  {{ t('plugins.versionLabel') }}
                </div>
                <div class="text-xs font-bold truncate" style="color: var(--text-primary)">
                  {{ selectedPlugin.version }}
                </div>
              </div>
            </div>

            <!-- Tags list -->
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="tag in getTagsList(selectedPlugin.tags)"
                :key="tag"
                class="px-2 py-0.5 bg-slate-100 dark:bg-white/5 text-[10px] font-bold rounded text-slate-500 dark:text-slate-400"
              >
                #{{ tag }}
              </span>
            </div>

            <!-- Install guide section -->
            <div class="border-t pt-4" style="border-color: var(--border-base)">
              <h4 class="text-xs font-black uppercase tracking-wider text-orange-500 mb-2 flex items-center gap-1.5">
                <Code class="w-3.5 h-3.5" />
                {{ t('plugins.installInstructions') }}
              </h4>
              <div class="bg-slate-100 dark:bg-white/5 p-3 rounded-lg border text-xs leading-relaxed space-y-2 whitespace-pre-line" style="border-color: var(--border-base); color: var(--text-secondary)">
                {{ selectedPlugin.installGuide }}
              </div>
            </div>

            <!-- Publisher author row -->
            <div class="flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-white/5 border" style="border-color: var(--border-base)">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center text-xs font-black text-orange-500 border border-orange-500/20">
                  {{ selectedPlugin.author.name[0] }}
                </div>
                <div>
                  <div class="text-[10px] font-bold" style="color: var(--text-primary)">{{ selectedPlugin.author.name }}</div>
                  <div class="text-[8.5px]" style="color: var(--text-muted)">
                    {{ t('plugins.uploadedAt', { date: formatDateString(selectedPlugin.createdAt) }) }}
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-3 text-[10px] font-bold" style="color: var(--text-muted)">
                <span class="flex items-center gap-0.5"><Download class="w-3 h-3 text-orange-500" /> {{ selectedPlugin.downloads }}</span>
                <span class="flex items-center gap-0.5"><Heart class="w-3 h-3 text-rose-500" /> {{ selectedPlugin.favorites }}</span>
              </div>
            </div>
          </div>

          <!-- Bottom Footer Action buttons -->
          <div class="p-3 border-t flex items-center gap-2.5 shrink-0" style="border-color: var(--border-base)">
            <button
              type="button"
              class="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer"
              :class="
                isFavorited(selectedPlugin.id)
                  ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                  : 'bg-slate-100 dark:bg-white/5 border-transparent text-slate-500 hover:text-rose-500'
              "
              @click="toggleFavorite(selectedPlugin.id)"
            >
              <Heart class="w-3.5 h-3.5" :class="isFavorited(selectedPlugin.id) ? 'fill-rose-500 text-rose-500' : ''" />
              <span>{{ isFavorited(selectedPlugin.id) ? t('plugins.favorited') : t('plugins.favorite') }}</span>
            </button>

            <button
              type="button"
              class="flex-1 py-2 bg-orange-500 text-white rounded-lg text-xs font-black shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
              :disabled="downloadingIds[selectedPlugin.id] !== undefined"
              @click="handleDownload(selectedPlugin)"
            >
              <template v-if="downloadingIds[selectedPlugin.id] !== undefined">
                <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{{ downloadingIds[selectedPlugin.id] }}% {{ t('plugins.downloading') }}</span>
              </template>
              <template v-else>
                <Download class="w-3.5 h-3.5" />
                <span>{{ t('plugins.downloadPluginPack') }}</span>
              </template>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Upload Plugin Dialog -->
    <Transition name="fade">
      <div v-if="isUploadDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="isUploadDialogOpen = false"></div>

        <div
          class="relative w-full max-w-lg p-4 sm:p-5 rounded-xl shadow-2xl flex flex-col space-y-3.5 max-h-[85vh] overflow-y-auto border border-white/5"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between border-b pb-2.5" style="border-color: var(--border-base)">
            <h3 class="text-md sm:text-lg font-black" style="color: var(--text-primary)">
              {{ t('plugins.contribTitle') }}
            </h3>
            <button
              type="button"
              class="hover:text-accent transition-colors cursor-pointer text-slate-400"
              @click="isUploadDialogOpen = false"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Form inputs -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-3">
              <div>
                <label class="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-0.5">
                  {{ t('plugins.pluginName') }} *
                </label>
                <input
                  v-model="uploadForm.title"
                  type="text"
                  required
                  class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                  style="border-color: var(--border-base)"
                  :placeholder="t('plugins.pluginNamePlaceholder')"
                />
              </div>

              <div>
                <label class="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-0.5">
                  {{ t('plugins.categoryLabel') }}
                </label>
                <el-select v-model="uploadForm.category" class="!w-full custom-select">
                  <el-option
                    v-for="cat in uploadCategories"
                    :key="cat"
                    :label="getCategoryLabel(cat)"
                    :value="cat"
                  />
                </el-select>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-0.5">
                    {{ t('plugins.versionLabel') }}
                  </label>
                  <input
                    v-model="uploadForm.version"
                    type="text"
                    class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                    style="border-color: var(--border-base)"
                    :placeholder="t('plugins.versionPlaceholder')"
                  />
                </div>
                <div>
                  <label class="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-0.5">
                    {{ t('plugins.compatibilityLabel') }}
                  </label>
                  <input
                    v-model="uploadForm.compatibility"
                    type="text"
                    class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                    style="border-color: var(--border-base)"
                    :placeholder="t('plugins.compatibilityPlaceholder')"
                  />
                </div>
              </div>

              <div>
                <label class="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-0.5">
                  {{ t('plugins.tagsLabel') }}
                </label>
                <input
                  v-model="uploadForm.tags"
                  type="text"
                  class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                  style="border-color: var(--border-base)"
                  :placeholder="t('plugins.tagsPlaceholder')"
                />
              </div>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-0.5">
                  {{ t('plugins.pluginDesc') }}
                </label>
                <textarea
                  v-model="uploadForm.description"
                  rows="2"
                  class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all resize-none"
                  style="border-color: var(--border-base)"
                  :placeholder="t('plugins.pluginDescPlaceholder')"
                ></textarea>
              </div>

              <div>
                <label class="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-0.5">
                  {{ t('plugins.installInstructions') }}
                </label>
                <textarea
                  v-model="uploadForm.installGuide"
                  rows="3"
                  class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all resize-none"
                  style="border-color: var(--border-base)"
                  :placeholder="t('plugins.installInstructionsPlaceholder')"
                ></textarea>
              </div>
            </div>
          </div>

          <!-- File upload drag box -->
          <div class="pt-1">
            <label class="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-0.5">
              {{ t('plugins.pluginPackZip') }} *
            </label>
            <div
              class="relative h-20 border border-dashed rounded-lg flex flex-col items-center justify-center gap-1 transition-all"
              :class="fileDragActive ? 'border-orange-500 bg-orange-500/10' : 'hover:border-orange-500 hover:bg-orange-500/5'"
              style="border-color: var(--border-base)"
              @dragover="onDragOver"
              @dragleave="onDragLeave"
              @drop="onDrop"
            >
              <input
                type="file"
                accept=".zip"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                @change="onFileSelected"
              />
              <UploadCloud class="w-6 h-6 text-orange-500/40" />
              <div class="text-center px-4">
                <p class="text-[9px] font-bold" style="color: var(--text-secondary)">
                  {{ uploadForm.fileName || t('plugins.selectZip') }}
                </p>
                <p v-if="uploadForm.fileSize !== '0.0 MB'" class="text-[8px] mt-0.5 text-slate-400">
                  {{ uploadForm.fileSize }}
                </p>
              </div>
            </div>
          </div>

          <!-- Form Buttons -->
          <div class="pt-2 border-t flex items-center justify-end gap-2" style="border-color: var(--border-base)">
            <button
              type="button"
              class="px-4 py-1.5 bg-slate-100 dark:bg-white/5 text-[10px] font-bold rounded-lg border border-transparent hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer"
              style="color: var(--text-secondary)"
              @click="isUploadDialogOpen = false"
            >
              {{ t('common.cancel') || '取消' }}
            </button>
            <button
              type="button"
              class="px-5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black rounded-lg shadow-md shadow-orange-500/20 transition-all cursor-pointer"
              @click="handleUploadSubmit"
            >
              {{ t('common.submit') || '提交发布' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Custom select styling to match glass-input variables */
:deep(.custom-select .el-input__wrapper) {
  background-color: rgba(255, 255, 255, 0.06) !important;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset !important;
  border-radius: 8px !important;
  padding: 4px 10px !important;
  height: 30px !important;
}

:deep(.custom-select .el-input__inner) {
  color: var(--text-primary) !important;
  font-size: 11px !important;
}

:deep(.el-select-dropdown__item) {
  font-size: 11px !important;
}
</style>
