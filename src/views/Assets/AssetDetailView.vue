<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Box,
  Camera,
  ChevronLeft,
  Cuboid,
  ExternalLink,
  Gauge,
  GitCompare,
  Grid2X2,
  History,
  Image as ImageIcon,
  Info,
  Layers3,
  Maximize2,
  MessageSquare,
  Move3D,
  RefreshCw,
  Ruler,
  Settings,
  Wand2,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';
import UiButton from '@/components/ui/Button.vue';
import AssetDetailHeader from './components/AssetDetailHeader.vue';
import AssetMetadataPanel from './components/AssetMetadataPanel.vue';
import AssetDetailActions from './components/AssetDetailActions.vue';
import AssetPerformancePanel from './components/AssetPerformancePanel.vue';
import AssetVersionsPanel from './components/AssetVersionsPanel.vue';
import AssetPreviewGallery from './components/AssetPreviewGallery.vue';
import AssetCommentsPanel from './components/AssetCommentsPanel.vue';
import type {
  AssetAnnotation,
  AssetDetail,
  AssetVersion,
  CameraPresetKey,
  ModelStats,
  ModelViewerExpose,
  PanelId,
  PerformanceReport,
  PerformanceTone,
  ViewMode,
} from './components/types';

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
const canAnnotate = ref(false);
const performanceReport = ref<PerformanceReport | null>(null);
const isAddingAnnotation = ref(false);
const annotationCoords = ref<{ x: number; y: number; z: number } | null>(null);
const newAnnotationText = ref('');
const newVersionFile = ref<File | null>(null);
const newVersionChangeLog = ref('');
const isUploadingVersion = ref(false);
const isSavingCover = ref(false);
const isClayMode = ref(false);
const compareBaseId = ref('current');
const compareTargetId = ref('');
let fetchTimer: ReturnType<typeof setTimeout> | null = null;

const viewerConfig = ref({
  autoRotate: false,
  viewMode: 'solid' as ViewMode,
  environment: 'studio',
  exposure: 1,
});

const modelTypes = ['GLB', 'GLTF', 'FBX', 'OBJ', 'STL'];

const fetchAsset = async () => {
  try {
    const response = await api.get(`/api/assets/${assetId}/toolkit`);
    const payload = response.data || {};
    asset.value = payload.asset;
    versions.value = payload.versions || [];
    canAnnotate.value = !!payload.canAnnotate;
    performanceReport.value = payload.asset?.performanceReport || null;
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
    if (!compareTargetId.value && versions.value.length > 0) {
      compareTargetId.value = versions.value[0].id;
    }
  } catch {
    ElMessage.error('资产详情加载失败');
    router.replace('/assets');
  } finally {
    isLoading.value = false;
  }
};

const fetchAnnotations = async () => {
  try {
    const response = await api.get(`/api/assets/${assetId}/annotations`);
    annotations.value = response.data || [];
  } catch (error) {
    logError(error, { operation: 'asset.fetchAnnotations', component: 'AssetDetailView' });
  }
};

const fetchCurrentUser = async () => {
  try {
    const response = await api.get('/api/auth/me');
    currentUserId.value = response.data?.id || response.data?.user?.id || '';
  } catch (error) {
    logError(error, { operation: 'asset.fetchCurrentUser', component: 'AssetDetailView' });
  }
};

onMounted(() => {
  fetchAsset();
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
  if (status === 'APPROVED') return { label: '已通过', tone: 'success' as const };
  if (status === 'REJECTED') return { label: '已拒绝', tone: 'danger' as const };
  return { label: '待审核', tone: 'warning' as const };
});

