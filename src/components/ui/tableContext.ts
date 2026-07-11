import type { InjectionKey, Ref, Slots, VNode } from 'vue';

export interface TableColumnDefinition {
  id: symbol;
  label?: string;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  slots: Slots;
}

export interface TableContext {
  columns: Ref<TableColumnDefinition[]>;
  register: (column: TableColumnDefinition) => void;
  unregister: (id: symbol) => void;
}

export const tableContextKey: InjectionKey<TableContext> = Symbol('table-context');
export type TableCellSlot = (scope: { row: Record<string, unknown>; $index: number }) => VNode[];
