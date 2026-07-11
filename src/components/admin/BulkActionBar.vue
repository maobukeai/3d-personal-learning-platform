<script setup lang="ts">
import { computed } from 'vue';
import { X } from 'lucide-vue-next';
import Button from '@/components/ui/Button.vue';
import type { AdminAction, AdminBulkAction } from './types';
interface Props {
  selectedCount: number;
  actions: (AdminAction | AdminBulkAction)[];
}
const props = defineProps<Props>();
const emit = defineEmits<{ (e: 'action', actionId: string): void; (e: 'clear'): void }>();
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
const toButtonVariant = (v?: AdminAction['variant']): ButtonVariant => {
  if (v === 'primary') return 'primary';
  if (v === 'danger') return 'danger';
  if (v === 'ghost') return 'outline';
  return 'secondary';
};
const visibleActions = computed(() => props.actions);
</script>
<template>
  <div
    class="bulk-action-bar sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-2.5"
    role="region"
    aria-label="Bulk actions"
  >
    <div class="flex items-center gap-3 min-w-0">
      <span
        class="bulk-count inline-flex items-center gap-2 typo-body whitespace-nowrap"
        style="font-weight: var(--font-semibold)"
      >
        <span
          class="bulk-badge inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full typo-caption text-white bg-accent"
          style="font-weight: var(--font-bold); line-height: 1"
          :aria-label="`${props.selectedCount} items selected`"
        >
          {{ props.selectedCount }}
        </span>
        <span style="color: var(--text-on-solid-primary)">selected</span>
      </span>
      <button
        type="button"
        class="bulk-clear-btn inline-flex items-center gap-1 typo-caption"
        style="font-weight: var(--font-semibold); color: var(--text-on-solid-muted)"
        aria-label="Clear selection"
        @click="emit('clear')"
      >
        <X class="w-3 h-3" /> <span>Clear</span>
      </button>
    </div>
    <div class="flex items-center gap-2 flex-wrap justify-end">
      <Button
        v-for="action in visibleActions"
        :key="action.id"
        :variant="toButtonVariant(action.variant)"
        size="sm"
        :icon="action.icon ?? undefined"
        :aria-label="action.label"
        @click="emit('action', action.id)"
      >
        {{ action.label }}
      </Button>
    </div>
  </div>
</template>
<style scoped>
.bulk-action-bar {
  background-color: var(--surface-solid);
  border: 1px solid var(--border-base);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}
.bulk-badge {
  line-height: 1;
}
.bulk-clear-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-standard);
}
.bulk-clear-btn:hover {
  color: var(--text-on-solid-primary);
}
</style>
