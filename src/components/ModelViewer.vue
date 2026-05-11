<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

const props = defineProps<{
  modelUrl?: string
  autoRotate?: boolean
}>()

const container = ref<HTMLElement | null>(null)
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let animationId: number
let cube: THREE.Mesh

const initScene = () => {
  if (!container.value) return

  // Scene setup
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf1f5f9) // slate-100

  // Camera setup
  const width = container.value.clientWidth
  const height = container.value.clientHeight
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
  camera.position.z = 5

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.value.appendChild(renderer.domElement)

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(5, 5, 5)
  scene.add(directionalLight)

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // Mock Model (Colorful Torus Knot)
  const geometry = new THREE.TorusKnotGeometry(1, 0.4, 100, 16)
  const material = new THREE.MeshStandardMaterial({ 
    color: 0x2563eb, // accent
    roughness: 0.3,
    metalness: 0.7 
  })
  cube = new THREE.Mesh(geometry, material)
  scene.add(cube)

  animate()
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  
  if (props.autoRotate && cube) {
    cube.rotation.y += 0.01
    cube.rotation.x += 0.005
  }

  controls.update()
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
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  cancelAnimationFrame(animationId)
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
  }
})

// Watch for changes that might require re-init or updates
watch(() => props.autoRotate, (val) => {
  if (controls) controls.autoRotate = !!val
})
</script>

<template>
  <div ref="container" class="w-full h-full cursor-move"></div>
</template>

<style scoped>
canvas {
  display: block;
}
</style>