const buildLocalPerformanceReport = (): PerformanceReport => {
  const faces = modelStats.value?.faces || 0;
  const vertices = modelStats.value?.vertices || 0;
  const materials = modelStats.value?.materials || 0;
  const size = asset.value?.size || 0;
  const maxTextureRes = modelStats.value?.maxTextureRes || 0;
  const risks: PerformanceReport['risks'] = [];

  const riskTone = (
    value: number,
    notice: number,
    warning: number,
    danger: number,
  ): PerformanceTone => {
    if (value > danger) return 'danger';
    if (value > warning) return 'warning';
    if (value > notice) return 'notice';
    return 'pass';
  };

  risks.push({
    metric: 'faces',
    label: '面数',
    value: faces,
    unit: 'faces',
    tone: riskTone(faces, 60000, 120000, 250000),
    message: faces > 120000 ? '面数偏高，实时预览压力较大' : '面数处于可控范围',
    recommendation: '高面数模型建议拆分 LOD，并准备移动端轻量版本。',
  });
  risks.push({
    metric: 'texture',
    label: '最大贴图',
    value: maxTextureRes,
    unit: 'px',
    tone: riskTone(maxTextureRes, 1024, 2048, 4096),
    message: maxTextureRes > 2048 ? '贴图分辨率偏高，移动端显存风险增加' : '贴图尺寸适合网页预览',
    recommendation: '网页封面与移动端预览建议压缩到 1K/2K 分档。',
  });
  risks.push({
    metric: 'size',
    label: '文件体积',
    value: size,
    unit: 'MB',
    tone: riskTone(size, 60, 120, 250),
    message: size > 120 ? '文件体积偏大，下载与首屏加载较慢' : '文件体积处于可分发范围',
    recommendation: '启用 Draco/Meshopt 压缩，并清理未使用贴图。',
  });

  const penalties: Record<PerformanceTone, number> = {
    pass: 0,
    notice: 8,
    warning: 18,
    danger: 30,
  };
  const score = Math.max(0, 100 - risks.reduce((total, risk) => total + penalties[risk.tone], 0));
  const level = risks.some((risk) => risk.tone === 'danger')
    ? 'danger'
    : risks.some((risk) => risk.tone === 'warning')
      ? 'warning'
      : risks.some((risk) => risk.tone === 'notice')
        ? 'notice'
        : 'pass';

  return {
    score,
    level,
    mobileRisk:
      level === 'danger'
        ? 'high'
        : level === 'warning'
          ? 'medium'
          : level === 'notice'
            ? 'low'
            : 'safe',
    summary: level === 'pass' ? '适合网页和移动端预览' : '存在可优化项，建议发布前处理',
    metrics: {
      faces,
      vertices,
      materials,
      size,
      maxTextureRes,
      animations: modelStats.value?.animations || 0,
      hasAnimations: !!asset.value?.hasAnimations,
      dimensions: modelStats.value?.dimensions || '',
    },
    risks,
  };
};

const activePerformanceReport = computed(
  () => performanceReport.value || asset.value?.performanceReport || buildLocalPerformanceReport(),
);

const performanceToneLabel = computed(() => {
  const tone = activePerformanceReport.value.level;
  if (tone === 'danger') return '高风险';
  if (tone === 'warning') return '需优化';
  if (tone === 'notice') return '可改进';
  return '健康';
});

const mobileRiskLabel = computed(() => {
  const risk = activePerformanceReport.value.mobileRisk;
  if (risk === 'high') return '移动端高风险';
  if (risk === 'medium') return '移动端需优化';
  if (risk === 'low') return '移动端轻微风险';
  return '移动端安全';
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
  {
    label: '贴图分辨率',
    value: modelStats.value?.maxTextureRes ? `${modelStats.value.maxTextureRes}px` : '未解析',
    icon: ImageIcon,
  },
  { label: '动画', value: `${formatNumber(modelStats.value?.animations)} 段`, icon: RefreshCw },
  { label: '绑定', value: asset.value?.hasAnimations ? '有' : '无', icon: Move3D },
]);

const fileInfo = computed(() => [
  { label: '格式', value: displayFormat.value },
  { label: '文件大小', value: assetSize.value },
  { label: '版本', value: versions.value[0]?.version || 'v1' },
  { label: '审核状态', value: reviewStatus.value.label },
]);

