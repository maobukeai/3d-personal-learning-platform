import type { CustomSheetTable } from '../types/sheet';
import { PRESET_TABLE_TEMPLATES } from './presetTemplates';

const STORAGE_KEY = 'smart_sheet_tables_v2';

export class SheetStorage {
  static getTables(): CustomSheetTable[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(PRESET_TABLE_TEMPLATES));
        return PRESET_TABLE_TEMPLATES;
      }
      return JSON.parse(raw) as CustomSheetTable[];
    } catch {
      return PRESET_TABLE_TEMPLATES;
    }
  }

  static saveTables(tables: CustomSheetTable[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  }

  static exportAllAsJSON(tables: CustomSheetTable[]): void {
    const dataStr = JSON.stringify(tables, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `custom-smart-sheets-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  static exportTableAsCSV(table: CustomSheetTable): void {
    const headers = table.columns.map((c) => `"${c.name.replace(/"/g, '""')}"`);
    const rows = table.rows.map((row) => {
      return table.columns.map((col) => {
        const val = row.cells[col.id];
        if (val === undefined || val === null) return '""';
        if (Array.isArray(val)) return `"${val.join('; ')}"`;
        if (typeof val === 'boolean') return val ? '"是"' : '"否"';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${table.title}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
