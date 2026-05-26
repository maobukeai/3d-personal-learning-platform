<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Search,
  Layers,
  Download,
  Box,
  Plus,
  UploadCloud,
  X,
  Heart,
  Eye,
  HardDrive,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useSystemStore } from '@/stores/system';
import UserAvatar from '@/components/UserAvatar.vue';

const systemStore = useSystemStore();
const searchQuery = ref('');
const activeCategory = ref('全部材料');
interface MaterialItem {
  id: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: string | null;
  fileUrl?: string | null;
  previewUrl?: string;
  downloads?: number;
  fileSize?: number | null;
  resolution?: string;
  isProcedural?: boolean;
  createdAt?: string;
  isFavorited?: boolean;
  _count?: {
    favorites: number;
  };
  user?: {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string;
  };
}

const materials = ref<MaterialItem[]>([]);
const isLoading = ref(false);
const sortBy = ref('latest');
const showFavoritesOnly = ref(false);

const categories = computed(() => {
  return (
    systemStore.settings.MATERIAL_CATEGORIES || [
      '全部材料',
      '金属',
      '木纹',
      '石材',
      '织物',
      '程序化',
      '玻璃',
      '其他',
    ]
  );
});

const isUploadDialogOpen = ref(false);
const isUploading = ref(false);
const uploadForm = ref({
  title: '',
  description: '',
  category: '其他',
  resolution: '4K',
  tags: '',
  isProcedural: false,
  file: null as File | null,
  preview: null as File | null,
});

const showDetailDialog = ref(false);
const selectedMaterial = ref<MaterialItem | null>(null);
const isLoadingDetail = ref(false);

const fetchMaterials = async () => {
  isLoading.value = true;
  try {
    const params: Record<string, string> = {
      category: activeCategory.value,
      sort: sortBy.value,
    };
    if (searchQuery.value) {
      params.search = searchQuery.value;
    }
    const response = await api.get('/api/materials', { params });
    materials.value = response.data;
  } catch (_error) {
    ElMessage.error('获取材料失败');
  } finally {
    isLoading.value = false;
  }
};

const handleFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    uploadForm.value.file = file;
    if (!uploadForm.value.title) {
      uploadForm.value.title = file.name.split('.')[0];
    }
  }
};

const handlePreviewChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    uploadForm.value.preview = file;
  }
};

const handleUpload = async () => {
  if (!uploadForm.value.file) {
    ElMessage.warning('请选择材料包文件');
    return;
  }
  if (!uploadForm.value.preview) {
    ElMessage.warning('请上传预览图');
    return;
  }

  isUploading.value = true;
  const formData = new FormData();
  formData.append('material', uploadForm.value.file);
  formData.append('preview', uploadForm.value.preview);
  formData.append('title', uploadForm.value.title);
  formData.append('description', uploadForm.value.description);
  formData.append('category', uploadForm.value.category);
  formData.append('resolution', uploadForm.value.resolution);
  formData.append('tags', uploadForm.value.tags);
  formData.append('isProcedural', String(uploadForm.value.isProcedural));

  try {
    await api.post('/api/materials/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success('材料上传成功，等待审核');
    isUploadDialogOpen.value = false;
    uploadForm.value = {
      title: '',
      description: '',
      category: '其他',
      resolution: '4K',
      tags: '',
      isProcedural: false,
      file: null,
      preview: null,
    };
    fetchMaterials();
  } catch (_error) {
    ElMessage.error('上传失败');
  } finally {
    isUploading.value = false;
  }
};

const filteredMaterials = computed(() => {
  let list = materials.value;
  if (showFavoritesOnly.value) {
    list = list.filter((m) => m.isFavorited);
  }
  return list;
});

const getTagsList = (tags?: string | null) => {
  if (!tags) return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t);
};

const handleDownload = async (material: MaterialItem) => {
  try {
    await api.post(`/api/materials/${material.id}/download`);
    if (typeof material.downloads === 'number') {
      material.downloads++;
    } else {
      material.downloads = 1;
    }
    const response = await api.get(`/api/materials/${material.id}/file`, {
      responseType: 'blob',
    });
    const ext = material.fileUrl?.split('.').pop() || 'zip';
    const safeTitle = (material.title || 'material').replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');
    const fileName = `${safeTitle}.${ext}`;
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to download:', error);
    ElMessage.error('下载失败');
  }
};

