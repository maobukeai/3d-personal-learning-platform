<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { ArrowRight, BookOpen, Play, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import type { ActiveBanner, DashboardEnrollment } from '../types';

const props = defineProps<{
  activeBanners: ActiveBanner[];
  activeEnrollment: DashboardEnrollment | null;
}>();

const emit = defineEmits<{
  (e: 'navigate', route: string): void;
}>();

const activeSlideIndex = ref(0);
const isTransitioning = ref(false);
const isHovered = ref(false);
const progressKey = ref(0); // used to restart CSS animation
let carouselTimer: ReturnType<typeof setInterval> | null = null;

const INTERVAL = 5000;

const activeSlide = computed(() => props.activeBanners[activeSlideIndex.value] || null);
const hasMultipleSlides = computed(() => props.activeBanners.length > 1);

const remainingLessons = computed(() => {
  if (!props.activeEnrollment) return 0;
  const lessons = props.activeEnrollment.course._count.lessons;
  return Math.max(0, Math.ceil(lessons * (1 - props.activeEnrollment.progress / 100)));
});

function goToSlide(index: number) {
  if (index === activeSlideIndex.value || isTransitioning.value) return;
  isTransitioning.value = true;
  setTimeout(() => {
    activeSlideIndex.value = index;
    isTransitioning.value = false;
    progressKey.value++;
  }, 280);
}

function nextSlide() {
  goToSlide((activeSlideIndex.value + 1) % props.activeBanners.length);
}

function prevSlide() {
  goToSlide((activeSlideIndex.value - 1 + props.activeBanners.length) % props.activeBanners.length);
}

function startCarousel() {
  stopCarousel();
  if (props.activeBanners.length > 1) {
    carouselTimer = setInterval(() => {
      if (!isHovered.value) {
        nextSlide();
      }
    }, INTERVAL);
  }
}

function stopCarousel() {
  if (!carouselTimer) return;
  clearInterval(carouselTimer);
  carouselTimer = null;
}

watch(
  () => props.activeBanners?.length,
  () => {
    activeSlideIndex.value = 0;
    progressKey.value++;
    startCarousel();
  },
);

onMounted(() => {
  startCarousel();
});

onUnmounted(() => {
  stopCarousel();
});
</script>

<template>
  <Card
    padding="none"
    hoverable
    glow
    class="spotlight-card !border-0 bg-slate-900 overflow-hidden"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Banner slide -->
    <template v-if="activeSlide">
      <!-- Background image with fade transition -->
      <Transition name="slide-fade" mode="out-in">
        <img
          :key="activeSlideIndex"
          :src="getAssetUrl(activeSlide.imageUrl)"
          :alt="activeSlide.title"
          class="spotlight-image"
        />
      </Transition>

      <!-- Layered gradients keep text readable without losing the artwork. -->
      <div class="spotlight-scrim"></div>
      <div class="spotlight-bottom-gradient"></div>
      <div class="spotlight-orb"></div>

      <!-- Editorial-style content block -->
      <div class="spotlight-content">
        <Badge
          v-if="activeSlide.tag"
          variant="blender"
          dot
          class="spotlight-badge mb-3 w-fit self-start text-[10px]"
        >
          {{ activeSlide.tag }}
        </Badge>
        <h1
          class="spotlight-title text-xl sm:text-2xl font-extrabold tracking-tight leading-[1.16] max-w-[85%] mb-2 text-white line-clamp-2"
        >
          {{ activeSlide.title }}
        </h1>
        <p
          v-if="activeSlide.subtitle"
          class="spotlight-subtitle text-xs text-white/75 max-w-[75%] mb-5 font-medium line-clamp-1"
        >
          {{ activeSlide.subtitle }}
        </p>
        <Button
          variant="secondary"
          size="sm"
          :icon="Play"
          class="w-fit spotlight-btn"
          @click="emit('navigate', activeSlide.route)"
        >
          {{ activeSlide.buttonText }}
        </Button>
      </div>

      <!-- Bottom navigation is deliberately separated from the copy. -->
      <div class="spotlight-controls">
        <div v-if="hasMultipleSlides" class="slide-pagination">
          <button
            v-for="(_, i) in activeBanners"
            :key="i"
            type="button"
            class="dot-btn"
            :class="i === activeSlideIndex ? 'dot-active' : 'dot-inactive'"
            :aria-label="`切换到第 ${i + 1} 张轮播图`"
            @click="goToSlide(i)"
          />
          <span class="slide-count"
            >{{ String(activeSlideIndex + 1).padStart(2, '0') }} <i></i>
            {{ String(activeBanners.length).padStart(2, '0') }}</span
          >
        </div>

        <div v-if="hasMultipleSlides" class="slide-arrows">
          <button type="button" class="nav-arrow" aria-label="上一张轮播图" @click="prevSlide">
            <ChevronLeft class="w-3 h-3" />
          </button>
          <button type="button" class="nav-arrow" aria-label="下一张轮播图" @click="nextSlide">
            <ChevronRight class="w-3 h-3" />
          </button>
        </div>
      </div>

      <!-- Auto-play progress bar -->
      <div v-if="hasMultipleSlides && !isHovered" class="spotlight-progress-track">
        <div :key="progressKey" class="spotlight-progress-bar"></div>
      </div>
    </template>

    <!-- Active enrollment fallback -->
    <template v-else-if="activeEnrollment">
      <img
        :src="
          getAssetUrl(activeEnrollment.course.thumbnail) ||
          'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=900&auto=format&fit=crop&q=70'
        "
        :alt="activeEnrollment.course.title"
        class="spotlight-image"
      />
      <div class="spotlight-scrim"></div>
      <div class="spotlight-bottom-gradient"></div>
      <div class="spotlight-orb"></div>
      <div class="spotlight-content">
        <Badge variant="blender" dot class="mb-1 w-fit self-start text-[10px]">正在学习</Badge>
        <h1
          class="text-lg sm:text-xl font-extrabold tracking-tight leading-tight max-w-[90%] mb-1 text-white truncate"
        >
          {{ activeEnrollment.course.title }}
        </h1>
        <p class="text-[11px] text-white/75 max-w-[85%] mb-3 font-medium truncate">
          当前已完成 {{ activeEnrollment.progress }}% · 剩余 {{ remainingLessons }} 节课程。
        </p>
        <!-- Progress bar -->
        <div class="enrollment-progress-bg">
          <div
            class="enrollment-progress-fill"
            :style="{ width: activeEnrollment.progress + '%' }"
          ></div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          :icon="Play"
          class="w-fit spotlight-btn mt-2"
          @click="emit('navigate', `/academy/player/${activeEnrollment.courseId}`)"
        >
          继续学习
        </Button>
      </div>
    </template>

    <!-- Empty state -->
    <template v-else>
      <div class="spotlight-empty-state">
        <div
          class="empty-icon-wrapper bg-white/10 dark:bg-white/5 border border-white/10 rounded-xl p-3 mb-2"
        >
          <BookOpen class="h-5 w-5 text-white" />
        </div>
        <div class="text-center">
          <h1 class="text-base sm:text-lg font-extrabold tracking-tight text-white mb-1">
            选择一门主线课程
          </h1>
          <p class="text-[11px] text-white/70 max-w-[280px] font-medium leading-relaxed mb-3">
            开始你的系统化学习旅程，将知识、项目与作品串联起来。
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          :icon="ArrowRight"
          icon-position="right"
          class="w-fit active:scale-95"
          @click="emit('navigate', '/academy')"
        >
          进入课程学院
        </Button>
      </div>
    </template>
  </Card>
</template>

<style scoped>
/* ── Card shell ── */
.spotlight-card {
  position: relative;
  aspect-ratio: 21 / 9;
  min-height: 0;
  max-height: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
  isolation: isolate;
  border-radius: 18px;
  border: 0;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.1);
}

