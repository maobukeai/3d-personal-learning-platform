<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as THREE from 'three';
import {
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import gsap from 'gsap';
import { SceneManager } from '@/utils/3d/SceneManager';
import { ModelLoader } from '@/utils/3d/ModelLoader';
import { RenderLoopController } from '@/utils/3d/RenderLoopController';
import { disposeHierarchy } from '@/utils/3d/threeDisposal';
import { logError } from '@/utils/error';
import { getAssetUrl } from '@/utils/api';
import { removeBlenderWireOverlay, createBlenderWireOverlay } from './wireframeOverlay';
import type { ModelAssetLoader, ModelStats, ViewMode } from './ModelAssetLoader';
import type { HotspotWithScreenPosition } from '@/utils/3d/HotspotEventBus';
const props = defineProps<{
  canvas: HTMLCanvasElement | null;
  container: HTMLElement | null;
  sceneConfig: any;
  autoRotate: boolean;
  modelUrl?: string;
  defaultCameraPos?: string | null;
  defaultCameraTarget?: string | null;
  hotspots?: HotspotWithScreenPosition[];
  assetLoader: ModelAssetLoader;
}>();
const emit = defineEmits<{
  'metadata-loaded': [stats: ModelStats];
  'screenshot-captured': [dataURL: string];
  'hotspot-added': [point: { x: number; y: number; z: number }];
  'hotspots-updated': [hotspots: HotspotWithScreenPosition[]];
  'fps-update': [fps: number];
  ready: [];
}>();
const al = props.assetLoader;
let sceneManager: SceneManager | null = null;
let modelLoader: ModelLoader | null = null;
let renderLoop: RenderLoopController | null = null;
let loadedModel: Object3D | null = null;
let currentActions: any[] = [];
const originalMaterials = new Map<string, Material | Material[]>();
const clayMaterial = new MeshStandardMaterial({ color: 0xdddddd, roughness: 0.7, metalness: 0.05 });
let activeEnvTexture: Texture | null = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const applyViewMode = () => {
  removeBlenderWireOverlay(loadedModel);
  if (!loadedModel) return;
  loadedModel.traverse((child) => {
    if (child instanceof Mesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if ('wireframe' in m) (m as MeshStandardMaterial).wireframe = false;
      });
    }
  });
  if (al.isClayMode.value) return;
};
const setViewMode = (mode: ViewMode) => {
  applyViewMode();
  if (mode === 'wireframe' || mode === 'solid+wireframe') {
    createBlenderWireOverlay(loadedModel, sceneManager?.scene ?? null);
  }
};
const applyClayMode = () => {
  if (!loadedModel) return;
  loadedModel.traverse((child) => {
    if (child instanceof Mesh) {
      if (al.isClayMode.value) {
        if (!originalMaterials.has(child.uuid)) {
          originalMaterials.set(child.uuid, child.material);
        }
        child.material = clayMaterial;
      } else {
        const orig = originalMaterials.get(child.uuid);
        if (orig) child.material = orig;
      }
    }
  });
};
const toggleClayMode = () => {
  al.isClayMode.value = !al.isClayMode.value;
  applyClayMode();
};
const playAnimation = (index: number) => {
  if (index < 0 || index >= currentActions.length) return;
  if (al.currentAnimation.value !== -1 && currentActions[al.currentAnimation.value]) {
    currentActions[al.currentAnimation.value].fadeOut(0.5);
  }
  const action = currentActions[index];
  action.reset().fadeIn(0.5).play();
  al.currentAnimation.value = index;
};
const togglePause = () => {
  al.isPaused.value = !al.isPaused.value;
  if (al.currentAnimation.value === -1) return;
  const action = currentActions[al.currentAnimation.value];
  if (action) action.paused = al.isPaused.value;
};
const createLoadingManager = () => {
  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    const isImage = /\.(png|jpg|jpeg|tga|dds|gif|bmp|webp|tiff)$/i.test(url);
    const isAssetPath = url.includes('/uploads/') || url.includes('/assets/');
    const isRenamedAsset = url.includes('asset-');
    if (isImage && isAssetPath && !isRenamedAsset) {
      if (import.meta.env.DEV) {
        logError(new Error(`Intercepted missing texture request to prevent 404: ${url}`), {
          operation: 'loadManager',
          component: 'ModelRendererFacade',
        });
      }
      return 'data:image/png;base64,iVBORw0KGgoAAAANUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    }
    return url;
  });
  return manager;
};
const onModelLoaded = (object: Object3D, animCount: number = 0) => {
  object.traverse((child) => {
    if (child instanceof Mesh && child.geometry) {
      try {
        if (typeof (child.geometry as any).computeBoundsTree === 'function') {
          (child.geometry as any).computeBoundsTree();
        }
      } catch (err) {
        console.error('Error computing bounds tree:', err);
      }
    }
  });
  loadedModel = object;
  if (sceneManager) sceneManager.scene.add(loadedModel);
  if (modelLoader) modelLoader.centerAndScaleModel(loadedModel);
  calculateStats(loadedModel, animCount);
  al.isLoading.value = false;
  applyViewMode();
  if (props.defaultCameraPos && props.defaultCameraTarget) {
    try {
      const pos = JSON.parse(props.defaultCameraPos);
      const tar = JSON.parse(props.defaultCameraTarget);
      if (typeof pos.x === 'number' && typeof tar.x === 'number') {
        setTimeout(() => flyTo(pos, tar), 100);
      }
    } catch (e) {
      logError(e, { operation: 'parseDefaultCameraPreset', component: 'ModelRendererFacade' });
    }
  }
  setTimeout(() => {
    const dataURL = takeScreenshot(false);
    if (dataURL) emit('screenshot-captured', dataURL);
  }, 2500);
};
const calculateStats = (model: Object3D, animCount: number = 0) => {
  if (!modelLoader || !sceneManager) return;
  const baseStats = modelLoader.calculateStats(model, animCount);
  const drawCalls = sceneManager.renderer ? sceneManager.renderer.info.render.calls : 0;
  const fullStats: ModelStats = { ...baseStats, drawCalls };
  al.stats.value = fullStats;
  emit('metadata-loaded', fullStats);
};
const addPlaceholder = () => {
  if (!modelLoader || !sceneManager) return;
  const mesh = modelLoader.createPlaceholderMesh();
  try {
    if (typeof (mesh.geometry as any).computeBoundsTree === 'function') {
      (mesh.geometry as any).computeBoundsTree();
    }
  } catch {}
  sceneManager.scene.add(mesh);
  loadedModel = mesh;
  calculateStats(loadedModel, 0);
};
const loadModel = async (url: string) => {
  if (!modelLoader || !sceneManager) return;
  const loadId = al.nextLoadId();
  al.isClayMode.value = false;
  if (loadedModel) {
    originalMaterials.forEach((m) => {
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m.dispose();
    });
    originalMaterials.clear();
    disposeHierarchy(loadedModel, clayMaterial);
    sceneManager.scene.remove(loadedModel);
    loadedModel = null;
    removeBlenderWireOverlay(loadedModel);
  }
  al.isLoading.value = true;
  al.loadingProgress.value = 0;
  al.error.value = null;
  al.animations.value = [];
  al.currentAnimation.value = -1;
  const ext = al.getModelExtension(url);
  al.modelFormat.value = ext.replace('.', '').toUpperCase();
  const manager = createLoadingManager();
  const onProgress = (p: number) => {
    if (al.isStaleLoad(loadId)) return;
    al.loadingProgress.value = p;
  };
  const onError = (err: unknown) => {
    if (al.isStaleLoad(loadId)) return;
    logError(err, { operation: 'model.load', component: 'ModelRendererFacade' });
    al.error.value = `无法加载 ${ext.toUpperCase()} 模型`;
    al.isLoading.value = false;
    addPlaceholder();
  };
  const onLoaded = (model: Object3D, animCount: number, mixer: any, actions: any[]) => {
    if (al.isStaleLoad(loadId)) {
      disposeHierarchy(model);
      return;
    }
    if (mixer && renderLoop) {
      renderLoop.setMixer(mixer);
      currentActions = actions;
      al.animations.value = actions.map(
        (act: any, i: number) => act._clip?.name || `Animation ${i + 1}`,
      );
      playAnimation(0);
    }
    onModelLoaded(model, animCount);
  };
  try {
    await modelLoader.load(url, onProgress, onLoaded, onError);
  } catch (err: any) {
    if (!al.isStaleLoad(loadId)) {
      al.error.value = `Error loading model: ${err.message || err}`;
      al.isLoading.value = false;
    }
  }
};
const getCameraState = () => { if (!sceneManager) return null; const cam = sceneManager.camera; const tar = sceneManager.controls.target; return { position: { x: cam.position.x, y: cam.position.y, z: cam.position.z }, target: { x: tar.x, y: tar.y, z: tar.z }, };
}; // prettier-ignore
const flyTo = (
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
) => {
  if (!sceneManager) return;
  const cam = sceneManager.camera;
  const controls = sceneManager.controls;
  controls.enabled = false;
  gsap.to(cam.position, {
    x: position.x,
    y: position.y,
    z: position.z,
    duration: 1.5,
    ease: 'power2.inOut',
    onUpdate: () => cam.lookAt(controls.target),
  });
  gsap.to(controls.target, {
    x: target.x,
    y: target.y,
    z: target.z,
    duration: 1.5,
    ease: 'power2.inOut',
    onComplete: () => {
      controls.enabled = true;
    },
  });
};
const resetCamera = () => {
  if (!sceneManager) return;
  sceneManager.camera.position.set(5, 5, 5);
  sceneManager.controls.target.set(0, 0, 0);
  sceneManager.controls.update();
};
const takeScreenshot = (download = true): string | null => {
  if (!sceneManager) return null;
  const dataURL = sceneManager.renderer.domElement.toDataURL('image/png');
  if (download) {
    const link = document.createElement('a');
    link.download = 'screenshot.png';
    link.href = dataURL;
    link.click();
  }
  return dataURL;
};
const handleCanvasClick = (event: MouseEvent) => {
  if (!props.container || !loadedModel || !sceneManager) return;
  const rect = props.container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / props.container.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / props.container.clientHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, sceneManager.camera);
  raycaster.firstHitOnly = true;
  const intersects = raycaster.intersectObject(loadedModel, true);
  if (intersects.length > 0) {
    const point = intersects[0].point;
    emit('hotspot-added', { x: point.x, y: point.y, z: point.z });
  }
};
const updateHotspotsPosition = () => {
  if (!props.hotspots || !sceneManager || !props.container) return;
  const cam = sceneManager.camera;
  const w = props.container.clientWidth;
  const height = props.container.clientHeight;
  const projected = props.hotspots.map((hp, i) => {
    const v = new Vector3(hp.x, hp.y, hp.z).project(cam);
    return {
      ...hp,
      screenX: (v.x * 0.5 + 0.5) * w,
      screenY: (-v.y * 0.5 + 0.5) * height,
      isVisible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1,
      index: i,
    };
  });
  emit('hotspots-updated', projected);
};
const updateSceneConfig = async () => {
  if (!sceneManager) return;
  await sceneManager.updateConfig(props.sceneConfig || {});
  applyViewMode();
};
const handleResize = () => {
  if (!sceneManager || !props.container) return;
  sceneManager.handleResize();
};
const startRenderLoop = () => {
  if (!renderLoop || !sceneManager) return;
  renderLoop.start();
};
const stopRenderLoop = () => {
  if (renderLoop) renderLoop.stop();
};
const isReady = ref(false);
onMounted(async () => {
  if (!props.canvas || !props.container) return;
  try {
    const { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } =
      await import('three-mesh-bvh');
    (THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
    (THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
    (Mesh as any).prototype.raycast = acceleratedRaycast;
  } catch (err) {
    console.warn('three-mesh-bvh not available, using default raycasting:', err);
  }
  sceneManager = new SceneManager(props.container, !!props.autoRotate);
  modelLoader = new ModelLoader(sceneManager.scene);
  renderLoop = new RenderLoopController(
    sceneManager.renderer,
    sceneManager.scene,
    sceneManager.camera,
    sceneManager.controls,
    () => {
      if (!sceneManager) return;
      const time = performance.now();
      updateHotspotsPosition();
      const fps = al.tickFps(time);
      if (fps !== null) {
        al.handleFpsUpdate(fps);
        emit('fps-update', fps);
      }
    },
  );
  await updateSceneConfig();
  if (props.modelUrl) {
    void loadModel(getAssetUrl(props.modelUrl));
  } else {
    addPlaceholder();
  }
  isReady.value = true;
  emit('ready');
  startRenderLoop();
});
onBeforeUnmount(() => {
  al.abortLoads();
  if (renderLoop) {
    renderLoop.stop();
    renderLoop = null;
  }
  if (loadedModel && modelLoader) {
    originalMaterials.forEach((m) => {
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m.dispose();
    });
    originalMaterials.clear();
    disposeHierarchy(loadedModel, clayMaterial);
    loadedModel = null;
  }
  removeBlenderWireOverlay(loadedModel);
  if (activeEnvTexture) {
    activeEnvTexture.dispose();
    activeEnvTexture = null;
  }
  if (sceneManager) {
    sceneManager.dispose();
    sceneManager = null;
  }
  clayMaterial.dispose();
  modelLoader = null;
});
watch(
  () => props.autoRotate,
  (val) => {
    if (sceneManager) sceneManager.controls.autoRotate = !!val;
  },
);
watch(
  () => JSON.stringify(props.sceneConfig),
  () => {
    if (isReady.value) void updateSceneConfig();
  },
);
watch(
  () => props.modelUrl,
  (newUrl) => {
    if (newUrl && isReady.value) {
      void loadModel(getAssetUrl(newUrl));
    }
  },
);
defineExpose({
  loadModel,
  setViewMode,
  toggleClayMode,
  togglePause,
  flyTo,
  resetCamera,
  takeScreenshot,
  getCameraState,
  handleCanvasClick,
  handleResize,
  stopRenderLoop,
});
</script>
