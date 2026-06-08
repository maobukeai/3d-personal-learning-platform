<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Box,
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cuboid,
  Download,
  ExternalLink,
  Eye,
  Grid2X2,
  History,
  Image as ImageIcon,
  Info,
  Layers3,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  MousePointer2,
  Move3D,
  PackageCheck,
  Plus,
  RefreshCw,
  Ruler,
  Settings,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
  UploadCloud,
  User,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';
import type { Asset } from '@/types';

type ViewMode = 'solid' | 'wireframe';
type PanelId = 'overview' | 'preview' | 'textures' | 'usage' | 'versions' | 'comments';

type ModelViewerExpose = {
  setViewMode?: (mode: ViewMode) => void;
  toggleClayMode?: () => void;
  isClayMode?: boolean;
  resetCamera?: () => void;
  takeScreenshot?: (download?: boolean) => string | null;
  getCameraState?: () => {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null;
  flyTo?: (
    position: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number },
  ) => void;
};

type ModelStats = {
  vertices?: number;
  faces?: number;
  materials?: number;
  animations?: number;
  dimensions?: string;
  maxTextureRes?: number;
};

type AssetDetail = Asset & {
  formats?: string[] | string | null;
  maxTextureRes?: number | null;
};

type AssetVersion = {
  id: string;
  version: string;
  url: string;
  size: number;
  vertices: number | null;
  faces: number | null;
  materials: number | null;
  dimensions: string | null;
  maxTextureRes: number | null;
  changeLog: string | null;
  createdAt: string;
  user?: { name: string; avatarUrl: string | null };
};

type AssetAnnotation = {
  id: string;
  content: string;
  x: number;
  y: number;
  z: number;
  cameraPos: string | null;
  cameraTarget: string | null;
  createdAt: string;
  userId: string;
  user?: { name: string; avatarUrl: string | null };
};

const ModelViewer = defineAsyncComponent(() => import('@/components/ModelViewer.vue'));

const route = useRoute();
const router = useRouter();
const assetId = route.params.id as string;

const asset = ref<AssetDetail | null>(null);
const isLoading = ref(true);
const modelViewerRef = ref<ModelViewerExpose | null>(null);
const modelStats = ref<ModelStats | null>(null);
const currentUserId = ref('');
const activePanel = ref<PanelId>('overview');
const versions = ref<AssetVersion[]>([]);
const annotations = ref<AssetAnnotation[]>([]);
const isAddingAnnotation = ref(false);
const annotationCoords = ref<{ x: number; y: number; z: number } | null>(null);
const newAnnotationText = ref('');
const newVersionFile = ref<File | null>(null);
const newVersionChangeLog = ref('');
const isUploadingVersion = ref(false);
const selectedPreview = ref('model');
const isClayMode = ref(false);

const viewerConfig = ref({
  autoRotate: false,
  viewMode: 'solid' as ViewMode,
  environment: 'studio',
  exposure: 1,
});

const modelTypes = ['GLB', 'GLTF', 'FBX', 'OBJ', 'STL'];

const fetchAsset = async () => {
  try {
    const response = await api.get(`/api/assets/${assetId}`);
    asset.value = response.data;
    if (asset.value) {
      modelStats.value = {
        vertices: asset.value.vertices || 0,
        faces: asset.value.faces || 0,
        materials: asset.value.materials || 0,
        animations: asset.value.animations || 0,
        dimensions: asset.value.dimensions || '',
        maxTextureRes: asset.value.maxTextureRes || 0,
      };
    }
  } catch {
    ElMessage.error('资产详情加载失败');
    router.replace('/assets');
  } finally {
    isLoading.value = false;
  }
};

const fetchVersions = async () => {
  try {
    const response = await api.get(`/api/assets/${assetId}/versions`);
    versions.value = response.data || [];
  } catch (error) {
    console.error('Failed to fetch versions:', error);
  }
};

const fetchAnnotations = async () => {
  try {
    const response = await api.get(`/api/assets/${assetId}/annotations`);
    annotations.value = response.data || [];
  } catch (error) {
    console.error('Failed to fetch annotations:', error);
  }
};

const fetchCurrentUser = async () => {
  try {
    const response = await api.get('/api/auth/me');
    currentUserId.value = response.data?.id || response.data?.user?.id || '';
  } catch (error) {
    console.error('Failed to fetch current user:', error);
  }
};

