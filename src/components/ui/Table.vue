<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import type { TableColumnDefinition } from './tableContext';
import { tableContextKey } from './tableContext';

interface Props {
  data?: any[];
  loading?: boolean;
  rowKey?: string;
  rowClassName?: string | ((context: { row: any; rowIndex: number }) => string);
  emptyText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  loading: false,
  rowKey: 'id',
  rowClassName: undefined,
  emptyText: '暂无数据',
});

const emit = defineEmits<{ (event: 'row-click', row: any): void }>();
const columns = ref<TableColumnDefinition[]>([]);

provide(tableContextKey, {
  columns,
  register: (column) => {
    if (!columns.value.some((item) => item.id === column.id)) columns.value.push(column);
  },
  unregister: (id) => {
    columns.value = columns.value.filter((item) => item.id !== id);
  },
});

const visibleColumns = computed(() => columns.value);
const widthStyle = (column: TableColumnDefinition) =>
  column.width == null
    ? undefined
    : { width: typeof column.width === 'number' ? `${column.width}px` : column.width };
const cellStyle = (column: TableColumnDefinition) => ({ textAlign: column.align });
</script>

<template>
  <div class="table-shell relative overflow-x-auto" :aria-busy="loading">
    <div class="hidden"><slot /></div>
    <table class="w-full border-collapse text-sm">
      <thead class="bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
        <tr>
          <th
            v-for="column in visibleColumns"
            :key="String(column.id)"
            :style="[widthStyle(column), cellStyle(column)]"
            class="border-b border-[var(--border-base)] px-3 py-2.5 font-medium"
          >
            <component :is="{ render: () => column.slots.header?.({}) ?? column.label }" />
          </th>
        </tr>
      </thead>
      <tbody v-if="data.length">
        <tr
          v-for="(row, index) in data"
          :key="String(row[rowKey] ?? index)"
          class="border-b border-[var(--border-base)] last:border-b-0 hover:bg-[var(--bg-hover)]"
          :class="
            typeof rowClassName === 'function'
              ? rowClassName({ row, rowIndex: index })
              : rowClassName
          "
          @click="emit('row-click', row)"
        >
          <td
            v-for="column in visibleColumns"
            :key="String(column.id)"
            :style="[widthStyle(column), cellStyle(column)]"
            class="px-3 py-2.5 text-[var(--text-primary)]"
          >
            <component :is="{ render: () => column.slots.default?.({ row, $index: index }) }" />
          </td>
        </tr>
      </tbody>
    </table>
    <div v-if="!loading && !data.length" class="table-empty">
      <slot name="empty">{{ emptyText }}</slot>
    </div>
    <div
      v-if="loading"
      class="absolute inset-0 grid place-items-center bg-[var(--surface-solid)]/85 text-sm text-[var(--text-secondary)]"
    >
      加载中…
    </div>
  </div>
</template>
