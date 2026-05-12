<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

type ViewMode = 'solid' | 'wireframe' | 'solid+wireframe'

const props = defineProps<{
  modelUrl?: string
  autoRotate?: boolean
  showControls?: boolean
  assetId?: string
  hotspots?: Array<{ x: number, y: number, z: number, title: string, content: string }>
  editable?: boolean
}>()

const emit = defineEmits(['metadata-loaded', 'screenshot-captured', 'hotspot-added'])

const container = ref<HTMLElement | null>(null)
const isLoading = ref(false)
const loadingProgress = ref(0)
const error = ref<string | null>(null)
const modelFormat = ref<string>('')

const animations = ref<string[]>([])
const currentAnimation = ref<number>(-1)
const isPaused = ref(false)
const viewMode = ref<ViewMode>('solid')
const showStats = ref(false)
const activeHotspot = ref<number | null>(null)
const isFullscreen = ref(false)
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
let wireframeOverlay: THREE.Object3D | null = null
let currentActions: THREE.AnimationAction[] = []
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

const hotspotsWithScreenPos = ref<any[]>([])

const getModelExtension = (url: string): string => {
  const urlWithoutQuery = url.split('?')[0]
  const ext = urlWithoutQuery.substring(urlWithoutQuery.lastIndexOf('.')).toLowerCase()
  return ext
}

const updateHotspotsPosition = () => {
  if (!props.hotspots || !camera || !container.value) return

  hotspotsWithScreenPos.value = props.hotspots.map((h, i) => {
    const vector = new THREE.Vector3(h.x, h.y, h.z)
    vector.project(camera)

    const x = (vector.x * 0.5 + 0.5) * container.value!.clientWidth
    const y = (-(vector.y * 0.5) + 0.5) * container.value!.clientHeight

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

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x0f172a)

  const width = container.value.clientWidth
  const height = container.value.clientHeight
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.set(5, 5, 5)

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.shadowMap.enabled = true
  container.value.appendChild(renderer.domElement)

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
  directionalLight.position.set(5, 10, 7.5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.4)
  fillLight.position.set(-5, 5, -5)
  scene.add(fillLight)

  new RGBELoader()
    .load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/equirectangular/venice_sunset_1k.hdr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.environment = texture
    }, undefined, () => {
      console.warn('HDR Environment failed to load, using default lighting.')
    })

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

const centerAndScaleModel = (object: THREE.Object3D) => {
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.y, size.z)
  const scale = 3 / maxDim
  object.scale.setScalar(scale)

  box.setFromObject(object)
  box.getCenter(center)
  object.position.sub(center)
}

const onModelLoaded = (object: THREE.Object3D, animCount: number = 0) => {
  loadedModel = object
  scene.add(loadedModel)
  centerAndScaleModel(loadedModel)
  calculateStats(loadedModel, animCount)
  isLoading.value = false

  applyViewMode()

  setTimeout(() => {
    const dataURL = takeScreenshot(false)
    if (dataURL) emit('screenshot-captured', dataURL)
  }, 800)
}

