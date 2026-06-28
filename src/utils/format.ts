/**
 * 统一的日期、文件大小、数字格式化工具函数
 * 所有前端组件应从此模块导入，避免重复实现
 */

// ─── 日期格式化 ───────────────────────────────────────────────────────────────

/** 格式化为 YYYY/MM/DD 日期 */
export function formatDate(value?: string | Date | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 格式化为 YYYY/MM/DD HH:mm 完整日期时间 */
export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 格式化为 HH:mm 时间 */
export function formatTime(value?: string | Date | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 相对时间（如 "3 分钟前"、"2 小时前"、"5 天前"） */
export function formatRelativeTime(value?: string | Date | null): string {
  if (!value) return '-';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDate(value);
}

/** 聊天消息日期分隔符格式（如 "今天"、"昨天"、"2024/01/15"） */
export function formatDateSeparator(value?: string | Date | null): string {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return '今天';
  if (date.toDateString() === yesterday.toDateString()) return '昨天';
  return formatDate(value);
}

// ─── 文件大小格式化 ───────────────────────────────────────────────────────────

/** 格式化 MB 为人类可读大小（如 "1.5 GB"、"512 KB"） */
export function formatFileSize(sizeMb?: number | null, fallback = '未知大小'): string {
  const size = Number(sizeMb || 0);
  if (!size) return fallback;
  if (size < 1) return `${Math.max(1, Math.round(size * 1024))} KB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} GB`;
  return `${size.toFixed(1)} MB`;
}

// ─── 数字格式化 ───────────────────────────────────────────────────────────────

/** 紧凑数字（如 "1.2亿"、"3.5万"、"1.2k"） */
export function formatCompactNumber(value?: number | null): string {
  const number = Number(value || 0);
  if (number >= 100000000) return `${(number / 100000000).toFixed(1)}亿`;
  if (number >= 10000) return `${(number / 10000).toFixed(1)}万`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return String(number);
}

// ─── Markdown 纯文本提取 ───────────────────────────────────────────────────────

/** 剥离 Markdown 格式符号，还原为纯文本摘要 */
export function stripMarkdown(content?: string | null): string {
  if (!content) return '';
  return content
    .replace(/```[\s\S]*?```/g, '') // 代码块
    .replace(/`([^`]+)`/g, '$1') // 行内代码
    .replace(/^#{1,6}\s+/gm, '') // 标题符号 (# ## ###)
    .replace(/!\[.*?\]\(.*?\)/g, '') // 图片
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // 链接
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1') // 加粗斜体
    .replace(/^\s*[-+*]\s+/gm, '') // 无序列表
    .replace(/^\s*\d+\.\s+/gm, '') // 有序列表
    .replace(/^\s*>\s+/gm, '') // 引用
    .replace(/[\r\n]+/g, ' ') // 换行转空格
    .replace(/\s{2,}/g, ' ') // 连续空格压缩
    .trim();
}
