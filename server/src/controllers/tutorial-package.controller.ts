import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AppError } from '../utils/error';
import {
  deleteTutorialLessonWithImages,
  deleteTutorialSectionWithImages,
  deleteTutorialStepWithImage,
  getCourseTutorialContent,
  importTutorialPackage,
  refreshTutorialLessonContent,
} from '../services/tutorial-content.service';
import { deleteTutorialImage, storeTutorialImage } from '../services/tutorial-image.storage';

interface ImportMetadata {
  items?: Array<{ title?: string; order?: number }>;
}

interface PackageImportResult {
  filename: string;
  success: boolean;
  lesson?: unknown;
  error?: string;
}

const requireCourse = async (courseId: string) => {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) throw new AppError('课程不存在', 404, 'COURSE_NOT_FOUND');
};

export async function importPackages(request: FastifyRequest, reply: FastifyReply) {
  const { courseId } = request.params as { courseId: string };
  await requireCourse(courseId);
  if (!request.isMultipart()) {
    throw new AppError('请使用 multipart/form-data 上传 ZIP', 400, 'MULTIPART_REQUIRED');
  }

  let metadata: ImportMetadata = {};
  const results: PackageImportResult[] = [];
  let totalBytes = 0;
  let fileIndex = 0;
  for await (const part of request.parts()) {
    if (part.type === 'field') {
      if (part.fieldname === 'metadata') {
        try {
          metadata = JSON.parse(String(part.value)) as ImportMetadata;
        } catch {
          throw new AppError('导入参数格式错误', 400, 'INVALID_IMPORT_METADATA');
        }
      }
      continue;
    }
    if (part.fieldname !== 'files') continue;
    if (!part.filename.toLowerCase().endsWith('.zip')) {
      throw new AppError('只支持 ZIP 教程包', 400, 'ZIP_ONLY');
    }
    const buffer = await part.toBuffer();
    totalBytes += buffer.length;
    if (totalBytes > 300 * 1024 * 1024 || fileIndex >= 20) {
      throw new AppError('单次最多 20 个 ZIP，总大小不超过 300MB', 400, 'IMPORT_LIMIT_EXCEEDED');
    }
    const item = metadata.items?.[fileIndex];
    try {
      const lesson = await importTutorialPackage({
        courseId,
        zipBuffer: buffer,
        title: item?.title,
        order: item?.order,
      });
      results.push({ filename: part.filename, success: true, lesson });
    } catch (error) {
      results.push({
        filename: part.filename,
        success: false,
        error: error instanceof Error ? error.message : '解析失败',
      });
    }
    fileIndex += 1;
  }
  if (fileIndex === 0) throw new AppError('请选择至少一个 ZIP', 400, 'ZIP_REQUIRED');
  return reply.send({
    successCount: results.filter((result) => result.success).length,
    failedCount: results.filter((result) => !result.success).length,
    results,
  });
}

export async function listPackages(request: FastifyRequest, reply: FastifyReply) {
  const { courseId } = request.params as { courseId: string };
  await requireCourse(courseId);
  return reply.send(await getCourseTutorialContent(courseId));
}

export async function updateTutorialLesson(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as { title?: string; order?: number };
  const lesson = await prisma.lesson.update({
    where: { id },
    data: { title: body.title?.trim() || undefined, order: body.order },
  });
  return reply.send(lesson);
}

export async function deleteTutorialLesson(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const deleted = await deleteTutorialLessonWithImages(id);
  if (!deleted) throw new AppError('章节不存在', 404, 'LESSON_NOT_FOUND');
  return reply.send({ success: true });
}

