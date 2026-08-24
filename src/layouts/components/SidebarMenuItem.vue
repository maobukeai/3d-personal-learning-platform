<script setup lang="ts">
import { inject } from 'vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import type { PreparedSidebarItem } from './sidebarMenuSchema';
import { SidebarMenuStateKey } from '../composables/useSidebarMenuState';

withDefaults(
  defineProps<{
    item: PreparedSidebarItem;
    variant?: 'rail' | 'panel' | 'bento';
    isFirstOdd?: boolean;
  }>(),
  {
    variant: 'rail',
    isFirstOdd: false,
  },
);

const state = inject(SidebarMenuStateKey, null);

const handleItemClick = (e: MouseEvent) => {
  if (state?.updateActiveIndicator) {
    const target = e.currentTarget as HTMLElement;
    if (target) {
      state.updateActiveIndicator(target);
    }
  }
};
</script>

<template>
  <!-- Rail Mode Item (Icon Only with Tooltip) -->
  <Tooltip
    v-if="variant === 'rail'"
    :content="item.tooltip"
    placement="right"
    :show-after="120"
    popper-class="sidebar-tooltip"
  >
    <RouterLink
      :to="item.path"
      class="rail-link group relative flex items-center justify-center w-10 h-10 mx-auto rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-all duration-150"
      :class="{
        'rail-link--active !text-white !bg-accent shadow-sm shadow-accent/30 font-semibold':
          item.isActive,
      }"
      :aria-label="item.tooltip"
      :title="item.tooltip"
    >
      <span
        v-if="item.isActive"
        class="absolute -left-2 top-2.5 bottom-2.5 w-1 rounded-r-full bg-accent"
      ></span>
      <component
        :is="item.icon"
        class="w-4.5 h-4.5 transition-transform duration-150 group-hover:scale-105"
      />
      <span
        v-if="item.badge && item.badge > 0"
        class="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-[var(--bg-app)]"
      >
        {{ item.badge > 99 ? '99+' : item.badge }}
      </span>
    </RouterLink>
  </Tooltip>

  <!-- Bento Mode Item (Original 2-Column Card Tile) -->
  <RouterLink
    v-else-if="variant === 'bento'"
    :to="item.path"
    @click="handleItemClick"
    class="bento-tile group relative z-[1] flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border border-transparent transition-all duration-150 cursor-pointer overflow-hidden leading-tight"
    :class="[
      item.isActive
        ? 'bento-tile--active text-accent font-bold bg-transparent'
        : 'bg-slate-200/40 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800/70',
      isFirstOdd ? 'justify-center py-2 font-semibold' : '',
    ]"
  >
    <div
      class="w-5 h-5 flex items-center justify-center rounded-md transition-colors shrink-0"
      :class="
        item.isActive
          ? 'bg-accent text-white shadow-sm'
          : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200'
      "
    >
      <component :is="item.icon" class="w-3.5 h-3.5" />
    </div>
    <span class="truncate tracking-tight whitespace-nowrap">{{ item.name }}</span>
    <span
      v-if="item.badge && item.badge > 0"
      class="min-w-3.5 h-3.5 px-1 flex items-center justify-center rounded-full text-[9px] font-bold bg-rose-500 text-white ml-auto"
    >
      {{ item.badge > 99 ? '99+' : item.badge }}
    </span>
  </RouterLink>

  <!-- Panel Mode Item (Modern Single-column Tree Row) -->
  <RouterLink
    v-else
    :to="item.path"
    @click="handleItemClick"
    class="panel-tree-link group flex items-center gap-2.5 px-3 py-2 mx-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all duration-150 relative"
    :class="{
      'panel-tree-link--active !text-accent !font-bold !bg-accent/10 dark:!bg-accent/15':
        item.isActive,
    }"
  >
    <span
      v-if="item.isActive"
      class="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent"
    ></span>
    <span
      class="flex items-center justify-center w-5 h-5 rounded-md text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors"
      :class="{ '!text-accent': item.isActive }"
    >
      <component :is="item.icon" class="w-4 h-4" />
    </span>
    <span class="flex-1 truncate tracking-tight">{{ item.name }}</span>
    <span
      v-if="item.badge && item.badge > 0"
      class="min-w-4.5 h-4.5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold"
      :class="
        item.isActive
          ? 'bg-accent text-white'
          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-slate-300 dark:group-hover:bg-slate-700'
      "
    >
      {{ item.badge > 99 ? '99+' : item.badge }}
    </span>
  </RouterLink>
</template>

<style scoped>
.panel-tree-link {
  user-select: none;
}
.bento-tile {
  min-height: 28px;
}
</style>
