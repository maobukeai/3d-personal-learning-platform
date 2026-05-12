import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToUser } from '../services/socket.service';

export const getAllDiscussions = async (req: AuthRequest, res: Response) => {
  const { courseId } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const skip = (page - 1) * limit;

  try {
    const where: any = courseId ? { courseId: courseId as string } : {};
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } }
      ];
    }

    const [discussions, total] = await Promise.all([
      prisma.discussion.findMany({
        where,
        include: {
          user: {
            select: { name: true, avatarUrl: true }
          },
          _count: {
            select: { comments: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.discussion.count({ where })
    ]);

    res.json({
      discussions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDiscussionById = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const discussion = await prisma.discussion.findUnique({
      where: { id },
      include: {
        user: {
          select: { name: true, avatarUrl: true }
        },
        comments: {
          include: {
            user: {
              select: { name: true, avatarUrl: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    if (!discussion) return res.status(404).json({ error: 'Discussion not found' });
    res.json(discussion);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createDiscussion = async (req: AuthRequest, res: Response) => {
  const { title, content, courseId } = req.body;
  try {
    const discussion = await prisma.discussion.create({
      data: {
        title,
        content,
        courseId,
        userId: req.userId as string
      }
    });
    res.status(201).json(discussion);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  const { discussionId, content } = req.body;
  try {
    const comment = await prisma.comment.create({
      data: {
        content,
        discussionId,
        userId: req.userId as string
      },
      include: {
        user: {
          select: { name: true, avatarUrl: true }
        },
        discussion: {
          select: { userId: true, title: true }
        }
      }
    });

    // Create notification for discussion author if it's not the same person
    if (comment.discussion.userId !== req.userId) {
      const notification = await prisma.notification.create({
        data: {
          type: 'REPLY',
          title: '收到新回复',
          content: `${req.user?.name || '有人'} 回复了你的讨论: ${comment.discussion.title}`,
          userId: comment.discussion.userId,
          link: `/discussions/${discussionId}`
        }
      });

      // Push real-time notification
      emitToUser(comment.discussion.userId, 'new_notification', notification);
    }

    res.status(201).json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
