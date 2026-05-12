<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

const props = defineProps<{
  modelUrl?: string
  autoRotate?: boolean
  showControls?: boolean
  assetId?: string // Optional: to save metadata back to server
  hotspots?: Array<{ x: number, y: number, z: number, title: string, content: string }>
  editable?: boolean
}>()

const emit = defineEmits(['metadata-loaded', 'screenshot-captured', 'hotspot-added'])

const container = ref<HTMLElement | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

// UI State
const animations = ref<string[]>([])
const currentAnimation = ref<number>(-1)
const isPaused = ref(false)
const isWireframe = ref(false)
const showStats = ref(false)
const activeHotspot = ref<number | null>(null)
const stats = ref({
  vertices: 0,
  faces: 0,
  materials: 0,
  animations: 0,
  dimensions: ''
})

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationId: number
let mixer: THREE.AnimationMixer | null = null
let lastTime = 0
let loadedModel: THREE.Object3D | null = null
let currentActions: THREE.AnimationAction[] = []
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

const hotspotsWithScreenPos = ref<any[]>([])

const updateHotspotsPosition = () => {
  if (!props.hotspots || !camera || !container.value) return
  
  hotspotsWithScreenPos.value = props.hotspots.map((h, i) => {
    const vector = new THREE.Vector3(h.x, h.y, h.z)
    vector.project(camera)

    const x = (vector.x * 0.5 + 0.5) * container.value!.clientWidth
    const y = (-(vector.y * 0.5) + 0.5) * container.value!.clientHeight
    
    // Check if hotspot is behind the camera or out of view
    const isVisible = vector.z < 1 && Math.abs(vector.x) < 1.1 && Math.abs(vector.y) < 1.1

    return { ...h, screenX: x, screenY: y, isVisible, index: i }
  })
}

const handleCanvasClick = (event: MouseEvent) => {
  if (!props.editable || !container.value || !loadedModel) return

  const rect = container.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / container.value.clientWidth) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / container.value.clientHeight) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObject(loadedModel, true)

  if (intersects.length > 0) {
    const point = intersects[0].point
    emit('hotspot-added', { x: point.x, y: point.y, z: point.z })
  }
}

const initScene = () => {
  if (!container.value) return

  // Scene setup
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0f172a) // slate-900 for better contrast

  // Camera setup
  const width = container.value.clientWidth
  const height = container.value.clientHeight
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.set(5, 5, 5)

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    preserveDrawingBuffer: true // Required for screenshots
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  container.value.appendChild(renderer.domElement)

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
  directionalLight.position.set(5, 10, 7.5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  // Load HDR Environment
  new RGBELoader()
    .load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/venice_sunset_1k.hdr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.environment = texture
    }, undefined, (err) => {
      console.warn('HDR Environment failed to load, using default lighting.')
    })

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.autoRotate = !!props.autoRotate

  if (props.modelUrl) {
    loadModel(props.modelUrl)
  } else {
    addPlaceholder()
  }

  lastTime = performance.now()
  animate()
}

const addPlaceholder = () => {
  const geometry = new THREE.TorusKnotGeometry(1, 0.4, 100, 16)
  const material = new THREE.MeshStandardMaterial({ 
    color: 0x3b82f6,
    roughness: 0.1,
    metalness: 0.8 
  })
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)
  loadedModel = mesh
  calculateStats(mesh)
}