const panels = computed(
  () =>
    [
      { id: 'overview', label: '模型档案', desc: '资产说明与发布信息', icon: Cuboid },
      { id: 'preview', label: '视图快照', desc: '封面 / 白模 / 线框', icon: ImageIcon },
      { id: 'textures', label: '材质贴图', desc: 'PBR 通道与贴图规模', icon: Layers3 },
      { id: 'usage', label: '制作说明', desc: '软件链路与使用建议', icon: Info },
      {
        id: 'versions',
        label: '版本库',
        desc: `${versions.value.length || 1} 个历史版本`,
        icon: History,
      },
      { id: 'compare', label: '拓扑对比', desc: '版本指标差异', icon: GitCompare },
      { id: 'performance', label: '实时体检', desc: performanceToneLabel.value, icon: Gauge },
      {
        id: 'comments',
        label: `空间批注 (${annotations.value.length})`,
        desc: '坐标评论与反馈',
        icon: MessageSquare,
      },
    ] as const,
);

const viewerTelemetry = computed(() => [
  { label: '面数', value: formatNumber(modelStats.value?.faces) },
  { label: '材质', value: formatNumber(modelStats.value?.materials) },
  { label: '动画', value: `${formatNumber(modelStats.value?.animations)} 段` },
  {
    label: '贴图',
    value: modelStats.value?.maxTextureRes ? `${modelStats.value.maxTextureRes}px` : '未解析',
  },
]);

const cameraPresets: Array<{ key: CameraPresetKey; label: string; value: string }> = [
  { key: 'iso', label: '等轴', value: 'ISO' },
  { key: 'front', label: '正视', value: 'FRONT' },
  { key: 'side', label: '侧视', value: 'SIDE' },
  { key: 'top', label: '俯视', value: 'TOP' },
];

