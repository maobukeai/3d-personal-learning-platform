<script setup lang="ts">
import { Maximize2, FileArchive, FileCode, Box } from 'lucide-vue-next';
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';

/**
 * AssetCard Component
 * "Pro Studio" style card for 3D assets and materials.
 */
interface Asset {
  id: string;
  title: string;
  thumbnail?: string;
  type: string;
  fileSize?: number;
  format?: string;
  createdAt: string | Date;
}

interface Props {
  asset: Asset;
}

const props = defineProps<Props>();

/**
 * Format file size into human readable string
 */
const formatSize = (bytes?: number) => {
  if (!bytes || bytes === 0) return '---';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Get icon based on file format
 */
const getFormatIcon = (format?: string) => {
  if (!format) return Box;
  const f = format.toLowerCase();
  if (['zip', 'rar', '7z', 'tar'].includes(f)) return FileArchive;
  if (['json', 'js', 'ts', 'py', 'c', 'cpp'].includes(f)) return FileCode;
  return Box;
};
</script>

<template>
  <div
    class="asset-card-container group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-500 hover:-translate-y-1 hover:border-accent/40 hover:shadow-2xl hover:shadow-accent/10"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <!-- Preview Area -->
    <div
      class="preview-area relative aspect-[4/3] w-full overflow-hidden"
      style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(59, 130, 246, 0.08) 100%)"
    >
      <!-- Main Thumbnail -->
      <img
        v-if="asset.thumbnail"
        :src="asset.thumbnail"
        :alt="asset.title"
        class="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
      <img
        v-else
        :src="getDefaultThumbnailUrl(asset.type)"
        :alt="asset.title"
        class="h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-110"
      />

      <!-- Glassmorphism Hover Overlay -->
      <div
        class="absolute inset-0 z-10 flex items-center justify-center opacity-0 backdrop-blur-0 transition-all duration-300 group-hover:opacity-100 group-hover:backdrop-blur-[2px]"
        style="background-color: rgba(var(--bg-card-rgb, 255, 255, 255), 0.1)"
      >
        <div 
          class="flex h-12 w-12 transform scale-50 items-center justify-center rounded-full bg-white/90 shadow-2xl transition-transform duration-300 group-hover:scale-100 dark:bg-zinc-900/90"
        >
          <Maximize2 class="h-5 w-5 text-accent" />
        </div>
      </div>

      <!-- Type Badge -->
      <div 
        class="absolute left-3 top-3 z-20 rounded-lg border border-white/20 bg-black/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white backdrop-blur-md transition-transform duration-300 group-hover:translate-x-1"
      >
        {{ asset.type }}
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex flex-col p-4">
      <h3 
        class="mb-3 line-clamp-1 text-sm font-bold tracking-tight transition-colors group-hover:text-accent"
        style="color: var(--text-primary)"
      >
        {{ asset.title }}
      </h3>

      <!-- Bottom Info Bar -->
      <div class="flex items-center justify-between border-t pt-3" style="border-color: var(--border-base)">
        <!-- File Size -->
        <div class="flex items-center gap-1.5">
          <div class="h-1 w-1 rounded-full bg-accent"></div>
          <span class="text-[10px] font-semibold" style="color: var(--text-secondary)">
            {{ formatSize(asset.fileSize) }}
          </span>
        </div>

        <!-- Format Info -->
        <div class="flex items-center gap-2">
          <component 
            :is="getFormatIcon(asset.format)" 
            class="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-100" 
            style="color: var(--text-secondary)"
          />
          <span class="text-[10px] font-extrabold uppercase tracking-tighter" style="color: var(--text-muted)">
            {{ asset.format || 'GLB' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.asset-card-container {
  /* Added specific styling for better masonry integration */
  width: 100%;
}

.preview-area::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.02);
  pointer-events: none;
}

.dark .preview-area::after {
  box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.2);
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