const loadModel = (url: string) => {
  if (loadedModel) {
    scene.remove(loadedModel)
    if (mixer) mixer.stopAllAction()
  }

  isLoading.value = true
  error.value = null
  animations.value = []
  currentAnimation.value = -1

  const loader = new GLTFLoader()
  loader.load(
    url,
    (gltf) => {
      loadedModel = gltf.scene
      scene.add(loadedModel)

      // Animation Setup
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(loadedModel)
        animations.value = gltf.animations.map(a => a.name || `Animation ${animations.value.length + 1}`)
        currentActions = gltf.animations.map(clip => mixer!.clipAction(clip))
        
        // Play first animation by default
        playAnimation(0)
      }

      // Center and scale model
      const box = new THREE.Box3().setFromObject(loadedModel)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())

      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 3 / maxDim
      loadedModel.scale.setScalar(scale)
      
      // Update center after scaling
      box.setFromObject(loadedModel)
      box.getCenter(center)
      loadedModel.position.sub(center)

      calculateStats(loadedModel, gltf.animations.length)
      isLoading.value = false

      // Capture initial screenshot for thumbnail after a short delay to ensure rendering
      setTimeout(() => {
        const dataURL = takeScreenshot(false)
        if (dataURL) emit('screenshot-captured', dataURL)
      }, 800)
    },
    undefined,
    (err) => {
      console.error('Error loading model:', err)
      error.value = '无法加载 3D 模型'
      isLoading.value = false
      addPlaceholder()
    }
  )
}

const calculateStats = (model: THREE.Object3D, animCount: number = 0) => {
  let vCount = 0
  let fCount = 0
  let mCount = new Set()

  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const geometry = child.geometry
      vCount += geometry.attributes.position.count
      if (geometry.index) {
        fCount += geometry.index.count / 3
      } else {
        fCount += geometry.attributes.position.count / 3
      }
      
      if (Array.isArray(child.material)) {
        child.material.forEach(m => mCount.add(m.uuid))
      } else {
        mCount.add(child.material.uuid)
      }
    }
  })

  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const dimStr = `${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`

  stats.value = {
    vertices: vCount,
    faces: Math.round(fCount),
    materials: mCount.size,
    animations: animCount,
    dimensions: dimStr
  }

  emit('metadata-loaded', { ...stats.value })
}

const playAnimation = (index: number) => {
  if (!mixer || index < 0 || index >= currentActions.length) return
  
  if (currentAnimation.value !== -1) {
    currentActions[currentAnimation.value].fadeOut(0.5)
  }
  
  const action = currentActions[index]
  action.reset().fadeIn(0.5).play()
  currentAnimation.value = index
  isPaused.value = false
}

const togglePause = () => {
  if (!mixer || currentAnimation.value === -1) return
  isPaused.value = !isPaused.value
  currentActions[currentAnimation.value].paused = isPaused.value
}

const toggleWireframe = () => {
  isWireframe.value = !isWireframe.value
  if (loadedModel) {
    loadedModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.wireframe = isWireframe.value)
        } else {
          child.material.wireframe = isWireframe.value
        }
      }
    })
  }
}

const takeScreenshot = (download = true) => {
  if (!renderer) return null
  const dataURL = renderer.domElement.toDataURL('image/png')
  if (download) {
    const link = document.createElement('a')
    link.download = `screenshot-${new Date().getTime()}.png`
    link.href = dataURL
    link.click()
  }
  return dataURL
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  const time = performance.now()
  const delta = (time - lastTime) / 1000
  lastTime = time

  if (mixer) mixer.update(delta)
  controls.update()
  updateHotspotsPosition()
  renderer.render(scene, camera)
}

const handleResize = () => {
  if (!container.value || !camera || !renderer) return
  const width = container.value.clientWidth
  const height = container.value.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

onMounted(() => {
  initScene()
  window.addEventListener('resize', handleResize)
  container.value?.addEventListener('click', handleCanvasClick)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  container.value?.removeEventListener('click', handleCanvasClick)
  cancelAnimationFrame(animationId)
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
  }
})

watch(() => props.modelUrl, (newUrl) => {
  if (newUrl) loadModel(newUrl)
})

watch(() => props.autoRotate, (val) => {
  if (controls) controls.autoRotate = !!val
})
</script>

