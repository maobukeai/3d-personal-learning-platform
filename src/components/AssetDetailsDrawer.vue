<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();

const ModelViewer = defineAsyncComponent(() => import('./ModelViewer.vue'));
import { 
  X, 
  Download, 
  User, 
  Tag, 
  HardDrive, 
  Calendar,
  FileBox,
  FileCode,
  Package,
  FileArchive,
  Layers,
  ExternalLink
} from 'lucide-vue-next';

const workspaceStore = useWorkspaceStore();

const asset = computed(() => workspaceStore.selectedAsset);
const isOpen = computed({
  get: () => workspaceStore.isDetailDrawerOpen,
  set: (val) => {
    if (!val) workspaceStore.closeDetails();
  }
});

const parsedFormats = computed(() => {
  if (!asset.value?.formats) return [];
  try {
    return typeof asset.value.formats === 'string' 
      ? JSON.parse(asset.value.formats) 
      : asset.value.formats;
  } catch (e) {
    console.error('Failed to parse asset formats:', e);
    return [];
  }
});

const getFormatIcon = (format: string) => {
  const f = format.toUpperCase();
  if (['FBX', 'OBJ', 'BLEND'].includes(f)) return FileBox;
  if (['MAX', 'C4D', 'MAYA'].includes(f)) return Package;
  if (['ZTL', 'SPP'].includes(f)) return Layers;
  if (f === 'TEXTURES') return FileArchive;
  return FileCode;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale.value === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};


const handleDownload = () => {
  if (asset.value?.url) {
    window.open(asset.value.url, '_blank', 'noopener,noreferrer');
  }
};
</script>

<template>
  <el-drawer
    v-model="isOpen"
    direction="rtl"
    size="400px"
    :with-header="false"
    class="asset-details-drawer"
  >
    <div v-if="asset" class="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
      <!-- Top: Preview -->
      <div class="h-72 relative bg-slate-900 border-b border-white/10 shadow-2xl overflow-hidden shrink-0">
        <!-- Background Blur Effect -->
        <div class="absolute inset-0 z-0 opacity-40">
          <img v-if="asset.thumbnail" alt="" :src="asset.thumbnail" class="w-full h-full object-cover blur-xl scale-110" />
        </div>

        <div class="relative z-10 w-full h-full bg-black/40 backdrop-blur-sm">
          <ModelViewer v-if="asset.type === 'GLB' || asset.type === 'GLTF'" :model-url="asset.url" auto-rotate class="w-full h-full" />
          <div v-else class="w-full h-full flex items-center justify-center">
            <img v-if="asset.thumbnail" :src="asset.thumbnail" alt="Preview" class="max-w-full max-h-full object-contain drop-shadow-2xl" />
            <div v-else class="text-slate-400 flex flex-col items-center">
              <component :is="getFormatIcon(asset.type)" class="w-16 h-16 mb-4 opacity-50 drop-shadow-md" />
              <span class="text-sm font-bold tracking-widest uppercase">{{ t('assets.noPreview') }}</span>
            </div>
          </div>
        </div>

        <!-- Gradient Overlay -->
        <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950 to-transparent z-10 pointer-events-none"></div>

        <button type="button" class="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-all duration-300 z-20 hover:scale-110 hover:rotate-90 border border-white/10 shadow-lg" @click="workspaceStore.closeDetails()">
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-8 space-y-8 relative">
        <!-- Glow effect behind content -->
        <div class="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full glass-glow-md pointer-events-none"></div>

        <div class="relative z-10">
          <h2 class="text-2xl font-black mb-3 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">{{ asset.title }}</h2>
          <p class="text-slate-400 text-sm leading-relaxed">{{ asset.description || t('assets.noDescription') }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3 relative z-10">
          <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300">
            <div class="p-2 rounded-lg bg-accent/20 text-accent">
              <User class="w-4 h-4" />
            </div>
            <span class="text-sm font-medium text-slate-200 truncate">{{ asset.user?.name || t('assets.unknownUser') }}</span>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300">
            <div class="p-2 rounded-lg bg-accent/20 text-accent">
              <Tag class="w-4 h-4" />
            </div>
            <span class="text-sm font-medium text-slate-200 truncate">{{ asset.category?.name || t('assets.uncategorized') }}</span>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300">
            <div class="p-2 rounded-lg bg-accent/20 text-accent">
              <HardDrive class="w-4 h-4" />
            </div>
            <span class="text-sm font-medium text-slate-200">{{ asset.size ? `${asset.size} MB` : t('assets.unknownSize') }}</span>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors duration-300">
            <div class="p-2 rounded-lg bg-accent/20 text-accent">
              <Calendar class="w-4 h-4" />
            </div>
            <span class="text-sm font-medium text-slate-200">{{ formatDate(asset.createdAt) }}</span>
          </div>
        </div>

        <!-- Formats Section -->
        <div v-if="parsedFormats.length > 0" class="relative z-10">
          <h3 class="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">{{ t('assets.includedFormats') }}</h3>
          <div class="flex flex-wrap gap-2">
            <div 
              v-for="format in parsedFormats" 
              :key="format"
              class="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold tracking-wider hover:border-accent/50 hover:bg-accent/10 transition-all duration-300 shadow-lg"
            >
              <component :is="getFormatIcon(format)" class="w-3.5 h-3.5 text-accent" />
              <span>{{ format }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="p-6 bg-slate-950/80 backdrop-blur-xl border-t border-white/10 flex gap-4 shrink-0 relative z-20">
        <button type="button" class="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-blue-500 hover:from-blue-500 hover:to-accent text-white py-3.5 rounded-2xl font-black text-sm tracking-widest shadow-[0_10px_20px_-10px_rgba(var(--accent-rgb),0.6)] hover:shadow-[0_15px_30px_-10px_rgba(var(--accent-rgb),0.8)] hover:-translate-y-0.5 transition-all duration-500 overflow-hidden relative group" @click="handleDownload">
          <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
          <span class="relative z-10 flex items-center gap-2">
            <template v-if="asset.type === 'LINK'">
              <ExternalLink class="w-5 h-5" />
              {{ t('assets.visitExternalLink') }}
            </template>
            <template v-else>
              <Download class="w-5 h-5" />
              {{ t('assets.downloadNow') }}
            </template>
          </span>
        </button>
      </div>
    </div>
  </el-drawer>
</template>

<style>
.asset-details-drawer .el-drawer__body {
  padding: 0;
  background-color: #020617;
}
</style>
