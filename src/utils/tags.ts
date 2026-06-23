/**
 * 统一的标签解析与展示工具
 * 所有前端组件应从此模块导入 parseTags / getTagClass，避免重复实现
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
  } catch {
    // Fall through to delimiter parsing.
  }
  return tags
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const TAG_COLOR_POOL = [
  'bg-blue-500/10 text-blue-500',
  'bg-purple-500/10 text-purple-500',
  'bg-pink-500/10 text-pink-500',
  'bg-indigo-500/10 text-indigo-500',
  'bg-teal-500/10 text-teal-500',
];

/**
 * 根据标签字符串生成稳定的颜色类名。
 * 相同标签在不同组件中会得到相同颜色，保证视觉一致性。
 */
export function getTagClass(tag: string): string {
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return TAG_COLOR_POOL[hash % TAG_COLOR_POOL.length];
}
