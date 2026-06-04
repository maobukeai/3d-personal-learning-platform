<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Box, ChevronRight, Image } from 'lucide-vue-next';
import type { DashboardAsset } from '../types';

defineProps<{
  recentAssets: DashboardAsset[];
}>();

const router = useRouter();
</script>

<template>
  <div class="blender-card overflow-hidden">
    <div class="p-4 sm:p-5 border-b flex items-center justify-between" style="border-color: var(--border-base)">
      <div class="flex items-center gap-2">
        <Box class="w-4 h-4 text-purple-500" />
        <h3 class="font-bold text-sm" style="color: var(--text-primary)">最新创作资产</h3>
      </div>
      <button
        type="button"
        class="flex items-center gap-1 text-xs font-bold text-accent hover:underline cursor-pointer transition-colors"
        @click="router.push('/my-works')"
      >
        管理作品集 <ChevronRight class="w-3 h-3" />
      </button>
    </div>

    <div class="p-4 sm:p-5">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          v-for="asset in recentAssets"
          :key="asset.id"
          class="asset-card group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
          @click="router.push(`/assets/${asset.id}`)"
        >
          <div class="asset-thumb w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
            <img
              v-if="asset.thumbnail"
              :src="asset.thumbnail"
              alt=""
              class="w-full h-full object-cover group-hover:scale-110 transition-transform"
            />
            <div v-else class="w-full h-full flex flex-col items-center justify-center">
              <Box class="w-5 h-5 mb-0.5 opacity-40" style="color: var(--text-muted)" />
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold truncate" style="color: var(--text-primary)">
              {{ asset.title }}
            </p>
            <span class="asset-type-badge text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block">
              {{ asset.type || 'MODEL' }}
            </span>
          </div>
        </div>

        <div v-if="recentAssets.length === 0" class="col-span-2 py-8 text-center">
          <Image class="w-8 h-8 mx-auto mb-2 opacity-20" style="color: var(--text-muted)" />
          <p class="text-xs font-bold" style="color: var(--text-muted)">暂无创作资产</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.asset-card {
  border: 1px solid var(--border-base);
  background: transparent;
}

.asset-card:hover {
  background: var(--bg-subtle);
  border-color: rgba(139, 92, 246, 0.2);
  transform: translateY(-1px);
}

.asset-thumb {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08));
  border: 1px solid rgba(139, 92, 246, 0.1);
}

.asset-type-badge {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}
</style>
