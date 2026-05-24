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
    class="asset-card-container group relative flex flex-col overflow-hidden rounded-xl border bg-white/50 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:scale-[1.01] hover:border-accent/50 hover:shadow-[0_15px_30px_-10px_rgba(var(--accent-rgb),0.25)] dark:bg-slate-900/50"
    style="border-color: var(--border-base)"
  >
    <!-- Preview Area -->
    <div
      class="preview-area relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800"
    >
      <!-- Main Thumbnail -->
      <img
        v-if="asset.thumbnail"
        :src="asset.thumbnail"
        :alt="asset.title"
        class="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
      <img
        v-else
        :src="getDefaultThumbnailUrl(asset.type)"
        :alt="asset.title"
        class="h-full w-full object-cover opacity-60 transition-transform duration-700 ease-out group-hover:scale-105"
      />

      <!-- Gradient Overlay for Contrast -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 opacity-60 transition-opacity duration-500 group-hover:opacity-80"></div>

      <!-- Glassmorphism Hover Overlay -->
      <div
        class="absolute inset-0 z-10 flex items-center justify-center opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:opacity-100"
      >
        <div 
          class="flex h-10 w-10 transform scale-50 items-center justify-center rounded-full bg-white/20 shadow-[0_0_20px_rgba(255,255,255,0.2)] backdrop-blur-md border border-white/30 transition-all duration-500 delay-75 group-hover:scale-100 dark:bg-black/40"
        >
          <Maximize2 class="h-4.5 w-4.5 text-white drop-shadow-md" />
        </div>
      </div>

      <!-- Type Badge -->
      <div 
        class="absolute left-2 top-2 z-20 rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md transition-transform duration-500 group-hover:translate-x-0.5 shadow-md"
      >
        {{ asset.type }}
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex flex-col p-2.5 sm:p-3 z-20 relative bg-white dark:bg-slate-900 transition-colors duration-500 group-hover:bg-transparent">
      <h3 
        class="mb-1.5 line-clamp-1 text-xs sm:text-sm font-bold tracking-tight transition-colors duration-300 group-hover:text-accent"
        style="color: var(--text-primary)"
      >
        {{ asset.title }}
      </h3>

      <!-- Bottom Info Bar -->
      <div class="flex items-center justify-between border-t pt-2.5" style="border-color: var(--border-base)">
        <!-- File Size -->
        <div class="flex items-center gap-1.5">
          <div class="h-1 w-1 rounded-full bg-accent animate-pulse shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]"></div>
          <span class="text-[10px] font-semibold tracking-wide" style="color: var(--text-secondary)">
            {{ formatSize(asset.fileSize) }}
          </span>
        </div>

        <!-- Format Info -->
        <div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 transition-colors duration-300 group-hover:bg-accent/10">
          <component 
            :is="getFormatIcon(asset.format)" 
            class="h-3 w-3 transition-colors duration-300 group-hover:text-accent" 
            style="color: var(--text-secondary)"
          />
          <span class="text-[9px] font-bold uppercase tracking-wider transition-colors duration-300 group-hover:text-accent" style="color: var(--text-muted)">
            {{ asset.format || 'GLB' }}
          </span>
        </div>
      </div>
    </div>
  </div>

</template>

<style scoped>
.asset-card-container {
  width: 100%;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
