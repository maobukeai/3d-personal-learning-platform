import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createCommentController, type AccessResult } from './commentController.factory';

/**
 * Verify a note exists and the caller may interact with it.
 * - PRIVATE notes require ownership, admin, or an active share link.
 * - The forbidden message differs by operation (view vs. comment).
 */
const verifyNoteAccess = async (
  req: AuthRequest,
  noteId: string,
  operation: 'list' | 'create',
): Promise<AccessResult> => {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { visibility: true, userId: true },
  });

  if (!note) {
    return { ok: false, status: 404, message: '笔记不存在' };
  }

  if (note.visibility === 'PRIVATE' && note.userId !== req.userId && req.user?.role !== 'ADMIN') {
    const isShared = await prisma.noteShare.findFirst({
      where: {
        noteId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!isShared) {
      return {
        ok: false,
        status: 403,
        message: operation === 'list' ? '无权查看此私有笔记的评论' : '无权评论此私有笔记',
      };
    }
  }

  return { ok: true };
};

const { list, create, remove } = createCommentController({
  verifyAccess: verifyNoteAccess,
  commentModel: prisma.noteComment,
  parentField: 'noteId',
  resourceIdParam: 'id',
  messages: {
    commentEmpty: '评论内容不能为空',
    commentNotFound: '评论不存在',
    commentDeleteForbidden: '无权删除此评论',
    commentDeleted: '评论已删除',
    internalError: 'Internal server error',
  },
  logPrefix: 'Note comment',
});

export const getNoteComments = list;
export const createNoteComment = create;
export const deleteNoteComment = remove;
