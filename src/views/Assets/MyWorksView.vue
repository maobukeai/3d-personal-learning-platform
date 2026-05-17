<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Search,
  Plus,
  Eye,
  Edit3,
  Trash2,
  X,
  Box,
  Download,
  LayoutGrid,
  List,
  ArrowUpDown,
  RotateCw,
  HardDrive,
  CheckCircle2,
  Clock,
  XCircle,
  FolderOpen,
  SendHorizonal,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import ModelViewer from '@/components/ModelViewer.vue';
import MarkdownEditor from '@/components/MarkdownEditor.vue';
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';
import { useRouter } from 'vue-router';
import PublishWorkDialog from '@/components/PublishWorkDialog.vue';

const router = useRouter();
const searchQuery = ref('');
const activeTab = ref('全部作品');
const assets = ref<any[]>([]);
const isLoading = ref(false);
const selectedAsset = ref<any>(null);
const isPreviewOpen = ref(false);
const isAutoRotating = ref(true);
const viewMode = ref<'grid' | 'list'>('grid');
const sortBy = ref('newest');

const isPublishWorkDialogOpen = ref(false);

const sortOptions = [
  { label: '最新上传', value: 'newest' },
  { label: '最早上传', value: 'oldest' },
  { label: '名称 A-Z', value: 'name_asc' },
  { label: '名称 Z-A', value: 'name_desc' },
  { label: '文件最大', value: 'size_desc' },
  { label: '文件最小', value: 'size_asc' },
];

const tabs = computed(() => [
  { label: '全部作品', count: assets.value.length },
  { label: '待审核', count: assets.value.filter((a) => a.status === 'PENDING').length },
  { label: '已发布', count: assets.value.filter((a) => a.status === 'APPROVED').length },
  { label: '未通过', count: assets.value.filter((a) => a.status === 'REJECTED').length },
]);

const stats = computed(() => {
  const total = assets.value.length;
  const approved = assets.value.filter((a) => a.status === 'APPROVED').length;
  const pending = assets.value.filter((a) => a.status === 'PENDING').length;
  const rejected = assets.value.filter((a) => a.status === 'REJECTED').length;
  const totalSize = assets.value.reduce((sum, a) => sum + (a.size || 0), 0);
  return { total, approved, pending, rejected, totalSize: totalSize.toFixed(1) };
});

const fetchMyAssets = async () => {
  isLoading.value = true;
  try {
    const [assetsRes, showcasesRes] = await Promise.all([
      api.get('/api/assets/my'),
      api.get('/api/showcase/my'),
    ]);

    const independentShowcases = showcasesRes.data
      .filter((s: any) => !s.assetId)
      .map((s: any) => ({
        ...s,
        isIndependentShowcase: true,
        url: s.videoUrl || s.thumbnailUrl || '',
        thumbnail: s.thumbnailUrl || '',
        type: s.type || 'IMAGE',
        size: 0,
        status: s.status || 'APPROVED',
        category: { name: '创意作品' },
      }));

    assets.value = [...assetsRes.data, ...independentShowcases];
  } catch (error) {
    ElMessage.error('获取作品失败');
  } finally {
    isLoading.value = false;
  }
};

const fetchCategories = async () => {
  try {
    const response = await api.get('/api/assets/categories');
    assetCategories.value = response.data;
  } catch (error) {
    console.error('Failed to fetch categories');
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING':
      return '待审核';
    case 'APPROVED':
      return '已发布';
    case 'REJECTED':
      return '未通过';
    default:
      return status;
  }
};

const getStatusBg = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-500/80';
    case 'APPROVED':
      return 'bg-emerald-500/80';
    case 'REJECTED':
      return 'bg-rose-500/80';
    default:
      return 'bg-slate-500/80';
  }
};

const getTypeLabel = (type: string) => {
  if (!type) return '文件';
  const t = type.toUpperCase();
  if (['GLB', 'GLTF', 'FBX', 'OBJ', 'STL', 'DAE', '3DS', 'BLEND', 'USDZ', 'ABC'].includes(t))
    return '3D模型';
  if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG', 'BMP'].includes(t)) return '图片';
  if (['MP4', 'WEBM', 'MOV', 'AVI', 'MKV'].includes(t)) return '视频';
  return type;
};

