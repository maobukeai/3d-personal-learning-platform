<script setup lang="ts">
import { computed, ref } from 'vue';
import { Layers } from 'lucide-vue-next';
import GlassCard from '../ui/GlassCard.vue';
import type { ModelStats } from './ModelAssetLoader';
const props = defineProps<{
  stats: ModelStats;
  /** Current FPS (updated ~1/sec by the render loop or worker). */ fps?: number;
  /** Estimated VRAM usage in bytes (from VramManager via system3DStore). */ vramBytes?: number;
  /** VRAM redline threshold in bytes. */ vramMaxBytes?: number;
}>();
const visible = ref(false);
const toggle = () => {
  visible.value = !visible.value;
};
const vramMB = computed(() => {
  const bytes = props.vramBytes || 0;
  return (bytes / (1024 * 1024)).toFixed(1);
});
const vramMaxMB = computed(() => {
  const bytes = props.vramMaxBytes || 512 * 1024 * 1024;
  return (bytes / (1024 * 1024)).toFixed(0);
});
const vramPercent = computed(() => {
  const bytes = props.vramBytes || 0;
  const max = props.vramMaxBytes || 512 * 1024 * 1024;
  return Math.min(100, (bytes / max) * 100);
});
const fpsLabel = computed(() => {
  if (!props.fps || props.fps <= 0) return '—';
  return Math.round(props.fps).toString();
});
const fpsColor = computed(() => {
  if (!props.fps) return 'text-slate-400';
  if (props.fps < 30) return 'text-red-400';
  if (props.fps < 45) return 'text-amber-400';
  return 'text-green-400';
});
const vramColor = computed(() => {
  if (vramPercent.value > 85) return 'text-red-400';
  if (vramPercent.value > 60) return 'text-amber-400';
  return 'text-green-400';
});
defineExpose({ toggle, visible });
</script>
<template>
  <Transition name="fade">
    <GlassCard
      v-if="visible"
      tier="panel"
      class="absolute left-4 bottom-4 z-20 w-64 text-white border border-white/10 shadow-2xl glass-real-physical glass-panel-extreme pointer-events-none select-none"
      padding="sm"
    >
      <h4 class="text-xs font-bold text-accent mb-2 flex items-center gap-1.5">
        <Layers class="w-4 h-4" /> Telemetry Statistics
      </h4>
      <div class="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div>
          <span class="text-slate-400">Vertices:</span>
          <div class="text-slate-200 font-bold">{{ stats.vertices.toLocaleString() }}</div>
        </div>
        <div>
          <span class="text-slate-400">Triangles:</span>
          <div class="text-slate-200 font-bold">{{ stats.faces.toLocaleString() }}</div>
        </div>
        <div>
          <span class="text-slate-400">Draw Calls:</span>
          <div class="text-slate-200 font-bold">{{ stats.drawCalls.toLocaleString() }}</div>
        </div>
        <div>
          <span class="text-slate-400">Dimensions:</span>
          <div class="text-slate-200 font-bold break-all">{{ stats.dimensions || 'N/A' }}</div>
        </div>
        <div>
          <span class="text-slate-400">Materials:</span>
          <div class="text-slate-200 font-bold">{{ stats.materials }}</div>
        </div>
        <div>
          <span class="text-slate-400">Max Texture:</span>
          <div class="text-slate-200 font-bold">{{ stats.maxTextureRes }}px</div>
        </div>
        <div>
          <span class="text-slate-400">FPS:</span>
          <div :class="['font-bold', fpsColor]">{{ fpsLabel }}</div>
        </div>
        <div>
          <span class="text-slate-400">VRAM:</span>
          <div :class="['font-bold', vramColor]">{{ vramMB }} / {{ vramMaxMB }} MB</div>
        </div>
      </div>
    </GlassCard>
  </Transition>
</template>
<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
