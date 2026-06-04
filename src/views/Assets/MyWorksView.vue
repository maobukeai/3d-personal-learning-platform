<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent, onUnmounted } from 'vue';
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
import { getApiErrorMessage } from '@/utils/error';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const ModelViewer = defineAsyncComponent(() => import('@/components/ModelViewer.vue'));
const MarkdownEditor = defineAsyncComponent(() => import('@/components/MarkdownEditor.vue'));
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';
import PublishWorkDialog from '@/components/PublishWorkDialog.vue';

interface AssetType {
  id: string;
  title: string;
  type: string;
  url: string;
  size?: number | null;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  description?: string | null;
  category?: { id?: string; name: string } | null;
  categoryId?: string | null;
  tags?: string | null;
  viewCount?: number;
  likeCount?: number;
  createdAt: string;
  showcaseId?: string | null;
  isIndependentShowcase?: boolean;
  thumbnail?: string | null;
  vertices?: number | null;
  faces?: number | null;
  materials?: string | null;
  animations?: string | null;
  hasAnimations?: boolean;
  dimensions?: string | null;
}

interface ShowcaseType {
  id: string;
  title: string;
  description?: string;
  assetId?: string | null;
  videoUrl?: string | null;
  fileUrl?: string | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  url?: string | null;
  status: string;
  type?: string | null;
}

interface CategoryType {
  id: string;
  name: string;
}

const searchQuery = ref('');
const activeTab = ref('ALL');
const assets = ref<AssetType[]>([]);
const isLoading = ref(false);
const selectedAsset = ref<AssetType | null>(null);
const isPreviewOpen = ref(false);
const isAutoRotating = ref(true);
const viewMode = ref<'grid' | 'list'>('grid');
const sortBy = ref('newest');

const isPublishWorkDialogOpen = ref(false);

const sortOptions = computed(() => [
  { label: t('myWorks.sortNewest'), value: 'newest' },
  { label: t('myWorks.sortOldest'), value: 'oldest' },
  { label: t('myWorks.sortNameAsc'), value: 'name_asc' },
  { label: t('myWorks.sortNameDesc'), value: 'name_desc' },
  { label: t('myWorks.sortSizeDesc'), value: 'size_desc' },
  { label: t('myWorks.sortSizeAsc'), value: 'size_asc' },
]);

const tabs = computed(() => [
  { key: 'ALL', label: t('myWorks.tabAll'), count: assets.value.length },
  { key: 'PENDING', label: t('myWorks.statusPending'), count: assets.value.filter((a: AssetType) => a.status === 'PENDING').length },
  { key: 'APPROVED', label: t('myWorks.statusApproved'), count: assets.value.filter((a: AssetType) => a.status === 'APPROVED').length },
  { key: 'REJECTED', label: t('myWorks.statusRejected'), count: assets.value.filter((a: AssetType) => a.status === 'REJECTED').length },
]);

const stats = computed(() => {
  const total = assets.value.length;
  const approved = assets.value.filter((a: AssetType) => a.status === 'APPROVED').length;
  const pending = assets.value.filter((a: AssetType) => a.status === 'PENDING').length;
  const rejected = assets.value.filter((a: AssetType) => a.status === 'REJECTED').length;
  const totalSize = assets.value.reduce((sum, a: AssetType) => sum + (a.size || 0), 0);
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
      .filter((s: ShowcaseType) => !s.assetId)
      .map((s: ShowcaseType) => ({
        ...s,
        isIndependentShowcase: true,
        url: s.videoUrl || s.thumbnailUrl || '',
        thumbnail: s.thumbnailUrl || '',
        type: s.type || 'IMAGE',
        size: 0,
        status: s.status || 'APPROVED',
        category: { name: t('myWorks.creativeWork') },
      }));

    assets.value = [...assetsRes.data, ...independentShowcases];
  } catch {
    ElMessage.error(t('myWorks.fetchFailed'));
  } finally {
    isLoading.value = false;
  }
};

