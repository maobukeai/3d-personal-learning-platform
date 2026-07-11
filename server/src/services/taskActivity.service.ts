import prisma from './prisma';
import { logger } from '../utils/logger';
import type { TransactionClient } from '../utils/dbLock';

export interface LogTaskActivityParams {
  taskId: string;
  userId: string;
  action: string;
  description: string;
  oldValue?: string | null;
  newValue?: string | null;
  tx?: TransactionClient;
}

export const logTaskActivity = async (params: LogTaskActivityParams) => {
  try {
    const client = params.tx || prisma;
    return await client.taskActivity.create({
      data: {
        taskId: params.taskId,
        userId: params.userId,
        action: params.action,
        description: params.description,
        oldValue: params.oldValue || null,
        newValue: params.newValue || null,
      },
    });
  } catch (error) {
    logger.error('Failed to log task activity:', error);
  }
};
