export const PLAN_PRIORITIES = {
  FREE: 0,
  VIP: 1,
  SVIP: 2,
} as const;

export const PLAN_NAMES: Record<number, string> = {
  [PLAN_PRIORITIES.FREE]: '免费版',
  [PLAN_PRIORITIES.VIP]: 'VIP',
  [PLAN_PRIORITIES.SVIP]: 'SVIP',
};

export function getPlanName(priority: number): string {
  return PLAN_NAMES[priority] || `等级${priority}`;
}