const toggleFavorite = async (material: MaterialItem, event?: Event) => {
  if (event) event.stopPropagation();
  try {
    const res = await api.post(`/api/materials/${material.id}/favorite`);
    material.isFavorited = res.data.isFavorited;
    if (material._count) {
      material._count.favorites = res.data.isFavorited
        ? material._count.favorites + 1
        : material._count.favorites - 1;
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
  }
};

const openDetail = async (material: MaterialItem) => {
  selectedMaterial.value = material;
  showDetailDialog.value = true;
  isLoadingDetail.value = true;
  try {
    const res = await api.get(`/api/materials/${material.id}`);
    selectedMaterial.value = res.data;
  } catch (error) {
    console.error('Fetch material detail error:', error);
  } finally {
    isLoadingDetail.value = false;
  }
};

const formatFileSize = (mb: number | null | undefined) => {
  if (!mb) return '未知';
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
};

onMounted(() => {
  if (!systemStore.isInitialized) {
    systemStore.fetchSettings();
  }
  window.addEventListener('resize', updateIsMobile);
  fetchMaterials();
});

const isMobile = ref(window.innerWidth < 768);
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 768;
};

import { onUnmounted } from 'vue';
onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});
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
          <Layers class="w-4 h-4 text-orange-600 dark:text-orange-400" />
        </div>
        <h1 class="text-md sm:text-lg font-bold" style="color: var(--text-primary)">材料与纹理库</h1>
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
            placeholder="搜索材料..."
            class="pl-8 pr-3.5 py-1.5 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-full md:w-56 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
            @keyup.enter="fetchMaterials"
          />
        </div>
        <button type="button" class="flex items-center justify-center p-1.5 bg-orange-500 text-white rounded-lg shadow-md shadow-orange-500/20 transition-all hover:bg-orange-600 shrink-0 cursor-pointer" @click="isUploadDialogOpen = true">
          <Plus class="w-3.5 h-3.5" />
          <span class="hidden sm:inline ml-1 text-xs font-bold">上传</span>
        </button>
      </div>
    </div>

    <!-- Category Toolbar -->
    <div
      class="border-b px-3.5 md:px-4.5 py-1 shrink-0 overflow-x-auto scrollbar-hide"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          <button
v-for="cat in categories" :key="cat" type="button" class="px-2 sm:px-2.5 py-0.5 rounded text-[10px] sm:text-[11px] font-medium transition-all whitespace-nowrap" :class="
              activeCategory === cat
                ? 'bg-slate-800 text-white dark:bg-accent dark:text-white'
                : 'hover:opacity-80'
            " :style="
              activeCategory !== cat
                ? 'color: var(--text-secondary); background-color: var(--bg-app)'
                : ''
            " @click="
              activeCategory = cat;
              fetchMaterials();
            ">
            {{ cat }}
          </button>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Favorites Toggle -->
          <button
type="button" class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all" :class="
              showFavoritesOnly
                ? 'bg-rose-500/10 text-rose-500'
                : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-rose-500'
            " @click="showFavoritesOnly = !showFavoritesOnly">
            <Heart class="w-3 h-3" :class="showFavoritesOnly ? 'fill-rose-500' : ''" />
            <span class="hidden sm:inline">收藏</span>
          </button>

          <div class="flex items-center gap-0.5 bg-slate-100 dark:bg-white/5 p-0.5 rounded-md shrink-0">
            <button
type="button" class="px-1.5 py-0.5 rounded text-[9px] font-bold transition-all" :class="
                sortBy === 'latest'
                  ? 'bg-white dark:bg-slate-800 text-orange-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              " @click="
                sortBy = 'latest';
                fetchMaterials();
              ">
              最新
            </button>
            <button
type="button" class="px-1.5 py-0.5 rounded text-[9px] font-bold transition-all" :class="
                sortBy === 'popular'
                  ? 'bg-white dark:bg-slate-800 text-orange-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              " @click="
                sortBy = 'popular';
                fetchMaterials();
              ">
              最热
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto p-2.5 sm:p-3.5 md:p-4 scrollbar-hide">
      <div class="max-w-none">
        <div
          v-if="filteredMaterials.length > 0"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2 sm:gap-2.5"
        >
          <div
            v-for="mat in filteredMaterials"
            :key="mat.id"
            class="group rounded-lg border overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
            @click="openDetail(mat)"
          >
            <!-- Material Preview -->
            <div
              class="aspect-square relative overflow-hidden"
              style="background-color: var(--bg-app)"
            >
              <img alt="" :src="mat.previewUrl" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />

              <!-- Resolution Badge -->
              <div
                class="absolute top-1 right-1 backdrop-blur px-1 py-0.5 rounded text-[7.5px] font-bold shadow-sm border"
                style="
                  background-color: var(--bg-card);
                  color: var(--text-primary);
                  border-color: var(--border-base);
                "
              >
                {{ mat.resolution }}
              </div>

              <!-- Procedural Indicator -->
              <div
                v-if="mat.isProcedural"
                class="absolute top-1 left-1 bg-accent px-1 py-0.5 rounded text-[7.5px] font-bold text-white shadow-sm flex items-center gap-0.5"
              >
                <Box class="w-2 h-2" /> 程序化
              </div>

              <!-- Favorite Button -->
              <button