export async function createSection(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as {
    lessonId: string;
    title: string;
    order?: number;
    startTime?: number;
    endTime?: number;
  };
  const max = await prisma.tutorialSection.aggregate({
    where: { lessonId: body.lessonId },
    _max: { order: true },
  });
  const section = await prisma.tutorialSection.create({
    data: {
      lessonId: body.lessonId,
      title: body.title.trim(),
      order: body.order ?? (max._max.order ?? 0) + 1,
      startTime: body.startTime ?? 0,
      endTime: body.endTime ?? 0,
    },
  });
  await refreshTutorialLessonContent(body.lessonId);
  return reply.status(201).send(section);
}

export async function updateSection(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as {
    title?: string;
    order?: number;
    startTime?: number;
    endTime?: number;
  };
  const data: Prisma.TutorialSectionUpdateInput = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.order !== undefined) data.order = Number(body.order);
  if (body.startTime !== undefined) data.startTime = Number(body.startTime);
  if (body.endTime !== undefined) data.endTime = Number(body.endTime);
  const section = await prisma.tutorialSection.update({ where: { id }, data });
  await refreshTutorialLessonContent(section.lessonId);
  return reply.send(section);
}

export async function deleteSection(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  if (!(await deleteTutorialSectionWithImages(id))) {
    throw new AppError('分组不存在', 404, 'SECTION_NOT_FOUND');
  }
  return reply.send({ success: true });
}

export async function createStep(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as {
    sectionId: string;
    title: string;
    description?: string;
    order?: number;
    startTime?: number;
    endTime?: number;
    shortcuts?: string[];
    parameters?: Array<{ name: string; value: string }>;
    warnings?: string[];
  };
  const section = await prisma.tutorialSection.findUnique({ where: { id: body.sectionId } });
  if (!section) throw new AppError('分组不存在', 404, 'SECTION_NOT_FOUND');
  const max = await prisma.tutorialStep.aggregate({
    where: { sectionId: body.sectionId },
    _max: { order: true },
  });
  const step = await prisma.tutorialStep.create({
    data: {
      sectionId: body.sectionId,
      title: body.title.trim(),
      description: body.description || '',
      order: body.order ?? (max._max.order ?? 0) + 1,
      startTime: body.startTime ?? 0,
      endTime: body.endTime ?? 0,
      shortcuts: (body.shortcuts || []) as Prisma.InputJsonValue,
      parameters: (body.parameters || []) as Prisma.InputJsonValue,
      warnings: (body.warnings || []) as Prisma.InputJsonValue,
    },
  });
  await refreshTutorialLessonContent(section.lessonId);
  return reply.status(201).send(step);
}

export async function updateStep(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const body = request.body as {
    title?: string;
    description?: string;
    order?: number;
    startTime?: number;
    endTime?: number;
    screenshotTime?: number | null;
    shortcuts?: string[];
    parameters?: Array<{ name: string; value: string }>;
    warnings?: string[];
  };
  const current = await prisma.tutorialStep.findUnique({
    where: { id },
    include: { section: true },
  });
  if (!current) throw new AppError('步骤不存在', 404, 'STEP_NOT_FOUND');
  const data: Prisma.TutorialStepUpdateInput = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description;
  if (body.order !== undefined) data.order = Number(body.order);
  if (body.startTime !== undefined) data.startTime = Number(body.startTime);
  if (body.endTime !== undefined) data.endTime = Number(body.endTime);
  if (body.screenshotTime !== undefined) data.screenshotTime = body.screenshotTime;
  if (body.shortcuts !== undefined) data.shortcuts = body.shortcuts as Prisma.InputJsonValue;
  if (body.parameters !== undefined) data.parameters = body.parameters as Prisma.InputJsonValue;
  if (body.warnings !== undefined) data.warnings = body.warnings as Prisma.InputJsonValue;
  const step = await prisma.tutorialStep.update({ where: { id }, data });
  await refreshTutorialLessonContent(current.section.lessonId);
  return reply.send(step);
}

export async function deleteStep(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  if (!(await deleteTutorialStepWithImage(id)))
    throw new AppError('步骤不存在', 404, 'STEP_NOT_FOUND');
  return reply.send({ success: true });
}

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