const previewItems = computed(() => [
  {
    id: 'model',
    label: '模型',
    url: asset.value?.thumbnail || getDefaultThumbnailUrl(displayFormat.value),
  },
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

const compareSources = computed(() => [
  {
    id: 'current',
    label: `当前版本（${versions.value[0]?.version || 'v1'}）`,
    source: {
      size: asset.value?.size || 0,
      faces: modelStats.value?.faces || 0,
      vertices: modelStats.value?.vertices || 0,
      materials: modelStats.value?.materials || 0,
      maxTextureRes: modelStats.value?.maxTextureRes || 0,
      dimensions: modelStats.value?.dimensions || '',
      createdAt: asset.value?.updatedAt,
      changeLog: '当前线上可下载版本',
      reviewStatus: reviewStatus.value.label,
    },
  },
  ...versions.value.map((version) => ({
    id: version.id,
    label: `${version.version}（${formatDate(version.createdAt)}）`,
    source: {
      size: version.size || 0,
      faces: version.faces || 0,
      vertices: version.vertices || 0,
      materials: version.materials || 0,
      maxTextureRes: version.maxTextureRes || 0,
      dimensions: version.dimensions || '',
      createdAt: version.createdAt,
      changeLog: version.changeLog || '未填写修改记录',
      reviewStatus: reviewStatus.value.label,
    },
  })),
]);

const selectedBaseSource = computed(
  () =>
    compareSources.value.find((item) => item.id === compareBaseId.value) || compareSources.value[0],
);
const selectedTargetSource = computed(
  () =>
    compareSources.value.find((item) => item.id === compareTargetId.value) ||
    compareSources.value.find((item) => item.id !== compareBaseId.value) ||
    compareSources.value[0],
);

const compareRows = computed(() => {
  const base = selectedBaseSource.value?.source;
  const target = selectedTargetSource.value?.source;
  if (!base || !target) return [];

  const rows = [
    { key: 'faces', label: '面数', unit: '' },
    { key: 'vertices', label: '顶点', unit: '' },
    { key: 'materials', label: '材质', unit: '' },
    { key: 'maxTextureRes', label: '最大贴图', unit: 'px' },
    { key: 'size', label: '文件体积', unit: 'MB' },
  ] as const;

  return rows.map((row) => {
    const baseValue = Number(base[row.key] || 0);
    const targetValue = Number(target[row.key] || 0);
    const delta = Number((baseValue - targetValue).toFixed(2));
    return {
      ...row,
      baseValue,
      targetValue,
      delta,
      improved:
        row.key === 'size' ||
        row.key === 'faces' ||
        row.key === 'vertices' ||
        row.key === 'maxTextureRes'
          ? delta < 0
          : delta <= 0,
    };
  });
});

const formatNumber = (value?: number | null) => {
  if (value === undefined || value === null || Number.isNaN(value)) return '未解析';
  return value.toLocaleString('zh-CN');
};

const formatMetricValue = (value: number, unit = '') => {
  if (unit === 'MB') return `${value.toFixed(2)} MB`;
  if (unit === 'px') return `${formatNumber(value)} px`;
  if (!unit) return formatNumber(value);
  return `${formatNumber(value)} ${unit}`;
};

const formatDelta = (value: number, unit = '') => {
  const sign = value > 0 ? '+' : '';
  if (unit === 'MB') return `${sign}${value.toFixed(2)} MB`;
  if (unit === 'px') return `${sign}${formatNumber(value)} px`;
  return `${sign}${formatNumber(value)}`;
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
    logError(error, { operation: 'asset.recordDownload', component: 'AssetDetailView' });
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
  } catch {
    ElMessage.error('收藏失败');
  }
};

const openInBlender = () => {
  if (!asset.value?.url) return;
  ElMessage.info(
    '\u5df2\u4e3a Blender \u6253\u5f00\u4fdd\u7559\u5165\u53e3\uff0c\u8bf7\u5728\u672c\u5730\u63d2\u4ef6\u4e2d\u63a5\u5165\u8be5\u8d44\u6e90\u94fe\u63a5',
  );
};
const handleMetadataLoaded = async (stats: ModelStats) => {
  modelStats.value = {
    ...modelStats.value,
    ...stats,
    maxTextureRes: stats.maxTextureRes || modelStats.value?.maxTextureRes || 0,
  };
  try {
    const response = await api.patch(`/api/assets/${assetId}/metadata`, {
      vertices: stats.vertices,
      faces: stats.faces,
      materials: stats.materials,
      animations: stats.animations,
      hasAnimations: !!stats.animations,
      dimensions: stats.dimensions,
      maxTextureRes: stats.maxTextureRes,
    });
    performanceReport.value = response.data?.performanceReport || performanceReport.value;
    if (asset.value && response.data) {
      asset.value = {
        ...asset.value,
        vertices: response.data.vertices ?? asset.value.vertices,
        faces: response.data.faces ?? asset.value.faces,
        materials: response.data.materials ?? asset.value.materials,
        animations: response.data.animations ?? asset.value.animations,
        hasAnimations: response.data.hasAnimations ?? asset.value.hasAnimations,
        dimensions: response.data.dimensions ?? asset.value.dimensions,
        maxTextureRes: response.data.maxTextureRes ?? asset.value.maxTextureRes,
      };
    }
  } catch (error) {
    console.warn('Failed to sync asset metadata:', error);
  }
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

const focusCameraPreset = (preset: CameraPresetKey) => {
  const target = { x: 0, y: 0, z: 0 };
  const positions: Record<CameraPresetKey, { x: number; y: number; z: number }> = {
    iso: { x: 5, y: 5, z: 5 },
    front: { x: 0, y: 0, z: 6 },
    side: { x: 6, y: 0, z: 0 },
    top: { x: 0, y: 6, z: 0.01 },
  };
  modelViewerRef.value?.flyTo?.(positions[preset], target);
};

const takeScreenshot = () => {
  const result = modelViewerRef.value?.takeScreenshot?.(true);
  if (!result) ElMessage.info('当前资源暂不支持截图');
};

const saveCurrentViewAsCover = async () => {
  const dataUrl = modelViewerRef.value?.takeScreenshot?.(false);
  if (!dataUrl) {
    ElMessage.info('当前资源暂不支持生成封面');
    return;
  }

  isSavingCover.value = true;
  try {
    const response = await api.patch(`/api/assets/${assetId}/thumbnail`, { thumbnail: dataUrl });
    if (asset.value) {
      asset.value.thumbnail = response.data.thumbnail;
    }
    ElMessage.success('当前视角已设为封面');
  } catch {
    ElMessage.error('封面保存失败，请确认你有编辑权限');
  } finally {
    isSavingCover.value = false;
  }
};

const toggleViewMode = () => {
  const nextMode = viewerConfig.value.viewMode === 'solid' ? 'solid+wireframe' : 'solid';
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
  if (!canAnnotate.value) {
    ElMessage.warning('当前资产仅允许团队成员、所有者或管理员批注');
    return;
  }

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
    modelViewerRef.value.flyTo(
      JSON.parse(annotation.cameraPos),
      JSON.parse(annotation.cameraTarget),
    );
  } catch (error) {
    logError(error, { operation: 'asset.parseAnnotationCamera', component: 'AssetDetailView' });
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
    fetchTimer = setTimeout(fetchAsset, 1500);
  } catch (error) {
    ElMessage.error(
      (error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined) || '版本上传失败',
    );
  } finally {
    isUploadingVersion.value = false;
  }
};

onUnmounted(() => {
  if (fetchTimer) clearTimeout(fetchTimer);
});
</script>

<template>
  <div class="asset-detail-page mobile-adaptive">
    <main class="detail-main">
      <UiButton variant="link" :icon="ChevronLeft" @click="goBack">返回资源库</UiButton>

      <AssetDetailHeader
        :asset="asset"
        :review-status="reviewStatus"
        :favorite-count="favoriteCount"
        :view-count="viewCount"
        @favorite="handleFavorite"
        @share="handleShare"
      />

      <section class="viewer-shell">
        <div class="viewport-grid-overlay" aria-hidden="true"></div>
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <span>正在加载资产...</span>
        </div>

        <div class="viewer-statusbar mobile-row">
          <div>
            <span class="viewer-kicker">MODEL WORKBENCH</span>
            <strong>{{ displayFormat }} 模型工作台</strong>
          </div>
          <span class="viewer-dimension">{{ modelStats?.dimensions || '等待尺寸解析' }}</span>
        </div>

        <div class="top-viewer-tools mobile-row">
          <button
            type="button"
            title="实体模式"
            :class="{ active: viewerConfig.viewMode === 'solid' && !isClayMode }"
            @click="
              viewerConfig.viewMode = 'solid';
              modelViewerRef?.setViewMode?.('solid');
            "
          >
            <Box class="h-4 w-4" />
          </button>
          <button
            type="button"
            title="拓扑叠线"
            :class="{ active: viewerConfig.viewMode === 'solid+wireframe' }"
            @click="toggleViewMode"
          >
            <Grid2X2 class="h-4 w-4" />
          </button>
          <button
            type="button"
            title="白模模式"
            :class="{ active: isClayMode }"
            @click="toggleClayMode"
          >
            <Settings class="h-4 w-4" />
          </button>
          <button
            type="button"
            title="设为封面"
            :disabled="isSavingCover"
            @click="saveCurrentViewAsCover"
          >
            <Wand2 class="h-4 w-4" />
          </button>
          <button type="button" title="全屏" @click="modelViewerRef?.toggleFullscreen?.()">
            <Maximize2 class="h-4 w-4" />
          </button>
        </div>

        <div class="view-preset-rail">
          <button
            v-for="preset in cameraPresets"
            :key="preset.key"
            type="button"
            :title="preset.label"
            @click="focusCameraPreset(preset.key)"
          >
            {{ preset.value }}
          </button>
        </div>

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
          :editable="activePanel === 'comments' && canAnnotate"
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

        <div class="bottom-viewer-tools mobile-row">
          <button type="button" title="重置视角" @click="resetCamera">
            <RefreshCw class="h-4 w-4" />
          </button>
          <button
            type="button"
            title="自动旋转"
            :class="{ active: viewerConfig.autoRotate }"
            @click="viewerConfig.autoRotate = !viewerConfig.autoRotate"
          >
            <RefreshCw class="h-4 w-4" />
          </button>
          <select v-model="viewerConfig.environment">
            <option value="studio">影棚</option>
            <option value="sunset">日落</option>
            <option value="forest">森林</option>
            <option value="room">室内</option>
          </select>
          <button type="button" title="截图" @click="takeScreenshot">
            <Camera class="h-4 w-4" />
          </button>
        </div>

        <div class="viewer-telemetry">
          <article v-for="item in viewerTelemetry" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </article>
        </div>

        <div class="format-dock mobile-row">
          <span>包含格式</span>
          <strong v-for="format in parsedFormats.slice(0, 5)" :key="format">{{ format }}</strong>
          <strong v-if="parsedFormats.length > 5">+{{ parsedFormats.length - 5 }}</strong>
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
          <div class="overview-stats mobile-row">
            <span>分类：{{ asset?.category?.name || '未分类' }}</span>
            <span>作者：{{ asset?.user?.name || '未知用户' }}</span>
            <span>格式：{{ parsedFormats.join(' / ') || displayFormat }}</span>
          </div>
        </div>

        <AssetPreviewGallery v-if="activePanel === 'preview'" :preview-items="previewItems" />

        <div v-if="activePanel === 'textures'" class="texture-panel">
          <article v-for="name in ['BaseColor', 'Normal', 'Roughness', 'Metallic']" :key="name">
            <Layers3 class="h-5 w-5" />
            <strong>{{ name }}</strong>
            <span>{{
              modelStats?.maxTextureRes ? `${modelStats.maxTextureRes}px` : '等待模型解析'
            }}</span>
          </article>
        </div>

        <div v-if="activePanel === 'usage'" class="usage-panel">
          <h2>使用说明</h2>
          <p>
            下载后可在 Blender、Three.js 或支持 {{ displayFormat }} 的 3D
            工具中使用。若资源包含贴图，请保持原始目录结构。
          </p>
          <p>
            团队协作时可在“评论”页签中点击模型表面添加空间评论，系统会记录模型坐标和当前相机视角。
          </p>
        </div>

        <AssetVersionsPanel
          v-if="activePanel === 'versions'"
          v-model:new-version-change-log="newVersionChangeLog"
          :versions="versions"
          :is-uploading-version="isUploadingVersion"
          @file-change="handleVersionFileChange"
          @upload="uploadNewVersion"
        />

        <div v-if="activePanel === 'compare'" class="compare-panel">
          <div class="compare-toolbar mobile-row">
            <label>
              <span>版本 A</span>
              <select v-model="compareBaseId">
                <option v-for="item in compareSources" :key="item.id" :value="item.id">
                  {{ item.label }}
                </option>
              </select>
            </label>
            <label>
              <span>版本 B</span>
              <select v-model="compareTargetId">
                <option v-for="item in compareSources" :key="item.id" :value="item.id">
                  {{ item.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="compare-summary">
            <article>
              <strong>{{ selectedBaseSource?.label }}</strong>
              <span>{{ selectedBaseSource?.source.reviewStatus }}</span>
              <p>{{ selectedBaseSource?.source.changeLog }}</p>
            </article>
            <article>
              <strong>{{ selectedTargetSource?.label }}</strong>
              <span>{{ selectedTargetSource?.source.reviewStatus }}</span>
              <p>{{ selectedTargetSource?.source.changeLog }}</p>
            </article>
          </div>

          <div class="compare-table">
            <div class="compare-row header">
              <span>指标</span>
              <span>版本 A</span>
              <span>版本 B</span>
              <span>差异</span>
            </div>
            <div v-for="row in compareRows" :key="row.key" class="compare-row">
              <strong>{{ row.label }}</strong>
              <span>{{ formatMetricValue(row.baseValue, row.unit) }}</span>
              <span>{{ formatMetricValue(row.targetValue, row.unit) }}</span>
              <em :class="{ improved: row.improved, regressed: !row.improved && row.delta !== 0 }">
                {{ formatDelta(row.delta, row.unit) }}
              </em>
            </div>
          </div>
        </div>

        <AssetPerformancePanel
          v-if="activePanel === 'performance'"
          :active-performance-report="activePerformanceReport"
          :mobile-risk-label="mobileRiskLabel"
        />

        <AssetCommentsPanel
          v-if="activePanel === 'comments'"
          v-model:new-annotation-text="newAnnotationText"
          :annotations="annotations"
          :can-annotate="canAnnotate"
          :is-adding-annotation="isAddingAnnotation"
          :annotation-coords="annotationCoords"
          :current-user-id="currentUserId"
          :asset-user-id="asset?.userId || ''"
          @save="saveAnnotation"
          @delete="deleteAnnotation"
          @click="clickAnnotation"
        />
      </section>
    </main>

    <aside class="detail-aside">
      <AssetMetadataPanel
        :asset="asset"
        :display-format="displayFormat"
        :asset-size="assetSize"
        :parsed-formats="parsedFormats"
        :review-status="reviewStatus"
        :view-count="viewCount"
        :favorite-count="favoriteCount"
        :download-count="downloadCount"
        :annotation-count="annotations.length"
        :file-info="fileInfo"
        :model-info-rows="modelInfoRows"
        :active-performance-report="activePerformanceReport"
        :performance-tone-label="performanceToneLabel"
        :mobile-risk-label="mobileRiskLabel"
        :tags="tags"
        @view-performance="activePanel = 'performance'"
      />

      <AssetDetailActions @download="handleDownload" @open-in-blender="openInBlender" />
    </aside>
  </div>
</template>

<style scoped>
.asset-detail-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 316px;
  gap: 18px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 16px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.035), transparent 180px), #f4f6f8;
  color: #17213a;
}

