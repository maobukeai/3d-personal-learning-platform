import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createNotification } from '../utils/notification';
import { deleteFileByUrl } from '../utils/file';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../middlewares/error.middleware';
import { awardPoints, deductPoints, PointsAction } from '../services/points.service';

export const getAllShowcases = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { filter, type } = req.query;

  try {
    let orderBy: Prisma.ShowcaseOrderByWithRelationInput = { createdAt: 'desc' };
    if ((filter as string) === '热门') {
      orderBy = { likes: { _count: 'desc' } };
    }

    const where: Prisma.ShowcaseWhereInput = {
      status: 'APPROVED',
    };
    if (type && (type as string) !== '全部') {
      where.type = type as string;
    }

    const showcases = await prisma.showcase.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        type: true,
        thumbnailUrl: true,
        images: true,
        videoUrl: true,
        isVideo: true,
        views: true,
        status: true,
        assetId: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        asset: {
          select: { id: true, title: true, url: true, type: true, thumbnail: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        likes: {
          where: { userId: req.userId as string },
        },
      },
      orderBy,
      take: 100,
    });

    const formatted = showcases.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      tags: s.tags,
      type: s.type,
      thumbnailUrl: s.thumbnailUrl,
      images: s.images,
      videoUrl: s.videoUrl,
      isVideo: s.isVideo,
      views: s.views,
      status: s.status,
      assetId: s.assetId,
      asset: s.asset,
      createdAt: s.createdAt,
      user: s.user,
      isLiked: s.likes.length > 0,
      likesCount: s._count.likes,
      commentsCount: s._count.comments,
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getShowcaseById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const showcase = await prisma.showcase.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, bio: true },
        },
        asset: {
          select: { id: true, title: true, url: true, type: true, thumbnail: true },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        likes: {
          where: { userId: req.userId as string },
        },
      },
    });

    if (!showcase) {
      return next(new AppError('Work not found', 404));
    }

    await prisma.showcase.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    res.json({
      ...showcase,
      isLiked: showcase.likes.length > 0,
      likesCount: showcase._count.likes,
      commentsCount: showcase._count.comments,
      views: showcase.views + 1,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyShowcases = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const showcases = await prisma.showcase.findMany({
      where: { userId: req.userId as string },
      include: {
        _count: {
          select: { likes: true, comments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(showcases);
  } catch (error) {
    next(error);
  }
};

export const createShowcase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const thumbnailFile = files?.thumbnail?.[0];
    const imageFiles = files?.images || [];

    const { title, description, tags, videoUrl, isVideo, type, assetId } = req.body;

    if (!title || !title.trim()) {
      return next(new AppError('标题不能为空', 400));
    }

    let showcaseType = type || 'IMAGE';
    if (assetId && !type) {
      showcaseType = 'MODEL';
    }
    if (isVideo === 'true' && !type) {
      showcaseType = 'VIDEO';
    }

    let thumbnailUrl = '';
    if (thumbnailFile) {
      thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/showcase/${thumbnailFile.filename}`;
    } else if (assetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: assetId as string },
      });
      if (asset?.thumbnail) {
        thumbnailUrl = asset.thumbnail;
      }
    }

    if (!thumbnailUrl && showcaseType !== 'TEXT') {
      return next(new AppError('Thumbnail is required', 400));
    }

    const imageUrls = imageFiles.map(
      (f) => `${req.protocol}://${req.get('host')}/uploads/showcase/${f.filename}`,
    );

    const showcase = await prisma.showcase.create({
      data: {
        title,
        description: description || null,
        tags: tags || null,
        type: showcaseType,
        thumbnailUrl: thumbnailUrl || '',
        images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        videoUrl: videoUrl || null,
        isVideo: isVideo === 'true',
        assetId: assetId || null,
        userId: req.userId as string,
        teamId: req.workspaceId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        asset: {
          select: { id: true, title: true, url: true, type: true, thumbnail: true },
        },
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.CREATE_SHOWCASE,
      module: AuditModule.SHOWCASE,
      description: `Created showcase: ${showcase.title}`,
      newValue: showcase,
      req,
    });

    await awardPoints(req.userId as string, PointsAction.PUBLISH_SHOWCASE);

    res.status(201).json(showcase);
  } catch (error) {
    next(error);
  }
};

export const publishAssetToShowcase = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { assetId } = req.body;
  const { title, description, tags } = req.body;

  if (!assetId) {
    return next(new AppError('Asset ID is required', 400));
  }

  try {
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        userId: req.userId as string,
      },
    });

    if (!asset) {
      return next(new AppError('Asset not found or access denied', 404));
    }

    const existingShowcase = await prisma.showcase.findFirst({
      where: { assetId },
    });
    if (existingShowcase) {
      return next(new AppError('该作品已发布到展示墙', 400));
    }

    const showcase = await prisma.showcase.create({
      data: {
        title: title || asset.title,
        description: description || asset.description || null,
        tags: tags || null,
        type: 'MODEL',
        thumbnailUrl:
          asset.thumbnail || `${req.protocol}://${req.get('host')}/uploads/assets/placeholder.png`,
        assetId: asset.id,
        isVideo: false,
        userId: req.userId as string,
        teamId: req.workspaceId || asset.teamId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        asset: {
          select: { id: true, title: true, url: true, type: true, thumbnail: true },
        },
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.CREATE_SHOWCASE,
      module: AuditModule.SHOWCASE,
      description: `Published asset to showcase: ${showcase.title}`,
      newValue: showcase,
      req,
    });

    await awardPoints(req.userId as string, PointsAction.PUBLISH_SHOWCASE);

    res.status(201).json(showcase);
  } catch (error) {
    next(error);
  }
};

export const updateShowcase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const showcase = await prisma.showcase.findUnique({
      where: { id },
    });

    if (!showcase) {
      return next(new AppError('Work not found', 404));
    }

    if (showcase.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Forbidden', 403));
    }

    const { title, description, tags, videoUrl, isVideo, type } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const thumbnailFile = files?.thumbnail?.[0];
    const imageFiles = files?.images || [];

    const updateData: Prisma.ShowcaseUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (isVideo !== undefined) updateData.isVideo = isVideo === 'true';
    if (type !== undefined) updateData.type = type;
    if (showcase.userId === req.userId && req.user?.role !== 'ADMIN') {
      updateData.status = 'PENDING';
    }
    if (thumbnailFile) {
      // Delete old thumbnail
      if (showcase.thumbnailUrl) deleteFileByUrl(showcase.thumbnailUrl);
      updateData.thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/showcase/${thumbnailFile.filename}`;
    }
    if (imageFiles.length > 0) {
      const imageUrls = imageFiles.map(
        (f) => `${req.protocol}://${req.get('host')}/uploads/showcase/${f.filename}`,
      );
      const existingImages = showcase.images ? JSON.parse(showcase.images) : [];
      updateData.images = JSON.stringify([...existingImages, ...imageUrls]);
    }

    const updated = await prisma.showcase.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        asset: {
          select: { id: true, title: true, url: true, type: true, thumbnail: true },
        },
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_SHOWCASE, // Updated to standard action name matching audit system if needed, or keeping REJECT_SHOWCASE/generic
      module: AuditModule.SHOWCASE,
      description: `Updated showcase: ${updated.title}`,
      oldValue: showcase,
      newValue: updated,
      req,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const deleteShowcase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const showcase = await prisma.showcase.findUnique({
      where: { id },
    });

    if (!showcase) {
      return next(new AppError('Work not found', 404));
    }

    if (showcase.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Forbidden', 403));
    }

    // Delete files
    if (showcase.thumbnailUrl) deleteFileByUrl(showcase.thumbnailUrl);
    if (showcase.images) {
      const images = JSON.parse(showcase.images);
      images.forEach((url: string) => deleteFileByUrl(url));
    }

    await prisma.showcase.delete({
      where: { id },
    });

    await deductPoints(showcase.userId, PointsAction.PUBLISH_SHOWCASE);

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_SHOWCASE,
      module: AuditModule.SHOWCASE,
      description: `Deleted showcase: ${showcase.title}`,
      oldValue: showcase,
      req,
    });

    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const toggleLike = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const userId = req.userId as string;
  try {
    const existing = await prisma.showcaseLike.findUnique({
      where: { showcaseId_userId: { showcaseId: id, userId } },
    });

    if (existing) {
      await prisma.showcaseLike.delete({
        where: { id: existing.id },
      });
      await deductPoints(userId, PointsAction.LIKE_CONTENT);
      res.json({ liked: false });
    } else {
      const like = await prisma.showcaseLike.create({
        data: { showcaseId: id, userId },
        include: {
          showcase: { select: { userId: true, title: true } },
        },
      });

      if (like.showcase.userId !== userId) {
        await createNotification({
          type: 'SYSTEM',
          title: '收到新的点赞',
          content: `${req.user?.name || '有人'} 点赞了你的作品: ${like.showcase.title}`,
          userId: like.showcase.userId,
          link: '/showcase',
          category: 'MENTION',
        });
      }

      await awardPoints(userId, PointsAction.LIKE_CONTENT);

      res.json({ liked: true });
    }
  } catch (error) {
    next(error);
  }
};

