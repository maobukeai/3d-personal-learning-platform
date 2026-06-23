<script setup lang="ts">
import { Tag, Edit } from 'lucide-vue-next';
import type { TwoFactorAccount } from '@/types';

const props = defineProps<{
  accounts: TwoFactorAccount[];
  selectedCategory: string;
  allCategories: string[];
  pendingCategories: string[];
  uncategorizedCount: number;
  dragOverCategory: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:selectedCategory', value: string): void;
  (e: 'manage'): void;
  (e: 'dragover', event: DragEvent, category: string): void;
  (e: 'dragleave'): void;
  (e: 'drop', event: DragEvent, category: string): void;
}>();

function categoryCount(category: string): number {
  return props.accounts.filter((a) => a.category === category).length;
}

function isPendingEmpty(category: string): boolean {
  return props.pendingCategories.includes(category) && categoryCount(category) === 0;
}

function selectCategory(category: string) {
  emit('update:selectedCategory', category);
}
</script>

<template>
  <div
    class="flex items-center justify-between gap-2 mb-3 px-1 border-b pb-2 animate-fade-in"
    style="border-color: var(--border-base)"
  >
    <div
      class="flex flex-wrap sm:flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 -mr-2 pr-2 py-0.5 select-none"
    >
      <span
        class="text-[10px] uppercase font-bold tracking-wider mr-1 text-slate-500 flex items-center gap-1 shrink-0"
      >
        <Tag class="h-3 w-3" style="color: var(--accent, #6366f1)" />
        <span>分组:</span>
      </span>

      <!-- All accounts pill -->
      <button
        class="px-2.5 py-0.5 text-[11px] rounded-full cursor-pointer transition-all border font-semibold shrink-0"
        :style="{
          backgroundColor:
            selectedCategory === 'all' ? 'var(--accent, #6366f1)' : 'rgba(148, 163, 184, 0.08)',
          borderColor: selectedCategory === 'all' ? 'transparent' : 'transparent',
          color: selectedCategory === 'all' ? '#fff' : 'var(--text-secondary)',
        }"
        @click="selectCategory('all')"
      >
        全部 ({{ accounts.length }})
      </button>

      <!-- Real category pills (with drag-drop target) -->
      <button
        v-for="cat in allCategories"
        :key="cat"
        class="px-2.5 py-0.5 text-[11px] rounded-full cursor-pointer transition-all border font-semibold relative shrink-0"
        :class="{
          'scale-105 !border-indigo-500 !bg-indigo-500/25 shadow-lg': dragOverCategory === cat,
        }"
        :style="{
          backgroundColor:
            selectedCategory === cat ? 'var(--accent, #6366f1)' : 'rgba(148, 163, 184, 0.08)',
          borderColor: selectedCategory === cat ? 'transparent' : 'transparent',
          color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
        }"
        @click="selectCategory(cat)"
        @dragover.prevent="emit('dragover', $event, cat)"
        @dragleave="emit('dragleave')"
        @drop="emit('drop', $event, cat)"
      >
        {{ cat }}
        <span class="ml-0.5 opacity-70">{{ categoryCount(cat) }}</span>
        <!-- indicator that category is empty/pending -->
        <span
          v-if="isPendingEmpty(cat)"
          class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 border border-slate-900"
          title="空分组（可拖入账号激活）"
        ></span>
      </button>

      <!-- Uncategorized pill -->
      <button
        v-if="uncategorizedCount > 0"
        class="px-2.5 py-0.5 text-[11px] rounded-full cursor-pointer transition-all border font-semibold shrink-0"
        :class="{
          'scale-105 !border-indigo-500 !bg-indigo-500/25 shadow-lg':
            dragOverCategory === 'uncategorized',
        }"
        :style="{
          backgroundColor:
            selectedCategory === 'uncategorized' ? '#f59e0b' : 'rgba(245,158,11,0.10)',
          borderColor: 'transparent',
          color: selectedCategory === 'uncategorized' ? '#fff' : '#f59e0b',
        }"
        @click="selectCategory('uncategorized')"
        @dragover.prevent="emit('dragover', $event, 'uncategorized')"
        @dragleave="emit('dragleave')"
        @drop="emit('drop', $event, 'uncategorized')"
      >
        未分类 ({{ uncategorizedCount }})
      </button>
    </div>

    <!-- Manage groups button -->
    <button
      class="px-2.5 py-0.5 text-[11px] rounded-full cursor-pointer transition-all border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 font-semibold flex items-center gap-0.5 shrink-0 ml-2"
      title="新建分组 / 重命名 / 删除"
      @click="emit('manage')"
    >
      <Edit class="h-3 w-3" />
      <span>管理</span>
    </button>
  </div>
</template>