const loadModel = (url: string) => {
  if (loadedModel) {
    scene.remove(loadedModel)
    if (wireframeOverlay) {
      scene.remove(wireframeOverlay)
      wireframeOverlay = null
    }
    if (mixer) mixer.stopAllAction()
  }

  isLoading.value = true
  loadingProgress.value = 0
  error.value = null
  animations.value = []
  currentAnimation.value = -1

  const ext = getModelExtension(url)
  modelFormat.value = ext.replace('.', '').toUpperCase()

  const onProgress = (event: ProgressEvent) => {
    if (event.lengthComputable) {
      loadingProgress.value = Math.round((event.loaded / event.total) * 100)
    }
  }

  const onError = (err: any) => {
    console.error('Error loading model:', err)
    error.value = `无法加载 ${ext.toUpperCase()} 模型`
    isLoading.value = false
    addPlaceholder()
  }

  switch (ext) {
    case '.glb':
    case '.gltf': {
      const loader = new GLTFLoader()
      const dracoLoader = new DRACOLoader()
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
      loader.setDRACOLoader(dracoLoader)
      loader.load(url, (gltf) => {
        let animCount = 0
        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(gltf.scene)
          animations.value = gltf.animations.map(a => a.name || `Animation ${animations.value.length + 1}`)
          currentActions = gltf.animations.map(clip => mixer!.clipAction(clip))
          animCount = gltf.animations.length
          playAnimation(0)
        }
        onModelLoaded(gltf.scene, animCount)
      }, onProgress, onError)
      break
    }

    case '.fbx': {
      const loader = new FBXLoader()
      loader.load(url, (fbx) => {
        let animCount = 0
        if (fbx.animations && fbx.animations.length > 0) {
          mixer = new THREE.AnimationMixer(fbx)
          animations.value = fbx.animations.map((a, i) => a.name || `Animation ${i + 1}`)
          currentActions = fbx.animations.map(clip => mixer!.clipAction(clip))
          animCount = fbx.animations.length
          playAnimation(0)
        }
        onModelLoaded(fbx, animCount)
      }, onProgress, onError)
      break
    }

    case '.obj': {
      const mtlUrl = url.replace(/\.obj$/i, '.mtl')
      const loader = new OBJLoader()
      const mtlLoader = new MTLLoader()

      mtlLoader.load(mtlUrl, (materials) => {
        materials.preload()
        loader.setMaterials(materials)
        loader.load(url, (obj) => {
          onModelLoaded(obj)
        }, onProgress, onError)
      }, undefined, () => {
        loader.load(url, (obj) => {
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.5,
                metalness: 0.3
              })
            }
          })
          onModelLoaded(obj)
        }, onProgress, onError)
      })
      break
    }

    case '.stl': {
      const loader = new STLLoader()
      loader.load(url, (geometry) => {
        geometry.computeVertexNormals()
        const material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          roughness: 0.5,
          metalness: 0.3
        })
        const mesh = new THREE.Mesh(geometry, material)
        const group = new THREE.Group()
        group.add(mesh)
        onModelLoaded(group)
      }, onProgress, onError)
      break
    }

    case '.dae': {
      const loader = new ColladaLoader()
      loader.load(url, (collada: any) => {
        let animCount = 0
        if (collada.animations && collada.animations.length > 0) {
          mixer = new THREE.AnimationMixer(collada.scene)
          animations.value = collada.animations.map((a: THREE.AnimationClip, i: number) => a.name || `Animation ${i + 1}`)
          currentActions = collada.animations.map((clip: THREE.AnimationClip) => mixer!.clipAction(clip))
          animCount = collada.animations.length
          playAnimation(0)
        }
        onModelLoaded(collada.scene, animCount)
      }, onProgress, onError)
      break
    }

    default: {
      error.value = `不支持的模型格式: ${ext}`
      isLoading.value = false
      addPlaceholder()
    }
  }
}

const applyViewMode = () => {
  if (wireframeOverlay) {
    scene.remove(wireframeOverlay)
    wireframeOverlay = null
  }

  if (!loadedModel) return

  loadedModel.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => {
        m.wireframe = viewMode.value === 'wireframe'
        m.transparent = viewMode.value === 'solid+wireframe'
        m.opacity = viewMode.value === 'solid+wireframe' ? 0.6 : 1.0
        m.needsUpdate = true
      })
    }
  })

  if (viewMode.value === 'solid+wireframe') {
    wireframeOverlay = loadedModel.clone()
    wireframeOverlay.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshBasicMaterial({
          color: 0x3b82f6,
          wireframe: true,
          transparent: true,
          opacity: 0.3
        })
      }
    })
    scene.add(wireframeOverlay)
  }
}

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode
  applyViewMode()
}

