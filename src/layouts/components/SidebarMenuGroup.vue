<script setup lang="ts">
import { inject } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import SidebarMenuItem from './SidebarMenuItem.vue';
import type { PreparedSidebarGroup } from './sidebarMenuSchema';
import { SidebarMenuStateKey } from '../composables/useSidebarMenuState';

const props = defineProps<{ group: PreparedSidebarGroup }>();
const state = inject(SidebarMenuStateKey)!;
</script>

<template>
  <section class="panel-group py-1">
    <button
      type="button"
      class="group-trigger flex items-center justify-between w-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      :class="{ '!text-slate-800 dark:!text-slate-200': props.group.isActive }"
      :aria-expanded="state.isGroupOpen(props.group)"
      @click="state.toggleGroup(props.group)"
    >
      <span class="truncate">{{ props.group.title }}</span>
      <span class="inline-flex items-center gap-1.5 shrink-0">
        <span
          class="min-w-3.5 h-3.5 px-1 flex items-center justify-center rounded text-[10px] font-semibold bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
        >
          {{ props.group.items.length }}
        </span>
        <ChevronDown
          class="w-3 h-3 text-slate-400 transition-transform duration-200"
          :class="{ 'rotate-180': state.isGroupOpen(props.group) }"
        />
      </span>
    </button>

    <Transition name="group-list">
      <div v-if="state.isGroupOpen(props.group)">
        <!-- Original 2-Column Bento Card Grid (Classic Mode) -->
        <ul
          v-if="state.sidebarMode.value === 'classic'"
          class="bento-grid grid grid-cols-2 gap-1.5 px-1.5 mt-1"
        >
          <li
            v-for="(item, idx) in props.group.items"
            :key="item.path"
            :class="{ 'col-span-2': props.group.items.length % 2 === 1 && idx === 0 }"
          >
            <SidebarMenuItem
              :item="item"
              variant="bento"
              :is-first-odd="props.group.items.length % 2 === 1 && idx === 0"
            />
          </li>
        </ul>

        <!-- Modern Single-Column Tree List (Expanded Tree Mode) -->
        <ul v-else class="panel-list flex flex-col gap-0.5 mt-0.5">
          <li v-for="item in props.group.items" :key="item.path">
            <SidebarMenuItem :item="item" variant="panel" />
          </li>
        </ul>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.panel-group + .panel-group {
  margin-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--border-base) 40%, transparent);
}

.group-list-enter-active,
.group-list-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}
.group-list-enter-from,
.group-list-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
