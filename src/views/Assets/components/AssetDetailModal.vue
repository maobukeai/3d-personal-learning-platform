<script setup lang="ts">
import { ref, watch, computed, defineAsyncComponent } from 'vue';
import { logError } from '@/utils/error';
import { useRouter } from 'vue-router';
import {
  Heart,
  Download,
  Shield,
  Settings,
  Eye,
  RefreshCw,
  Layers,
  FileArchive,
  FileText,
  ExternalLink,
  Ruler,
  Grid2X2,
  Image as ImageIcon,
  CheckCircle2,
  FolderOpen,
  Globe,
  Maximize2,
  Box,
  Lock,
  Share2,
  MessageSquare,
  Loader2,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getApiErrorMessage } from '@/utils/error';
import api, { getAssetUrl } from '@/utils/api';
import axios from 'axios';
import { useLabel } from '@/utils/i18n';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { formatFileSize } from '../resourceUtils';
import { downloadFileMultiThreaded } from '@/utils/downloadHelper';
import { buildFileTree, flattenFileTree } from '@/utils/zipHelper';
import type { TreeNode, FlattenedNode } from '@/utils/zipHelper';

const ModelViewer = defineAsyncComponent(() => import('@/components/ModelViewer.vue'));
import { useAuthStore } from '@/stores/auth';
import ShareDialog from './ShareDialog.vue';

const props = withDefaults(
  defineProps<{
    show?: boolean;
    assetId?: string | null;
    preloadedAsset?: any;
    inline?: boolean;
  }>(),
  {
    show: false,
    assetId: null,
    preloadedAsset: null,
    inline: false,
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update'): void;
  (e: 'edit', asset: any): void;
}>();

const label = useLabel();
const asset = ref<any | null>(null);
const isLoading = ref(false);
const isLiked = ref(false);
const likeCount = ref(0);
const downloadCount = ref(0);

// Download state for parallel downloader
const isDownloading = ref(false);
const downloadProgress = ref(0);
const downloadSpeedStr = ref('');
let downloadAbortController: AbortController | null = null;

const cancelDownload = () => {
  if (downloadAbortController) {
    downloadAbortController.abort();
    downloadAbortController = null;
  }
  isDownloading.value = false;
  downloadProgress.value = 0;
  downloadSpeedStr.value = '';
};

// Sketchfab interactive 3D rendering modes & scene controls
const modelViewerRef = ref<any | null>(null);
const shareDialogRef = ref<any | null>(null);

const authStore = useAuthStore();
const router = useRouter();

const isVipUser = computed(() => {
  if (!authStore.isAuthenticated) return false;
  const sub = authStore.user?.subscription as any;
  if (!sub) return false;
  if (sub.status !== 'ACTIVE') return false;
  if (sub.endDate && new Date(sub.endDate) < new Date()) return false;
  return sub.plan?.name !== 'FREE' && (sub.plan?.priority ?? 0) > 0;
});

const isOwner = computed(() => {
  if (!asset.value || !authStore.isAuthenticated) return false;
  return authStore.user?.id === asset.value.userId;
});

const isAdmin = computed(() => {
  if (!authStore.isAuthenticated) return false;
  return authStore.user?.role === 'ADMIN';
});

const canDownload = computed(() => {
  if (!asset.value) return false;
  if (asset.value.isFree) return true;
  return isOwner.value || isAdmin.value || isVipUser.value;
});

const handleEdit = () => {
  if (!asset.value) return;
  emit('edit', asset.value);
};

const handleDelete = async () => {
  if (!asset.value) return;
  try {
    await ElMessageBox.confirm(
      label(`确定要删除资源「${asset.value.title}」吗？此操作不可恢复。`, `Are you sure you want to delete asset "${asset.value.title}"? This action cannot be undone.`),
      label('删除资源', 'Delete Asset'),
      {
        type: 'warning',
        confirmButtonText: label('删除', 'Delete'),
        cancelButtonText: label('取消', 'Cancel'),
      }
    );
    isLoading.value = true;
    await api.delete(`/api/assets/${asset.value.id}`);
    ElMessage.success(label('资源删除成功', 'Asset deleted successfully'));
    emit('close');
    emit('update');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
    }
  } finally {
    isLoading.value = false;
  }
};

const parsedTags = computed(() => {
  if (!asset.value || !asset.value.tags) return [];
  try {
    const parsed = JSON.parse(asset.value.tags);
    if (Array.isArray(parsed)) return parsed.map((t: string) => t.trim()).filter(Boolean);
  } catch (e) {
    return asset.value.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
  }
  return [];
});

// packageFiles is loaded asynchronously via a dedicated endpoint to avoid blocking the modal open
const packageFiles = ref<string[]>([]);
const isPackageFilesLoading = ref(false);



const parsedFileTree = computed(() => {
  const tree = buildFileTree(packageFiles.value);
  return flattenFileTree(tree);
});

const comments = ref<any[]>([]);
const isCommentsLoading = ref(false);
const newCommentContent = ref('');
const isSubmittingComment = ref(false);
const isFilesCollapsed = ref(true);

const fetchComments = async () => {
  const targetId = asset.value?.id || props.assetId;
  if (!targetId) return;
  isCommentsLoading.value = true;
  try {
    const { data } = await api.get(`/api/assets/${targetId}/comments`);
    comments.value = data;
  } catch (err) {
    logError('Failed to fetch comments:', err);
  } finally {
    isCommentsLoading.value = false;
  }
};

const handlePostComment = async () => {
  const targetId = asset.value?.id || props.assetId;
  if (!targetId || !newCommentContent.value.trim()) return;
  isSubmittingComment.value = true;
  try {
    const { data } = await api.post(`/api/assets/${targetId}/comments`, {
      content: newCommentContent.value.trim()
    });
    comments.value.unshift(data);
    newCommentContent.value = '';
    ElMessage.success(label('评论发表成功', 'Comment posted successfully'));
  } catch (err: any) {
    logError('Failed to post comment:', err);
    ElMessage.error(err.response?.data?.error || label('评论发表失败', 'Failed to post comment'));
  } finally {
    isSubmittingComment.value = false;
  }
};

