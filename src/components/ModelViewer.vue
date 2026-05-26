<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  AnimationMixer,
  Box3,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Texture,
  TorusKnotGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type AnimationAction,
  type Material,
  type Object3D,
} from 'three';
import gsap from 'gsap';
import { Info, RefreshCw, Layers } from 'lucide-vue-next';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type ViewMode = 'solid' | 'wireframe' | 'solid+wireframe';
type ModelHotspot = {
  x: number;
  y: number;
  z: number;
  title: string;
  content: string;
  cameraPos?: { x: number; y: number; z: number };
  cameraTarget?: { x: number; y: number; z: number };
};
type HotspotWithScreenPosition = ModelHotspot & {
  screenX: number;
  screenY: number;
  isVisible: boolean;
  index: number;
};

const props = defineProps<{
  modelUrl?: string;
  autoRotate?: boolean;
  showControls?: boolean;
  assetId?: string;
  hotspots?: ModelHotspot[];
  editable?: boolean;
  sceneConfig?: {
    environment?: string;
    exposure?: number;
    bloom?: {
      enabled: boolean;
      strength: number;
      radius: number;
      threshold: number;
    };
    lights?: {
      intensity: number;
      color: string;
    };
  };
}>();

const emit = defineEmits(['metadata-loaded', 'screenshot-captured', 'hotspot-added']);

const envMaps: Record<string, string> = {
  sunset:
    'https://cdn.jsdelivr.net/gh/mrdoob/js@r140/examples/textures/equirectangular/venice_sunset_1k.hdr',
  studio:
    'https://cdn.jsdelivr.net/gh/mrdoob/js@r140/examples/textures/equirectangular/royal_esplanade_1k.hdr',
  forest:
    'https://cdn.jsdelivr.net/gh/mrdoob/js@r140/examples/textures/equirectangular/pedestrian_overpass_1k.hdr',
  room: 'https://cdn.jsdelivr.net/gh/mrdoob/js@r140/examples/textures/equirectangular/quarry_01_1k.hdr',
};

const container = ref<HTMLElement | null>(null);
const isLoading = ref(false);
const loadingProgress = ref(0);
const error = ref<string | null>(null);
const modelFormat = ref<string>('');

const animations = ref<string[]>([]);
const currentAnimation = ref<number>(-1);
const isPaused = ref(false);
const viewMode = ref<ViewMode>('solid');
const showStats = ref(false);
const activeHotspot = ref<number | null>(null);
const isFullscreen = ref(false);
const hasInitialized = ref(false);

// Clay Mode State
const isClayMode = ref(false);
const originalMaterials = new Map<string, Material | Material[]>();
const clayMaterial = new MeshStandardMaterial({
  color: 0xdddddd,
  roughness: 0.7,
  metalness: 0.05,
});
const stats = ref({
  vertices: 0,
  faces: 0,
  materials: 0,
  animations: 0,
  dimensions: '',
});

let scene: Scene;
let camera: PerspectiveCamera;
let renderer: WebGLRenderer;
let controls: OrbitControls;
let animationId: number;
let mixer: AnimationMixer | null = null;
let lastTime = 0;
let loadedModel: Object3D | null = null;
let wireframeOverlay: Object3D | null = null;
let currentActions: AnimationAction[] = [];
let ambientLight: AmbientLight;
let directionalLight: DirectionalLight;
let fillLight: DirectionalLight;
let intersectionObserver: IntersectionObserver | null = null;
let renderLoopActive = false;
let isInitializing = false;
let isViewerVisible = false;

const raycaster = new Raycaster();
const mouse = new Vector2();
const hotspotsWithScreenPos = ref<HotspotWithScreenPosition[]>([]);

const getModelExtension = (url: string): string => {
  const urlWithoutQuery = url.split('?')[0];
  const ext = urlWithoutQuery.substring(urlWithoutQuery.lastIndexOf('.')).toLowerCase();
  return ext;
};

