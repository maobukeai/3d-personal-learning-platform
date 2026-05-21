<script setup lang="ts">
import { ref, onMounted, computed, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ChevronLeft,
  Download,
  ExternalLink,
  User,
  Calendar,
  HardDrive,
  Tag,
  Sun,
  Box,
  Image as ImageIcon,
  Monitor,
  RefreshCw,
  Paintbrush
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';

const ModelViewer = defineAsyncComponent(() => import('@/components/ModelViewer.vue'));

const route = useRoute();
const router = useRouter();

const assetId = route.params.id as string;
const asset = ref<any>(null);
const isLoading = ref(true);

// Viewer Configuration State
const viewerConfig = ref({
  autoRotate: true,
  viewMode: 'solid' as 'solid' | 'wireframe',
  environment: 'studio',
  exposure: 1.0,
});

const environments = [
  { id: 'studio', name: 'Studio', icon: Monitor },
  { id: 'sunset', name: 'Sunset', icon: Sun },
  { id: 'forest', name: 'Forest', icon: ImageIcon },
  { id: 'room', name: 'Room', icon: Box }
];

const modelViewerRef = ref<any>(null);
const modelStats = ref<any>(null);

const fetchAsset = async () => {
  try {
    const response = await api.get(`/api/assets/${assetId}`);
    asset.value = response.data;
  } catch (error) {
    ElMessage.error('无法加载资产详情');
    router.replace('/assets');
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchAsset();
});

const goBack = () => {
  router.back();
};

const handleDownload = () => {
  if (asset.value?.url) {
    window.open(asset.value.url, '_blank');
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const handleMetadataLoaded = (stats: any) => {
  modelStats.value = stats;
};

const toggleViewMode = () => {
  const newMode = viewerConfig.value.viewMode === 'solid' ? 'wireframe' : 'solid';
  viewerConfig.value.viewMode = newMode;
  if (modelViewerRef.value && modelViewerRef.value.setViewMode) {
    modelViewerRef.value.setViewMode(newMode);
  }
};

const isClayMode = ref(false);
const toggleClayMode = () => {
  if (modelViewerRef.value && modelViewerRef.value.toggleClayMode) {
    modelViewerRef.value.toggleClayMode();
    isClayMode.value = modelViewerRef.value.isClayMode;
  }
};

const parsedFormats = computed(() => {
  if (!asset.value?.formats) return [];
  try {
    return typeof asset.value.formats === 'string'
      ? JSON.parse(asset.value.formats)
      : asset.value.formats;
  } catch (e) {
    return [];
  }
});
</script>

<template>
  <div class="flex flex-col h-full relative overflow-hidden" style="background-color: var(--bg-app); color: var(--text-primary)">
    <!-- Top Navigation Bar -->
    <div class="h-16 shrink-0 flex items-center justify-between px-6 border-b z-20" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex items-center gap-4">
        <button 
          class="p-2 hover:bg-white/10 rounded-xl transition-colors duration-300 group"
          @click="goBack"
        >
          <ChevronLeft class="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div v-if="asset" class="flex flex-col">
          <h1 class="text-sm font-bold truncate max-w-[200px] md:max-w-md">{{ asset.title }}</h1>
          <span class="text-[10px] font-medium" style="color: var(--text-secondary)">{{ asset.type }}</span>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <button 
          class="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-accent to-blue-500 hover:from-blue-500 hover:to-accent text-white rounded-xl text-xs font-black tracking-widest shadow-lg shadow-accent/20 hover:shadow-accent/40 hover:-translate-y-0.5 transition-all duration-300"
          @click="handleDownload"
        >
          <template v-if="asset?.type === 'LINK'">
            <ExternalLink class="w-4 h-4" />
            <span>访问外链</span>
          </template>
          <template v-else>
            <Download class="w-4 h-4" />
            <span>立即下载</span>
          </template>
        </button>
      </div>
    </div>

    <!-- Main Content Split -->
    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
      <!-- Loading State -->
      <div v-if="isLoading" class="absolute inset-0 z-30 flex flex-col items-center justify-center" style="background-color: var(--bg-app)">
        <div class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="font-medium text-sm" style="color: var(--text-secondary)">加载资产中...</p>
      </div>

      <!-- Left: 3D Viewer Area -->
      <div class="flex-1 relative bg-gradient-to-b from-slate-900 to-black overflow-hidden group">
        <template v-if="asset">
          <ModelViewer 
            v-if="['GLB', 'GLTF', 'FBX', 'OBJ', 'STL'].includes(asset.type)"
            ref="modelViewerRef"
            :model-url="asset.url" 
            :auto-rotate="viewerConfig.autoRotate"
            :scene-config="{ environment: viewerConfig.environment, exposure: viewerConfig.exposure }"
            class="w-full h-full"
            @metadata-loaded="handleMetadataLoaded"
          />
          <div v-else class="w-full h-full flex items-center justify-center relative">
            <div class="absolute inset-0 z-0 opacity-30">
              <img v-if="asset.thumbnail" :src="asset.thumbnail" class="w-full h-full object-cover blur-3xl scale-110" />
            </div>
            <img v-if="asset.thumbnail" :src="asset.thumbnail" alt="Preview" class="relative z-10 max-w-full max-h-full object-contain drop-shadow-2xl px-8" />
            <div v-else class="relative z-10 flex flex-col items-center" style="color: var(--text-secondary)">
              <Box class="w-20 h-20 mb-4 opacity-50 drop-shadow-md" />
              <span class="text-lg font-bold tracking-widest uppercase">暂无预览图</span>
            </div>
          </div>
        </template>
        
        <!-- Viewer Tools Overlay -->
        <div v-if="asset && ['GLB', 'GLTF', 'FBX', 'OBJ', 'STL'].includes(asset.type)" class="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center gap-2 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button 
            class="p-2.5 rounded-xl transition-all duration-300"
            :class="viewerConfig.autoRotate ? 'bg-accent text-white' : 'hover:bg-white/10 text-slate-400'"
            title="自动旋转"
            @click="viewerConfig.autoRotate = !viewerConfig.autoRotate"
          >
            <RefreshCw class="w-4 h-4" :class="viewerConfig.autoRotate ? 'animate-spin-slow' : ''" />
          </button>
          
          <div class="w-px h-6 bg-white/10 mx-1"></div>
          
          <button 
            class="p-2.5 rounded-xl transition-all duration-300"
            :class="viewerConfig.viewMode === 'wireframe' ? 'bg-accent text-white' : 'hover:bg-white/10 text-slate-400'"
            title="线框模式"
            @click="toggleViewMode"
          >
            <Box class="w-4 h-4" />
          </button>

          <div class="w-px h-6 bg-white/10 mx-1"></div>

          <button 
            class="p-2.5 rounded-xl transition-all duration-300"
            :class="isClayMode ? 'bg-accent text-white' : 'hover:bg-white/10 text-slate-400'"
            title="材质白模模式 (用于解决缺贴图变黑/隐形)"
            @click="toggleClayMode"
          >
            <Paintbrush class="w-4 h-4" />
          </button>
          
          <div class="w-px h-6 bg-white/10 mx-1"></div>
          
          <!-- Environment Selector -->
          <div class="flex items-center gap-1">
            <button 
              v-for="env in environments" 
              :key="env.id"
              class="p-2 rounded-xl transition-all duration-300"
              :class="viewerConfig.environment === env.id ? 'bg-white/20 text-white shadow-inner' : 'hover:bg-white/10 text-slate-400'"
              :title="env.name"
              @click="viewerConfig.environment = env.id"
            >
              <component :is="env.icon" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Right: Info Panel -->
      <div class="w-full lg:w-96 shrink-0 border-l flex flex-col overflow-y-auto relative" style="background-color: var(--bg-card); border-color: var(--border-base)">
        <div v-if="asset" class="p-8 space-y-8">
          <!-- Header Info -->
          <div>
            <h2 class="text-2xl font-black mb-3">{{ asset.title }}</h2>
            <p class="text-sm leading-relaxed" style="color: var(--text-secondary)">{{ asset.description || '这件惊艳的作品暂未提供任何描述信息。' }}</p>
          </div>

          <!-- Metadata Grid -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex items-center gap-3 p-3.5 rounded-xl border transition-colors" style="background-color: var(--bg-app); border-color: var(--border-base)">
              <div class="p-2 rounded-lg bg-accent/20 text-accent">
                <User class="w-4 h-4" />
              </div>
              <span class="text-xs font-bold truncate">{{ asset.user?.name || '未知用户' }}</span>
            </div>
            <div class="flex items-center gap-3 p-3.5 rounded-xl border transition-colors" style="background-color: var(--bg-app); border-color: var(--border-base)">
              <div class="p-2 rounded-lg bg-accent/20 text-accent">
                <Tag class="w-4 h-4" />
              </div>
              <span class="text-xs font-bold truncate">{{ asset.category?.name || '未分类' }}</span>
            </div>
            <div class="flex items-center gap-3 p-3.5 rounded-xl border transition-colors" style="background-color: var(--bg-app); border-color: var(--border-base)">
              <div class="p-2 rounded-lg bg-accent/20 text-accent">
                <HardDrive class="w-4 h-4" />
              </div>
              <span class="text-xs font-bold">{{ asset.size ? `${asset.size} MB` : '未知大小' }}</span>
            </div>
            <div class="flex items-center gap-3 p-3.5 rounded-xl border transition-colors" style="background-color: var(--bg-app); border-color: var(--border-base)">
              <div class="p-2 rounded-lg bg-accent/20 text-accent">
                <Calendar class="w-4 h-4" />
              </div>
              <span class="text-xs font-bold">{{ formatDate(asset.createdAt) }}</span>
            </div>
          </div>

          <!-- 3D Model Stats (if GLB/GLTF) -->
          <div v-if="modelStats" class="space-y-4">
            <h3 class="text-[10px] font-black uppercase tracking-[0.2em]" style="color: var(--text-secondary)">模型数据</h3>
            <div class="grid grid-cols-3 gap-2">
              <div class="flex flex-col items-center justify-center p-3 rounded-xl border" style="background-color: var(--bg-app); border-color: var(--border-base)">
                <span class="text-lg font-black mb-1">{{ (modelStats.vertices / 1000).toFixed(1) }}k</span>
                <span class="text-[9px] font-bold uppercase" style="color: var(--text-secondary)">顶点数</span>
              </div>
              <div class="flex flex-col items-center justify-center p-3 rounded-xl border" style="background-color: var(--bg-app); border-color: var(--border-base)">
                <span class="text-lg font-black mb-1">{{ (modelStats.faces / 1000).toFixed(1) }}k</span>
                <span class="text-[9px] font-bold uppercase" style="color: var(--text-secondary)">面数</span>
              </div>
              <div class="flex flex-col items-center justify-center p-3 rounded-xl border" style="background-color: var(--bg-app); border-color: var(--border-base)">
                <span class="text-lg font-black mb-1">{{ modelStats.animations }}</span>
                <span class="text-[9px] font-bold uppercase" style="color: var(--text-secondary)">动画数</span>
              </div>
            </div>
          </div>

          <!-- Parsed Formats -->
          <div v-if="parsedFormats.length > 0" class="space-y-4">
            <h3 class="text-[10px] font-black uppercase tracking-[0.2em]" style="color: var(--text-secondary)">包含格式</h3>
            <div class="flex flex-wrap gap-2">
              <div 
                v-for="format in parsedFormats" 
                :key="format"
                class="px-3 py-1.5 border rounded-lg text-xs font-bold tracking-wider"
                style="background-color: var(--bg-app); border-color: var(--border-base); color: var(--text-secondary)"
              >
                {{ format }}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-spin-slow {
  animation: spin 3s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
