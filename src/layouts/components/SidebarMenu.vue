<script setup lang="ts">
import { useRoute } from 'vue-router';
import { ShieldCheck, Settings, HelpCircle, MonitorPlay, Box } from 'lucide-vue-next';
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
  <aside class="w-[210px] hidden lg:flex flex-col h-full shrink-0 glass-sidebar">
    <div class="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide">
      <!-- Quick Navigation Block (Blender club style) -->
      <div
        v-if="
          !workspaceStore.isAdminWorkspace &&
          workspaceStore.currentWorkspace?.type !== 'mirror' &&
          workspaceStore.currentWorkspace?.type !== 'manual'
        "
        class="mb-4"
      >
        <div
          class="px-2 mb-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest"
        >
          {{ $t('sidebar.groups.quickNav') }}
        </div>
        <div class="grid grid-cols-2 gap-2 px-1">
          <RouterLink
            to="/showcase"
            class="flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all duration-200 group bg-slate-50/30 dark:bg-white/2 border-slate-200/50 dark:border-white/5 hover:border-accent hover:shadow-[0_0_8px_rgba(224,125,46,0.15)]"
          >
            <MonitorPlay
              class="w-4 h-4 mb-1 text-slate-400 group-hover:text-accent transition-colors"
            />
            <span
              class="text-[10px] font-bold truncate w-full text-slate-600 dark:text-slate-300"
              >{{ $t('sidebar.showcase') }}</span
            >
          </RouterLink>
          <RouterLink
            to="/my-works"
            class="flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all duration-200 group bg-slate-50/30 dark:bg-white/2 border-slate-200/50 dark:border-white/5 hover:border-accent hover:shadow-[0_0_8px_rgba(224,125,46,0.15)]"
          >
            <Box class="w-4 h-4 mb-1 text-slate-400 group-hover:text-accent transition-colors" />
            <span
              class="text-[10px] font-bold truncate w-full text-slate-600 dark:text-slate-300"
              >{{ $t('sidebar.myWorks') }}</span
            >
          </RouterLink>
        </div>
      </div>

      <div v-for="(group, index) in menuGroups" :key="index" :class="{ 'mt-1': index > 0 }">
        <!-- Divider before the group if it's not the first one -->
        <div
          v-if="index > 0"
          class="mb-2 border-t"
          style="border-color: var(--border-base); opacity: 0.3"
        ></div>

        <h3
          v-if="group.title"
          class="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
          :class="
            workspaceStore.isAdminWorkspace
              ? 'text-rose-500 dark:text-rose-400'
              : 'text-slate-400 dark:text-slate-500'
          "
        >
          <ShieldCheck v-if="workspaceStore.isAdminWorkspace" class="w-3.5 h-3.5" />
          {{ group.title }}
        </h3>
        <ul class="space-y-0.5">
          <li v-for="item in group.items" :key="item.name">
            <RouterLink
              :to="item.path"
              class="flex items-center justify-between px-3 py-1.5 rounded-md transition-colors duration-150"
              :class="
                route.fullPath === item.path
                  ? workspaceStore.isAdminWorkspace
                    ? 'bg-rose-600 text-white font-medium shadow-md'
                    : 'sidebar-item-active font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/4 hover:text-slate-900 dark:hover:text-slate-100'
              "
            >
              <div class="flex items-center gap-2.5 min-w-0 w-full">
                <component
                  :is="item.icon"
                  v-if="item.icon"
                  class="w-4 h-4 shrink-0"
                  :class="
                    route.fullPath === item.path
                      ? workspaceStore.isAdminWorkspace
                        ? 'text-white'
                        : 'text-accent'
                      : 'text-slate-400 dark:text-slate-500'
                  "
                />
                <span class="flex-1 truncate text-xs">{{ item.name }}</span>

                <!-- High-Visibility Badge -->
                <div
                  v-if="item.badge && item.badge > 0"
                  class="px-1.5 py-0.5 min-w-[16px] h-4 rounded-full text-[9px] font-black flex items-center justify-center transition-all duration-300 shrink-0"
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

    <div class="p-2 border-t space-y-0.5" style="border-color: var(--border-base)">
      <RouterLink
        to="/settings"
        class="flex items-center gap-2.5 px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/4 hover:text-slate-900 dark:hover:text-slate-100 rounded-md transition-colors text-xs"
        :class="route.path === '/settings' ? 'sidebar-item-active font-medium' : ''"
      >
        <Settings
          class="w-4 h-4 text-slate-400 dark:text-slate-500"
          :class="route.path === '/settings' ? 'text-accent' : ''"
        />
        {{ $t('sidebar.settingsOption') }}
      </RouterLink>
      <button
        type="button"
        class="w-full flex items-center gap-2.5 px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/4 hover:text-slate-900 dark:hover:text-slate-100 rounded-md transition-colors text-xs text-left"
        @click="emit('report-bug')"
      >
        <HelpCircle class="w-4 h-4 text-slate-400 dark:text-slate-500" />
        {{ $t('sidebar.feedbackOption') }}
      </button>
      <!-- Beta tag / desktop app feeling -->
      <div class="pt-1.5 text-center text-[9px] text-slate-400/50 dark:text-slate-500/30 select-none">
        Platform v1.0.0-Beta
      </div>
    </div>
  </aside>
</template>
