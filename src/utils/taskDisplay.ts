/**
 * 任务展示相关的统一工具函数
 * 所有任务优先级、截止日期、逾期判断等展示逻辑应从此模块导入，避免各组件重复实现
 */

import { Flame, ArrowUp, Minus, ArrowDown, HelpCircle, type LucideIcon } from 'lucide-vue-next';
import { TaskStatus } from '@/types';

export type TaskPriorityValue = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface PriorityOption {
  value: TaskPriorityValue;
  label: string;
  labelKey: string;
  color: string;
  icon: LucideIcon;
}

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'URGENT', label: '紧急', labelKey: 'tasks.urgent', color: 'rose', icon: Flame },
  { value: 'HIGH', label: '高', labelKey: 'tasks.high', color: 'orange', icon: ArrowUp },
  { value: 'MEDIUM', label: '中', labelKey: 'tasks.medium', color: 'amber', icon: Minus },
  { value: 'LOW', label: '低', labelKey: 'tasks.low', color: 'blue', icon: ArrowDown },
  { value: 'NONE', label: '无', labelKey: 'tasks.none', color: 'slate', icon: HelpCircle },
];

const PRIORITY_MAP = new Map<string, PriorityOption>(
  PRIORITY_OPTIONS.map((option) => [option.value, option]),
);

export function getPriorityOption(priority?: string | null): PriorityOption {
  return PRIORITY_MAP.get(priority ?? '') ?? PRIORITY_OPTIONS[4];
}

export function getPriorityColorClass(
  priority?: string | null,
  type: 'bg' | 'text' = 'bg',
): string {
  const option = getPriorityOption(priority);
  return `${type}-${option.color}-500`;
}

export function getPriorityBadgeClass(priority?: string | null): string {
  const option = getPriorityOption(priority);
  return `bg-${option.color}-500/10 text-${option.color}-500`;
}

export interface OverdueOptions {
  /** 哪些状态视为已完成，默认包含 DONE */
  doneStatuses?: string[];
}

export function isOverdue(
  dueDate?: string | null | undefined,
  status?: string | null,
  options: OverdueOptions = {},
): boolean {
  const { doneStatuses = [TaskStatus.DONE] } = options;
  if (!dueDate || doneStatuses.includes(status ?? '')) return false;
  return new Date(dueDate) < new Date();
}

export function isTaskOverdue(
  task: { dueDate?: string | null; status?: string | null },
  options?: OverdueOptions,
): boolean {
  return isOverdue(task.dueDate, task.status, options);
}

export function formatDueDate(dateStr?: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = dDate.getTime() - nowDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return '今天截止';
  if (diffDays === 1) return '明天截止';
  if (diffDays <= 7) return `${diffDays} 天后截止`;
  return d.toLocaleDateString();
}

export function formatShortDate(dateStr?: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function toIsoDate(dateValue?: string | Date | null): string | null {
  if (!dateValue) return null;
  const d = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