const updateHotspotsPosition = () => {
  if (!props.hotspots || !camera || !container.value) return;

  hotspotsWithScreenPos.value = props.hotspots.map((h, i) => {
    const vector = new Vector3(h.x, h.y, h.z);
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * container.value!.clientWidth;
    const y = (-(vector.y * 0.5) + 0.5) * container.value!.clientHeight;

    const isVisible = vector.z < 1 && Math.abs(vector.x) < 1.1 && Math.abs(vector.y) < 1.1;

    return { ...h, screenX: x, screenY: y, isVisible, index: i };
  });
};

const updateSceneConfig = async () => {
  if (!scene || !renderer) return;

  const config = props.sceneConfig || {};

  // Exposure
  renderer.toneMappingExposure = config.exposure !== undefined ? config.exposure : 1.0;

  // Lights
  if (ambientLight) {
    ambientLight.intensity = (config.lights?.intensity || 1.0) * 0.5;
    if (config.lights?.color) ambientLight.color.set(config.lights.color);
  }
  if (directionalLight) {
    directionalLight.intensity = (config.lights?.intensity || 1.0) * 1.5;
    if (config.lights?.color) directionalLight.color.set(config.lights.color);
  }

  // Environment
  if (config.environment && envMaps[config.environment]) {
    const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js');
    new HDRLoader().load(envMaps[config.environment], (texture) => {
      texture.mapping = EquirectangularReflectionMapping;
      scene.environment = texture;
    });
  }
};

const flyTo = (
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
) => {
  if (!camera || !controls) return;

  controls.enabled = false;

  gsap.to(camera.position, {
    x: position.x,
    y: position.y,
    z: position.z,
    duration: 1.5,
    ease: 'power2.inOut',
    onUpdate: () => camera.lookAt(controls.target),
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

const getCameraState = () => {
  if (!camera || !controls) return null;
  return {
    position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
  };
};

const handleHotspotClick = (index: number) => {
  const h = props.hotspots![index];
  activeHotspot.value = activeHotspot.value === index ? null : index;

  if (activeHotspot.value === index && h.cameraPos && h.cameraTarget) {
    flyTo(h.cameraPos, h.cameraTarget);
  }
};

const handleCanvasClick = (event: MouseEvent) => {
  if (!props.editable || !container.value || !loadedModel) return;

  const rect = container.value.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / container.value.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / container.value.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(loadedModel, true);

  if (intersects.length > 0) {
    const point = intersects[0].point;
    emit('hotspot-added', { x: point.x, y: point.y, z: point.z });
  }
};

const initScene = async () => {
  if (!container.value || hasInitialized.value || isInitializing) return;
  isInitializing = true;

  try {
    scene = new Scene();
    scene.background = new Color(0x0f172a);

    const width = container.value.clientWidth;
    const height = container.value.clientHeight;
    camera = new PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);

    renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    container.value.appendChild(renderer.domElement);

    ambientLight = new AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    directionalLight = new DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    fillLight = new DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    await updateSceneConfig(); // Apply initial config

    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = !!props.autoRotate;

    if (props.modelUrl) {
      void loadModel(props.modelUrl);
    } else {
      addPlaceholder();
    }

    hasInitialized.value = true;
    if (isViewerVisible || !intersectionObserver) startRenderLoop();
  } finally {
    isInitializing = false;
  }
};

const addPlaceholder = () => {
  const geometry = new TorusKnotGeometry(1, 0.4, 100, 16);
  const material = new MeshStandardMaterial({
    color: 0x3b82f6,
    roughness: 0.1,
    metalness: 0.8,
  });
  const mesh = new Mesh(geometry, material);
  scene.add(mesh);
  loadedModel = mesh;
  calculateStats(mesh);
};

const centerAndScaleModel = (object: Object3D) => {
  // Explicitly update all world matrices first to avoid stale/NaN transform bounds
  object.updateWorldMatrix(true, true);

  const box = new Box3().setFromObject(object);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = maxDim > 0.0001 ? 3 / maxDim : 1;
  object.scale.setScalar(scale);

  // Re-update world matrices with the new scale and center the model
  object.updateWorldMatrix(true, true);
  const newBox = new Box3().setFromObject(object);
  newBox.getCenter(center);
  object.position.sub(center);
};

const optimizeTexturesForGPULimit = (object: Object3D) => {
  if (!renderer) return;
  const maxTextures = renderer.capabilities.maxTextures || 16;
  // Reserve 3 slots for environment mapping, shadow maps, etc.
  const maxAllowed = Math.max(8, maxTextures - 3);

  object.traverse((child) => {
    if (child instanceof Mesh) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!material) return;

        const textureSlots = [
          'map',
          'normalMap',
          'roughnessMap',
          'metalnessMap',
          'emissiveMap',
          'specularMap',
          'aoMap',
          'bumpMap',
          'alphaMap',
          'displacementMap',
          'lightMap'
        ];

        let activeSlots = textureSlots.filter(slot => material[slot] && material[slot] instanceof Texture);

        if (activeSlots.length > maxAllowed) {
          console.warn(`Mesh "${child.name}" material textures (${activeSlots.length}) exceed GPU limit (${maxAllowed}). Optimizing...`);
          
          const slotsToPrune = [
            'lightMap',
            'displacementMap',
            'alphaMap',
            'bumpMap',
            'aoMap',
            'specularMap',
            'emissiveMap'
          ];

          for (const slot of slotsToPrune) {
            if (material[slot]) {
              material[slot] = null;
              activeSlots = textureSlots.filter(s => material[s] && material[s] instanceof Texture);
              if (activeSlots.length <= maxAllowed) break;
            }
          }
          material.needsUpdate = true;
        }
      });
    }
  });
};

