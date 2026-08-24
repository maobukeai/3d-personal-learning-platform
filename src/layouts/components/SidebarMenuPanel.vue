<script setup lang="ts">
import { inject } from 'vue';
import { Box, HelpCircle, PanelLeftClose, Settings, ShieldCheck } from 'lucide-vue-next';
import Tooltip from '@/components/ui/Tooltip.vue';
import SidebarMenuGroup from './SidebarMenuGroup.vue';
import { getAssetUrl } from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { SidebarMenuStateKey } from '../composables/useSidebarMenuState';

const state = inject(SidebarMenuStateKey)!;
const workspaceStore = useWorkspaceStore();
const emit = defineEmits<{ (e: 'report-bug'): void }>();
</script>

<template>
  <section
    class="workspace-sidebar__panel flex flex-col h-full overflow-hidden select-none bg-transparent"
    aria-label="Expanded navigation"
  >
    <!-- Header -->
    <header
      class="panel-header flex items-center justify-between px-3 py-3 border-b border-[var(--border-base)] shrink-0"
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden shrink-0 bg-accent text-white shadow-sm"
          :class="{ '!bg-rose-600': state.isAdmin.value }"
        >
          <img
            v-if="workspaceStore.currentWorkspace?.avatarUrl"
            :src="getAssetUrl(workspaceStore.currentWorkspace.avatarUrl)"
            class="w-full h-full object-cover"
            alt="Workspace Avatar"
          />
          <template v-else>
            <ShieldCheck v-if="state.isAdmin.value" class="w-4 h-4" />
            <Box v-else class="w-4 h-4" />
          </template>
        </div>
        <div class="flex flex-col min-w-0 leading-tight">
          <span
            v-if="state.sidebarSubtitle.value"
            class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate"
          >
            {{ state.sidebarSubtitle.value }}
          </span>
          <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
            {{ state.sidebarTitle.value }}
          </span>
        </div>
      </div>

      <Tooltip
        :content="state.collapseNavigationLabel.value"
        placement="bottom"
        :show-after="120"
        popper-class="sidebar-tooltip"
      >
        <button
          type="button"
          class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors shrink-0"
          :aria-label="state.collapseNavigationLabel.value"
          :title="state.collapseNavigationLabel.value"
          @click="state.toggleSidebar"
        >
          <PanelLeftClose class="w-4 h-4" />
        </button>
      </Tooltip>
    </header>

    <!-- Navigation Tree Groups (Clean Scroll Area) -->
    <div class="panel-groups relative flex-1 overflow-y-auto px-2 py-2 scrollbar-hide space-y-1">
      <!-- Floating Active Sliding Indicator (Smooth Gliding Animation) -->
      <div
        class="active-indicator-bg"
        :class="{ 'active-indicator-bg--mounted': state.isMounted.value }"
        :style="state.activeIndicatorStyle.value"
      />

      <SidebarMenuGroup
        v-for="group in state.preparedGroups.value"
        :key="group.key"
        :group="group"
      />
    </div>

    <!-- Footer -->
    <footer
      class="panel-footer p-2.5 border-t border-[var(--border-base)] flex flex-col gap-1.5 shrink-0 bg-slate-50/50 dark:bg-slate-900/30 backdrop-blur-sm"
    >
      <div
        class="flex items-center justify-between px-2.5 py-1 rounded-md bg-slate-200/50 dark:bg-slate-800/50 text-[10.5px] text-slate-600 dark:text-slate-400 select-none border border-[var(--border-base)]/50"
      >
        <span class="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
          <span
            class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
            :class="{ '!bg-amber-500 animate-pulse': state.isSavingPreference.value }"
          ></span>
          <span>{{ state.settingStateLabel.value }}</span>
        </span>
        <span class="text-[9.5px] text-slate-400">
          {{ state.settingStateCaption.value }}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <RouterLink
          :to="state.settingsPath.value"
          class="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
          :class="{
            '!text-accent !bg-accent/10 !font-bold': state.isRouteActive(state.settingsPath.value),
          }"
        >
          <Settings class="w-3.5 h-3.5" />
          <span>{{ $t('sidebar.settingsOption') }}</span>
        </RouterLink>

        <button
          type="button"
          class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors shrink-0"
          :title="$t('sidebar.feedbackOption')"
          @click="emit('report-bug')"
        >
          <HelpCircle class="w-4 h-4" />
        </button>
      </div>
    </footer>
  </section>
</template>

<style scoped>
.workspace-sidebar__panel {
  width: var(--sidebar-panel-width, 210px);
}

.active-indicator-bg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 0;
  border-radius: 12px;
  background: color-mix(in srgb, var(--accent, #10b981) 14%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--accent, #10b981) 50%, transparent);
  opacity: 0;
  box-shadow: 0 4px 12px -4px color-mix(in srgb, var(--accent, #10b981) 25%, transparent);
  will-change: transform, width, height;
  backface-visibility: hidden;
  transform: translate3d(0, 0, 0);
}

.active-indicator-bg--mounted {
  transition:
    transform 0.16s cubic-bezier(0.16, 1, 0.3, 1),
    width 0.16s cubic-bezier(0.16, 1, 0.3, 1),
    height 0.16s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.12s ease;
}
</style>
