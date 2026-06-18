/**
 * Parse a tags field that may be stored as a JSON array string or as
 * delimiter-separated text. Supports comma (half/full-width), semicolon
 * (half/full-width), and whitespace as delimiters for legacy records.
 */
export const parseTags = (tags?: string | null): string[] => {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag).trim()).filter(Boolean);
    }
  } catch {
    // Fall through to delimiter parsing for legacy records.
  }
  return tags
    .split(/[，,;；\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};
