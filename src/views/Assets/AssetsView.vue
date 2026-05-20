<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Search,
  ChevronRight,
  Box,
  X,
  RotateCw,
  UploadCloud,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import MasonryGrid from '@/components/MasonryGrid.vue';
import AssetCard from '@/components/AssetCard.vue';

const router = useRouter();
const searchQuery = ref('');
const activeCategory = ref('全部');
const isMobile = ref(window.innerWidth < 768);
const isFilterMenuOpen = ref(false);
const assets = ref<any[]>([]);
const isLoading = ref(false);
const assetCategories = ref<any[]>([]);
const isUploading = ref(false);
const isUploadDialogOpen = ref(false);

const pagination = ref({
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
});

// Upload Form
const uploadForm = ref({
  uploadType: 'file', // 'file' | 'link'
  title: '',
  description: '',
  categoryId: '',
  file: null as File | null,
  externalUrl: '',
  thumbnail: null as File | null,
  formats: [] as string[],
});

const availableFormats = ['FBX', 'OBJ', 'BLEND', 'MAX', 'C4D', 'MAYA', 'ZTL', 'SPP', 'Textures'];
const isZipFile = computed(() => {
  const fileName = uploadForm.value.file?.name || '';
  return fileName.toLowerCase().endsWith('.zip');
});

watch(isZipFile, (isZip) => {
  if (!isZip) {
    uploadForm.value.formats = [];
  }
});

// Computeds
const categories = computed(() => {
  const list = [{ id: 'all', name: '全部', count: pagination.value.total }];
  assetCategories.value.forEach((cat) => {
    list.push({
      id: cat.id,
      name: cat.name,
      count: cat._count?.assets || 0,
    });
  });
  return list;
});

const filteredAssets = computed(() => {
  return assets.value.filter((asset) => {
    const matchesCategory = activeCategory.value === '全部' || (asset.category?.name === activeCategory.value);
    return matchesCategory;
  });
});

// Actions
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 768;
};

const fetchCategories = async () => {
  try {
    const response = await api.get('/api/assets/categories');
    assetCategories.value = response.data;
  } catch (error) {
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
        categoryId:
          activeCategory.value === '全部'
            ? 'all'
            : assetCategories.value.find((c) => c.name === activeCategory.value)?.id || 'all',
      },
    });
    assets.value = response.data.assets;
    pagination.value = response.data.pagination;
  } catch (error) {
    ElMessage.error('获取资源失败');
  } finally {
    isLoading.value = false;
  }
};

const handlePageChange = (page: number) => {
  pagination.value.page = page;
  fetchAssets();
};

const goToDetail = (id: string) => {
  router.push({ name: 'AssetDetail', params: { id } });
};

const handleFileChange = (e: any) => {
  const file = e.target.files[0];
  if (file) {
    uploadForm.value.file = file;
    if (!uploadForm.value.title) {
      uploadForm.value.title = file.name.split('.')[0];
    }
  }
};

const handleThumbnailChange = (e: any) => {
  const file = e.target.files[0];
  if (file) {
    uploadForm.value.thumbnail = file;
  }
};

const handleUpload = async () => {
  if (uploadForm.value.uploadType === 'file' && !uploadForm.value.file) {
    ElMessage.warning('请选择模型文件');
    return;
  }

  if (uploadForm.value.uploadType === 'link' && !uploadForm.value.externalUrl) {
    ElMessage.warning('请输入网盘/外链地址');
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
  if (uploadForm.value.formats && uploadForm.value.formats.length > 0) {
    formData.append('formats', JSON.stringify(uploadForm.value.formats));
  }

  try {
    await api.post('/api/assets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    ElMessage.success('上传成功，请等待管理员审核');
    isUploadDialogOpen.value = false;
    uploadForm.value = { uploadType: 'file', title: '', description: '', categoryId: '', file: null, externalUrl: '', thumbnail: null, formats: [] };
    fetchAssets();
    fetchCategories();
  } catch (error) {
    ElMessage.error('上传失败');
  } finally {
    isUploading.value = false;
  }
};

// Watchers
watch(searchQuery, () => {
  pagination.value.page = 1;
  fetchAssets();
});

watch(activeCategory, () => {
  pagination.value.page = 1;
  fetchAssets();
});

// Lifecycle
onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  fetchAssets();
  fetchCategories();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});