const filteredWorks = computed(() => {
  let result = assets.value.filter((work) => {
    const matchesSearch =
      work.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (work.description || '').toLowerCase().includes(searchQuery.value.toLowerCase());
    const matchesTab =
      activeTab.value === '全部作品' || getStatusLabel(work.status) === activeTab.value;
    return matchesSearch && matchesTab;
  });

  switch (sortBy.value) {
    case 'newest':
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'oldest':
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      break;
    case 'name_asc':
      result.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'name_desc':
      result.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case 'size_desc':
      result.sort((a, b) => (b.size || 0) - (a.size || 0));
      break;
    case 'size_asc':
      result.sort((a, b) => (a.size || 0) - (b.size || 0));
      break;
  }

  return result;
});

const isMobile = ref(window.innerWidth < 768);
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 768;
};

onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  fetchMyAssets();
  fetchCategories();
});

import { onUnmounted } from 'vue';
onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});

const openPreview = (asset: any) => {
  selectedAsset.value = asset;
  isPreviewOpen.value = true;
};

const handleMetadataLoaded = async (metadata: any) => {
  if (!selectedAsset.value || selectedAsset.value.isIndependentShowcase) return;
  if (!selectedAsset.value.vertices || selectedAsset.value.vertices !== metadata.vertices) {
    try {
      const response = await api.patch(`/api/assets/${selectedAsset.value.id}/metadata`, metadata);
      selectedAsset.value = { ...selectedAsset.value, ...response.data };
      const index = assets.value.findIndex((a) => a.id === selectedAsset.value.id);
      if (index !== -1) {
        assets.value[index] = { ...assets.value[index], ...response.data };
      }
    } catch (error) {
      console.error('Failed to save metadata:', error);
    }
  }
};

const handleDeleteWork = (work: any) => {
  ElMessageBox.confirm(`确定要删除作品 "${work.title}" 吗？此操作无法撤销。`, '确认删除', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      if (work.isIndependentShowcase) {
        await api.delete(`/api/showcase/${work.id}`);
      } else {
        await api.delete(`/api/assets/${work.id}`);
      }
      assets.value = assets.value.filter((w) => w.id !== work.id);
      if (isPreviewOpen.value && selectedAsset.value?.id === work.id) {
        isPreviewOpen.value = false;
      }
      ElMessage.success('作品已删除');
    } catch (error) {
      ElMessage.error('删除失败');
    }
  });
};

const assetCategories = ref<any[]>([]);

const isEditDialogOpen = ref(false);
const editForm = ref({
  id: '',
  title: '',
  description: '',
  categoryId: '',
});
const isSaving = ref(false);

const openEditDialog = (work: any) => {
  editForm.value = {
    id: work.id,
    title: work.title,
    description: work.description || '',
    categoryId: work.categoryId || '',
  };
  isEditDialogOpen.value = true;
};

const handleSaveEdit = async () => {
  if (!editForm.value.title.trim()) {
    ElMessage.warning('作品标题不能为空');
    return;
  }
  isSaving.value = true;
  try {
    const targetAsset = assets.value.find((a) => a.id === editForm.value.id);
    let updatedData = {};
    if (targetAsset?.isIndependentShowcase) {
      const response = await api.put(`/api/showcase/${editForm.value.id}`, {
        title: editForm.value.title,
        description: editForm.value.description,
      });
      updatedData = response.data;
    } else {
      const response = await api.patch(`/api/assets/${editForm.value.id}`, {
        title: editForm.value.title,
        description: editForm.value.description,
        categoryId: editForm.value.categoryId || null,
      });
      updatedData = response.data;
    }

    const index = assets.value.findIndex((a) => a.id === editForm.value.id);
    if (index !== -1) {
      assets.value[index] = { ...assets.value[index], ...updatedData };
    }
    if (selectedAsset.value?.id === editForm.value.id) {
      selectedAsset.value = { ...selectedAsset.value, ...updatedData };
    }
    ElMessage.success('作品信息已更新');
    isEditDialogOpen.value = false;
  } catch (error) {
    ElMessage.error('更新失败');
  } finally {
    isSaving.value = false;
  }
};