.detail-main,
.detail-aside {
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
}

.top-viewer-tools,
.bottom-viewer-tools,
.panel-grid button {
  display: flex;
  align-items: center;
}

.viewer-shell {
  position: relative;
  height: min(64vh, 680px);
  min-height: 500px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid #202938;
  background:
    radial-gradient(circle at 50% 45%, rgba(59, 130, 246, 0.18), transparent 34%),
    radial-gradient(circle at 74% 24%, rgba(245, 121, 42, 0.12), transparent 28%),
    linear-gradient(145deg, #151b24 0%, #0c1118 62%, #070b10 100%);
  box-shadow: 0 22px 60px rgba(15, 23, 42, 0.18);
}

.viewer-canvas {
  width: 100%;
  height: 100%;
}

.viewport-grid-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.55), transparent 72%);
}

.viewer-statusbar,
.viewer-telemetry,
.format-dock,
.view-preset-rail {
  position: absolute;
  z-index: 14;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(11, 16, 24, 0.72);
  color: #e5edf7;
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
}

.viewer-statusbar {
  left: 18px;
  top: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: min(460px, calc(100% - 210px));
  border-radius: 8px;
  padding: 10px 12px;
}

.viewer-statusbar > div {
  display: grid;
  gap: 2px;
}

.viewer-kicker {
  color: #8fb7ff;
  font-size: 10px;
  font-weight: 900;
}

