<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { X, ShieldCheck, Settings, HelpCircle, Box } from 'lucide-vue-next';
import { useSystemStore } from '@/stores/system';
import { useWorkspaceStore } from '@/stores/workspace';
import { getAssetUrl } from '@/utils/api';
import type { SidebarMenuGroup } from '../composables/useSidebarMenus';

const props = defineProps<{
  modelValue: boolean;
  menuGroups: SidebarMenuGroup[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'report-bug'): void;
}>();

const route = useRoute();
const systemStore = useSystemStore();
const workspaceStore = useWorkspaceStore();
const logoLoadFailed = ref(false);

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const closeSidebar = (event?: Event) => {
  if (event?.currentTarget && typeof (event.currentTarget as HTMLElement).blur === 'function') {
    (event.currentTarget as HTMLElement).blur();
  }
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  isOpen.value = false;
};

watch(
  () => systemStore.settings.PLATFORM_LOGO_URL,
  () => {
    logoLoadFailed.value = false;
  },
);

const handleLogoError = () => {
  logoLoadFailed.value = true;
};
</script>

<template>
  <div>
    <!-- Backdrop -->
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-40 bg-black/50 lg:hidden"
        @click="closeSidebar"
      ></div>
    </Transition>

    <aside
      class="fixed inset-y-0 left-0 w-44 max-w-[75vw] z-50 flex flex-col h-full shadow-2xl lg:hidden mobile-sidebar-drawer"
      :class="isOpen ? 'mobile-sidebar-open' : 'mobile-sidebar-closed'"
      :aria-hidden="!isOpen"
      :inert="!isOpen"
    >
      <!-- Header -->
      <div
        class="h-14 flex items-center justify-between px-2.5 border-b shrink-0"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2 min-w-0">
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden shrink-0"
            :class="
              systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed
                ? 'bg-transparent'
                : 'bg-accent'
            "
          >
            <img
              v-if="systemStore.settings.PLATFORM_LOGO_URL && !logoLoadFailed"
              alt=""
              :src="getAssetUrl(systemStore.settings.PLATFORM_LOGO_URL)"
              class="w-full h-full object-contain"
              @error="handleLogoError"
            />
            <Box v-else class="w-4 h-4 text-white" />
          </div>
          <span class="text-xs font-bold truncate" style="color: var(--text-primary)">{{
            systemStore.settings.PLATFORM_NAME
          }}</span>
        </div>
        <button
          type="button"
          class="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          @click="closeSidebar"
        >
          <X class="w-4 h-4" style="color: var(--text-muted)" />
        </button>
      </div>

      <!-- Navigation Menu -->
      <div class="flex-1 overflow-y-auto py-3 px-3 scrollbar-hide">
        <div v-for="(group, index) in menuGroups" :key="index" :class="{ 'mt-1': index > 0 }">
          <!-- Divider before the group if it's not the first one -->
          <div
            v-if="index > 0"
            class="mb-1 border-t"
            style="border-color: var(--border-base); opacity: 0.4"
          ></div>

          <h3
            v-if="group.title"
            class="px-1.5 mb-0.5 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5"
            :class="
              workspaceStore.isAdminWorkspace
                ? 'text-rose-500 dark:text-rose-400'
                : 'text-slate-400 dark:text-slate-500'
            "
          >
            <ShieldCheck v-if="workspaceStore.isAdminWorkspace" class="w-2.5 h-2.5" />
            {{ group.title }}
          </h3>
          <ul class="space-y-0.5">
            <li v-for="item in group.items" :key="item.name">
              <RouterLink
                :to="item.path"
                class="min-h-11 flex items-center justify-between px-3 py-2 rounded-lg transition-colors duration-150"
                :class="
                  route.path === item.path
                    ? workspaceStore.isAdminWorkspace
                      ? 'bg-rose-600 text-white font-medium shadow-md'
                      : 'bg-accent-subtle dark:bg-accent/20 text-accent font-medium'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                "
                @click="closeSidebar"
              >
                <div class="flex items-center gap-2 min-w-0 flex-1">
                  <component
                    :is="item.icon"
                    class="w-4 h-4 shrink-0"
                    :class="
                      route.path === item.path
                        ? workspaceStore.isAdminWorkspace
                          ? 'text-white'
                          : 'text-accent'
                        : 'text-slate-400'
                    "
                  />
                  <span class="flex-1 text-sm truncate">{{ item.name }}</span>

                  <!-- High-Visibility Badge -->
                  <div
                    v-if="item.badge && item.badge > 0"
                    class="px-1.5 py-0.5 min-w-[18px] h-4 rounded-full text-[9px] font-black flex items-center justify-center transition-all duration-300 shrink-0"
                    :class="
                      route.path === item.path
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

      <!-- Footer -->
      <div class="p-2 border-t space-y-0.5 shrink-0" style="border-color: var(--border-base)">
        <RouterLink
          to="/settings"
          class="min-h-11 flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors text-sm"
          :class="
            route.path === '/settings' ? 'bg-accent-subtle dark:bg-accent/20 text-accent' : ''
          "
          @click="closeSidebar"
        >
          <Settings
            class="w-4 h-4 shrink-0"
            :class="route.path === '/settings' ? 'text-accent' : 'text-slate-400'"
          />
          <span class="flex-1 text-xs truncate">{{ $t('sidebar.settingsOption') }}</span>
        </RouterLink>
        <button
          type="button"
          class="min-h-11 w-full flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg transition-colors text-sm"
          @click="
            emit('report-bug');
            closeSidebar();
          "
        >
          <HelpCircle class="w-4 h-4 shrink-0" />
          <span class="flex-1 text-xs text-left truncate">{{ $t('sidebar.feedbackOption') }}</span>
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.mobile-sidebar-drawer {
  will-change: transform;
  transition:
    transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    visibility 0.28s;
  background-color: var(--bg-sidebar, var(--bg-card));
  border-right: 1px solid var(--border-base);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.mobile-sidebar-open {
  transform: translateX(0);
  visibility: visible;
}

.mobile-sidebar-closed {
  transform: translateX(-100%);
  visibility: hidden;
}
</style>