const handleDeleteComment = async (commentId: string) => {
  try {
    await api.delete(`/api/assets/comments/${commentId}`);
    comments.value = comments.value.filter(c => c.id !== commentId);
    ElMessage.success(label('评论已删除', 'Comment deleted'));
  } catch (err: any) {
    logError('Failed to delete comment:', err);
    ElMessage.error(err.response?.data?.error || label('删除评论失败', 'Failed to delete comment'));
  }
};

const canDeleteComment = (comment: any) => {
  if (!authStore.user) return false;
  return authStore.user.id === comment.userId || authStore.user.role === 'ADMIN';
};

const handleShare = () => {
  if (!asset.value) return;
  shareDialogRef.value?.open({
    id: asset.value.id,
    title: asset.value.title,
    userId: asset.value.userId,
    createdAt: asset.value.createdAt
  });
};
const currentViewMode = ref<'solid' | 'wireframe' | 'solid+wireframe'>('solid');
const isClayMode = ref(false);
const autoRotate = ref(false);
const currentEnvironment = ref('studio');
const exposure = ref(1.0);
const showGrid = ref(true);
const showAxes = ref(false);
const currentBgColor = ref('#f1f5f9'); // Default to light background!

const bgColors = [
  { value: '#f1f5f9', label: '浅灰 (Default)' },
  { value: '#64748b', label: '中灰' },
  { value: '#0f172a', label: '深色' },
  { value: '#ffffff', label: '纯白' },
];

const toggleAutoRotate = () => {
  autoRotate.value = !autoRotate.value;
};

const handleViewModeChange = (mode: 'solid' | 'wireframe' | 'solid+wireframe') => {
  currentViewMode.value = mode;
  modelViewerRef.value?.setViewMode(mode);
};

const toggleClay = () => {
  isClayMode.value = !isClayMode.value;
  modelViewerRef.value?.toggleClayMode();
};

const changeEnvironment = (env: string) => {
  currentEnvironment.value = env;
};

const applyCameraPreset = (preset: 'iso' | 'front' | 'side' | 'top') => {
  if (!modelViewerRef.value) return;
  const target = { x: 0, y: 0, z: 0 };
  let pos = { x: 3, y: 3, z: 3 }; // iso
  if (preset === 'front') pos = { x: 0, y: 0, z: 4.5 };
  if (preset === 'side') pos = { x: 4.5, y: 0, z: 0 };
  if (preset === 'top') pos = { x: 0, y: 4.5, z: 0 };
  modelViewerRef.value.flyTo(pos, target);
};

const triggerFullscreen = () => {
  modelViewerRef.value?.toggleFullscreen();
};

const originalityLabel = computed(() => {
  if (!asset.value) return '';
  const o = asset.value.originality;
  if (o === 'ORIGINAL') return label('原创', 'Original');
  if (o === 'AUTHORIZED') return label('授权发布', 'Authorized');
  if (o === 'REMIX') return label('二次创作', 'Remix');
  return label('原创', 'Original');
});

const meshTypeLabel = computed(() => {
  if (!asset.value) return '';
  const m = asset.value.meshType;
  if (m === 'LOW_POLY') return label('低模 (Low Poly)', 'Low Poly');
  if (m === 'HIGH_POLY') return label('高模 (High Poly)', 'High Poly');
  if (m === 'CAD') return label('工程模型 (CAD)', 'CAD');
  return label('未指定', 'Not Specified');
});

const parsedPbrChannels = computed<string[]>(() => {
  if (!asset.value?.pbrChannels) return [];
  const chs = asset.value.pbrChannels;
  if (Array.isArray(chs)) return chs;
  try {
    return JSON.parse(chs) || [];
  } catch {
    return [];
  }
});

const parsedFormats = computed<string[]>(() => {
  if (!asset.value?.formats) return [];
  const f = asset.value.formats;
  if (Array.isArray(f)) return f;
  try {
    return JSON.parse(f) || [];
  } catch {
    return [f];
  }
});

const isModelAsset = computed(() => {
  if (!asset.value) return false;
  const type = (asset.value.type || '').toUpperCase();
  return ['GLB', 'GLTF', 'FBX', 'OBJ', 'STL'].includes(type) || !!asset.value.url?.endsWith('.glb');
});

const fetchPackageFiles = async () => {
  const targetId = asset.value?.id || props.assetId;
  if (!targetId) return;
  isPackageFilesLoading.value = true;
  try {
    const { data } = await api.get(`/api/assets/${targetId}/package-files`);
    packageFiles.value = data.packageFiles || [];
  } catch (err) {
    logError('[AssetDetailModal] Failed to load package file list:', err);
    packageFiles.value = [];
  } finally {
    isPackageFilesLoading.value = false;
  }
};

watch(
  () => asset.value,
  (newAsset) => {
    if (newAsset && newAsset.packageFilesList) {
      try {
        const parsed = JSON.parse(newAsset.packageFilesList);
        if (Array.isArray(parsed) && parsed.length > 0) {
          packageFiles.value = parsed;
        }
      } catch (e) {
        logError('[AssetDetailModal] Failed to parse packageFilesList fallback:', e);
      }
    }
  }
);

const fetchAssetDetail = async () => {
  if (!props.assetId) return;
  try {
    isLoading.value = true;
    const { data } = await api.get(`/api/assets/${props.assetId}`);
    asset.value = data;
    isLiked.value = !!data.isLiked;
    likeCount.value = data.likes || 0;
    downloadCount.value = data.downloads || 0;
    // Only fetch package files if the asset has a package URL
    if (data.packageUrl) {
      fetchPackageFiles();
    }
  } catch (err) {
    logError('[AssetDetailModal] Failed to load asset details:', err);
    ElMessage.error(label('加载资源详情失败', 'Failed to load details'));
    emit('close');
  } finally {
    isLoading.value = false;
  }
};

const handleScreenshotCaptured = async (base64Data: string) => {
  if (asset.value && !asset.value.thumbnail && !asset.value.thumbnailUrl) {
    try {
      const { data } = await api.patch(`/api/assets/${asset.value.id}/thumbnail`, {
        thumbnail: base64Data
      });
      if (data && data.thumbnail) {
        asset.value.thumbnail = data.thumbnail;
        emit('update');
      }
    } catch (err) {
      logError('[AssetDetailModal] Failed to auto-upload thumbnail:', err);
    }
  }
};

