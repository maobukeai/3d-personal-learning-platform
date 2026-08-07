import { ref, computed } from 'vue';
import type { CustomSheetTable, SheetRowData, SheetSummaryMetrics } from '../types/sheet';

export function useTableRowData(getTable: () => CustomSheetTable | null) {
  const searchQuery = ref('');

  const filteredRows = computed(() => {
    const table = getTable();
    if (!table) return [];

    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return table.rows;

    return table.rows.filter((row) => {
      return Object.values(row.cells).some((val) => {
        if (val === undefined || val === null) return false;
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(q);
        }
        if (Array.isArray(val)) {
          return val.some((v) => String(v).toLowerCase().includes(q));
        }
        return false;
      });
    });
  });

  const summaryMetrics = computed<SheetSummaryMetrics>(() => {
    const table = getTable();
    if (!table) {
      return { totalRows: 0, numberColSums: [], completedCheckboxCount: 0, totalCheckboxCount: 0 };
    }

    const totalRows = table.rows.length;
    const numberCols = table.columns.filter((c) => c.type === 'number');
    const checkboxCols = table.columns.filter((c) => c.type === 'checkbox');

    const numberColSums = numberCols.map((col) => {
      let sum = 0;
      let count = 0;
      table.rows.forEach((row) => {
        const val = Number(row.cells[col.id]);
        if (!isNaN(val) && row.cells[col.id] !== undefined) {
          sum += val;
          count++;
        }
      });
      return {
        colName: col.name,
        sum: Math.round(sum * 100) / 100,
        avg: count ? Math.round((sum / count) * 100) / 100 : 0,
      };
    });

    let completedCheckboxCount = 0;
    let totalCheckboxCount = 0;
    checkboxCols.forEach((col) => {
      table.rows.forEach((row) => {
        totalCheckboxCount++;
        if (row.cells[col.id] === true) {
          completedCheckboxCount++;
        }
      });
    });

    return {
      totalRows,
      numberColSums,
      completedCheckboxCount,
      totalCheckboxCount,
    };
  });

  const addRow = (table: CustomSheetTable) => {
    const defaultCells: Record<string, any> = {};
    table.columns.forEach((col) => {
      if (col.type === 'date') {
        defaultCells[col.id] = new Date().toISOString().slice(0, 10);
      } else if (col.type === 'checkbox') {
        defaultCells[col.id] = false;
      } else if (col.type === 'rating') {
        defaultCells[col.id] = 3;
      } else if (col.type === 'multi-select') {
        defaultCells[col.id] = [];
      } else {
        defaultCells[col.id] = '';
      }
    });

    const newRow: SheetRowData = {
      id: 'row-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cells: defaultCells,
    };
    table.rows.unshift(newRow);
    return newRow;
  };

  const updateCell = (table: CustomSheetTable, rowId: string, colId: string, value: any) => {
    const row = table.rows.find((r) => r.id === rowId);
    if (row) {
      row.cells[colId] = value;
      row.updatedAt = new Date().toISOString();
    }
  };

  const removeRow = (table: CustomSheetTable, rowId: string) => {
    table.rows = table.rows.filter((r) => r.id !== rowId);
  };

  return {
    searchQuery,
    filteredRows,
    summaryMetrics,
    addRow,
    updateCell,
    removeRow,
  };
}
