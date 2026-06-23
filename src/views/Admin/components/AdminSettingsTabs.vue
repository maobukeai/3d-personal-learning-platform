<script setup lang="ts">
import type { Component } from 'vue';

interface Tab {
  id: string;
  label: string;
  icon: Component;
}

defineProps<{
  tabs: Tab[];
  activeTab: string;
  activeTabMeta: Tab;
  configurationCompleteness: number;
}>();

const emit = defineEmits<{
  (e: 'select-tab', tabId: string): void;
}>();
</script>

<template>
  <div
    class="w-full border-b xl:border-b-0 xl:border-r shrink-0 overflow-y-auto p-3 transition-colors duration-300"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div class="px-2 mb-3 hidden xl:block">
      <h2 class="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        {{ $t('admin.set_categories') }}
      </h2>
      <p class="mt-1 text-[10px] font-semibold" style="color: var(--text-muted)">
        {{ activeTabMeta.label }} / {{ configurationCompleteness }}%
      </p>
    </div>
    <nav
      class="flex flex-row flex-nowrap xl:flex-col gap-1 pb-2 xl:pb-0 overflow-x-auto xl:overflow-visible scrollbar-hide"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="flex-none w-auto xl:w-full flex items-center justify-center xl:justify-start gap-2 px-3 py-2 xl:px-3 xl:py-2.5 rounded-lg text-[11px] xl:text-xs font-black transition-all shrink-0 whitespace-nowrap cursor-pointer"
        :class="
          activeTab === tab.id
            ? 'bg-accent text-white shadow-md shadow-accent/15'
            : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
        "
        @click="emit('select-tab', tab.id)"
      >
        <component :is="tab.icon" class="w-3.5 h-3.5 shrink-0" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>
