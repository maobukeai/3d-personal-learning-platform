import { logger } from '../../utils/logger';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { parseBilibiliUrl } from '../../utils/bilibili';
import { parseYoutubeUrl } from '../../utils/youtube';
import { parseGithubUrl } from '../../utils/github';
import { AppError } from '../../utils/error';
import { createPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { streamLLMChat, AIServiceConfig, AIChatMessage } from '../../services/ai.service';
import { getAIModelById, settingsService } from '../../services/settings.service';
import { invalidatePublicCache, PUBLIC_CACHE_KEYS } from '../../utils/public-cache';
import {
  deleteCoursesWithTutorialImages,
  deleteTutorialLessonWithImages,
} from '../../services/tutorial-content.service';

type AdminRequest = FastifyRequest & {
  body: any;
  query: any;
  params: any;
  file?: any;
};

export const parseExternalLink = async (req: AdminRequest, reply: FastifyReply) => {
  const { url } = req.body;
  if (!url) {
    throw new AppError('URL is required', 400);
  }

  try {
    let metadata;
    if (url.includes('bilibili.com') || url.includes('b23.tv')) {
      metadata = await parseBilibiliUrl(url);
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      metadata = await parseYoutubeUrl(url);
    } else if (url.includes('github.com')) {
      metadata = await parseGithubUrl(url);
    } else {
      throw new AppError('不支持的平台，目前仅支持 B站、YouTube 和 GitHub。', 400);
    }
    reply.send(metadata);
  } catch (error) {
    logger.error('Parse link error:', error);
    throw new AppError(error instanceof Error ? error.message : '解析链接失败', 400);
  }
};

export const createCourseWithLessons = async (req: AdminRequest, reply: FastifyReply) => {
  const { title, description, thumbnail, lessons, categoryId } = req.body;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          title,
          description,
          thumbnail,
          categoryId: categoryId || null,
        },
      });

      if (lessons && Array.isArray(lessons)) {
        await Promise.all(
          lessons.map(
            (lesson: { title: string; videoUrl: string; order: number; content?: string }) =>
              tx.lesson.create({
                data: {
                  title: lesson.title,
                  videoUrl: lesson.videoUrl,
                  order: lesson.order,
                  courseId: course.id,
                  content: lesson.content || '',
                },
              }),
          ),
        );
      }

      return await tx.course.findUnique({
        where: { id: course.id },
        include: { lessons: { orderBy: { order: 'asc' } } },
      });
    });

    await invalidatePublicCache(PUBLIC_CACHE_KEYS.courseCategories);
    reply.status(201).send(result);
  } catch (error) {
    throw error;
  }
};

// --- Course Category Management ---

export const getAllCourseCategories = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const categories = await prisma.courseCategory.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { courses: true },
        },
      },
    });
    reply.send(categories);
  } catch (error) {
    throw error;
  }
};

export const createCourseCategory = async (req: AdminRequest, reply: FastifyReply) => {
  const { name, order } = req.body;
  try {
    const category = await prisma.courseCategory.create({
      data: { name, order: order ? parseInt(order) : 0 },
    });
    await invalidatePublicCache(PUBLIC_CACHE_KEYS.courseCategories);
    reply.status(201).send(category);
  } catch (error) {
    throw error;
  }
};

export const updateCourseCategory = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const { name, order } = req.body;
  try {
    const category = await prisma.courseCategory.update({
      where: { id },
      data: { name, order: order !== undefined ? parseInt(order) : undefined },
    });
    await invalidatePublicCache(PUBLIC_CACHE_KEYS.courseCategories);
    reply.send(category);
  } catch (error) {
    throw error;
  }
};

export const deleteCourseCategory = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  try {
    await prisma.courseCategory.delete({ where: { id } });
    await invalidatePublicCache(PUBLIC_CACHE_KEYS.courseCategories);
    reply.send({ message: 'Category deleted successfully' });
  } catch (error) {
    throw error;
  }
};

