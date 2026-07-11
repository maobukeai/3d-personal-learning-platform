<script setup lang="ts">
import { ref, watch, computed, defineAsyncComponent } from 'vue';
import Switch from '@/components/ui/Switch.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import Slider from '@/components/ui/Slider.vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import DropdownMenu from '@/components/ui/DropdownMenu.vue';
import DropdownItem from '@/components/ui/DropdownItem.vue';
import {
  RefreshCw,
  Layers,
  Image as ImageIcon,
  Globe,
  Maximize2,
  Box,
  Settings,
} from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';
import { useLabel } from '@/utils/i18n';
import type { AssetDetailResource } from './types';
import type { ModelViewerExpose, ViewMode, CameraPresetKey } from './types';
const ModelViewer = defineAsyncComponent(() => import('@/components/ModelViewer.vue')); // * * Left-column 3D preview for AssetDetailModal: ModelViewer + Sketchfab-style * floating toolbar (view modes, clay, environment, camera presets, auto-rotate, * scene settings, fullscreen) plus the bilibili video fallback. Owns all * viewer-only interactive state; surfaces screenshot captures to the parent.
const props = defineProps<{ asset: AssetDetailResource }>();
const emit = defineEmits<{ (e: 'screenshot-captured', base64Data: string): void }>();
const label = useLabel();
const activePreviewTab = ref<'3d' | 'video'>('3d');
watch(
  () => props.asset?.id,
  () => {
    activePreviewTab.value = '3d';
  },
);
const modelViewerRef = ref<ModelViewerExpose | null>(null); // Sketchfab interactive 3D rendering modes & scene controls
const currentViewMode = ref<ViewMode>('solid');
const isClayMode = ref(false);
const autoRotate = ref(false);
const currentEnvironment = ref('studio');
const exposure = ref(1.0);
const showGrid = ref(true);
const showAxes = ref(false);
const currentBgColor = ref('#f1f5f9'); // Default to light background
const bgColors = [
  { value: '#f1f5f9', label: '浅灰 (Default)' },
  { value: '#64748b', label: '中灰' },
  { value: '#0f172a', label: '深色' },
  { value: '#ffffff', label: '纯白' },
];
const isModelAsset = computed(() => {
  if (!props.asset) return false;
  const type = (props.asset.type || '').toUpperCase();
  return ['GLB', 'GLTF', 'FBX', 'OBJ', 'STL'].includes(type) || !!props.asset.url?.endsWith('.glb');
});
const toggleAutoRotate = () => {
  autoRotate.value = !autoRotate.value;
};
const handleViewModeChange = (mode: ViewMode) => {
  currentViewMode.value = mode;
  modelViewerRef.value?.setViewMode?.(mode);
};
const toggleClay = () => {
  isClayMode.value = !isClayMode.value;
  modelViewerRef.value?.toggleClayMode?.();
};
const changeEnvironment = (env: string) => {
  currentEnvironment.value = env;
};
const applyCameraPreset = (preset: CameraPresetKey) => {
  if (!modelViewerRef.value?.flyTo) return;
  const target = { x: 0, y: 0, z: 0 };
  let pos = { x: 3, y: 3, z: 3 }; // iso
  if (preset === 'front') pos = { x: 0, y: 0, z: 4.5 };
  if (preset === 'side') pos = { x: 4.5, y: 0, z: 0 };
  if (preset === 'top') pos = { x: 0, y: 4.5, z: 0 };
  modelViewerRef.value.flyTo(pos, target);
};
const triggerFullscreen = () => {
  modelViewerRef.value?.toggleFullscreen?.();
};
const getBilibiliEmbedUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const match = url.match(/video\/(BV[a-zA-Z0-9]+)/i) || url.match(/bvid=(BV[a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return `// player.bilibili.com/player.html?bvid=${match[1]}&page=1&high_quality=1&as_wide=1&autoplay=0&danmaku=0`;
  }
  return undefined;
};
</script>
<template>
  <!-- Preview Mode Selector -->
  <div
    v-if="asset.bilibiliUrl"
    class="flex items-center gap-1 p-0.5 bg-black/20 dark:bg-white/5 backdrop-blur-md rounded-lg border border-white/10 self-start"
  >
    <button
      type="button"
      class="px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border-none"
      :
      class="activePreviewTab === '3d' ? 'bg-teal-500 text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-white'"
      @click="activePreviewTab = '3d'"
    >
      3D 互动预览
    </button>
    <button
      type="button"
      class="px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border-none"
      :
      class="activePreviewTab === 'video' ? 'bg-teal-500 text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-white'"
      @click="activePreviewTab = 'video'"
    >
      视频演示
    </button>
  </div>
  <!-- 3D Preview area -->
  <div
    class="relative w-full aspect-video sm:h-[400px] rounded-xl overflow-hidden border border-white/10 bg-slate-950/40 flex items-center justify-center group"
  >
    <iframe
      v-if="activePreviewTab === 'video' && getBilibiliEmbedUrl(asset.bilibiliUrl)"
      :src="getBilibiliEmbedUrl(asset.bilibiliUrl)"
      scrolling="no"
      border="0"
      frameborder="no"
      framespacing="0"
      allowfullscreen="true"
      class="w-full h-full absolute inset-0 z-20"
    ></iframe>
    <ModelViewer
      v-if="activePreviewTab === '3d' && isModelAsset && asset.url"
      ref="modelViewerRef"
      :model-url="getAssetUrl(asset.url)"
      :auto-rotate="autoRotate"
      :show-controls="true"
      :asset-id="asset.id"
      :scene-config="{
        environment: currentEnvironment,
        exposure: exposure,
        bgColor: currentBgColor,
        showGrid: showGrid,
        showAxes: showAxes,
      }"
      :default-camera-pos="asset.defaultCameraPos"
      :default-camera-target="asset.defaultCameraTarget"
      class="w-full h-full viewer-canvas"
      @screenshot-captured="emit('screenshot-captured', $event)"
    />
    <!-- Sketchfab-style Floating Toolbar at the bottom -->
    <div
      v-if="isModelAsset"
      class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/70 border border-white/10 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"
    >
      <!-- View Mode Dropdown -->
      <Tooltip :content="label('渲染/着色模式', 'Rendering Mode')" placement="top">
        <Dropdown trigger="click" @command="(cmd) => handleViewModeChange(cmd as any)">
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <Layers class="h-4 w-4" />
          </button>
          <template #dropdown>
            <DropdownMenu>
              <DropdownItem
                command="solid"
                :
                class="{ 'text-indigo-400 font-bold': currentViewMode === 'solid' && !isClayMode, }"
              >
                {{ label('着色模式 (Solid)', 'Shaded') }}
              </DropdownItem>
              <DropdownItem
                command="wireframe"
                :
                class="{ 'text-indigo-400 font-bold': currentViewMode === 'wireframe' }"
              >
                {{ label('网格线模式 (Wireframe)', 'Wireframe') }}
              </DropdownItem>
              <DropdownItem
                command="solid+wireframe"
                :
                class="{ 'text-indigo-400 font-bold': currentViewMode === 'solid+wireframe', }"
              >
                {{ label('着色+网格线', 'Shaded + Wireframe') }}
              </DropdownItem>
            </DropdownMenu>
          </template>
        </Dropdown>
      </Tooltip>
      <!-- Clay mode toggle -->
      <Tooltip :content="label('白模模式 (Clay)', 'Clay Mode')" placement="top">
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
          :
          class="isClayMode ? 'bg-indigo-500 text-white' : 'hover:bg-white/10 text-white/80 hover:text-white'"
          @click="toggleClay"
        >
          <Box class="h-4 w-4" />
        </button>
      </Tooltip>
      <div class="w-[1px] h-4 bg-white/10"></div>
      <!-- Environment Selection -->
      <Tooltip :content="label('环境与光照', 'Environment Map')" placement="top">
        <Dropdown trigger="click" @command="(cmd) => changeEnvironment(cmd as any)">
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <Globe class="h-4 w-4" />
          </button>
          <template #dropdown>
            <DropdownMenu>
              <DropdownItem
                command="studio"
                :
                class="{ 'text-indigo-400 font-bold': currentEnvironment === 'studio' }"
              >
                {{ label('写字楼影棚 (Studio)', 'Studio') }}
              </DropdownItem>
              <DropdownItem
                command="sunset"
                :
                class="{ 'text-indigo-400 font-bold': currentEnvironment === 'sunset' }"
              >
                {{ label('威尼斯日落 (Sunset)', 'Venice Sunset') }}
              </DropdownItem>
              <DropdownItem
                command="forest"
                :
                class="{ 'text-indigo-400 font-bold': currentEnvironment === 'forest' }"
              >
                {{ label('户外森林 (Forest)', 'Forest') }}
              </DropdownItem>
              <DropdownItem
                command="room"
                :
                class="{ 'text-indigo-400 font-bold': currentEnvironment === 'room' }"
              >
                {{ label('采石场室内 (Room)', 'Room') }}
              </DropdownItem>
            </DropdownMenu>
          </template>
        </Dropdown>
      </Tooltip>
      <div class="w-[1px] h-4 bg-white/10"></div>
      <!-- Preset Camera Angles -->
      <Tooltip :content="label('预设视角', 'Camera Presets')" placement="top">
        <Dropdown trigger="click" @command="(cmd) => applyCameraPreset(cmd as any)">
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw class="h-4 w-4" />
          </button>
          <template #dropdown>
            <DropdownMenu>
              <DropdownItem command="iso">{{ label('等轴视角 (ISO)', 'Isometry') }}</DropdownItem>
              <DropdownItem command="front">{{ label('正前视角 (Front)', 'Front') }}</DropdownItem>
              <DropdownItem command="side">{{ label('侧面视角 (Side)', 'Side') }}</DropdownItem>
              <DropdownItem command="top">{{ label('俯视视角 (Top)', 'Top') }}</DropdownItem>
            </DropdownMenu>
          </template>
        </Dropdown>
      </Tooltip>
      <!-- Auto-Rotate -->
      <Tooltip :content="label('自动旋转', 'Auto Rotate')" placement="top">
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer"
          :
          class="autoRotate ? 'bg-indigo-500 text-white' : 'hover:bg-white/10 text-white/80 hover:text-white'"
          @click="toggleAutoRotate"
        >
          <RefreshCw class="h-4 w-4 animate-spin-slow" : class="{ 'animate-none': !autoRotate }" />
        </button>
      </Tooltip>
      <div class="w-[1px] h-4 bg-white/10"></div>
      <!-- Ground helpers & Background setting dropdown -->
      <Tooltip :content="label('视图与场景设置', 'Scene Settings')" placement="top">
        <Dropdown trigger="click" :hide-on-click="false">
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <Settings class="h-4 w-4" />
          </button>
          <template #dropdown>
            <div
              class="p-4 w-60 bg-slate-900 border border-white/10 rounded-lg text-white/90 flex flex-col gap-3 text-xs text-left shadow-2xl"
            >
              <h4
                class="font-bold text-indigo-400 mb-1 border-b border-white/10 pb-1.5 flex items-center gap-1.5"
              >
                <Settings class="h-3.5 w-3.5" /> {{ label('三维场景设置', '3D Scene Settings') }}
              </h4>
              <!-- Ground Grid Switch -->
              <div class="flex items-center justify-between">
                <span class="text-slate-300 font-semibold">{{
                  label('显示地面网格', 'Ground Grid')
                }}</span>
                <Switch v-model="showGrid" />
              </div>
              <!-- Axes Helper Switch -->
              <div class="flex items-center justify-between">
                <span class="text-slate-300 font-semibold">{{
                  label('显示世界坐标轴', 'Coordinate Axes')
                }}</span>
                <Switch v-model="showAxes" />
              </div>
              <div class="h-[1px] bg-white/10"></div>
              <!-- Background Color Select -->
              <div class="flex flex-col gap-1.5">
                <span class="text-slate-300 font-semibold">{{
                  label('背景色彩', 'Background Color')
                }}</span>
                <div class="flex gap-2">
                  <button
                    v-for="color in bgColors"
                    :key="color.value"
                    class="w-6 h-6 rounded-full border transition-all cursor-pointer"
                    :style="{
                      backgroundColor: color.value,
                      borderColor: currentBgColor === color.value ? '#6366f1' : 'transparent',
                    }"
                    :title="color.label"
                    @click="currentBgColor = color.value"
                  ></button>
                </div>
              </div>
              <div class="h-[1px] bg-white/10"></div>
              <!-- Exposure/Brightness Slider -->
              <div class="flex flex-col gap-1.5">
                <div class="flex justify-between items-center text-slate-300">
                  <span class="font-semibold">{{ label('场景亮度', 'Brightness') }}</span>
                  <span class="text-[10px] font-mono">{{ exposure.toFixed(1) }}x</span>
                </div>
                <Slider
                  v-model="exposure"
                  :min="0.2"
                  :max="2.5"
                  :step="0.1"
                  size="small"
                  class="custom-slider"
                />
              </div>
            </div>
          </template>
        </Dropdown>
      </Tooltip>
      <div class="w-[1px] h-4 bg-white/10"></div>
      <!-- Fullscreen -->
      <Tooltip :content="label('全屏预览', 'Fullscreen')" placement="top">
        <button
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          @click="triggerFullscreen"
        >
          <Maximize2 class="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
    <div v-else-if="asset.thumbnail || asset.thumbnailUrl" class="w-full h-full relative">
      <img
        :src="getAssetUrl(asset.thumbnail || asset.thumbnailUrl)"
        class="w-full h-full object-cover filter blur-md opacity-25 absolute inset-0 scale-105"
        alt="Background blur"
      />
      <img
        :src="getAssetUrl(asset.thumbnail || asset.thumbnailUrl)"
        class="w-full h-full object-contain relative z-10"
        alt="Asset Cover"
      />
    </div>
    <div
      v-else
      class="text-center text-[var(--text-muted)] text-sm flex flex-col items-center gap-2"
    >
      <ImageIcon class="h-10 w-10 text-white/20" />
      <span>{{ label('暂无三维模型预览', 'No 3D Model Preview Available') }}</span>
    </div>
    <!-- Float Badge -->
    <div class="absolute top-3 left-3 z-20 flex gap-2">
      <span
        v-if="asset.status === 'APPROVED'"
        class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold"
      >
        {{ label('已发布', 'Approved') }}
      </span>
      <span
        v-else-if="asset.status === 'PENDING'"
        class="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold"
      >
        {{ label('审核中', 'Pending') }}
      </span>
      <span
        v-else
        class="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-semibold"
      >
        {{ label('未通过', 'Rejected') }}
      </span>
    </div>
  </div>
</template>
<style scoped>
.viewer-canvas :deep(.absolute.right-4.top-4) {
  display: none;
}
@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.animate-spin-slow {
  animation: spin-slow 8s linear infinite;
}
</style>
