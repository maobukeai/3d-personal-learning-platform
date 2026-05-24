export const clampNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed =
    typeof value === 'string' || typeof value === 'number' ? Number.parseInt(String(value), 10) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

export const clampPage = (value: unknown, fallback = 1): number =>
  clampNumber(value, fallback, 1, 100000);

export const clampLimit = (value: unknown, fallback: number, max = 100): number =>
  clampNumber(value, fallback, 1, max);
