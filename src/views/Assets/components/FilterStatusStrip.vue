<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { useLabel } from '@/utils/i18n';

interface FilterChip {
  key: string;
  label: string;
}

defineProps<{
  currentCount: number;
  totalCount: number;
  unitLabel: string;
  emptyChipsLabel: string;
  activeChips: FilterChip[];
}>();

const emit = defineEmits<{
  (e: 'clear-chip', key: string): void;
  (e: 'reset'): void;
}>();

const label = useLabel();
</script>

<template>
  <section class="filter-status-strip mobile-row">
    <div>
      <strong>{{ currentCount }}</strong>
      <span>/ {{ totalCount }} {{ unitLabel }}</span>
    </div>
    <div class="chip-row">
      <button
        v-for="chip in activeChips"
        :key="chip.key"
        type="button"
        @click="emit('clear-chip', chip.key)"
      >
        {{ chip.label }}
        <X class="icon-xs" />
      </button>
      <button
        v-if="activeChips.length"
        type="button"
        class="reset-chip"
        @click="emit('reset')"
      >
        {{ label('清空筛选', 'Clear Filters') }}
      </button>
      <span v-else>{{ emptyChipsLabel }}</span>
    </div>
  </section>
</template>

<style scoped>
.filter-status-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card);
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-base);
  font-size: 11px;
}

.filter-status-strip div:first-child {
  color: var(--text-muted);
}

.filter-status-strip strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
}

.chip-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--text-muted);
}

.chip-row button {
  height: 22px;
  border: 1px solid var(--border-base);
  border-radius: 4px;
  background: var(--bg-app);
  color: var(--text-secondary);
  padding: 0 6px 0 8px;
  font-size: 10px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.chip-row button:hover {
  background: var(--bg-active);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.chip-row button.reset-chip {
  border-color: transparent;
  background: transparent;
  color: var(--accent);
  padding: 0 4px;
}

.chip-row button.reset-chip:hover {
  color: var(--accent-hover);
  text-decoration: underline;
}

.icon-xs {
  width: 12px;
  height: 12px;
}

@media (max-width: 680px) {
  .mobile-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
}
</style>
