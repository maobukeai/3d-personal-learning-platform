<script setup lang="ts">
import { watch, onMounted } from 'vue';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    isOpen?: boolean;
    storageKey?: string;
    title?: string;
  }>(),
  {
    isOpen: false,
    storageKey: 'filter_panel_collapsed',
    title: '筛选过滤',
  },
);

const isCollapsed = defineModel<boolean>('collapsed', { default: false });

onMounted(() => {
  if (props.storageKey) {
    const saved = localStorage.getItem(props.storageKey);
    if (saved !== null) {
      isCollapsed.value = saved === 'true';
    }
  }
});

watch(isCollapsed, (newVal) => {
  if (props.storageKey) {
    localStorage.setItem(props.storageKey, String(newVal));
  }
});

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};
</script>

<template>
  <aside class="filter-panel" :class="{ open: isOpen, collapsed: isCollapsed }">
    <!-- Top Toggle Bar -->
    <div class="panel-header-toggle flex items-center justify-between w-full pb-0.5 border-b border-[var(--border-base)]/50">
      <span v-if="!isCollapsed" class="text-[11px] font-bold text-[var(--text-secondary)] tracking-wider">
        {{ title }}
      </span>
      <button
        type="button"
        class="toggle-btn p-1 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-md transition-all cursor-pointer border-0 bg-transparent flex items-center justify-center shrink-0"
        :class="{ 'w-full py-1 justify-center': isCollapsed }"
        :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="toggleCollapse"
      >
        <PanelLeftOpen v-if="isCollapsed" class="w-4 h-4 text-indigo-400" />
        <PanelLeftClose v-else class="w-4 h-4 text-slate-400" />
      </button>
    </div>

    <!-- Main Content Slot (Only rendered when expanded) -->
    <div v-if="!isCollapsed" class="filter-panel-content flex flex-col gap-2.5 w-full">
      <slot />
    </div>
  </aside>
</template>

<style scoped>
.filter-panel {
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: var(--bg-card);
  padding: 8px;
  box-shadow: var(--shadow-card);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  width: 156px;
  overflow: hidden;
}

.filter-panel.collapsed {
  display: none !important;
}

.filter-panel-content {
  min-width: 0;
}

@media (max-width: 980px) {
  .filter-panel {
    display: none;
  }
  .filter-panel.open {
    display: flex;
    position: fixed;
    top: 50px;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    border-radius: 0;
    border: 0;
    background: var(--bg-card);
    overflow: auto;
    width: 100% !important;
  }
}
</style>
