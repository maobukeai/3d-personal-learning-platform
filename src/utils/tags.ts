/**
 * 统一的标签解析工具
 * 所有前端组件应从此模块导入 parseTags，避免重复实现
 */

/**
 * 将标签字段解析为字符串数组。
 * 兼容三种存储形式：JSON 数组字符串、原生数组、分隔符字符串。
 */
export function parseTags(tags?: string | string[] | null): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch (_error) {
    // Fall through to delimiter parsing.
  }
  return tags
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
