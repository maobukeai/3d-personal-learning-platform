<script setup lang="ts">
import { computed } from 'vue';
import { LayoutGrid, List, ShieldCheck, ShieldAlert } from 'lucide-vue-next';
import Tabs from '@/components/ui/Tabs.vue';

const props = defineProps<{
  sortBy: string;
  layoutMode: 'grid' | 'list';
  isPrivacyMode: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:sortBy', value: string): void;
  (e: 'update:layoutMode', value: 'grid' | 'list'): void;
  (e: 'update:isPrivacyMode', value: boolean): void;
}>();

const localSortBy = computed({
  get: () => props.sortBy,
  set: (val) => emit('update:sortBy', val),
});

const localLayoutMode = computed({
  get: () => props.layoutMode,
  set: (val) => emit('update:layoutMode', val as 'grid' | 'list'),
});

const localPrivacyMode = computed({
  get: () => props.isPrivacyMode,
  set: (val) => emit('update:isPrivacyMode', val),
});
</script>

<template>
  <div class="mobile-row flex flex-wrap items-center justify-between gap-2 mb-2 w-full">
    <div class="mobile-row flex items-center gap-2 w-full sm:w-auto flex-1 sm:flex-initial">
      <div class="shrink-0 w-24 sm:w-28">
        <Select v-model="localSortBy" placeholder="排序方式" class="custom-sort-select">
          <SelectOption label="默认排序" value="pinned_first" />
          <SelectOption label="名称 A-Z" value="label_asc" />
          <SelectOption label="最新添加" value="created_desc" />
        </Select>
      </div>
    </div>

    <!-- Layout Switcher & Privacy Buttons -->
    <div
      class="flex items-center gap-1 bg-slate-800/20 border border-slate-700/60 p-0.5 rounded-lg shrink-0"
      style="border-color: var(--border-base)"
    >
      <Tabs
        v-model="localLayoutMode"
        :options="[
          { value: 'grid', label: '', icon: LayoutGrid },
          { value: 'list', label: '', icon: List },
        ]"
        size="sm"
        class="!bg-transparent border-none shrink-0"
      />

      <div class="w-px h-3 bg-slate-700/60 mx-0.5"></div>

      <button
        type="button"
        class="p-1 px-1.5 rounded-md transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer border-none bg-transparent"
        :class="
          localPrivacyMode
            ? '!bg-amber-600/25 !text-amber-400 border border-amber-500/20'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
        "
        :title="localPrivacyMode ? '关闭隐私遮罩' : '开启隐私遮罩'"
        @click="localPrivacyMode = !localPrivacyMode"
      >
        <ShieldAlert v-if="localPrivacyMode" class="h-3.5 w-3.5 text-amber-400" />
        <ShieldCheck v-else class="h-3.5 w-3.5 text-emerald-400" />
        <span class="hidden md:inline">隐私模糊</span>
      </button>
    </div>
  </div>
</template>
