import type { FastifyReply, FastifyRequest } from 'fastify';
import prisma from '../services/prisma';
import { AppError } from '../utils/error';
import { refreshTutorialLessonContent } from '../services/tutorial-content.service';
import { deleteTutorialImage, storeTutorialImage } from '../services/tutorial-image.storage';

export async function replaceStepImage(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const current = await prisma.tutorialStep.findUnique({
    where: { id },
    include: { section: { include: { lesson: { select: { courseId: true } } } } },
  });
  if (!current) throw new AppError('步骤不存在', 404, 'STEP_NOT_FOUND');
  const part = await request.file();
  if (!part) throw new AppError('请选择图片', 400, 'IMAGE_REQUIRED');
  const stored = await storeTutorialImage(
    await part.toBuffer(),
    current.section.lesson.courseId,
    current.section.lessonId,
  );
  let step;
  try {
    step = await prisma.tutorialStep.update({
      where: { id },
      data: {
        imageUrl: stored.url,
        imageKey: stored.key,
        imageSize: stored.size,
        storageConfigId: stored.storageConfigId,
      },
    });
  } catch (error) {
    await deleteTutorialImage({
      imageKey: stored.key,
      imageSize: stored.size,
      storageConfigId: stored.storageConfigId,
    });
    throw error;
  }

  // Refresh the rendered lesson before cleaning up the previous object. If the
  // refresh fails, both URLs remain valid and a later edit can safely retry.
  await refreshTutorialLessonContent(current.section.lessonId);
  await Promise.allSettled([deleteTutorialImage(current)]);
  return reply.send(step);
}

export async function removeStepImage(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const current = await prisma.tutorialStep.findUnique({
    where: { id },
    include: { section: true },
  });
  if (!current) throw new AppError('步骤不存在', 404, 'STEP_NOT_FOUND');
  await prisma.tutorialStep.update({
    where: { id },
    data: { imageUrl: null, imageKey: null, imageSize: null, storageConfigId: null },
  });
  await deleteTutorialImage(current);
  await refreshTutorialLessonContent(current.section.lessonId);
  return reply.send({ success: true });
}
