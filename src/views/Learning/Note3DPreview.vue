<template>
  <div class="note-3d-preview"><div ref="containerRef" class="canvas-container"></div></div>
</template>
<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef } from 'vue';
import * as THREE from 'three';
import { tiptapJsonToWebGLScene, type TiptapNode } from '@/utils/3d/markupAstToScene';
const props = defineProps<{ tiptapJson: TiptapNode }>();
const containerRef = ref<HTMLDivElement>();
// Three.js 对象避免 Vue 深度响应式代理（工程约定）
const scene = shallowRef<THREE.Scene>();
const renderer = shallowRef<THREE.WebGLRenderer>();
const camera = shallowRef<THREE.PerspectiveCamera>();
let animationId = 0;
onMounted(() => {
  if (!containerRef.value) return;
  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight; // 初始化场景 const s = new THREE.Scene(); s.background = new THREE.Color(0x0a0a0f); scene.value = s; // 相机 const cam = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000); cam.position.set(0, 0, 10); camera.value = cam; // 渲染器 const ren = new THREE.WebGLRenderer({ antialias: true }); ren.setSize(width, height); ren.setPixelRatio(window.devicePixelRatio); containerRef.value.appendChild(ren.domElement); renderer.value = ren; // 灯光 const ambient = new THREE.AmbientLight(0xffffff, 0.6); s.add(ambient); const directional = new THREE.DirectionalLight(0xffffff, 0.8); directional.position.set(5, 5, 5); s.add(directional); // 将 Tiptap JSON 转换为 3D 场景 const markupScene = tiptapJsonToWebGLScene(props.tiptapJson); s.add(markupScene); // 动画循环 const animate = () => { animationId = requestAnimationFrame(animate); ren.render(s, cam); }; animate();
});
onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId);
  renderer.value?.dispose();
  renderer.value?.domElement.remove();
});
</script>
<style scoped>
.note-3d-preview {
  width: 100%;
  height: 100%;
}
.canvas-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
}
</style>