.viewer-statusbar strong {
  overflow: hidden;
  color: #f8fbff;
  font-size: 14px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-dimension {
  flex: 0 0 auto;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #b8c4d7;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 800;
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
  z-index: 15;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(11, 16, 24, 0.72);
  padding: 8px;
  backdrop-filter: blur(14px);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.24);
}

.top-viewer-tools {
  right: 18px;
  top: 18px;
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
  color: #b8c4d7;
  cursor: pointer;
}

.top-viewer-tools button:disabled,
.bottom-viewer-tools button:disabled {
  cursor: wait;
  opacity: 0.55;
}

.top-viewer-tools button.active,
.bottom-viewer-tools button.active {
  background: rgba(245, 121, 42, 0.18);
  color: #ffb071;
}

.bottom-viewer-tools select {
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.08);
  color: #f8fbff;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 900;
  outline: 0;
}

.view-preset-rail {
  left: 18px;
  top: 86px;
  display: grid;
  gap: 6px;
  border-radius: 8px;
  padding: 7px;
}

.view-preset-rail button {
  width: 48px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
}

.view-preset-rail button:hover {
  background: rgba(96, 165, 250, 0.18);
  color: #ffffff;
}

.axis-widget {
  position: absolute;
  z-index: 12;
  right: 30px;
  top: 86px;
  display: grid;
  place-items: center;
  color: rgba(226, 232, 240, 0.72);
  font-size: 11px;
  font-weight: 900;
}

