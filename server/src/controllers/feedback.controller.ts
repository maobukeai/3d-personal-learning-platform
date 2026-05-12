import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const uploadAttachment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const attachmentUrl = `${req.protocol}://${req.get('host')}/uploads/feedback/${req.file.filename}`;
    res.json({ url: attachmentUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const { type, title, description, priority, attachmentUrl } = req.body;

    const feedback = await prisma.feedback.create({
      data: {
        type,
        title,
        description,
        priority,
        attachmentUrl,
        userId: req.userId!
      }
    });

    res.status(201).json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
      where: { userId: req.userId as string },
      orderBy: { createdAt: 'desc' }
    });
    res.json(feedbacks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
