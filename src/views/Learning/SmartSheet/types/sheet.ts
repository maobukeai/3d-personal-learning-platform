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

export type SheetTemplateType = 'STUDY_LOG' | 'PROJECT_MILESTONE' | 'RESOURCE_INVENTORY';

export type RecordStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export type RecordPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

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

export interface SmartSheetItem {
  id: string;
  templateType: SheetTemplateType;
  title: string;
  category: string;
  tags: string[];
  status: RecordStatus;
  priority: RecordPriority;
  durationMinutes?: number;
  dueDate?: string;
  rating?: number;
  linkUrl?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SheetFilterOptions {
  search: string;
  templateType: SheetTemplateType | 'ALL';
  status: RecordStatus | 'ALL';
  category: string | 'ALL';
  sortBy: 'latest' | 'oldest' | 'priority' | 'duration';
}

export interface SheetSummary {
  totalCount: number;
  totalDurationHours: number;
  completedCount: number;
  completionRate: number;
}

export interface SheetSummaryMetrics {
  totalRows: number;
  numberColSums: { colName: string; sum: number; avg: number }[];
  completedCheckboxCount: number;
  totalCheckboxCount: number;
}
