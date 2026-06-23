<script setup lang="ts">
import { ref } from 'vue';
import type { ModelFamilyGroup } from './AiSettingsTab.types';

const props = defineProps<{
  groups: ModelFamilyGroup[];
}>();

const emit = defineEmits<{
  'enable-group': [string];
}>();

const isCollapsed = ref(true);
</script>

<template>
  <div
    v-if="props.groups.length > 0"
    class="pt-4 border-t"
    style="border-color: var(--border-base)"
  >
    <button
      type="button"
      class="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors bg-transparent border-none cursor-pointer"
      @click="isCollapsed = !isCollapsed"
    >
      <span>已禁用的模型分组 ({{ props.groups.length }})</span>
      <svg
        viewBox="0 0 24 24"
        class="w-3.5 h-3.5 transition-transform"
        :class="isCollapsed ? '' : 'rotate-180'"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div
      v-if="!isCollapsed"
      class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 animate-in fade-in duration-200 mobile-grid"
    >
      <div
        v-for="group in props.groups"
        :key="group.key"
        class="flex items-center justify-between p-3 rounded-xl border text-xs"
        style="border-color: var(--border-base); background: var(--bg-card)"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span
            class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 opacity-60"
            :style="`background: ${group.meta.bg}; color: ${group.meta.color};`"
          >
            <component :is="group.meta.lucideIcon" class="w-4 h-4" />
          </span>
          <div class="min-w-0">
            <p class="font-bold truncate" style="color: var(--text-primary)">
              {{ group.label }}
            </p>
            <p class="text-[10px]" style="color: var(--text-muted)">
              共 {{ group.models.length }} 个模型
            </p>
          </div>
        </div>
        <button
          type="button"
          class="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 cursor-pointer"
          style="
            border-color: rgba(16, 185, 129, 0.25);
            color: #059669;
            background: rgba(16, 185, 129, 0.05);
          "
          @click="emit('enable-group', group.key)"
        >
          重新启用
        </button>
      </div>
    </div>
  </div>
</template>