const disposeMaterial = (material: Material) => {
  if (material === clayMaterial) return;
  material.dispose();
  const textureSlots = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'emissiveMap',
    'specularMap',
    'aoMap',
    'bumpMap',
    'alphaMap',
    'displacementMap',
    'lightMap'
  ];
  for (const slot of textureSlots) {
    const value = (material as unknown as Record<string, unknown>)[slot];
    if (value instanceof Texture) {
      value.dispose();
    }
  }
};

const disposeHierarchy = (obj: Object3D) => {
  obj.traverse((child) => {
    if (child instanceof Mesh) {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => disposeMaterial(m));
        } else {
          disposeMaterial(child.material);
        }
      }
    }
  });
};

const onModelLoaded = (object: Object3D, animCount: number = 0) => {
  loadedModel = object;
  optimizeTexturesForGPULimit(loadedModel);
  scene.add(loadedModel);
  centerAndScaleModel(loadedModel);
  calculateStats(loadedModel, animCount);
  isLoading.value = false;

  applyViewMode();

  setTimeout(() => {
    const dataURL = takeScreenshot(false);
    if (dataURL) emit('screenshot-captured', dataURL);
  }, 800);
};

const loadModel = async (url: string) => {
  // Reset Clay Mode
  isClayMode.value = false;

  if (loadedModel) {
    // If clay mode was active, original materials are in the map, so dispose them
    originalMaterials.forEach((material) => {
      if (Array.isArray(material)) {
        material.forEach((m) => disposeMaterial(m));
      } else {
        disposeMaterial(material);
      }
    });
    originalMaterials.clear();

    disposeHierarchy(loadedModel);
    scene.remove(loadedModel);
    loadedModel = null;
    if (wireframeOverlay) {
      disposeHierarchy(wireframeOverlay);
      scene.remove(wireframeOverlay);
      wireframeOverlay = null;
    }
    if (mixer) {
      mixer.stopAllAction();
      mixer = null;
    }
  }

  isLoading.value = true;
  loadingProgress.value = 0;
  error.value = null;
  animations.value = [];
  currentAnimation.value = -1;

  const ext = getModelExtension(url);
  modelFormat.value = ext.replace('.', '').toUpperCase();

  const onProgress = (event: ProgressEvent) => {
    if (event.lengthComputable) {
      loadingProgress.value = Math.round((event.loaded / event.total) * 100);
    }
  };

  const onError = (err: unknown) => {
    console.error('Error loading model:', err);
    error.value = `无法加载 ${ext.toUpperCase()} 模型`;
    isLoading.value = false;
    addPlaceholder();
  };

  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    // Detect relative texture requests that are bound to 404
    const isImage = /\.(png|jpg|jpeg|tga|dds|gif|bmp|webp|tiff)$/i.test(url);
    const isAssetPath = url.includes('/uploads/') || url.includes('/assets/');
    const isRenamedAsset = url.includes('asset-');

    if (isImage && isAssetPath && !isRenamedAsset) {
      if (import.meta.env.DEV) {
        console.warn(`Intercepted missing texture request to prevent 404: ${url}`);
      }
      // Return 1x1 transparent PNG data URL
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    }
    return url;
  });

  switch (ext) {
    case '.glb':
    case '.gltf': {
      const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/loaders/DRACOLoader.js'),
      ]);
      const loader = new GLTFLoader(manager);
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(dracoLoader);
      loader.load(
        url,
        (gltf) => {
          let animCount = 0;
          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new AnimationMixer(gltf.scene);
            animations.value = gltf.animations.map(
              (a) => a.name || `Animation ${animations.value.length + 1}`,
            );
            currentActions = gltf.animations.map((clip) => mixer!.clipAction(clip));
            animCount = gltf.animations.length;
            playAnimation(0);
          }
          onModelLoaded(gltf.scene, animCount);
        },
        onProgress,
        onError,
      );
      break;
    }
    case '.fbx': {
      const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
      const loader = new FBXLoader(manager);
      loader.load(
        url,
        (fbx) => {
          let animCount = 0;
          if (fbx.animations && fbx.animations.length > 0) {
            mixer = new AnimationMixer(fbx);
            animations.value = fbx.animations.map((a, i) => a.name || `Animation ${i + 1}`);
            currentActions = fbx.animations.map((clip) => mixer!.clipAction(clip));
            animCount = fbx.animations.length;
            playAnimation(0);
          }
          onModelLoaded(fbx, animCount);
        },
        onProgress,
        onError,
      );
      break;
    }
    case '.obj': {
      const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
      const loader = new OBJLoader(manager);
      loader.load(
        url,
        (obj) => {
          onModelLoaded(obj);
        },
        onProgress,
        onError,
      );
      break;
    }
    case '.stl': {
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const loader = new STLLoader(manager);
      loader.load(
        url,
        (geometry) => {
          const material = new MeshStandardMaterial({ color: 0xcccccc });
          const mesh = new Mesh(geometry, material);
          onModelLoaded(mesh);
        },
        onProgress,
        onError,
      );
      break;
    }
    default: {
      error.value = `不支持的模型格式: ${ext}`;
      isLoading.value = false;
      addPlaceholder();
    }
  }
};

