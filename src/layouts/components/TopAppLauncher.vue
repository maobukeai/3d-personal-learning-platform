<script setup lang="ts">
import { LayoutGrid } from 'lucide-vue-next';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'radix-vue';
import { useSidebarMenus } from '../composables/useSidebarMenus';

const { menuGroups } = useSidebarMenus();
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        type="button"
        aria-label="All apps"
        title="全部功能导航"
        class="topbar-icon-btn w-8.5 h-8.5 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors shrink-0"
      >
        <LayoutGrid class="w-4.5 h-4.5" />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="end"
        :side-offset="8"
        class="top-apps-popover z-[100] w-[340px] sm:w-[420px] max-h-[80vh] overflow-y-auto p-3 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-card)]/95 backdrop-blur-2xl shadow-2xl shadow-black/15 outline-none scrollbar-hide animate-in fade-in-0 zoom-in-95"
      >
        <div
          class="flex items-center justify-between pb-2 mb-2.5 border-b border-[var(--border-base)]/50"
        >
          <div
            class="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-slate-100"
          >
            <LayoutGrid class="w-3.5 h-3.5 text-accent" />
            <span>全部工作区应用</span>
          </div>
          <span class="text-[10px] text-slate-400">快速直达</span>
        </div>

        <div class="space-y-3">
          <div v-for="group in menuGroups" :key="group.title" class="space-y-1.5">
            <div class="text-[10px] font-bold tracking-wider uppercase text-slate-400 px-1">
              {{ group.title }}
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <RouterLink
                v-for="item in group.items"
                :key="item.path"
                :to="item.path"
                class="flex flex-col items-center justify-center p-2 rounded-xl border border-transparent bg-slate-200/30 dark:bg-slate-800/30 hover:bg-accent/10 hover:border-accent/30 hover:text-accent text-slate-700 dark:text-slate-300 text-center transition-all group"
              >
                <div
                  class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-accent group-hover:scale-110 transition-all mb-1"
                >
                  <component :is="item.icon" class="w-4 h-4" />
                </div>
                <span class="text-[10.5px] font-medium leading-tight truncate w-full px-0.5">
                  {{ item.name }}
                </span>
              </RouterLink>
            </div>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.top-apps-popover {
  box-shadow:
    0 20px 30px -10px rgba(0, 0, 0, 0.15),
    0 10px 15px -5px rgba(0, 0, 0, 0.08);
}
</style>
