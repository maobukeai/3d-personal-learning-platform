<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

type ViewMode = 'solid' | 'wireframe' | 'solid+wireframe';

const props = defineProps<{
  modelUrl?: string;
  autoRotate?: boolean;
  showControls?: boolean;
  assetId?: string;
  hotspots?: Array<{
    x: number;
    y: number;
    z: number;
    title: string;
    content: string;
    cameraPos?: { x: number; y: number; z: number };
    cameraTarget?: { x: number; y: number; z: number };
  }>;
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
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/venice_sunset_1k.hdr',
  studio:
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/royal_esplanade_1k.hdr',
  forest:
    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/pedestrian_overpass_1k.hdr',
  room: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/quarry_01_1k.hdr',
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
const stats = ref({
  vertices: 0,
  faces: 0,
  materials: 0,
  animations: 0,
  dimensions: '',
});

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let animationId: number;
let mixer: THREE.AnimationMixer | null = null;
let lastTime = 0;
let loadedModel: THREE.Object3D | null = null;
let wireframeOverlay: THREE.Object3D | null = null;
let currentActions: THREE.AnimationAction[] = [];
let ambientLight: THREE.AmbientLight;
let directionalLight: THREE.DirectionalLight;
let fillLight: THREE.DirectionalLight;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const hotspotsWithScreenPos = ref<any[]>([]);

const getModelExtension = (url: string): string => {
  const urlWithoutQuery = url.split('?')[0];
  const ext = urlWithoutQuery.substring(urlWithoutQuery.lastIndexOf('.')).toLowerCase();
  return ext;
};

const updateHotspotsPosition = () => {
  if (!props.hotspots || !camera || !container.value) return;

  hotspotsWithScreenPos.value = props.hotspots.map((h, i) => {
    const vector = new THREE.Vector3(h.x, h.y, h.z);
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * container.value!.clientWidth;
    const y = (-(vector.y * 0.5) + 0.5) * container.value!.clientHeight;

    const isVisible = vector.z < 1 && Math.abs(vector.x) < 1.1 && Math.abs(vector.y) < 1.1;

    return { ...h, screenX: x, screenY: y, isVisible, index: i };
  });
};

const updateSceneConfig = () => {
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
    new RGBELoader().load(envMaps[config.environment], (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
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

const initScene = () => {
  if (!container.value) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);

  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(5, 5, 5);

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  container.value.appendChild(renderer.domElement);

  ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
  fillLight.position.set(-5, 5, -5);
  scene.add(fillLight);

  updateSceneConfig(); // Apply initial config

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = !!props.autoRotate;

  if (props.modelUrl) {
    loadModel(props.modelUrl);
  } else {
    addPlaceholder();
  }

  lastTime = performance.now();
  animate();
};

const addPlaceholder = () => {
  const geometry = new THREE.TorusKnotGeometry(1, 0.4, 100, 16);
  const material = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    roughness: 0.1,
    metalness: 0.8,
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  loadedModel = mesh;
  calculateStats(mesh);
};

const centerAndScaleModel = (object: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 3 / maxDim;
  object.scale.setScalar(scale);

  box.setFromObject(object);
  box.getCenter(center);
  object.position.sub(center);
};

const onModelLoaded = (object: THREE.Object3D, animCount: number = 0) => {
  loadedModel = object;
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

const loadModel = (url: string) => {
  if (loadedModel) {
    scene.remove(loadedModel);
    if (wireframeOverlay) {
      scene.remove(wireframeOverlay);
      wireframeOverlay = null;
    }
    if (mixer) mixer.stopAllAction();
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

  const onError = (err: any) => {
    console.error('Error loading model:', err);
    error.value = `无法加载 ${ext.toUpperCase()} 模型`;
    isLoading.value = false;
    addPlaceholder();
  };

  switch (ext) {
    case '.glb':
    case '.gltf': {
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(dracoLoader);
      loader.load(
        url,
        (gltf) => {
          let animCount = 0;
          if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(gltf.scene);
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
      const loader = new FBXLoader();
      loader.load(
        url,
        (fbx) => {
          let animCount = 0;
          if (fbx.animations && fbx.animations.length > 0) {
            mixer = new THREE.AnimationMixer(fbx);
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
      const loader = new OBJLoader();
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
      const loader = new STLLoader();
      loader.load(
        url,
        (geometry) => {
          const material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
          const mesh = new THREE.Mesh(geometry, material);
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
    if (child instanceof THREE.Mesh) {
      child.material.wireframe = viewMode.value === 'wireframe';
    }
  });
};

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode;
  applyViewMode();
};

const calculateStats = (model: THREE.Object3D, animCount: number = 0) => {
  let vCount = 0;
  let fCount = 0;
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
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
  animationId = requestAnimationFrame(animate);
  const time = performance.now();
  const delta = (time - lastTime) / 1000;
  lastTime = time;
  if (mixer) mixer.update(delta);
  controls.update();
  updateHotspotsPosition();
  renderer.render(scene, camera);
};

const handleResize = () => {
  if (!container.value || !camera || !renderer) return;
  camera.aspect = container.value.clientWidth / container.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
};

onMounted(() => {
  initScene();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  cancelAnimationFrame(animationId);
  if (renderer) renderer.dispose();
});

watch(
  () => props.modelUrl,
  (newUrl) => {
    if (newUrl) loadModel(newUrl);
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
    updateSceneConfig();
  },
  { deep: true },
);

defineExpose({ getCameraState, flyTo, isFullscreen, handleCanvasClick, setViewMode, togglePause });
</script>

<template>
  <div ref="container" class="w-full h-full cursor-move relative overflow-hidden group">
    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"
        ></div>
        <p class="text-sm font-bold text-white">正在解析 {{ modelFormat }} 模型...</p>
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
          <button
            class="w-6 h-6 bg-accent border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform pointer-events-auto group/dot"
            @click.stop="handleHotspotClick(i)"
          >
            <span class="text-[10px] font-bold">{{ i + 1 }}</span>
            <div
              class="absolute inset-0 rounded-full bg-accent animate-ping opacity-20 group-hover:opacity-40"
            ></div>
          </button>
          <Transition name="fade">
            <div
              v-if="activeHotspot === i"
              class="absolute bottom-8 left-0 -translate-x-1/2 w-48 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl p-3 text-white shadow-2xl pointer-events-auto"
            >
              <h4 class="text-xs font-bold mb-1">{{ h.title }}</h4>
              <p class="text-[10px] text-slate-400 leading-relaxed">{{ h.content }}</p>
            </div>
          </Transition>
        </div>
      </div>
    </template>

    <!-- Toolbar -->
    <div
      class="absolute right-4 top-4 flex flex-col gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <button
        class="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-accent transition-colors"
        title="模型信息"
        @click="showStats = !showStats"
      >
        <Info class="w-5 h-5" />
      </button>
      <button
        class="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-accent transition-colors"
        title="重置视角"
        @click="resetCamera"
      >
        <RefreshCw class="w-5 h-5" />
      </button>
      <button
        class="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-accent transition-colors"
        @click="toggleFullscreen"
      >
        <Layers class="w-5 h-5" />
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
