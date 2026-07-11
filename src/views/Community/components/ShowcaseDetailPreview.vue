<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent } from 'vue';
import { ChevronLeft, ChevronRight, Type, Download } from 'lucide-vue-next';
import { formatCompactNumber as formatNumber } from '@/utils/format';
import { getAssetUrl } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import type { ShowcaseItem } from './showcaseTypes';
import { isVideoUrl } from './showcaseHelpers';
import type { Asset } from '@/types';
const props = defineProps<{ item: ShowcaseItem }>();
const authStore = useAuthStore();
const ModelViewer = defineAsyncComponent(() => import('@/components/ModelViewer.vue'));
const currentImageIndex = ref(0);
const activeMediaTab = ref<'renders' | '3d' | 'video'>('renders');
const selectedModelId = ref<string>('');
const availableModels = computed<Asset[]>(() => {
  const models: Asset[] = [];
  if (props.item.linkedAssets && props.item.linkedAssets.length > 0) {
    models.push(...props.item.linkedAssets);
  } else if (props.item.asset) {
    models.push(props.item.asset);
  }
  return models;
});
const activeModel = computed(() => {
  if (availableModels.value.length === 0) return null;
  return (
    availableModels.value.find((m) => m.id === selectedModelId.value) || availableModels.value[0]
  );
});
const detailImages = computed(() => {
  const images: string[] = [];
  if (props.item.thumbnailUrl) images.push(getAssetUrl(props.item.thumbnailUrl));
  if (props.item.images) {
    try {
      const parsed = JSON.parse(props.item.images);
      if (Array.isArray(parsed)) {
        parsed.forEach((url) => {
          const normalized = getAssetUrl(String(url));
          if (normalized) images.push(normalized);
        });
      }
    } catch {}
  }
  return Array.from(new Set(images.filter(Boolean)));
});
const currentDetailImage = computed(() => detailImages.value[currentImageIndex.value] ?? '');
const isIframeVideo = computed(() => {
  const url = props.item.videoUrl;
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return (
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com') ||
      hostname === 'bilibili.com' ||
      hostname.endsWith('.bilibili.com') ||
      hostname === 'vimeo.com' ||
      hostname.endsWith('.vimeo.com') ||
      hostname === 'player.vimeo.com' ||
      hostname.endsWith('.player.vimeo.com')
    );
  } catch {
    return false;
  }
});
const prevImage = () => {
  if (currentImageIndex.value > 0) currentImageIndex.value--;
};
const nextImage = () => {
  if (currentImageIndex.value < detailImages.value.length - 1) currentImageIndex.value++;
};
watch(
  () => props.item?.id,
  () => {
    currentImageIndex.value = 0;
    activeMediaTab.value = 'renders';
    if (availableModels.value.length > 0) {
      selectedModelId.value = availableModels.value[0].id;
    } else {
      selectedModelId.value = '';
    }
  },
  { immediate: true },
);
</script>
<template>
  <section class="detail-media-panel w-full flex flex-col gap-4 mb-6">
    <!-- Media Tab Selector -->
    <div
      v-if="availableModels.length > 0 || item.videoUrl"
      class="flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl mb-3"
    >
      <button
        type="button"
        class="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer"
        :class="
          activeMediaTab === 'renders'
            ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400 font-extrabold'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-transparent'
        "
        @click="activeMediaTab = 'renders'"
      >
        效果图册
      </button>
      <button
        v-if="availableModels.length > 0"
        type="button"
        class="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer"
        :class="
          activeMediaTab === '3d'
            ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400 font-extrabold'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-transparent'
        "
        @click="activeMediaTab = '3d'"
      >
        3D交互
      </button>
      <button
        v-if="item.videoUrl"
        type="button"
        class="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer"
        :class="
          activeMediaTab === 'video'
            ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400 font-extrabold'
            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-transparent'
        "
        @click="activeMediaTab = 'video'"
      >
        视频演示
      </button>
    </div>
    <!-- Media Content Panel -->
    <div v-if="activeMediaTab === 'renders'">
      <div v-if="currentDetailImage" class="detail-media">
        <video
          v-if="isVideoUrl(currentDetailImage)"
          :src="currentDetailImage"
          class="w-full h-full object-contain"
          controls
        ></video>
        <img v-else :src="currentDetailImage" :alt="item.title" />
        <button
          v-if="currentImageIndex > 0"
          type="button"
          class="gallery-button left"
          title="上一张"
          @click="prevImage"
        >
          <ChevronLeft class="w-5 h-5" />
        </button>
        <button
          v-if="currentImageIndex < detailImages.length - 1"
          type="button"
          class="gallery-button right"
          title="下一张"
          @click="nextImage"
        >
          <ChevronRight class="w-5 h-5" />
        </button>
      </div>
      <div v-else class="detail-media detail-media--empty">
        <Type class="w-10 h-10" /> <span>文本作品</span>
      </div>
      <div v-if="detailImages.length > 1" class="thumbnail-strip">
        <button
          v-for="(image, idx) in detailImages"
          :key="image"
          type="button"
          :class="{ active: currentImageIndex === idx }"
          @click="currentImageIndex = idx"
        >
          <video
            v-if="isVideoUrl(image)"
            :src="image"
            class="w-full h-full object-cover"
            muted
            playsinline
          ></video>
          <img v-else :src="image" :alt="`${item.title} ${idx + 1}`" />
        </button>
      </div>
    </div>
    <!-- 3D Interactive Viewport -->
    <div v-else-if="activeMediaTab === '3d' && activeModel">
      <div
        class="relative w-full aspect-video lg:aspect-[21/9] max-h-[420px] rounded-2xl overflow-hidden bg-slate-950 border border-slate-200/50 dark:border-slate-800/50 mb-3"
      >
        <ModelViewer
          :model-url="activeModel.url"
          :default-camera-pos="activeModel.defaultCameraPos"
          :default-camera-target="activeModel.defaultCameraTarget"
          :scene-config="{
            environment: activeModel.defaultEnvironment || 'sunset',
            exposure: activeModel.defaultExposure || 1.0,
            showGrid: true,
          }"
          show-controls
          class="w-full h-full"
        />
      </div>
      <!-- Multiple Models Selector -->
      <div
        v-if="availableModels.length > 1"
        class="model-selector-strip mt-3 mb-3 flex items-center gap-1.5 overflow-x-auto p-1 scrollbar-hide"
      >
        <span
          class="text-[10px] uppercase font-black tracking-widest text-slate-400 mr-1 flex-shrink-0"
          >切换模型:</span
        >
        <button
          v-for="model in availableModels"
          :key="model.id"
          type="button"
          class="px-3 py-1 rounded-lg text-xs font-bold transition-all border whitespace-nowrap cursor-pointer"
          :class="
            selectedModelId === model.id
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
          "
          @click="selectedModelId = model.id"
        >
          {{ model.title }}
        </button>
      </div>
      <!-- Model Specs Card -->
      <div
        class="model-specs-card p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-2"
      >
        <div class="flex items-center justify-between">
          <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            3D 规格参数
          </h4>
          <a
            v-if="activeModel.isFree || authStore.user"
            :href="getAssetUrl(activeModel.url)"
            download
            class="text-[10px] font-bold text-indigo-500 hover:underline flex items-center gap-1"
          >
            <Download class="w-3.5 h-3.5" /> 下载模型
          </a>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="flex flex-col">
            <span class="text-[9px] text-slate-400 uppercase font-semibold">名称</span>
            <strong class="truncate font-semibold mt-0.5" style="color: var(--text-primary)">{{
              activeModel.title
            }}</strong>
          </div>
          <div class="flex flex-col">
            <span class="text-[9px] text-slate-400 uppercase font-semibold">类型</span>
            <strong class="font-semibold mt-0.5" style="color: var(--text-primary)">{{
              activeModel.type
            }}</strong>
          </div>
          <div class="flex flex-col">
            <span class="text-[9px] text-slate-400 uppercase font-semibold">顶点数</span>
            <strong class="font-semibold mt-0.5" style="color: var(--text-primary)">{{
              activeModel.vertices ? formatNumber(activeModel.vertices) : '---'
            }}</strong>
          </div>
          <div class="flex flex-col">
            <span class="text-[9px] text-slate-400 uppercase font-semibold">三角面数</span>
            <strong class="font-semibold mt-0.5" style="color: var(--text-primary)">{{
              activeModel.faces ? formatNumber(activeModel.faces) : '---'
            }}</strong>
          </div>
        </div>
      </div>
    </div>
    <!-- Video Viewport -->
    <div v-else-if="activeMediaTab === 'video' && item.videoUrl">
      <div
        class="relative w-full aspect-video rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-200/50 dark:border-slate-800/50"
      >
        <iframe
          v-if="isIframeVideo"
          :src="item.videoUrl"
          frameborder="0"
          allow="
            accelerometer;
            autoplay;
            clipboard-write;
            encrypted-media;
            gyroscope;
            picture-in-picture;
          "
          allowfullscreen
          class="w-full h-full"
        ></iframe>
        <video v-else :src="item.videoUrl" controls class="w-full h-full"></video>
      </div>
    </div>
  </section>
</template>
<style scoped>
.detail-media {
  position: relative;
  width: 100%;
  min-height: 280px;
  max-height: 460px;
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-base);
  margin-bottom: 12px;
}
.detail-media img,
.detail-media video {
  max-width: 100%;
  max-height: 460px;
  width: auto;
  height: auto;
  object-fit: contain;
}
.detail-media--empty {
  flex-direction: column;
  gap: 8px;
  color: var(--text-muted);
  font-size: 11px;
}
.thumbnail-strip {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
}
.thumbnail-strip::-webkit-scrollbar {
  height: 4px;
}
.thumbnail-strip::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 4px;
}
.thumbnail-strip button {
  flex-shrink: 0;
  width: 64px;
  height: 36px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  background: #000;
  padding: 0;
  cursor: pointer;
  transition: all 0.2s;
}
.thumbnail-strip button:hover {
  opacity: 0.8;
}
.thumbnail-strip button.active {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
.thumbnail-strip button img,
.thumbnail-strip button video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
