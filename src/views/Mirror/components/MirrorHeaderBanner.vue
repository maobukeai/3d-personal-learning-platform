<script setup lang="ts">
import { Sparkles, Shield } from 'lucide-vue-next';
import { getPlanName } from '@/utils/plans';
import type { MirrorSource } from '@/stores/mirror';

defineProps<{
  title: string;
  station: MirrorSource | null;
  totalResources: number;
  hasAccess: boolean | null;
}>();
</script>

<template>
  <div
    class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 bg-gradient-to-r from-blue-600/10 via-indigo-500/5 to-transparent p-4 md:p-5 rounded-2xl border border-blue-500/15 backdrop-blur-md shadow-sm"
  >
    <div class="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 flex-1 min-w-0">
      <!-- Title and Icon Badge -->
      <div class="flex items-center gap-2.5 shrink-0">
        <span class="p-2 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 shadow-inner">
          <Sparkles class="w-5 h-5 animate-pulse shrink-0" />
        </span>
        <h1
          class="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate"
        >
          {{ title }}
        </h1>
        <span
          class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 uppercase tracking-wider shrink-0 border border-blue-500/20"
        >
          镜像资源站
        </span>
      </div>

      <!-- Vertical divider for desktop -->
      <span class="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>

      <!-- Description -->
      <p
        class="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium line-clamp-1 flex-1"
      >
        {{ station?.description || '同步第三方海量极速高质感资产，高速通道极速获取' }}
      </p>

      <!-- Vertical divider for desktop -->
      <span class="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>

      <!-- Resource Stats Badge -->
      <div
        class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0"
      >
        <span>当前共收录</span>
        <span
          class="px-2 py-0.5 text-xs font-black rounded-lg bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
        >
          {{ totalResources }}
        </span>
        <span>个精选资源</span>
      </div>
    </div>

    <!-- Right Access Badge -->
    <div
      v-if="hasAccess === false"
      class="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold shrink-0"
    >
      <Shield class="w-4 h-4 shrink-0 animate-pulse" />
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] text-slate-500 dark:text-slate-400">获取权限：</span>
        <span class="text-[11px] font-bold">
          需要 {{ getPlanName(station?.minPlanPriority ?? 0) }} 会员
        </span>
      </div>
    </div>
  </div>
</template>
