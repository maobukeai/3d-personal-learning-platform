<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { ArrowRight, BookOpen, Play } from 'lucide-vue-next';
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
let carouselTimer: ReturnType<typeof setInterval> | null = null;

const activeSlide = computed(() => props.activeBanners[activeSlideIndex.value] || null);

const remainingLessons = computed(() => {
  if (!props.activeEnrollment) return 0;
  const lessons = props.activeEnrollment.course._count.lessons;
  return Math.max(0, Math.ceil(lessons * (1 - props.activeEnrollment.progress / 100)));
});

function startCarousel() {
  stopCarousel();
  if (props.activeBanners.length > 1) {
    carouselTimer = setInterval(() => {
      activeSlideIndex.value = (activeSlideIndex.value + 1) % props.activeBanners.length;
    }, 5000);
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
    class="spotlight-card border-base/80 bg-slate-900 overflow-hidden shadow-card"
  >
    <template v-if="activeSlide">
      <img
        :src="getAssetUrl(activeSlide.imageUrl)"
        :alt="activeSlide.title"
        class="spotlight-image"
      />
      <div class="spotlight-overlay"></div>
      <div class="spotlight-content">
        <Badge v-if="activeSlide.tag" variant="blender" dot class="mb-1 w-fit self-start">
          {{ activeSlide.tag }}
        </Badge>
        <h1
          class="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight max-w-[90%] mb-1.5 text-white"
        >
          {{ activeSlide.title }}
        </h1>
        <p v-if="activeSlide.subtitle" class="text-xs text-white/80 max-w-[85%] mb-3 font-medium">
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
    </template>

    <template v-else-if="activeEnrollment">
      <img
        :src="
          getAssetUrl(activeEnrollment.course.thumbnail) ||
          'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=900&auto=format&fit=crop&q=70'
        "
        :alt="activeEnrollment.course.title"
        class="spotlight-image"
      />
      <div class="spotlight-overlay"></div>
      <div class="spotlight-content">
        <Badge variant="blender" dot class="mb-1 w-fit self-start">正在学习</Badge>
        <h1
          class="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight max-w-[90%] mb-1.5 text-white"
        >
          {{ activeEnrollment.course.title }}
        </h1>
        <p class="text-xs text-white/80 max-w-[85%] mb-3 font-medium">
          当前已完成 {{ activeEnrollment.progress }}% · 剩余 {{ remainingLessons }} 节课程。
        </p>
        <Button
          variant="secondary"
          size="sm"
          :icon="Play"
          class="w-fit spotlight-btn"
          @click="emit('navigate', `/academy/player/${activeEnrollment.courseId}`)"
        >
          继续学习
        </Button>
      </div>
    </template>

    <template v-else>
      <div class="spotlight-empty-state">
        <div
          class="empty-icon-wrapper bg-white/10 dark:bg-white/5 border border-white/10 rounded-xl p-3 mb-2"
        >
          <BookOpen class="h-6 w-6 text-white" />
        </div>
        <div class="text-center">
          <h1 class="text-lg sm:text-xl font-extrabold tracking-tight text-white mb-1">
            选择一门主线课程
          </h1>
          <p class="text-xs text-white/70 max-w-[280px] font-medium leading-relaxed mb-3">
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
.spotlight-card {
  position: relative;
  aspect-ratio: 21 / 9;
  min-height: 180px;
  max-height: 260px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.spotlight-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 0;
}

.spotlight-card:hover .spotlight-image {
  transform: scale(1.04);
}

.spotlight-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(15, 23, 42, 0.9) 0%,
    rgba(15, 23, 42, 0.5) 60%,
    rgba(15, 23, 42, 0.15) 100%
  );
  z-index: 1;
}

.spotlight-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 20px 24px;
  height: 100%;
  box-sizing: border-box;
}

.spotlight-btn {
  background: rgba(255, 255, 255, 0.12) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  color: #ffffff !important;
  backdrop-filter: blur(8px) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
  font-weight: 600 !important;
  border-radius: 9999px !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}

.spotlight-btn:hover {
  background: rgba(255, 255, 255, 0.22) !important;
  border-color: rgba(255, 255, 255, 0.35) !important;
  box-shadow: 0 6px 16px rgba(255, 255, 255, 0.15) !important;
  transform: translateY(-1px);
}

.spotlight-btn:active {
  transform: translateY(0) scale(0.97) !important;
}

.spotlight-empty-state {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at center, rgba(37, 99, 235, 0.15) 0%, transparent 70%), #0f172a;
  box-sizing: border-box;
}

.empty-icon-wrapper {
  backdrop-filter: blur(8px);
}
</style>