const fetchCategories = async () => {
  try {
    const response = await api.get('/api/assets/categories');
    assetCategories.value = response.data;
  } catch {
    console.error('Failed to fetch categories');
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING':
      return t('myWorks.statusPending');
    case 'APPROVED':
      return t('myWorks.statusApproved');
    case 'REJECTED':
      return t('myWorks.statusRejected');
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
  if (!type) return t('myWorks.typeFile');
  const tStr = type.toUpperCase();
  if (['GLB', 'GLTF', 'FBX', 'OBJ', 'STL', 'DAE', '3DS', 'BLEND', 'USDZ', 'ABC'].includes(tStr))
    return t('myWorks.typeModel');
  if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP', 'SVG', 'BMP'].includes(tStr)) return t('myWorks.typeImage');
  if (['MP4', 'WEBM', 'MOV', 'AVI', 'MKV'].includes(tStr)) return t('myWorks.typeVideo');
  return type;
};

const filteredWorks = computed(() => {
  let result = assets.value.filter((work) => {
    const matchesSearch =
      work.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (work.description || '').toLowerCase().includes(searchQuery.value.toLowerCase());
    const matchesTab =
      activeTab.value === 'ALL' || work.status === activeTab.value;
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

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});

const openPreview = (asset: AssetType) => {
  selectedAsset.value = asset;
  isPreviewOpen.value = true;
};

const handleMetadataLoaded = async (metadata: Record<string, unknown>) => {
  const currentAsset = selectedAsset.value;
  if (!currentAsset || currentAsset.isIndependentShowcase) return;
  if (!currentAsset.vertices || currentAsset.vertices !== metadata.vertices) {
    try {
      const response = await api.patch(`/api/assets/${currentAsset.id}/metadata`, metadata);
      selectedAsset.value = { ...currentAsset, ...response.data };
      const index = assets.value.findIndex((a) => a.id === currentAsset.id);
      if (index !== -1) {
        assets.value[index] = { ...assets.value[index], ...response.data };
      }
    } catch (error) {
      console.error('Failed to save metadata:', error);
    }
  }
};

const handleDeleteWork = (work: AssetType) => {
  ElMessageBox.confirm(t('myWorks.deleteConfirm', { title: work.title }), t('myWorks.deleteTitle'), {
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
    type: 'warning',
  })
    .then(async () => {
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
        ElMessage.success(t('myWorks.deleteSuccess'));
      } catch {
        ElMessage.error(t('myWorks.deleteFailed'));
      }
    })
    .catch(() => {
      // Silently catch cancellation
    });
};

const assetCategories = ref<CategoryType[]>([]);

const isEditDialogOpen = ref(false);
const editForm = ref({
  id: '',
  title: '',
  description: '',
  categoryId: '',
});
const isSaving = ref(false);

const openEditDialog = (work: AssetType) => {
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
    ElMessage.warning(t('myWorks.titleRequired'));
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
    ElMessage.success(t('myWorks.updateSuccess'));
    isEditDialogOpen.value = false;
  } catch {
    ElMessage.error(t('myWorks.updateFailed'));
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

const openPublishDialog = (work: AssetType) => {
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
    ElMessage.warning(t('myWorks.titleRequired'));
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
    ElMessage.success(t('myWorks.publishSuccess'));
    isPublishDialogOpen.value = false;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('myWorks.publishFailed')));
  } finally {
    isPublishing.value = false;
  }
};
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Header -->
    <div
      class="h-auto md:h-16 py-3 md:py-0 border-b px-4 md:px-8 flex flex-col md:flex-row md:items-center md:justify-between shrink-0 gap-3"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-2.5">
        <h1 class="text-lg md:text-xl font-bold" style="color: var(--text-primary)">{{ t('myWorks.title') }}</h1>
        <span class="bg-accent/10 text-accent text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full"
          >{{ t('myWorks.totalCount', { n: assets.length }) }}</span
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
            :placeholder="t('myWorks.searchPlaceholder')"
            class="pl-10 pr-4 py-2 border-none rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 w-full md:w-64 transition-all"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          />
        </div>
        <button type="button" class="flex items-center justify-center p-2.5 bg-accent text-white rounded-xl shadow-lg shadow-accent/10 dark:shadow-none transition-all" @click="isPublishWorkDialogOpen = true">
          <Plus class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Stats Bar -->
    <div
      class="px-2 md:px-8 py-2 md:py-3 border-b shrink-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between md:justify-start gap-1 md:gap-6 overflow-x-auto scrollbar-hide">
        <div
          class="flex flex-col items-center justify-center p-1.5 md:flex-row md:gap-2.5 md:px-4 md:py-2.5 rounded-xl shrink-0"
          style="background-color: var(--bg-app)"
        >
          <Box class="w-3 h-3 md:w-4 md:h-4 text-accent" />
          <div class="text-center md:text-left mt-0.5 md:mt-0">
            <p class="text-[8px] md:text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.statTotal') }}</p>
            <p class="text-[10px] md:text-sm font-bold" style="color: var(--text-primary)">{{ stats.total }}</p>
          </div>
        </div>
        <div
          class="flex flex-col items-center justify-center p-1.5 md:flex-row md:gap-2.5 md:px-4 md:py-2.5 rounded-xl shrink-0"
          style="background-color: var(--bg-app)"
        >
          <CheckCircle2 class="w-3 h-3 md:w-4 md:h-4 text-emerald-500" />
          <div class="text-center md:text-left mt-0.5 md:mt-0">
            <p class="text-[8px] md:text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.statusApproved') }}</p>
            <p class="text-[10px] md:text-sm font-bold text-emerald-500">{{ stats.approved }}</p>
          </div>
        </div>
        <div
          class="flex flex-col items-center justify-center p-1.5 md:flex-row md:gap-2.5 md:px-4 md:py-2.5 rounded-xl shrink-0"
          style="background-color: var(--bg-app)"
        >
          <Clock class="w-3 h-3 md:w-4 md:h-4 text-amber-500" />
          <div class="text-center md:text-left mt-0.5 md:mt-0">
            <p class="text-[8px] md:text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.statPending') }}</p>
            <p class="text-[10px] md:text-sm font-bold text-amber-500">{{ stats.pending }}</p>
          </div>
        </div>
        <div
          class="flex flex-col items-center justify-center p-1.5 md:flex-row md:gap-2.5 md:px-4 md:py-2.5 rounded-xl shrink-0"
          style="background-color: var(--bg-app)"
        >
          <XCircle class="w-3 h-3 md:w-4 md:h-4 text-rose-500" />
          <div class="text-center md:text-left mt-0.5 md:mt-0">
            <p class="text-[8px] md:text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.statRejected') }}</p>
            <p class="text-[10px] md:text-sm font-bold text-rose-500">{{ stats.rejected }}</p>
          </div>
        </div>
        <div
          class="flex flex-col items-center justify-center p-1.5 md:flex-row md:gap-2.5 md:px-4 md:py-2.5 rounded-xl shrink-0"
          style="background-color: var(--bg-app)"
        >
          <HardDrive class="w-3 h-3 md:w-4 md:h-4 text-blue-500" />
          <div class="text-center md:text-left mt-0.5 md:mt-0">
            <p class="text-[8px] md:text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.statSize') }}</p>
            <p class="text-[10px] md:text-sm font-bold text-blue-500">{{ stats.totalSize }}M</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs + Sort & View Controls -->
    <div
      class="border-b px-4 md:px-8 py-2 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between md:justify-start gap-4 md:gap-6 overflow-x-auto flex-nowrap scrollbar-hide">
        <button v-for="tab in tabs" :key="tab.key" type="button" class="relative py-2 text-xs md:text-sm font-medium transition-all flex items-center gap-1 md:gap-2 shrink-0" :class="activeTab === tab.key ? 'text-accent' : 'hover:text-accent'" :style="activeTab !== tab.key ? 'color: var(--text-secondary)' : ''" @click="activeTab = tab.key">
          {{ tab.label }}
          <span
            class="text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded-full"
            :class="
              activeTab === tab.key
                ? 'bg-accent/10 text-accent'
                : 'bg-slate-100 dark:bg-white/5 text-slate-400'
            "
          >
            {{ tab.count }}
          </span>
          <div
            v-if="activeTab === tab.key"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
          ></div>
        </button>
      </div>

      <div class="flex items-center justify-between md:justify-end gap-2 md:gap-3 w-full md:w-auto">
        <div class="relative flex-1 md:flex-initial">
          <select
            v-model="sortBy"
            class="w-full appearance-none pl-7 pr-7 py-1 md:py-1.5 border-none rounded-lg text-[10px] md:text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 cursor-pointer"
            style="background-color: var(--bg-app); color: var(--text-primary)"
          >
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <ArrowUpDown
            class="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2"
            style="color: var(--text-secondary)"
          />
        </div>
        <div
          class="flex items-center rounded-lg overflow-hidden border shrink-0"
          style="border-color: var(--border-base)"
        >
          <button
            type="button" class="p-1 md:p-1.5 transition-all" :class="viewMode === 'grid' ? 'bg-accent text-white' : ''" :style="
              viewMode !== 'grid'
                ? 'color: var(--text-secondary); background-color: var(--bg-app)'
                : ''
            " @click="viewMode = 'grid'">
            <LayoutGrid class="w-3 h-3 md:w-3.5 md:h-3.5" />
          </button>
          <button
            type="button" class="p-1 md:p-1.5 transition-all" :class="viewMode === 'list' ? 'bg-accent text-white' : ''" :style="
              viewMode !== 'list'
                ? 'color: var(--text-secondary); background-color: var(--bg-app)'
                : ''
            " @click="viewMode = 'list'">
            <List class="w-3 h-3 md:w-3.5 md:h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Works Grid/List Area -->
    <div class="flex-1 overflow-y-auto p-2 md:p-8 scrollbar-hide">
      <div class="max-w-none">
        <!-- Grid View -->
        <div
          v-if="viewMode === 'grid' && filteredWorks.length > 0"
          class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 md:gap-6"
        >
          <div
            v-for="work in filteredWorks"
            :key="work.id"
            class="group rounded-lg md:rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col relative"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <div
              class="aspect-square md:aspect-video relative overflow-hidden bg-slate-100 dark:bg-white/5 flex items-center justify-center"
            >
              <img v-if="work.thumbnail" alt="" :src="work.thumbnail" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" @error="($event.target as HTMLImageElement).src = getDefaultThumbnailUrl(work.type)" />
              <img v-else alt="" :src="getDefaultThumbnailUrl(work.type)" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />

              <div class="absolute top-1 left-1 md:top-3 md:left-3">
                <div
                  class="backdrop-blur px-1 py-0.5 rounded-[2px] text-[7px] md:text-[10px] font-bold text-white shadow-sm"
                  :class="getStatusBg(work.status)"
                >
                  {{ getStatusLabel(work.status) }}
                </div>
              </div>

              <div
                class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 md:gap-2"
              >
                <button type="button" class="p-1 md:p-2.5 rounded-md md:rounded-xl hover:bg-accent-subtle hover:text-accent transition-all shadow-lg" style="background-color: var(--bg-card); color: var(--text-primary)" @click="openPreview(work)">
                  <Eye class="w-3 md:w-4 md:h-4" />
                </button>
                <button type="button" class="p-1 md:p-2.5 rounded-md md:rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/40 transition-all shadow-lg" style="background-color: var(--bg-card)" @click="handleDeleteWork(work)">
                  <Trash2 class="w-3 md:w-4 md:h-4" />
                </button>
              </div>
            </div>

            <div class="p-1.5 md:p-4 flex-1 flex flex-col">
              <h3 class="text-[10px] md:text-sm font-bold truncate mb-0.5" style="color: var(--text-primary)">
                {{ work.title }}
              </h3>
              <p class="text-[8px] md:text-[10px] text-slate-400">
                {{ new Date(work.createdAt).toLocaleDateString([], { month: 'numeric', day: 'numeric' }) }}
              </p>

              <div
                class="mt-1.5 pt-1.5 border-t flex items-center justify-between"
                style="border-color: var(--border-base)"
              >
                <div
                  class="flex items-center gap-1 md:gap-3 text-[8px] md:text-[10px]"
                  style="color: var(--text-secondary)"
                >
                  <span v-if="work.size" class="flex items-center gap-0.5"><HardDrive class="w-2 h-2" /> {{ Math.round(work.size) }}M</span>
                </div>
                <a
                  v-if="!work.isIndependentShowcase"
                  :href="work.url"
                  download
                  class="text-accent"
                  @click.stop
                >
                  <Download class="w-2.5 h-2.5" />
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
              <img v-if="work.thumbnail" alt="" :src="work.thumbnail" class="w-full h-full object-cover" />
              <img v-else alt="" :src="getDefaultThumbnailUrl(work.type)" class="w-full h-full object-cover" />
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
                class="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold hidden md:inline-flex"
                >{{ work.category.name }}</span
              >
              <span class="w-16 text-center hidden md:inline-block">{{ getTypeLabel(work.type) }}</span>
              <span v-if="work.size" class="w-16 text-right hidden md:inline-block">{{ work.size }} MB</span>
              <span class="w-20 text-right hidden md:inline-block">{{
                new Date(work.createdAt).toLocaleDateString()
              }}</span>
            </div>

            <div
              class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <button v-if="work.status === 'APPROVED' && !work.isIndependentShowcase" type="button" class="p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/40 text-indigo-500 transition-all" :title="t('myWorks.publishToShowcase')" @click.stop="openPublishDialog(work)">
                <SendHorizonal class="w-4 h-4" />
              </button>
              <button type="button" class="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-500 transition-all" @click.stop="openEditDialog(work)">
                <Edit3 class="w-4 h-4" />
              </button>
              <button type="button" class="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/40 text-rose-500 transition-all" @click.stop="handleDeleteWork(work)">
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
            {{ searchQuery ? t('myWorks.emptySearchTitle') : t('myWorks.emptyTitle') }}
          </p>
          <p class="text-xs mb-4 opacity-60">
            {{ searchQuery ? t('myWorks.emptySearchDesc') : t('myWorks.emptyDesc') }}
          </p>
          <button v-if="!searchQuery" type="button" class="px-6 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-accent/10" @click="isPublishWorkDialogOpen = true">
            <Plus class="w-4 h-4" /> {{ t('myWorks.uploadFirst') }}
          </button>
        </div>
      </div>
    </div>

    <PublishWorkDialog v-model="isPublishWorkDialogOpen" @published="fetchMyAssets" />

    <!-- Edit Dialog -->
    <Transition name="fade">
      <div
        v-if="isEditDialogOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isEditDialogOpen = false"
        ></div>
        <div
          class="relative w-full md:max-w-3xl h-full md:h-auto md:max-h-[90vh] overflow-y-auto p-4 md:p-8 rounded-none md:rounded-3xl shadow-2xl space-y-6"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-lg md:text-xl font-bold" style="color: var(--text-primary)">{{ t('myWorks.editTitle') }}</h3>
            <button type="button" style="color: var(--text-secondary)" @click="isEditDialogOpen = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label
                class="block text-[10px] md:text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >{{ t('myWorks.workName') }}</label
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
                class="block text-[10px] md:text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >{{ t('myWorks.workDesc') }}</label
              >
              <MarkdownEditor
                v-model="editForm.description"
                :placeholder="t('myWorks.workDescPlaceholder')"
                :height="isMobile ? '200px' : '250px'"
              />
            </div>

            <div>
              <label
                class="block text-[10px] md:text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >{{ t('myWorks.category') }}</label
              >
              <el-select
                v-model="editForm.categoryId"
                :placeholder="t('myWorks.selectCategoryPlaceholder')"
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
            <button type="button" class="flex-1 py-3 border rounded-2xl text-sm font-bold transition-all" style="border-color: var(--border-base); color: var(--text-secondary)" @click="isEditDialogOpen = false">
              {{ t('common.cancel') }}
            </button>
            <button type="button" :disabled="isSaving" class="flex-1 py-3 bg-accent text-white rounded-2xl text-sm font-bold shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2" @click="handleSaveEdit">
              <span v-if="!isSaving">{{ t('myWorks.saveChanges') }}</span>
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
        class="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isPublishDialogOpen = false"
        ></div>
        <div
          class="relative w-full md:max-w-3xl h-full md:h-auto md:max-h-[90vh] overflow-y-auto p-4 md:p-8 rounded-none md:rounded-3xl shadow-2xl space-y-6"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-lg md:text-xl font-bold" style="color: var(--text-primary)">{{ t('myWorks.publishToShowcase') }}</h3>
            <button type="button" style="color: var(--text-secondary)" @click="isPublishDialogOpen = false">
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
                {{ t('myWorks.publishShowcaseDesc') }}
              </p>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label
                class="block text-[10px] md:text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >{{ t('myWorks.showcaseTitle') }}</label
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
                :placeholder="t('myWorks.showcaseTitle')"
              />
            </div>

            <div>
              <label
                class="block text-[10px] md:text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >{{ t('myWorks.showcaseDesc') }}</label
              >
              <MarkdownEditor
                v-model="publishForm.description"
                :placeholder="t('myWorks.showcaseDescPlaceholder')"
                :height="isMobile ? '200px' : '250px'"
              />
            </div>

            <div>
              <label
                class="block text-[10px] md:text-xs font-bold uppercase mb-2 ml-1"
                style="color: var(--text-secondary)"
                >{{ t('myWorks.tags') }}</label
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
                :placeholder="t('myWorks.tagsPlaceholder')"
              />
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button type="button" class="flex-1 py-3 border rounded-2xl text-sm font-bold transition-all" style="border-color: var(--border-base); color: var(--text-secondary)" @click="isPublishDialogOpen = false">
              {{ t('common.cancel') }}
            </button>
            <button type="button" :disabled="isPublishing" class="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2" @click="handlePublishToShowcase">
              <span v-if="!isPublishing">{{ t('myWorks.publishToShowcase') }}</span>
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
        class="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-10"
      >
        <div
          class="absolute inset-0 bg-black/60 backdrop-blur-sm"
          @click="isPreviewOpen = false"
        ></div>

        <div
          class="relative w-full max-w-5xl h-full rounded-none md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
          style="background-color: var(--bg-card)"
        >
          <button type="button" class="absolute top-4 right-4 z-10 p-2 bg-white/10 hover:bg-white/20 backdrop-blur rounded-full text-white md:text-slate-400 md:bg-transparent md:hover:bg-white/10 transition-all" @click="isPreviewOpen = false">
            <X class="w-5 h-5" />
          </button>

          <div
            class="flex-1 relative group overflow-hidden h-[40vh] md:h-full"
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
              <img alt="" :src="selectedAsset?.thumbnail" class="max-w-full max-h-full object-contain rounded-xl" />
            </div>
            <div v-else class="w-full h-full flex items-center justify-center">
              <img alt="" :src="getDefaultThumbnailUrl(selectedAsset?.type || '')" class="max-w-full max-h-full object-contain rounded-xl" />
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
                " type="button" class="p-2 rounded-full transition-colors" :class="
                  isAutoRotating
                    ? 'text-accent bg-accent-subtle'
                    : 'text-slate-400 hover:bg-slate-50'
                " @click="isAutoRotating = !isAutoRotating">
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
                v-if="selectedAsset?.status === 'APPROVED' && !selectedAsset?.isIndependentShowcase" type="button" class="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-full transition-colors" :title="t('myWorks.publishToShowcase')" @click="
                  openPublishDialog(selectedAsset);
                  isPreviewOpen = false;
                ">
                <SendHorizonal class="w-4 h-4" />
              </button>
              <button
                type="button" class="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-full transition-colors" @click="
                  if (selectedAsset) openEditDialog(selectedAsset);
                  isPreviewOpen = false;
                ">
                <Edit3 class="w-4 h-4" />
              </button>
              <button type="button" class="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/40 rounded-full transition-colors" @click="selectedAsset && handleDeleteWork(selectedAsset)">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Side Info Panel -->
          <div
            class="flex-1 md:w-80 p-4 md:p-6 flex flex-col border-t md:border-t-0 md:border-l overflow-y-auto min-h-0"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <div class="flex items-center justify-between mb-1">
              <h2 class="text-lg md:text-xl font-bold" style="color: var(--text-primary)">
                {{ selectedAsset?.title }}
              </h2>
            </div>
            <div class="flex items-center gap-2 mb-4 md:mb-6">
              <span class="text-xs md:text-sm" style="color: var(--text-secondary)">{{
                getTypeLabel(selectedAsset?.type || '')
              }}</span>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                :class="getStatusBg(selectedAsset?.status || 'PENDING')"
              >
                {{ getStatusLabel(selectedAsset?.status || 'PENDING') }}
              </span>
            </div>

            <div class="space-y-4 flex-1">
              <p class="text-xs leading-relaxed" style="color: var(--text-secondary)">
                {{ selectedAsset?.description || t('myWorks.noDescription') }}
              </p>

              <div
                class="p-3 md:p-4 rounded-xl border"
                style="background-color: var(--bg-app); border-color: var(--border-base)"
              >
                <p
                  class="text-[10px] uppercase font-bold mb-3 tracking-wider"
                  style="color: var(--text-secondary)"
                >
                  {{ t('myWorks.assetDetails') }}
                </p>
                <div class="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <p class="text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.format') }}</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ selectedAsset?.type }}
                    </p>
                  </div>
                  <div>
                    <p class="text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.fileSize') }}</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ selectedAsset?.size || t('myWorks.unknown') }} MB
                    </p>
                  </div>
                  <div v-if="selectedAsset?.vertices">
                    <p class="text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.vertices') }}</p>
                    <p class="text-xs font-bold font-mono" style="color: var(--text-primary)">
                      {{ selectedAsset.vertices.toLocaleString() }}
                    </p>
                  </div>
                  <div v-if="selectedAsset?.faces">
                    <p class="text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.faces') }}</p>
                    <p class="text-xs font-bold font-mono" style="color: var(--text-primary)">
                      {{ selectedAsset.faces.toLocaleString() }}
                    </p>
                  </div>
                  <div v-if="selectedAsset?.materials">
                    <p class="text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.materials') }}</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ selectedAsset.materials }}
                    </p>
                  </div>
                  <div v-if="selectedAsset?.animations">
                    <p class="text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.animations') }}</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ selectedAsset.animations }}
                    </p>
                  </div>
                  <div v-if="selectedAsset?.hasAnimations">
                    <p class="text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.hasAnimations') }}</p>
                    <p class="text-xs font-bold text-emerald-500">{{ t('myWorks.yes') }}</p>
                  </div>
                  <div v-if="selectedAsset?.dimensions">
                    <p class="text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.dimensions') }}</p>
                    <p class="text-xs font-bold font-mono" style="color: var(--text-primary)">
                      {{ selectedAsset.dimensions }}
                    </p>
                  </div>
                  <div v-if="selectedAsset?.category">
                    <p class="text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.categoryLabel') }}</p>
                    <p class="text-xs font-bold text-accent">{{ selectedAsset.category.name }}</p>
                  </div>
                  <div>
                    <p class="text-[10px]" style="color: var(--text-secondary)">{{ t('myWorks.uploadTime') }}</p>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ selectedAsset?.createdAt ? new Date(selectedAsset.createdAt).toLocaleDateString() : '' }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 md:mt-auto pt-4 md:pt-6 space-y-2 shrink-0">
              <a
                v-if="!selectedAsset?.isIndependentShowcase"
                :href="selectedAsset?.url"
                download
                class="w-full py-3 bg-accent hover:bg-accent text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-accent/10 dark:shadow-none flex items-center justify-center gap-2"
              >
                <Download class="w-4 h-4" /> {{ t('myWorks.downloadFile') }}
              </a>
              <button
                v-if="selectedAsset?.status === 'APPROVED' && !selectedAsset?.isIndependentShowcase" type="button" class="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-2 hover:bg-indigo-700" @click="
                  if (selectedAsset) openPublishDialog(selectedAsset);
                  isPreviewOpen = false;
                ">
                <SendHorizonal class="w-4 h-4" /> {{ t('myWorks.publishToShowcase') }}
              </button>
              <button
                type="button" class="w-full py-3 border rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 hover:opacity-80" style="border-color: var(--border-base); color: var(--text-secondary)" @click="
                  if (selectedAsset) openEditDialog(selectedAsset);
                  isPreviewOpen = false;
                ">
                <Edit3 class="w-4 h-4" /> {{ t('myWorks.editInfo') }}
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