// --- Course Management ---

export const getAllCourses = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const courses = await prisma.course.findMany({
      include: {
        lessons: { orderBy: { order: 'asc' } },
        category: true,
        _count: { select: { enrollments: true, reviews: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const coursesWithStats = courses.map((course) => {
      const { reviews, ...rest } = course;
      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) /
            reviews.length
          : 0;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10 };
    });
    reply.send(coursesWithStats);
  } catch (error) {
    throw error;
  }
};

export const createCourse = async (req: AdminRequest, reply: FastifyReply) => {
  const { title, description, thumbnail, categoryId, difficulty, status } = req.body;
  try {
    const course = await prisma.course.create({
      data: {
        title,
        description,
        thumbnail,
        categoryId: categoryId || null,
        difficulty: difficulty || 'BEGINNER',
        status: status || 'PUBLISHED',
      },
    });
    await invalidatePublicCache(PUBLIC_CACHE_KEYS.courseCategories);
    reply.status(201).send(course);
  } catch (error) {
    throw error;
  }
};

export const updateCourse = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const { title, description, thumbnail, categoryId, difficulty, status } = req.body;
  try {
    const course = await prisma.course.update({
      where: { id },
      data: { title, description, thumbnail, categoryId: categoryId || null, difficulty, status },
    });
    await invalidatePublicCache(PUBLIC_CACHE_KEYS.courseCategories);
    reply.send(course);
  } catch (error) {
    throw error;
  }
};

export const deleteCourse = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  try {
    await deleteCoursesWithTutorialImages([id]);
    await invalidatePublicCache(PUBLIC_CACHE_KEYS.courseCategories);
    reply.send({ message: 'Course deleted successfully' });
  } catch (error) {
    throw error;
  }
};

export const batchUpdateCourseStatus = async (req: AdminRequest, reply: FastifyReply) => {
  const { ids, status } = req.body as { ids?: string[]; status?: string };
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('Course ids are required', 400);
    }
    if (!['PUBLISHED', 'DRAFT'].includes(status || '')) {
      throw new AppError('Invalid course status', 400);
    }

    const result = await prisma.course.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    reply.send({ updated: result.count });
  } catch (error) {
    throw error;
  }
};

export const batchDeleteCourses = async (req: AdminRequest, reply: FastifyReply) => {
  const { ids } = req.body as { ids?: string[] };
  try {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError('Course ids are required', 400);
    }

    const result = await deleteCoursesWithTutorialImages(ids);
    await invalidatePublicCache(PUBLIC_CACHE_KEYS.courseCategories);

    reply.send({ deleted: result.count });
  } catch (error) {
    throw error;
  }
};

export const createLesson = async (req: AdminRequest, reply: FastifyReply) => {
  const { courseId, title, content, videoUrl, order, duration, hotspots, sceneConfig } = req.body;
  try {
    const lesson = await prisma.lesson.create({
      data: {
        courseId,
        title,
        content,
        videoUrl,
        order: parseInt(order),
        duration: duration ? parseInt(duration) : 0,
        hotspots: hotspots
          ? typeof hotspots === 'string'
            ? hotspots
            : JSON.stringify(hotspots)
          : null,
        sceneConfig: sceneConfig
          ? typeof sceneConfig === 'string'
            ? sceneConfig
            : JSON.stringify(sceneConfig)
          : null,
      },
    });
    reply.status(201).send(lesson);
  } catch (error) {
    throw error;
  }
};

