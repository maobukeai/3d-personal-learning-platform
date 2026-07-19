<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ChevronLeft, ChevronRight } from 'lucide-vue-next';
import SafeHtml from '@/components/SafeHtml.vue';
import Modal from '@/components/ui/Modal.vue';
import TutorialImageCaption from '@/components/TutorialImageCaption.vue';
import { readTutorialPreviewImage } from '@/components/tutorialPreview';
import type { PreviewImage } from '@/components/tutorialPreview';

interface Props {
  html: string;
}

const props = defineProps<Props>();
const contentRoot = ref<HTMLElement | null>(null);
const imageItems = ref<PreviewImage[]>([]);
const activeIndex = ref(-1);
let touchStartX = 0;

const currentImage = computed(() => imageItems.value[activeIndex.value]);
const openImagePreview = (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const image = target.closest('img');
  if (!(image instanceof HTMLImageElement) || !contentRoot.value?.contains(image)) return;

  const images = Array.from(contentRoot.value.querySelectorAll<HTMLImageElement>('img')).filter(
    (item) => Boolean(item.currentSrc || item.src),
  );
  const index = images.indexOf(image);
  if (index < 0) return;

  event.preventDefault();
  imageItems.value = images.map(readTutorialPreviewImage);
  activeIndex.value = index;
};

const closeImagePreview = () => {
  activeIndex.value = -1;
  imageItems.value = [];
};

const showPreviousImage = () => {
  if (imageItems.value.length < 2) return;
  activeIndex.value = (activeIndex.value - 1 + imageItems.value.length) % imageItems.value.length;
};

const showNextImage = () => {
  if (imageItems.value.length < 2) return;
  activeIndex.value = (activeIndex.value + 1) % imageItems.value.length;
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!currentImage.value) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showPreviousImage();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    showNextImage();
  }
};

const handleTouchStart = (event: TouchEvent) => {
  touchStartX = event.touches[0]?.clientX || 0;
};

const handleTouchEnd = (event: TouchEvent) => {
  const distance = (event.changedTouches[0]?.clientX || touchStartX) - touchStartX;
  if (Math.abs(distance) < 48) return;
  if (distance > 0) showPreviousImage();
  else showNextImage();
};

watch(() => props.html, closeImagePreview);
onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <div ref="contentRoot" class="tutorial-rich-content" @click="openImagePreview">
    <SafeHtml :html="html" />
  </div>

  <Modal
    :show="Boolean(currentImage)"
    title="教程图片预览"
    size="presentation"
    variant="immersive"
    padding="sm"
    initial-focus="title"
    content-class="tutorial-image-preview-modal"
    @close="closeImagePreview"
  >
    <div v-if="currentImage" class="tutorial-image-preview-shell">
      <div
        class="tutorial-image-preview-stage bg-slate-950"
        @touchstart.passive="handleTouchStart"
        @touchend.passive="handleTouchEnd"
      >
        <img :src="currentImage.src" :alt="currentImage.alt" />

        <button
          v-if="imageItems.length > 1"
          type="button"
          class="tutorial-image-nav tutorial-image-nav--previous border border-white/20 bg-slate-900/70 text-white hover:bg-slate-800/90"
          aria-label="上一张步骤图片"
          data-testid="tutorial-image-previous"
          @click="showPreviousImage"
        >
          <ChevronLeft aria-hidden="true" />
        </button>

        <button
          v-if="imageItems.length > 1"
          type="button"
          class="tutorial-image-nav tutorial-image-nav--next border border-white/20 bg-slate-900/70 text-white hover:bg-slate-800/90"
          aria-label="下一张步骤图片"
          data-testid="tutorial-image-next"
          @click="showNextImage"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <TutorialImageCaption :image="currentImage" :index="activeIndex" :total="imageItems.length" />
    </div>
  </Modal>
</template>

<style scoped>
.tutorial-rich-content :deep(img) {
  cursor: zoom-in;
  transition:
    filter 160ms ease,
    transform 160ms ease;
}

.tutorial-rich-content :deep(img:hover) {
  filter: brightness(1.06);
  transform: translateY(-1px);
}

.tutorial-image-preview-shell {
  display: flex;
  height: min(80dvh, 840px);
  max-height: calc(100dvh - 8rem);
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.tutorial-image-preview-stage {
  position: relative;
  display: flex;
  min-height: 260px;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.tutorial-image-preview-stage img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}

.tutorial-image-nav {
  position: absolute;
  top: 50%;
  display: flex;
  width: 44px;
  height: 56px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    background-color 160ms ease,
    transform 160ms ease;
}

.tutorial-image-nav:hover {
  transform: translateY(-50%) scale(1.04);
}

.tutorial-image-nav:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.tutorial-image-nav--previous {
  left: 1rem;
}

.tutorial-image-nav--next {
  right: 1rem;
}

@media (max-width: 640px) {
  .tutorial-image-preview-shell {
    height: calc(100dvh - 7rem);
    max-height: none;
  }

  .tutorial-image-preview-stage {
    min-height: 42dvh;
  }

  .tutorial-image-nav {
    width: 38px;
    height: 48px;
  }

  .tutorial-image-nav--previous {
    left: 0.5rem;
  }

  .tutorial-image-nav--next {
    right: 0.5rem;
  }
}
</style>