.axis-y {
  color: #20c76d;
}
.axis-z {
  color: #3b82f6;
  transform: translate(-22px, 16px);
}
.axis-x {
  color: #f05252;
  transform: translate(24px, -16px);
}

.viewer-telemetry {
  left: 18px;
  bottom: 18px;
  display: grid;
  grid-template-columns: repeat(4, minmax(72px, 1fr));
  gap: 8px;
  max-width: min(520px, calc(100% - 420px));
  border-radius: 8px;
  padding: 8px;
}

.viewer-telemetry article {
  display: grid;
  gap: 3px;
  min-width: 0;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.07);
  padding: 8px 10px;
}

.viewer-telemetry span,
.format-dock span {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 900;
}

.viewer-telemetry strong {
  overflow: hidden;
  color: #f8fbff;
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.format-dock {
  right: 18px;
  bottom: 18px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  max-width: 280px;
  border-radius: 8px;
  padding: 9px;
}

.format-dock strong {
  border-radius: 6px;
  background: rgba(96, 165, 250, 0.16);
  color: #dbeafe;
  padding: 4px 7px;
  font-size: 10px;
  font-weight: 900;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
  border: 1px solid #e6ebf5;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  padding: 10px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.05);
}

.panel-grid button {
  min-width: 0;
  gap: 9px;
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #fff;
  padding: 10px;
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
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 7px;
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
.texture-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}

.overview-stats span,
.texture-panel article {
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #f8faff;
  padding: 12px;
}

.texture-panel article {
  display: grid;
  gap: 6px;
  color: #65718b;
}

.texture-panel strong {
  color: #192640;
}

.compare-panel {
  display: grid;
  gap: 14px;
}

.compare-toolbar,
.compare-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.compare-toolbar label {
  display: grid;
  gap: 7px;
  color: #65718b;
  font-size: 12px;
  font-weight: 900;
}

.compare-toolbar select {
  width: 100%;
  height: 38px;
  border: 1px solid #e2e8f2;
  border-radius: 8px;
  background: #fff;
  color: #17213a;
  padding: 0 10px;
  outline: 0;
}

.compare-summary article {
  border: 1px solid #e8edf6;
  border-radius: 8px;
  background: #f8faff;
  padding: 14px;
}

.compare-summary strong {
  display: block;
  color: #17213a;
  font-size: 14px;
}

.compare-summary span {
  display: inline-flex;
  margin-top: 8px;
  border-radius: 7px;
  background: #eefcf4;
  color: #0f9f6e;
  padding: 4px 7px;
  font-size: 11px;
  font-weight: 900;
}

.compare-summary p {
  margin: 10px 0 0;
  color: #65718b;
  font-size: 13px;
  line-height: 1.7;
}

.compare-table {
  overflow: hidden;
  border: 1px solid #e8edf6;
  border-radius: 8px;
}

.compare-row {
  display: grid;
  grid-template-columns: 1.2fr repeat(3, minmax(0, 1fr));
  align-items: center;
  min-height: 44px;
  border-top: 1px solid #eef2f7;
  padding: 0 14px;
  color: #53617c;
  font-size: 12px;
}

.compare-row:first-child {
  border-top: 0;
}

.compare-row.header {
  background: #f8faff;
  color: #7b879d;
  font-weight: 900;
}

.compare-row strong {
  color: #17213a;
}

.compare-row em {
  justify-self: start;
  border-radius: 7px;
  padding: 4px 7px;
  color: #64748b;
  background: #f1f5f9;
  font-style: normal;
  font-weight: 900;
}

.compare-row em.improved {
  color: #0f9f6e;
  background: #e8fbf1;
}

.compare-row em.regressed {
  color: #dc2626;
  background: #fee2e2;
}

.detail-aside {
  display: grid;
  align-content: start;
  gap: 12px;
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

  .viewer-shell {
    height: 440px;
  }

  .bottom-viewer-tools {
    left: 12px;
    right: 12px;
    justify-content: center;
    transform: none;
  }

  .viewer-statusbar {
    left: 12px;
    right: 12px;
    max-width: none;
  }

  .top-viewer-tools {
    top: 78px;
    right: 12px;
  }

  .view-preset-rail,
  .axis-widget,
  .format-dock {
    display: none;
  }

  .viewer-telemetry {
    left: 12px;
    right: 12px;
    bottom: 70px;
    max-width: none;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel-grid,
  .detail-aside,
  .overview-stats,
  .texture-panel,
  .compare-toolbar,
  .compare-summary {
    grid-template-columns: 1fr;
  }

  .compare-row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 10px 12px;
  }
}
</style>
