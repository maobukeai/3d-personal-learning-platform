import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToUser } from '../services/socket.service';

export const getAllShowcases = async (req: AuthRequest, res: Response) => {
  const { filter } = req.query;
  try {
    let orderBy: any = { createdAt: 'desc' };
    if (filter === '热门') {
      orderBy = { likes: { _count: 'desc' } };
    }

    const showcases = await prisma.showcase.findMany({
      where: { status: 'APPROVED' },
      include: {
        user: {
          select: { name: true, email: true, avatarUrl: true }
        },
        _count: {
          select: { likes: true, comments: true }
        },
        likes: {
          where: { userId: req.userId as string }
        }
      },
      orderBy
    });

    // Format for frontend
    const formatted = showcases.map(s => ({
      ...s,
      isLiked: s.likes.length > 0,
      likesCount: s._count.likes,
      commentsCount: s._count.comments
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createShowcase = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const thumbnailFile = files?.thumbnail?.[0];

    if (!thumbnailFile) {
      return res.status(400).json({ error: 'Thumbnail is required' });
    }

    const { title, videoUrl, isVideo } = req.body;
    const thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/showcase/${thumbnailFile.filename}`;

    const showcase = await prisma.showcase.create({
      data: {
        title,
        thumbnailUrl,
        videoUrl,
        isVideo: isVideo === 'true',
        userId: req.userId as string
      }
    });

    res.status(201).json(showcase);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleLike = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.userId as string;
  try {
    const existing = await prisma.showcaseLike.findUnique({
      where: { showcaseId_userId: { showcaseId: id, userId } }
    });

    if (existing) {
      await prisma.showcaseLike.delete({
        where: { id: existing.id }
      });
      res.json({ liked: false });
    } else {
      const like = await prisma.showcaseLike.create({
        data: { showcaseId: id, userId },
        include: {
          showcase: { select: { userId: true, title: true } }
        }
      });

      // Notify showcase author
      if ((like as any).showcase.userId !== userId) {
        const notification = await prisma.notification.create({
          data: {
            type: 'SYSTEM',
            title: '收到新的点赞',
            content: `${req.user?.name || '有人'} 点赞了你的作品: ${(like as any).showcase.title}`,
            userId: (like as any).showcase.userId,
            link: '/showcase'
          }
        });
        emitToUser((like as any).showcase.userId, 'new_notification', notification);
      }

      res.json({ liked: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { content } = req.body;
  try {
    const comment = await prisma.showcaseComment.create({
      data: {
        content,
        showcaseId: id,
        userId: req.userId as string
      },
      include: {
        user: { select: { name: true, avatarUrl: true } },
        showcase: { select: { userId: true, title: true } }
      }
    });

    // Notify showcase author
    if ((comment as any).showcase.userId !== req.userId) {
      const notification = await prisma.notification.create({
        data: {
          type: 'REPLY',
          title: '作品收到新评论',
          content: `${req.user?.name || '有人'} 评论了你的作品: ${(comment as any).showcase.title}`,
          userId: (comment as any).showcase.userId,
          link: '/showcase'
        }
      });
      emitToUser((comment as any).showcase.userId, 'new_notification', notification);
    }
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
