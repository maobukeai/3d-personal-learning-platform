import { Response, NextFunction } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/error.middleware';

export const uploadAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }
    const attachmentUrl = `${req.protocol}://${req.get('host')}/uploads/feedback/${req.file.filename}`;
    res.json({ url: attachmentUrl });
  } catch (error) {
    next(error);
  }
};

export const submitFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, title, description, priority, attachmentUrl } = req.body;

    if (!type || !title || !description) {
      return next(new AppError('Type, title, and description are required', 400));
    }

    const feedback = await prisma.feedback.create({
      data: {
        type,
        title,
        description,
        priority,
        attachmentUrl,
        userId: req.userId!,
      },
    });

    res.status(201).json(feedback);
  } catch (error) {
    next(error);
  }
};

export const getMyFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      where: { userId: req.userId as string },
      orderBy: { createdAt: 'desc' },
    });
    res.json(feedbacks);
  } catch (error) {
    next(error);
  }
};
