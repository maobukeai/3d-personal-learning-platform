<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  X,
  Clock,
  Eye,
  ExternalLink,
  ArrowRight,
  Sparkles,
  Tag,
  FolderTree,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Layers,
  Loader2,
  CheckCircle2,
} from 'lucide-vue-next';
import { formatDate } from '@/utils/format';
import { parseTags } from '@/utils/tags';
import { getAssetUrl } from '@/utils/api';
import { useMirrorStore, type MirrorResource } from '@/stores/mirror';

const props = defineProps<{
  resource: MirrorResource | null;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void;
  (e: 'navigate', resourceId: string): void;
}>();

const mirrorStore = useMirrorStore();
const detailData = ref<any>(null);
const isLoadingDetail = ref(false);
const isLightboxOpen = ref(false);
const zoomLevel = ref(1);

watch(
  () => [props.open, props.resource?.id],
  async ([isOpen, id]) => {
    if (isOpen && id) {
      detailData.value = props.resource;
      isLoadingDetail.value = true;
      try {
        const full = await mirrorStore.fetchResource(id as string);
        if (full) detailData.value = full;
      } catch {
        // Fallback to basic props.resource
      } finally {
        isLoadingDetail.value = false;
      }
    } else {
      isLightboxOpen.value = false;
      zoomLevel.value = 1;
    }
  },
  { immediate: true },
);

const currentResource = computed(() => detailData.value || props.resource);

function handleClose() {
  isLightboxOpen.value = false;
  emit('update:open', false);
}

function handleGoDetail() {
  if (currentResource.value) {
    emit('navigate', currentResource.value.id);
    handleClose();
  }
}

function openLightbox() {
  if (currentResource.value?.thumbnailUrl) {
    zoomLevel.value = 1;
    isLightboxOpen.value = true;
  }
}

function closeLightbox() {
  isLightboxOpen.value = false;
  zoomLevel.value = 1;
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (isLightboxOpen.value) closeLightbox();
    else if (props.open) handleClose();
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));
</script>

<template>
  <div v-if="open && currentResource" class="fixed inset-0 z-50 overflow-hidden">
    <!-- Backdrop overlay -->
    <div
      class="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
      @click="handleClose"
    />

    <!-- Drawer container -->
    <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
      <div
        class="w-screen max-w-lg bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between transform transition-transform animate-slide-left overflow-y-auto"
      >
        <!-- Header -->
        <div
          class="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10"
        >
          <div class="flex items-center gap-2">
            <span class="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Sparkles class="w-4 h-4" />
            </span>
            <span class="text-sm font-bold text-slate-900 dark:text-white"
              >资源快速预览 &amp; 详情</span
            >
            <Loader2 v-if="isLoadingDetail" class="w-3.5 h-3.5 animate-spin text-blue-500 ml-1" />
          </div>

          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            @click="handleClose"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body Content -->
        <div class="p-5 md:p-6 space-y-5 flex-1">
          <!-- Thumbnail Image (Clickable for Lightbox Zoom) -->
          <div
            class="group relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700/80 cursor-zoom-in"
            title="点击放大查看高清大图"
            @click="openLightbox"
          >
            <img
              v-if="currentResource.thumbnailUrl"
              :src="getAssetUrl(currentResource.thumbnailUrl)"
              :alt="currentResource.title"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600"
            >
              <ExternalLink class="w-10 h-10" />
            </div>

            <!-- Hover overlay indicator -->
            <div
              class="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold backdrop-blur-[1px]"
            >
              <Maximize2 class="w-4 h-4" />
              <span>点击全屏放大</span>
            </div>
          </div>

          <!-- Title & Category -->
          <div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
              <span
                v-if="currentResource.category"
                class="px-2.5 py-0.5 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20"
              >
                <FolderTree class="w-3 h-3 inline mr-1" />
                {{ currentResource.category.name }}
              </span>
              <span
                v-if="currentResource.hasLinks || currentResource.contentUrl"
                class="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 flex items-center gap-1"
              >
                <CheckCircle2 class="w-3 h-3" />
                资源链接有效
              </span>
            </div>

            <h2 class="text-base md:text-lg font-black text-slate-900 dark:text-white leading-snug">
              {{ currentResource.title }}
            </h2>
          </div>

          <!-- Meta stats -->
          <div
            class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800"
          >
            <div v-if="currentResource.publishedAt" class="flex items-center gap-1.5">
              <Clock class="w-3.5 h-3.5 text-slate-400" />
              <span>发布于 {{ formatDate(currentResource.publishedAt) }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <Eye class="w-3.5 h-3.5 text-slate-400" />
              <span>{{ currentResource.viewCount }} 次浏览</span>
            </div>
          </div>

          <!-- Description & Detail Content -->
          <div class="space-y-2">
            <h4
              class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5"
            >
              <FileText class="w-3.5 h-3.5 text-blue-500" />
              资源详细说明
            </h4>

            <div
              class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-56 overflow-y-auto border border-slate-100 dark:border-slate-800/60 whitespace-pre-line"
            >
              {{
                currentResource.description ||
                '该资源包含高清教学课件、工程文件或模型材质资产，点击下方按钮可进入详情页高速获取。'
              }}
            </div>
          </div>

          <!-- Tags -->
          <div v-if="parseTags(currentResource.tags).length > 0" class="space-y-2">
            <h4
              class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5"
            >
              <Tag class="w-3.5 h-3.5 text-blue-500" />
              关联标签
            </h4>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="t in parseTags(currentResource.tags)"
                :key="t"
                class="px-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 font-medium"
              >
                {{ t }}
              </span>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div
          class="p-4 md:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex items-center gap-3 sticky bottom-0 backdrop-blur-md"
        >
          <button
            type="button"
            class="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
            @click="handleGoDetail"
          >
            <span>进入资源完整详情页</span>
            <ArrowRight class="w-4 h-4" />
          </button>
          <button
            type="button"
            class="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
            @click="handleClose"
          >
            关闭
          </button>
        </div>
      </div>
    </div>

    <!-- Fullscreen Image Lightbox Modal -->
    <div
      v-if="isLightboxOpen && currentResource?.thumbnailUrl"
      class="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in p-4 select-none"
      @click.self="closeLightbox"
    >
      <!-- Lightbox Controls Top Bar -->
      <div class="absolute top-4 right-4 flex items-center gap-2 z-70">
        <button
          type="button"
          class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="放大"
          @click.stop="zoomLevel = Math.min(2.5, zoomLevel + 0.25)"
        >
          <ZoomIn class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="缩小"
          @click.stop="zoomLevel = Math.max(0.75, zoomLevel - 0.25)"
        >
          <ZoomOut class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="p-2 rounded-xl bg-white/10 hover:bg-red-500/80 text-white transition-colors ml-2"
          title="关闭大图 (ESC)"
          @click.stop="closeLightbox"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Image Canvas -->
      <div
        class="max-w-[92vw] max-h-[85vh] flex items-center justify-center overflow-hidden transition-transform duration-200"
        :style="{ transform: `scale(${zoomLevel})` }"
      >
        <img
          :src="getAssetUrl(currentResource.thumbnailUrl)"
          :alt="currentResource.title"
          class="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
          @click.stop
        />
      </div>

      <div class="absolute bottom-4 text-center px-4 max-w-xl">
        <p class="text-xs text-white/80 font-medium truncate">{{ currentResource.title }}</p>
      </div>
    </div>
  </div>
</template>
