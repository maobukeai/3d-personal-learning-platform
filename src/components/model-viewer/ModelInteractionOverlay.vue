<script setup lang="ts">
import { ref } from 'vue';
import GlassCard from '../ui/GlassCard.vue';
import type { HotspotWithScreenPosition } from '@/utils/3d/HotspotEventBus';
const props = defineProps<{
  /** Hotspots with pre-computed screen positions (from render loop or worker). */ hotspots: HotspotWithScreenPosition[];
}>();
const emit = defineEmits<{
  /** Fired when a hotspot marker is clicked (toggles active state). */ 'hotspot-click': [
    index: number,
  ];
  /** Fired when a hotspot marker is hovered. */ 'hotspot-hover': [index: number | null];
}>();
const activeHotspot = ref<number | null>(null);
const handleHotspotClick = (index: number) => {
  activeHotspot.value = activeHotspot.value === index ? null : index;
  emit('hotspot-click', index);
};
</script>
<template>
  <!-- Hotspot markers overlay -->
  <template v-for="(h, i) in props.hotspots" :key="i">
    <div
      v-if="h.isVisible"
      class="absolute z-30 transition-transform duration-200 pointer-events-none"
      :style="{ transform: `translate(${h.screenX}px, ${h.screenY}px)` }"
      @mouseenter="emit('hotspot-hover', i)"
      @mouseleave="emit('hotspot-hover', null)"
    >
      <div class="relative -translate-x-1/2 -translate-y-1/2">
        <button
          type="button"
          class="w-6 h-6 bg-accent border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-transform pointer-events-auto group/dot"
          @click.stop="handleHotspotClick(i)"
        >
          <span class="text-[10px] font-bold">{{ i + 1 }}</span>
          <div
            class="absolute inset-0 rounded-full bg-accent animate-ping opacity-25 group-hover:opacity-55"
          ></div>
        </button>
        <Transition name="fade">
          <GlassCard
            v-if="activeHotspot === i"
            tier="panel"
            class="absolute bottom-8 left-0 -translate-x-1/2 w-52 text-white shadow-2xl pointer-events-auto border border-white/20 dark:border-white/10 glass-panel-extreme"
            padding="sm"
          >
            <h4 class="text-xs font-bold text-accent mb-1 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span> {{ h.title }}
            </h4>
            <p class="text-[10px] text-slate-300 leading-relaxed font-medium">{{ h.content }}</p>
          </GlassCard>
        </Transition>
      </div>
    </div>
  </template>
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
