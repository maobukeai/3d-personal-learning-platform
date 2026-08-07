export type SheetColumnType =
  | 'text'
  | 'select'
  | 'multi-select'
  | 'number'
  | 'date'
  | 'rating'
  | 'checkbox'
  | 'rich-text'
  | 'image';

export type ColumnSummaryType = 'sum' | 'avg' | 'count' | 'percent' | 'min' | 'max';

export interface SelectOptionItem {
  id: string;
  label: string;
  color?: string; // e.g. 'blue', 'emerald', 'amber', 'rose', 'purple', 'cyan'
}

export interface SheetColumnDef {
  id: string;
  name: string;
  type: SheetColumnType;
  width?: number;
  options?: SelectOptionItem[];
  summaryType?: ColumnSummaryType;
}

export interface SheetRowData {
  id: string;
  createdAt: string;
  updatedAt: string;
  cells: Record<string, any>; // columnId -> cell value
}

export interface CustomSheetTable {
  id: string;
  title: string;
  icon?: string;
  columns: SheetColumnDef[];
  rows: SheetRowData[];
}

export interface SheetSummaryMetrics {
  totalRows: number;
  numberColSums: { colName: string; sum: number; avg: number }[];
  completedCheckboxCount: number;
  totalCheckboxCount: number;
}
