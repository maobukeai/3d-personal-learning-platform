<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  currentPage?: number;
  pageSize?: number;
  total?: number;
  disabled?: boolean;
  pagerCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  currentPage: 1,
  pageSize: 10,
  total: 0,
  disabled: false,
  pagerCount: 7,
});

const emit = defineEmits<{
  (event: 'update:currentPage', page: number): void;
  (event: 'current-change', page: number): void;
}>();

const pageCount = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const pages = computed(() => {
  const max = Math.min(pageCount.value, props.pagerCount);
  const start = Math.max(
    1,
    Math.min(props.currentPage - Math.floor(max / 2), pageCount.value - max + 1),
  );
  return Array.from({ length: max }, (_, index) => start + index);
});

const goTo = (page: number) => {
  if (props.disabled) return;
  const next = Math.max(1, Math.min(page, pageCount.value));
  emit('update:currentPage', next);
  emit('current-change', next);
};
</script>

<template>
  <nav class="flex items-center gap-1" aria-label="Pagination">
    <button
      type="button"
      class="pagination-button"
      :disabled="disabled || currentPage <= 1"
      aria-label="Previous page"
      @click="goTo(currentPage - 1)"
    >
      ‹
    </button>
    <button
      v-for="page in pages"
      :key="page"
      type="button"
      class="pagination-button"
      :class="{ 'pagination-button--active': page === currentPage }"
      :disabled="disabled"
      :aria-current="page === currentPage ? 'page' : undefined"
      @click="goTo(page)"
    >
      {{ page }}
    </button>
    <button
      type="button"
      class="pagination-button"
      :disabled="disabled || currentPage >= pageCount"
      aria-label="Next page"
      @click="goTo(currentPage + 1)"
    >
      ›
    </button>
  </nav>
</template>

<style scoped>
.pagination-button {
  min-width: 32px;
  height: 32px;
  border: 1px solid var(--border-base);
  border-radius: var(--radius-control);
  background: var(--surface-solid);
  color: var(--text-secondary);
  cursor: pointer;
}

.pagination-button:hover:not(:disabled),
.pagination-button--active {
  border-color: var(--accent);
  color: var(--accent);
}

.pagination-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
