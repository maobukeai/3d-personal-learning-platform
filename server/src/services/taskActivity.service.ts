import prisma from './prisma';
import { logger } from '../utils/logger';

export interface LogTaskActivityParams {
  taskId: string;
  userId: string;
  action: string;
  description: string;
  oldValue?: string | null;
  newValue?: string | null;
}

export const logTaskActivity = async (params: LogTaskActivityParams) => {
  try {
    return await prisma.taskActivity.create({
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
