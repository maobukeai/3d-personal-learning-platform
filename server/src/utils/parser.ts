/**
 * Helper to safely parse string, number, or boolean request input into a boolean.
 * Returns defaultVal if value is null, undefined, or an empty string.
 */
export function parseBool(val: unknown, defaultVal = false): boolean {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  const str = String(val).toLowerCase().trim();
  return str === 'true' || str === '1';
}

/**
 * Helper to safely parse request input into a number.
 * Returns defaultVal if parsing fails or input is empty.
 */
export function parseNum(val: unknown, defaultVal: number | null = null): number | null {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? defaultVal : parsed;
}