/* ── Background image ── */
.spotlight-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  image-rendering: high-quality;
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
  transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 0;
}

.spotlight-card:hover .spotlight-image {
  transform: scale(1.035);
}

/* ── Slide-fade transition (opacity only, no scale to avoid blur) ── */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 0.3s ease;
}
.slide-fade-enter-from {
  opacity: 0;
}
.slide-fade-leave-to {
  opacity: 0;
}

/* ── Bottom-only gradient for text readability ── */
.spotlight-bottom-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 52%;
  background: linear-gradient(
    to top,
    rgba(7, 15, 32, 0.72) 0%,
    rgba(7, 15, 32, 0.24) 54%,
    transparent 100%
  );
  z-index: 2;
  pointer-events: none;
}

.spotlight-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(
      90deg,
      rgba(7, 15, 32, 0.9) 0%,
      rgba(10, 19, 39, 0.68) 30%,
      rgba(10, 19, 39, 0.2) 58%,
      rgba(10, 19, 39, 0.03) 100%
    ),
    linear-gradient(180deg, rgba(7, 15, 32, 0.14) 0%, transparent 42%);
}

.spotlight-orb {
  position: absolute;
  z-index: 2;
  top: -80px;
  left: 28%;
  width: 260px;
  height: 260px;
  border-radius: 999px;
  background: rgba(124, 92, 255, 0.2);
  filter: blur(72px);
  pointer-events: none;
}