type="button" class="absolute top-1 right-1 mt-5 p-1 rounded-md backdrop-blur transition-all opacity-0 group-hover:opacity-100" :class="
                  mat.isFavorited
                    ? 'bg-rose-500/20 text-rose-500'
                    : 'bg-black/30 text-white hover:text-rose-400'
                " @click.stop="toggleFavorite(mat)">
                <Heart class="w-3 h-3" :class="mat.isFavorited ? 'fill-rose-500' : ''" />
              </button>

              <!-- Hover Actions -->
              <div
                class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5"
              >
                <button type="button" class="p-1.5 rounded-md bg-white text-slate-800 hover:text-orange-600 transition-all shadow-md" @click.stop="openDetail(mat)">
                  <Eye class="w-3.5 h-3.5" />
                </button>
                <button type="button" class="p-1.5 rounded-md bg-white text-slate-800 hover:text-orange-600 transition-all shadow-md" @click.stop="handleDownload(mat)">
                  <Download class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Material Info -->
            <div class="p-1.5 sm:p-2 flex-1 flex flex-col">
              <h3 class="text-[11px] sm:text-xs font-bold truncate mb-0.5" style="color: var(--text-primary)">
                {{ mat.title }}
              </h3>
              <p
                v-if="mat.description"
                class="text-[9px] line-clamp-1 mb-1"
                style="color: var(--text-muted)"
              >
                {{ mat.description }}
              </p>
              <div class="mt-auto flex items-center justify-between">
                <div class="flex items-center gap-1">
                  <span class="text-[9px] font-medium" style="color: var(--text-secondary)">{{
                    mat.category
                  }}</span>
                  <span
                    v-if="mat.fileSize"
                    class="text-[8px] flex items-center gap-0.5"
                    style="color: var(--text-muted)"
                  >
                    <HardDrive class="w-2 h-2" /> {{ formatFileSize(mat.fileSize) }}
                  </span>
                </div>
                <div class="flex items-center gap-1">
                  <span
                    class="flex items-center gap-0.5 text-[8px] font-bold"
                    style="color: var(--text-muted)"
                  >
                    <Heart
                      class="w-2 h-2"
                      :class="mat.isFavorited ? 'text-rose-500 fill-rose-500' : ''"
                    />
                    {{ mat._count?.favorites || 0 }}
                  </span>
                  <span
                    class="flex items-center gap-0.5 text-[8px] font-bold"
                    style="color: var(--text-muted)"
                  >
                    <Download class="w-2 h-2" /> {{ mat.downloads || 0 }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="h-64 flex flex-col items-center justify-center text-slate-400">
          <Layers class="w-10 h-10 mb-3 opacity-10" />
          <p class="text-xs font-bold">
            {{ showFavoritesOnly ? '暂无收藏材料' : '该分类下暂无材料' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Material Detail Dialog -->
    <Transition name="fade">
      <div v-if="showDetailDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="showDetailDialog = false"
        ></div>
        <div
          class="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col"
          style="background-color: var(--bg-card)"
        >
          <!-- Loading -->
          <div v-if="isLoadingDetail" class="flex-1 flex items-center justify-center py-12">
            <div
              class="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"
            ></div>
          </div>

          <template v-else-if="selectedMaterial">
            <!-- Preview Image -->
            <div class="relative aspect-[16/10] overflow-hidden shrink-0">
              <img alt="" :src="selectedMaterial.previewUrl" class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <button type="button" class="absolute top-2 right-2 p-1 bg-black/30 backdrop-blur rounded text-white hover:bg-black/50 transition-colors" @click="showDetailDialog = false">
                <X class="w-4 h-4" />
              </button>
              <div class="absolute bottom-3 left-4 right-4">
                <div class="flex items-center gap-1.5 mb-1">
                  <span
                    v-if="selectedMaterial.isProcedural"
                    class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-accent text-white"
                    >程序化</span
                  >
                  <span
                    class="px-1.5 py-0.5 rounded text-[8px] font-bold backdrop-blur bg-white/10 text-white"
                    >{{ selectedMaterial.resolution || '未知' }}</span
                  >
                  <span
                    v-if="selectedMaterial.fileSize"
                    class="px-1.5 py-0.5 rounded text-[8px] font-bold backdrop-blur bg-white/10 text-white"
                    >{{ formatFileSize(selectedMaterial.fileSize) }}</span
                  >
                </div>
                <h2 class="text-base sm:text-lg font-black text-white">{{ selectedMaterial.title }}</h2>
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-y-auto p-3 sm:p-4 scrollbar-hide">
              <!-- Description -->
              <p
                v-if="selectedMaterial.description"
                class="text-xs leading-relaxed mb-2.5"
                style="color: var(--text-secondary)"
              >
                {{ selectedMaterial.description }}
              </p>

              <!-- Info Grid -->
              <div class="grid grid-cols-3 gap-1.5 mb-3">
                <div class="p-1.5 rounded-md text-center bg-[var(--bg-app)]">
                  <p class="text-[8px] font-bold uppercase text-[var(--text-muted)]">
                    分类
                  </p>
                  <p class="text-[11px] font-bold mt-0.5 text-[var(--text-primary)]">
                    {{ selectedMaterial.category }}
                  </p>
                </div>
                <div class="p-1.5 rounded-md text-center bg-[var(--bg-app)]">
                  <p class="text-[8px] font-bold uppercase text-[var(--text-muted)]">
                    分辨率
                  </p>
                  <p class="text-[11px] font-bold mt-0.5 text-[var(--text-primary)]">
                    {{ selectedMaterial.resolution || '未知' }}
                  </p>
                </div>
                <div class="p-1.5 rounded-md text-center bg-[var(--bg-app)]">
                  <p class="text-[8px] font-bold uppercase text-[var(--text-muted)]">
                    类型
                  </p>
                  <p class="text-[11px] font-bold mt-0.5 text-[var(--text-primary)]">
                    {{ selectedMaterial.isProcedural ? '程序化' : '静态纹理' }}
                  </p>
                </div>
              </div>

              <!-- Tags -->
              <div v-if="getTagsList(selectedMaterial.tags).length > 0" class="mb-3">
                <p class="text-[9px] font-bold uppercase mb-1 text-[var(--text-muted)]">
                  标签
                </p>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="tag in getTagsList(selectedMaterial.tags)"
                    :key="tag"
                    class="px-1.5 py-0.5 rounded text-[8.5px] font-bold bg-[var(--bg-app)] text-[var(--text-secondary)]"
                    >{{ tag }}</span
                  >
                </div>
              </div>

              <!-- Stats -->
              <div class="flex items-center gap-3.5 mb-3">
                <div
                  class="flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)]"
                >
                  <Download class="w-3.5 h-3.5 text-orange-500" />
                  {{ selectedMaterial.downloads || 0 }} 次下载
                </div>
                <div
                  class="flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)]"
                >
                  <Heart
                    class="w-3.5 h-3.5"
                    :class="
                      selectedMaterial.isFavorited
                        ? 'text-rose-500 fill-rose-500'
                        : 'text-slate-400'
                    "
                  />
                  {{ selectedMaterial._count?.favorites || 0 }} 人收藏
                </div>
              </div>

              <!-- Uploader Info -->
              <div
                v-if="selectedMaterial.user"
                class="flex items-center gap-2 p-1.5 rounded-md bg-[var(--bg-app)]"
              >
                <UserAvatar :user="selectedMaterial.user" size="sm" />
                <div>
                  <p class="text-[11px] font-bold text-[var(--text-primary)]">
                    {{ selectedMaterial.user.name || '匿名用户' }}
                  </p>
                  <p class="text-[9px] text-[var(--text-muted)]">
                    上传于 {{
                      selectedMaterial.createdAt
                        ? new Date(selectedMaterial.createdAt).toLocaleDateString()
                        : '未知'
                    }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Bottom Actions -->
            <div
              class="p-2.5 sm:p-3 border-t flex items-center gap-2 shrink-0"
              style="border-color: var(--border-base)"
            >
              <button
type="button" class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all" :class="
                  selectedMaterial.isFavorited
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-rose-500'
                " @click="toggleFavorite(selectedMaterial)">
                <Heart
                  class="w-3.5 h-3.5"
                  :class="selectedMaterial.isFavorited ? 'fill-rose-500' : ''"
                />
                {{ selectedMaterial.isFavorited ? '已收藏' : '收藏' }}
              </button>
              <button type="button" class="flex-1 py-1.5 bg-orange-500 text-white rounded-md text-xs font-bold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer" @click="handleDownload(selectedMaterial)">
                <Download class="w-3.5 h-3.5" /> 下载材料包
              </button>
            </div>
          </template>
        </div>
      </div>
    </Transition>

    <!-- Upload Dialog -->
    <Transition name="fade">
      <div
        v-if="isUploadDialogOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isUploadDialogOpen = false"
        ></div>
        <div
          class="relative w-full max-w-md p-4 rounded-xl shadow-xl space-y-3 max-h-[90vh] overflow-y-auto"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between border-b pb-2" style="border-color: var(--border-base)">
            <h3 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">贡献新材料</h3>
            <button type="button" class="hover:text-accent transition-colors cursor-pointer" style="color: var(--text-secondary)" @click="isUploadDialogOpen = false">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3 max-h-[68vh] overflow-y-auto pr-1">
            <div class="space-y-2.5">
              <div>
                <label
                  class="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5"
                  >材料名称</label
                >
                <input
                  v-model="uploadForm.title"
                  type="text"
                  class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                  placeholder="例如：锈蚀铁片 PBR"
                />
              </div>

              <div>
                <label
                  class="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5"
                  >材料描述</label
                >
                <textarea
                  v-model="uploadForm.description"
                  rows="2"
                  class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all resize-none"
                  placeholder="描述材料的特点和用途..."
                ></textarea>
              </div>

              <div>
                <label
                  class="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5"
                  >分类</label
                >
                <el-select v-model="uploadForm.category" class="!w-full custom-select">
                  <el-option
                    v-for="cat in categories.filter((c) => c !== '全部材料')"
                    :key="cat"
                    :label="cat"
                    :value="cat"
                  />
                </el-select>
              </div>

              <div>
                <label
                  class="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5"
                  >分辨率 / 类型</label
                >
                <el-select
                  v-model="uploadForm.resolution"
                  class="!w-full custom-select"
                >
                  <el-option
                    v-for="res in ['2K', '4K', '8K', '矢量', '程序化']"
                    :key="res"
                    :label="res"
                    :value="res"
                  />
                </el-select>
              </div>

              <div class="flex items-center gap-2 pt-0.5">
                <el-switch v-model="uploadForm.isProcedural" active-color="var(--accent)" />
                <span class="text-[10px] font-bold" style="color: var(--text-secondary)"
                  >程序化 (.sbsar)</span
                >
              </div>
            </div>

            <div class="space-y-2.5">
              <div>
                <label
                  class="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5"
                  >材料包 (ZIP)</label
                >
                <div class="relative group h-16">
                  <input
                    type="file"
                    accept=".zip,.sbsar"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    @change="handleFileChange"
                  />
                  <div
                    class="w-full h-full border border-dashed rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all group-hover:border-orange-500 group-hover:bg-orange-500/5"
                    style="border-color: var(--border-base)"
                  >
                    <Box class="w-4.5 h-4.5 text-orange-500/40" />
                    <p
                      class="text-[9px] font-medium truncate px-2 w-full text-center"
                      style="color: var(--text-secondary)"
                    >
                      {{ uploadForm.file ? uploadForm.file.name : '选择 ZIP/SBSAR' }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label
                  class="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5"
                  >预览图</label
                >
                <div class="relative group h-16">
                  <input
                    type="file"
                    accept="image/*"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    @change="handlePreviewChange"
                  />
                  <div
                    class="w-full h-full border border-dashed rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all group-hover:border-orange-500 group-hover:bg-orange-500/5"
                    style="border-color: var(--border-base)"
                  >
                    <UploadCloud class="w-4.5 h-4.5 text-orange-500/40" />
                    <p
                      class="text-[9px] font-medium truncate px-2 w-full text-center"
                      style="color: var(--text-secondary)"
                    >
                      {{ uploadForm.preview ? uploadForm.preview.name : '上传预览图' }}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label
                  class="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1 ml-0.5"
                  >标签</label
                >
                <input
                  v-model="uploadForm.tags"
                  type="text"
                  class="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-white/5 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                  placeholder="用逗号分隔"
                />
              </div>
            </div>
          </div>

          <button type="button" :disabled="isUploading" class="w-full py-2 bg-orange-500 text-white rounded-lg font-bold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer hover:scale-102" @click="handleUpload">
            <div
              v-if="isUploading"
              class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></div>
            {{ isUploading ? '正在上传...' : '发布材料' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.custom-select :deep(.el-input__wrapper) {
  border-radius: 0.5rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  padding: 0.15rem 0.5rem !important;
  border: 1px solid var(--border-base);
}
.custom-select :deep(.el-input__inner) {
  font-size: 12px;
}
</style>