onMounted(() => {
  fetchAsset();
  fetchVersions();
  fetchAnnotations();
  fetchCurrentUser();
});

const isModelAsset = computed(() => !!asset.value && modelTypes.includes(asset.value.type));
const displayFormat = computed(() => (asset.value?.type || 'GLB').toUpperCase());
const assetSize = computed(() => {
  if (asset.value?.type === 'LINK') return '外部资源';
  return asset.value?.size ? `${asset.value.size} MB` : '未知大小';
});
const viewCount = computed(() => asset.value?.viewCount ?? 0);
const favoriteCount = computed(() => asset.value?.likes ?? 0);
const downloadCount = computed(() => asset.value?.downloads ?? 0);

const parsedFormats = computed<string[]>(() => {
  const formats = asset.value?.formats;
  if (!formats) return asset.value?.type ? [asset.value.type] : [];
  if (Array.isArray(formats)) return formats;
  try {
    const parsed = JSON.parse(formats);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return [formats];
  }
});

const reviewStatus = computed(() => {
  const status = asset.value?.status;
  if (status === 'APPROVED') return { label: '已通过', tone: 'success' };
  if (status === 'REJECTED') return { label: '已拒绝', tone: 'danger' };
  return { label: '待审核', tone: 'warning' };
});

const viewerHotspots = computed(() =>
  annotations.value.map((annotation) => {
    let cameraPos;
    let cameraTarget;
    try {
      cameraPos = annotation.cameraPos ? JSON.parse(annotation.cameraPos) : undefined;
      cameraTarget = annotation.cameraTarget ? JSON.parse(annotation.cameraTarget) : undefined;
    } catch {
      cameraPos = undefined;
      cameraTarget = undefined;
    }
    return {
      x: annotation.x,
      y: annotation.y,
      z: annotation.z,
      title: annotation.user?.name || '团队成员',
      content: annotation.content,
      cameraPos,
      cameraTarget,
    };
  }),
);

const modelInfoRows = computed(() => [
  { label: '尺寸（cm）', value: modelStats.value?.dimensions || '未解析', icon: Ruler },
  { label: '多边形', value: formatNumber(modelStats.value?.faces), icon: Grid2X2 },
  { label: '材质', value: formatNumber(modelStats.value?.materials), icon: Layers3 },
  { label: '贴图分辨率', value: modelStats.value?.maxTextureRes ? `${modelStats.value.maxTextureRes}px` : '未解析', icon: ImageIcon },
  { label: '动画', value: `${formatNumber(modelStats.value?.animations)} 段`, icon: RefreshCw },
  { label: '绑定', value: asset.value?.hasAnimations ? '有' : '无', icon: Move3D },
]);

const fileInfo = computed(() => [
  { label: '格式', value: displayFormat.value },
  { label: '文件大小', value: assetSize.value },
  { label: '版本', value: versions.value[0]?.version || 'v1' },
  { label: '审核状态', value: reviewStatus.value.label },
]);

const panels = computed(() => [
  { id: 'overview', label: '资源概览', desc: '资源基础信息与展示', icon: Cuboid },
  { id: 'preview', label: '预览图', desc: '多视角缩略图', icon: ImageIcon },
  { id: 'textures', label: '贴图通道', desc: 'BaseColor / Normal 等', icon: Layers3 },
  { id: 'usage', label: '使用说明', desc: '使用建议与注意事项', icon: Info },
  { id: 'versions', label: '版本历史', desc: `${versions.value.length || 1} 个历史版本`, icon: History },
  { id: 'comments', label: `评论 (${annotations.value.length})`, desc: '用户交流与反馈', icon: MessageSquare },
] as const);

const previewItems = computed(() => [
  { id: 'model', label: '模型', url: asset.value?.thumbnail || getDefaultThumbnailUrl(displayFormat.value) },
  { id: 'clay', label: '白模', url: getDefaultThumbnailUrl('STL') },
  { id: 'wire', label: '线框', url: getDefaultThumbnailUrl('OBJ') },
  { id: 'normal', label: '法线', url: getDefaultThumbnailUrl('GLTF') },
]);

const tags = computed(() => [
  asset.value?.category?.name || '未分类',
  asset.value?.title?.includes('PBR') ? 'PBR' : '模型',
  displayFormat.value,
  ...(parsedFormats.value.length > 1 ? parsedFormats.value.slice(0, 2) : []),
]);

