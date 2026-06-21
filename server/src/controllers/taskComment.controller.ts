import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import logger from '../utils/logger';
import { logTaskActivity } from '../services/taskActivity.service';

// Get comments for a task
export const getTaskComments = async (req: AuthRequest, res: Response) => {
  const taskId = req.params.taskId as string;
  try {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        teamId: req.workspaceId || null,
        OR: [
          { projectId: null },
          {
            project: {
              members: {
                some: { userId: req.userId as string },
              },
            },
          },
        ],
      },
    });

    if (!task) {
      return res.status(404).json({ error: '任务不存在或无权访问' });
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(comments);
  } catch (error) {
    logger.error('Get task comments error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// Create a task comment
export const createTaskComment = async (req: AuthRequest, res: Response) => {
  const taskId = req.params.taskId as string;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: '评论内容不能为空' });
  }

  try {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        teamId: req.workspaceId || null,
        OR: [
          { projectId: null },
          {
            project: {
              members: {
                some: { userId: req.userId as string },
              },
            },
          },
        ],
      },
    });

    if (!task) {
      return res.status(404).json({ error: '任务不存在或无权访问' });
    }

    const comment = await prisma.taskComment.create({
      data: {
        content: content.trim(),
        taskId,
        userId: req.userId as string,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    await logTaskActivity({
      taskId,
      userId: req.userId as string,
      action: 'ADD_COMMENT',
      description: `发表了评论: "${content.trim()}"`,
      newValue: JSON.stringify({ commentId: comment.id, content: comment.content }),
    });

    res.status(201).json(comment);
  } catch (error) {
    logger.error('Create task comment error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// Delete a task comment
export const deleteTaskComment = async (req: AuthRequest, res: Response) => {
  const taskId = req.params.taskId as string;
  const commentId = req.params.commentId as string;

  try {
    const comment = await prisma.taskComment.findUnique({
      where: { id: commentId },
    });

    if (!comment || comment.taskId !== taskId) {
      return res.status(404).json({ error: '评论不存在' });
    }

    // Check if user is the comment author or an admin
    if (comment.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: '无权删除此评论' });
    }

    await prisma.taskComment.delete({
      where: { id: commentId },
    });

    await logTaskActivity({
      taskId,
      userId: req.userId as string,
      action: 'DELETE_COMMENT',
      description: '删除了评论',
      oldValue: JSON.stringify({ commentId, content: comment.content }),
    });

    res.json({ message: '评论删除成功' });
  } catch (error) {
    logger.error('Delete task comment error:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};
