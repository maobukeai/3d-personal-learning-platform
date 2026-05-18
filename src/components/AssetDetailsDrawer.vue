<script setup lang="ts">
import { computed } from 'vue';
import { useWorkspaceStore } from '@/stores/workspace';
import ModelViewer from './ModelViewer.vue';
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
  Layers
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
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const handleDownload = () => {
  if (asset.value?.url) {
    window.open(asset.value.url, '_blank');
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
      <!-- Top: 3D Preview -->
      <div class="h-64 bg-slate-900 relative">
        <ModelViewer :model-url="asset.url" auto-rotate />
        <button 
          @click="workspaceStore.closeDetails()"
          class="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 rounded-full transition-colors z-10"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h2 class="text-xl font-bold mb-2">{{ asset.title }}</h2>
          <p class="text-slate-400 text-sm leading-relaxed">{{ asset.description || '暂无描述' }}</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex items-center gap-3 text-sm text-slate-300">
            <User class="w-4 h-4 text-accent" />
            <span>{{ asset.user?.name || '未知用户' }}</span>
          </div>
          <div class="flex items-center gap-3 text-sm text-slate-300">
            <Tag class="w-4 h-4 text-accent" />
            <span>{{ asset.category?.name || '未分类' }}</span>
          </div>
          <div class="flex items-center gap-3 text-sm text-slate-300">
            <HardDrive class="w-4 h-4 text-accent" />
            <span>{{ asset.size ? `${asset.size} MB` : '未知大小' }}</span>
          </div>
          <div class="flex items-center gap-3 text-sm text-slate-300">
            <Calendar class="w-4 h-4 text-accent" />
            <span>{{ formatDate(asset.createdAt) }}</span>
          </div>
        </div>

        <!-- Formats Section -->
        <div v-if="parsedFormats.length > 0">
          <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">包含格式</h3>
          <div class="flex flex-wrap gap-2">
            <div 
              v-for="format in parsedFormats" 
              :key="format"
              class="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-white/5 rounded-lg text-xs"
            >
              <component :is="getFormatIcon(format)" class="w-3.5 h-3.5 text-accent" />
              <span>{{ format }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="p-6 bg-slate-900/50 border-t border-white/5 flex gap-3">
        <button 
          @click="handleDownload"
          class="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white py-3 rounded-xl font-bold transition-colors"
        >
          <Download class="w-5 h-5" />
          立即下载
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