</script>

<template>
  <div class="flex flex-col h-full relative" style="background-color: var(--bg-card)">
    <!-- Top Bar -->
    <div
      class="h-auto md:h-16 border-b flex flex-col md:flex-row md:items-center justify-between px-3 sm:px-6 py-3 md:py-0 shrink-0 gap-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl z-20"
      style="border-color: var(--border-base)"
    >
      <div class="flex items-center text-[10px] sm:text-xs gap-1.5 font-bold tracking-wide" style="color: var(--text-secondary)">
        <span class="hover:text-accent cursor-pointer transition-colors px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5">3D 资源库</span>
        <ChevronRight class="w-3.5 h-3.5 opacity-50" />
        <span class="text-accent bg-accent/10 px-2 py-1 rounded-md">模型资产</span>
      </div>

      <div class="flex items-center gap-3 w-full md:w-auto">
        <div class="relative flex-1 group">
          <Search
            class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-300 group-focus-within:text-accent"
            style="color: var(--text-secondary)"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="在资源中搜索..."
            class="pl-10 pr-4 py-2 border border-transparent rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30 w-full md:w-72 transition-all duration-300 shadow-sm hover:shadow-md bg-white/60 dark:bg-slate-800/60 backdrop-blur-md"
            style="color: var(--text-primary)"
          />
        </div>
        <button
          class="md:hidden p-2 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300"
          @click="isFilterMenuOpen = !isFilterMenuOpen"
        >
          <RotateCw class="w-4 h-4" :class="isFilterMenuOpen ? 'rotate-180 text-accent' : ''" />
        </button>
      </div>
    </div>

    <!-- Main Content Layout -->
    <div class="flex flex-1 overflow-hidden relative">
      <!-- Inner Filter Sidebar (Desktop) -->
      <div
        class="hidden md:flex w-64 border-r flex flex-col shrink-0 overflow-y-auto bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl z-10"
        style="border-color: var(--border-base)"
      >
        <div class="p-6">
          <button
            class="w-full py-3 bg-gradient-to-r from-accent to-blue-500 hover:from-blue-600 hover:to-accent text-white rounded-xl text-xs font-black tracking-widest uppercase transition-all duration-500 shadow-[0_10px_20px_-10px_rgba(var(--accent-rgb),0.5)] hover:shadow-[0_15px_30px_-10px_rgba(var(--accent-rgb),0.6)] hover:-translate-y-0.5"
            @click="isUploadDialogOpen = true"
          >
            上传新作品
          </button>
        </div>

        <div class="px-4 pb-6 flex-1">
          <div class="text-[10px] font-black uppercase tracking-widest mb-3 ml-2 text-slate-400 dark:text-slate-500">
            分类筛选
          </div>
          <ul class="space-y-1.5">
            <li v-for="cat in categories" :key="cat.name">
              <a
                href="#"
                class="group flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-300"
                :class="activeCategory === cat.name ? 'bg-white dark:bg-slate-800 shadow-sm border border-black/5 dark:border-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'"
                :style="
                  activeCategory === cat.name
                    ? 'color: var(--accent);'
                    : 'color: var(--text-secondary)'
                "
                @click.prevent="activeCategory = cat.name"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-1.5 h-1.5 rounded-full transition-all duration-300"
                    :class="activeCategory === cat.name ? 'bg-accent scale-125 shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]' : 'bg-slate-300 dark:bg-slate-600 group-hover:scale-110'"
                  ></div>
                  {{ cat.name }}
                </div>
                <span 
                  class="text-[10px] px-2 py-0.5 rounded-full transition-colors duration-300 font-bold"
                  :class="activeCategory === cat.name ? 'bg-accent/10 text-accent' : 'bg-black/5 dark:bg-white/5 text-slate-400'"
                >{{ cat.count }}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Mobile Filter Dropdown/Bar -->
      <Transition name="slide-down">
        <div
          v-if="isFilterMenuOpen && isMobile"
          class="absolute inset-x-0 top-0 z-30 border-b shadow-xl md:hidden overflow-hidden transition-all duration-300"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <div class="p-4 flex flex-col gap-4">
            <button
              class="w-full py-2.5 bg-accent text-white rounded-xl text-xs font-bold shadow-lg shadow-accent/20"
              @click="isUploadDialogOpen = true; isFilterMenuOpen = false"
            >
              上传新作品
            </button>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="cat in categories"
                :key="cat.name"
                class="px-4 py-1.5 rounded-full text-[11px] font-medium transition-all"
                :class="activeCategory === cat.name ? 'bg-accent text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-500'"
                @click="activeCategory = cat.name; isFilterMenuOpen = false"
              >
                {{ cat.name }} ({{ cat.count }})
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Asset Grid Area -->
      <div
        class="flex-1 flex flex-col overflow-hidden relative bg-slate-50/50 dark:bg-slate-950/50"
      >
        <!-- Decorative Background Gradient -->
        <div class="absolute inset-0 pointer-events-none overflow-hidden">
          <div class="absolute -top-40 -right-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl"></div>
          <div class="absolute top-1/3 -left-20 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl"></div>
        </div>

        <!-- Asset Grid Scrollable Area -->
        <div class="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8 scrollbar-hide z-10">
          <MasonryGrid v-if="filteredAssets.length > 0">
            <AssetCard
              v-for="asset in filteredAssets"
              :key="asset.id"
              :asset="{
                id: asset.id,
                title: asset.title,
                thumbnail: asset.thumbnail,
                type: asset.type,
                fileSize: asset.size ? asset.size * 1024 * 1024 : undefined,
                format: asset.type,
                createdAt: asset.createdAt
              }"
              class="cursor-pointer"
              @click="goToDetail(asset.id)"
            />
          </MasonryGrid>

          <!-- Empty State -->
          <div
            v-else
            class="h-full flex flex-col items-center justify-center"
            style="color: var(--text-secondary)"
          >
            <Box class="w-10 h-10 sm:w-12 sm:h-12 mb-4 opacity-20" />
            <p class="text-xs sm:text-sm">没有找到匹配的资源</p>
          </div>
        </div>

        <!-- Pagination Footer -->
        <div
          v-if="pagination.totalPages > 1"
          class="h-14 sm:h-16 border-t flex items-center justify-center shrink-0"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <el-pagination
            v-model:current-page="pagination.page"
            :page-size="pagination.limit"
            :total="pagination.total"
            :pager-count="isMobile ? 5 : 7"
            layout="prev, pager, next"
            background
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Mobile FAB Upload -->
    <button
      class="md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 bg-accent text-white rounded-2xl shadow-xl shadow-accent/30 flex items-center justify-center active:scale-95 transition-transform"
      @click="isUploadDialogOpen = true"
    >
      <UploadCloud class="w-6 h-6" />
    </button>

    <!-- Upload Dialog -->
    <Transition name="fade">
      <div
        v-if="isUploadDialogOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isUploadDialogOpen = false"
        ></div>
        <div
          class="relative w-full max-w-md p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl space-y-4 sm:space-y-6"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-lg sm:text-xl font-bold" style="color: var(--text-primary)">上传 3D 资产</h3>
            <button style="color: var(--text-secondary)" @click="isUploadDialogOpen = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-3 sm:space-y-4">
            <div>
              <label
                class="block text-[10px] sm:text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >资源名称</label
              >
              <input
                v-model="uploadForm.title"
                type="text"
                class="w-full px-4 py-2.5 sm:py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="给你的作品起个名字"
              />
            </div>

            <div>
              <label
                class="block text-[10px] sm:text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >描述 (可选)</label
              >
              <textarea
                v-model="uploadForm.description"
                rows="2"
                class="w-full px-4 py-2.5 sm:py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="简单介绍一下这个模型..."
              ></textarea>
            </div>

            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >资源分类</label
              >
              <el-select
                v-model="uploadForm.categoryId"
                placeholder="请选择分类"
                class="w-full custom-select-v2"
              >
                <el-option
                  v-for="cat in assetCategories"
                  :key="cat.id"
                  :label="cat.name"
                  :value="cat.id"
                />
              </el-select>
            </div>

            <div>
              <div class="flex items-center gap-4 mb-4">
                <button
                  class="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                  :class="uploadForm.uploadType === 'file' ? 'bg-accent text-white shadow-md' : 'bg-slate-100 dark:bg-white/5 text-slate-500'"
                  @click.prevent="uploadForm.uploadType = 'file'"
                >
                  本地文件
                </button>
                <button
                  class="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                  :class="uploadForm.uploadType === 'link' ? 'bg-accent text-white shadow-md' : 'bg-slate-100 dark:bg-white/5 text-slate-500'"
                  @click.prevent="uploadForm.uploadType = 'link'"
                >
                  网盘/外链
                </button>
              </div>

              <div v-if="uploadForm.uploadType === 'file'">
                <label
                  class="block text-xs font-bold uppercase mb-2 ml-1"
                  style="color: var(--text-secondary)"
                  >选择文件 (GLB/GLTF/FBX/OBJ/STL/DAE/ZIP)</label
                >
                <div class="relative group">
                  <input
                    type="file"
                    accept=".glb,.gltf,.fbx,.obj,.stl,.dae,.3ds,.zip"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    @change="handleFileChange"
                  />
                  <div
                    class="w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 transition-all group-hover:border-accent group-hover:bg-accent/5"
                    style="border-color: var(--border-base)"
                  >
                    <Box class="w-8 h-8 text-accent/40" />
                    <p class="text-xs font-medium" style="color: var(--text-secondary)">
                      {{ uploadForm.file ? uploadForm.file.name : '点击或拖拽模型文件到这里' }}
                    </p>
                    <p class="text-[10px]" style="color: var(--text-secondary); opacity: 0.5">
                      支持 GLB, GLTF, FBX, OBJ, STL, DAE, 3DS, ZIP 格式
                    </p>
                  </div>
                </div>
              </div>

              <div v-else>
                <label
                  class="block text-[10px] sm:text-xs font-bold uppercase mb-2 ml-1"
                  style="color: var(--text-secondary)"
                  >网盘或外链地址</label
                >
                <input
                  v-model="uploadForm.externalUrl"
                  type="url"
                  class="w-full px-4 py-2.5 sm:py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                  placeholder="请输入完整的分享链接 (如百度网盘、蓝奏云等)"
                />
              </div>
            </div>

            <div v-if="isZipFile" class="space-y-2">
              <label
                class="block text-xs font-bold uppercase mb-1 ml-1"
                style="color: var(--text-secondary)"
                >ZIP 包内包含格式 (多选)</label
              >
              <div class="grid grid-cols-3 gap-2 p-3 rounded-xl border" style="background-color: var(--bg-app); border-color: var(--border-base)">
                <el-checkbox
                  v-for="fmt in availableFormats"
                  :key="fmt"
                  v-model="uploadForm.formats"
                  :label="fmt"
                  size="small"
                  class="m-0 text-xs"
                />
              </div>
            </div>

            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >上传封面图 (可选)</label
              >
              <div class="relative group">
                <input
                  type="file"
                  accept="image/*"
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  @change="handleThumbnailChange"
                />
                <div
                  class="w-full border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-1 transition-all group-hover:border-accent group-hover:bg-accent/5"
                  style="border-color: var(--border-base)"
                >
                  <UploadCloud class="w-6 h-6 text-accent/40" />
                  <p class="text-[10px] font-medium" style="color: var(--text-secondary)">
                    {{ uploadForm.thumbnail ? uploadForm.thumbnail.name : '点击上传封面预览图' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            :disabled="isUploading"
            class="w-full py-4 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all flex items-center justify-center gap-2"
            @click="handleUpload"
          >
            <span v-if="!isUploading">开始上传</span>
            <span
              v-else
              class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></span>
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
</style>
