<script setup lang="ts">
import { useRoute } from 'vue-router';
import { ShieldCheck, Settings, HelpCircle } from 'lucide-vue-next';
import { useWorkspaceStore } from '@/stores/workspace';
import type { SidebarMenuGroup } from '../composables/useSidebarMenus';

defineProps<{
  menuGroups: SidebarMenuGroup[];
}>();

const emit = defineEmits<{
  (e: 'report-bug'): void;
}>();

const route = useRoute();
const workspaceStore = useWorkspaceStore();
</script>

<template>
  <!-- Global Sidebar -->
  <aside class="w-56 hidden lg:flex flex-col h-full shrink-0 glass-sidebar">
    <div class="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide">
      <div v-for="(group, index) in menuGroups" :key="index" :class="{ 'mt-1': index > 0 }">
        <!-- Divider before the group if it's not the first one -->
        <div
          v-if="index > 0"
          class="mb-1 border-t"
          style="border-color: var(--border-base); opacity: 0.4"
        ></div>

        <h3
          v-if="group.title"
          class="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
          :class="
            workspaceStore.isAdminWorkspace
              ? 'text-rose-500 dark:text-rose-400'
              : 'text-slate-400 dark:text-slate-500'
          "
        >
          <ShieldCheck v-if="workspaceStore.isAdminWorkspace" class="w-3.5 h-3.5" />
          {{ group.title }}
        </h3>
        <ul class="space-y-1">
          <li v-for="item in group.items" :key="item.name">
            <RouterLink
              :to="item.path"
              class="flex items-center justify-between px-3 py-2 rounded-md transition-colors duration-150"
              :class="
                route.fullPath === item.path
                  ? workspaceStore.isAdminWorkspace
                    ? 'bg-rose-600 text-white font-medium shadow-md'
                    : 'bg-accent-subtle dark:bg-accent/20 text-accent font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              "
            >
              <div class="flex items-center gap-3">
                <component
                  :is="item.icon"
                  v-if="item.icon"
                  class="w-4 h-4"
                  :class="
                    route.fullPath === item.path
                      ? workspaceStore.isAdminWorkspace
                        ? 'text-white'
                        : 'text-accent'
                      : 'text-slate-400'
                  "
                />
                <span class="flex-1">{{ item.name }}</span>

                <!-- High-Visibility Badge -->
                <div
                  v-if="item.badge && item.badge > 0"
                  class="px-1.5 py-0.5 min-w-[18px] h-4.5 rounded-full text-[10px] font-black flex items-center justify-center transition-all duration-300"
                  :class="
                    route.fullPath === item.path
                      ? 'bg-white text-rose-600 shadow-sm'
                      : 'bg-rose-500 text-white'
                  "
                >
                  {{ item.badge > 99 ? '99+' : item.badge }}
                </div>
              </div>
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>

    <div class="p-2.5 border-t space-y-0.5" style="border-color: var(--border-base)">
      <RouterLink
        to="/settings"
        class="flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-md transition-colors"
        :class="
          route.path === '/settings' ? 'bg-accent-subtle dark:bg-accent/20 text-accent' : ''
        "
      >
        <Settings
          class="w-4 h-4"
          :class="route.path === '/settings' ? 'text-accent' : 'text-slate-400'"
        />
        设置选项
      </RouterLink>
      <button type="button" class="w-full flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-md transition-colors" @click="emit('report-bug')">
        <HelpCircle class="w-4 h-4 text-slate-400" />
        问题反馈
      </button>
    </div>
  </aside>
</template>
