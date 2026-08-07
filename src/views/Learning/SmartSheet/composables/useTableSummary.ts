import type { SheetColumnDef, SheetRowData, ColumnSummaryType } from '../types/sheet';

export function useTableSummary() {
  const getDefaultSummaryType = (col: SheetColumnDef): ColumnSummaryType => {
    if (col.summaryType) return col.summaryType;
    if (col.type === 'number') return 'sum';
    if (col.type === 'rating') return 'avg';
    if (col.type === 'checkbox') return 'percent';
    return 'count';
  };

  const calculateColumnSummary = (
    col: SheetColumnDef,
    rows: SheetRowData[],
    summaryTypeOverride?: ColumnSummaryType,
  ): { label: string; value: string } => {
    const summaryType = summaryTypeOverride || getDefaultSummaryType(col);

    if (rows.length === 0) {
      return { label: getSummaryLabel(summaryType), value: '-' };
    }

    if (summaryType === 'count') {
      let count = 0;
      rows.forEach((r) => {
        const val = r.cells[col.id];
        if (
          val !== undefined &&
          val !== null &&
          val !== '' &&
          !(Array.isArray(val) && val.length === 0)
        ) {
          count++;
        }
      });
      return { label: '计数', value: `${count} 条` };
    }

    if (summaryType === 'percent') {
      let trueCount = 0;
      rows.forEach((r) => {
        if (r.cells[col.id] === true) trueCount++;
      });
      const pct = Math.round((trueCount / rows.length) * 100);
      return { label: '完成率', value: `${trueCount}/${rows.length} (${pct}%)` };
    }

    // Numeric calculations
    const nums: number[] = [];
    rows.forEach((r) => {
      const val = Number(r.cells[col.id]);
      if (
        !isNaN(val) &&
        r.cells[col.id] !== undefined &&
        r.cells[col.id] !== null &&
        r.cells[col.id] !== ''
      ) {
        nums.push(val);
      }
    });

    if (nums.length === 0) {
      return { label: getSummaryLabel(summaryType), value: '0' };
    }

    if (summaryType === 'sum') {
      const sum = nums.reduce((a, b) => a + b, 0);
      return { label: '求和', value: `${Math.round(sum * 100) / 100}` };
    }

    if (summaryType === 'avg') {
      const sum = nums.reduce((a, b) => a + b, 0);
      const avg = Math.round((sum / nums.length) * 10) / 10;
      return { label: '均值', value: col.type === 'rating' ? `${avg} ★` : `${avg}` };
    }

    if (summaryType === 'min') {
      const min = Math.min(...nums);
      return { label: '最小', value: `${min}` };
    }

    if (summaryType === 'max') {
      const max = Math.max(...nums);
      return { label: '最大', value: `${max}` };
    }

    return { label: '计数', value: `${rows.length}` };
  };

  const getSummaryLabel = (type: ColumnSummaryType): string => {
    const map: Record<ColumnSummaryType, string> = {
      sum: '求和',
      avg: '均值',
      count: '计数',
      percent: '完成率',
      min: '最小',
      max: '最大',
    };
    return map[type] || '统计';
  };

  return {
    getDefaultSummaryType,
    calculateColumnSummary,
    getSummaryLabel,
  };
}
