import type {
  CustomSheetTable,
  SheetColumnDef,
  SheetColumnType,
  SelectOptionItem,
} from '../types/sheet';
import { ElMessage } from '@/utils/feedbackBridge';

export function useTableSchema() {
  const addColumn = (
    table: CustomSheetTable,
    name: string,
    type: SheetColumnType,
    options?: SelectOptionItem[],
  ) => {
    const newCol: SheetColumnDef = {
      id: 'col-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      name: name || '新列',
      type,
      width: type === 'rich-text' ? 200 : type === 'checkbox' ? 90 : 140,
      options: options || (type === 'select' || type === 'multi-select' ? [] : undefined),
    };
    table.columns.push(newCol);
    return newCol;
  };

  const updateColumn = (
    table: CustomSheetTable,
    colId: string,
    updates: Partial<SheetColumnDef>,
  ) => {
    const idx = table.columns.findIndex((c) => c.id === colId);
    if (idx !== -1) {
      table.columns[idx] = { ...table.columns[idx], ...updates };
    }
  };

  const moveColumn = (table: CustomSheetTable, colId: string, direction: 'left' | 'right') => {
    const idx = table.columns.findIndex((c) => c.id === colId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= table.columns.length) return;

    const temp = table.columns[idx];
    table.columns[idx] = table.columns[targetIdx];
    table.columns[targetIdx] = temp;
  };

  const removeColumn = (table: CustomSheetTable, colId: string) => {
    if (table.columns.length <= 1) {
      ElMessage.warning('表格至少需要保留一列！');
      return;
    }
    table.columns = table.columns.filter((c) => c.id !== colId);
    table.rows.forEach((row) => {
      delete row.cells[colId];
    });
  };

  return {
    addColumn,
    updateColumn,
    moveColumn,
    removeColumn,
  };
}