export const updateLesson = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const { title, content, videoUrl, order, duration, hotspots, sceneConfig } = req.body;
  try {
    const updateData: Partial<Prisma.LessonUpdateInput> = { title, content, videoUrl };
    if (order !== undefined) updateData.order = parseInt(order);
    if (duration !== undefined) updateData.duration = parseInt(duration);
    if (hotspots !== undefined) {
      updateData.hotspots = typeof hotspots === 'string' ? hotspots : JSON.stringify(hotspots);
    }
    if (sceneConfig !== undefined) {
      updateData.sceneConfig =
        typeof sceneConfig === 'string' ? sceneConfig : JSON.stringify(sceneConfig);
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data: updateData,
    });
    reply.send(lesson);
  } catch (error) {
    throw error;
  }
};

export const deleteLesson = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  try {
    await deleteTutorialLessonWithImages(id);
    reply.send({ message: 'Lesson deleted successfully' });
  } catch (error) {
    throw error;
  }
};

// --- Roadmap Management ---

export const getAllRoadmaps = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query, 50, 200);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where: Prisma.RoadmapWhereInput = {
      creatorId: null, // Exclude user-created roadmaps
      ...(q
        ? {
            OR: [{ title: { contains: q } }, { description: { contains: q } }],
          }
        : {}),
    };

    const [total, roadmaps] = await prisma.$transaction([
      prisma.roadmap.count({ where }),
      prisma.roadmap.findMany({
        where,
        include: {
          steps: { orderBy: { order: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    reply.send({
      data: roadmaps,
      pagination: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    throw error;
  }
};

export const createRoadmap = async (req: AdminRequest, reply: FastifyReply) => {
  const { title, description, steps } = req.body;
  try {
    const roadmap = await prisma.$transaction(async (tx) => {
      const rm = await tx.roadmap.create({
        data: { title, description },
      });

      if (steps && Array.isArray(steps)) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const subtasksJson =
            step.subtasks && Array.isArray(step.subtasks) ? JSON.stringify(step.subtasks) : null;
          await tx.roadmapStep.create({
            data: {
              roadmapId: rm.id,
              title: step.title || `阶段 ${i + 1}`,
              description: step.description || '',
              subtasks: subtasksJson,
              order: i + 1,
            },
          });
        }
      }

      return rm;
    });

    const fullRoadmap = await prisma.roadmap.findUnique({
      where: { id: roadmap.id },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });

    reply.status(201).send(fullRoadmap);
  } catch (error) {
    throw error;
  }
};

export const updateRoadmap = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const { title, description, steps } = req.body;
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update the roadmap metadata
      const rm = await tx.roadmap.update({
        where: { id },
        data: { title, description },
      });

      if (steps && Array.isArray(steps)) {
        // 2. Load existing steps from database
        const existingSteps = await tx.roadmapStep.findMany({
          where: { roadmapId: id },
        });
        const existingStepIds = existingSteps.map((s) => s.id);

        // 3. Identify steps to delete
        const incomingStepIds = steps
          .filter((s: { id?: string }) => s.id)
          .map((s: { id?: string }) => s.id as string);
        const stepsToDelete = existingStepIds.filter((dbId) => !incomingStepIds.includes(dbId));

        if (stepsToDelete.length > 0) {
          await tx.roadmapStep.deleteMany({
            where: { id: { in: stepsToDelete } },
          });
        }

        // 4. Create or update steps sequentially to enforce correct ordering
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const orderValue = i + 1;
          const subtasksJson =
            step.subtasks && Array.isArray(step.subtasks) ? JSON.stringify(step.subtasks) : null;

          if (step.id && existingStepIds.includes(step.id)) {
            // Update existing step
            await tx.roadmapStep.update({
              where: { id: step.id },
              data: {
                title: step.title || `阶段 ${orderValue}`,
                description: step.description || '',
                subtasks: subtasksJson,
                order: orderValue,
              },
            });
          } else {
            // Create new step
            await tx.roadmapStep.create({
              data: {
                roadmapId: id,
                title: step.title || `阶段 ${orderValue}`,
                description: step.description || '',
                subtasks: subtasksJson,
                order: orderValue,
              },
            });
          }
        }
      }

      return rm;
    });

    const fullRoadmap = await prisma.roadmap.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });

    reply.send(fullRoadmap);
  } catch (error) {
    throw error;
  }
};