const formatNumber = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '未解析';
  return value.toLocaleString('zh-CN');
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '未知';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const goBack = () => {
  router.back();
};

const handleDownload = async () => {
  if (!asset.value?.url) return;
  try {
    const response = await api.post(`/api/assets/${assetId}/download`);
    if (asset.value) {
      asset.value.downloads = response.data.downloads;
    }
  } catch (error) {
    console.error('Failed to record download:', error);
  }
  window.open(asset.value.url, '_blank', 'noopener,noreferrer');
};

const handleShare = async () => {
  const shareUrl = window.location.href;
  try {
    await navigator.clipboard.writeText(shareUrl);
    ElMessage.success('链接已复制');
  } catch {
    ElMessage.info(shareUrl);
  }
};

const handleFavorite = async () => {
  try {
    const response = await api.post(`/api/assets/${assetId}/like`);
    if (asset.value) {
      asset.value.likes = response.data.likes;
    }
    ElMessage.success('已加入收藏夹');
  } catch (_error) {
    ElMessage.error('收藏失败');
  }
};

const openInBlender = () => {
  if (!asset.value?.url) return;
  ElMessage.info('\u5df2\u4e3a Blender \u6253\u5f00\u4fdd\u7559\u5165\u53e3\uff0c\u8bf7\u5728\u672c\u5730\u63d2\u4ef6\u4e2d\u63a5\u5165\u8be5\u8d44\u6e90\u94fe\u63a5');
};
const handleMetadataLoaded = (stats: ModelStats) => {
  modelStats.value = {
    ...modelStats.value,
    ...stats,
    maxTextureRes: stats.maxTextureRes || modelStats.value?.maxTextureRes || 0,
  };
};

const handleScreenshotCaptured = async (dataUrl: string) => {
  if (!asset.value || asset.value.thumbnail) return;
  try {
    const response = await api.patch(`/api/assets/${assetId}/thumbnail`, { thumbnail: dataUrl });
    asset.value.thumbnail = response.data.thumbnail;
  } catch (error) {
    console.warn('Failed to upload generated thumbnail:', error);
  }
};

const resetCamera = () => {
  modelViewerRef.value?.resetCamera?.();
};

const takeScreenshot = () => {
  const result = modelViewerRef.value?.takeScreenshot?.(true);
  if (!result) ElMessage.info('当前资源暂不支持截图');
};

const toggleViewMode = () => {
  const nextMode = viewerConfig.value.viewMode === 'solid' ? 'wireframe' : 'solid';
  viewerConfig.value.viewMode = nextMode;
  modelViewerRef.value?.setViewMode?.(nextMode);
};

const toggleClayMode = () => {
  modelViewerRef.value?.toggleClayMode?.();
  isClayMode.value = !!modelViewerRef.value?.isClayMode;
};

const handleHotspotAdded = (coords: { x: number; y: number; z: number }) => {
  isAddingAnnotation.value = true;
  annotationCoords.value = coords;
  newAnnotationText.value = '';
};

const saveAnnotation = async () => {
  if (!annotationCoords.value || !newAnnotationText.value.trim()) {
    ElMessage.warning('请先在模型上选择位置并填写内容');
    return;
  }

  const cameraState = modelViewerRef.value?.getCameraState?.();
  try {
    const response = await api.post(`/api/assets/${assetId}/annotations`, {
      content: newAnnotationText.value.trim(),
      x: annotationCoords.value.x,
      y: annotationCoords.value.y,
      z: annotationCoords.value.z,
      cameraPos: cameraState?.position || null,
      cameraTarget: cameraState?.target || null,
    });
    annotations.value.unshift(response.data);
    isAddingAnnotation.value = false;
    annotationCoords.value = null;
    newAnnotationText.value = '';
    ElMessage.success('评论已保存');
  } catch {
    ElMessage.error('评论保存失败');
  }
};

const deleteAnnotation = async (annotationId: string) => {
  try {
    await api.delete(`/api/assets/${assetId}/annotations/${annotationId}`);
    annotations.value = annotations.value.filter((item) => item.id !== annotationId);
    ElMessage.success('评论已删除');
  } catch {
    ElMessage.error('评论删除失败');
  }
};

const clickAnnotation = (annotation: AssetAnnotation) => {
  if (!modelViewerRef.value?.flyTo || !annotation.cameraPos || !annotation.cameraTarget) return;
  try {
    modelViewerRef.value.flyTo(JSON.parse(annotation.cameraPos), JSON.parse(annotation.cameraTarget));
  } catch (error) {
    console.error('Failed to parse annotation camera state:', error);
  }
};

const handleVersionFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  newVersionFile.value = input.files?.[0] || null;
};

const uploadNewVersion = async () => {
  if (!newVersionFile.value) {
    ElMessage.warning('请选择新版本模型文件');
    return;
  }

  isUploadingVersion.value = true;
  const formData = new FormData();
  formData.append('asset', newVersionFile.value);
  formData.append('changeLog', newVersionChangeLog.value);

  try {
    const response = await api.post(`/api/assets/${assetId}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    versions.value.unshift(response.data);
    newVersionFile.value = null;
    newVersionChangeLog.value = '';
    const input = document.getElementById('version-file-input') as HTMLInputElement | null;
    if (input) input.value = '';
    ElMessage.success('新版本已上传，后台正在解析模型数据');
    setTimeout(fetchAsset, 1500);
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '版本上传失败');
  } finally {
    isUploadingVersion.value = false;
  }
};
</script>

<template>
  <div class="asset-detail-page">
    <main class="detail-main">
      <button type="button" class="back-link" @click="goBack">
        <ChevronLeft class="h-4 w-4" />
        返回资源库
      </button>

      <header class="detail-header">
        <div class="title-block">
          <div class="title-row">
            <h1>{{ asset?.title || '模型详情' }}</h1>
            <span class="review-pill" :data-tone="reviewStatus.tone">{{ reviewStatus.label }}</span>
          </div>
          <div class="meta-row">
            <span class="tag-pill">3D模型</span>
            <span><User class="h-4 w-4" />{{ asset?.user?.name || '未知用户' }}</span>
            <span><ShieldCheck class="h-4 w-4" />{{ asset?.user?.role === 'ADMIN' ? '系统管理员' : '创作者' }}</span>
            <span><Calendar class="h-4 w-4" />{{ formatDate(asset?.createdAt) }}</span>
            <span><Eye class="h-4 w-4" />{{ viewCount }}</span>
          </div>
        </div>

        <div class="header-actions">
          <button type="button" class="soft-button" @click="handleFavorite">
            <Star class="h-4 w-4" />
            收藏 {{ favoriteCount }}
          </button>
          <button type="button" class="soft-button" @click="handleShare">
            <Share2 class="h-4 w-4" />
            分享
          </button>
          <button type="button" class="icon-button" @click="ElMessage.info('更多操作入口已保留')">
            <MoreHorizontal class="h-4 w-4" />
          </button>
        </div>
      </header>

      <section class="viewer-shell">
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <span>正在加载资产...</span>
        </div>

        <div class="top-viewer-tools">
          <button type="button" title="实体模式" :class="{ active: viewerConfig.viewMode === 'solid' && !isClayMode }" @click="viewerConfig.viewMode = 'solid'; modelViewerRef?.setViewMode?.('solid')">
            <Box class="h-4 w-4" />
          </button>
          <button type="button" title="线框模式" :class="{ active: viewerConfig.viewMode === 'wireframe' }" @click="toggleViewMode">
            <Grid2X2 class="h-4 w-4" />
          </button>
          <button type="button" title="白模模式" :class="{ active: isClayMode }" @click="toggleClayMode">
            <Settings class="h-4 w-4" />
          </button>
          <button type="button" title="全屏" @click="modelViewerRef?.takeScreenshot?.(false) || ElMessage.info('全屏可使用预览器右上角控件')">
            <Maximize2 class="h-4 w-4" />
          </button>
        </div>

        <button type="button" class="viewer-arrow left">
          <ChevronLeft class="h-5 w-5" />
        </button>
        <button type="button" class="viewer-arrow right">
          <ChevronRight class="h-5 w-5" />
        </button>

        <div class="axis-widget">
          <span class="axis-y">Y</span>
          <span class="axis-z">Z</span>
          <Cuboid class="h-8 w-8" />
          <span class="axis-x">X</span>
        </div>

        <ModelViewer
          v-if="asset && isModelAsset"
          ref="modelViewerRef"
          :model-url="asset.url"
          :auto-rotate="viewerConfig.autoRotate"
          :scene-config="{ environment: viewerConfig.environment, exposure: viewerConfig.exposure }"
          :hotspots="viewerHotspots"
          :editable="activePanel === 'comments'"
          class="viewer-canvas"
          @metadata-loaded="handleMetadataLoaded"
          @screenshot-captured="handleScreenshotCaptured"
          @hotspot-added="handleHotspotAdded"
        />
        <div v-else-if="asset" class="static-preview">
          <img :src="asset.thumbnail || getDefaultThumbnailUrl(displayFormat)" :alt="asset.title" />
          <a :href="asset.url" target="_blank" rel="noopener noreferrer">
            <ExternalLink class="h-4 w-4" />
            打开资源
          </a>
        </div>

        <div class="bottom-viewer-tools">
          <button type="button" title="重置视角" @click="resetCamera">
            <RefreshCw class="h-4 w-4" />
          </button>
          <button type="button" title="拖拽浏览">
            <MousePointer2 class="h-4 w-4" />
          </button>
          <button type="button" title="放大查看">
            <Maximize2 class="h-4 w-4" />
          </button>
          <button type="button" title="自动旋转" :class="{ active: viewerConfig.autoRotate }" @click="viewerConfig.autoRotate = !viewerConfig.autoRotate">
            <RefreshCw class="h-4 w-4" />
          </button>
          <button type="button" title="设置">
            <Settings class="h-4 w-4" />
          </button>
          <button type="button" title="布局">
            <Grid2X2 class="h-4 w-4" />
          </button>
          <select v-model="viewerConfig.environment">
            <option value="studio">高清</option>
            <option value="sunset">日落</option>
            <option value="forest">森林</option>
            <option value="room">室内</option>
          </select>
          <button type="button" title="截图" @click="takeScreenshot">
            <Camera class="h-4 w-4" />
          </button>
        </div>

        <div class="preview-strip">
          <button
            v-for="item in previewItems"
            :key="item.id"
            type="button"
            :class="{ active: selectedPreview === item.id }"
            @click="selectedPreview = item.id"
          >
            <img :src="item.url" :alt="item.label" />
          </button>
          <button type="button" class="more-preview">+{{ Math.max(1, parsedFormats.length + versions.length) }}</button>
        </div>
      </section>

      <nav class="panel-grid">
        <button
          v-for="panel in panels"
          :key="panel.id"
          type="button"
          :class="{ active: activePanel === panel.id }"
          @click="activePanel = panel.id"
        >
          <span><component :is="panel.icon" class="h-5 w-5" /></span>
          <strong>{{ panel.label }}</strong>
          <small>{{ panel.desc }}</small>
        </button>
      </nav>

      <section class="panel-content">
        <div v-if="activePanel === 'overview'" class="overview-panel">
          <h2>资源概览</h2>
          <p>{{ asset?.description || '该资源暂未填写说明。' }}</p>
          <div class="overview-stats">
            <span>分类：{{ asset?.category?.name || '未分类' }}</span>
            <span>作者：{{ asset?.user?.name || '未知用户' }}</span>
            <span>格式：{{ parsedFormats.join(' / ') || displayFormat }}</span>
          </div>
        </div>

        <div v-if="activePanel === 'preview'" class="preview-panel">
          <article v-for="item in previewItems" :key="item.id">
            <img :src="item.url" :alt="item.label" />
            <strong>{{ item.label }}</strong>
          </article>
        </div>

        <div v-if="activePanel === 'textures'" class="texture-panel">
          <article v-for="name in ['BaseColor', 'Normal', 'Roughness', 'Metallic']" :key="name">
            <Layers3 class="h-5 w-5" />
            <strong>{{ name }}</strong>
            <span>{{ modelStats?.maxTextureRes ? `${modelStats.maxTextureRes}px` : '等待模型解析' }}</span>
          </article>
        </div>

        <div v-if="activePanel === 'usage'" class="usage-panel">
          <h2>使用说明</h2>
          <p>下载后可在 Blender、Three.js 或支持 {{ displayFormat }} 的 3D 工具中使用。若资源包含贴图，请保持原始目录结构。</p>
          <p>团队协作时可在“评论”页签中点击模型表面添加空间评论，系统会记录模型坐标和当前相机视角。</p>
        </div>

        <div v-if="activePanel === 'versions'" class="versions-panel">
          <div class="version-upload">
            <input id="version-file-input" type="file" accept=".glb,.gltf,.fbx,.obj,.stl" @change="handleVersionFileChange" />
            <textarea v-model="newVersionChangeLog" rows="2" placeholder="记录本次修改内容"></textarea>
            <button type="button" :disabled="isUploadingVersion" @click="uploadNewVersion">
              <UploadCloud class="h-4 w-4" />
              {{ isUploadingVersion ? '上传中...' : '发布新版本' }}
            </button>
          </div>
          <article v-for="version in versions" :key="version.id" class="version-card">
            <strong>{{ version.version }}</strong>
            <span>{{ formatDate(version.createdAt) }}</span>
            <p>{{ version.changeLog || '初始版本提交' }}</p>
          </article>
          <div v-if="versions.length === 0" class="empty-panel">暂无版本记录</div>
        </div>

        <div v-if="activePanel === 'comments'" class="comments-panel">
          <div class="comment-tip">
            <MessageSquare class="h-5 w-5" />
            <span>点击模型表面可添加空间评论，评论会绑定当前视角。</span>
          </div>
          <div v-if="isAddingAnnotation && annotationCoords" class="comment-editor">
            <span>X {{ annotationCoords.x.toFixed(2) }} · Y {{ annotationCoords.y.toFixed(2) }} · Z {{ annotationCoords.z.toFixed(2) }}</span>
            <textarea v-model="newAnnotationText" rows="3" placeholder="输入评论内容"></textarea>
            <button type="button" @click="saveAnnotation">
              <Plus class="h-4 w-4" />
              保存评论
            </button>
          </div>
          <article v-for="annotation in annotations" :key="annotation.id" class="comment-card" @click="clickAnnotation(annotation)">
            <div>
              <strong>{{ annotation.user?.name || '团队成员' }}</strong>
              <span>{{ formatDate(annotation.createdAt) }}</span>
            </div>
            <p>{{ annotation.content }}</p>
            <button
              v-if="annotation.userId === currentUserId || asset?.userId === currentUserId"
              type="button"
              @click.stop="deleteAnnotation(annotation.id)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </article>
          <div v-if="annotations.length === 0" class="empty-panel">暂无评论</div>
        </div>
      </section>
    </main>

    <aside class="detail-aside">
      <section class="side-card summary-card">
        <h2>概览</h2>
        <div class="summary-grid">
          <div><Eye class="h-4 w-4" /><strong>{{ viewCount }}</strong><span>浏览</span></div>
          <div><Star class="h-4 w-4" /><strong>{{ favoriteCount }}</strong><span>收藏</span></div>
          <div><Download class="h-4 w-4" /><strong>{{ downloadCount }}</strong><span>下载</span></div>
          <div><MessageSquare class="h-4 w-4" /><strong>{{ annotations.length }}</strong><span>评论</span></div>
        </div>
      </section>

      <section class="side-card">
        <h2>文件信息</h2>
        <div class="file-grid">
          <div v-for="item in fileInfo" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </section>

      <section class="side-card">
        <h2>模型信息</h2>
        <div class="model-rows">
          <div v-for="item in modelInfoRows" :key="item.label">
            <span><component :is="item.icon" class="h-4 w-4" />{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </section>

      <section class="side-card tags-card">
        <h2>标签</h2>
        <div>
          <span v-for="tag in tags" :key="tag">{{ tag }}</span>
          <button type="button"><Plus class="h-3.5 w-3.5" /></button>
        </div>
      </section>

      <button type="button" class="download-button" @click="handleDownload">
        <Download class="h-4 w-4" />
        下载资源
      </button>
      <button type="button" class="blender-button" @click="openInBlender">
        <PackageCheck class="h-4 w-4" />
        在 Blender 中打开
        <ChevronDown class="h-4 w-4" />
      </button>
    </aside>
  </div>
</template>

<style scoped>
.asset-detail-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 22px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 20px;
  background: #fbfcff;
  color: #17213a;
}

.detail-main,
.detail-aside {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}

.back-link,
.meta-row,
.meta-row span,
.header-actions,
.soft-button,
.icon-button,
.top-viewer-tools,
.bottom-viewer-tools,
.panel-grid button,
.model-rows div,
.download-button,
.blender-button {
  display: flex;
  align-items: center;
}

.back-link {
  gap: 6px;
  border: 0;
  background: transparent;
  color: #73809c;
  padding: 0;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  margin: 18px 0 14px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-row h1 {
  margin: 0;
  color: #111b34;
  font-size: 26px;
  line-height: 1.2;
}

.review-pill,
.tag-pill {
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 900;
}

.review-pill[data-tone='success'] { color: #11a36a; background: #e8fbf1; }
.review-pill[data-tone='warning'] { color: #d17a00; background: #fff4dd; }
.review-pill[data-tone='danger'] { color: #dc2626; background: #fee2e2; }
.tag-pill { color: #6757ff; background: #f0efff; }

.meta-row {
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 12px;
  color: #68758f;
  font-size: 13px;
}

.meta-row span {
  gap: 6px;
}

.header-actions {
  gap: 8px;
  justify-content: flex-end;
}

.soft-button,
.icon-button {
  gap: 7px;
  height: 36px;
  border: 1px solid #e5eaf5;
  border-radius: 8px;
  background: #fff;
  color: #40506e;
  padding: 0 13px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.icon-button {
  width: 36px;
  justify-content: center;
  padding: 0;
}

.viewer-shell {
  position: relative;
  height: min(54vh, 560px);
  min-height: 420px;
  overflow: hidden;
  border-radius: 8px;
  background: radial-gradient(circle at center, #f4f6fb 0%, #eef2f8 58%, #e9edf5 100%);
}

.viewer-canvas {
  width: 100%;
  height: 100%;
}

.loading-state,
.static-preview {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: #65718b;
}

.spinner {
  width: 34px;
  height: 34px;
  border: 4px solid #dde4f2;
  border-top-color: #6757ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.static-preview img {
  max-width: 70%;
  max-height: 70%;
  object-fit: contain;
}

.static-preview a {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6757ff;
  font-weight: 900;
}

.top-viewer-tools,
.bottom-viewer-tools {
  position: absolute;
  z-index: 12;
  gap: 8px;
  border: 1px solid #e7ecf5;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  padding: 8px;
  backdrop-filter: blur(14px);
  box-shadow: 0 10px 28px rgba(31, 42, 68, 0.08);
}

.top-viewer-tools {
  left: 20px;
  top: 20px;
}

.bottom-viewer-tools {
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
}

.top-viewer-tools button,
.bottom-viewer-tools button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #53617c;
  cursor: pointer;
}

.top-viewer-tools button.active,
.bottom-viewer-tools button.active {
  background: #f0efff;
  color: #6757ff;
}

.bottom-viewer-tools select {
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: #f7f8fc;
  color: #40506e;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 900;
  outline: 0;
}

.viewer-arrow {
  position: absolute;
  z-index: 12;
  top: 50%;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #53617c;
  transform: translateY(-50%);
  cursor: pointer;
}

.viewer-arrow.left { left: 22px; }
.viewer-arrow.right { right: 22px; }

.axis-widget {
  position: absolute;
  z-index: 12;
  right: 30px;
  top: 36px;
  display: grid;
  place-items: center;
  color: #9aa6ba;
  font-size: 11px;
  font-weight: 900;
}

.axis-y { color: #20c76d; }
.axis-z { color: #3b82f6; transform: translate(-22px, 16px); }
.axis-x { color: #f05252; transform: translate(24px, -16px); }

.preview-strip {
  position: absolute;
  z-index: 13;
  right: 20px;
  bottom: 18px;
  display: flex;
  gap: 9px;
  border: 1px solid #e7ecf5;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  padding: 8px;
  backdrop-filter: blur(14px);
}

.preview-strip button {
  width: 48px;
  height: 48px;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 7px;
  background: #f1f4fa;
  color: #68758f;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.preview-strip button.active {
  border-color: #6757ff;
}

.preview-strip img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.more-preview {
  display: grid;
  place-items: center;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-top: 20px;
  border: 1px solid #e6ebf5;
  border-radius: 8px;
  background: #fff;
  padding: 14px;
}

.panel-grid button {
  min-width: 0;
  gap: 12px;
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #fff;
  padding: 14px 12px;
  text-align: left;
  cursor: pointer;
}

.panel-grid button.active {
  border-color: #bfb7ff;
  background: #fbfaff;
}

.panel-grid button span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #f0efff;
  color: #6757ff;
}

.panel-grid strong,
.panel-grid small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-grid strong {
  color: #192640;
  font-size: 13px;
}

.panel-grid small {
  margin-top: 3px;
  color: #78849b;
  font-size: 11px;
}

.panel-content {
  margin-top: 14px;
  border: 1px solid #e6ebf5;
  border-radius: 8px;
  background: #fff;
  padding: 18px;
}

.overview-panel h2,
.usage-panel h2 {
  margin: 0 0 8px;
  color: #192640;
  font-size: 16px;
}

.overview-panel p,
.usage-panel p {
  color: #65718b;
  font-size: 13px;
  line-height: 1.8;
}

.overview-stats,
.preview-panel,
.texture-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.overview-stats span,
.texture-panel article,
.version-card,
.comment-card,
.comment-tip,
.comment-editor,
.version-upload {
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #f8faff;
  padding: 12px;
}

.preview-panel {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.preview-panel article {
  overflow: hidden;
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #f8faff;
}

.preview-panel img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.preview-panel strong {
  display: block;
  padding: 10px;
  font-size: 13px;
}

.texture-panel article {
  display: grid;
  gap: 6px;
  color: #65718b;
}

.texture-panel strong {
  color: #192640;
}

.version-upload,
.comment-editor {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
}

.version-upload input,
.version-upload textarea,
.comment-editor textarea {
  width: 100%;
  border: 1px solid #e2e8f2;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
  outline: 0;
  resize: vertical;
}

.version-upload button,
.comment-editor button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: #6757ff;
  color: #fff;
  font-weight: 900;
  cursor: pointer;
}

.version-card,
.comment-card {
  position: relative;
  margin-top: 10px;
}

.version-card strong,
.comment-card strong {
  color: #192640;
}

.version-card span,
.comment-card span,
.comment-editor span {
  display: block;
  margin-top: 4px;
  color: #7b879d;
  font-size: 12px;
}

.version-card p,
.comment-card p {
  color: #65718b;
  font-size: 13px;
  line-height: 1.7;
}

.comment-card {
  cursor: pointer;
}

.comment-card button {
  position: absolute;
  right: 10px;
  top: 10px;
  border: 0;
  background: transparent;
  color: #ef4444;
  cursor: pointer;
}

.comment-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #6757ff;
  background: #fbfaff;
}

.empty-panel {
  display: grid;
  place-items: center;
  min-height: 120px;
  color: #7b879d;
  font-size: 13px;
}

.detail-aside {
  display: grid;
  align-content: start;
  gap: 12px;
}

.side-card {
  border: 1px solid #e6ebf5;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
}

.side-card h2 {
  margin: 0 0 14px;
  color: #17213a;
  font-size: 15px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.summary-grid div {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 72px;
  border-right: 1px solid #edf1f7;
}

.summary-grid div:last-child {
  border-right: 0;
}

.summary-grid svg:nth-child(1) {
  color: #6757ff;
}

.summary-grid strong {
  color: #17213a;
  font-size: 18px;
}

.summary-grid span {
  color: #78849b;
  font-size: 11px;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.file-grid div {
  min-height: 64px;
  border-radius: 8px;
  background: #f8faff;
  padding: 12px;
}

.file-grid span,
.model-rows span {
  color: #65718b;
  font-size: 12px;
}

.file-grid strong {
  display: block;
  margin-top: 7px;
  color: #17213a;
  font-size: 13px;
}

.model-rows {
  display: grid;
  gap: 10px;
}

.model-rows div {
  justify-content: space-between;
  gap: 12px;
}

.model-rows span {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #6757ff;
}

.model-rows strong {
  color: #17213a;
  font-size: 12px;
  text-align: right;
}

.tags-card div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tags-card span,
.tags-card button {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  border: 0;
  border-radius: 7px;
  background: #f3f5fa;
  color: #4d5b74;
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
}

.tags-card button {
  width: 28px;
  justify-content: center;
  padding: 0;
  cursor: pointer;
}

.download-button,
.blender-button {
  justify-content: center;
  gap: 8px;
  height: 42px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.download-button {
  border: 0;
  background: #6757ff;
  color: #fff;
}

.blender-button {
  border: 1px solid #e6ebf5;
  background: #fff;
  color: #17213a;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1180px) {
  .asset-detail-page {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .detail-aside {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .asset-detail-page {
    padding: 12px;
  }

  .detail-header {
    flex-direction: column;
  }

  .viewer-shell {
    height: 440px;
  }

  .bottom-viewer-tools {
    left: 12px;
    right: 12px;
    justify-content: center;
    transform: none;
  }

  .preview-strip {
    display: none;
  }

  .panel-grid,
  .detail-aside,
  .overview-stats,
  .preview-panel,
  .texture-panel {
    grid-template-columns: 1fr;
  }
}
</style>



