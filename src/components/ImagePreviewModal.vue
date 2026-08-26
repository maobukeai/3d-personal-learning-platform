<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { X, ZoomIn, ZoomOut, Download, ExternalLink, RotateCw } from 'lucide-vue-next';

const props = defineProps<{
  show: boolean;
  imageUrl: string;
  alt?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
}>();

const scale = ref(1);
const rotation = ref(0);

watch(
  () => props.show,
  (val) => {
    if (val) {
      scale.value = 1;
      rotation.value = 0;
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'hidden';
      }
    } else {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
    }
  },
);

function handleClose() {
  emit('update:show', false);
}

function zoomIn() {
  scale.value = Math.min(scale.value + 0.3, 3);
}

function zoomOut() {
  scale.value = Math.max(scale.value - 0.3, 0.5);
}

function rotate() {
  rotation.value = (rotation.value + 90) % 360;
}

function resetTransform() {
  scale.value = 1;
  rotation.value = 0;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) {
    handleClose();
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeydown);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = '';
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md select-none touch-none"
        @click.self="handleClose"
      >
        <!-- Top Toolbar -->
        <div
          class="absolute top-4 right-4 flex items-center gap-2 z-10 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl"
        >
          <button
            type="button"
            class="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="放大"
            @click="zoomIn"
          >
            <ZoomIn class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="缩小"
            @click="zoomOut"
          >
            <ZoomOut class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="旋转"
            @click="rotate"
          >
            <RotateCw class="w-4 h-4" />
          </button>
          <a
            :href="imageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="在新标签页打开原图"
          >
            <ExternalLink class="w-4 h-4" />
          </a>
          <button
            type="button"
            class="p-2 rounded-xl bg-white/15 text-white hover:bg-rose-600 transition-colors cursor-pointer ml-1"
            title="关闭预览 (Esc)"
            @click="handleClose"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Image Content Area -->
        <div
          class="relative w-full h-full flex items-center justify-center p-4 overflow-hidden cursor-zoom-out"
          @click.self="handleClose"
        >
          <img
            :src="imageUrl"
            :alt="alt || '图片预览'"
            referrerpolicy="no-referrer"
            class="max-w-[92vw] max-h-[88vh] object-contain rounded-xl shadow-2xl transition-transform duration-200 cursor-default"
            :style="{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
            }"
            @dblclick="resetTransform"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
