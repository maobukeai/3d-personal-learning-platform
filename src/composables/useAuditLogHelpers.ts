import { formatDateTime } from '@/utils/format';
import type { User } from '@/types';

export type AuditSeverity = 'high' | 'medium' | 'low';

export interface AuditModuleOption {
  label: string;
  value: string;
  tone: string;
}

export const AUDIT_MODULES: AuditModuleOption[] = [
  { label: '全部模块', value: '', tone: 'tone-default' },
  { label: '系统设置', value: 'SETTINGS', tone: 'tone-settings' },
  { label: '用户', value: 'USER', tone: 'tone-user' },
  { label: '团队', value: 'TEAM', tone: 'tone-team' },
  { label: '课程', value: 'COURSE', tone: 'tone-course' },
  { label: '资产', value: 'ASSET', tone: 'tone-asset' },
  { label: '材质', value: 'MATERIAL', tone: 'tone-material' },
  { label: '作品', value: 'SHOWCASE', tone: 'tone-showcase' },
  { label: '插件', value: 'PLUGIN', tone: 'tone-plugin' },
  { label: '反馈', value: 'FEEDBACK', tone: 'tone-feedback' },
  { label: '登录认证', value: 'AUTH', tone: 'tone-auth' },
  { label: '项目', value: 'PROJECT', tone: 'tone-project' },
  { label: '任务', value: 'TASK', tone: 'tone-task' },
];

const ACTION_LABELS: Record<string, string> = {
  LOGIN: '登录',
  LOGOUT: '退出',
  UPDATE_SETTINGS: '更新设置',
  CREATE_USER: '创建用户',
  UPDATE_USER: '更新用户',
  DELETE_USER: '删除用户',
  RESET_PASSWORD: '重置密码',
  REVOKE_SESSIONS: '撤销会话',
  CREATE_ASSET: '创建资产',
  UPDATE_ASSET: '更新资产',
  APPROVE_ASSET: '通过资产',
  REJECT_ASSET: '驳回资产',
  DELETE_ASSET: '删除资产',
  CREATE_COURSE: '创建课程',
  UPDATE_COURSE: '更新课程',
  DELETE_COURSE: '删除课程',
  CREATE_MATERIAL: '创建材质',
  UPDATE_MATERIAL: '更新材质',
  DELETE_MATERIAL: '删除材质',
  APPROVE_MATERIAL: '通过材质',
  REJECT_MATERIAL: '驳回材质',
  APPROVE_SHOWCASE: '通过作品',
  REJECT_SHOWCASE: '驳回作品',
  UPDATE_SHOWCASE: '更新作品',
  DELETE_SHOWCASE: '删除作品',
  APPROVE_PLUGIN: '通过插件',
  REJECT_PLUGIN: '驳回插件',
  UPDATE_PLUGIN: '更新插件',
  DELETE_PLUGIN: '删除插件',
  UPDATE_FEEDBACK: '更新反馈',
  DELETE_FEEDBACK: '删除反馈',
};

export function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

export function getModuleLabel(module: string): string {
  return AUDIT_MODULES.find((item) => item.value === module)?.label || module || '未知模块';
}

export function getModuleTone(module: string): string {
  return AUDIT_MODULES.find((item) => item.value === module)?.tone || 'tone-default';
}

export function getSeverity(action: string): AuditSeverity {
  if (/DELETE|RESET_PASSWORD|REVOKE|BAN|CLEANUP|REJECT/.test(action)) return 'high';
  if (/UPDATE_SETTINGS|BATCH|APPROVE|CREATE_USER|UPDATE_USER/.test(action)) return 'medium';
  return 'low';
}

export function getSeverityLabel(action: string): string {
  const severity = getSeverity(action);
  if (severity === 'high') return '高';
  if (severity === 'medium') return '中';
  return '低';
}

export function getAgentLabel(userAgent?: string | null): string {
  if (!userAgent) return '未知设备';
  if (/Edg/i.test(userAgent)) return 'Microsoft Edge';
  if (/Chrome/i.test(userAgent)) return 'Chrome';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Safari/i.test(userAgent)) return 'Safari';
  return userAgent.split(' ')[0] || '未知设备';
}

export function getActorName(user?: User | null): string {
  return user?.name || user?.email || 'System';
}

export function prettyJson(value?: string | null): string {
  if (!value) return '无';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function formatShortDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDay(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatRelative(date: string): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (diffSeconds < 60) return `${diffSeconds} 秒前`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${Math.floor(diffHours / 24)} 天前`;
}

export function useAuditLogHelpers() {
  return {
    AUDIT_MODULES,
    getActionLabel,
    getModuleLabel,
    getModuleTone,
    getSeverity,
    getSeverityLabel,
    getAgentLabel,
    getActorName,
    prettyJson,
    formatShortDate,
    formatDay,
    formatRelative,
    formatDateTime,
  };
}