export const deleteRoadmap = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  try {
    await prisma.roadmap.delete({ where: { id } });
    reply.send({ message: 'Roadmap deleted successfully' });
  } catch (error) {
    throw error;
  }
};

export const createRoadmapStep = async (req: AdminRequest, reply: FastifyReply) => {
  const { roadmapId, title, description, order } = req.body;
  try {
    const step = await prisma.roadmapStep.create({
      data: { roadmapId, title, description, order: parseInt(order) },
    });
    reply.status(201).send(step);
  } catch (error) {
    throw error;
  }
};

export const updateRoadmapStep = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const { title, description, order } = req.body;
  try {
    const updateData: Partial<Prisma.RoadmapStepUpdateInput> = { title, description };
    if (order !== undefined) updateData.order = parseInt(order);

    const step = await prisma.roadmapStep.update({
      where: { id },
      data: updateData,
    });
    reply.send(step);
  } catch (error) {
    throw error;
  }
};

export const deleteRoadmapStep = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  try {
    await prisma.roadmapStep.delete({ where: { id } });
    reply.send({ message: 'Roadmap step deleted successfully' });
  } catch (error) {
    throw error;
  }
};

export const aiGenerateRoadmap = async (req: AdminRequest, reply: FastifyReply) => {
  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new AppError('Prompt is required', 400);
  }

  try {
    const settings = await settingsService.getAll();
    const selectedModel = getAIModelById(settings, undefined);
    if (!selectedModel || !selectedModel.enabled) {
      throw new AppError('当前没有可用的 AI 聊天模型，请联系管理员配置。', 503);
    }

    const overrides: Partial<AIServiceConfig> = {
      AI_IMPORT_ENABLED: true,
      AI_PROVIDER: selectedModel.provider,
      AI_API_KEY: selectedModel.apiKey || settings.AI_API_KEY,
      AI_API_ENDPOINT: selectedModel.endpoint || settings.AI_API_ENDPOINT,
      AI_MODEL_NAME: selectedModel.modelName,
      capabilities: selectedModel.capabilities,
      maxTokens: 4000,
    };

    const systemPrompt = `你是一个专业的 3D 节点学习图谱及学习路线规划专家。请根据用户的学习目标或主题，生成一条高精度的官方学习路线图谱。
你必须严格按照下面的 Markdown 格式输出，不要输出任何其他的解释文字，不要用 \`\`\`markdown 包裹。只输出纯 Markdown 内容。

规范格式如下：
# 项目：[学习路线标题，如：Three.js 三维开发成长之路]
描述：[学习路线核心描述。要求详细总结，包含学习目标、整体课程脉络分析、预估学习难度与重点难点，不少于 150 字。]

## 学习路线
### 阶段一：[阶段一名称]
描述：[阶段一描述]
- [ ] [任务项 1]
- [ ] [任务项 2]

### 阶段二：[阶段二名称]
描述：[阶段二描述]
- [ ] [任务项 1]
- [ ] [任务项 2]

要求：
1. 路线结构应当合理、系统且由浅入深，每个阶段名称清晰有创意。
2. 步骤数量在 3 到 6 个之间。每个阶段的任务列表提供 3 到 5 个核心知识技能点。
3. 描述及标题字段使用中文（简体）。
4. 严格禁止输出任何任务看板相关的内容，不要输出 ## 任务看板 模块。`;

    const messages: AIChatMessage[] = [{ role: 'user', content: prompt.trim() }];
    reply.hijack();
    const raw = reply.raw;
    const next = (err: unknown) => {
      throw err;
    };
    await streamLLMChat(messages, systemPrompt, raw, next, overrides, req.userId);
  } catch (error) {
    if (reply.raw.headersSent) {
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
    } else {
      throw error;
    }
  }
};
