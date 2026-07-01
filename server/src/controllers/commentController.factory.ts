import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import logger from '../utils/logger';

/**
 * Access-check result returned by `verifyAccess`.
 * - `{ ok: true }` — resource exists and caller may interact with it
 * - `{ ok: false, status, message }` — short-circuit response (404/403)
 */
export type AccessResult = { ok: true } | { ok: false; status: 404 | 403; message: string };

/**
 * Minimal structural type for a Prisma comment-model delegate.
 * Accepts `prisma.noteComment`, `prisma.taskComment`, etc.
 */
interface CommentDelegate {
  findMany(args: any): Promise<any[]>;
  findUnique(args: any): Promise<any | null>;
  create(args: any): Promise<any>;
  delete(args: any): Promise<any>;
}

export interface CommentControllerOptions {
  /** Verify the parent resource exists and the caller may interact with it.
   *  `operation` is 'list' for GET and 'create' for POST, allowing the
   *  access checker to return operation-specific forbidden messages. */
  verifyAccess: (
    req: AuthRequest,
    resourceId: string,
    operation: 'list' | 'create',
  ) => Promise<AccessResult>;
  /** Prisma comment model delegate (e.g. `prisma.noteComment`). */
  commentModel: CommentDelegate;
  /** Field name on the comment record pointing to the parent (e.g. 'noteId' | 'taskId'). */
  parentField: string;
  /** Express `req.params` key holding the resource id (e.g. 'id' | 'taskId'). */
  resourceIdParam: string;
  /** User-facing messages. */
  messages: {
    commentEmpty: string;
    commentNotFound: string;
    commentDeleteForbidden: string;
    commentDeleted: string;
    internalError: string;
  };
  /** Optional: confirm a comment belongs to the requested resource before delete. */
  verifyCommentBelongsToResource?: (comment: any, resourceId: string) => boolean;
  /** Optional activity hook fired after a comment is created. */
  onCommentCreated?: (req: AuthRequest, comment: any, resourceId: string) => Promise<void>;
  /** Optional activity hook fired after a comment is deleted. */
  onCommentDeleted?: (req: AuthRequest, comment: any, resourceId: string) => Promise<void>;
  /** Logger label used in `logger.error` calls. */
  logPrefix: string;
}

/**
 * Builds the standard `{ list, create, remove }` comment controller triplet
 * from a single config object.
 *
 * Extracted from the near-identical `noteComment.controller.ts` and
 * `taskComment.controller.ts` (~80 parallel lines each). The skeleton —
 * verify access → query → respond, validate content → verify access → create
 * → optional hook → respond, findUnique → ownership check → optional
 * belongs-to check → delete → optional hook → respond — is shared; the
 * resource-specific access logic, messages, and optional activity hooks are
 * parameterized.
 */
export function createCommentController(options: CommentControllerOptions) {
  const {
    verifyAccess,
    commentModel,
    parentField,
    resourceIdParam,
    messages,
    verifyCommentBelongsToResource,
    onCommentCreated,
    onCommentDeleted,
    logPrefix,
  } = options;

  const list = async (req: AuthRequest, res: Response) => {
    const resourceId = req.params[resourceIdParam] as string;
    try {
      const access = await verifyAccess(req, resourceId, 'list');
      if (!access.ok) {
        return res.status(access.status).json({ error: access.message });
      }

      const comments = await commentModel.findMany({
        where: { [parentField]: resourceId },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json(comments);
    } catch (error) {
      logger.error(`${logPrefix} list error:`, error);
      res.status(500).json({ error: messages.internalError });
    }
  };

  const create = async (req: AuthRequest, res: Response) => {
    const resourceId = req.params[resourceIdParam] as string;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: messages.commentEmpty });
    }

    try {
      const access = await verifyAccess(req, resourceId, 'create');
      if (!access.ok) {
        return res.status(access.status).json({ error: access.message });
      }

      const comment = await commentModel.create({
        data: {
          content: content.trim(),
          [parentField]: resourceId,
          userId: req.userId as string,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      if (onCommentCreated) {
        await onCommentCreated(req, comment, resourceId);
      }

      res.status(201).json(comment);
    } catch (error) {
      logger.error(`${logPrefix} create error:`, error);
      res.status(500).json({ error: messages.internalError });
    }
  };

  const remove = async (req: AuthRequest, res: Response) => {
    const resourceId = req.params[resourceIdParam] as string;
    const commentId = req.params.commentId as string;

    try {
      const comment = await commentModel.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        return res.status(404).json({ error: messages.commentNotFound });
      }

      if (verifyCommentBelongsToResource && !verifyCommentBelongsToResource(comment, resourceId)) {
        return res.status(404).json({ error: messages.commentNotFound });
      }

      if (comment.userId !== req.userId && req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: messages.commentDeleteForbidden });
      }

      await commentModel.delete({
        where: { id: commentId },
      });

      if (onCommentDeleted) {
        await onCommentDeleted(req, comment, resourceId);
      }

      res.json({ message: messages.commentDeleted });
    } catch (error) {
      logger.error(`${logPrefix} delete error:`, error);
      res.status(500).json({ error: messages.internalError });
    }
  };

  return { list, create, remove };
}
