import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import prisma from './prisma';
import { parseTutorialPackage } from './tutorial-package.parser';
import { renderTutorialContent } from './tutorial-content.renderer';
import { deleteTutorialImage, storeTutorialImage } from './tutorial-image.storage';
import type { StoredTutorialImage } from './tutorial-package.types';

const tutorialInclude = {
  tutorialSections: {
    orderBy: { order: 'asc' as const },
    include: { steps: { orderBy: { order: 'asc' as const } } },
  },
};

const tutorialSummary = (sceneConfig: string | null): string => {
  if (!sceneConfig) return '';
  try {
    const parsed = JSON.parse(sceneConfig) as { type?: string; summary?: string };
    return parsed.type === 'TUTORIAL_PACKAGE' ? String(parsed.summary || '') : '';
  } catch {
    return '';
  }
};

export async function refreshTutorialLessonContent(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: tutorialInclude,
  });
  if (!lesson) return null;
  const content = renderTutorialContent(
    tutorialSummary(lesson.sceneConfig),
    lesson.tutorialSections,
  );
  return prisma.lesson.update({ where: { id: lessonId }, data: { content } });
}

export async function getCourseTutorialContent(courseId: string) {
  return prisma.lesson.findMany({
    where: { courseId, sceneConfig: { contains: '"type":"TUTORIAL_PACKAGE"' } },
    orderBy: { order: 'asc' },
    include: tutorialInclude,
  });
}

export async function importTutorialPackage(input: {
  courseId: string;
  zipBuffer: Buffer;
  title?: string;
  order?: number;
}) {
  const parsed = await parseTutorialPackage(input.zipBuffer);
  const lessonToken = randomUUID();
  const storedImages: StoredTutorialImage[] = [];
  const imageByStep = new Map<string, StoredTutorialImage>();

  try {
    for (const section of parsed.sections) {
      for (const step of section.steps) {
        if (!step.imageEntry) continue;
        const stored = await storeTutorialImage(
          await parsed.getEntryBuffer(step.imageEntry),
          input.courseId,
          lessonToken,
        );
        storedImages.push(stored);
        imageByStep.set(`${section.order}:${step.order}`, stored);
      }
    }

    const fallbackOrder = await prisma.lesson.aggregate({
      where: { courseId: input.courseId },
      _max: { order: true },
    });
    const order = input.order ?? (fallbackOrder._max.order ?? 0) + 1;
    const durationSeconds = parsed.sections.reduce(
      (max, section) => Math.max(max, section.endTime),
      0,
    );
    const content = renderTutorialContent(
      parsed.summary,
      parsed.sections.map((section) => ({
        ...section,
        steps: section.steps.map((step) => ({
          ...step,
          imageUrl: imageByStep.get(`${section.order}:${step.order}`)?.url,
        })),
      })),
    );

    return await prisma.lesson.create({
      data: {
        title: input.title?.trim() || parsed.title,
        content,
        courseId: input.courseId,
        order,
        duration: Math.max(1, Math.ceil(durationSeconds / 60)),
        sceneConfig: JSON.stringify({ type: 'TUTORIAL_PACKAGE', summary: parsed.summary }),
        tutorialSections: {
          create: parsed.sections.map((section) => ({
            title: section.title,
            startTime: section.startTime,
            endTime: section.endTime,
            order: section.order,
            steps: {
              create: section.steps.map((step) => {
                const image = imageByStep.get(`${section.order}:${step.order}`);
                return {
                  title: step.title,
                  description: step.description,
                  startTime: step.startTime,
                  endTime: step.endTime,
                  screenshotTime: step.screenshotTime,
                  order: step.order,
                  shortcuts: step.shortcuts as Prisma.InputJsonValue,
                  parameters: step.parameters as unknown as Prisma.InputJsonValue,
                  warnings: step.warnings as Prisma.InputJsonValue,
                  imageUrl: image?.url,
                  imageKey: image?.key,
                  imageSize: image?.size,
                  storageConfigId: image?.storageConfigId,
                };
              }),
            },
          })),
        },
      },
      include: tutorialInclude,
    });
  } catch (error) {
    await Promise.allSettled(
      storedImages.map((image) =>
        deleteTutorialImage({
          imageKey: image.key,
          imageSize: image.size,
          storageConfigId: image.storageConfigId,
        }),
      ),
    );
    throw error;
  }
}

export async function deleteTutorialStepWithImage(stepId: string) {
  const step = await prisma.tutorialStep.findUnique({
    where: { id: stepId },
    include: { section: { select: { lessonId: true } } },
  });
  if (!step) return null;
  await prisma.tutorialStep.delete({ where: { id: stepId } });
  await deleteTutorialImage(step);
  await refreshTutorialLessonContent(step.section.lessonId);
  return step;
}

export async function deleteTutorialSectionWithImages(sectionId: string) {
  const section = await prisma.tutorialSection.findUnique({
    where: { id: sectionId },
    include: { steps: true },
  });
  if (!section) return null;
  await prisma.tutorialSection.delete({ where: { id: sectionId } });
  await Promise.allSettled(section.steps.map(deleteTutorialImage));
  await refreshTutorialLessonContent(section.lessonId);
  return section;
}

export async function deleteTutorialLessonWithImages(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: tutorialInclude,
  });
  if (!lesson) return null;
  await prisma.lesson.delete({ where: { id: lessonId } });
  await Promise.allSettled(
    lesson.tutorialSections.flatMap((section) => section.steps).map(deleteTutorialImage),
  );
  return lesson;
}

export async function deleteCoursesWithTutorialImages(courseIds: string[]) {
  const steps = await prisma.tutorialStep.findMany({
    where: { section: { lesson: { courseId: { in: courseIds } } } },
    select: { imageKey: true, imageSize: true, storageConfigId: true },
  });
  const result = await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
  await Promise.allSettled(steps.map(deleteTutorialImage));
  return result;
}