const isPublishDialogOpen = ref(false);
const publishForm = ref({
  assetId: '',
  title: '',
  description: '',
  tags: '',
});
const isPublishing = ref(false);

const openPublishDialog = (work: any) => {
  publishForm.value = {
    assetId: work.id,
    title: work.title,
    description: work.description || '',
    tags: '',
  };
  isPublishDialogOpen.value = true;
};

const handlePublishToShowcase = async () => {
  if (!publishForm.value.title.trim()) {
    ElMessage.warning('作品标题不能为空');
    return;
  }
  isPublishing.value = true;
  try {
    await api.post('/api/showcase/publish-asset', {
      assetId: publishForm.value.assetId,
      title: publishForm.value.title,
      description: publishForm.value.description,
      tags: publishForm.value.tags,
    });
    ElMessage.success('作品已成功发布到展示墙，等待审核');
    isPublishDialogOpen.value = false;
  } catch (error: any) {
    const msg = error?.response?.data?.error || '发布失败';
    ElMessage.error(msg);
  } finally {
    isPublishing.value = false;
  }
};

const goToShowcase = () => {
  router.push('/showcase');
};

onMounted(() => {
  fetchMyAssets();
  fetchCategories();
});
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div
      class="h-auto md:h-16 py-3 md:py-0 border-b px-4 md:px-8 flex flex-col md:flex-row md:items-center md:justify-between shrink-0 gap-3"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-2.5">
        <h1 class="text-lg md:text-xl font-bold" style="color: var(--text-primary)">我的作品</h1>
        <span class="bg-accent/10 text-accent text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full"
          >共 {{ assets.length }} 个作品</span
        >
      </div>

      <div class="flex items-center gap-2 w-full md:w-auto">
        <div class="relative flex-1">
          <Search
            class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
            style="color: var(--text-secondary)"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索作品..."
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 w-full md:w-64 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button
          class="flex items-center justify-center p-2.5 bg-accent text-white rounded-xl shadow-lg shadow-accent/10 dark:shadow-none transition-all"
          @click="isPublishWorkDialogOpen = true"
        >
          <Plus class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Stats Bar -->
    <div
      class="px-8 py-4 border-b shrink-0 overflow-x-auto scrollbar-hide"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-6 min-w-max md:min-w-0">
        <div
          class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl shrink-0 w-[120px] md:w-auto"
          style="background-color: var(--bg-app)"
        >
          <Box class="w-4 h-4 text-accent" />
          <div>
            <p class="text-[10px]" style="color: var(--text-secondary)">总作品</p>
            <p class="text-sm font-bold" style="color: var(--text-primary)">{{ stats.total }}</p>
          </div>
        </div>
        <div
          class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl shrink-0 w-[120px] md:w-auto"
          style="background-color: var(--bg-app)"
        >
          <CheckCircle2 class="w-4 h-4 text-emerald-500" />
          <div>
            <p class="text-[10px]" style="color: var(--text-secondary)">已发布</p>
            <p class="text-sm font-bold text-emerald-500">{{ stats.approved }}</p>
          </div>
        </div>
        <div
          class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl shrink-0 w-[120px] md:w-auto"
          style="background-color: var(--bg-app)"
        >
          <Clock class="w-4 h-4 text-amber-500" />
          <div>
            <p class="text-[10px]" style="color: var(--text-secondary)">待审核</p>
            <p class="text-sm font-bold text-amber-500">{{ stats.pending }}</p>
          </div>
        </div>
        <div
          class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl shrink-0 w-[120px] md:w-auto"
          style="background-color: var(--bg-app)"
        >
          <XCircle class="w-4 h-4 text-rose-500" />
          <div>
            <p class="text-[10px]" style="color: var(--text-secondary)">未通过</p>
            <p class="text-sm font-bold text-rose-500">{{ stats.rejected }}</p>
          </div>
        </div>
        <div
          class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl shrink-0 w-[140px] md:w-auto"
          style="background-color: var(--bg-app)"
        >
          <HardDrive class="w-4 h-4 text-blue-500" />
          <div>
            <p class="text-[10px]" style="color: var(--text-secondary)">存储用量</p>
            <p class="text-sm font-bold text-blue-500">{{ stats.totalSize }} MB</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs + Sort & View Controls -->
    <div
      class="border-b px-4 md:px-8 py-2 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-6 overflow-x-auto flex-nowrap scrollbar-hide pb-1 md:pb-0">
        <button
          v-for="tab in tabs"
          :key="tab.label"
          class="relative py-2 text-sm font-medium transition-all flex items-center gap-2 shrink-0"
          :class="activeTab === tab.label ? 'text-accent' : 'hover:text-accent'"
          :style="activeTab !== tab.label ? 'color: var(--text-secondary)' : ''"
          @click="activeTab = tab.label"
        >
          {{ tab.label }}
          <span
            class="text-[10px] px-1.5 py-0.5 rounded-full"
            :class="
              activeTab === tab.label
                ? 'bg-accent/10 text-accent'
                : 'bg-slate-100 dark:bg-white/5 text-slate-400'
            "
          >
            {{ tab.count }}
          </span>
          <div
            v-if="activeTab === tab.label"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
          ></div>
        </button>
      </div>

      <div class="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
        <div class="relative flex-1 md:flex-initial">
          <select
            v-model="sortBy"
            class="w-full appearance-none pl-8 pr-8 py-1.5 border-none rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          >
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <ArrowUpDown
            class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2"
            style="color: var(--text-secondary)"
          />
        </div>
        <div
          class="flex items-center rounded-lg overflow-hidden border shrink-0"
          style="border-color: var(--border-base)"
        >
          <button
            class="p-1.5 transition-all"
            :class="viewMode === 'grid' ? 'bg-accent text-white' : ''"
            :style="
              viewMode !== 'grid'
                ? 'color: var(--text-secondary); background-color: var(--bg-app)'
                : ''
            "
            @click="viewMode = 'grid'"
          >
            <LayoutGrid class="w-3.5 h-3.5" />
          </button>
          <button
            class="p-1.5 transition-all"
            :class="viewMode === 'list' ? 'bg-accent text-white' : ''"
            :style="
              viewMode !== 'list'
                ? 'color: var(--text-secondary); background-color: var(--bg-app)'
                : ''
            "
            @click="viewMode = 'list'"
          >
            <List class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Works Grid/List Area -->
    <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
      <div class="max-w-7xl mx-auto">
        <!-- Grid View -->
        <div
          v-if="viewMode === 'grid' && filteredWorks.length > 0"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <div
            v-for="work in filteredWorks"
            :key="work.id"
            class="group rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col relative"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <div
              class="aspect-video relative overflow-hidden bg-slate-100 dark:bg-white/5 flex items-center justify-center"
            >
              <img
                v-if="work.thumbnail"
                :src="work.thumbnail"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <img
                v-else
                :src="getDefaultThumbnailUrl(work.type)"
                class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />

              <div class="absolute top-3 left-3">
                <div
                  class="backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-white shadow-sm"
                  :class="getStatusBg(work.status)"
                >
                  {{ getStatusLabel(work.status) }}
                </div>
              </div>

              <div class="absolute top-3 right-3">
                <span
                  class="backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-white/90 shadow-sm bg-black/40"
                >
                  {{ getTypeLabel(work.type) }}
                </span>
              </div>

              <div
                class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
              >
                <button
                  class="p-2.5 rounded-xl hover:bg-accent-subtle hover:text-accent transition-all shadow-lg"
                  style="background-color: var(--bg-card); color: var(--text-primary)"
                  @click="openPreview(work)"
                >
                  <Eye class="w-4 h-4" />
                </button>
                <button
                  v-if="work.status === 'APPROVED' && !work.isIndependentShowcase"
                  class="p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-500 transition-all shadow-lg"
                  style="background-color: var(--bg-card); color: var(--text-primary)"
                  @click="openPublishDialog(work)"
                >
                  <SendHorizonal class="w-4 h-4" />
                </button>
                <button
                  class="p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-500 transition-all shadow-lg"
                  style="background-color: var(--bg-card); color: var(--text-primary)"
                  @click="openEditDialog(work)"
                >
                  <Edit3 class="w-4 h-4" />
                </button>
                <button
                  class="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-all shadow-lg"
                  style="background-color: var(--bg-card)"
                  @click="handleDeleteWork(work)"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div class="p-4 flex-1 flex flex-col">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-sm font-bold truncate pr-2" style="color: var(--text-primary)">
                  {{ work.title }}
                </h3>
                <span
                  v-if="work.category"
                  class="text-[10px] font-bold text-accent px-1.5 py-0.5 bg-accent/10 rounded shrink-0"
                  >{{ work.category.name }}</span
                >
              </div>
              <p
                v-if="work.description"
                class="text-[11px] line-clamp-1 mb-2"
                style="color: var(--text-secondary)"
              >
                {{ work.description }}
              </p>
              <p class="text-[10px] text-slate-400">
                {{ new Date(work.createdAt).toLocaleDateString() }}
              </p>

              <div
                class="mt-3 pt-3 border-t flex items-center justify-between"
                style="border-color: var(--border-base)"
              >
                <div
                  class="flex items-center gap-3 text-[10px]"
                  style="color: var(--text-secondary)"
                >
                  <span v-if="work.size" class="flex items-center gap-1"
                    ><HardDrive class="w-3 h-3" /> {{ work.size }} MB</span
                  >
                  <span v-if="work.vertices" class="flex items-center gap-1"
                    ><Box class="w-3 h-3" /> {{ (work.vertices / 1000).toFixed(1) }}K 顶点</span
                  >
                </div>
                <a
                  v-if="!work.isIndependentShowcase"
                  :href="work.url"
                  download
                  class="text-[10px] font-bold text-accent hover:underline flex items-center gap-1"
                  @click.stop
                >
                  <Download class="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- List View -->
        <div v-if="viewMode === 'list' && filteredWorks.length > 0" class="space-y-2">
          <div
            v-for="work in filteredWorks"
            :key="work.id"
            class="group flex items-center gap-4 p-4 rounded-xl border hover:shadow-lg transition-all duration-300 cursor-pointer"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
            @click="openPreview(work)"
          >
            <div
              class="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-white/5 flex items-center justify-center"
            >
              <img v-if="work.thumbnail" :src="work.thumbnail" class="w-full h-full object-cover" />
              <img
                v-else
                :src="getDefaultThumbnailUrl(work.type)"
                class="w-full h-full object-cover"
              />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <h3 class="text-sm font-bold truncate" style="color: var(--text-primary)">
                  {{ work.title }}
                </h3>
                <div
                  class="backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-white shrink-0"
                  :class="getStatusBg(work.status)"
                >
                  {{ getStatusLabel(work.status) }}
                </div>
              </div>
              <p
                v-if="work.description"
                class="text-[11px] truncate"
                style="color: var(--text-secondary)"
              >
                {{ work.description }}
              </p>
            </div>

            <div
              class="flex items-center gap-4 shrink-0 text-[11px]"
              style="color: var(--text-secondary)"
            >
              <span
                v-if="work.category"
                class="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold"
                >{{ work.category.name }}</span
              >
              <span class="w-16 text-center">{{ getTypeLabel(work.type) }}</span>
              <span v-if="work.size" class="w-16 text-right">{{ work.size }} MB</span>
              <span class="w-20 text-right">{{
                new Date(work.createdAt).toLocaleDateString()
              }}</span>
            </div>

            <div
              class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <button
                v-if="work.status === 'APPROVED' && !work.isIndependentShowcase"
                class="p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-indigo-500 transition-all"
                title="发布到展示墙"
                @click.stop="openPublishDialog(work)"
              >
                <SendHorizonal class="w-4 h-4" />
              </button>
              <button
                class="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-500 transition-all"
                @click.stop="openEditDialog(work)"
              >
                <Edit3 class="w-4 h-4" />
              </button>
              <button
                class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/40 text-rose-500 transition-all"
                @click.stop="handleDeleteWork(work)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="filteredWorks.length === 0"
          class="h-80 flex flex-col items-center justify-center rounded-3xl border border-dashed"
          style="
            background-color: var(--bg-card);
            border-color: var(--border-base);
            color: var(--text-secondary);
          "
        >
          <FolderOpen class="w-16 h-16 mb-4 opacity-10" />
          <p class="text-sm font-bold mb-1">
            {{ searchQuery ? '没有找到匹配的作品' : '还没有上传作品' }}
          </p>
          <p class="text-xs mb-4 opacity-60">
            {{ searchQuery ? '试试其他关键词' : '上传你的第一个作品，开始创作之旅' }}
          </p>
          <button
            v-if="!searchQuery"
            class="px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-accent/10"
            @click="isPublishWorkDialogOpen = true"
          >
            <Plus class="w-4 h-4" /> 上传/发布第一个作品
          </button>
        </div>
      </div>
    </div>

    <PublishWorkDialog v-model="isPublishWorkDialogOpen" @published="fetchMyAssets" />

    <!-- Edit Dialog -->
    <Transition name="fade">
      <div
        v-if="isEditDialogOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isEditDialogOpen = false"
        ></div>
        <div
          class="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl space-y-6"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">编辑作品信息</h3>
            <button style="color: var(--text-secondary)" @click="isEditDialogOpen = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >作品名称</label
              >
              <input
                v-model="editForm.title"
                type="text"
                class="w-full px-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>

            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >描述 (支持 Markdown)</label
              >
              <MarkdownEditor
                v-model="editForm.description"
                placeholder="添加作品描述... 支持 Markdown 格式"
                height="250px"
              />
            </div>

            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >资源分类</label
              >
              <el-select
                v-model="editForm.categoryId"
                placeholder="请选择分类"
                class="w-full custom-select-v2"
                clearable
              >
                <el-option
                  v-for="cat in assetCategories"
                  :key="cat.id"
                  :label="cat.name"
                  :value="cat.id"
                />
              </el-select>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              class="flex-1 py-3 border rounded-2xl text-sm font-bold transition-all"
              style="border-color: var(--border-base); color: var(--text-secondary)"
              @click="isEditDialogOpen = false"
            >
              取消
            </button>
            <button
              :disabled="isSaving"
              class="flex-1 py-3 bg-accent text-white rounded-2xl text-sm font-bold shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2"
              @click="handleSaveEdit"
            >
              <span v-if="!isSaving">保存修改</span>
              <span
                v-else
                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
              ></span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Publish to Showcase Dialog -->
    <Transition name="fade">
      <div
        v-if="isPublishDialogOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isPublishDialogOpen = false"
        ></div>
        <div
          class="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl space-y-6"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">发布到展示墙</h3>
            <button style="color: var(--text-secondary)" @click="isPublishDialogOpen = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div
            class="p-4 rounded-xl border flex items-center gap-3"
            style="background-color: var(--bg-app); border-color: var(--border-base)"
          >
            <div
              class="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-white/5 flex items-center justify-center"
            >
              <Box class="w-6 h-6 text-accent" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold truncate" style="color: var(--text-primary)">
                {{ publishForm.title }}
              </p>
              <p class="text-[10px]" style="color: var(--text-secondary)">
                此作品将发布到作品展示墙供大家浏览
              </p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >展示标题</label
              >
              <input
                v-model="publishForm.title"
                type="text"
                class="w-full px-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="展示标题"
              />
            </div>

            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >展示描述 (支持 Markdown)</label
              >
              <MarkdownEditor
                v-model="publishForm.description"
                placeholder="描述你的创作灵感... 支持 Markdown 格式"
                height="250px"
              />
            </div>

            <div>
              <label
                class="block text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >标签</label
              >
              <input
                v-model="publishForm.tags"
                type="text"
                class="w-full px-4 py-3 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
                placeholder="用逗号分隔，如：Blender,3D渲染,角色建模"
              />
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              class="flex-1 py-3 border rounded-2xl text-sm font-bold transition-all"
              style="border-color: var(--border-base); color: var(--text-secondary)"
              @click="isPublishDialogOpen = false"
            >
              取消
            </button>
            <button
              :disabled="isPublishing"
              class="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              @click="handlePublishToShowcase"
            >
              <span v-if="!isPublishing">发布到展示墙</span>
              <span
                v-else
                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
              ></span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Rich Preview Overlay -->
    <Transition name="fade">
      <div
        v-if="isPreviewOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10"
      >
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="isPreviewOpen = false"
        ></div>

        <div
          class="relative w-full max-w-5xl h-full rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
          style="background-color: var(--bg-card)"
        >
          <button
            class="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full text-white md:text-slate-400 md:bg-transparent md:hover:bg-white/10 transition-all"
            @click="isPreviewOpen = false"
          >
            <X class="w-5 h-5" />
          </button>

          <div
            class="flex-1 relative group overflow-hidden"
            style="background-color: var(--bg-app)"
          >
            <ModelViewer
              v-if="
                selectedAsset?.type &&
                ['GLB', 'GLTF', 'FBX', 'OBJ', 'STL'].includes(selectedAsset.type.toUpperCase())
              "
              :model-url="selectedAsset?.url"
              :auto-rotate="isAutoRotating"
              @metadata-loaded="handleMetadataLoaded"
            />
            <div
              v-else-if="selectedAsset?.thumbnail"
              class="w-full h-full flex items-center justify-center p-8"
            >
              <img
                :src="selectedAsset.thumbnail"
                class="max-w-full max-h-full object-contain rounded-xl"
              />
            </div>
            <div v-else class="w-full h-full flex items-center justify-center">
              <img
                :src="getDefaultThumbnailUrl(selectedAsset?.type)"
                class="max-w-full max-h-full object-contain rounded-xl"
              />
            </div>

            <div
              class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 backdrop-blur px-4 py-2 rounded-full shadow-lg border"
              style="
                background-color: rgba(var(--bg-card-rgb, 255, 255, 255), 0.8);
                border-color: var(--border-base);
              "
            >
              <button
                v-if="
                  selectedAsset?.type &&
                  ['GLB', 'GLTF', 'FBX', 'OBJ', 'STL'].includes(selectedAsset.type.toUpperCase())
                "
                class="p-2 rounded-full transition-colors"
                :class="
                  isAutoRotating
                    ? 'text-accent bg-accent-subtle'
                    : 'text-slate-400 hover:bg-slate-50'
                "
                @click="isAutoRotating = !isAutoRotating"
              >
                <RotateCw class="w-4 h-4" :class="isAutoRotating ? 'animate-spin-slow' : ''" />
              </button>
              <div
                v-if="
                  selectedAsset?.type &&
                  ['GLB', 'GLTF', 'FBX', 'OBJ', 'STL'].includes(selectedAsset.type.toUpperCase())
                "
                class="w-px h-4 mx-1"
                style="background-color: var(--border-base)"
              ></div>
              <button
                v-if="selectedAsset?.status === 'APPROVED' && !selectedAsset?.isIndependentShowcase"
                class="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-full transition-colors"
                title="发布到展示墙"
                @click="
                  openPublishDialog(selectedAsset);
                  isPreviewOpen = false;
                "
              >
                <SendHorizonal class="w-4 h-4" />
              </button>
              <button
                class="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-full transition-colors"
                @click="
                  openEditDialog(selectedAsset);
                  isPreviewOpen = false;
                "
              >
                <Edit3 class="w-4 h-4" />
              </button>
              <button
                class="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/40 rounded-full transition-colors"
                @click="handleDeleteWork(selectedAsset)"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Side Info Panel -->
          <div
            class="w-full md:w-80 p-6 flex flex-col border-l overflow-y-auto"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <div class="flex items-center justify-between mb-1">
              <h2 class="text-xl font-bold" style="color: var(--text-primary)">
                {{ selectedAsset?.title }}
              </h2>
            </div>
            <div class="flex items-center gap-2 mb-6">
              <span class="text-sm" style="color: var(--text-secondary)">{{
                getTypeLabel(selectedAsset?.type)
              }}</span>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                :class="getStatusBg(selectedAsset?.status)"
              >
                {{ getStatusLabel(selectedAsset?.status) }}
              </span>
            </div>

            <div class="space-y-4 flex-1">
              <p class="text-xs leading-relaxed" style="color: var(--text-secondary)">
                {{ selectedAsset?.description || '暂无描述' }}
              </p>

              <div
                class="p-4 rounded-xl border"
                style="background-color: var(--bg-app); border-color: var(--border-base)"
              >
                <p
                  class="text-[10px] uppercase font-bold mb-3 tracking-wider"
                  style="color: var(--text-secondary)"
                >
                  资产详情
                </p>
                <div class="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <p class="text-[10px]" style="color: var(--text-secondary)">格式</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ selectedAsset?.type }}
                    </p>
                  </div>
                  <div>
                    <p class="text-[10px]" style="color: var(--text-secondary)">文件大小</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ selectedAsset?.size || '未知' }} MB
                    </p>
                  </div>
                  <div v-if="selectedAsset?.vertices">
                    <p class="text-[10px]" style="color: var(--text-secondary)">顶点数</p>
                    <p class="text-xs font-bold font-mono" style="color: var(--text-primary)">
                      {{ selectedAsset.vertices.toLocaleString() }}
                    </p>
                  </div>
                  <div v-if="selectedAsset?.faces">
                    <p class="text-[10px]" style="color: var(--text-secondary)">面数</p>
                    <p class="text-xs font-bold font-mono" style="color: var(--text-primary)">
                      {{ selectedAsset.faces.toLocaleString() }}
                    </p>
                  </div>
                  <div v-if="selectedAsset?.materials">
                    <p class="text-[10px]" style="color: var(--text-secondary)">材质</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ selectedAsset.materials }} 个
                    </p>
                  </div>
                  <div v-if="selectedAsset?.animations">
                    <p class="text-[10px]" style="color: var(--text-secondary)">动画</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ selectedAsset.animations }} 个
                    </p>
                  </div>
                  <div v-if="selectedAsset?.hasAnimations">
                    <p class="text-[10px]" style="color: var(--text-secondary)">含动画</p>
                    <p class="text-xs font-bold text-emerald-500">是</p>
                  </div>
                  <div v-if="selectedAsset?.dimensions">
                    <p class="text-[10px]" style="color: var(--text-secondary)">尺寸</p>
                    <p class="text-xs font-bold font-mono" style="color: var(--text-primary)">
                      {{ selectedAsset.dimensions }}
                    </p>
                  </div>
                  <div v-if="selectedAsset?.category">
                    <p class="text-[10px]" style="color: var(--text-secondary)">分类</p>
                    <p class="text-xs font-bold text-accent">{{ selectedAsset.category.name }}</p>
                  </div>
                  <div>
                    <p class="text-[10px]" style="color: var(--text-secondary)">上传时间</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ new Date(selectedAsset?.createdAt).toLocaleDateString() }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-auto pt-6 space-y-2">
              <a
                v-if="!selectedAsset?.isIndependentShowcase"
                :href="selectedAsset?.url"
                download
                class="w-full py-3 bg-accent hover:bg-accent text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-accent/10 dark:shadow-none flex items-center justify-center gap-2"
              >
                <Download class="w-4 h-4" /> 下载文件
              </a>
              <button
                v-if="selectedAsset?.status === 'APPROVED' && !selectedAsset?.isIndependentShowcase"
                class="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 hover:bg-indigo-700"
                @click="
                  openPublishDialog(selectedAsset);
                  isPreviewOpen = false;
                "
              >
                <SendHorizonal class="w-4 h-4" /> 发布到展示墙
              </button>
              <button
                class="w-full py-3 border rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 hover:opacity-80"
                style="border-color: var(--border-base); color: var(--text-secondary)"
                @click="
                  openEditDialog(selectedAsset);
                  isPreviewOpen = false;
                "
              >
                <Edit3 class="w-4 h-4" /> 编辑信息
              </button>
            </div>
          </div>
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
.animate-spin-slow {
  animation: spin 3s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
.custom-select-v2 :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 44px;
}
</style>
