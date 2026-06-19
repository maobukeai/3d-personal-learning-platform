/**
 * 团队相关公共工具
 * 统一团队描述清理逻辑与分类常量，避免多处硬编码
 */

/** 团队描述中用于分隔正文与核心价值观的分隔符 */
export const TEAM_CORE_VALUES_SEPARATOR = '\n\n===CORE_VALUES===\n';

/**
 * 从团队描述中移除核心价值观分隔符及其后的内容，
 * 仅返回展示用的正文部分。
 */
export function cleanTeamDescription(description?: string | null): string {
  const desc = description || '';
  return desc.split(TEAM_CORE_VALUES_SEPARATOR)[0];
}
