import prisma from './prisma';
import { createNotification } from '../utils/notification';
import { logger } from '../utils/logger';
import { TaskStatus } from '../types/task';

/**
 * 任务到期提醒定时任务。
 *
 * 每小时扫描一次：
 *  - 24 小时内到期且未完成的任务 → 站内通知 + 邮件（走用户通知偏好）
 *  - 已逾期且未完成/未取消的任务 → 逾期提醒
 *
 * 去重：同一用户 + 同一任务 + 同一提醒类型，24 小时内只发一条，
 * 避免逾期任务每小时重复轰炸（每天最多提醒一次）。
 */

const TYPE_DUE_SOON = 'TASK_DUE_SOON';
const TYPE_OVERDUE = 'TASK_OVERDUE';
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

const formatDueLabel = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
};

const alreadyRemindedRecently = async (
  userId: string,
  link: string,
  type: string,
): Promise<boolean> => {
  const since = new Date(Date.now() - DEDUP_WINDOW_MS);
  const existing = await prisma.notification.findFirst({
    where: { userId, type, link, createdAt: { gt: since } },
    select: { id: true },
  });
  return existing !== null;
};

const runDueReminderSweep = async (): Promise<void> => {
  const now = new Date();
  const soonWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // 一次查出所有候选：未完成/未取消 且 24 小时内到期（含已逾期）
  const candidates = await prisma.task.findMany({
    where: {
      status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      dueDate: { lte: soonWindowEnd, not: null },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      userId: true,
      assigneeId: true,
    },
    take: 500,
  });

  let sent = 0;
  for (const task of candidates) {
    // 提醒对象：优先负责人，其次任务创建者
    const recipientId = task.assigneeId || task.userId;
    if (!recipientId || !task.dueDate) continue;

    const isOverdue = task.dueDate < now;
    const type = isOverdue ? TYPE_OVERDUE : TYPE_DUE_SOON;
    const link = `/tasks?id=${task.id}`;

    try {
      if (await alreadyRemindedRecently(recipientId, link, type)) continue;

      const dueLabel = formatDueLabel(task.dueDate);
      await createNotification({
        userId: recipientId,
        type,
        category: 'TASK_UPDATE',
        title: isOverdue ? '任务已逾期' : '任务即将到期',
        content: isOverdue
          ? `任务「${task.title}」已于 ${dueLabel} 逾期，请尽快处理或调整截止日期。`
          : `任务「${task.title}」将于 ${dueLabel} 到期，记得安排时间完成。`,
        link,
      });
      sent++;
    } catch (err) {
      logger.error(`[TaskDueReminder] Failed to remind task ${task.id}:`, err);
    }
  }

  if (sent > 0) {
    logger.info(`[TaskDueReminder] Sweep done, sent ${sent} reminder(s)`);
  }
};

export const startTaskDueReminderScheduler = (): void => {
  const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 每小时
  const INITIAL_DELAY_MS = 60 * 1000; // 启动 1 分钟后先跑一轮

  setTimeout(() => {
    void runDueReminderSweep();
    const timer = setInterval(() => {
      void runDueReminderSweep();
    }, SWEEP_INTERVAL_MS);
    // 不阻止进程退出
    timer.unref();
  }, INITIAL_DELAY_MS).unref();

  logger.info(`[TaskDueReminder] Scheduler started (interval: ${SWEEP_INTERVAL_MS / 60000}min)`);
};
