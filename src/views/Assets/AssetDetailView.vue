<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertTriangle,
  Box,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Cuboid,
  Download,
  ExternalLink,
  Eye,
  Gauge,
  GitCompare,
  Grid2X2,
  History,
  Image as ImageIcon,
  Info,
  Layers3,
  Maximize2,
  MessageSquare,
  MoreHorizontal,
  Move3D,
  PackageCheck,
  Plus,
  RefreshCw,
  Ruler,
  Settings,
  Share2,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  UploadCloud,
  User,
  Wand2,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';
import type { Asset } from '@/types';

type ViewMode = 'solid' | 'wireframe' | 'solid+wireframe';
type CameraPresetKey = 'iso' | 'front' | 'side' | 'top';
type PanelId =
  | 'overview'
  | 'preview'
  | 'textures'
  | 'usage'
  | 'versions'
  | 'compare'
  | 'performance'
  | 'comments';

type ModelViewerExpose = {
  setViewMode?: (mode: ViewMode) => void;
  toggleClayMode?: () => void;
  isClayMode?: boolean;
  resetCamera?: () => void;
  takeScreenshot?: (download?: boolean) => string | null;
  toggleFullscreen?: () => void;
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

type PerformanceTone = 'pass' | 'notice' | 'warning' | 'danger';

type PerformanceReport = {
  score: number;
  level: PerformanceTone;
  mobileRisk: 'safe' | 'low' | 'medium' | 'high';
  summary: string;
  metrics: {
    faces: number;
    vertices: number;
    materials: number;
    size: number;
    maxTextureRes: number;
    animations: number;
    hasAnimations: boolean;
    dimensions: string;
  };
  risks: Array<{
    metric: string;
    label: string;
    value: number;
    unit: string;
    tone: PerformanceTone;
    message: string;
    recommendation: string;
  }>;
};

type AssetDetail = Asset & {
  formats?: string[] | string | null;
  maxTextureRes?: number | null;
  performanceReport?: PerformanceReport | null;
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
  performanceReport?: PerformanceReport | null;
  comparison?: Record<string, { current: number; previous: number; delta: number }> | null;
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

const riskToneText = (tone: PerformanceTone) => {
  if (tone === 'danger') return '高风险';
  if (tone === 'warning') return '需优化';
  if (tone === 'notice') return '关注';
  return '通过';
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
    fetchTimer = setTimeout(fetchAsset, 1500);
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '版本上传失败');
  } finally {
    isUploadingVersion.value = false;
  }
};