/* ── Content (upper-left area, away from controls) ── */
.spotlight-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0;
  padding: 28px 34px 48px;
  height: 100%;
  max-width: 52%;
  box-sizing: border-box;
}

.spotlight-title {
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.36);
}

.spotlight-subtitle {
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.spotlight-badge {
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

/* ── CTA button ── */
.spotlight-btn {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(79, 70, 229, 0.95));
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #ffffff;
  backdrop-filter: blur(8px);
  box-shadow:
    0 10px 24px rgba(79, 70, 229, 0.38),
    0 0 0 1px rgba(255, 255, 255, 0.16) inset;
  font-weight: 600;
  border-radius: 9999px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.spotlight-btn:hover {
  background: linear-gradient(135deg, rgba(167, 139, 250, 1), rgba(99, 102, 241, 1));
  border-color: rgba(255, 255, 255, 0.32);
  box-shadow:
    0 12px 28px rgba(79, 70, 229, 0.48),
    0 0 0 1px rgba(167, 139, 250, 0.3) inset;
  transform: translateY(-1px);
}

.spotlight-btn:active {
  transform: translateY(0) scale(0.97);
}

/* ── Bottom controls bar ── */
.spotlight-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px 16px 22px;
  background: transparent;
}

.slide-pagination,
.slide-arrows {
  display: flex;
  align-items: center;
}

.slide-pagination {
  gap: 7px;
}
.slide-arrows {
  gap: 6px;
}

.slide-count {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 6px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
}

.slide-count i {
  width: 12px;
  height: 1px;
  background: rgba(255, 255, 255, 0.36);
}

/* ── Dot indicators ── */
.dot-btn {
  border: none;
  cursor: pointer;
  border-radius: 9999px;
  transition: all 0.25s ease;
  outline: none;
}

.dot-active {
  width: 22px;
  height: 3px;
  background: #ffffff;
  box-shadow: 0 0 9px rgba(255, 255, 255, 0.5);
}

.dot-inactive {
  width: 4px;
  height: 3px;
  background: rgba(255, 255, 255, 0.35);
}

.dot-inactive:hover {
  background: rgba(255, 255, 255, 0.65);
  transform: scale(1.2);
}

/* ── Arrow nav ── */
.nav-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 29px;
  height: 29px;
  border-radius: 9px;
  background: rgba(15, 23, 42, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  backdrop-filter: blur(10px);
}

.nav-arrow:hover {
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
  transform: scale(1.1);
}

/* ── Auto-play progress bar ── */
.spotlight-progress-track {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.14);
  z-index: 5;
  overflow: hidden;
}

.spotlight-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 72%, white));
  animation: progress-fill 5s linear forwards;
  box-shadow: 0 0 8px color-mix(in srgb, var(--primary) 75%, transparent);
}

@keyframes progress-fill {
  from {
    width: 0%;
  }
  to {
    width: 100%;
  }
}

/* ── Enrollment progress bar ── */
.enrollment-progress-bg {
  width: 100%;
  max-width: 200px;
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  overflow: hidden;
}

.enrollment-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, rgba(139, 92, 246, 0.9), rgba(99, 102, 241, 0.9));
  border-radius: 9999px;
  transition: width 0.6s ease;
  box-shadow: 0 0 6px rgba(139, 92, 246, 0.5);
}

/* ── Empty state ── */
.spotlight-empty-state {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 24px;
  background:
    radial-gradient(circle at center, rgba(37, 99, 235, 0.15) 0%, transparent 70%), #0f172a;
  box-sizing: border-box;
  height: 100%;
}

.empty-icon-wrapper {
  backdrop-filter: blur(8px);
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .spotlight-card {
    aspect-ratio: 21 / 9;
    min-height: 0;
    max-height: none;
  }

  .spotlight-content {
    max-width: 88%;
    padding: 24px 24px 50px;
  }

  .spotlight-scrim {
    background: linear-gradient(
      90deg,
      rgba(7, 15, 32, 0.88) 0%,
      rgba(7, 15, 32, 0.48) 70%,
      rgba(7, 15, 32, 0.18) 100%
    );
  }
}
</style>
