<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Box } from 'lucide-vue-next';

defineProps<{
  recentAssets: any[];
}>();

const router = useRouter();
</script>

<template>
  <div class="space-y-1.5 sm:space-y-2">
    <div class="flex items-center justify-between px-1">
      <h3 class="font-bold text-sm sm:text-base" style="color: var(--text-primary)">
        最新创作资产
      </h3>
      <button
        class="text-xs sm:text-sm font-bold text-accent hover:underline cursor-pointer"
        @click="router.push('/my-works')"
      >
        管理作品集
      </button>
    </div>
    <div class="grid grid-cols-2 gap-2 sm:gap-2.5">
      <div
        v-for="asset in recentAssets"
        :key="asset.id"
        class="group p-2 sm:p-2.5 glass-card glass-card-hover flex items-center gap-2 sm:gap-2.5 cursor-pointer"
        @click="router.push('/assets')"
      >
        <div
          class="w-11 h-11 sm:w-13 sm:h-13 rounded-lg overflow-hidden flex items-center justify-center p-0.5 shrink-0 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
        >
          <img
            v-if="asset.thumbnail"
            :src="asset.thumbnail"
            class="w-full h-full object-cover rounded-lg group-hover:scale-110 transition-transform"
          />
          <div
            v-else
            class="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-white/5 rounded-lg"
          >
            <Box class="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
            <span class="text-[8px] sm:text-[9px] font-bold uppercase">NO THUMB</span>
          </div>
        </div>
        <div class="min-w-0">
          <p class="text-xs sm:text-sm font-bold truncate" style="color: var(--text-primary)">
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
