<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Box } from 'lucide-vue-next';
import type { DashboardAsset } from '../types';

defineProps<{
  recentAssets: DashboardAsset[];
}>();

const router = useRouter();
</script>

<template>
  <div class="glass-card p-4 sm:p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold text-sm sm:text-base" style="color: var(--text-primary)">
        最新创作资产
      </h3>
      <button type="button" class="px-2.5 py-1.5 text-xs font-bold text-accent rounded-md hover:bg-accent-subtle cursor-pointer transition-colors" @click="router.push('/my-works')">
        管理作品集
      </button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div
        v-for="asset in recentAssets"
        :key="asset.id"
        class="group p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors hover:bg-[var(--bg-subtle)]"
        style="border-color: var(--border-base)"
        @click="router.push(`/assets/${asset.id}`)"
      >
        <div
          class="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center p-0.5 shrink-0 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
        >
          <img v-if="asset.thumbnail" alt="" :src="asset.thumbnail" class="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform" />
          <div
            v-else
            class="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-white/5 rounded-lg"
          >
            <Box class="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
            <span class="text-[8px] sm:text-[9px] font-bold uppercase">NO THUMB</span>
          </div>
        </div>
        <div class="min-w-0">
          <p class="text-xs sm:text-sm font-semibold truncate" style="color: var(--text-primary)">
            {{ asset.title }}
          </p>
          <span
            class="text-[10px] sm:text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded mt-1 inline-block"
          >
            {{ asset.type }}
          </span>
        </div>
      </div>
      <div v-if="recentAssets.length === 0" class="col-span-2 py-4 text-center text-slate-400">
        <p class="text-xs sm:text-sm font-bold">暂无创作资产</p>
      </div>
    </div>
  </div>
</template>
