<script setup lang="ts">
import { MonitorPlay, Edit3, Trash2 } from 'lucide-vue-next';
import type { ShowcaseItem } from './showcaseTypes';
import { getTypeLabel } from './showcaseHelpers';
defineProps<{
  item: ShowcaseItem | null;
  canManage: boolean;
  isEditing: boolean;
  isDeleting: boolean;
}>();
defineEmits<{ (e: 'start-edit'): void; (e: 'delete'): void }>();
</script>
<template>
  <div class="flex items-center justify-between w-full">
    <div class="flex items-center gap-3">
      <MonitorPlay class="h-5 w-5 text-indigo-400" />
      <div class="min-w-0">
        <h3
          class="text-base sm:text-lg font-bold leading-6 text-[var(--text-primary)] truncate max-w-[280px] sm:max-w-[450px]"
        >
          {{ item?.title || '作品详情' }}
        </h3>
        <p v-if="item" class="text-xs text-[var(--text-muted)] mt-0.5">
          {{ getTypeLabel(item.type) }} 作品
        </p>
      </div>
    </div>
    <!-- Header Actions (Edit / Delete) -->
    <div v-if="item" class="flex items-center gap-2 mr-6 shrink-0">
      <button
        v-if="canManage && !isEditing"
        type="button"
        class="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
        title="编辑作品"
        @click="$emit('start-edit')"
      >
        <Edit3 class="w-4 h-4" />
      </button>
      <button
        v-if="canManage"
        type="button"
        class="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all cursor-pointer flex items-center justify-center"
        :disabled="isDeleting"
        title="删除作品"
        @click="$emit('delete')"
      >
        <Trash2 class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>
