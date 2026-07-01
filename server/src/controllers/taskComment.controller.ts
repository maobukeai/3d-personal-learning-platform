import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createCommentController, type AccessResult } from './commentController.factory';
import { logTaskActivity } from '../services/taskActivity.service';

/**
 * Verify a task exists and the caller may interact with it.
 * - Task must belong to the caller's current team (or be team-less).
 * - If the task has a project, the caller must be a member of that project
 *   (or the project must be null — team-level task).
 * - Uses the same 404 message for not-found and forbidden to avoid leaking
 *   the existence of inaccessible tasks.
 */
const verifyTaskAccess = async (req: AuthRequest, taskId: string): Promise<AccessResult> => {
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
    return { ok: false, status: 404, message: '任务不存在或无权访问' };
  }

  return { ok: true };
};

const { list, create, remove } = createCommentController({
  verifyAccess: verifyTaskAccess,
  commentModel: prisma.taskComment,
  parentField: 'taskId',
  resourceIdParam: 'taskId',
  messages: {
    commentEmpty: '评论内容不能为空',
    commentNotFound: '评论不存在',
    commentDeleteForbidden: '无权删除此评论',
    commentDeleted: '评论删除成功',
    internalError: '服务器内部错误',
  },
  verifyCommentBelongsToResource: (comment, taskId) => comment.taskId === taskId,
  onCommentCreated: async (req, comment, taskId) => {
    await logTaskActivity({
      taskId,
      userId: req.userId as string,
      action: 'ADD_COMMENT',
      description: `发表了评论: "${comment.content}"`,
      newValue: JSON.stringify({ commentId: comment.id, content: comment.content }),
    });
  },
  onCommentDeleted: async (req, comment, taskId) => {
    await logTaskActivity({
      taskId,
      userId: req.userId as string,
      action: 'DELETE_COMMENT',
      description: '删除了评论',
      oldValue: JSON.stringify({ commentId: comment.id, content: comment.content }),
    });
  },
  logPrefix: 'Task comment',
});

export const getTaskComments = list;
export const createTaskComment = create;
export const deleteTaskComment = remove;