<template>
  <div ref="container" class="w-full h-full cursor-move relative overflow-hidden group">
    <!-- Loading/Error States -->
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10">
      <div class="flex flex-col items-center gap-3">
        <div class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm font-bold text-white">正在解析 3D 资产...</p>
      </div>
    </div>
    
    <div v-if="error" class="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10">
      <p class="text-sm font-bold text-red-400">{{ error }}</p>
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
            @click.stop="activeHotspot = activeHotspot === i ? null : i"
            class="w-6 h-6 bg-accent border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform pointer-events-auto group/dot"
          >
            <span class="text-[10px] font-bold">{{ i + 1 }}</span>
            <div class="absolute inset-0 rounded-full bg-accent animate-ping opacity-20 group-hover:opacity-40"></div>
          </button>

          <!-- Hotspot Content Card -->
          <Transition name="fade">
            <div v-if="activeHotspot === i" class="absolute bottom-8 left-0 -translate-x-1/2 w-48 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl p-3 text-white shadow-2xl pointer-events-auto">
              <h4 class="text-xs font-bold mb-1">{{ h.title }}</h4>
              <p class="text-[10px] text-slate-400 leading-relaxed">{{ h.content }}</p>
              <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 border-r border-b border-white/10 rotate-45"></div>
            </div>
          </Transition>
        </div>
      </div>
    </template>

    <!-- Editable Mode Indicator -->
    <div v-if="editable" class="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-accent/90 backdrop-blur rounded-full border border-white/20 text-white text-[10px] font-bold z-40 animate-pulse pointer-events-none">
      标注编辑模式：点击模型添加热点
    </div>

    <!-- Stats Overlay -->
    <div v-if="showStats" class="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-4 z-20 text-white w-48 shadow-2xl">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400">模型信息</h3>
        <button @click="showStats = false" class="text-slate-400 hover:text-white">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <div class="space-y-2 text-[11px]">
        <div class="flex justify-between"><span class="text-slate-500">顶点</span><span class="font-mono">{{ stats.vertices.toLocaleString() }}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">面数</span><span class="font-mono">{{ stats.faces.toLocaleString() }}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">材质</span><span class="font-mono">{{ stats.materials }}</span></div>
        <div class="flex justify-between"><span class="text-slate-500">动画</span><span class="font-mono">{{ stats.animations }}</span></div>
        <div class="mt-2 pt-2 border-t border-white/5">
          <span class="text-slate-500 block mb-1">尺寸 (单位)</span>
          <span class="font-mono text-[10px] break-all">{{ stats.dimensions }}</span>
        </div>
      </div>
    </div>

    <!-- Animation Controls -->
    <div v-if="animations.length > 0" class="absolute bottom-4 left-4 right-4 md:right-auto md:w-64 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-3 z-20 text-white shadow-2xl">
      <div class="flex items-center gap-3 mb-2">
        <button @click="togglePause" class="p-2 bg-accent rounded-lg hover:scale-105 transition-transform">
          <svg v-if="!isPaused" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
          <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
        </button>
        <span class="text-xs font-bold truncate">{{ animations[currentAnimation] }}</span>
      </div>
      <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
        <button 
          v-for="(name, index) in animations" 
          :key="index"
          @click="playAnimation(index)"
          class="px-2 py-1 text-[10px] rounded-md transition-colors"
          :class="currentAnimation === index ? 'bg-accent text-white' : 'bg-white/5 hover:bg-white/10 text-slate-400'"
        >
          {{ name }}
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="absolute right-4 top-4 flex flex-col gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
      <button @click="showStats = !showStats" class="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-accent transition-colors" title="模型信息">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      </button>
      <button @click="toggleWireframe" :class="['p-2 backdrop-blur-md border border-white/10 rounded-lg transition-colors', isWireframe ? 'bg-accent text-white' : 'bg-slate-900/80 text-white hover:bg-white/10']" title="线框模式">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
      </button>
      <button @click="takeScreenshot(true)" class="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-accent transition-colors" title="截图">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
canvas {
  display: block;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>