const applyViewMode = () => {
  if (wireframeOverlay) {
    scene.remove(wireframeOverlay);
    wireframeOverlay = null;
  }
  if (!loadedModel) return;
  loadedModel.traverse((child) => {
    if (child instanceof Mesh) {
      child.material.wireframe = viewMode.value === 'wireframe';
    }
  });
};

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode;
  applyViewMode();
};

const applyClayMode = () => {
  if (!loadedModel) return;
  loadedModel.traverse((child) => {
    if (child instanceof Mesh) {
      if (isClayMode.value) {
        // Backup original material
        if (!originalMaterials.has(child.uuid)) {
          originalMaterials.set(child.uuid, child.material);
        }
        child.material = clayMaterial;
      } else {
        // Restore original material
        const orig = originalMaterials.get(child.uuid);
        if (orig) {
          child.material = orig;
        }
      }
    }
  });
};

const toggleClayMode = () => {
  isClayMode.value = !isClayMode.value;
  applyClayMode();
};

const calculateStats = (model: Object3D, animCount: number = 0) => {
  let vCount = 0;
  let fCount = 0;
  model.traverse((child) => {
    if (child instanceof Mesh) {
      vCount += child.geometry.attributes.position.count;
      fCount += child.geometry.index
        ? child.geometry.index.count / 3
        : child.geometry.attributes.position.count / 3;
    }
  });
  stats.value = {
    vertices: vCount,
    faces: Math.round(fCount),
    materials: 0,
    animations: animCount,
    dimensions: '',
  };
  emit('metadata-loaded', stats.value);
};