onUnmounted(() => {
  if (fetchTimer) clearTimeout(fetchTimer);
});
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
            <span
              ><ShieldCheck class="h-4 w-4" />{{
                asset?.user?.role === 'ADMIN' ? '系统管理员' : '创作者'
              }}</span
            >
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
        <div class="viewport-grid-overlay" aria-hidden="true"></div>
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <span>正在加载资产...</span>
        </div>

        <div class="viewer-statusbar">
          <div>
            <span class="viewer-kicker">MODEL WORKBENCH</span>
            <strong>{{ displayFormat }} 模型工作台</strong>
          </div>
          <span class="viewer-dimension">{{ modelStats?.dimensions || '等待尺寸解析' }}</span>
        </div>

        <div class="top-viewer-tools">
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

        <div class="bottom-viewer-tools">
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

        <div class="format-dock">
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

        <div v-if="activePanel === 'versions'" class="versions-panel">
          <div class="version-upload">
            <input
              id="version-file-input"
              type="file"
              accept=".glb,.gltf,.fbx,.obj,.stl"
              @change="handleVersionFileChange"
            />
            <textarea
              v-model="newVersionChangeLog"
              rows="2"
              placeholder="记录本次修改内容"
            ></textarea>
            <button type="button" :disabled="isUploadingVersion" @click="uploadNewVersion">
              <UploadCloud class="h-4 w-4" />
              {{ isUploadingVersion ? '上传中...' : '发布新版本' }}
            </button>
          </div>
          <article v-for="version in versions" :key="version.id" class="version-card">
            <div>
              <strong>{{ version.version }}</strong>
              <span>{{ formatDate(version.createdAt) }}</span>
            </div>
            <div class="version-metrics">
              <span>{{ formatMetricValue(version.faces || 0) }} 面</span>
              <span>{{ formatMetricValue(version.maxTextureRes || 0, 'px') }}</span>
              <span>{{ formatMetricValue(version.size || 0, 'MB') }}</span>
            </div>
            <p>{{ version.changeLog || '初始版本提交' }}</p>
          </article>
          <div v-if="versions.length === 0" class="empty-panel">暂无版本记录</div>
        </div>

        <div v-if="activePanel === 'compare'" class="compare-panel">
          <div class="compare-toolbar">
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

        <div v-if="activePanel === 'performance'" class="performance-panel">
          <div class="performance-hero" :data-tone="activePerformanceReport.level">
            <Gauge class="h-7 w-7" />
            <div>
              <strong>{{ activePerformanceReport.score }}</strong>
              <span>{{ activePerformanceReport.summary }}</span>
            </div>
            <small>{{ mobileRiskLabel }}</small>
          </div>

          <div class="risk-grid">
            <article
              v-for="risk in activePerformanceReport.risks"
              :key="risk.metric"
              :data-tone="risk.tone"
            >
              <div>
                <CheckCircle2 v-if="risk.tone === 'pass'" class="h-4 w-4" />
                <AlertTriangle v-else class="h-4 w-4" />
                <strong>{{ risk.label }}</strong>
                <span>{{ riskToneText(risk.tone) }}</span>
              </div>
              <b>{{ formatMetricValue(risk.value, risk.unit) }}</b>
              <p>{{ risk.message }}</p>
              <small>{{ risk.recommendation }}</small>
            </article>
          </div>
        </div>

        <div v-if="activePanel === 'comments'" class="comments-panel">
          <div class="comment-tip" :data-disabled="!canAnnotate">
            <MessageSquare class="h-5 w-5" />
            <span>
              {{
                canAnnotate
                  ? '点击模型表面可添加空间评论，评论会绑定当前视角。'
                  : '你可以查看批注；新增批注需要团队、所有者或管理员权限。'
              }}
            </span>
          </div>
          <div v-if="isAddingAnnotation && annotationCoords" class="comment-editor">
            <span
              >X {{ annotationCoords.x.toFixed(2) }} · Y {{ annotationCoords.y.toFixed(2) }} · Z
              {{ annotationCoords.z.toFixed(2) }}</span
            >
            <textarea v-model="newAnnotationText" rows="3" placeholder="输入评论内容"></textarea>
            <button type="button" @click="saveAnnotation">
              <Plus class="h-4 w-4" />
              保存评论
            </button>
          </div>
          <article
            v-for="annotation in annotations"
            :key="annotation.id"
            class="comment-card"
            @click="clickAnnotation(annotation)"
          >
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
      <section class="side-card identity-card">
        <span>MODEL INSPECTOR</span>
        <h2>{{ displayFormat }} / {{ assetSize }}</h2>
        <p>
          {{ asset?.description || '暂无模型说明，可在模型档案中补充拓扑、贴图、授权和使用场景。' }}
        </p>
        <div>
          <strong>{{ reviewStatus.label }}</strong>
          <strong>{{ parsedFormats.length || 1 }} 种格式</strong>
        </div>
      </section>

      <section class="side-card summary-card">
        <h2>概览</h2>
        <div class="summary-grid">
          <div>
            <Eye class="h-4 w-4" /><strong>{{ viewCount }}</strong
            ><span>浏览</span>
          </div>
          <div>
            <Star class="h-4 w-4" /><strong>{{ favoriteCount }}</strong
            ><span>收藏</span>
          </div>
          <div>
            <Download class="h-4 w-4" /><strong>{{ downloadCount }}</strong
            ><span>下载</span>
          </div>
          <div>
            <MessageSquare class="h-4 w-4" /><strong>{{ annotations.length }}</strong
            ><span>评论</span>
          </div>
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

      <section class="side-card performance-card" :data-tone="activePerformanceReport.level">
        <h2>性能检测</h2>
        <div class="score-ring">
          <strong>{{ activePerformanceReport.score }}</strong>
          <span>{{ performanceToneLabel }}</span>
        </div>
        <p><Smartphone class="h-4 w-4" />{{ mobileRiskLabel }}</p>
        <button type="button" @click="activePanel = 'performance'">
          <Gauge class="h-4 w-4" />
          查看检测报告
        </button>
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

.review-pill[data-tone='success'] {
  color: #11a36a;
  background: #e8fbf1;
}
.review-pill[data-tone='warning'] {
  color: #d17a00;
  background: #fff4dd;
}
.review-pill[data-tone='danger'] {
  color: #dc2626;
  background: #fee2e2;
}
.tag-pill {
  color: #6757ff;
  background: #f0efff;
}

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