const handleLike = async () => {
  if (!asset.value) return;
  try {
    const { data } = await api.post(`/api/assets/${asset.value.id}/like`);
    isLiked.value = data.liked;
    likeCount.value = data.likes;
    ElMessage.success(
      data.liked
        ? label('已添加到收藏列表', 'Added to favorites')
        : label('已从收藏中移除', 'Removed from favorites'),
    );
    emit('update');
  } catch (err) {
    logError('Failed to like asset:', err);
    ElMessage.error(label('收藏操作失败', 'Failed to update favorite'));
  }
};

const handleDownload = async (isPackage = false) => {
  if (!asset.value) return;

  if (!canDownload.value) {
    ElMessage.warning(label('该资源为会员专享，请先升级为会员后再下载。', 'This resource is VIP-only. Please upgrade to download.'));
    return;
  }

  const downloadUrl = isPackage ? asset.value.packageUrl : asset.value.url;
  if (!downloadUrl) return;

  // Cancel any ongoing download
  cancelDownload();

  isDownloading.value = true;
  downloadProgress.value = 1; // start at 1% for instant UI feedback
  downloadSpeedStr.value = '';
  downloadAbortController = new AbortController();

  try {
    const ext = downloadUrl.split('.').pop()?.split('?')[0] || (isPackage ? 'zip' : 'glb');
    const sanitizedTitle = asset.value.title.replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${sanitizedTitle || 'model'}.${ext}`;
    const resolvedUrl = getAssetUrl(downloadUrl);

    const totalSizeOverrideBytes = (isPackage ? (asset.value.packageSize || 0) : (asset.value.size || 0)) * 1024 * 1024;

    await downloadFileMultiThreaded(
      resolvedUrl,
      filename,
      (percent) => {
        downloadProgress.value = percent;
      },
      (speed) => {
        downloadSpeedStr.value = speed;
      },
      downloadAbortController.signal,
      totalSizeOverrideBytes
    );

    // Record download on backend
    const { data } = await api.post(`/api/assets/${asset.value.id}/download`);
    downloadCount.value = data.downloads;
    emit('update');
  } catch (err: any) {
    if (axios.isCancel(err) || err?.name === 'CanceledError' || err?.name === 'AbortError' || err?.message === 'canceled') {
      return;
    }
    logError('Failed to download asset:', err);
    const msg = err.response?.data?.error || label('下载失败，您可能需要会员权限', 'Download failed, you may need VIP permission');
    ElMessage.error(msg);
  } finally {
    isDownloading.value = false;
    downloadProgress.value = 0;
    downloadSpeedStr.value = '';
    downloadAbortController = null;
  }
};

watch(
  () => props.preloadedAsset,
  (newAsset) => {
    if (newAsset) {
      asset.value = newAsset;
      isLiked.value = !!newAsset.isLiked;
      likeCount.value = newAsset.likes || 0;
      downloadCount.value = newAsset.downloads || 0;
      
      void fetchComments();
      if (newAsset.packageUrl) {
        void fetchPackageFiles();
      }
    }
  },
  { immediate: true }
);

watch(
  [() => props.show, () => props.assetId],
  ([newShow, newAssetId]) => {
    if (props.inline) return;
    if (newShow && newAssetId) {
      packageFiles.value = [];
      void fetchAssetDetail();
      void fetchComments();
    } else if (!newShow) {
      asset.value = null;
      comments.value = [];
      newCommentContent.value = '';
      packageFiles.value = [];
      isFilesCollapsed.value = true;
      cancelDownload();
    }
  },
  { immediate: true }
);
</script>

<template>
  <component
    :is="inline ? 'div' : Modal"
    v-bind="inline ? { class: 'w-full text-left' } : { show: show, size: 'xxl', padding: 'md', glassCard: true }"
    @close="emit('close')"
  >
    <template v-if="!inline" #header>
      <div class="flex items-center gap-3">
        <Box class="h-5 w-5 text-indigo-400" />
        <div>
          <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)] flex items-center gap-2">
            <span>{{ asset?.title || label('资源档案详情', 'Asset File Details') }}</span>
            <span
              v-if="asset && !asset.isFree"
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 animate-pulse"
            >
              会员专享下载
            </span>
            <span
              v-else-if="asset"
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
            >
              免费下载
            </span>
          </h3>
          <p class="text-xs text-[var(--text-muted)] mt-0.5">
            {{ asset?.category?.name || label('未分类', 'Uncategorized') }}
          </p>
        </div>
      </div>
    </template>

    <!-- Inline header for share view -->
    <div v-if="inline && asset" class="premium-card-header flex items-center justify-between mb-5 pb-3 border-b border-[var(--border-base)] text-left">
      <div class="flex items-center gap-3">
        <Box class="h-5 w-5 text-indigo-400" />
        <div>
          <h3 class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)] flex items-center gap-2">
            <span>{{ asset.title }}</span>
            <span
              v-if="!asset.isFree"
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30"
            >
              会员专享下载
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
            >
              免费下载
            </span>
          </h3>
          <p class="text-xs text-[var(--text-muted)] mt-0.5">
            {{ asset.category?.name || label('未分类', 'Uncategorized') }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 gap-3 text-[var(--text-secondary)]">
      <RefreshCw class="h-8 w-8 animate-spin text-teal-400" />
      <span class="text-xs font-semibold tracking-wider uppercase">{{ label('正在载入三维档案...', 'Loading 3D asset...') }}</span>
    </div>

    <div v-else-if="asset" class="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <!-- Left Column: 3D model viewer and Telemetry stats -->
      <div class="xl:col-span-7 flex flex-col gap-4">
        <!-- 3D Preview area -->
        <div class="relative w-full aspect-video sm:h-[400px] rounded-xl overflow-hidden border border-white/10 bg-slate-950/40 flex items-center justify-center group">
          <ModelViewer
            v-if="isModelAsset && asset.url"
            ref="modelViewerRef"
            :model-url="getAssetUrl(asset.url)"
            :auto-rotate="autoRotate"
            :show-controls="true"
            :asset-id="asset.id"
            :scene-config="{
              environment: currentEnvironment,
              exposure: exposure,
              bgColor: currentBgColor,
              showGrid: showGrid,
              showAxes: showAxes,
            }"
            :default-camera-pos="asset.defaultCameraPos"
            :default-camera-target="asset.defaultCameraTarget"
            class="w-full h-full viewer-canvas"
            @screenshot-captured="handleScreenshotCaptured"
          />

          <!-- Sketchfab-style Floating Toolbar at the bottom -->
          <div v-if="isModelAsset" class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 border border-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <!-- View Mode Dropdown -->
            <el-tooltip :content="label('渲染/着色模式', 'Rendering Mode')" placement="top">
              <el-dropdown trigger="click" @command="handleViewModeChange">
                <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer">
                  <Layers class="h-4 w-4" />
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="solid" :class="{ 'text-indigo-400 font-bold': currentViewMode === 'solid' && !isClayMode }">
                      {{ label('着色模式 (Solid)', 'Shaded') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="wireframe" :class="{ 'text-indigo-400 font-bold': currentViewMode === 'wireframe' }">
                      {{ label('网格线模式 (Wireframe)', 'Wireframe') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="solid+wireframe" :class="{ 'text-indigo-400 font-bold': currentViewMode === 'solid+wireframe' }">
                      {{ label('着色+网格线', 'Shaded + Wireframe') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-tooltip>

            <!-- Clay mode toggle -->
            <el-tooltip :content="label('白模模式 (Clay)', 'Clay Mode')" placement="top">
              <button
                class="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
                :class="isClayMode ? 'bg-indigo-500 text-white' : 'hover:bg-white/10 text-white/80 hover:text-white'"
                @click="toggleClay"
              >
                <Box class="h-4 w-4" />
              </button>
            </el-tooltip>

            <div class="w-[1px] h-4 bg-white/10"></div>

            <!-- Environment Selection -->
            <el-tooltip :content="label('环境与光照', 'Environment Map')" placement="top">
              <el-dropdown trigger="click" @command="changeEnvironment">
                <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer">
                  <Globe class="h-4 w-4" />
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="studio" :class="{ 'text-indigo-400 font-bold': currentEnvironment === 'studio' }">
                      {{ label('写字楼影棚 (Studio)', 'Studio') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="sunset" :class="{ 'text-indigo-400 font-bold': currentEnvironment === 'sunset' }">
                      {{ label('威尼斯日落 (Sunset)', 'Venice Sunset') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="forest" :class="{ 'text-indigo-400 font-bold': currentEnvironment === 'forest' }">
                      {{ label('户外森林 (Forest)', 'Forest') }}
                    </el-dropdown-item>
                    <el-dropdown-item command="room" :class="{ 'text-indigo-400 font-bold': currentEnvironment === 'room' }">
                      {{ label('采石场室内 (Room)', 'Room') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-tooltip>

            <div class="w-[1px] h-4 bg-white/10"></div>

            <!-- Preset Camera Angles -->
            <el-tooltip :content="label('预设视角', 'Camera Presets')" placement="top">
              <el-dropdown trigger="click" @command="applyCameraPreset">
                <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer">
                  <RefreshCw class="h-4 w-4" />
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="iso">{{ label('等轴视角 (ISO)', 'Isometry') }}</el-dropdown-item>
                    <el-dropdown-item command="front">{{ label('正前视角 (Front)', 'Front') }}</el-dropdown-item>
                    <el-dropdown-item command="side">{{ label('侧面视角 (Side)', 'Side') }}</el-dropdown-item>
                    <el-dropdown-item command="top">{{ label('俯视视角 (Top)', 'Top') }}</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-tooltip>

            <!-- Auto-Rotate -->
            <el-tooltip :content="label('自动旋转', 'Auto Rotate')" placement="top">
              <button
                class="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
                :class="autoRotate ? 'bg-indigo-500 text-white' : 'hover:bg-white/10 text-white/80 hover:text-white'"
                @click="toggleAutoRotate"
              >
                <RefreshCw class="h-4 w-4 animate-spin-slow" :class="{ 'animate-none': !autoRotate }" />
              </button>
            </el-tooltip>

            <div class="w-[1px] h-4 bg-white/10"></div>

            <!-- Ground helpers & Background setting dropdown -->
            <el-tooltip :content="label('视图与场景设置', 'Scene Settings')" placement="top">
              <el-dropdown trigger="click" :hide-on-click="false">
                <button class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer">
                  <Settings class="h-4 w-4" />
                </button>
                <template #dropdown>
                  <div class="p-4 w-60 bg-slate-900 border border-white/10 rounded-lg text-white/90 flex flex-col gap-3 text-xs text-left shadow-2xl">
                    <h4 class="font-bold text-indigo-400 mb-1 border-b border-white/10 pb-1.5 flex items-center gap-1.5">
                      <Settings class="h-3.5 w-3.5" />
                      {{ label('三维场景设置', '3D Scene Settings') }}
                    </h4>
                    
                    <!-- Ground Grid Switch -->
                    <div class="flex items-center justify-between">
                      <span class="text-slate-300 font-semibold">{{ label('显示地面网格', 'Ground Grid') }}</span>
                      <el-switch v-model="showGrid" size="small" />
                    </div>

                    <!-- Axes Helper Switch -->
                    <div class="flex items-center justify-between">
                      <span class="text-slate-300 font-semibold">{{ label('显示世界坐标轴', 'Coordinate Axes') }}</span>
                      <el-switch v-model="showAxes" size="small" />
                    </div>

                    <div class="h-[1px] bg-white/10"></div>

                    <!-- Background Color Select -->
                    <div class="flex flex-col gap-1.5">
                      <span class="text-slate-300 font-semibold">{{ label('背景色彩', 'Background Color') }}</span>
                      <div class="flex gap-2">
                        <button 
                          v-for="color in bgColors" 
                          :key="color.value"
                          class="w-6 h-6 rounded-full border transition-all cursor-pointer"
                          :style="{ backgroundColor: color.value, borderColor: currentBgColor === color.value ? '#6366f1' : 'transparent' }"
                          :title="color.label"
                          @click="currentBgColor = color.value"
                        ></button>
                      </div>
                    </div>

                    <div class="h-[1px] bg-white/10"></div>

                    <!-- Exposure/Brightness Slider -->
                    <div class="flex flex-col gap-1.5">
                      <div class="flex justify-between items-center text-slate-300">
                        <span class="font-semibold">{{ label('场景亮度', 'Brightness') }}</span>
                        <span class="text-[10px] font-mono">{{ exposure.toFixed(1) }}x</span>
                      </div>
                      <el-slider 
                        v-model="exposure" 
                        :min="0.2" 
                        :max="2.5" 
                        :step="0.1" 
                        size="small" 
                        class="custom-slider"
                      />
                    </div>
                  </div>
                </template>
              </el-dropdown>
            </el-tooltip>

            <div class="w-[1px] h-4 bg-white/10"></div>

            <!-- Fullscreen -->
            <el-tooltip :content="label('全屏预览', 'Fullscreen')" placement="top">
              <button
                class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                @click="triggerFullscreen"
              >
                <Maximize2 class="h-4 w-4" />
              </button>
            </el-tooltip>
          </div>
          <div v-else-if="asset.thumbnail || asset.thumbnailUrl" class="w-full h-full relative">
            <img
              :src="getAssetUrl(asset.thumbnail || asset.thumbnailUrl)"
              class="w-full h-full object-cover filter blur-md opacity-25 absolute inset-0 scale-105"
              alt="Background blur"
            />
            <img
              :src="getAssetUrl(asset.thumbnail || asset.thumbnailUrl)"
              class="w-full h-full object-contain relative z-10"
              alt="Asset Cover"
            />
          </div>
          <div v-else class="text-center text-[var(--text-muted)] text-sm flex flex-col items-center gap-2">
            <ImageIcon class="h-10 w-10 text-white/20" />
            <span>{{ label('暂无三维模型预览', 'No 3D Model Preview Available') }}</span>
          </div>

          <!-- Float Badge -->
          <div class="absolute top-3 left-3 z-20 flex gap-2">
            <span
              v-if="asset.status === 'APPROVED'"
              class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
            >
              {{ label('已发布', 'Approved') }}
            </span>
            <span
              v-else-if="asset.status === 'PENDING'"
              class="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold"
            >
              {{ label('审核中', 'Pending') }}
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-semibold"
            >
              {{ label('未通过', 'Rejected') }}
            </span>
          </div>
        </div>

        <!-- Inline Discussions Section -->
        <div class="flex flex-col gap-4 pt-4 border-t border-white/10 text-left mt-6">
          <h3 class="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-l-2 border-indigo-500 pl-2">
            <span>{{ label('用户讨论与反馈', 'Discussions & Feedback') }}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-[var(--text-muted)] font-mono">{{ comments.length }}</span>
          </h3>

          <!-- Post Comment Form -->
          <div v-if="authStore.user" class="flex flex-col gap-2 bg-white/[0.01] border border-white/5 rounded-2xl p-4">
            <textarea
              v-model="newCommentContent"
              :placeholder="label('发表您的想法和建议...', 'Post your thoughts and suggestions...')"
              class="w-full min-h-[80px] bg-white/[0.03] dark:bg-black/[0.1] border border-[var(--border-base)] rounded-xl p-3 text-xs text-[var(--text-primary)] focus:border-indigo-500 outline-none resize-none placeholder-[var(--text-muted)]"
            ></textarea>
            <div class="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                :disabled="isSubmittingComment || !newCommentContent.trim()"
                @click="handlePostComment"
              >
                <span class="text-xs">{{ isSubmittingComment ? label('发表中...', 'Posting...') : label('发表评论', 'Post Comment') }}</span>
              </Button>
            </div>
          </div>
          <div v-else class="text-center py-4 bg-white/[0.02] dark:bg-black/[0.05] rounded-xl border border-dashed border-[var(--border-base)]">
            <p class="text-xs text-[var(--text-muted)]">{{ label('登录平台后即可发表评论', 'Login to post comments') }}</p>
          </div>

          <!-- Comments List -->
          <div v-if="isCommentsLoading" class="flex justify-center py-6">
            <RefreshCw class="w-6 h-6 animate-spin text-indigo-400" />
          </div>
          <div v-else-if="comments.length === 0" class="text-center py-6 text-[var(--text-muted)] text-xs bg-white/[0.01] border border-dashed border-white/5 rounded-2xl font-semibold">
            {{ label('暂无评论，快来抢沙发吧！', 'No comments yet. Be the first to comment!') }}
          </div>
          <div v-else class="space-y-4 max-h-[300px] overflow-y-auto pr-1.5 custom-scrollbar">
            <div v-for="c in comments" :key="c.id" class="flex gap-3 pb-3 border-b border-[var(--border-base)]/50 last:border-0 last:pb-0">
              <div class="h-8 w-8 rounded-full overflow-hidden border border-[var(--border-base)] bg-[var(--bg-card)] flex items-center justify-center shrink-0">
                <img v-if="c.user?.avatarUrl" :src="getAssetUrl(c.user.avatarUrl)" class="h-full w-full object-cover" />
                <span v-else class="text-xs font-bold uppercase text-[var(--text-secondary)]">{{ c.user?.name?.slice(0, 1) || 'U' }}</span>
              </div>
              <div class="flex-1 flex flex-col gap-1 min-w-0">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-bold text-[var(--text-primary)] truncate">{{ c.user?.name || '用户' }}</span>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] text-[var(--text-muted)]">{{ new Date(c.createdAt).toLocaleString() }}</span>
                    <button
                      v-if="canDeleteComment(c)"
                      class="text-[10px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer border-0 bg-transparent"
                      @click="handleDeleteComment(c.id)"
                    >
                      {{ label('删除', 'Delete') }}
                    </button>
                  </div>
                </div>
                <p class="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-words">
                  {{ c.content }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Info pane -->
      <div
        class="xl:col-span-5 flex flex-col gap-4"
        :class="inline ? '' : 'overflow-y-auto max-h-[75vh] pr-1.5 custom-scrollbar'"
      >
        <!-- Author Profile Card -->
        <div v-if="asset.user" class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5 text-left shrink-0">
          <div class="h-9 w-9 rounded-full overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center text-sm shrink-0">
            <img v-if="asset.user.avatarUrl" :src="getAssetUrl(asset.user.avatarUrl)" class="h-full w-full object-cover" />
            <span v-else class="font-semibold uppercase text-xs text-[var(--text-secondary)]">{{ asset.user.name?.slice(0, 1) || 'A' }}</span>
          </div>
          <div class="text-left min-w-0">
            <div class="text-xs font-bold text-[var(--text-primary)] truncate">{{ asset.user.name }}</div>
            <div class="text-[10px] text-[var(--text-muted)] mt-1 font-medium uppercase tracking-wider">{{ label('上传作者', 'Author') }}</div>
          </div>
        </div>

        <!-- Download Options Box -->
        <div class="bg-white/[0.02] border border-white/10 rounded-2xl p-4 flex flex-col gap-4 text-left shrink-0">
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{{ label('下载选项', 'Download Options') }}</span>
            <div>
              <span
                v-if="asset.status === 'APPROVED'"
                class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
              >
                {{ label('已发布', 'Approved') }}
              </span>
              <span
                v-else-if="asset.status === 'PENDING'"
                class="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold"
              >
                {{ label('审核中', 'Pending') }}
              </span>
              <span
                v-else
                class="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-semibold"
              >
                {{ label('未通过', 'Rejected') }}
              </span>
            </div>
          </div>

          <!-- Download Buttons vertically stacked -->
          <div class="flex flex-col gap-2.5">
            <!-- Source File Package (.zip) -->
            <Button
              v-if="asset.packageUrl"
              variant="primary"
              size="md"
              :disabled="isDownloading"
              class="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)] transition-all duration-300"
              @click="handleDownload(true)"
            >
              <Lock v-if="!canDownload" class="h-4.5 w-4.5 text-amber-300" />
              <FolderOpen v-else-if="!isDownloading" class="h-4.5 w-4.5 animate-bounce-slow text-white" />
              <span>
                {{ label('下载源文件包 (.zip)', 'Download Source (.zip)') }}
                <span v-if="!canDownload" class="text-[10px] text-amber-300 font-bold ml-1">(VIP)</span>
              </span>
            </Button>

            <!-- Preview Model (.glb) -->
            <Button
              v-if="asset.url"
              variant="secondary"
              size="md"
              :disabled="isDownloading"
              class="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold transition-all duration-300"
              @click="handleDownload(false)"
            >
              <Lock v-if="!canDownload" class="h-4.5 w-4.5 text-amber-500/80" />
              <Download v-else-if="!isDownloading" class="h-4.5 w-4.5 text-slate-300" />
              <span>
                {{ label('下载预览模型 (.glb)', 'Download Preview (.glb)') }}
                <span v-if="!canDownload" class="text-[10px] text-amber-500/80 font-bold ml-1">(VIP)</span>
              </span>
            </Button>
          </div>

          <!-- Quick Statistics -->
          <div class="grid grid-cols-3 gap-2 mt-1 pt-3 border-t border-white/5">
            <div class="flex flex-col gap-0.5">
              <span class="text-[10px] text-[var(--text-muted)]">{{ label('浏览次数', 'Views') }}</span>
              <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                <Eye class="h-3 w-3 text-blue-400" />
                {{ asset.viewCount || 0 }}
              </span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[10px] text-[var(--text-muted)]">{{ label('下载次数', 'Downloads') }}</span>
              <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                <Download class="h-3 w-3 text-teal-400" />
                {{ downloadCount }}
              </span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="text-[10px] text-[var(--text-muted)]">{{ label('收藏人数', 'Favorites') }}</span>
              <span class="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1">
                <Heart class="h-3 w-3 text-rose-400 fill-rose-400/20" />
                {{ likeCount }}
              </span>
            </div>
          </div>
        </div>

        <!-- Control Action Buttons -->
        <div class="flex flex-col gap-2 p-3 bg-white/[0.01] border border-white/5 rounded-2xl text-left shrink-0">
          <span class="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold px-1 mb-1">{{ label('管理与操作', 'Actions') }}</span>
          <div class="grid grid-cols-2 gap-2">
            <Button
              v-if="isOwner || isAdmin"
              variant="secondary"
              size="sm"
              class="flex items-center justify-center gap-1.5 hover:bg-emerald-500/10 hover:text-emerald-400 w-full"
              @click="handleEdit"
            >
              <Edit3 class="h-3.5 w-3.5 text-emerald-400" />
              <span>{{ label('编辑', 'Edit') }}</span>
            </Button>

            <Button
              v-if="isOwner || isAdmin"
              variant="secondary"
              size="sm"
              class="flex items-center justify-center gap-1.5 hover:bg-rose-500/10 hover:text-rose-400 w-full"
              @click="handleDelete"
            >
              <Trash2 class="h-3.5 w-3.5 text-rose-400" />
              <span>{{ label('删除', 'Delete') }}</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              class="flex items-center justify-center gap-1.5 w-full"
              :class="{ 'text-rose-400 bg-rose-500/5': isLiked }"
              @click="handleLike"
            >
              <Heart :class="['h-3.5 w-3.5', isLiked ? 'text-rose-500 fill-rose-500' : 'text-slate-400']" />
              <span>{{ isLiked ? label('已收藏', 'Saved') : label('收藏', 'Save') }}</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              class="flex items-center justify-center gap-1.5 w-full"
              @click="handleShare"
            >
              <Share2 class="h-3.5 w-3.5 text-indigo-400" />
              <span>{{ label('分享', 'Share') }}</span>
            </Button>
          </div>
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1.5 text-left">
          <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{{ label('说明', 'Description') }}</h4>
          <p class="text-xs text-[var(--text-secondary)] leading-relaxed bg-white/[0.01] border border-white/5 rounded-xl p-3">
            {{ asset.description || label('作者很懒，什么都没有写。', 'No description provided.') }}
          </p>
        </div>

        <!-- ZIP File Explorer (async-loaded) -->
        <div v-if="isPackageFilesLoading || packageFiles.length > 0" class="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02] text-left my-2 shrink-0">
          <div 
            class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02] cursor-pointer select-none hover:bg-white/[0.04] transition-colors"
            @click="isFilesCollapsed = !isFilesCollapsed"
          >
            <FileArchive class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              {{ label('源文件压缩包包含', 'Package Contents') }}
              <span v-if="!isPackageFilesLoading">({{ packageFiles.length }})</span>
            </span>
            <RefreshCw v-if="isPackageFilesLoading" class="h-3 w-3 text-amber-400 animate-spin ml-auto shrink-0" />
            <component 
              :is="isFilesCollapsed ? ChevronRight : ChevronDown" 
              v-else 
              class="h-4 w-4 text-[var(--text-muted)] ml-auto shrink-0 transition-transform duration-200" 
            />
          </div>
          <!-- Loading state -->
          <div v-if="isPackageFilesLoading && !isFilesCollapsed" class="p-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{{ label('正在读取压缩包目录...', 'Reading package contents...') }}</span>
          </div>
          <!-- File tree -->
          <div v-else-if="!isFilesCollapsed" class="p-3 flex flex-col gap-1 max-h-[180px] overflow-y-auto custom-scrollbar text-xs text-[var(--text-secondary)] font-mono">
            <div 
              v-for="node in parsedFileTree" 
              :key="node.path" 
              class="flex items-center gap-1.5 py-1 hover:bg-[var(--bg-hover)] px-2 rounded transition-colors"
              :style="{ paddingLeft: (node.level * 14 + 6) + 'px' }"
            >
              <!-- Folder Icon -->
              <FolderOpen v-if="node.isFolder" class="h-3.5 w-3.5 text-amber-500 dark:text-amber-400/80 shrink-0" />
              <!-- File Icons -->
              <template v-else>
                <!-- Blender Logo SVG -->
                <svg v-if="node.name.toLowerCase().endsWith('.blend')" class="h-3.5 w-3.5 shrink-0" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M66.332 70.032c.24-4.242 2.327-7.987 5.485-10.634 3.094-2.602 7.248-4.193 11.809-4.193 4.537 0 8.69 1.59 11.78 4.193 3.163 2.647 5.237 6.392 5.485 10.634.24 4.35-1.523 8.41-4.605 11.417-3.158 3.05-7.627 4.977-12.66 4.977-5.037 0-9.526-1.915-12.664-4.977-3.094-3.006-4.853-7.044-4.606-11.397zm0 0" fill="#235785"/>
                  <path d="M39.245 79.002c.028 1.66.564 4.89 1.36 7.404 1.682 5.336 4.537 10.273 8.49 14.599 4.062 4.465 9.074 8.055 14.85 10.61 6.073 2.67 12.665 4.037 19.505 4.037 6.84-.009 13.432-1.4 19.504-4.102 5.776-2.582 10.79-6.168 14.85-10.657 3.974-4.374 6.82-9.307 8.491-14.647a37 37 0 001.595-8.163c.208-2.69.12-5.405-.263-8.12a37.535 37.535 0 00-5.417-14.714c-2.574-4.15-5.916-7.76-9.89-10.813l.012-.004-39.955-30.506c-.036-.028-.068-.056-.104-.08-2.619-2.002-7.044-1.994-9.91.008-2.914 2.031-3.25 5.385-.656 7.496l-.012.008 16.682 13.484-50.789.051h-.068c-4.197.004-8.239 2.739-9.03 6.213-.82 3.521 2.035 6.46 6.412 6.46l-.008.016 25.736-.048L4.58 82.524c-.056.044-.12.088-.176.132C.069 85.95-1.33 91.446 1.4 94.9c2.778 3.522 8.666 3.546 13.047.02L39.505 74.51s-.368 2.758-.336 4.397zm64.56 9.219c-5.168 5.228-12.416 8.21-20.227 8.21-7.831.012-15.079-2.918-20.248-8.142-2.526-2.559-4.377-5.473-5.528-8.591a22.202 22.202 0 01-1.271-9.602 22.446 22.446 0 012.778-9.039c1.507-2.714 3.59-5.18 6.14-7.267 5.033-4.058 11.42-6.28 18.1-6.28 6.709-.008 13.097 2.174 18.13 6.236 2.55 2.075 4.625 4.529 6.14 7.243a22.302 22.302 0 012.774 9.043 22.302 22.302 0 01-1.271 9.598c-1.147 3.142-3.002 6.056-5.533 8.615zm0 0" fill="#e87500"/>
                </svg>
                <!-- 3D Formats -->
                <Box v-else-if="node.name.toLowerCase().endsWith('.glb') || node.name.toLowerCase().endsWith('.gltf') || node.name.toLowerCase().endsWith('.fbx') || node.name.toLowerCase().endsWith('.obj')" class="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                <!-- Images -->
                <ImageIcon v-else-if="node.name.toLowerCase().endsWith('.png') || node.name.toLowerCase().endsWith('.jpg') || node.name.toLowerCase().endsWith('.jpeg') || node.name.toLowerCase().endsWith('.tga') || node.name.toLowerCase().endsWith('.hdr')" class="h-3.5 w-3.5 text-teal-500 shrink-0" />
                <!-- Archives -->
                <FileArchive v-else-if="node.name.toLowerCase().endsWith('.zip') || node.name.toLowerCase().endsWith('.rar') || node.name.toLowerCase().endsWith('.7z')" class="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <!-- Generic / Doc -->
                <FileText v-else class="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </template>
              
              <span class="truncate min-w-0" :class="{ 'text-indigo-600 dark:text-indigo-300 font-semibold': !node.isFolder && (node.name.toLowerCase().endsWith('.glb') || node.name.toLowerCase().endsWith('.gltf') || node.name.toLowerCase().endsWith('.fbx') || node.name.toLowerCase().endsWith('.obj') || node.name.toLowerCase().endsWith('.blend')) }">
                {{ node.name }}
              </span>
            </div>
          </div>
        </div>

        <!-- Telemetry Stats Grid (2x2 Grid) -->
        <div class="grid grid-cols-2 gap-2 text-xs">
          <!-- File size -->
          <div class="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-1 text-left">
            <span class="text-[10px] text-[var(--text-muted)] uppercase font-medium">{{ label('文件大小', 'File Size') }}</span>
            <span class="font-bold text-[var(--text-primary)]">{{ formatFileSize(asset.size) }}</span>
          </div>
          <!-- Vertices -->
          <div class="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-1 text-left">
            <span class="text-[10px] text-[var(--text-muted)] uppercase font-medium">{{ label('顶点数', 'Vertices') }}</span>
            <span class="font-bold text-[var(--text-primary)]">{{ asset.vertices?.toLocaleString() || '-' }}</span>
          </div>
          <!-- Faces -->
          <div class="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-1 text-left">
            <span class="text-[10px] text-[var(--text-muted)] uppercase font-medium">{{ label('三角面', 'Faces') }}</span>
            <span class="font-bold text-[var(--text-primary)]">{{ asset.faces?.toLocaleString() || '-' }}</span>
          </div>
          <!-- Materials -->
          <div class="p-3 bg-white/[0.01] border border-white/5 rounded-xl flex flex-col gap-1 text-left">
            <span class="text-[10px] text-[var(--text-muted)] uppercase font-medium">{{ label('材质球', 'Materials') }}</span>
            <span class="font-bold text-[var(--text-primary)]">{{ asset.materials?.toLocaleString() || '-' }}</span>
          </div>
        </div>

        <!-- Compact Specifications & Copyright side-by-side -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- Copyright Info -->
          <div class="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02]">
            <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
              <Shield class="h-3.5 w-3.5 text-indigo-400" />
              <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                {{ label('版权与许可协议', 'Copyright & Licensing') }}
              </span>
            </div>
            <div class="p-3 flex flex-col gap-2 text-xs text-left">
              <div class="flex justify-between">
                <span class="text-[var(--text-muted)]">{{ label('原创属性', 'Originality') }}</span>
                <span class="font-semibold text-[var(--text-secondary)]">{{ originalityLabel }}</span>
              </div>
              <div class="flex justify-between" v-if="asset.license">
                <span class="text-[var(--text-muted)]">{{ label('授权协议', 'License') }}</span>
                <span class="font-semibold text-teal-400 uppercase text-[10px]">{{ asset.license.replace('_', ' ') }}</span>
              </div>
              <div v-if="asset.originality !== 'ORIGINAL' && asset.originalAuthor" class="flex justify-between">
                <span class="text-[var(--text-muted)]">{{ label('原作者', 'Original Author') }}</span>
                <span class="font-semibold text-[var(--text-secondary)] truncate max-w-[80px]" :title="asset.originalAuthor">{{ asset.originalAuthor }}</span>
              </div>
              <div v-if="asset.originality !== 'ORIGINAL' && asset.originalLink" class="flex justify-between items-center">
                <span class="text-[var(--text-muted)]">{{ label('原作链接', 'Original Link') }}</span>
                <a :href="asset.originalLink" target="_blank" class="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
                  {{ label('查看', 'Link') }}
                  <ExternalLink class="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <!-- 3D Specifications -->
          <div class="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01] dark:bg-white/[0.02]">
            <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
              <Settings class="h-3.5 w-3.5 text-teal-400" />
              <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                {{ label('技术参数与规格', 'Technical Specifications') }}
              </span>
            </div>
            <div class="p-3 flex flex-col gap-2 text-xs text-left">
              <div class="flex justify-between">
                <span class="text-[var(--text-muted)]">{{ label('多边形网格', 'Mesh Type') }}</span>
                <span class="font-semibold text-[var(--text-secondary)] truncate max-w-[90px]" :title="meshTypeLabel">{{ meshTypeLabel }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-muted)]">{{ label('已展 UV', 'UV Unwrapped') }}</span>
                <span class="font-semibold text-[var(--text-secondary)]">
                  {{ asset.uvUnwrapped ? label('是', 'Yes') : label('否', 'No') }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-muted)]">{{ label('UV 重叠', 'Overlapping') }}</span>
                <span class="font-semibold text-[var(--text-secondary)]">
                  {{ asset.uvOverlapping ? label('是', 'Yes') : label('否', 'No') }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-muted)]">{{ label('骨骼绑定', 'Rigged') }}</span>
                <span class="font-semibold text-[var(--text-secondary)]">
                  {{ asset.rigged ? label('是', 'Yes') : label('否', 'No') }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-[var(--text-muted)]">{{ label('游戏就绪', 'Game Ready') }}</span>
                <span class="font-semibold text-[var(--text-secondary)]">
                  {{ asset.gameReady ? label('是', 'Yes') : label('否', 'No') }}
                </span>
              </div>
            </div>
          </div>
        </div>



        <!-- Tag badges -->
        <div v-if="parsedTags.length > 0" class="flex flex-col gap-1.5 text-left">
          <h4 class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{{ label('标签', 'Tags') }}</h4>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="tag in parsedTags"
              :key="tag"
              class="px-2 py-0.5 rounded-md text-xs bg-white/[0.04] text-[var(--text-secondary)] border border-white/5 font-medium"
            >
              {{ tag }}
            </span>
          </div>
        </div>

      </div>
    </div>

  </component>

  <ShareDialog ref="shareDialogRef" type="asset" />

  <!-- Downloading Progress Dialog Overlay -->
  <Teleport to="body">
    <div
      v-if="isDownloading"
      class="fixed bottom-6 right-6 z-[99999] w-[340px] p-5 rounded-2xl shadow-2xl border glass-panel backdrop-blur-xl flex flex-col gap-4 overflow-hidden"
      style="border-color: var(--border-base); background-color: var(--bg-card)"
    >
      <!-- Background glow -->
      <div class="absolute -top-12 -right-12 w-24 h-24 bg-accent/20 rounded-full blur-xl pointer-events-none"></div>

      <div class="flex items-center justify-between">
        <span
          class="text-sm font-bold flex items-center gap-2"
          style="color: var(--text-primary)"
        >
          <Loader2 class="w-4 h-4 animate-spin text-accent" />
          {{ label('正在安全下载资源...', 'Downloading resource safely...') }}
        </span>
        <button
          type="button"
          class="p-1 hover:bg-white/5 rounded-lg text-[var(--text-muted)] hover:text-rose-500 transition-all cursor-pointer flex items-center justify-center shrink-0"
          title="取消下载 / Cancel download"
          @click="cancelDownload"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex justify-between items-center text-xs font-mono text-[var(--text-secondary)]">
          <span v-if="downloadSpeedStr" class="font-medium text-emerald-400">{{ downloadSpeedStr }}</span>
          <span v-else class="text-[var(--text-muted)]">{{ label('正在建立连接...', 'Connecting...') }}</span>
          <span class="font-black text-accent">{{ downloadProgress }}%</span>
        </div>
        
        <!-- Progress Bar -->
        <div class="w-full bg-slate-100 dark:bg-slate-800/50 rounded-full h-2 overflow-hidden border border-white/5">
          <div
            class="bg-accent h-2 rounded-full transition-all duration-300 shadow-[0_0_8px_var(--color-accent)]"
            :style="{ width: `${downloadProgress}%` }"
          ></div>
        </div>
      </div>

      <div class="text-[10px] text-[var(--text-muted)] leading-relaxed text-center">
        {{ label('采用多线程并发下载算法以获取最高网速。', 'Multi-threaded chunked downloader is active for maximum speed.') }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.viewer-canvas :deep(.absolute.right-4.top-4) {
  display: none !important;
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.animate-spin-slow {
  animation: spin-slow 8s linear infinite;
}
</style>
