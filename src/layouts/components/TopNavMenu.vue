<script setup lang="ts">
import { useRoute } from 'vue-router';
import { ChevronDown } from 'lucide-vue-next';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'radix-vue';
import { useSidebarMenus, type SidebarMenuGroup } from '../composables/useSidebarMenus';

const route = useRoute();
const { menuGroups } = useSidebarMenus();

const isItemActive = (path: string) => {
  const cleanPath = path.split('?')[0];
  if (cleanPath === '/dashboard') return route.path === '/' || route.path === '/dashboard';
  return route.path.startsWith(cleanPath);
};

const isGroupActive = (group: SidebarMenuGroup) => {
  return group.items.some((item) => isItemActive(item.path));
};
</script>

<template>
  <nav class="top-nav-menu flex items-center gap-1.5">
    <div v-for="group in menuGroups" :key="group.title" class="relative">
      <PopoverRoot>
        <PopoverTrigger as-child>
          <button
            type="button"
            class="top-nav-btn group flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer border"
            :class="[
              isGroupActive(group)
                ? 'text-accent bg-accent/10 border-accent/30 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60',
            ]"
          >
            <span class="whitespace-nowrap">{{ group.title }}</span>
            <ChevronDown
              class="w-3 h-3 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 shrink-0"
              :class="{ 'rotate-180 text-accent': isGroupActive(group) }"
            />
          </button>
        </PopoverTrigger>

        <PopoverPortal>
          <PopoverContent
            side="bottom"
            align="start"
            :side-offset="6"
            class="top-nav-popover z-[100] min-w-[210px] max-w-[280px] p-2 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-card)]/95 backdrop-blur-2xl shadow-xl shadow-black/10 outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            <div
              class="px-2 py-1 text-[10.5px] font-bold tracking-wider text-slate-400 border-b border-[var(--border-base)]/50 mb-1 flex items-center justify-between"
            >
              <span>{{ group.title }}</span>
              <span class="text-[9.5px] font-normal text-slate-400/80"
                >{{ group.items.length }} 个功能</span
              >
            </div>

            <div class="flex flex-col gap-0.5">
              <RouterLink
                v-for="item in group.items"
                :key="item.path"
                :to="item.path"
                class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors"
                :class="[
                  isItemActive(item.path)
                    ? 'bg-accent/10 text-accent font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white',
                ]"
              >
                <div
                  class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                  :class="[
                    isItemActive(item.path)
                      ? 'bg-accent text-white shadow-xs'
                      : 'bg-slate-200/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-400 group-hover:text-slate-700',
                  ]"
                >
                  <component :is="item.icon" class="w-3.5 h-3.5" />
                </div>
                <span class="flex-1 truncate">{{ item.name }}</span>
                <span
                  v-if="item.badge && item.badge > 0"
                  class="min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold bg-rose-500 text-white"
                >
                  {{ item.badge > 99 ? '99+' : item.badge }}
                </span>
              </RouterLink>
            </div>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>
    </div>
  </nav>
</template>

<style scoped>
.top-nav-popover {
  box-shadow:
    0 12px 28px -6px rgba(0, 0, 0, 0.12),
    0 8px 10px -6px rgba(0, 0, 0, 0.06);
}
</style>
