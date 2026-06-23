import type { Asset } from '@/types';

export type ViewMode = 'solid' | 'wireframe' | 'solid+wireframe';
export type CameraPresetKey = 'iso' | 'front' | 'side' | 'top';
export type PanelId =
  | 'overview'
  | 'preview'
  | 'textures'
  | 'usage'
  | 'versions'
  | 'compare'
  | 'performance'
  | 'comments';

export type ModelViewerExpose = {
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

export type ModelStats = {
  vertices?: number;
  faces?: number;
  materials?: number;
  animations?: number;
  dimensions?: string;
  maxTextureRes?: number;
};

export type PerformanceTone = 'pass' | 'notice' | 'warning' | 'danger';

export type PerformanceReport = {
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

export type AssetDetail = Asset & {
  formats?: string[] | string | null;
  maxTextureRes?: number | null;
  performanceReport?: PerformanceReport | null;
};

export type AssetVersion = {
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

export type AssetAnnotation = {
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