const calculateStats = (model: THREE.Object3D, animCount: number = 0) => {
  let vCount = 0
  let fCount = 0
  const mCount = new Set()

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

const toggleFullscreen = () => {
  if (!container.value) return
  if (!document.fullscreenElement) {
    container.value.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch(() => {})
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    }).catch(() => {})
  }
}

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.set(5, 5, 5)
  controls.target.set(0, 0, 0)
  controls.update()
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

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
  initScene()
  window.addEventListener('resize', handleResize)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  container.value?.addEventListener('click', handleCanvasClick)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
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
    <!-- Loading State -->
    <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10">
      <div class="flex flex-col items-center gap-3">
        <div class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p class="text-sm font-bold text-white">正在解析 {{ modelFormat }} 模型...</p>
        <div v-if="loadingProgress > 0" class="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full bg-accent rounded-full transition-all duration-300" :style="{ width: `${loadingProgress}%` }"></div>
        </div>
        <p v-if="loadingProgress > 0" class="text-[10px] text-slate-400">{{ loadingProgress }}%</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10">
      <div class="flex flex-col items-center gap-2">
        <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path></svg>
        <p class="text-sm font-bold text-red-400">{{ error }}</p>
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
            @click.stop="activeHotspot = activeHotspot === i ? null : i"
            class="w-6 h-6 bg-accent border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform pointer-events-auto group/dot"
          >
            <span class="text-[10px] font-bold">{{ i + 1 }}</span>
            <div class="absolute inset-0 rounded-full bg-accent animate-ping opacity-20 group-hover:opacity-40"></div>
          </button>

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
        <div v-if="modelFormat" class="flex justify-between"><span class="text-slate-500">格式</span><span class="font-mono text-accent">{{ modelFormat }}</span></div>
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

      <!-- View Mode Dropdown -->
      <div class="relative group/dropdown">
        <button :class="['p-2 backdrop-blur-md border border-white/10 rounded-lg transition-colors', viewMode !== 'solid' ? 'bg-accent text-white' : 'bg-slate-900/80 text-white hover:bg-white/10']" title="视图模式">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
        </button>
        <div class="absolute right-0 top-full mt-1 w-32 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden shadow-2xl opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all z-30">
          <button @click="setViewMode('solid')" class="w-full px-3 py-2 text-[11px] text-left flex items-center gap-2 transition-colors" :class="viewMode === 'solid' ? 'bg-accent text-white' : 'text-slate-300 hover:bg-white/10'">
            <span class="w-3 h-3 rounded-sm bg-blue-400"></span> 实体
          </button>
          <button @click="setViewMode('wireframe')" class="w-full px-3 py-2 text-[11px] text-left flex items-center gap-2 transition-colors" :class="viewMode === 'wireframe' ? 'bg-accent text-white' : 'text-slate-300 hover:bg-white/10'">
            <span class="w-3 h-3 rounded-sm border border-blue-400"></span> 线框
          </button>
          <button @click="setViewMode('solid+wireframe')" class="w-full px-3 py-2 text-[11px] text-left flex items-center gap-2 transition-colors" :class="viewMode === 'solid+wireframe' ? 'bg-accent text-white' : 'text-slate-300 hover:bg-white/10'">
            <span class="w-3 h-3 rounded-sm bg-blue-400/50 border border-blue-400"></span> 混合
          </button>
        </div>
      </div>

      <button @click="resetCamera" class="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-accent transition-colors" title="重置视角">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
      </button>

      <button @click="takeScreenshot(true)" class="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-accent transition-colors" title="截图">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
      </button>

      <button @click="toggleFullscreen" class="p-2 bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-lg text-white hover:bg-accent transition-colors" :title="isFullscreen ? '退出全屏' : '全屏'">
        <svg v-if="!isFullscreen" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
        <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"></path></svg>
      </button>
    </div>

    <!-- Format Badge -->
    <div v-if="modelFormat && !isLoading && !error" class="absolute left-4 bottom-4 px-2 py-1 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-lg text-[10px] font-bold text-white/60 z-20">
      {{ modelFormat }}
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
