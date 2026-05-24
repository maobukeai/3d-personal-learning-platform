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
      class="h-auto md:h-13 border-b flex flex-col md:flex-row md:items-center justify-between px-3 sm:px-4.5 py-2.5 md:py-0 shrink-0 gap-2.5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl z-20"
      style="border-color: var(--border-base)"
    >
      <div class="flex items-center text-[10px] sm:text-xs gap-1.5 font-bold tracking-wide" style="color: var(--text-secondary)">
        <span class="hover:text-accent cursor-pointer transition-colors px-2 py-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5">3D 资源库</span>
        <ChevronRight class="w-3.5 h-3.5 opacity-50" />
        <span class="text-accent bg-accent/10 px-2 py-1 rounded-md">模型资产</span>
      </div>

      <div class="flex items-center gap-2.5 w-full md:w-auto">
        <div class="relative flex-1 group">
          <Search
            class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-300 group-focus-within:text-accent"
            style="color: var(--text-secondary)"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="在资源中搜索..."
            class="pl-9 pr-3.5 py-1.5 border border-transparent rounded-full text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30 w-full md:w-64 transition-all duration-300 shadow-sm hover:shadow-md bg-white/60 dark:bg-slate-800/60 backdrop-blur-md"
            style="color: var(--text-primary)"
          />
        </div>
        <button
          class="md:hidden p-1.5 rounded-lg bg-white/60 dark:bg-slate-800/60 backdrop-blur-md shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-300"
          @click="isFilterMenuOpen = !isFilterMenuOpen"
        >
          <RotateCw class="w-3.5 h-3.5" :class="isFilterMenuOpen ? 'rotate-180 text-accent' : ''" />
        </button>
      </div>
    </div>

    <!-- Main Content Layout -->
    <div class="flex flex-1 overflow-hidden relative">
      <!-- Inner Filter Sidebar (Desktop) -->
      <div
        class="hidden md:flex w-24 border-r flex flex-col shrink-0 overflow-y-auto bg-white/30 dark:bg-slate-900/30 backdrop-blur-xl z-10"
        style="border-color: var(--border-base)"
      >
        <div class="p-2">
          <button
            class="w-full py-2 bg-gradient-to-r from-accent to-blue-500 hover:from-blue-600 hover:to-accent text-white rounded-lg text-xs font-bold tracking-wider transition-all duration-500 shadow-md shadow-accent/20 hover:shadow-accent/30 hover:-translate-y-0.5 cursor-pointer"
            @click="isUploadDialogOpen = true"
          >
            上传作品
          </button>
        </div>

        <div class="px-2 pb-4 flex-1">
          <div class="text-[10px] font-black uppercase tracking-widest mb-2 ml-1 text-slate-400 dark:text-slate-500">
            分类筛选
          </div>
          <ul class="space-y-1">
            <li v-for="cat in categories" :key="cat.name">
              <a
                href="#"
                class="group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-300"
                :class="activeCategory === cat.name ? 'bg-white dark:bg-slate-800 shadow-sm border border-black/5 dark:border-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'"
                :style="
                  activeCategory === cat.name
                    ? 'color: var(--accent);'
                    : 'color: var(--text-secondary)'
                "
                @click.prevent="activeCategory = cat.name"
              >
                <div class="flex items-center gap-1.5">
                  <div
                    class="w-1.5 h-1.5 rounded-full transition-all duration-300 shrink-0"
                    :class="activeCategory === cat.name ? 'bg-accent scale-110 shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]' : 'bg-slate-300 dark:bg-slate-600 group-hover:scale-105'"
                  ></div>
                  <span class="truncate">{{ cat.name }}</span>
                </div>
                <span 
                  class="text-[9px] px-1 py-0.5 rounded-full transition-colors duration-300 font-bold shrink-0"
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
          <div class="p-3 flex flex-col gap-3">
            <button
              class="w-full py-2 bg-accent text-white rounded-lg text-xs font-bold shadow-md shadow-accent/20 cursor-pointer"
              @click="isUploadDialogOpen = true; isFilterMenuOpen = false"
            >
              上传作品
            </button>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="cat in categories"
                :key="cat.name"
                class="px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer"
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
        <div class="flex-1 overflow-y-auto p-2 sm:p-4 lg:p-5 scrollbar-hide z-10">
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
            <Box class="w-8 h-8 mb-3 opacity-20" />
            <p class="text-xs">没有找到匹配的资源</p>
          </div>
        </div>

        <!-- Pagination Footer -->
        <div
          v-if="pagination.totalPages > 1"
          class="h-11 sm:h-12 border-t flex items-center justify-center shrink-0"
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
      class="md:hidden fixed bottom-20 right-4 z-50 w-11 h-11 bg-accent text-white rounded-xl shadow-lg shadow-accent/30 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
      @click="isUploadDialogOpen = true"
    >
      <UploadCloud class="w-5 h-5" />
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
          class="relative w-full max-w-md p-4 sm:p-5 rounded-2xl shadow-xl space-y-3 sm:space-y-4"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between border-b pb-2" style="border-color: var(--border-base)">
            <h3 class="text-base sm:text-lg font-bold" style="color: var(--text-primary)">上传 3D 资产</h3>
            <button class="hover:text-accent transition-colors cursor-pointer" style="color: var(--text-secondary)" @click="isUploadDialogOpen = false">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="space-y-2.5 sm:space-y-3 max-h-[75vh] overflow-y-auto pr-1">
            <div>
              <label
                class="block text-[10px] sm:text-xs font-bold uppercase mb-1 ml-0.5"
                style="color: var(--text-secondary)"
                >资源名称</label
              >
              <input
                v-model="uploadForm.title"
                type="text"
                class="w-full px-3 py-1.5 sm:py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
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
                class="block text-[10px] sm:text-xs font-bold uppercase mb-1 ml-0.5"
                style="color: var(--text-secondary)"
                >描述 (可选)</label
              >
              <textarea
                v-model="uploadForm.description"
                rows="2"
                class="w-full px-3 py-1.5 sm:py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"
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
                class="block text-[10px] sm:text-xs font-bold uppercase mb-1 ml-0.5"
                style="color: var(--text-secondary)"
                >资源分类</label
              >
              <el-select
                v-model="uploadForm.categoryId"
                placeholder="请选择分类"
                class="w-full custom-select"
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
              <div class="flex items-center gap-2 mb-2">
                <button
                  class="px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  :class="uploadForm.uploadType === 'file' ? 'bg-accent text-white shadow-sm' : 'bg-slate-100 dark:bg-white/5 text-slate-500'"
                  @click.prevent="uploadForm.uploadType = 'file'"
                >
                  本地文件
                </button>
                <button
                  class="px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  :class="uploadForm.uploadType === 'link' ? 'bg-accent text-white shadow-sm' : 'bg-slate-100 dark:bg-white/5 text-slate-500'"
                  @click.prevent="uploadForm.uploadType = 'link'"
                >
                  网盘/外链
                </button>
              </div>

              <div v-if="uploadForm.uploadType === 'file'">
                <label
                  class="block text-[10px] sm:text-xs font-bold uppercase mb-1 ml-0.5"
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
                    class="w-full border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-1.5 transition-all group-hover:border-accent group-hover:bg-accent/5"
                    style="border-color: var(--border-base)"
                  >
                    <Box class="w-6 h-6 text-accent/40" />
                    <p class="text-xs font-medium" style="color: var(--text-secondary)">
                      {{ uploadForm.file ? uploadForm.file.name : '点击或拖拽模型文件到这里' }}
                    </p>
                    <p class="text-[9px]" style="color: var(--text-secondary); opacity: 0.5">
                      支持 GLB, GLTF, FBX, OBJ, STL, DAE, ZIP 格式
                    </p>
                  </div>
                </div>
              </div>

              <div v-else>
                <label
                  class="block text-[10px] sm:text-xs font-bold uppercase mb-1 ml-0.5"
                  style="color: var(--text-secondary)"
                  >网盘或外链地址</label
                >
                <input
                  v-model="uploadForm.externalUrl"
                  type="url"
                  class="w-full px-3 py-1.5 sm:py-2 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                  placeholder="请输入完整的分享链接 (如百度网盘等)"
                />
              </div>
            </div>

            <div v-if="isZipFile" class="space-y-1.5">
              <label
                class="block text-[10px] sm:text-xs font-bold uppercase mb-1 ml-0.5"
                style="color: var(--text-secondary)"
                >ZIP 包内包含格式 (多选)</label
              >
              <div class="grid grid-cols-3 gap-1 p-2 rounded-lg border" style="background-color: var(--bg-app); border-color: var(--border-base)">
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
                class="block text-[10px] sm:text-xs font-bold uppercase mb-1 ml-0.5"
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
                  class="w-full border-2 border-dashed rounded-lg p-3 flex flex-col items-center justify-center gap-1 transition-all group-hover:border-accent group-hover:bg-accent/5"
                  style="border-color: var(--border-base)"
                >
                  <UploadCloud class="w-5 h-5 text-accent/40" />
                  <p class="text-[9px] font-medium" style="color: var(--text-secondary)">
                    {{ uploadForm.thumbnail ? uploadForm.thumbnail.name : '点击上传封面预览图' }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <button
            :disabled="isUploading"
            class="w-full py-2.5 bg-accent text-white rounded-lg font-bold shadow-md shadow-accent/20 hover:shadow-accent/30 transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer hover:scale-102"
            @click="handleUpload"
          >
            <div
              v-if="isUploading"
              class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            ></div>
            {{ isUploading ? '正在上传...' : '开始上传' }}
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

