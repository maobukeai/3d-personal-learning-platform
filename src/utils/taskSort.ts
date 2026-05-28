/**
 * Parses a Chinese numeral string (up to 99) into its numeric value.
 */
export const parseChineseNumber = (cn: string | null | undefined): number => {
  if (!cn || typeof cn !== 'string') return -1;
  const cnNums: Record<string, number> = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
  };
  if (cn.length === 1) {
    return cnNums[cn] ?? -1;
  }
  if (cn.length === 2) {
    if (cn[0] === '十') {
      return 10 + (cnNums[cn[1]] ?? 0);
    }
    if (cn[1] === '十') {
      return (cnNums[cn[0]] ?? 0) * 10;
    }
  }
  if (cn.length === 3 && cn[1] === '十') {
    return (cnNums[cn[0]] ?? 0) * 10 + (cnNums[cn[2]] ?? 0);
  }
  return -1;
};

/**
 * Extracts the day index (e.g. from '第X天', 'Day X', or '[X]') to support natural sorting.
 */
export const getTaskDayIndex = (title: string | null | undefined): number => {
  if (!title || typeof title !== 'string') return Infinity;
  const cnMatch = title.match(/第\s*([一二三四五六七八九十]+)\s*天/);
  if (cnMatch) {
    const num = parseChineseNumber(cnMatch[1]);
    if (num !== -1) return num;
  }
  const arabicMatch = title.match(/(?:第|Day)?\s*(\d+)\s*(?:天|Day)?/i);
  if (arabicMatch) {
    return parseInt(arabicMatch[1], 10);
  }
  const bracketMatch = title.match(/^\[\s*(\d+)\s*\]/);
  if (bracketMatch) {
    return parseInt(bracketMatch[1], 10);
  }
  return Infinity;
};

/**
 * Gets the creation timestamp of a task as a number for ordering comparison.
 */
export const getTaskTime = (t: unknown): number => {
  if (!t || typeof t !== 'object' || !('createdAt' in t)) return 0;
  const createdAt = (t as { createdAt?: string | Date | null }).createdAt;
  if (!createdAt) return 0;
  const time = new Date(createdAt).getTime();
  return isNaN(time) ? 0 : time;
};