const playAnimation = (index: number) => {
  if (!mixer || index < 0 || index >= currentActions.length) return;
  if (currentAnimation.value !== -1) currentActions[currentAnimation.value].fadeOut(0.5);
  const action = currentActions[index];
  action.reset().fadeIn(0.5).play();
  currentAnimation.value = index;
};

const togglePause = () => {
  if (!mixer || currentAnimation.value === -1) return;
  isPaused.value = !isPaused.value;
  currentActions[currentAnimation.value].paused = isPaused.value;
};

const takeScreenshot = (download = true) => {
  if (!renderer) return null;
  const dataURL = renderer.domElement.toDataURL('image/png');
  if (download) {
    const link = document.createElement('a');
    link.download = 'screenshot.png';
    link.href = dataURL;
    link.click();
  }
  return dataURL;
};

const toggleFullscreen = () => {
  if (!container.value) return;
  if (!document.fullscreenElement) container.value.requestFullscreen();
  else document.exitFullscreen();
};

const resetCamera = () => {
  if (!camera || !controls) return;
  camera.position.set(5, 5, 5);
  controls.target.set(0, 0, 0);
  controls.update();
};

const animate = () => {
  if (!renderLoopActive) return;
  animationId = requestAnimationFrame(animate);
  const time = performance.now();
  const delta = (time - lastTime) / 1000;
  lastTime = time;
  if (mixer) mixer.update(delta);
  controls.update();
  updateHotspotsPosition();
  renderer.render(scene, camera);
};

const startRenderLoop = () => {
  if (renderLoopActive || !renderer || !scene || !camera) return;
  renderLoopActive = true;
  lastTime = performance.now();
  animationId = requestAnimationFrame(animate);
};

const stopRenderLoop = () => {
  renderLoopActive = false;
  if (animationId) cancelAnimationFrame(animationId);
};

const handleResize = () => {
  if (!container.value || !camera || !renderer) return;
  camera.aspect = container.value.clientWidth / container.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
};

onMounted(() => {
  if ('IntersectionObserver' in window && container.value) {
    intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isViewerVisible = entry.isIntersecting;
        if (entry.isIntersecting) {
          void initScene().then(() => {
            if (isViewerVisible) startRenderLoop();
          });
        } else {
          stopRenderLoop();
        }
      },
      { rootMargin: '160px' },
    );
    intersectionObserver.observe(container.value);
  } else {
    isViewerVisible = true;
    void initScene();
  }
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  isViewerVisible = false;
  intersectionObserver?.disconnect();
  intersectionObserver = null;
  stopRenderLoop();
  if (loadedModel) {
    // If clay mode was active, original materials are in the map, so dispose them
    originalMaterials.forEach((material) => {
      if (Array.isArray(material)) {
        material.forEach((m) => disposeMaterial(m));
      } else {
        disposeMaterial(material);
      }
    });
    originalMaterials.clear();

    disposeHierarchy(loadedModel);
    loadedModel = null;
  }
  if (wireframeOverlay) {
    disposeHierarchy(wireframeOverlay);
    wireframeOverlay = null;
  }
  if (controls) {
    controls.dispose();
  }
  if (scene) {
    scene.clear();
  }
  if (renderer) {
    if (container.value && renderer.domElement && container.value.contains(renderer.domElement)) {
      container.value.removeChild(renderer.domElement);
    }
    renderer.dispose();
    renderer.forceContextLoss();
  }
});