export const getComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const comments = await prisma.showcaseComment.findMany({
      where: { showcaseId: id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments);
  } catch (error) {
    next(error);
  }
};

export const addComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { content } = req.body;
  if (!content || !content.trim()) {
    return next(new AppError('Comment content is required', 400));
  }
  try {
    const comment = await prisma.showcaseComment.create({
      data: {
        content: content.trim(),
        showcaseId: id,
        userId: req.userId as string,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        showcase: { select: { userId: true, title: true } },
      },
    });

    if (comment.showcase.userId !== req.userId) {
      await createNotification({
        type: 'REPLY',
        title: '作品收到新评论',
        content: `${req.user?.name || '有人'} 评论了你的作品: ${comment.showcase.title}`,
        userId: comment.showcase.userId,
        link: '/showcase',
        category: 'MENTION',
      });
    }

    await awardPoints(req.userId as string, PointsAction.CREATE_COMMENT);
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const commentId = req.params.commentId as string;
  try {
    const comment = await prisma.showcaseComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return next(new AppError('Comment not found', 404));
    }

    if (comment.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Forbidden', 403));
    }

    await prisma.showcaseComment.delete({
      where: { id: commentId },
    });

    await deductPoints(comment.userId, PointsAction.CREATE_COMMENT);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
};