.version-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.version-metrics {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.version-metrics span {
  margin: 0;
  border-radius: 7px;
  background: #eef3fb;
  padding: 4px 7px;
  color: #53617c;
  font-size: 11px;
  font-weight: 900;
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

.comment-tip[data-disabled='true'] {
  color: #64748b;
  background: #f8fafc;
}

.compare-panel,
.performance-panel {
  display: grid;
  gap: 14px;
}

.compare-toolbar,
.compare-summary,
.risk-grid {
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

.compare-summary article,
.risk-grid article {
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

.performance-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  border: 1px solid #dbe7ff;
  border-radius: 8px;
  background: #f7fbff;
  padding: 16px;
  color: #2563eb;
}

.performance-hero[data-tone='warning'] {
  border-color: #ffe2a9;
  background: #fffaf0;
  color: #c27000;
}
.performance-hero[data-tone='danger'] {
  border-color: #fecaca;
  background: #fff7f7;
  color: #dc2626;
}
.performance-hero[data-tone='pass'] {
  border-color: #bbf7d0;
  background: #f4fff8;
  color: #0f9f6e;
}

.performance-hero strong {
  display: block;
  color: #17213a;
  font-size: 28px;
  line-height: 1;
}

.performance-hero span,
.performance-hero small {
  color: #53617c;
  font-size: 13px;
  font-weight: 800;
}

.risk-grid article {
  display: grid;
  gap: 10px;
}

.risk-grid article > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.risk-grid article strong {
  color: #17213a;
  font-size: 14px;
}

.risk-grid article span {
  margin-left: auto;
  border-radius: 7px;
  background: #eef3fb;
  padding: 4px 7px;
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
}

.risk-grid article[data-tone='pass'] span {
  color: #0f9f6e;
  background: #e8fbf1;
}
.risk-grid article[data-tone='notice'] span {
  color: #2563eb;
  background: #eaf2ff;
}
.risk-grid article[data-tone='warning'] span {
  color: #c27000;
  background: #fff4dd;
}
.risk-grid article[data-tone='danger'] span {
  color: #dc2626;
  background: #fee2e2;
}

.risk-grid b {
  color: #17213a;
  font-size: 20px;
}

.risk-grid p,
.risk-grid small {
  margin: 0;
  color: #65718b;
  font-size: 12px;
  line-height: 1.7;
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

.identity-card {
  display: grid;
  gap: 11px;
  overflow: hidden;
  border-color: #263244;
  background:
    radial-gradient(circle at 88% 8%, rgba(245, 121, 42, 0.22), transparent 34%),
    linear-gradient(145deg, #17202d, #0c1118);
  color: #eef4fb;
}

.identity-card > span {
  color: #93c5fd;
  font-size: 10px;
  font-weight: 900;
}

.side-card.identity-card h2 {
  margin: 0;
  color: #ffffff;
  font-size: 18px;
}

.identity-card p {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: #b9c5d4;
  font-size: 12px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.identity-card div {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.identity-card strong {
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 900;
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

.performance-card {
  display: grid;
  gap: 12px;
}

.score-ring {
  display: grid;
  place-items: center;
  width: 86px;
  height: 86px;
  border: 7px solid #dbe7ff;
  border-radius: 50%;
  background: #f7fbff;
}

.performance-card[data-tone='pass'] .score-ring {
  border-color: #bbf7d0;
  background: #f4fff8;
}
.performance-card[data-tone='warning'] .score-ring {
  border-color: #ffe2a9;
  background: #fffaf0;
}
.performance-card[data-tone='danger'] .score-ring {
  border-color: #fecaca;
  background: #fff7f7;
}

.score-ring strong {
  color: #17213a;
  font-size: 24px;
  line-height: 1;
}

.score-ring span {
  color: #65718b;
  font-size: 11px;
  font-weight: 900;
}

.performance-card p,
.performance-card button {
  display: flex;
  align-items: center;
  gap: 7px;
}

.performance-card p {
  margin: 0;
  color: #53617c;
  font-size: 12px;
  font-weight: 900;
}

.performance-card button {
  justify-content: center;
  height: 34px;
  border: 1px solid #e2e8f2;
  border-radius: 8px;
  background: #fff;
  color: #17213a;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
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
  .preview-panel,
  .texture-panel,
  .compare-toolbar,
  .compare-summary,
  .risk-grid {
    grid-template-columns: 1fr;
  }

  .compare-row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 10px 12px;
  }

  .performance-hero {
    grid-template-columns: 1fr;
  }
}
</style>