watch(
  () => props.modelUrl,
  (newUrl) => {
    if (newUrl && hasInitialized.value) void loadModel(newUrl);
  },
);
watch(
  () => props.autoRotate,
  (val) => {
    if (controls) controls.autoRotate = !!val;
  },
);
watch(
  () => props.sceneConfig,
  () => {
    if (hasInitialized.value) void updateSceneConfig();
  },
  { deep: true },
);

defineExpose({ getCameraState, flyTo, isFullscreen, handleCanvasClick, setViewMode, togglePause, isClayMode, toggleClayMode });
</script>

<template>
  <div ref="container" class="w-full h-full cursor-move relative overflow-hidden group">
    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm z-10"
    >
      <div class="flex flex-col items-center gap-4 p-6 glass-card border border-white/15 max-w-xs text-center">
        <div class="relative w-16 h-16">
          <!-- Outer glowing spinning circle -->
          <div class="absolute inset-0 border-4 border-t-accent border-r-transparent border-b-indigo-500 border-l-transparent rounded-full animate-spin"></div>
          <!-- Inner pulsing circle -->
          <div class="absolute inset-2 bg-gradient-to-tr from-accent to-indigo-600 rounded-full animate-pulse opacity-90 flex items-center justify-center text-white">
            <span class="text-[10px] font-bold">{{ Math.round(loadingProgress) }}%</span>
          </div>
        </div>
        <div>
          <p class="text-xs font-black tracking-wider text-white uppercase">Engine Loading</p>
          <p class="text-[10px] text-slate-400 mt-1">正在解析 {{ modelFormat || '3D' }} 资产数据...</p>
        </div>
      </div>
    </div>

    <!-- Hotspots -->
    <template v-for="(h, i) in hotspotsWithScreenPos" :key="i">
      <div
        v-if="h.isVisible"
        class="absolute z-30 transition-transform duration-200 pointer-events-none"
        :style="{ transform: `translate(${h.screenX}px, ${h.screenY}px)` }"
      >
        <div class="relative -translate-x-1/2 -translate-y-1/2">
          <button type="button" class="w-6 h-6 bg-accent border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform pointer-events-auto group/dot" @click.stop="handleHotspotClick(i)">
            <span class="text-[10px] font-bold">{{ i + 1 }}</span>
            <div
              class="absolute inset-0 rounded-full bg-accent animate-ping opacity-25 group-hover:opacity-55"
            ></div>
          </button>
          <Transition name="fade">
            <div
              v-if="activeHotspot === i"
              class="absolute bottom-8 left-0 -translate-x-1/2 w-52 glass-card p-3.5 text-white shadow-2xl pointer-events-auto border border-white/20 dark:border-white/10"
              style="background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px);"
            >
              <h4 class="text-xs font-bold text-accent mb-1 flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
                {{ h.title }}
              </h4>
              <p class="text-[10px] text-slate-300 leading-relaxed font-medium">{{ h.content }}</p>
            </div>
          </Transition>
        </div>
      </div>
    </template>

    <!-- Toolbar -->
    <div
      class="absolute right-4 top-4 flex flex-col gap-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
    >
      <button type="button" class="w-9 h-9 flex items-center justify-center bg-slate-950/70 hover:bg-accent border border-white/10 rounded-xl text-white shadow-lg transition-all active:scale-95 cursor-pointer backdrop-blur-md" title="模型信息" @click="showStats = !showStats">
        <Info class="w-4.5 h-4.5" />
      </button>
      <button type="button" class="w-9 h-9 flex items-center justify-center bg-slate-950/70 hover:bg-accent border border-white/10 rounded-xl text-white shadow-lg transition-all active:scale-95 cursor-pointer backdrop-blur-md" title="重置视角" @click="resetCamera">
        <RefreshCw class="w-4.5 h-4.5" />
      </button>
      <button type="button" class="w-9 h-9 flex items-center justify-center bg-slate-950/70 hover:bg-accent border border-white/10 rounded-xl text-white shadow-lg transition-all active:scale-95 cursor-pointer backdrop-blur-md" @click="toggleFullscreen">
        <Layers class="w-4.5 h-4.5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
canvas {
  display: block;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
